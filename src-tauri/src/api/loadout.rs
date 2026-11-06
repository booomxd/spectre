// Loadout, ownership and presets. Everything that changes the loadout only touches items the player owns.
// Port of public/api/loadout.js.
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::Mutex;

const TYPES: [(&str, &str); 6] = [
    ("levels", "e7c63390-eda7-46e0-bb7a-a6abdacd2433"),
    ("chromas", "3ad1b2b2-acdb-4524-852f-954a76ddae0a"),
    ("cards", "3f296c07-64c3-494c-923b-fe692a4fa1bd"),
    ("titles", "de7caa6b-adf7-4588-bbd1-143831e786c6"),
    ("buddies", "dd3bf334-87f3-40bd-b043-682a57a8dc3a"),
    ("sprays", "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475"),
];
const SPRAY_TYPE: &str = "d5f120f8-ff8c-4aac-92ea-f2b5acbe9475";
const NO_TITLE: &str = "00000000-0000-0000-0000-000000000000";
const MELEE: &str = "2f59173c-4bed-b6c3-2191-dea9b58be9c7";

/// (at, puuid, data)
static OWNED_CACHE: Lazy<Mutex<(i64, Option<String>, Option<Value>)>> = Lazy::new(|| Mutex::new((0, None, None)));

/// JS template-literal / String() text of a value (undefined/null print as such).
fn text(v: &Value) -> String {
    match v {
        Value::Null => "undefined".into(),
        Value::String(s) => s.clone(),
        v => v.to_string(),
    }
}

fn lc(v: &Value) -> String { js::lower(v) }

/// Copies `v` into `out[name]` only when present (JS leaves undefined fields out of the JSON).
fn put(out: &mut Map<String, Value>, name: &str, v: Option<&Value>) {
    if let Some(v) = v { out.insert(name.to_string(), v.clone()); }
}

/// Entitlements per item type, cached for 30s. Returns arrays of ids (buddies keep their instance ids).
pub async fn get_owned(ctx: &Ctx, force: bool) -> Res<Value> {
    let puuid = ctx.riot.puuid();
    {
        let c = OWNED_CACHE.lock().unwrap();
        if let (false, Some(data), Some(p)) = (force, &c.2, &c.1) {
            if *p == puuid && now_ms() - c.0 < 30000 { return Ok(data.clone()); }
        }
    }
    let rows = futures::future::join_all(TYPES.iter().map(|(_, t)| {
        let path = format!("store/v1/entitlements/{puuid}/{t}");
        let riot = ctx.riot.clone();
        async move { riot.pd("get", &path, None).await }
    })).await;
    let mut data = Map::new();
    for ((k, _), row) in TYPES.iter().zip(rows) {
        let list = js::arr(&row?["Entitlements"]);
        let ids: Vec<Value> = if *k == "buddies" {
            list.iter().map(|e| {
                let mut o = Map::new();
                put(&mut o, "id", e.get("ItemID"));
                put(&mut o, "instance", e.get("InstanceID"));
                Value::Object(o)
            }).collect()
        } else {
            list.iter().map(|e| e["ItemID"].clone()).collect()
        };
        data.insert(k.to_string(), Value::Array(ids));
    }
    let data = Value::Object(data);
    *OWNED_CACHE.lock().unwrap() = (now_ms(), Some(puuid), Some(data.clone()));
    Ok(data)
}

fn lpath(ctx: &Ctx) -> String { format!("personalization/v3/players/{}/playerloadout", ctx.riot.puuid()) }
async fn get_loadout(ctx: &Ctx) -> Res<Value> { ctx.riot.pd("get", &lpath(ctx), None).await }

/// Lookup tables + ownership sets (lowercased) for validating changes.
struct Checker {
    by_id: HashMap<String, Value>,
    levels: HashSet<String>,
    chromas: HashSet<String>,
    cards: HashSet<String>,
    titles: HashSet<String>,
    sprays: HashSet<String>,
    owned: Value,
}

