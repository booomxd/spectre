// Battle pass, agent contracts, account XP and competitive history.
module.exports = ({ riot, handle }) => {
    const puuid = () => riot.state.puuid

    handle('progression:contracts', async () => {
        const [c, defs] = await Promise.all([
            riot.pd('get', `contracts/v1/contracts/${puuid()}`),
            riot.valApi('contracts'),
        ])
        const byId = Object.fromEntries(defs.map(d => [d.uuid, d]))
        const rows = (c.Contracts || []).map(ct => {
            const def = byId[ct.ContractDefinitionID]
            const prog = ct.ContractProgression || {}
            return {
                id: ct.ContractDefinitionID, name: def?.displayName || 'Contract', type: def?.content?.relationType || null,
                agentId: def?.content?.relationType === 'Agent' ? def.content.relationUuid : null,
                seasonId: def?.content?.relationType === 'Season' ? def.content.relationUuid : null,
                xp: prog.TotalProgressionEarned || 0, towardsNext: ct.ProgressionTowardsNextLevel || 0,
                progressionLevel: ct.ProgressionLevelReached || 0,
                // levels: each chapter has levels with xp + reward
                chapters: (def?.content?.chapters || []).map(ch => ({
                    isEpilogue: ch.isEpilogue,
                    levels: (ch.levels || []).map(l => ({
                        xp: l.xp, vpCost: l.vpCost, doughCost: l.doughCost, isPurchasableWithVP: l.isPurchasableWithVP,
                        reward: l.reward ? { type: l.reward.type, uuid: l.reward.uuid, amount: l.reward.amount } : null,
                    })),
                    freeRewards: (ch.freeRewards || []).map(r => ({ type: r.type, uuid: r.uuid, amount: r.amount })),
                })),
            }
        })
        return { active: c.ActiveSpecialContract || null, contracts: rows }
    })

    handle('progression:account', async () => {
        const x = await riot.pd('get', `account-xp/v1/players/${puuid()}`)
        return { level: x.Progress?.Level || 0, xp: x.Progress?.XP || 0, history: (x.History || []).slice(0, 10).map(h => ({ id: h.MatchID, start: h.MatchStart, xp: h.StartProgress && h.EndProgress ? (h.EndProgress.XP - h.StartProgress.XP) : 0 })) }
    })

    handle('progression:rrHistory', async (count = 20) => {
        const r = await riot.pd('get', `mmr/v1/players/${puuid()}/competitiveupdates?startIndex=0&endIndex=${Math.min(count, 20)}&queue=competitive`)
        return (r.Matches || []).filter(m => m.TierAfterUpdate != null && m.MapID).map(m => ({
            id: m.MatchID, mapId: m.MapID, time: m.MatchStartTime, tierBefore: m.TierBeforeUpdate, tierAfter: m.TierAfterUpdate,
            rrBefore: m.RankedRatingBeforeUpdate, rrAfter: m.RankedRatingAfterUpdate, change: m.RankedRatingEarned,
            // absolute RR on the ladder: tier*100 + rr (Radiant/Immortal keep counting upward)
            ladder: m.TierAfterUpdate * 100 + m.RankedRatingAfterUpdate,
        })).reverse()
    })
}
