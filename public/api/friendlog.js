// Friend activity: snapshots your friends list and records who was added, removed or renamed since the last look.
// Stored per signed-in account in userData/friendlog.json as { [myPuuid]: { snapshot: { puuid: 'Name#Tag' }, events, lastScan } }.
const SCAN_EVERY = 2 * 60 * 1000;
const MAX_EVENTS = 500;

module.exports = ({ riot, handle, emit }) => {
    const load = () => riot.readStore('friendlog', {});
    const mine = all => all[riot.state.puuid] || { snapshot: null, events: [], lastScan: null };

    let scanning = null;
    async function scan() {
        if (!riot.state.connected || !riot.state.puuid) throw new Error('Waiting for the Riot Client');
        if (scanning) return scanning;
        scanning = (async () => {
            const res = await riot.local('get', 'chat/v4/friends');
            const now = {};
            for (const f of res.friends || []) if (f.puuid) now[f.puuid] = `${f.game_name || ''}#${f.game_tag || ''}`;
            const all = load();
            const me = mine(all);
            // The Riot Client briefly reports an empty list while it starts; never read that as "everyone left".
            if (!Object.keys(now).length && me.snapshot && Object.keys(me.snapshot).length) return me;
            const at = Date.now();
            const found = [];
            if (me.snapshot) {
                for (const [puuid, name] of Object.entries(now)) {
                    if (!(puuid in me.snapshot)) found.push({ type: 'added', puuid, name, at });
                    else if (me.snapshot[puuid] !== name && name !== '#') found.push({ type: 'renamed', puuid, name, from: me.snapshot[puuid], at });
                }
                for (const [puuid, name] of Object.entries(me.snapshot)) if (!(puuid in now)) found.push({ type: 'removed', puuid, name, at });
            }
            // Keep a known name when the client hands back a blank one.
            for (const [puuid, name] of Object.entries(now)) if (name === '#' && me.snapshot?.[puuid]) now[puuid] = me.snapshot[puuid];
            const next = {
                snapshot: now, lastScan: at,
                events: [...found.map((e, i) => ({ id: `${at}-${i}`, ...e })), ...me.events].slice(0, MAX_EVENTS),
            };
            all[riot.state.puuid] = next;
            riot.writeStore('friendlog', all);
            if (found.length) emit('friendlog:changed', { count: found.length });
            return next;
        })().finally(() => { scanning = null; });
        return scanning;
    }

    const view = me => ({ events: me.events, lastScan: me.lastScan, tracking: !!me.snapshot, friends: me.snapshot ? Object.keys(me.snapshot).length : 0 });

    handle('friendlog:list', async () => view(mine(load())));
    handle('friendlog:scan', async () => view(await scan()));
    handle('friendlog:clear', async () => {
        const all = load();
        if (all[riot.state.puuid]) { all[riot.state.puuid].events = []; riot.writeStore('friendlog', all); }
        return view(mine(all));
    });

    setTimeout(() => scan().catch(() => { }), 15000);
    setInterval(() => scan().catch(() => { }), SCAN_EVERY);
};