impl Checker {
    async fn new(ctx: &Ctx) -> Res<Checker> {
        let (weapons, owned) = tokio::join!(ctx.riot.val_api("weapons"), get_owned(ctx, false));
        let (weapons, owned) = (weapons?, owned?);
        let set = |k: &str| js::arr(&owned[k]).iter().map(lc).collect::<HashSet<String>>();
        Ok(Checker {
            levels: set("levels"), chromas: set("chromas"), cards: set("cards"), titles: set("titles"), sprays: set("sprays"),
            by_id: js::arr(&weapons).into_iter().map(|w| (lc(&w["uuid"]), w)).collect(),
            owned,
        })
    }

    fn skin_owned(&self, w: &Value, skin: &Value) -> bool {
        lc(&skin["uuid"]) == lc(&w["defaultSkinUuid"]) || js::arr(&skin["levels"]).iter().any(|l| self.levels.contains(&lc(&l["uuid"])))
    }

    /// Returns an error string when this gun's skin / level / chroma is not owned.
    fn gun_problem(&self, g: &Value) -> Option<String> {
        let Some(w) = self.by_id.get(&lc(&g["ID"])) else { return Some("Unknown weapon".into()) };
        let skins = js::arr(&w["skins"]);
        let Some(skin) = skins.iter().find(|s| lc(&s["uuid"]) == lc(&g["SkinID"])) else {
            return Some(format!("Unknown skin for {}", text(&w["displayName"])));
        };
        let name = text(&skin["displayName"]);
        if !self.skin_owned(w, skin) { return Some(format!("You do not own {name}")); }
        let Some(li) = js::arr(&skin["levels"]).iter().position(|l| lc(&l["uuid"]) == lc(&g["SkinLevelID"])) else {
            return Some(format!("Bad level for {name}"));
        };
        if li > 0 && !self.levels.contains(&lc(&g["SkinLevelID"])) { return Some(format!("You do not own that {name} level")); }
        let Some(ci) = js::arr(&skin["chromas"]).iter().position(|c| lc(&c["uuid"]) == lc(&g["ChromaID"])) else {
            return Some(format!("Bad variant for {name}"));
        };
        if ci > 0 && !self.chromas.contains(&lc(&g["ChromaID"])) { return Some(format!("You do not own that {name} variant")); }
        None
    }

    fn buddy_owned(&self, level_id: &Value, instance: &Value) -> bool {
        js::arr(&self.owned["buddies"]).iter().any(|b| lc(&b["id"]) == lc(level_id) && lc(&b["instance"]) == lc(instance))
    }
}

const SKIN_KEYS: [&str; 3] = ["SkinID", "SkinLevelID", "ChromaID"];
const CHARM_KEYS: [&str; 3] = ["CharmID", "CharmLevelID", "CharmInstanceID"];
fn same_keys(a: &Value, b: &Value, keys: &[&str]) -> bool { keys.iter().all(|k| lc(&a[*k]) == lc(&b[*k])) }

/// Order-preserving dedupe (`[...new Set(list)]`).
fn uniq(list: Vec<String>) -> Vec<String> {
    let mut out: Vec<String> = Vec::new();
    for s in list { if !out.contains(&s) { out.push(s); } }
    out
}

