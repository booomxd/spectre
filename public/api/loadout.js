// Loadout, ownership and presets. Everything that changes the loadout only touches items the player owns.
const crypto = require('crypto');

const TYPES = {
    levels: 'e7c63390-eda7-46e0-bb7a-a6abdacd2433',
    chromas: '3ad1b2b2-acdb-4524-852f-954a76ddae0a',
    cards: '3f296c07-64c3-494c-923b-fe692a4fa1bd',
    titles: 'de7caa6b-adf7-4588-bbd1-143831e786c6',
    buddies: 'dd3bf334-87f3-40bd-b043-682a57a8dc3a',
    sprays: 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475',
};
const SPRAY_TYPE = TYPES.sprays;
const NO_TITLE = '00000000-0000-0000-0000-000000000000';
const MELEE = '2f59173c-4bed-b6c3-2191-dea9b58be9c7';

let ownedCache = { at: 0, puuid: null, data: null };

// Entitlements per item type, cached for 30s. Returns arrays of ids (buddies keep their instance ids).
async function getOwned(riot, force) {
    const puuid = riot.state.puuid;
    if (!force && ownedCache.data && ownedCache.puuid === puuid && Date.now() - ownedCache.at < 30000) return ownedCache.data;
    const keys = Object.keys(TYPES);
    const rows = await Promise.all(keys.map(k => riot.pd('get', `store/v1/entitlements/${puuid}/${TYPES[k]}`)));
    const data = {};
    keys.forEach((k, i) => {
        const list = rows[i].Entitlements || [];
        data[k] = k === 'buddies' ? list.map(e => ({ id: e.ItemID, instance: e.InstanceID })) : list.map(e => e.ItemID);
    });
    ownedCache = { at: Date.now(), puuid, data };
    return data;
}

const lc = s => (s || '').toLowerCase();

