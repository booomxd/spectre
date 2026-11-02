// Profile tools: presence overrides (rank, profile, Premier, status) on the private Valorant presence.
// Edits are kept as overrides (dotted path -> value). The game rewrites its presence on every party / queue /
// match change, so while "keep applied" is on they are re-sent whenever the game resets them.
const crypto = require('crypto');
const loadout = require('./loadout');

const getPath = (obj, p) => p.split('.').reduce((o, k) => o?.[k], obj);
// Riot alternates between nested (playerPresenceData.x) and flat (x) payloads, so a nested
// path falls back to the top-level key when its parent object is missing.
function setPath(obj, p, value) {
    const keys = p.split('.');
    const last = keys.pop();
    const parent = keys.reduce((o, k) => o?.[k], obj);
    if (parent && typeof parent === 'object') parent[last] = value;
    else if (keys.length) obj[last] = value;
}
const resolvedPath = (obj, p) => getPath(obj, p) !== undefined || !p.includes('.') ? p : p.split('.').pop();

const pad = n => String(n).padStart(2, '0');
// Presence timestamps look like 2026.11.01-21.40.05 (UTC); the friends list counts the queue timer from it.
const queueTime = d => `${d.getUTCFullYear()}.${pad(d.getUTCMonth() + 1)}.${pad(d.getUTCDate())}-${pad(d.getUTCHours())}.${pad(d.getUTCMinutes())}.${pad(d.getUTCSeconds())}`;
const int = (v, d = 0) => { const n = parseInt(v); return Number.isFinite(n) ? n : d; };
const lc = s => (s || '').toLowerCase();

