// Friends, presences, friend requests and the current party.

const enc = encodeURIComponent;

module.exports = ({ riot, handle }) => {
    function decode(p) {
        if (!p.private) return null;
        try { return JSON.parse(Buffer.from(p.private, 'base64').toString('utf8')); } catch (e) { return null; }
    }

    // Normalises both the nested and the flat presence layouts.
    function flatten(d) {
        const pl = d.playerPresenceData || {};
        const pa = d.partyPresenceData || {};
        const ma = d.matchPresenceData || {};
        return {
            loop: ma.sessionLoopState || d.sessionLoopState || pa.partyOwnerSessionLoopState || 'MENUS',
            map: ma.matchMap || d.matchMap || pa.partyOwnerMatchMap || '',
            queueId: ma.queueId || d.queueId || '',
            partyState: pa.partyState || d.partyState || '',
            partyId: d.partyId || pa.partyId || '',
            partySize: d.partySize ?? pa.partySize ?? 1,
            maxPartySize: d.maxPartySize ?? pa.maxPartySize ?? 5,
            ally: d.partyOwnerMatchScoreAllyTeam ?? pa.partyOwnerMatchScoreAllyTeam ?? 0,
            enemy: d.partyOwnerMatchScoreEnemyTeam ?? pa.partyOwnerMatchScoreEnemyTeam ?? 0,
            rank: pl.competitiveTier ?? d.competitiveTier ?? 0,
            level: pl.accountLevel ?? d.accountLevel ?? null,
            card: pl.playerCardId || d.playerCardId || null,
            idle: !!d.isIdle,
            spectre: !!d.spectre,
        };
    }

    // puuid -> best presence (VALORANT first, then any other game; riot_client entries are skipped).
    async function presences() {
        const res = await riot.local('get', 'chat/v4/presences');
        const out = {};
        for (const p of res.presences || []) {
            if (!p.puuid || p.product === 'riot_client') continue;
            if (out[p.puuid]?.product === 'valorant') continue;
            const d = p.product === 'valorant' ? decode(p) : null;
            out[p.puuid] = { product: p.product, chat: p.state, name: p.game_name, tag: p.game_tag, data: d ? flatten(d) : null };
        }
        return out;
    }

    async function friends() {
        const [list, pres] = await Promise.all([riot.local('get', 'chat/v4/friends'), presences()]);
        const maps = await riot.valApi('maps').catch(() => []);
        const mapName = url => maps.find(m => m.mapUrl === url)?.displayName || null;
        return (list.friends || []).map(f => {
            const p = pres[f.puuid];
            const d = p?.data;
            let state = 'offline';
            if (p) {
                if (d) {
                    state = d.idle || p.chat === 'away' ? 'away'
                        : d.loop === 'INGAME' ? 'ingame'
                            : d.loop === 'PREGAME' ? 'pregame'
                                : d.partyState === 'MATCHMAKING' ? 'queue' : 'menus';
                } else state = p.chat === 'away' ? 'away' : 'menus';
            }
            return {
                puuid: f.puuid, pid: f.pid, gameName: f.game_name, tagLine: f.game_tag,
                online: !!p, product: p?.product || null, note: f.note || '', spectre: !!d?.spectre,
                lastOnline: f.last_online_ts || null,
                status: {
                    state, queueId: d?.queueId || null,
                    map: d?.loop === 'INGAME' || d?.loop === 'PREGAME' ? mapName(d.map) : null,
                    score: d?.loop === 'INGAME' ? [d.ally, d.enemy] : null,
                    partySize: d?.partySize ?? 1, maxPartySize: d?.maxPartySize ?? 5,
                    rank: d?.rank || 0, level: d?.level ?? null,
                    partyId: d?.partyId || null, card: d?.card || null,
                },
            };
        });
    }

    handle('social:friends', friends);

    // ---- Friend requests ----
    handle('social:requests', async () => {
        const res = await riot.local('get', 'chat/v4/friendrequests');
        const rows = (res.requests || []).map(r => ({ puuid: r.puuid, gameName: r.game_name, tagLine: r.game_tag, direction: r.subscription === 'pending_out' ? 'out' : 'in' }));
        return { incoming: rows.filter(r => r.direction === 'in'), outgoing: rows.filter(r => r.direction === 'out') };
    });
    handle('social:addFriend', async (name, tag) => {
        if (!name || !tag) throw new Error('Enter a Riot ID as Name#Tag');
        await riot.local('post', 'chat/v4/friendrequests', { game_name: name, game_tag: tag });
        return true;
    });
    handle('social:acceptRequest', async puuid => { await riot.local('post', 'chat/v4/friendrequests', { puuid }); return true; });
    // Decline (incoming) and cancel (outgoing) are the same DELETE.
    handle('social:declineRequest', async puuid => { await riot.local('delete', 'chat/v4/friendrequests', { puuid }); return true; });
    handle('social:cancelRequest', async puuid => { await riot.local('delete', 'chat/v4/friendrequests', { puuid }); return true; });
    handle('social:removeFriend', async puuid => { await riot.local('delete', 'chat/v4/friends', { puuid }); return true; });

    // ---- Party ----
    async function partyId() {
        const me = await riot.glz('get', `parties/v1/players/${riot.state.puuid}`);
        return me.CurrentPartyID || null;
    }

    // Party members' current ranks (the party data doesn't carry them), cached for five minutes.
    const scouting = require('../scout')(riot);
    const rankCache = new Map();
    async function rankOf(puuid) {
        const hit = rankCache.get(puuid);
        if (hit && Date.now() - hit.at < 300000) return hit.tier;
        let tier = 0;
        try { tier = (await scouting.rank(puuid)).current.tier; } catch (e) { }
        rankCache.set(puuid, { at: Date.now(), tier });
        return tier;
    }

    handle('social:party', async () => {
        const id = await partyId();
        if (!id) return null;
        const p = await riot.glz('get', `parties/v1/parties/${id}`);
        const shown = p.Members.filter(m => !m.PlayerIdentity?.Incognito).map(m => m.Subject);
        const [names, ranks] = await Promise.all([
            riot.names(shown).catch(() => ({})),
            Promise.all(p.Members.map(m => rankOf(m.Subject))),
        ]);
        const me = riot.state.puuid;
        const iOwn = p.Members.some(m => m.Subject === me && m.IsOwner);
        const mm = p.MatchmakingData || {};
        return {
            id: p.ID, state: p.State, open: p.Accessibility === 'OPEN', iOwn,
            queueId: mm.QueueID || null, queues: p.EligibleQueues || [], inviteCode: p.InviteCode || null,
            members: p.Members.map((m, i) => ({
                puuid: m.Subject, self: m.Subject === me, owner: !!m.IsOwner, ready: !!m.IsReady,
                hidden: !!m.PlayerIdentity?.Incognito,
                gameName: names[m.Subject]?.gameName || null, tagLine: names[m.Subject]?.tagLine || null,
                card: m.PlayerIdentity?.PlayerCardID || null,
                level: m.PlayerIdentity?.HideAccountLevel ? null : m.PlayerIdentity?.AccountLevel ?? null,
                rank: m.CompetitiveTier || ranks[i] || 0,
            })),
        };
    });

    handle('social:partyAccess', async open => {
        const id = await partyId();
        if (!id) throw new Error('You are not in a party');
        await riot.glz('post', `parties/v1/parties/${id}/accessibility`, { accessibility: open ? 'OPEN' : 'CLOSED' });
        return true;
    });
    handle('social:invite', async (name, tag) => {
        const id = await partyId();
        if (!id) throw new Error('You are not in a party');
        await riot.glz('post', `parties/v1/parties/${id}/invites/name/${enc(name)}/tag/${enc(tag)}`);
        return true;
    });
    // Lobby controls for your own party. Riot rejects them (with an error shown to the user) while a match is running.
    async function inParty() {
        const id = await partyId();
        if (!id) throw new Error('You are not in a party');
        return id;
    }
    handle('social:queue', async queueId => {
        await riot.glz('post', `parties/v1/parties/${await inParty()}/makedefault?queueID=${enc(queueId)}`);
        return true;
    });
    handle('social:matchmaking', async start => {
        await riot.glz('post', `parties/v1/parties/${await inParty()}/matchmaking/${start ? 'join' : 'leave'}`);
        return true;
    });
    handle('social:ready', async ready => {
        await riot.glz('post', `parties/v1/parties/${await inParty()}/members/${riot.state.puuid}/setReady`, { ready: !!ready });
        return true;
    });
    handle('social:inviteCode', async create => {
        const id = await inParty();
        const res = await riot.glz(create ? 'post' : 'delete', `parties/v1/parties/${id}/invitecode`);
        return create ? res?.InviteCode || null : null;
    });
    handle('social:joinCode', async code => {
        const c = String(code || '').trim();
        if (!c) throw new Error('Enter an invite code');
        await riot.glz('post', `parties/v1/players/joinbycode/${enc(c)}`);
        return true;
    });

    // Leaving (own puuid) and kicking (another member, owner only) are the same DELETE.
    handle('social:partyRemove', async puuid => { await riot.glz('delete', `parties/v1/players/${puuid}`); return true; });

    // Direct messages. A DM conversation id (cid) is the friend's pid, e.g. "<puuid>@jp1.pvp.net".
    const toMessage = m => ({
        id: m.id, cid: m.cid, body: m.body, time: Number(m.time) || 0, puuid: m.puuid,
        gameName: m.game_name, tagLine: m.game_tag, fromMe: m.puuid === riot.state.puuid,
    });

    handle('chat:conversations', async () => {
        const [convs, msgs] = await Promise.all([riot.local('get', 'chat/v6/conversations'), riot.local('get', 'chat/v6/messages')]);
        const last = {};
        for (const m of msgs.messages || []) if (!last[m.cid] || Number(m.time) > Number(last[m.cid].time)) last[m.cid] = m;
        return (convs.conversations || [])
            // DMs are type "chat" with a player pid as cid; party/team chats live on ares-* hosts.
            .filter(c => c.type === 'chat' && /^[0-9a-f-]{36}@[a-z0-9]+\.pvp\.net$/i.test(c.cid))
            .map(c => {
                const m = last[c.cid];
                return { cid: c.cid, puuid: c.cid.split('@')[0], unread: c.unread_count || 0, muted: !!c.muted, last: m ? toMessage(m) : null };
            })
            .sort((a, b) => (b.last?.time || 0) - (a.last?.time || 0));
    });

    handle('chat:messages', async cid => {
        const res = await riot.local('get', `chat/v6/messages?cid=${enc(cid)}`);
        return (res.messages || []).map(toMessage).sort((a, b) => a.time - b.time);
    });

    handle('chat:send', async (cid, text) => {
        const body = String(text || '').trim();
        if (!body) throw new Error('Message is empty');
        return toMessage(await riot.local('post', 'chat/v6/messages', { cid, message: body, type: 'chat' }));
    });
};
