// Live match rosters. Level/card for self, friends and party members; other players are named only if not
// incognito (streamer mode), otherwise they are just their agent. Ranks: self, friends and party always, everyone
// once the match is live. Hidden players' recent form is scouted on request by token, never by name or puuid.
const crypto = require('crypto');

module.exports = ({ riot, handle }) => {
    const known = require('../known')(riot);
    const mmrCache = new Map();    // puuid -> { at, value }
    const nameCache = new Map();   // puuid -> { gameName, tagLine }
    const MMR_TTL = 5 * 60 * 1000;
    // Before Episode 5 Act 1 (when Ascendant was added) tiers 21-24 were Immortal 1-3 and Radiant; today they are 24-27.
    const ASCENDANT_START = Date.parse('2022-06-21T00:00:00Z');
    let actCache = null;           // { at, current, old }
    // Hidden players of the current in-game match, by random token. The UI only ever gets the token, so it can ask
    // for a scout without holding a puuid. `scouted` keeps scout results until the match changes.
    const freshAnon = matchId => ({ matchId, byToken: new Map(), byPuuid: new Map(), scouted: new Map() });
    let anon = freshAnon(null);

    const is404 = e => e.response?.status === 404;

    // Current act id, plus the ids of acts from before Ascendant existed.
    async function acts() {
        if (actCache && Date.now() - actCache.at < 600000) return actCache;
        let current = null;
        const old = new Set();
        try {
            const c = await riot.shared('get', 'content-service/v3/content');
            current = (c.Seasons || []).find(s => s.IsActive && s.Type === 'act')?.ID?.toLowerCase() || null;
        } catch (e) { }
        try {
            const now = Date.now();
            for (const s of await riot.valApi('seasons')) {
                if (s.type !== 'EAresSeasonType::Act') continue;
                if (Date.parse(s.startTime) < ASCENDANT_START) old.add(s.uuid.toLowerCase());
                if (!current && Date.parse(s.startTime) <= now && Date.parse(s.endTime) > now) current = s.uuid.toLowerCase();
            }
        } catch (e) { }
        // Incomplete data is retried after a minute rather than kept for ten.
        actCache = { at: current && old.size ? Date.now() : Date.now() - 540000, current, old };
        return actCache;
    }

    // Current-act rank + RR and peak rank across all acts, from the MMR endpoint.
    async function mmr(puuid) {
        const hit = mmrCache.get(puuid);
        if (hit && Date.now() - hit.at < MMR_TTL) return hit.value;
        let value = { tier: 0, rr: 0, peak: 0 }, ok = false;
        try {
            const [d, a] = await Promise.all([riot.pd('get', `mmr/v1/players/${puuid}`), acts()]);
            const seasons = Object.entries(d.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {}).map(([id, s]) => [id.toLowerCase(), s]);
            let peak = 0;
            for (const [id, s] of seasons) {
                let top = Math.max(s.CompetitiveTier || 0, ...Object.keys(s.WinsByTier || {}).map(Number));
                if (a.old.has(id) && top > 20) top += 3;
                peak = Math.max(peak, top);
            }
            if (a.current) {
                // Only this act counts: someone who hasn't played or finished placements this act is Unranked.
                const cur = seasons.find(([id]) => id === a.current)?.[1];
                value = { tier: cur?.CompetitiveTier || 0, rr: cur?.RankedRating || 0, peak };
            } else {
                const latest = d.LatestCompetitiveUpdate || {};
                value = { tier: latest.TierAfterUpdate || 0, rr: latest.RankedRatingAfterUpdate || 0, peak };
            }
            value.peak = Math.max(value.peak, value.tier);
            ok = true;
        } catch (e) { }
        if (!ok) value.failed = true;
        // A failed lookup (e.g. rate limited) is retried after 30s instead of showing Unranked for the full TTL.
        mmrCache.set(puuid, { at: ok ? Date.now() : Date.now() - MMR_TTL + 30000, value });
        return value;
    }

    // Wins, K/D and headshot % over the last 10 competitive matches; null if history is private or empty.
    async function recentForm(puuid) {
        const h = await riot.pd('get', `match-history/v1/history/${puuid}?startIndex=0&endIndex=10&queue=competitive`).catch(() => null);
        let games = 0, wins = 0, kills = 0, deaths = 0, head = 0, shots = 0;
        await pool(h?.History || [], 3, async x => {
            try {
                const m = await riot.pd('get', 'match-details/v1/matches/' + x.MatchID);
                const me = (m.players || []).find(p => p.subject === puuid);
                if (!me) return;
                games++; kills += me.stats?.kills || 0; deaths += me.stats?.deaths || 0;
                if ((m.teams || []).find(t => t.teamId === me.teamId)?.won) wins++;
                for (const r of m.roundResults || []) for (const s of r.playerStats || []) {
                    if (s.subject === puuid) for (const d of s.damage || []) { head += d.headshots; shots += d.headshots + d.bodyshots + d.legshots; }
                }
            } catch (e) { }
        });
        return games ? { games, wins, kd: deaths ? kills / deaths : kills, hs: shots ? Math.round(head / shots * 100) : null } : null;
    }

    // Runs `fn` over `items` with a small concurrency limit.
    async function pool(items, limit, fn) {
        let i = 0;
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (i < items.length) { const item = items[i++]; await fn(item); }
        }));
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
        const [agents, maps] = await Promise.all([
            riot.valApi('agents?isPlayableCharacter=true').catch(() => []),
            riot.valApi('maps').catch(() => []),
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
        // Rank/RR/peak for everyone once the match is live; during agent select only self, friends and party.
        if (kind === 'ingame' && anon.matchId !== id) anon = freshAnon(id);
        const tokenOf = s => {
            if (!anon.byPuuid.has(s)) { const t = crypto.randomBytes(8).toString('hex'); anon.byPuuid.set(s, t); anon.byToken.set(t, s); }
            return anon.byPuuid.get(s);
        };
        const showRank = p => kind === 'ingame' || isKnown(p.Subject);
        const stats = {};
        await pool(raw.filter(showRank).map(p => p.Subject), 4, async s => { stats[s] = await mmr(s); });

        // Party marker: only the user's own party, when 2+ of its members are in this match.
        const mates = raw.filter(p => partySet.has(p.Subject)).length;

        const players = raw.map(p => {
            const idn = p.PlayerIdentity || {};
            const k = isKnown(p.Subject);
            const n = nameable(p) && nameCache.get(p.Subject);
            const hidden = p.Subject !== me && !n;
            return {
                // Named players can be scouted (same as typing their Riot ID into Player Search); hidden ones never.
                puuid: k || n ? p.Subject : null,
                scout: !!n && p.Subject !== me,
                self: p.Subject === me,
                hidden,
                gameName: n ? n.gameName : null, tagLine: n ? n.tagLine : null,
                agent: agentOf(p.CharacterID),
                locked: kind === 'pregame' ? p.CharacterSelectionState === 'locked' : true,
                team: kind === 'pregame' ? null : p.TeamID, // side is never exposed during agent select
                enemy: kind === 'ingame' && p.TeamID !== myTeam,
                level: k && !idn.HideAccountLevel ? idn.AccountLevel ?? null : null,
                card: k ? idn.PlayerCardID || null : null,
                rank: stats[p.Subject]?.tier || 0, rr: stats[p.Subject]?.rr || 0, peak: stats[p.Subject]?.peak || 0,
                known: k,
                ranked: showRank(p),
                anon: kind === 'ingame' && hidden ? tokenOf(p.Subject) : undefined, // in-match scouting only
                recent: hidden ? anon.scouted.get(p.Subject) : undefined,
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

    // Name-free scout of a hidden player in the user's current match, only on request: recent competitive form.
    // Their name, puuid, match ids and teammates never leave this module.
    handle('live:scoutHidden', async token => {
        const puuid = anon.byToken.get(token);
        const now = await riot.glz('get', `core-game/v1/players/${riot.state.puuid}`).catch(() => null);
        if (!puuid || now?.MatchID !== anon.matchId) throw new Error('That player is not in your current match');
        const [rank, recent] = await Promise.all([mmr(puuid), recentForm(puuid)]);
        if (rank.failed) throw new Error('Rank lookup failed, try again in a moment');
        anon.scouted.set(puuid, recent);
        return true;
    });

    // Pick / lock an agent is deliberately not exposed: this page is read-only.
};