module.exports = (ctx) => {
    const { riot, handle, emit, app } = ctx;
    const settingsApi = require('./settings');
    // Spectre marker: friends running Spectre see this key in the private presence. Re-read each tick, so toggling is picked up.
    const markerOn = () => { try { return settingsApi.load(riot).spectrePresence !== false; } catch (e) { return true; } };
    const markerVersion = () => { try { return app.getVersion(); } catch (e) { return '0'; } };
    let overrides = {};
    let keep = true;

    async function getMyPresence() {
        const res = await riot.local('get', 'chat/v4/presences');
        // The riot_client presence shares the puuid but has no private data, so pick Valorant's.
        const me = res.presences.find(p => p.puuid === riot.state.puuid && p.product === 'valorant' && p.private);
        if (!me) throw new Error('Valorant presence not found. Is the game running?');
        return { presence: me, data: JSON.parse(Buffer.from(me.private, 'base64').toString('utf8')) };
    }

    async function applyPresence(force) {
        const { presence, data } = await getMyPresence();
        const entries = force || keep ? Object.entries(overrides) : [];
        const marker = markerOn();
        const markerOk = marker ? data.spectre?.v === markerVersion() : !('spectre' in data);
        if (!force && markerOk && entries.every(([p, v]) => getPath(data, resolvedPath(data, p)) === v)) return;
        for (const [p, v] of entries) setPath(data, p, v);
        if (marker) data.spectre = { v: markerVersion() }; else delete data.spectre;
        await riot.local('put', 'chat/v2/me', {
            state: presence.state,
            private: Buffer.from(JSON.stringify(data)).toString('base64'),
            shared: { actor: '', details: '', location: '', product: 'valorant', time: new Date().valueOf() + 35000 },
        });
        emit('tools:applied', { overrides, at: Date.now() });
    }

    const timer = setInterval(() => {
        if (!riot.state.connected) return;
        applyPresence(false).catch(err => console.log('Presence re-apply error:', riot.errMsg(err)));
    }, 5000);
    timer.unref?.();

    async function set(o) {
        Object.assign(overrides, o);
        await applyPresence(true);
        return { overrides };
    }

    // Current presence as friends see it (for the live preview) plus the active overrides.
    handle('tools:state', async () => {
        let current = null, error = null;
        try { current = (await getMyPresence()).data; } catch (e) { error = riot.errMsg(e); }
        return { overrides, keep, current, error };
    });

    handle('tools:keep', on => { keep = !!on; return { keep }; });
    handle('tools:reset', () => { overrides = {}; emit('tools:applied', { overrides, at: Date.now() }); return { overrides }; });

    handle('tools:rank', ({ tier, leaderboardPosition } = {}) => {
        const o = { 'playerPresenceData.competitiveTier': int(tier) };
        if (leaderboardPosition !== undefined) o['playerPresenceData.leaderboardPosition'] = Math.max(int(leaderboardPosition), 0);
        return set(o);
    });

    // Account level / idle / card / title. Card and title must be owned.
    handle('tools:profile', async ({ accountLevel, isIdle, playerCardId, playerTitleId } = {}) => {
        const owned = (playerCardId || playerTitleId) ? await loadout.getOwned(riot) : null;
        if (playerCardId && !owned.cards.some(c => lc(c) === lc(playerCardId))) throw new Error('You do not own that player card');
        if (playerTitleId && !owned.titles.some(t => lc(t) === lc(playerTitleId))) throw new Error('You do not own that title');
        const o = {};
        if (accountLevel !== undefined) o['playerPresenceData.accountLevel'] = Math.max(int(accountLevel, 1), 1);
        if (isIdle !== undefined) o.isIdle = !!isIdle;
        if (playerCardId) o['playerPresenceData.playerCardId'] = playerCardId;
        if (playerTitleId !== undefined) o['playerPresenceData.playerTitleId'] = playerTitleId || null;
        return set(o);
    });

    handle('tools:premier', async (p = {}) => {
        let rosterId = overrides['premierPresenceData.rosterId'];
        if (!rosterId) {
            try { rosterId = (await getMyPresence()).data.premierPresenceData?.rosterId; } catch (e) { }
        }
        return set({
            'premierPresenceData.rosterId': rosterId || crypto.randomUUID(),
            'premierPresenceData.rosterName': String(p.rosterName ?? ''),
            'premierPresenceData.rosterTag': String(p.rosterTag ?? ''),
            'premierPresenceData.division': int(p.division),
            'premierPresenceData.score': int(p.score),
            'premierPresenceData.showTag': !!p.showTag,
            'premierPresenceData.showPlating': !!p.showPlating,
            'premierPresenceData.plating': p.showPlating ? 1 : 0,
            'premierPresenceData.showAura': !!p.showAura,
        });
    });

    // state: MENUS | QUEUE | PREGAME | INGAME | RANGE; queue '' = custom game.
    handle('tools:status', async (s = {}) => {
        const state = s.state || 'MENUS';
        const queue = s.queue ?? '';
        const range = state === 'RANGE';
        const inGame = state === 'PREGAME' || state === 'INGAME' || range;
        const loop = state === 'QUEUE' ? 'MENUS' : range ? 'INGAME' : state;
        const custom = queue === '';
        const flow = range ? 'ShootingRange' : custom ? 'CustomGame' : inGame || state === 'QUEUE' ? 'Matchmaking' : 'Invalid';
        let mapPath = s.map || '';
        if (range) {
            const maps = await riot.valApi('maps');
            mapPath = maps.find(m => m.mapUrl?.includes('Range'))?.mapUrl || mapPath;
        }
        const max = int(s.maxPartySize, 5) || 5;
        const size = Math.min(Math.max(int(s.partySize, 1), 1), max);
        const ally = int(s.ally), enemy = int(s.enemy);
        return set({
            'matchPresenceData.sessionLoopState': loop,
            'partyPresenceData.partyOwnerSessionLoopState': loop,
            'matchPresenceData.queueId': queue,
            'queueId': queue,
            'matchPresenceData.provisioningFlow': flow,
            'provisioningFlow': flow,
            'partyPresenceData.partyOwnerProvisioningFlow': flow,
            'matchPresenceData.matchMap': inGame ? mapPath : '',
            'partyPresenceData.partyOwnerMatchMap': inGame ? mapPath : '',
            'partyOwnerMatchScoreAllyTeam': ally,
            'partyOwnerMatchScoreEnemyTeam': enemy,
            'partyPresenceData.partyOwnerMatchScoreAllyTeam': ally,
            'partyPresenceData.partyOwnerMatchScoreEnemyTeam': enemy,
            'partyPresenceData.partyState': state === 'QUEUE' ? 'MATCHMAKING' : custom && !inGame ? 'CUSTOM_GAME_SETUP' : 'DEFAULT',
            'partyPresenceData.queueEntryTime': state === 'QUEUE' ? queueTime(new Date()) : '0001.01.01-00.00.00',
            'partySize': size,
            'maxPartySize': max,
            'partyPresenceData.partySize': size,
            'partyPresenceData.maxPartySize': max,
            'partyPresenceData.partyAccessibility': s.open ? 'OPEN' : 'CLOSED',
        });
    });
};
