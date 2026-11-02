// Puuids the VALORANT client itself lets the user see: self, friends and current party members.
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
    return {
        knownPuuids: async () => (await load()).all,
        friendPuuids: async () => (await load()).friends, // self + friends only
        partyPuuids: async () => (await load()).party,
    };
}

module.exports = riot => instance || (instance = create(riot));
