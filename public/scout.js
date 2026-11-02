// Rank and scouting for a player by puuid: current/peak rank and act history from the MMR endpoint, plus recent
// competitive form from competitive updates and match details. Results carry no names, match ids or teammates, so
// they are safe to show for streamer-mode players. One shared instance (and cache) for every module.
let instance = null;

// Before Episode 5 Act 1 (when Ascendant was added) tiers 21-24 were Immortal 1-3 and Radiant; today they are 24-27.
const ASCENDANT_START = Date.parse('2022-06-21T00:00:00Z');
// A death counts as traded (the T in KAST) if a teammate kills the killer within this window.
const TRADE_MS = 5000;

function create(riot) {
    let actCache = null; // { at, current, old }

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

    // Current-act rank + RR, all-time peak and per-act history. Throws if the MMR endpoint fails.
    async function rank(puuid) {
        const [d, a] = await Promise.all([riot.pd('get', `mmr/v1/players/${puuid}`), acts()]);
        const fix = (id, t) => (a.old.has(id) && t > 20 ? t + 3 : t);
        const seasons = Object.entries(d.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {}).map(([id, s]) => [id.toLowerCase(), s]);
        let peak = { tier: 0, seasonId: null };
        const history = [];
        for (const [id, s] of seasons) {
            const top = fix(id, Math.max(s.CompetitiveTier || 0, ...Object.keys(s.WinsByTier || {}).map(Number)));
            if (top > peak.tier) peak = { tier: top, seasonId: id };
            if (s.NumberOfGames) history.push({ seasonId: id, tier: fix(id, s.CompetitiveTier || 0), rr: s.RankedRating || 0, peak: top, wins: s.NumberOfWins || 0, games: s.NumberOfGames });
        }
        let current;
        if (a.current) {
            // Only this act counts: someone who hasn't played or finished placements this act is Unranked.
            const cur = seasons.find(([id]) => id === a.current)?.[1];
            current = { tier: cur?.CompetitiveTier || 0, rr: cur?.RankedRating || 0, seasonId: a.current, wins: cur?.NumberOfWins || 0, games: cur?.NumberOfGames || 0 };
        } else {
            const l = d.LatestCompetitiveUpdate || {};
            current = { tier: l.TierAfterUpdate || 0, rr: l.RankedRatingAfterUpdate || 0, seasonId: l.SeasonID?.toLowerCase() || null, wins: 0, games: 0 };
        }
        if (current.tier > peak.tier) peak = { tier: current.tier, seasonId: current.seasonId };
        return { current, peak, history };
    }

    // Runs `fn` over `items` with a small concurrency limit, keeping the order of results.
    async function pool(items, limit, fn) {
        const out = new Array(items.length);
        let i = 0;
        await Promise.all(Array.from({ length: Math.min(limit, items.length) }, async () => {
            while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
        }));
        return out;
    }

    // Match details trimmed to what scouting needs; matches never change, so they are cached.
    const matchCache = new Map();
    function getMatch(id) {
        if (!matchCache.has(id)) {
            const p = riot.pd('get', 'match-details/v1/matches/' + id).then(slim);
            p.catch(() => matchCache.delete(id));
            matchCache.set(id, p);
            if (matchCache.size > 150) matchCache.delete(matchCache.keys().next().value);
        }
        return matchCache.get(id);
    }
    function slim(m) {
        const sumDamage = list => list.reduce((a, d) => ({ dmg: a.dmg + (d.damage || 0), head: a.head + (d.headshots || 0), shots: a.shots + (d.headshots || 0) + (d.bodyshots || 0) + (d.legshots || 0) }), { dmg: 0, head: 0, shots: 0 });
        return {
            mapId: m.matchInfo?.mapId || '', queue: m.matchInfo?.queueID || '', start: m.matchInfo?.gameStartMillis || 0,
            teams: (m.teams || []).map(t => ({ id: t.teamId, won: !!t.won, rounds: t.roundsWon || 0 })),
            players: (m.players || []).filter(p => !p.isObserver).map(p => ({ id: p.subject, team: p.teamId, agent: (p.characterId || '').toLowerCase(), stats: p.stats || {} })),
            rounds: (m.roundResults || []).map(r => ({
                kills: (r.playerStats || []).flatMap(s => s.kills || [])
                    .map(k => ({ killer: k.killer, victim: k.victim, assists: k.assistants || [], t: k.timeSinceRoundStartMillis ?? k.roundTime ?? 0 }))
                    .sort((a, b) => a.t - b.t),
                damage: Object.fromEntries((r.playerStats || []).map(s => [s.subject, sumDamage(s.damage || [])])),
            })),
        };
    }

    // One player's line for one match. No match id or other players are included.
    function summarize(m, puuid, update) {
        const me = m.players.find(p => p.id === puuid);
        if (!me) return null;
        const teamOf = Object.fromEntries(m.players.map(p => [p.id, p.team]));
        let dmg = 0, head = 0, shots = 0, fb = 0, kast = 0;
        for (const r of m.rounds) {
            const d = r.damage[puuid];
            if (d) { dmg += d.dmg; head += d.head; shots += d.shots; }
            if (r.kills[0]?.killer === puuid) fb++;
            const death = r.kills.find(k => k.victim === puuid);
            const traded = death && r.kills.some(k => k.victim === death.killer && teamOf[k.killer] === me.team && k.t >= death.t && k.t - death.t <= TRADE_MS);
            if (!death || traded || r.kills.some(k => k.killer === puuid || k.assists.includes(puuid))) kast++;
        }
        const n = m.rounds.length || me.stats.roundsPlayed || 1;
        const mine = m.teams.find(t => t.id === me.team), other = m.teams.find(t => t.id !== me.team);
        const st = me.stats;
        return {
            start: m.start, mapId: m.mapId, queue: m.queue, agent: me.agent,
            result: m.teams.length === 2 && !m.teams.some(t => t.won) ? 'draw' : mine?.won ? 'win' : 'loss',
            score: mine && other ? { us: mine.rounds, them: other.rounds } : null,
            kills: st.kills || 0, deaths: st.deaths || 0, assists: st.assists || 0,
            acs: Math.round((st.score || 0) / n), adr: Math.round(dmg / n), hs: shots ? Math.round(head / shots * 100) : null,
            kast: Math.round(kast / n * 100), fb, rr: update?.RankedRatingEarned ?? null,
            _: { head, shots, kast, rounds: n }, // raw totals for aggregation, stripped before returning
        };
    }

    function aggregate(ms) {
        if (!ms.length) return null;
        const sum = f => ms.reduce((a, m) => a + f(m), 0);
        const kills = sum(m => m.kills), deaths = sum(m => m.deaths), assists = sum(m => m.assists);
        const rounds = sum(m => m._.rounds), shots = sum(m => m._.shots);
        return {
            matches: ms.length, wins: ms.filter(m => m.result === 'win').length, losses: ms.filter(m => m.result === 'loss').length,
            kd: deaths ? kills / deaths : kills, kda: deaths ? (kills + assists) / deaths : kills + assists,
            acs: Math.round(sum(m => m.acs * m._.rounds) / rounds), adr: Math.round(sum(m => m.adr * m._.rounds) / rounds),
            hs: shots ? Math.round(sum(m => m._.head) / shots * 100) : null,
            kast: Math.round(sum(m => m._.kast) / rounds * 100), fb: sum(m => m.fb),
        };
    }

    function topAgents(ms) {
        const by = {};
        for (const m of ms) {
            const a = by[m.agent] || (by[m.agent] = { agent: m.agent, games: 0, wins: 0, kills: 0, deaths: 0, score: 0, rounds: 0 });
            a.games++; if (m.result === 'win') a.wins++;
            a.kills += m.kills; a.deaths += m.deaths; a.score += m.acs * m._.rounds; a.rounds += m._.rounds;
        }
        return Object.values(by).sort((x, y) => y.games - x.games)
            .map(a => ({ agent: a.agent, games: a.games, wins: a.wins, kd: a.deaths ? a.kills / a.deaths : a.kills, acs: Math.round(a.score / a.rounds) }));
    }

    // Full scout: rank, act history and the last 10 competitive matches. Cached for five minutes per player.
    const scoutCache = new Map();
    async function scout(puuid) {
        const hit = scoutCache.get(puuid);
        if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
        const [r, cu] = await Promise.all([
            rank(puuid),
            riot.pd('get', `mmr/v1/players/${puuid}/competitiveupdates?startIndex=0&endIndex=10&queue=competitive`).catch(() => null),
        ]);
        let updates = cu?.Matches;
        if (!updates) {
            const h = await riot.pd('get', `match-history/v1/history/${puuid}?startIndex=0&endIndex=10&queue=competitive`).catch(() => null);
            updates = h ? (h.History || []).map(x => ({ MatchID: x.MatchID })) : null;
        }
        const ms = (await pool(updates || [], 3, u => getMatch(u.MatchID).then(m => summarize(m, puuid, u)).catch(() => null))).filter(Boolean);
        const value = {
            ...r, recent: aggregate(ms), agents: topAgents(ms),
            matches: ms.map(({ _, ...m }) => m), historyPrivate: !updates,
        };
        scoutCache.set(puuid, { at: Date.now(), value });
        return value;
    }

    return { acts, rank, scout };
}

module.exports = riot => instance || (instance = create(riot));
