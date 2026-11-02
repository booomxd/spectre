// Puuids the VALORANT client itself lets the user see: self, friends and current party members, plus the
// streamer-mode players of the user's current match.
// One shared instance (and cache) for every module.
let instance = null;

function create(riot) {
    let cache = { at: 0, all: new Set(), party: new Set(), friends: new Set() };
    async function load() {
        if (Date.now() - cache.at < 30000) return cache;
        const me = riot.state.puuid;
        const party = new Set([me]);
        const all = new Set([me]);
        const friends = new Set([me]);
        // If the friends list can't be read, fail instead of caching a self-only set that would
        // treat every friend as a stranger (and e.g. wipe recent searches).
        for (const f of (await riot.local('get', 'chat/v4/friends')).friends || []) if (f.puuid) { all.add(f.puuid); friends.add(f.puuid); }
        try {
            const pl = await riot.glz('get', `parties/v1/players/${me}`);
            if (pl.CurrentPartyID) {
                const p = await riot.glz('get', `parties/v1/parties/${pl.CurrentPartyID}`);
                for (const m of p.Members || []) { if (m.PlayerIdentity?.Incognito && !all.has(m.Subject)) continue; party.add(m.Subject); all.add(m.Subject); }
            }
        } catch (e) { } // not in a party / game closed: party is just you
        cache = { at: Date.now(), all, party, friends };
        return cache;
    }

    // Streamer-mode players in your current agent select or match. They stay hidden everywhere, match histories
    // included, so other data can't unmask who you're playing with or against. null when the game can't be read.
    let live = { at: 0, hidden: null };
    const notIn = e => { if (e.response?.status === 404) return null; throw e; };
    async function liveHidden() {
        if (Date.now() - live.at < 15000) return live.hidden;
        const me = riot.state.puuid;
        let hidden = new Set();
        try {
            for (const [base, players] of [['core-game', m => m.Players], ['pregame', m => m.AllyTeam?.Players]]) {
                const p = await riot.glz('get', `${base}/v1/players/${me}`).catch(notIn);
                if (!p?.MatchID) continue;
                const m = await riot.glz('get', `${base}/v1/matches/${p.MatchID}`);
                for (const x of players(m) || []) if (x.Subject !== me && x.PlayerIdentity?.Incognito) hidden.add(x.Subject);
                break;
            }
        } catch (e) { hidden = null; }
        live = { at: Date.now(), hidden };
        return hidden;
    }

    return {
        knownPuuids: async () => (await load()).all,
        friendPuuids: async () => (await load()).friends, // self + friends only
        partyPuuids: async () => (await load()).party,
        liveHidden,
    };
}

module.exports = riot => instance || (instance = create(riot));