/// Validates only what changed against the live loadout, then PUTs it.
async fn save_loadout(ctx: &Ctx, next: &Value) -> Res<Value> {
    let cur = get_loadout(ctx).await?;
    let c = Checker::new(ctx).await?;
    let mut merged = crate::api::settings::merge(&cur, &json!({}));
    merged["Guns"] = js::or(&next["Guns"], cur["Guns"].clone());
    merged["ActiveExpressions"] = js::or(&next["ActiveExpressions"], cur["ActiveExpressions"].clone());
    merged["Identity"] = crate::api::settings::merge(&cur["Identity"], &next["Identity"]);
    let mut problems: Vec<String> = Vec::new();
    let mut used: HashSet<String> = HashSet::new();
    let cur_guns = js::arr(&cur["Guns"]);
    for g in js::arr(&merged["Guns"]) {
        let old = cur_guns.iter().find(|x| lc(&x["ID"]) == lc(&g["ID"])).cloned().unwrap_or(Value::Null);
        if truthy(&g["CharmInstanceID"]) {
            if used.contains(&lc(&g["CharmInstanceID"])) { problems.push("A buddy can only be on one weapon".into()); }
            used.insert(lc(&g["CharmInstanceID"]));
        }
        if !same_keys(&old, &g, &SKIN_KEYS) {
            if let Some(p) = c.gun_problem(&g) { problems.push(p); }
        }
        if truthy(&g["CharmInstanceID"]) && !same_keys(&old, &g, &CHARM_KEYS) && !c.buddy_owned(&g["CharmLevelID"], &g["CharmInstanceID"]) {
            problems.push("You do not own that buddy".into());
        }
    }
    let (id, oid) = (&merged["Identity"], &cur["Identity"]);
    if lc(&id["PlayerCardID"]) != lc(&oid["PlayerCardID"]) && !c.cards.contains(&lc(&id["PlayerCardID"])) {
        problems.push("You do not own that player card".into());
    }
    if lc(&id["PlayerTitleID"]) != lc(&oid["PlayerTitleID"]) && lc(&id["PlayerTitleID"]) != NO_TITLE && !c.titles.contains(&lc(&id["PlayerTitleID"])) {
        problems.push("You do not own that title".into());
    }
    let cur_ex = js::arr(&cur["ActiveExpressions"]);
    for (i, e) in js::arr(&merged["ActiveExpressions"]).iter().enumerate() {
        let o = cur_ex.get(i).cloned().unwrap_or(Value::Null);
        if e["TypeID"] == SPRAY_TYPE && lc(&e["AssetID"]) != lc(&o["AssetID"]) && !c.sprays.contains(&lc(&e["AssetID"])) {
            problems.push("You do not own that spray".into());
        }
    }
    if !problems.is_empty() { return Err(msg(uniq(problems).join("; "))); }
    ctx.riot.pd("put", &lpath(ctx), Some(merged)).await
}

/// JS `String.prototype.trim` (strips U+FEFF but not U+0085, unlike Rust's `trim`).
fn js_trim(s: &str) -> String { s.trim_matches(|c: char| (c.is_whitespace() && c != '\u{85}') || c == '\u{feff}').to_string() }

fn presets(ctx: &Ctx) -> Vec<Value> { js::arr(&ctx.riot.read_store("loadout-presets", json!([]))) }

