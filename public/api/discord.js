// Discord Rich Presence over Discord's local IPC pipe (no dependencies).
// Frame = int32 LE opcode + int32 LE length + JSON. Opcodes: 0 handshake, 1 frame, 2 close, 3 ping, 4 pong.
const net = require('net');
const crypto = require('crypto');
const { load } = require('./settings');

const QUEUES = {
    competitive: 'Competitive', unrated: 'Unrated', spikerush: 'Spike Rush', deathmatch: 'Deathmatch', ggteam: 'Escalation',
    onefa: 'Replication', swiftplay: 'Swiftplay', hurm: 'Team Deathmatch', premier: 'Premier', newmap: 'New Map', snowball: 'Snowball Fight', '': 'Custom Game',
};
const PIPE = n => `\\\\?\\pipe\\discord-ipc-${n}`;
const ID_RE = /^\d{15,22}$/;

module.exports = ({ riot, handle }) => {
    let sock = null, buf = Buffer.alloc(0), user = null, clientId = null;
    let timer = null, lastError = null, lastActivity = null, lastUpdate = null;
    const pending = new Map();
    let stateKey = null, stateStart = Date.now();

    const frame = (op, data) => {
        const body = Buffer.from(JSON.stringify(data));
        const head = Buffer.alloc(8);
        head.writeInt32LE(op, 0); head.writeInt32LE(body.length, 4);
        return Buffer.concat([head, body]);
    };

    function onData(chunk, s) {
        buf = Buffer.concat([buf, chunk]);
        while (buf.length >= 8) {
            const op = buf.readInt32LE(0), len = buf.readInt32LE(4);
            if (buf.length < 8 + len) break;
            let msg = {};
            try { msg = JSON.parse(buf.slice(8, 8 + len).toString()); } catch (e) { }
            buf = buf.slice(8 + len);
            if (op === 3) s.write(frame(4, msg));
            else if (op === 2) { lastError = msg.message || 'Discord closed the connection'; s.destroy(); }
            else if (op === 1) {
                const key = msg.nonce || msg.evt;
                const p = pending.get(key);
                if (p) { pending.delete(key); msg.evt === 'ERROR' ? p.reject(new Error(msg.data?.message || 'Discord error')) : p.resolve(msg); }
            }
        }
    }

    const waitFor = (key, ms = 5000) => new Promise((resolve, reject) => {
        const t = setTimeout(() => { pending.delete(key); reject(new Error('Discord did not respond')); }, ms);
        pending.set(key, { resolve: m => { clearTimeout(t); resolve(m); }, reject: e => { clearTimeout(t); reject(e); } });
    });

    const tryPipe = n => new Promise((resolve, reject) => {
        const s = net.connect(PIPE(n));
        s.once('connect', () => resolve(s));
        s.once('error', reject);
    });

    function drop() {
        sock = null; user = null; clientId = null; buf = Buffer.alloc(0);
        pending.forEach(p => p.reject(new Error('Disconnected'))); pending.clear();
    }

    async function open(id) {
        if (sock && user && clientId === id) return;
        await close();
        let s = null;
        for (let i = 0; i < 10 && !s; i++) { try { s = await tryPipe(i); } catch (e) { } }
        if (!s) throw new Error('Discord is not running (no IPC pipe found)');
        s.on('data', c => onData(c, s));
        s.on('close', () => { if (sock === s) drop(); });
        s.on('error', () => { });
        sock = s; clientId = id; buf = Buffer.alloc(0);
        const ready = waitFor('READY');
        s.write(frame(0, { v: 1, client_id: id }));
        try {
            user = (await ready).data?.user || null;
        } catch (e) { const m = lastError || e.message; s.destroy(); drop(); throw new Error(m); }
    }

    function send(activity) {
        const nonce = crypto.randomUUID();
        const res = waitFor(nonce);
        sock.write(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity }, nonce }));
        return res;
    }

    // Clears the activity, then closes the pipe.
    async function close() {
        if (sock) {
            const s = sock;
            try { await send(null); } catch (e) { }
            try { s.write(frame(2, {})); } catch (e) { }
            s.destroy();
        }
        drop();
    }

    // Own presence -> parsed object, or null when VALORANT is not running.
    async function myPresence() {
        const r = await riot.local('get', 'chat/v4/presences');
        const mine = r.presences.filter(p => p.puuid === riot.state.puuid && p.private);
        const me = mine.find(p => p.product === 'valorant') || mine[0];
        if (!me) return null;
        return JSON.parse(Buffer.from(me.private, 'base64').toString());
    }

    async function build(cfg) {
        let pv = null;
        try { pv = await myPresence(); } catch (e) { }
        if (!pv) return null;
        const loop = pv.matchPresenceData?.sessionLoopState || pv.sessionLoopState || 'MENUS';
        const queue = pv.matchPresenceData?.queueId ?? pv.queueId ?? '';
        const mode = QUEUES[queue] || (queue ? queue[0].toUpperCase() + queue.slice(1) : 'Custom Game');
        const inMatch = loop === 'INGAME', pregame = loop === 'PREGAME';

        let mapName = null;
        const mapUrl = pv.matchPresenceData?.matchMap || pv.partyPresenceData?.partyOwnerMatchMap || '';
        if (cfg.showMap && mapUrl) {
            try { mapName = (await riot.valApi('maps')).find(m => m.mapUrl === mapUrl)?.displayName || null; } catch (e) { }
        }
        let rank = null;
        const tier = pv.playerPresenceData?.competitiveTier;
        if (cfg.showRank && tier >= 3) {
            try {
                const eps = await riot.valApi('competitivetiers');
                const name = eps[eps.length - 1].tiers.find(t => t.tier === tier)?.tierName;
                if (name) rank = name[0] + name.slice(1).toLowerCase();
            } catch (e) { }
        }

        const key = loop + queue;
        if (key !== stateKey) { stateKey = key; stateStart = Date.now(); }

        const queued = pv.partyPresenceData?.partyState === 'MATCHMAKING';
        const state = inMatch ? 'In a match' : pregame ? 'Agent select' : queued ? 'In queue' : 'In the lobby';
        const parts = [];
        if (inMatch && mapName) parts.push(mapName);
        if (inMatch && cfg.showScore && pv.partyOwnerMatchScoreAllyTeam != null) parts.push(`${pv.partyOwnerMatchScoreAllyTeam} - ${pv.partyOwnerMatchScoreEnemyTeam}`);
        if (rank && !cfg.largeImage) parts.push(rank);

        const activity = { details: `${mode} · ${state}`, timestamps: { start: stateStart } };
        if (parts.length) activity.state = parts.join(' · ');
        if (cfg.largeImage) activity.assets = { large_image: cfg.largeImage, large_text: rank ? `Rank: ${rank}` : 'VALORANT' };
        const size = pv.partySize, max = pv.maxPartySize || 5;
        if (cfg.showParty && size > 0 && pv.partyId) activity.party = { id: pv.partyId, size: [size, max] };
        return activity;
    }

    async function tick() {
        const cfg = load(riot).discord;
        if (!cfg.enabled || !ID_RE.test(cfg.clientId)) { if (sock) await close(); return; }
        try {
            await open(cfg.clientId);
            const activity = await build(cfg);
            await send(activity);
            lastActivity = activity; lastUpdate = Date.now(); lastError = null;
        } catch (e) { lastError = e.message; }
    }

    function stopLoop() { if (timer) clearInterval(timer); timer = null; }
    function startLoop() {
        stopLoop();
        tick();
        timer = setInterval(tick, 15000);
    }

    const status = () => ({
        enabled: !!load(riot).discord.enabled, connected: !!sock && !!user,
        user: user ? { username: user.username, id: user.id, avatar: user.avatar } : null,
        error: lastError, lastUpdate, activity: lastActivity,
    });

    handle('discord:status', () => status());

    // The activity as it would be sent right now (null when VALORANT is closed).
    handle('discord:preview', async () => ({ activity: await build(load(riot).discord) }));

    // Optionally saves a new Client ID, then enables presence and connects now.
    handle('discord:connect', async (id) => {
        const cur = load(riot);
        const cid = String(id || cur.discord.clientId || '').trim();
        if (!ID_RE.test(cid)) throw new Error('Enter your Discord application Client ID (a 17-20 digit number)');
        riot.writeStore('settings', { ...cur, discord: { ...cur.discord, clientId: cid, enabled: true } });
        lastError = null;
        try { await open(cid); }
        catch (e) { lastError = e.message; throw e; }
        startLoop();
        await new Promise(r => setTimeout(r, 800));
        return status();
    });

    handle('discord:disconnect', async () => {
        const cur = load(riot);
        riot.writeStore('settings', { ...cur, discord: { ...cur.discord, enabled: false } });
        stopLoop();
        await close();
        lastActivity = null; lastError = null;
        return status();
    });

    // Resume on app start when it was enabled.
    if (load(riot).discord?.enabled) setTimeout(startLoop, 4000);
};
