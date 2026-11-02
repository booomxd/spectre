// Live match rosters. Players are named only if not incognito (streamer mode), otherwise they are just their agent;
// their level, card and title stay hidden too. Ranks for everyone listed (agent select lists only your team). Once
// the match is live every player can be scouted and have their loadout viewed through a random per-match token, so
// the UI never holds a hidden player's puuid.
const crypto = require('crypto');

module.exports = ({ riot, handle }) => {
    const known = require('../known')(riot);
    const scouting = require('../scout')(riot);
    const mmrCache = new Map();    // puuid -> { at, value }
    const nameCache = new Map();   // puuid -> { gameName, tagLine }
    const MMR_TTL = 5 * 60 * 1000;

    // Players of the current match by random token. `hidden` marks streamer-mode players, `identity` keeps card and
    // title of named players for the loadout panel, `scouted` keeps scout summaries until the match changes.
    const freshRefs = matchId => ({ matchId, byToken: new Map(), byPuuid: new Map(), hidden: new Set(), identity: new Map(), scouted: new Map() });
    let refs = freshRefs(null);

    const is404 = e => e.response?.status === 404;

    // Current-act rank + RR and peak rank, cached per player.
    async function mmr(puuid) {
        const hit = mmrCache.get(puuid);
        if (hit && Date.now() - hit.at < MMR_TTL) return hit.value;
        let value = { tier: 0, rr: 0, peak: 0 }, ok = false;
        try {
            const r = await scouting.rank(puuid);
            value = { tier: r.current.tier, rr: r.current.rr, peak: r.peak.tier };
            ok = true;
        } catch (e) { }
        if (!ok) value.failed = true;
        // A failed lookup (e.g. rate limited) is retried after 30s instead of showing Unranked for the full TTL.
        mmrCache.set(puuid, { at: ok ? Date.now() : Date.now() - MMR_TTL + 30000, value });
        return value;
    }

    // Runs `fn` over `items` with a small concurrency limit.
    async function pool(items, limit, fn) {
        let i = 0;
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (i < items.length) { const item = items[i++]; await fn(item); }
        }));
    }

    // ---- in-match loadouts ----
    // Socket ids inside a core-game loadout item.
    const SOCKET = {
        skin: 'bcef87d6-209b-46c6-8b19-fbe40bd95abc', level: 'e7c63390-eda7-46e0-bb7a-a6abdacd2433',
        chroma: '3ad1b2b2-acdb-4524-852f-954a76ddae0a', buddy: '77258665-71d1-4623-bc72-44db9bd5b3b3', buddyLevel: 'dd3bf334-87f3-40bd-b043-682a57a8dc3a',
    };
    const WEAPON_ORDER = ['Vandal', 'Phantom', 'Melee', 'Operator', 'Sheriff', 'Ghost', 'Spectre', 'Guardian', 'Bulldog', 'Marshal', 'Outlaw', 'Odin', 'Ares', 'Judge', 'Bucky', 'Stinger', 'Frenzy', 'Shorty', 'Classic'];
    const lc = x => (x || '').toLowerCase();

    // Weapon, skin, chroma, buddy and spray lookups by uuid, built once from valorant-api content.
    let contentIndex = null;
    async function content() {
        if (contentIndex) return contentIndex;
        const [weapons, buddies, sprays] = await Promise.all([riot.valApi('weapons'), riot.valApi('buddies').catch(() => []), riot.valApi('sprays').catch(() => [])]);
        const ix = { weapon: {}, skin: {}, chroma: {}, level: {}, buddy: {}, spray: {} };
        for (const w of weapons) {
            ix.weapon[lc(w.uuid)] = w;
            for (const s of w.skins || []) {
                ix.skin[lc(s.uuid)] = s;
                for (const c of s.chromas || []) ix.chroma[lc(c.uuid)] = { c, s };
                for (const l of s.levels || []) ix.level[lc(l.uuid)] = s;
            }
        }
        for (const b of buddies) { ix.buddy[lc(b.uuid)] = b; for (const l of b.levels || []) ix.buddy[lc(l.uuid)] = b; }
        for (const s of sprays) { ix.spray[lc(s.uuid)] = s; for (const l of s.levels || []) ix.spray[lc(l.uuid)] = s; }
        return (contentIndex = ix);
    }

    // One player's loadout: every weapon's skin (chroma render) and buddy, plus equipped sprays.
    function parseLoadout(L, ix) {
        const sock = (item, k) => lc(item.Sockets?.[SOCKET[k]]?.Item?.ID);
        const weapons = Object.entries(L.Items || {}).map(([wid, item]) => {
            const w = ix.weapon[lc(wid)];
            if (!w) return null;
            const ch = ix.chroma[sock(item, 'chroma')];
            const skin = ix.skin[sock(item, 'skin')] || ch?.s || ix.level[sock(item, 'level')];
            const buddy = ix.buddy[sock(item, 'buddy')] || ix.buddy[sock(item, 'buddyLevel')];
            return {
                weapon: w.displayName,
                skin: skin?.displayName || w.displayName,
                // Variant renders first: valorant-api's icons for most standard skins are an "X" placeholder.
                image: ch?.c.fullRender || ch?.c.displayIcon || skin?.chromas?.[0]?.fullRender || skin?.displayIcon || w.displayIcon,
                buddy: buddy ? { name: buddy.displayName, icon: buddy.displayIcon } : null,
            };
        }).filter(Boolean);
        const at = name => { const i = WEAPON_ORDER.indexOf(name); return i < 0 ? 99 : i; };
        weapons.sort((a, b) => at(a.weapon) - at(b.weapon) || a.weapon.localeCompare(b.weapon));
        const picks = [...(L.Sprays?.SpraySelections || []).map(s => s.SprayID), ...(L.Expressions?.AESSelections || []).map(s => s.AssetID)];
        const seen = new Set();
        const sprays = picks.map(id => ix.spray[lc(id)]).filter(s => s && !seen.has(s.uuid) && seen.add(s.uuid))
            .map(s => ({ name: s.displayName, icon: s.fullTransparentIcon || s.displayIcon }));
        return { weapons, sprays };
    }

    // Loadouts of everyone in the current in-game match, fetched once per match (they can't change mid-match).
    let loadouts = { matchId: null, byPuuid: null, failedAt: 0 };
    async function matchLoadouts(id) {
        if (loadouts.matchId === id && loadouts.byPuuid) return loadouts.byPuuid;
        if (loadouts.matchId === id && Date.now() - loadouts.failedAt < 30000) return new Map();
        try {
            const [res, ix] = await Promise.all([riot.glz('get', `core-game/v1/matches/${id}/loadouts`), content()]);
            const byPuuid = new Map();
            for (const e of res.Loadouts || []) { const L = e.Loadout || e; if (L.Subject) byPuuid.set(L.Subject, parseLoadout(L, ix)); }
            loadouts = { matchId: id, byPuuid, failedAt: 0 };
            return byPuuid;
        } catch (e) {
            loadouts = { matchId: id, byPuuid: null, failedAt: Date.now() };
            return new Map();
        }
    }

    // puuids whose visible VALORANT presence carries the Spectre marker (friends and party only).
    async function spectreSet() {
        const out = new Set();
        try {
            const res = await riot.local('get', 'chat/v4/presences');
            for (const p of res.presences || []) {
                if (!p.puuid || p.product !== 'valorant' || !p.private) continue;
                try { if (JSON.parse(Buffer.from(p.private, 'base64').toString('utf8'))?.spectre) out.add(p.puuid); } catch (e) { }
            }
        } catch (e) { }
        return out;
    }

    const serverName = pod => (pod || '').match(/-gp-(.+)-\d+$/)?.[1]?.replace(/-/g, ' ') || null;

    async function resolve(kind, id) {
        const base = kind === 'pregame' ? 'pregame/v1/matches/' : 'core-game/v1/matches/';
        const m = await riot.glz('get', base + id);
        const [agents, maps, loadoutMap] = await Promise.all([
            riot.valApi('agents?isPlayableCharacter=true').catch(() => []),
            riot.valApi('maps').catch(() => []),
            kind === 'ingame' ? matchLoadouts(id) : new Map(),
        ]);
        const agentOf = cid => {
            const a = cid && agents.find(x => x.uuid.toLowerCase() === cid.toLowerCase());
            return a ? { id: a.uuid, name: a.displayName, icon: a.displayIcon, role: a.role?.displayName || null } : null;
        };
        const map = maps.find(x => x.mapUrl === m.MapID);
        const me = riot.state.puuid;
        const raw = kind === 'pregame' ? (m.AllyTeam?.Players || []) : (m.Players || []);
        const myRaw = raw.find(p => p.Subject === me);
        const myTeam = kind === 'pregame' ? (m.AllyTeam?.TeamID || 'Blue') : (myRaw?.TeamID || 'Blue');

        const [knownSet, partySet, spectres] = await Promise.all([known.knownPuuids(), known.partyPuuids(), spectreSet()]);
        const isKnown = s => knownSet.has(s);
        // Names exactly as the client shows them: everyone except streamer-mode (incognito) players.
        // Agent select only contains your own team, so enemies are never named before the match starts.
        const nameable = p => p.Subject === me || !p.PlayerIdentity?.Incognito;
        const need = raw.filter(nameable).map(p => p.Subject).filter(s => !nameCache.has(s));
        if (need.length) {
            try { const n = await riot.names(need); for (const [k, v] of Object.entries(n)) nameCache.set(k, v); } catch (e) { }
        }
        if (refs.matchId !== id) refs = freshRefs(id);
        const tokenOf = s => {
            if (!refs.byPuuid.has(s)) { const t = crypto.randomBytes(8).toString('hex'); refs.byPuuid.set(s, t); refs.byToken.set(t, s); }
            return refs.byPuuid.get(s);
        };
        // Rank/RR/peak for everyone listed: agent select only lists your own team, so enemies wait for the match.
        const showRank = () => true;
        const stats = {};
        await pool(raw.filter(showRank).map(p => p.Subject), 4, async s => { stats[s] = await mmr(s); });

        // Party marker: only the user's own party, when 2+ of its members are in this match.
        const mates = raw.filter(p => partySet.has(p.Subject)).length;

        const players = raw.map(p => {
            const idn = p.PlayerIdentity || {};
            const k = isKnown(p.Subject);
            const n = nameable(p) && nameCache.get(p.Subject);
            const hidden = p.Subject !== me && !n;
            if (hidden) refs.hidden.add(p.Subject);
            else { refs.hidden.delete(p.Subject); refs.identity.set(p.Subject, { card: idn.PlayerCardID, title: idn.PlayerTitleID }); }
            return {
                ref: tokenOf(p.Subject),
                // Named players can be opened in Player Search (same as typing their Riot ID); hidden ones never.
                puuid: k || n ? p.Subject : null,
                self: p.Subject === me,
                hidden,
                gameName: n ? n.gameName : null, tagLine: n ? n.tagLine : null,
                agent: agentOf(p.CharacterID),
                locked: kind === 'pregame' ? p.CharacterSelectionState === 'locked' : true,
                team: kind === 'pregame' ? null : p.TeamID, // side is never exposed during agent select
                enemy: kind === 'ingame' && p.TeamID !== myTeam,
                // Level and card as the client shows them: never for streamer-mode players or hidden levels.
                level: !hidden && !idn.HideAccountLevel ? idn.AccountLevel ?? null : null,
                card: !hidden ? idn.PlayerCardID || null : null,
                rank: stats[p.Subject]?.tier || 0, rr: stats[p.Subject]?.rr || 0, peak: stats[p.Subject]?.peak || 0,
                known: k,
                ranked: showRank(p),
                // Scouting opens once agent select is over and the match is live.
                canScout: kind === 'ingame',
                scouted: refs.scouted.get(p.Subject),
                guns: loadoutMap.get(p.Subject)?.weapons.filter(w => w.weapon === 'Vandal' || w.weapon === 'Phantom'),
                spectre: !idn.Incognito && spectres.has(p.Subject) ? true : undefined,
                party: partySet.has(p.Subject) && mates > 1 ? 0 : null,
            };
        });
        return {
            state: kind === 'pregame' ? 'pregame' : 'ingame', matchId: id,
            queueId: m.MatchmakingData?.QueueID || m.QueueID || '',
            map: map ? { name: map.displayName, splash: map.splash, listIcon: map.listViewIcon } : { name: null },
            server: serverName(m.GamePodID),
            players,
        };
    }

    handle('live:state', async () => {
        const me = riot.state.puuid;
        for (const kind of ['ingame', 'pregame']) {
            const p = await riot.glz('get', `${kind === 'ingame' ? 'core-game' : 'pregame'}/v1/players/${me}`).catch(e => { if (is404(e)) return null; throw e; });
            if (p?.MatchID) return resolve(kind, p.MatchID);
        }
        return { state: 'menus' };
    });

    // Resolves a player token, checking the user is still in that match and it has started (not agent select).
    async function lookup(ref) {
        const puuid = refs.byToken.get(ref);
        let now = null;
        for (const [path, kind] of [['core-game', 'ingame'], ['pregame', 'pregame']]) {
            const p = await riot.glz('get', `${path}/v1/players/${riot.state.puuid}`).catch(() => null);
            if (p?.MatchID) { now = { id: p.MatchID, kind }; break; }
        }
        if (!puuid || now?.id !== refs.matchId) throw new Error('That player is not in your current match');
        const hidden = refs.hidden.has(puuid);
        if (now.kind !== 'ingame') throw new Error('Available once the match starts');
        return { puuid, hidden };
    }

    // Scout a player in the user's current match, only on request: rank, act history, recent competitive form and
    // matches. The result never carries a name, puuid, match id or teammates.
    handle('live:scout', async ref => {
        const { puuid } = await lookup(ref);
        const s = await scouting.scout(puuid);
        const r = s.recent;
        refs.scouted.set(puuid, r ? { kd: r.kd, acs: r.acs, hs: r.hs, wr: Math.round(r.wins / r.matches * 100) } : null);
        return s;
    });

    // A player's in-match loadout: weapon skins, buddies and sprays, plus card and title for named players only.
    handle('live:loadout', async ref => {
        const { puuid, hidden } = await lookup(ref);
        const l = (await matchLoadouts(refs.matchId)).get(puuid);
        if (!l) throw new Error('Loadout not available yet, try again in a moment');
        const idn = hidden ? null : refs.identity.get(puuid);
        const [card, title] = await Promise.all([
            idn?.card ? riot.valApi(`playercards/${idn.card}`).catch(() => null) : null,
            idn?.title ? riot.valApi(`playertitles/${idn.title}`).catch(() => null) : null,
        ]);
        return { ...l, card: card ? { name: card.displayName, art: card.wideArt } : null, title: title?.titleText || null };
    });

    // Pick / lock an agent is deliberately not exposed: this page is read-only.
};
