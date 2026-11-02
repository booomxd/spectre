// Competitive leaderboard for the player's shard and the current act.
module.exports = ({ riot, handle }) => {
    const known = require('../known')(riot);
    let seasonCache = null;

    async function currentSeason() {
        if (seasonCache && Date.now() - seasonCache.at < 600000) return seasonCache;
        let id = null, name = null;
        try {
            const c = await riot.shared('get', 'content-service/v3/content');
            const act = (c.Seasons || []).find(s => s.IsActive && s.Type === 'act');
            if (act) { id = act.ID; name = act.Name; }
        } catch (e) { }
        if (!id) {
            const seasons = await riot.valApi('seasons');
            const now = Date.now();
            const act = seasons.filter(s => s.type === 'EAresSeasonType::Act' && Date.parse(s.startTime) <= now && Date.parse(s.endTime) > now).pop();
            if (!act) throw new Error('Could not determine the current act');
            id = act.uuid; name = act.displayName;
        }
        seasonCache = { id, name, at: Date.now() };
        return seasonCache;
    }

    handle('leaderboard:get', async ({ start = 0, size = 100 } = {}) => {
        const season = await currentSeason();
        const sz = Math.min(Math.max(size, 1), 200);
        const res = await riot.pd('get', `mmr/v1/leaderboards/affinity/${riot.state.shard}/queue/competitive/season/${season.id}?startIndex=${start}&size=${sz}`);
        let ok = new Set(), fr = new Set();
        try { ok = await known.knownPuuids(); fr = await known.friendPuuids(); } catch (e) { }
        // Riot's response as-is; puuids are only passed on for you and your friends/party (click-through).
        const players = (res.Players || []).map(p => ({
            puuid: p.IsAnonymized ? undefined : p.puuid, known: ok.has(p.puuid), friend: fr.has(p.puuid), rank: p.leaderboardRank, cardId: p.PlayerCardID, anonymous: !!p.IsAnonymized,
            gameName: p.IsAnonymized ? '' : p.gameName, tagLine: p.IsAnonymized ? '' : p.tagLine, prefix: p.prefix || '',
            rr: p.rankedRating, wins: p.numberOfWins, tier: p.competitiveTier, banned: !!p.IsBanned,
        }));
        let you = null;
        if (start === 0) {
            try {
                const mmr = await riot.pd('get', `mmr/v1/players/${riot.state.puuid}`);
                const s = mmr.QueueSkills?.competitive?.SeasonalInfoBySeasonID?.[season.id];
                if (s?.LeaderboardRank > 0) you = { rank: s.LeaderboardRank, rr: s.RankedRating, wins: s.NumberOfWins, tier: s.CompetitiveTier };
            } catch (e) { }
        }
        return { season: { id: season.id, name: season.name }, total: res.totalPlayers || 0, start, players, you, shard: riot.state.shard };
    });
};
