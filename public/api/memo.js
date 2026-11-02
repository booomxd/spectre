// Player memos: notes, tags and a rating per puuid, stored in userData/memos.json.
module.exports = ({ riot, handle }) => {
    const load = () => riot.readStore('memos', {});

    handle('memo:list', async () => Object.values(load()).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0)));

    handle('memo:get', async (puuid) => load()[puuid] || null);

    handle('memo:save', async (memo) => {
        if (!memo?.puuid) throw new Error('Memo needs a puuid');
        const all = load();
        const old = all[memo.puuid] || {};
        const rating = [-1, 0, 1].includes(memo.rating) ? memo.rating : 0;
        const saved = {
            ...old,
            puuid: memo.puuid,
            name: String(memo.name || old.name || '').slice(0, 64),
            tags: [...new Set((memo.tags || []).map(t => String(t).trim()).filter(Boolean))].slice(0, 12),
            rating,
            text: String(memo.text || '').slice(0, 2000),
            updatedAt: Date.now(),
        };
        if (memo.encounters != null) saved.encounters = memo.encounters;
        all[memo.puuid] = saved;
        riot.writeStore('memos', all);
        return saved;
    });

    handle('memo:delete', async (puuid) => {
        const all = load();
        delete all[puuid];
        riot.writeStore('memos', all);
        return true;
    });
};