fn find_gun<'a>(cur: &'a mut Value, id: &Value) -> Option<&'a mut Value> {
    cur["Guns"].as_array_mut()?.iter_mut().find(|g| lc(&g["ID"]) == lc(id))
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("loadout:get", |ctx, _| async move { get_loadout(&ctx).await });
    reg.add("loadout:owned", |ctx, a: Args| async move { get_owned(&ctx, a.truthy(0)).await });
    reg.add("loadout:save", |ctx, a: Args| async move { save_loadout(&ctx, &a.val(0)).await });

    // Quick equip: skin (+ optional level / chroma) onto one weapon. Defaults to the skin's first level / chroma.
    reg.add("loadout:equip", |ctx, a: Args| async move {
        let (weapon_id, skin_id, level_id, chroma_id) = (a.val(0), a.val(1), a.val(2), a.val(3));
        let mut cur = get_loadout(&ctx).await?;
        let weapons = ctx.riot.val_api("weapons").await?;
        let w = js::arr(&weapons).into_iter().find(|x| lc(&x["uuid"]) == lc(&weapon_id));
        let skin = w.and_then(|w| js::arr(&w["skins"]).into_iter().find(|s| lc(&s["uuid"]) == lc(&skin_id)));
        let Some(skin) = skin else { return Err(msg("Skin not found")) };
        let Some(gun) = find_gun(&mut cur, &weapon_id) else { return Err(msg("Weapon not in loadout")) };
        gun["SkinID"] = skin["uuid"].clone();
        gun["SkinLevelID"] = js::or(&level_id, skin["levels"][0]["uuid"].clone());
        gun["ChromaID"] = js::or(&chroma_id, skin["chromas"][0]["uuid"].clone());
        save_loadout(&ctx, &cur).await
    });

    reg.add("loadout:identity", |ctx, a: Args| async move {
        let o = a.val(0);
        let mut cur = get_loadout(&ctx).await?;
        if truthy(&o["cardId"]) { cur["Identity"]["PlayerCardID"] = o["cardId"].clone(); }
        if let Some(t) = o.get("titleId") { cur["Identity"]["PlayerTitleID"] = js::or(t, json!(NO_TITLE)); }
        if truthy(&o["borderId"]) { cur["Identity"]["PreferredLevelBorderID"] = o["borderId"].clone(); }
        if let Some(h) = o.get("hideLevel") { cur["Identity"]["HideAccountLevel"] = json!(truthy(h)); }
        save_loadout(&ctx, &cur).await
    });

    // ---- presets ----
    reg.add("loadout:presets", |ctx, _| async move { Ok(ctx.riot.read_store("loadout-presets", json!([]))) });
    reg.add("loadout:presetSave", |ctx, a: Args| async move {
        let cur = get_loadout(&ctx).await?;
        let mut list = presets(&ctx);
        // `(name || '').trim()` throws for truthy non-strings.
        let raw = a.val(0);
        if truthy(&raw) && !raw.is_string() { return Err(msg("(name || \"\").trim is not a function")); }
        let name = js_trim(&a.str(0));
        let name = if name.is_empty() { format!("Preset {}", list.len() + 1) } else { name };
        let mut loadout = Map::new();
        put(&mut loadout, "Guns", cur.get("Guns"));
        put(&mut loadout, "ActiveExpressions", cur.get("ActiveExpressions"));
        let mut ident = Map::new();
        for k in ["PlayerCardID", "PlayerTitleID", "PreferredLevelBorderID"] { put(&mut ident, k, cur["Identity"].get(k)); }
        loadout.insert("Identity".into(), Value::Object(ident));
        list.push(json!({
            "id": uuid::Uuid::new_v4().to_string(), "name": name, "createdAt": now_ms(),
            "loadout": Value::Object(loadout),
        }));
        let list = Value::Array(list);
        ctx.riot.write_store("loadout-presets", &list)?;
        Ok(list)
    });
    reg.add("loadout:presetRename", |ctx, a: Args| async move {
        let (id, raw) = (a.val(0), a.val(1));
        let mut list = presets(&ctx);
        if let Some(p) = list.iter_mut().find(|x| x["id"] == id) {
            // `name?.trim()` throws for non-nullish non-strings.
            if !raw.is_null() && !raw.is_string() { return Err(msg("name?.trim is not a function")); }
            let name = js_trim(&js::s(&raw));
            if !name.is_empty() { p["name"] = json!(name); }
        }
        let list = Value::Array(list);
        ctx.riot.write_store("loadout-presets", &list)?;
        Ok(list)
    });
    reg.add("loadout:presetDelete", |ctx, a: Args| async move {
        let id = a.val(0);
        let list = Value::Array(presets(&ctx).into_iter().filter(|p| p["id"] != id).collect());
        ctx.riot.write_store("loadout-presets", &list)?;
        Ok(list)
    });
    // Applies only what the player still owns; reports what was skipped.
    reg.add("loadout:presetApply", |ctx, a: Args| async move {
        let id = a.val(0);
        let Some(p) = presets(&ctx).into_iter().find(|x| x["id"] == id) else { return Err(msg("Preset not found")) };
        let mut cur = get_loadout(&ctx).await?;
        let c = Checker::new(&ctx).await?;
        let mut skipped: Vec<String> = Vec::new();
        let mut used_inst: HashSet<String> = HashSet::new();
        let pguns = js::arr(&p["loadout"]["Guns"]);
        // clear buddies on covered guns first so instances can move between weapons
        for pg in &pguns {
            if let Some(Value::Object(g)) = find_gun(&mut cur, &pg["ID"]) {
                for k in CHARM_KEYS { g.shift_remove(k); }
            }
        }
        for pg in &pguns {
            let Some(g) = find_gun(&mut cur, &pg["ID"]) else { continue };
            let w = c.by_id.get(&lc(&g["ID"]));
            let skin = w.and_then(|w| js::arr(&w["skins"]).into_iter().find(|s| lc(&s["uuid"]) == lc(&pg["SkinID"])));
            match (w, skin) {
                (Some(w), Some(skin)) if c.skin_owned(w, &skin) => {
                    let levels = js::arr(&skin["levels"]);
                    let chromas = js::arr(&skin["chromas"]);
                    let lv = levels.iter().position(|l| lc(&l["uuid"]) == lc(&pg["SkinLevelID"]));
                    let ch = chromas.iter().position(|x| lc(&x["uuid"]) == lc(&pg["ChromaID"]));
                    g["SkinID"] = skin["uuid"].clone();
                    g["SkinLevelID"] = match lv {
                        Some(i) if i == 0 || c.levels.contains(&lc(&levels[i]["uuid"])) => levels[i]["uuid"].clone(),
                        _ => skin["levels"][0]["uuid"].clone(),
                    };
                    g["ChromaID"] = match ch {
                        Some(i) if i == 0 || c.chromas.contains(&lc(&chromas[i]["uuid"])) => chromas[i]["uuid"].clone(),
                        _ => skin["chromas"][0]["uuid"].clone(),
                    };
                }
                _ => skipped.push(w.map(|w| js::s(&js::or(&w["displayName"], json!("Weapon")))).unwrap_or_else(|| "Weapon".into())),
            }
            if let Some(w) = w {
                if truthy(&pg["CharmLevelID"]) && w["uuid"] != MELEE {
                    let inst = js::arr(&c.owned["buddies"]).into_iter()
                        .find(|b| lc(&b["id"]) == lc(&pg["CharmLevelID"]) && !used_inst.contains(&lc(&b["instance"])));
                    if let Some(inst) = inst {
                        used_inst.insert(lc(&inst["instance"]));
                        g["CharmID"] = pg["CharmID"].clone();
                        g["CharmLevelID"] = pg["CharmLevelID"].clone();
                        g["CharmInstanceID"] = inst["instance"].clone();
                    } else {
                        skipped.push(format!("{} buddy", text(&w["displayName"])));
                    }
                }
            }
        }
        let pi = js::or(&p["loadout"]["Identity"], json!({}));
        if truthy(&pi["PlayerCardID"]) {
            if c.cards.contains(&lc(&pi["PlayerCardID"])) { cur["Identity"]["PlayerCardID"] = pi["PlayerCardID"].clone(); } else { skipped.push("Card".into()); }
        }
        if truthy(&pi["PlayerTitleID"]) {
            if lc(&pi["PlayerTitleID"]) == NO_TITLE || c.titles.contains(&lc(&pi["PlayerTitleID"])) {
                cur["Identity"]["PlayerTitleID"] = pi["PlayerTitleID"].clone();
            } else { skipped.push("Title".into()); }
        }
        if truthy(&pi["PreferredLevelBorderID"]) { cur["Identity"]["PreferredLevelBorderID"] = pi["PreferredLevelBorderID"].clone(); }
        for (i, e) in js::arr(&p["loadout"]["ActiveExpressions"]).into_iter().enumerate() {
            let Some(slot) = cur["ActiveExpressions"].as_array_mut().and_then(|x| x.get_mut(i)) else { continue };
            if !truthy(slot) { continue; }
            if e["TypeID"] != SPRAY_TYPE || c.sprays.contains(&lc(&e["AssetID"])) { *slot = e; } else { skipped.push("Spray".into()); }
        }
        let loadout = save_loadout(&ctx, &cur).await?;
        Ok(json!({ "loadout": loadout, "skipped": uniq(skipped) }))
    });
}
