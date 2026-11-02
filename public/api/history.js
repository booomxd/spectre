// Match history, match details, player search/profile and recent-activity channels.
module.exports = ({ riot, handle }) => {
    const known = require('../known')(riot);
    // Any player can be looked up by puuid (like any tracker). Hidden players are protected at the source:
    // puuids of streamer-mode players and of unnamed strangers in match data are never handed to the UI.
    async function requireKnown() { }
    // ---- limited-concurrency pd queue + caches ----
    let running = 0;
    const waiting = [];
    function limited(fn) {
        return new Promise((resolve, reject) => {
            const run = () => {
                running++;
                fn().then(resolve, reject).finally(() => { running--; waiting.shift()?.(); });
            };
            running < 3 ? run() : waiting.push(run);
        });
    }

    const matchCache = new Map(); // matchId -> Promise<slim>
    function getMatch(matchId) {
        if (!matchCache.has(matchId)) {
            const p = limited(() => riot.pd('get', 'match-details/v1/matches/' + matchId)).then(slim);
            p.catch(() => matchCache.delete(matchId));
            matchCache.set(matchId, p);
            if (matchCache.size > 120) matchCache.delete(matchCache.keys().next().value);
        }
        return matchCache.get(matchId);
    }

    const nameCache = new Map(); // puuid -> {gameName, tagLine} | null
    async function resolveNames(puuids) {
        const need = [...new Set(puuids)].filter(p => p && !nameCache.has(p));
        for (let i = 0; i < need.length; i += 40) {
            const chunk = need.slice(i, i + 40);
            try {
                const got = await riot.names(chunk);
                chunk.forEach(p => nameCache.set(p, got[p]?.gameName ? got[p] : null));
            } catch (e) { /* leave uncached so a later call can retry */ }
        }
        return Object.fromEntries(puuids.map(p => [p, nameCache.get(p) || null]));
    }

    // ---- match slimming: drop positions etc., keep what the UI needs ----
    function slim(m) {
        const info = m.matchInfo;
        const rounds = (m.roundResults || []).map(r => ({
            num: r.roundNum, result: r.roundResult || '', code: r.roundResultCode || '', winner: r.winningTeam, role: r.winningTeamRole,
            site: r.plantSite || '',
            stats: (r.playerStats || []).map(s => ({
                subject: s.subject,
                kills: (s.kills || []).map(k => ({ killer: k.killer, victim: k.victim, t: k.roundTime })),
                damage: (s.damage || []).map(d => ({ damage: d.damage, head: d.headshots, body: d.bodyshots, leg: d.legshots })),
            })),
        }));
        return {
            id: info.matchId, mapId: info.mapId, queue: info.queueID || '', start: info.gameStartMillis, length: info.gameLengthMillis,
            teams: (m.teams || []).map(t => ({ id: t.teamId, won: !!t.won, roundsWon: t.roundsWon, roundsPlayed: t.roundsPlayed })),
            players: (m.players || []).filter(p => !p.isObserver).map(p => ({
                puuid: p.subject, team: p.teamId, party: p.partyId, agent: (p.characterId || '').toLowerCase(), tier: p.competitiveTier || 0,
                level: p.accountLevel || 0, card: p.playerCard, title: p.playerTitle, stats: p.stats || {}, rounds: p.stats?.roundsPlayed || 0,
            })),
            rounds,
        };
    }

    // Per-player derived stats.
    function playerStats(m, p) {
        const nRounds = m.rounds.length || p.rounds || 1;
        let dmg = 0, head = 0, shots = 0, fb = 0, fd = 0;
        for (const r of m.rounds) {
            for (const s of r.stats) {
                if (s.subject === p.puuid) for (const d of s.damage) { dmg += d.damage; head += d.head; shots += d.head + d.body + d.leg; }
            }
            const all = r.stats.flatMap(s => s.kills).sort((a, b) => a.t - b.t);
            if (all.length) { if (all[0].killer === p.puuid) fb++; if (all[0].victim === p.puuid) fd++; }
        }
        const st = p.stats;
        return {
            kills: st.kills || 0, deaths: st.deaths || 0, assists: st.assists || 0, points: st.score || 0,
            acs: Math.round((st.score || 0) / nRounds), adr: dmg ? Math.round(dmg / nRounds) : null,
            hs: shots ? Math.round(head / shots * 100) : null, fb, fd,
        };
    }

    const MODES = { competitive: 'Competitive', unrated: 'Unrated', swiftplay: 'Swiftplay', deathmatch: 'Deathmatch', spikerush: 'Spike Rush', hurm: 'Team Deathmatch', ggteam: 'Escalation', onefa: 'Replication', snowball: 'Snowball Fight', valaram: 'ARAM', newmap: 'New Map', '': 'Custom' };
    const modeName = q => (q || '').startsWith('premier') ? 'Premier' : MODES[q] ?? (q.charAt(0).toUpperCase() + q.slice(1));

    function summarize(m, puuid) {
        const me = m.players.find(p => p.puuid === puuid);
        if (!me) return null;
        const mine = m.teams.find(t => t.id === me.team);
        const other = m.teams.filter(t => t.id !== me.team);
        let result = mine?.won ? 'win' : 'loss';
        if (m.teams.length === 2 && !m.teams.some(t => t.won)) result = 'draw';
        const ffa = m.teams.length > 2;
        return {
            matchId: m.id, mapId: m.mapId, queue: m.queue, mode: modeName(m.queue), start: m.start, length: m.length,
            agent: me.agent, tier: me.tier, result, ffa,
            score: ffa ? null : { us: mine?.roundsWon ?? 0, them: other[0]?.roundsWon ?? 0 },
            ...playerStats(m, me),
        };
    }

    // ---- history ----
    handle('history:list', async (puuid, { queue = '', start = 0, end = 20 } = {}) => {
        const id = puuid || riot.state.puuid;
        await requireKnown(id);
        const q = queue && queue !== 'all' ? `&queue=${encodeURIComponent(queue)}` : '';
        const res = await riot.pd('get', `match-history/v1/history/${id}?startIndex=${start}&endIndex=${end}${q}`);
        return {
            puuid: id, total: res.Total || 0,
            matches: (res.History || []).map(h => ({ matchId: h.MatchID, start: h.GameStartTime, queue: h.QueueID })),
        };
    });

    handle('history:summary', async (matchId, puuid) => {
        const id = puuid || riot.state.puuid;
        await requireKnown(id);
        return summarize(await getMatch(matchId), id);
    });

    // matchId -> RR change for competitive games
    const rrCache = new Map();
    handle('history:rr', async (puuid) => {
        const id = puuid || riot.state.puuid;
        await requireKnown(id);
        const hit = rrCache.get(id);
        if (hit && Date.now() - hit.at < 60000) return hit.data;
        const data = {};
        for (let s = 0; s < 60; s += 20) {
            let res;
            try { res = await riot.pd('get', `mmr/v1/players/${id}/competitiveupdates?startIndex=${s}&endIndex=${s + 20}&queue=competitive`); }
            catch (e) { break; }
            const list = res.Matches || [];
            list.forEach(u => {
                data[u.MatchID] = {
                    earned: u.RankedRatingAfterUpdate - u.RankedRatingBeforeUpdate, before: u.RankedRatingBeforeUpdate, after: u.RankedRatingAfterUpdate,
                    tierBefore: u.TierBeforeUpdate, tierAfter: u.TierAfterUpdate, placement: !!u.IsPlacementMatch,
                };
            });
            if (list.length < 20) break;
        }
        rrCache.set(id, { at: Date.now(), data });
        return data;
    });

    handle('history:detail', async (matchId) => {
        const m = await getMatch(matchId);
        const [ok, fr, live] = await Promise.all([known.knownPuuids(), known.friendPuuids(), known.liveHidden()]);
        // Everyone is named like on any tracker, except streamer-mode players in your current match. If the current
        // match can't be read, only you, friends and party are named.
        const shown = p => p === riot.state.puuid || (live ? !live.has(p) : ok.has(p));
        const names = await resolveNames(m.players.map(p => p.puuid).filter(shown));
        const myParty = m.players.find(p => p.puuid === riot.state.puuid)?.party;
        // Hidden players are agent-only, with no puuid.
        const players = m.players.map((p, i) => {
            const isKnown = ok.has(p.puuid);
            const nm = p.puuid === riot.state.puuid ? { gameName: riot.state.gameName, tagLine: riot.state.tagLine } : shown(p.puuid) ? names[p.puuid] : null;
            const base = { key: nm ? p.puuid : 'x' + i, team: p.team, agent: p.agent, tier: p.tier, known: isKnown, name: nm || null, hidden: !nm, ...playerStats(m, p) };
            return nm ? { ...base, puuid: p.puuid, friend: fr.has(p.puuid), party: !!myParty && p.party === myParty, level: p.level, card: p.card } : base;
        });
        const rounds = m.rounds.map(r => {
            let kind = 'time';
            if (r.code === 'Elimination' || /elimin/i.test(r.result)) kind = 'elim';
            else if (r.code === 'Defuse' || /defus/i.test(r.result)) kind = 'defuse';
            else if (r.code === 'Detonate' || /detonat/i.test(r.result)) kind = 'detonate';
            else if (/surrender/i.test(r.code + r.result)) kind = 'surrender';
            return { num: r.num, kind, winner: r.winner, role: r.role, site: r.site };
        });
        return {
            matchId: m.id, mapId: m.mapId, queue: m.queue, mode: modeName(m.queue), start: m.start, length: m.length,
            teams: m.teams, players, rounds, namesLimited: !live,
        };
    });

    // ---- activity: who you recently played with / against ----
    handle('activity:recent', async (count = 20) => {
        const me = riot.state.puuid;
        const list = await riot.pd('get', `match-history/v1/history/${me}?startIndex=0&endIndex=${Math.min(count, 25)}`);
        const matches = (await Promise.all((list.History || []).map(h => getMatch(h.MatchID).catch(() => null)))).filter(Boolean);
        const ok = await known.knownPuuids();
        const fr = await known.friendPuuids();
        const names = await resolveNames(matches.flatMap(m => m.players.map(p => p.puuid)).filter(p => ok.has(p)));
        const people = {};
        const out = matches.map(m => {
            const mine = m.players.find(p => p.puuid === me);
            if (!mine) return null;
            const sum = summarize(m, me);
            const players = m.players.filter(p => p.puuid !== me).map((p, i) => {
                const rel = m.teams.length > 2 ? 'opp' : p.team === mine.team ? 'mate' : 'opp';
                const base = { key: m.id + ':' + i, rel, agent: p.agent, tier: p.tier, kills: p.stats.kills, deaths: p.stats.deaths, assists: p.stats.assists };
                if (!ok.has(p.puuid)) return { ...base, known: false, name: null, hidden: true };
                const nm = names[p.puuid];
                const e = people[p.puuid] || (people[p.puuid] = { puuid: p.puuid, friend: fr.has(p.puuid), name: nm, hidden: !nm, with: 0, against: 0, lastSeen: m.start, agent: p.agent, tier: p.tier });
                e[rel === 'mate' ? 'with' : 'against']++;
                return { ...base, puuid: p.puuid, friend: fr.has(p.puuid), known: true, name: nm, hidden: !nm };
            });
            return { matchId: m.id, mapId: m.mapId, mode: sum.mode, queue: m.queue, start: m.start, result: sum.result, score: sum.score, agent: sum.agent, players };
        }).filter(Boolean);
        return { matches: out, people };
    });

    // ---- player search ----
    handle('search:lookup', async (riotId) => {
        const text = String(riotId || '');
        const i = text.lastIndexOf('#');
        const gameName = i > 0 ? text.slice(0, i).trim() : '';
        const tagLine = i > 0 ? text.slice(i + 1).trim() : '';
        if (!gameName || !tagLine) throw new Error('Enter a Riot ID like Name#Tag');
        const res = await riot.local('get', `player-account/aliases/v1/lookup?gameName=${encodeURIComponent(gameName)}&tagLine=${encodeURIComponent(tagLine)}`);
        const hit = Array.isArray(res) ? res[0] : null;
        if (!hit?.puuid) throw new Error(`No player found for ${gameName}#${tagLine}`);
        return { puuid: hit.puuid, gameName: hit.alias?.game_name || gameName, tagLine: hit.alias?.tag_line || tagLine };
    });

    handle('search:profile', async (puuid) => {
        const out = { puuid, gameName: null, tagLine: null, level: null, cardId: null, titleId: null, current: null, peak: null, leaderboardRank: null, notes: [] };
        if (puuid === riot.state.puuid) { out.gameName = riot.state.gameName; out.tagLine = riot.state.tagLine; out.self = true; }
        else {
            const nm = (await resolveNames([puuid]))[puuid];
            if (nm) { out.gameName = nm.gameName; out.tagLine = nm.tagLine; }
        }
        const [mmr, hist] = await Promise.all([
            riot.pd('get', `mmr/v1/players/${puuid}`).catch(e => { out.notes.push('Rank data unavailable: ' + riot.errMsg(e)); return null; }),
            riot.pd('get', `match-history/v1/history/${puuid}?startIndex=0&endIndex=1`).catch(() => null),
        ]);
        if (mmr) {
            const skills = mmr.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {};
            const latest = mmr.LatestCompetitiveUpdate;
            let peakTier = 0, peakSeason = null;
            for (const [sid, s] of Object.entries(skills)) {
                const top = Math.max(s.CompetitiveTier || 0, ...Object.keys(s.WinsByTier || {}).map(Number));
                if (top > peakTier) { peakTier = top; peakSeason = sid; }
            }
            if (latest?.TierAfterUpdate != null) {
                const s = skills[latest.SeasonID];
                out.current = {
                    tier: latest.TierAfterUpdate, rr: latest.RankedRatingAfterUpdate, seasonId: latest.SeasonID,
                    wins: s?.NumberOfWins ?? null, games: s?.NumberOfGames ?? null, lastGame: latest.MatchStartTime,
                };
                out.leaderboardRank = s?.LeaderboardRank > 0 ? s.LeaderboardRank : null;
            }
            if (peakTier > 0) out.peak = { tier: peakTier, seasonId: peakSeason };
            if (latest?.TierAfterUpdate != null && latest.TierAfterUpdate > peakTier) out.peak = { tier: latest.TierAfterUpdate, seasonId: latest.SeasonID };
        }
        const first = hist?.History?.[0];
        if (!hist) out.notes.push('Match history is private or unavailable');
        if (first) {
            try {
                const m = await getMatch(first.MatchID);
                const p = m.players.find(x => x.puuid === puuid);
                if (p) { out.level = p.level; out.cardId = p.card; out.titleId = p.title; }
            } catch (e) { }
        }
        if (puuid === riot.state.puuid) {
            try { out.level = (await riot.pd('get', `account-xp/v1/players/${puuid}`)).Progress.Level; } catch (e) { }
        }
        return out;
    });

    // Scout details, fetched only when a profile is opened: per-act history + recent competitive form.
    const scoutCache = new Map(); // puuid -> { at, value }
    handle('search:scout', async (puuid) => {
        const hit = scoutCache.get(puuid);
        if (hit && Date.now() - hit.at < 5 * 60 * 1000) return hit.value;
        const [mmr, hist] = await Promise.all([
            riot.pd('get', `mmr/v1/players/${puuid}`).catch(() => null),
            riot.pd('get', `match-history/v1/history/${puuid}?startIndex=0&endIndex=10&queue=competitive`).catch(() => null),
        ]);
        const acts = [];
        for (const [seasonId, s] of Object.entries(mmr?.QueueSkills?.competitive?.SeasonalInfoBySeasonID || {})) {
            if (!s.NumberOfGames) continue;
            const peak = Math.max(s.CompetitiveTier || 0, ...Object.keys(s.WinsByTier || {}).map(Number));
            acts.push({ seasonId, tier: s.CompetitiveTier || 0, peak, wins: s.NumberOfWins || 0, games: s.NumberOfGames || 0 });
        }
        const sums = (await Promise.all((hist?.History || []).map(h => getMatch(h.MatchID).then(m => summarize(m, puuid)).catch(() => null)))).filter(Boolean);
        const kills = sums.reduce((a, r) => a + r.kills, 0), deaths = sums.reduce((a, r) => a + r.deaths, 0);
        const hs = sums.filter(r => r.hs != null);
        const team = sums.filter(r => !r.ffa);
        const value = {
            acts,
            recent: sums.length ? {
                matches: sums.length, kills, deaths, kd: deaths ? kills / deaths : kills,
                hs: hs.length ? Math.round(hs.reduce((a, r) => a + r.hs, 0) / hs.length) : null,
                wins: team.filter(r => r.result === 'win').length, team: team.length,
            } : null,
            historyPrivate: !hist,
        };
        scoutCache.set(puuid, { at: Date.now(), value });
        return value;
    });

    handle('search:recent', async () => {
        return riot.readStore('recent-searches', []);
    });
    handle('search:pushRecent', async (entry) => {
        if (!entry?.puuid) return [];
        const list = [entry, ...riot.readStore('recent-searches', []).filter(e => e.puuid !== entry.puuid)].slice(0, 12);
        riot.writeStore('recent-searches', list);
        return list;
    });
    handle('search:clearRecent', async () => { riot.writeStore('recent-searches', []); return []; });
};
