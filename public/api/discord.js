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
// Spectre's own Discord application; its name is what friends see after "Playing". Public, not a secret.
const APP_ID = '1566720776202231818';
const cap = s => (s ? s[0] + s.slice(1).toLowerCase() : s);

module.exports = ({ riot, handle }) => {
    const scouting = require('../scout')(riot);
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

    // Rank names and icons from the current tier table.
    async function tierInfo(tier) {
        if (!tier) return null;
        try {
            const eps = await riot.valApi('competitivetiers');
            const t = eps[eps.length - 1].tiers.find(x => x.tier === tier);
            return t ? { name: t.tierName.toLowerCase().replace(/\b\w/g, c => c.toUpperCase()), icon: t.largeIcon || t.smallIcon } : null;
        } catch (e) { return null; }
    }

    // Own rank (current act + RR, peak), cached for five minutes.
    let rankCache = { at: 0, value: null };
    async function myRank() {
        if (Date.now() - rankCache.at < 300000) return rankCache.value;
        let value = null;
        try { const r = await scouting.rank(riot.state.puuid); value = { tier: r.current.tier, rr: r.current.rr, peak: r.peak.tier }; } catch (e) { }
        rankCache = { at: Date.now(), value };
        return value;
    }

    // The agent you're playing, from the live match (presence doesn't carry it).
    let agentCache = { matchId: null, value: null };
    async function myAgent() {
        try {
            const p = await riot.glz('get', `core-game/v1/players/${riot.state.puuid}`);
            if (agentCache.matchId === p.MatchID && agentCache.value) return agentCache.value;
            const m = await riot.glz('get', `core-game/v1/matches/${p.MatchID}`);
            const cid = (m.Players || []).find(x => x.Subject === riot.state.puuid)?.CharacterID;
            const a = cid && (await riot.valApi('agents?isPlayableCharacter=true')).find(x => x.uuid.toLowerCase() === cid.toLowerCase());
            agentCache = { matchId: p.MatchID, value: a ? { name: a.displayName, icon: a.displayIcon } : null };
            return agentCache.value;
        } catch (e) { return null; }
    }

    // Turns a session snapshot into a Discord activity. Shared by the live presence and the preview scenarios.
    // s: { phase: 'ingame'|'pregame'|'queue'|'lobby', mode, map: {name, image}, score: [a, b], agent: {name, icon},
    //      rank: {name, rr, icon}, peak: {name}, level, party: [size, max], partyId, start }
    function format(s, cfg) {
        if (!s) return null;
        const live = s.phase === 'ingame' || s.phase === 'pregame';
        if (!live && !cfg.showLobby) return null;
        const where = { ingame: null, pregame: 'Agent select', queue: 'In queue', lobby: 'Lobby' }[s.phase];
        let details;
        if (s.phase === 'ingame') {
            details = cfg.showMode ? s.mode : 'In a match';
            if (cfg.showScore && s.score) details += ` (${s.score[0]} – ${s.score[1]})`;
            if (cfg.showMap && s.map) details += ` · ${s.map.name}`;
        } else details = cfg.showMode && s.mode ? `${where} · ${s.mode}` : where;

        const parts = [];
        if (cfg.showRank && s.rank) parts.push(s.rank.rr != null ? `${s.rank.name} (${s.rank.rr} RR)` : s.rank.name);
        if (cfg.showPeak && s.peak) parts.push(`Peak ${s.peak.name}`);
        if (cfg.showAgent && s.agent && s.phase === 'ingame') parts.push(s.agent.name);
        if (cfg.showLevel && s.level) parts.push(`Lv ${s.level}`);
        if (cfg.showParty && s.party) parts.push(s.party[0] > 1 ? `${s.party[0]}/${s.party[1]}` : 'Solo');

        const activity = { details };
        if (parts.length) activity.state = parts.join(' · ');
        if (cfg.showElapsed && s.start) activity.timestamps = { start: s.start };
        // Large image: agent (if chosen), else the map; the rank icon fills it when free, else sits in the small slot.
        const large = cfg.showAgent && cfg.agentImage && s.agent && s.phase === 'ingame' ? { image: s.agent.icon, text: s.agent.name }
            : cfg.showMap && s.map?.image && s.phase === 'ingame' ? { image: s.map.image, text: s.map.name } : null;
        const rankIcon = cfg.showRank && s.rank?.icon ? { image: s.rank.icon, text: s.rank.name } : null;
        const assets = {};
        if (large) { assets.large_image = large.image; assets.large_text = large.text; if (rankIcon) { assets.small_image = rankIcon.image; assets.small_text = rankIcon.text; } }
        else if (rankIcon) { assets.large_image = rankIcon.image; assets.large_text = rankIcon.text; }
        if (Object.keys(assets).length) activity.assets = assets;
        return activity;
    }

    // Snapshot of your current session from your own VALORANT presence (null when VALORANT is closed).
    async function snapshot(cfg) {
        let pv = null;
        try { pv = await myPresence(); } catch (e) { }
        if (!pv) return null;
        const loop = pv.matchPresenceData?.sessionLoopState || pv.sessionLoopState || 'MENUS';
        const queue = pv.matchPresenceData?.queueId ?? pv.queueId ?? '';
        const queued = pv.partyPresenceData?.partyState === 'MATCHMAKING';
        const phase = loop === 'INGAME' ? 'ingame' : loop === 'PREGAME' ? 'pregame' : queued ? 'queue' : 'lobby';
        const s = { phase, mode: QUEUES[queue] || (queue ? cap(queue) : 'Custom Game') };

        const mapUrl = pv.matchPresenceData?.matchMap || pv.partyPresenceData?.partyOwnerMatchMap || '';
        if (mapUrl && phase === 'ingame') {
            try { const m = (await riot.valApi('maps')).find(x => x.mapUrl === mapUrl); if (m) s.map = { name: m.displayName, image: m.listViewIcon || m.splash }; } catch (e) { }
        }
        const ally = pv.partyPresenceData?.partyOwnerMatchScoreAllyTeam ?? pv.partyOwnerMatchScoreAllyTeam;
        const enemy = pv.partyPresenceData?.partyOwnerMatchScoreEnemyTeam ?? pv.partyOwnerMatchScoreEnemyTeam;
        if (phase === 'ingame' && ally != null && queue !== 'deathmatch') s.score = [ally, enemy];
        if (phase === 'ingame' && cfg.showAgent) s.agent = await myAgent();
        if (cfg.showRank || cfg.showPeak) {
            const r = await myRank();
            if (r?.tier) s.rank = { ...(await tierInfo(r.tier)), tier: r.tier, rr: r.rr };
            if (r?.peak) s.peak = await tierInfo(r.peak);
        }
        s.level = pv.playerPresenceData?.accountLevel ?? pv.accountLevel ?? null;
        const size = pv.partyPresenceData?.partySize ?? pv.partySize, max = pv.partyPresenceData?.maxPartySize ?? pv.maxPartySize ?? 5;
        if (size > 0) s.party = [size, max];

        const key = phase + queue;
        if (key !== stateKey) { stateKey = key; stateStart = Date.now(); }
        s.start = stateStart;
        return s;
    }

    async function build(cfg) {
        return format(await snapshot(cfg), cfg);
    }

    // Sample sessions for the preview tabs, using your real rank when available.
    async function scenario(name) {
        const [maps, agents, r] = await Promise.all([riot.valApi('maps').catch(() => []), riot.valApi('agents?isPlayableCharacter=true').catch(() => []), myRank()]);
        const map = n => { const m = maps.find(x => x.displayName === n); return m ? { name: m.displayName, image: m.listViewIcon || m.splash } : { name: n }; };
        const agent = n => { const a = agents.find(x => x.displayName === n); return a ? { name: a.displayName, icon: a.displayIcon } : null; };
        const rank = r?.tier ? { ...(await tierInfo(r.tier)), tier: r.tier, rr: r.rr } : { ...(await tierInfo(25)), tier: 25, rr: 142 };
        const base = { rank, peak: await tierInfo(r?.peak || 26), level: 212, party: [3, 5], start: Date.now() - 767000, agent: agent('Jett') };
        return {
            competitive: { ...base, phase: 'ingame', mode: 'Competitive', map: map('Ascent'), score: [9, 5] },
            deathmatch: { ...base, phase: 'ingame', mode: 'Deathmatch', map: map('Abyss'), party: [1, 5] },
            teamdm: { ...base, phase: 'ingame', mode: 'Team Deathmatch', map: map('Piazza'), score: [64, 51] },
            pregame: { ...base, phase: 'pregame', mode: 'Competitive', start: Date.now() - 42000 },
            lobby: { ...base, phase: 'lobby', mode: 'Competitive', start: Date.now() - 180000 },
            queue: { ...base, phase: 'queue', mode: 'Competitive', start: Date.now() - 64000 },
        }[name] || null;
    }

    async function tick() {
        const cfg = load(riot).discord;
        if (!cfg.enabled) { if (sock) await close(); return; }
        try {
            await open(APP_ID);
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

    // The activity for a sample scenario ('competitive', 'deathmatch', ...), or as it would be sent right now ('live').
    handle('discord:preview', async (name = 'live') => {
        const cfg = load(riot).discord;
        return { activity: name === 'live' ? await build(cfg) : format(await scenario(name), cfg) };
    });

    // Enables presence and connects now.
    handle('discord:connect', async () => {
        const cur = load(riot);
        riot.writeStore('settings', { ...cur, discord: { ...cur.discord, enabled: true } });
        lastError = null;
        try { await open(APP_ID); }
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