module.exports = (ctx) => {
    const { riot, handle } = ctx;
    const lpath = () => `personalization/v3/players/${riot.state.puuid}/playerloadout`;
    const getLoadout = () => riot.pd('get', lpath());

    // Lookup tables + ownership sets (lowercased) for validating changes.
    async function checker() {
        const [weapons, owned] = await Promise.all([riot.valApi('weapons'), getOwned(riot)]);
        const S = {
            levels: new Set(owned.levels.map(lc)), chromas: new Set(owned.chromas.map(lc)),
            cards: new Set(owned.cards.map(lc)), titles: new Set(owned.titles.map(lc)),
            sprays: new Set(owned.sprays.map(lc)),
        };
        const byId = Object.fromEntries(weapons.map(w => [lc(w.uuid), w]));
        const skinOwned = (w, skin) => lc(skin.uuid) === lc(w.defaultSkinUuid) || skin.levels.some(l => S.levels.has(lc(l.uuid)));
        // Returns an error string when this gun's skin / level / chroma is not owned.
        function gunProblem(g) {
            const w = byId[lc(g.ID)];
            if (!w) return 'Unknown weapon';
            const skin = w.skins.find(s => lc(s.uuid) === lc(g.SkinID));
            if (!skin) return `Unknown skin for ${w.displayName}`;
            if (!skinOwned(w, skin)) return `You do not own ${skin.displayName}`;
            const li = skin.levels.findIndex(l => lc(l.uuid) === lc(g.SkinLevelID));
            if (li < 0) return `Bad level for ${skin.displayName}`;
            if (li > 0 && !S.levels.has(lc(g.SkinLevelID))) return `You do not own that ${skin.displayName} level`;
            const ci = skin.chromas.findIndex(c => lc(c.uuid) === lc(g.ChromaID));
            if (ci < 0) return `Bad variant for ${skin.displayName}`;
            if (ci > 0 && !S.chromas.has(lc(g.ChromaID))) return `You do not own that ${skin.displayName} variant`;
            return null;
        }
        const buddyOwned = (levelId, instance) => owned.buddies.some(b => lc(b.id) === lc(levelId) && lc(b.instance) === lc(instance));
        return { weapons, byId, S, owned, skinOwned, gunProblem, buddyOwned };
    }

    const SKIN_KEYS = ['SkinID', 'SkinLevelID', 'ChromaID'];
    const CHARM_KEYS = ['CharmID', 'CharmLevelID', 'CharmInstanceID'];
    const sameKeys = (a, b, keys) => keys.every(k => lc(a?.[k]) === lc(b?.[k]));

    // Validates only what changed against the live loadout, then PUTs it.
    async function saveLoadout(next) {
        const cur = await getLoadout();
        const C = await checker();
        const merged = { ...cur, Guns: next.Guns || cur.Guns, ActiveExpressions: next.ActiveExpressions || cur.ActiveExpressions, Identity: { ...cur.Identity, ...(next.Identity || {}) } };
        const problems = [];
        const used = new Set();
        for (const g of merged.Guns) {
            const old = cur.Guns.find(x => lc(x.ID) === lc(g.ID));
            if (g.CharmInstanceID) {
                if (used.has(lc(g.CharmInstanceID))) problems.push('A buddy can only be on one weapon');
                used.add(lc(g.CharmInstanceID));
            }
            if (!sameKeys(old, g, SKIN_KEYS)) {
                const p = C.gunProblem(g);
                if (p) problems.push(p);
            }
            if (g.CharmInstanceID && !sameKeys(old, g, CHARM_KEYS) && !C.buddyOwned(g.CharmLevelID, g.CharmInstanceID)) problems.push('You do not own that buddy');
        }
        const id = merged.Identity, oid = cur.Identity;
        if (lc(id.PlayerCardID) !== lc(oid.PlayerCardID) && !C.S.cards.has(lc(id.PlayerCardID))) problems.push('You do not own that player card');
        if (lc(id.PlayerTitleID) !== lc(oid.PlayerTitleID) && lc(id.PlayerTitleID) !== NO_TITLE && !C.S.titles.has(lc(id.PlayerTitleID))) problems.push('You do not own that title');
        merged.ActiveExpressions.forEach((e, i) => {
            const o = cur.ActiveExpressions[i];
            if (e.TypeID === SPRAY_TYPE && lc(e.AssetID) !== lc(o?.AssetID) && !C.S.sprays.has(lc(e.AssetID))) problems.push('You do not own that spray');
        });
        if (problems.length) throw new Error([...new Set(problems)].join('; '));
        return riot.pd('put', lpath(), merged);
    }

    handle('loadout:get', () => getLoadout());
    handle('loadout:owned', force => getOwned(riot, !!force));
    handle('loadout:save', next => saveLoadout(next));

    // Quick equip: skin (+ optional level / chroma) onto one weapon. Defaults to the skin's first level / chroma.
    handle('loadout:equip', async (weaponId, skinId, levelId, chromaId) => {
        const cur = await getLoadout();
        const weapons = await riot.valApi('weapons');
        const w = weapons.find(x => lc(x.uuid) === lc(weaponId));
        const skin = w?.skins.find(s => lc(s.uuid) === lc(skinId));
        if (!skin) throw new Error('Skin not found');
        const gun = cur.Guns.find(g => lc(g.ID) === lc(weaponId));
        if (!gun) throw new Error('Weapon not in loadout');
        gun.SkinID = skin.uuid;
        gun.SkinLevelID = levelId || skin.levels[0].uuid;
        gun.ChromaID = chromaId || skin.chromas[0].uuid;
        return saveLoadout(cur);
    });

    handle('loadout:identity', async ({ cardId, titleId, borderId, hideLevel } = {}) => {
        const cur = await getLoadout();
        if (cardId) cur.Identity.PlayerCardID = cardId;
        if (titleId !== undefined) cur.Identity.PlayerTitleID = titleId || NO_TITLE;
        if (borderId) cur.Identity.PreferredLevelBorderID = borderId;
        if (hideLevel !== undefined) cur.Identity.HideAccountLevel = !!hideLevel;
        return saveLoadout(cur);
    });

    // ---- presets ----
    const presets = () => riot.readStore('loadout-presets', []);
    handle('loadout:presets', () => presets());
    handle('loadout:presetSave', async (name) => {
        const cur = await getLoadout();
        const list = presets();
        list.push({
            id: crypto.randomUUID(), name: (name || '').trim() || `Preset ${list.length + 1}`, createdAt: Date.now(),
            loadout: {
                Guns: cur.Guns, ActiveExpressions: cur.ActiveExpressions,
                Identity: { PlayerCardID: cur.Identity.PlayerCardID, PlayerTitleID: cur.Identity.PlayerTitleID, PreferredLevelBorderID: cur.Identity.PreferredLevelBorderID },
            },
        });
        riot.writeStore('loadout-presets', list);
        return list;
    });
    handle('loadout:presetRename', (id, name) => {
        const list = presets();
        const p = list.find(x => x.id === id);
        if (p && name?.trim()) p.name = name.trim();
        riot.writeStore('loadout-presets', list);
        return list;
    });
    handle('loadout:presetDelete', (id) => {
        const list = presets().filter(p => p.id !== id);
        riot.writeStore('loadout-presets', list);
        return list;
    });
    // Applies only what the player still owns; reports what was skipped.
    handle('loadout:presetApply', async (id) => {
        const p = presets().find(x => x.id === id);
        if (!p) throw new Error('Preset not found');
        const cur = await getLoadout();
        const C = await checker();
        const skipped = [];
        const usedInst = new Set();
        // clear buddies on covered guns first so instances can move between weapons
        for (const pg of p.loadout.Guns) {
            const g = cur.Guns.find(x => lc(x.ID) === lc(pg.ID));
            if (g) { delete g.CharmID; delete g.CharmLevelID; delete g.CharmInstanceID; }
        }
        for (const pg of p.loadout.Guns) {
            const g = cur.Guns.find(x => lc(x.ID) === lc(pg.ID));
            if (!g) continue;
            const w = C.byId[lc(g.ID)];
            const skin = w?.skins.find(s => lc(s.uuid) === lc(pg.SkinID));
            if (skin && C.skinOwned(w, skin)) {
                const lv = skin.levels.find(l => lc(l.uuid) === lc(pg.SkinLevelID));
                const ch = skin.chromas.find(c => lc(c.uuid) === lc(pg.ChromaID));
                g.SkinID = skin.uuid;
                g.SkinLevelID = lv && (lv === skin.levels[0] || C.S.levels.has(lc(lv.uuid))) ? lv.uuid : skin.levels[0].uuid;
                g.ChromaID = ch && (ch === skin.chromas[0] || C.S.chromas.has(lc(ch.uuid))) ? ch.uuid : skin.chromas[0].uuid;
            } else skipped.push(w?.displayName || 'Weapon');
            if (pg.CharmLevelID && w && w.uuid !== MELEE) {
                const inst = C.owned.buddies.find(b => lc(b.id) === lc(pg.CharmLevelID) && !usedInst.has(lc(b.instance)));
                if (inst) {
                    usedInst.add(lc(inst.instance));
                    g.CharmID = pg.CharmID; g.CharmLevelID = pg.CharmLevelID; g.CharmInstanceID = inst.instance;
                } else skipped.push(`${w.displayName} buddy`);
            }
        }
        const pi = p.loadout.Identity || {};
        if (pi.PlayerCardID) { if (C.S.cards.has(lc(pi.PlayerCardID))) cur.Identity.PlayerCardID = pi.PlayerCardID; else skipped.push('Card'); }
        if (pi.PlayerTitleID) {
            if (lc(pi.PlayerTitleID) === NO_TITLE || C.S.titles.has(lc(pi.PlayerTitleID))) cur.Identity.PlayerTitleID = pi.PlayerTitleID; else skipped.push('Title');
        }
        if (pi.PreferredLevelBorderID) cur.Identity.PreferredLevelBorderID = pi.PreferredLevelBorderID;
        (p.loadout.ActiveExpressions || []).forEach((e, i) => {
            if (!cur.ActiveExpressions[i]) return;
            if (e.TypeID !== SPRAY_TYPE || C.S.sprays.has(lc(e.AssetID))) cur.ActiveExpressions[i] = e;
            else skipped.push('Spray');
        });
        const loadout = await saveLoadout(cur);
        return { loadout, skipped: [...new Set(skipped)] };
    });
};
module.exports.getOwned = getOwned;
