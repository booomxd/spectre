// Live match rosters. Players are named only if not incognito (streamer mode), otherwise they are just their agent;
// their level, card and title stay hidden too. Ranks for everyone listed (agent select lists only your team). Once
// the match is live every player can be scouted and have their loadout viewed through a random per-match token, so
// the UI never holds a hidden player's puuid. Port of public/api/livematch.js.
use crate::api::{known, scout};
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use base64::Engine;
use futures::StreamExt;
use once_cell::sync::Lazy;
use rand::RngCore;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet};
use std::sync::{Arc, Mutex};

const MMR_TTL: i64 = 5 * 60 * 1000;
static MMR_CACHE: Lazy<Mutex<HashMap<String, (i64, Value)>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static NAME_CACHE: Lazy<Mutex<HashMap<String, Value>>> = Lazy::new(|| Mutex::new(HashMap::new()));

// Players of the current match by random token. `hidden` marks streamer-mode players, `identity` keeps card and
// title of named players for the loadout panel, `scouted` keeps scout summaries until the match changes.
#[derive(Default)]
struct Refs {
    match_id: Option<String>,
    by_token: HashMap<String, String>,
    by_puuid: HashMap<String, String>,
    hidden: HashSet<String>,
    identity: HashMap<String, (Value, Value)>,
    scouted: HashMap<String, Value>,
}
static REFS: Lazy<Mutex<Refs>> = Lazy::new(|| Mutex::new(Refs::default()));

/// `a.b.c` where a missing property is undefined (None) and a real null is Some(Null). Numeric keys index arrays.
fn g(v: &Value, path: &[&str]) -> Option<Value> {
    let mut cur = v;
    for k in path {
        cur = match cur {
            Value::Object(o) => o.get(*k)?,
            Value::Array(a) => a.get(k.parse::<usize>().ok()?)?,
            _ => return None,
        };
    }
    Some(cur.clone())
}

/// JS `a || b || c` over possibly-undefined values (None = undefined).
fn or(vals: &[Option<Value>]) -> Option<Value> {
    for v in vals { if v.as_ref().is_some_and(truthy) { return v.clone(); } }
    vals.last().cloned().flatten()
}

/// An object literal whose undefined (None) properties are left out, like JSON.stringify does.
fn obj(pairs: Vec<(&str, Option<Value>)>) -> Value {
    let mut o = Map::new();
    for (k, v) in pairs { if let Some(v) = v { o.insert(k.to_string(), v); } }
    Value::Object(o)
}

// Current-act rank + RR and peak rank, cached per player.
async fn mmr(ctx: &Ctx, puuid: &str) -> Value {
    if let Some((at, v)) = MMR_CACHE.lock().unwrap().get(puuid) {
        if now_ms() - at < MMR_TTL { return v.clone(); }
    }
    let (value, ok) = match scout::rank(ctx, puuid).await {
        Ok(r) => (obj(vec![("tier", g(&r, &["current", "tier"])), ("rr", g(&r, &["current", "rr"])), ("peak", g(&r, &["peak", "tier"]))]), true),
        Err(_) => (json!({ "tier": 0, "rr": 0, "peak": 0, "failed": true }), false),
    };
    // A failed lookup (e.g. rate limited) is retried after 30s instead of showing Unranked for the full TTL.
    let at = if ok { now_ms() } else { now_ms() - MMR_TTL + 30000 };
    MMR_CACHE.lock().unwrap().insert(puuid.to_string(), (at, value.clone()));
    value
}

// ---- in-match loadouts ----
// Socket ids inside a core-game loadout item.
const S_SKIN: &str = "bcef87d6-209b-46c6-8b19-fbe40bd95abc";
const S_LEVEL: &str = "e7c63390-eda7-46e0-bb7a-a6abdacd2433";
const S_CHROMA: &str = "3ad1b2b2-acdb-4524-852f-954a76ddae0a";
const S_BUDDY: &str = "77258665-71d1-4623-bc72-44db9bd5b3b3";
const S_BUDDY_LEVEL: &str = "dd3bf334-87f3-40bd-b043-682a57a8dc3a";
const WEAPON_ORDER: [&str; 19] = ["Vandal", "Phantom", "Melee", "Operator", "Sheriff", "Ghost", "Spectre", "Guardian", "Bulldog", "Marshal", "Outlaw", "Odin", "Ares", "Judge", "Bucky", "Stinger", "Frenzy", "Shorty", "Classic"];

/// `(x || '').toLowerCase()`
fn lc(x: &Value) -> String { if truthy(x) { js::s(x).to_lowercase() } else { String::new() } }

// Weapon, skin, chroma, buddy and spray lookups by uuid, built once from valorant-api content.
#[derive(Default)]
struct Index {
    weapon: HashMap<String, Value>,
    skin: HashMap<String, Value>,
    chroma: HashMap<String, (Value, Value)>,
    level: HashMap<String, Value>,
    buddy: HashMap<String, Value>,
    spray: HashMap<String, Value>,
}
static CONTENT: Lazy<Mutex<Option<Arc<Index>>>> = Lazy::new(|| Mutex::new(None));

async fn content(ctx: &Ctx) -> Res<Arc<Index>> {
    if let Some(ix) = CONTENT.lock().unwrap().clone() { return Ok(ix); }
    let (weapons, buddies, sprays) = tokio::join!(ctx.riot.val_api("weapons"), ctx.riot.val_api("buddies"), ctx.riot.val_api("sprays"));
    let weapons = weapons?;
    let (buddies, sprays) = (buddies.unwrap_or(json!([])), sprays.unwrap_or(json!([])));
    let mut ix = Index::default();
    for w in js::arr(&weapons) {
        ix.weapon.insert(lc(&w["uuid"]), w.clone());
        for s in js::arr(&w["skins"]) {
            ix.skin.insert(lc(&s["uuid"]), s.clone());
            for c in js::arr(&s["chromas"]) { ix.chroma.insert(lc(&c["uuid"]), (c.clone(), s.clone())); }
            for l in js::arr(&s["levels"]) { ix.level.insert(lc(&l["uuid"]), s.clone()); }
        }
    }
    for b in js::arr(&buddies) {
        ix.buddy.insert(lc(&b["uuid"]), b.clone());
        for l in js::arr(&b["levels"]) { ix.buddy.insert(lc(&l["uuid"]), b.clone()); }
    }
    for s in js::arr(&sprays) {
        ix.spray.insert(lc(&s["uuid"]), s.clone());
        for l in js::arr(&s["levels"]) { ix.spray.insert(lc(&l["uuid"]), s.clone()); }
    }
    let ix = Arc::new(ix);
    *CONTENT.lock().unwrap() = Some(ix.clone());
    Ok(ix)
}

// One player's loadout: every weapon's skin (chroma render) and buddy, plus equipped sprays.
fn parse_loadout(l: &Value, ix: &Index) -> Value {
    let sock = |item: &Value, id: &str| lc(&item["Sockets"][id]["Item"]["ID"]);
    let mut weapons: Vec<(Option<Value>, Value)> = js::entries(&l["Items"]).into_iter().filter_map(|(wid, item)| {
        let w = ix.weapon.get(&wid.to_lowercase())?;
        let ch = ix.chroma.get(&sock(&item, S_CHROMA));
        let skin = ix.skin.get(&sock(&item, S_SKIN)).or(ch.map(|c| &c.1)).or_else(|| ix.level.get(&sock(&item, S_LEVEL)));
        let buddy = ix.buddy.get(&sock(&item, S_BUDDY)).or_else(|| ix.buddy.get(&sock(&item, S_BUDDY_LEVEL)));
        let name = g(w, &["displayName"]);
        let skin_name = or(&[skin.and_then(|s| g(s, &["displayName"])), name.clone()]);
        // Variant renders first: valorant-api's icons for most standard skins are an "X" placeholder.
        let image = or(&[
            ch.and_then(|c| g(&c.0, &["fullRender"])), ch.and_then(|c| g(&c.0, &["displayIcon"])),
            skin.and_then(|s| g(s, &["chromas", "0", "fullRender"])), skin.and_then(|s| g(s, &["displayIcon"])), g(w, &["displayIcon"]),
        ]);
        let buddy = Some(match buddy { Some(b) => obj(vec![("name", g(b, &["displayName"])), ("icon", g(b, &["displayIcon"]))]), None => Value::Null });
        Some((name.clone(), obj(vec![("weapon", name), ("skin", skin_name), ("image", image), ("buddy", buddy)])))
    }).collect();
    let at = |n: &Option<Value>| n.as_ref().and_then(Value::as_str).and_then(|s| WEAPON_ORDER.iter().position(|x| *x == s)).unwrap_or(99);
    let name_of = |n: &Option<Value>| n.as_ref().map(js::s).unwrap_or_else(|| "undefined".into());
    weapons.sort_by(|a, b| at(&a.0).cmp(&at(&b.0)).then_with(|| {
        let (x, y) = (name_of(&a.0), name_of(&b.0));
        x.to_lowercase().cmp(&y.to_lowercase()).then_with(|| y.cmp(&x))
    }));
    let mut picks: Vec<Value> = js::arr(&l["Sprays"]["SpraySelections"]).iter().map(|s| s["SprayID"].clone()).collect();
    picks.extend(js::arr(&l["Expressions"]["AESSelections"]).iter().map(|s| s["AssetID"].clone()));
    let mut seen = HashSet::new();
    let sprays: Vec<Value> = picks.iter().filter_map(|id| ix.spray.get(&lc(id)))
        .filter(|s| seen.insert(s["uuid"].to_string()))
        .map(|s| obj(vec![("name", g(s, &["displayName"])), ("icon", or(&[g(s, &["fullTransparentIcon"]), g(s, &["displayIcon"])]))]))
        .collect();
    json!({ "weapons": weapons.into_iter().map(|w| w.1).collect::<Vec<_>>(), "sprays": sprays })
}

// Loadouts of everyone in the current in-game match, fetched once per match (they can't change mid-match).
struct Loadouts { match_id: Option<String>, by_puuid: Option<Arc<HashMap<String, Value>>>, failed_at: i64 }
static LOADOUTS: Lazy<Mutex<Loadouts>> = Lazy::new(|| Mutex::new(Loadouts { match_id: None, by_puuid: None, failed_at: 0 }));

async fn match_loadouts(ctx: &Ctx, id: &str) -> Arc<HashMap<String, Value>> {
    {
        let l = LOADOUTS.lock().unwrap();
        if l.match_id.as_deref() == Some(id) {
            if let Some(b) = &l.by_puuid { return b.clone(); }
            if now_ms() - l.failed_at < 30000 { return Arc::new(HashMap::new()); }
        }
    }
    let path = format!("core-game/v1/matches/{id}/loadouts");
    let (res, ix) = tokio::join!(ctx.riot.glz("get", &path, None), content(ctx));
    match (res, ix) {
        (Ok(res), Ok(ix)) => {
            let mut by_puuid = HashMap::new();
            for e in js::arr(&res["Loadouts"]) {
                let l = if truthy(&e["Loadout"]) { &e["Loadout"] } else { &e };
                if truthy(&l["Subject"]) { by_puuid.insert(js::s(&l["Subject"]), parse_loadout(l, &ix)); }
            }
            let by_puuid = Arc::new(by_puuid);
            *LOADOUTS.lock().unwrap() = Loadouts { match_id: Some(id.to_string()), by_puuid: Some(by_puuid.clone()), failed_at: 0 };
            by_puuid
        }
        _ => {
            *LOADOUTS.lock().unwrap() = Loadouts { match_id: Some(id.to_string()), by_puuid: None, failed_at: now_ms() };
            Arc::new(HashMap::new())
        }
    }
}

/// Lenient decode like Node's `Buffer.from(s, 'base64')`: accepts the url-safe alphabet, skips other characters,
/// stops at the first '=' and ignores missing padding.
fn node_base64(s: &str) -> Result<Vec<u8>, base64::DecodeError> {
    let mut clean: String = s.chars().take_while(|c| *c != '=')
        .filter_map(|c| match c { '-' => Some('+'), '_' => Some('/'), c if c.is_ascii_alphanumeric() || c == '+' || c == '/' => Some(c), _ => None })
        .collect();
    if clean.len() % 4 == 1 { clean.pop(); }
    let cfg = base64::engine::GeneralPurposeConfig::new()
        .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent)
        .with_decode_allow_trailing_bits(true);
    base64::engine::GeneralPurpose::new(&base64::alphabet::STANDARD, cfg).decode(clean)
}

// puuids whose visible VALORANT presence carries the Spectre marker (friends and party only).
async fn spectre_set(ctx: &Ctx) -> HashSet<String> {
    let mut out = HashSet::new();
    if let Ok(res) = ctx.riot.local("get", "chat/v4/presences", None).await {
        for p in js::arr(&res["presences"]) {
            if !truthy(&p["puuid"]) || p["product"] != "valorant" || !truthy(&p["private"]) { continue; }
            if let Ok(b) = node_base64(&js::s(&p["private"])) {
                if let Ok(v) = serde_json::from_str::<Value>(&String::from_utf8_lossy(&b)) {
                    if truthy(&v["spectre"]) { out.insert(js::s(&p["puuid"])); }
                }
            }
        }
    }
    out
}

static POD_RE: Lazy<regex::Regex> = Lazy::new(|| regex::Regex::new(r"-gp-(.+)-\d+$").unwrap());
fn server_name(pod: &Value) -> Value {
    let pod = if truthy(pod) { js::s(pod) } else { String::new() };
    POD_RE.captures(&pod).and_then(|c| c.get(1)).map(|m| json!(m.as_str().replace('-', " "))).unwrap_or(Value::Null)
}

fn new_token() -> String {
    let mut b = [0u8; 8];
    rand::thread_rng().fill_bytes(&mut b);
    hex::encode(b)
}

async fn resolve(ctx: &Ctx, kind: &str, id: &str) -> Res<Value> {
    let pregame = kind == "pregame";
    let base = if pregame { "pregame/v1/matches/" } else { "core-game/v1/matches/" };
    let m = ctx.riot.glz("get", &format!("{base}{id}"), None).await?;
    let (agents, maps, loadout_map) = tokio::join!(
        ctx.riot.val_api("agents?isPlayableCharacter=true"),
        ctx.riot.val_api("maps"),
        async { if kind == "ingame" { match_loadouts(ctx, id).await } else { Arc::new(HashMap::new()) } },
    );
    let (agents, maps) = (js::arr(&agents.unwrap_or(json!([]))), js::arr(&maps.unwrap_or(json!([]))));
    let agent_of = |cid: &Value| -> Value {
        if !truthy(cid) { return Value::Null; }
        let cid = js::s(cid).to_lowercase();
        match agents.iter().find(|x| js::s(&x["uuid"]).to_lowercase() == cid) {
            Some(a) => obj(vec![
                ("id", g(a, &["uuid"])), ("name", g(a, &["displayName"])), ("icon", g(a, &["displayIcon"])),
                ("role", Some(js::or(&a["role"]["displayName"], Value::Null))),
            ]),
            None => Value::Null,
        }
    };
    let map_id = g(&m, &["MapID"]);
    let map = maps.iter().find(|x| g(x, &["mapUrl"]) == map_id);
    let me = ctx.riot.puuid();
    let raw = js::arr(if pregame { &m["AllyTeam"]["Players"] } else { &m["Players"] });
    let my_raw = raw.iter().find(|p| p["Subject"] == me.as_str());
    let my_team = if pregame { js::or(&m["AllyTeam"]["TeamID"], json!("Blue")) } else { js::or(&my_raw.map(|p| p["TeamID"].clone()).unwrap_or(Value::Null), json!("Blue")) };

    let (known_set, party_set, spectres) = tokio::join!(known::known_puuids(ctx), known::party_puuids(ctx), spectre_set(ctx));
    let (known_set, party_set) = (known_set?, party_set?);
    let sub = |p: &Value| js::s(&p["Subject"]);
    // Names exactly as the client shows them: everyone except streamer-mode (incognito) players.
    // Agent select only contains your own team, so enemies are never named before the match starts.
    let nameable = |p: &Value| sub(p) == me || !truthy(&p["PlayerIdentity"]["Incognito"]);
    let need: Vec<String> = {
        let nc = NAME_CACHE.lock().unwrap();
        raw.iter().filter(|p| nameable(p)).map(sub).filter(|s| !nc.contains_key(s)).collect()
    };
    if !need.is_empty() {
        if let Ok(n) = ctx.riot.names(&need).await {
            let mut nc = NAME_CACHE.lock().unwrap();
            for (k, v) in n { nc.insert(k, v); }
        }
    }
    // Rank/RR/peak for everyone listed: agent select only lists your own team, so enemies wait for the match.
    let subjects: Vec<String> = raw.iter().map(sub).collect();
    let stats: HashMap<String, Value> = futures::stream::iter(subjects)
        .map(|s| async move { let v = mmr(ctx, &s).await; (s, v) })
        .buffer_unordered(4).collect().await;

    // Party marker: only the user's own party, when 2+ of its members are in this match.
    let mates = raw.iter().filter(|p| party_set.contains(&sub(p))).count();

    let names = NAME_CACHE.lock().unwrap().clone();
    let mut refs = REFS.lock().unwrap();
    if refs.match_id.as_deref() != Some(id) { *refs = Refs { match_id: Some(id.to_string()), ..Default::default() }; }
    let players: Vec<Value> = raw.iter().map(|p| {
        let s = sub(p);
        let idn = if truthy(&p["PlayerIdentity"]) { p["PlayerIdentity"].clone() } else { json!({}) };
        let k = known_set.contains(&s);
        let n = if nameable(p) { names.get(&s) } else { None };
        let is_me = s == me;
        let hidden = !is_me && n.is_none();
        if hidden { refs.hidden.insert(s.clone()); } else {
            refs.hidden.remove(&s);
            refs.identity.insert(s.clone(), (idn["PlayerCardID"].clone(), idn["PlayerTitleID"].clone()));
        }
        let token = match refs.by_puuid.get(&s) {
            Some(t) => t.clone(),
            None => { let t = new_token(); refs.by_puuid.insert(s.clone(), t.clone()); refs.by_token.insert(t.clone(), s.clone()); t }
        };
        let st = stats.get(&s).cloned().unwrap_or(Value::Null);
        let level = if !hidden && !truthy(&idn["HideAccountLevel"]) { js::nullish(&idn["AccountLevel"], Value::Null) } else { Value::Null };
        let guns = loadout_map.get(&s).map(|l| Value::Array(js::arr(&l["weapons"]).into_iter().filter(|w| w["weapon"] == "Vandal" || w["weapon"] == "Phantom").collect()));
        obj(vec![
            ("ref", Some(json!(token))),
            // Named players can be opened in Player Search (same as typing their Riot ID); hidden ones never.
            ("puuid", Some(if k || n.is_some() { p["Subject"].clone() } else { Value::Null })),
            ("self", Some(json!(is_me))),
            ("hidden", Some(json!(hidden))),
            ("gameName", Some(n.map(|n| n["gameName"].clone()).unwrap_or(Value::Null))),
            ("tagLine", Some(n.map(|n| n["tagLine"].clone()).unwrap_or(Value::Null))),
            ("agent", Some(agent_of(&p["CharacterID"]))),
            ("locked", Some(json!(if pregame { p["CharacterSelectionState"] == "locked" } else { true }))),
            ("team", if pregame { Some(Value::Null) } else { g(p, &["TeamID"]) }), // side is never exposed during agent select
            ("enemy", Some(json!(kind == "ingame" && p["TeamID"] != my_team))),
            // Level and card as the client shows them: never for streamer-mode players or hidden levels.
            ("level", Some(level)),
            ("card", Some(if !hidden { js::or(&idn["PlayerCardID"], Value::Null) } else { Value::Null })),
            ("rank", Some(js::or(&st["tier"], json!(0)))), ("rr", Some(js::or(&st["rr"], json!(0)))), ("peak", Some(js::or(&st["peak"], json!(0)))),
            ("known", Some(json!(k))),
            ("ranked", Some(json!(true))),
            // Scouting opens once agent select is over and the match is live.
            ("canScout", Some(json!(kind == "ingame"))),
            ("scouted", refs.scouted.get(&s).cloned()),
            ("guns", guns),
            ("spectre", if !truthy(&idn["Incognito"]) && spectres.contains(&s) { Some(json!(true)) } else { None }),
            ("party", Some(if party_set.contains(&s) && mates > 1 { json!(0) } else { Value::Null })),
        ])
    }).collect();
    drop(refs);
    Ok(json!({
        "state": if pregame { "pregame" } else { "ingame" }, "matchId": id,
        "queueId": js::or(&m["MatchmakingData"]["QueueID"], js::or(&m["QueueID"], json!(""))),
        "map": match map { Some(x) => obj(vec![("name", g(x, &["displayName"])), ("splash", g(x, &["splash"])), ("listIcon", g(x, &["listViewIcon"]))]), None => json!({ "name": null }) },
        "server": server_name(&m["GamePodID"]),
        "players": players,
    }))
}

struct Found { puuid: String, hidden: bool, match_id: String }

// Resolves a player token, checking the user is still in that match and it has started (not agent select).
async fn lookup(ctx: &Ctx, r: &Value) -> Res<Found> {
    let puuid = r.as_str().and_then(|t| REFS.lock().unwrap().by_token.get(t).cloned());
    let mut now: Option<(String, &str)> = None;
    for (path, kind) in [("core-game", "ingame"), ("pregame", "pregame")] {
        if let Ok(p) = ctx.riot.glz("get", &format!("{path}/v1/players/{}", ctx.riot.puuid()), None).await {
            if truthy(&p["MatchID"]) { now = Some((js::s(&p["MatchID"]), kind)); break; }
        }
    }
    let (match_id, hidden) = {
        let refs = REFS.lock().unwrap();
        let same = matches!((&now, &refs.match_id), (Some((n, _)), Some(m)) if n == m);
        let Some(pu) = puuid.as_ref().filter(|_| same) else { return Err(msg("That player is not in your current match")) };
        (refs.match_id.clone().unwrap_or_default(), refs.hidden.contains(pu))
    };
    if now.map(|n| n.1) != Some("ingame") { return Err(msg("Available once the match starts")); }
    Ok(Found { puuid: puuid.unwrap_or_default(), hidden, match_id })
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("live:state", |ctx, _| async move {
        let me = ctx.riot.puuid();
        for kind in ["ingame", "pregame"] {
            let base = if kind == "ingame" { "core-game" } else { "pregame" };
            let p = match ctx.riot.glz("get", &format!("{base}/v1/players/{me}"), None).await {
                Ok(p) => p,
                Err(e) if e.status() == Some(404) => Value::Null,
                Err(e) => return Err(e),
            };
            if truthy(&p["MatchID"]) { return resolve(&ctx, kind, &js::s(&p["MatchID"])).await; }
        }
        Ok(json!({ "state": "menus" }))
    });

    // Scout a player in the user's current match, only on request: rank, act history, recent competitive form and
    // matches. The result never carries a name, puuid, match id or teammates.
    reg.add("live:scout", |ctx, a: Args| async move {
        let f = lookup(&ctx, &a.val(0)).await?;
        let s = scout::scout(&ctx, &f.puuid).await?;
        let r = &s["recent"];
        let summary = if truthy(r) {
            let wr = js::number(js::round(js::num(&r["wins"]) / js::num(&r["matches"]) * 100.0));
            obj(vec![("kd", g(r, &["kd"])), ("acs", g(r, &["acs"])), ("hs", g(r, &["hs"])), ("wr", Some(wr))])
        } else { Value::Null };
        REFS.lock().unwrap().scouted.insert(f.puuid, summary);
        Ok(s)
    });

    // A player's in-match loadout: weapon skins, buddies and sprays, plus card and title for named players only.
    reg.add("live:loadout", |ctx, a: Args| async move {
        let f = lookup(&ctx, &a.val(0)).await?;
        let Some(l) = match_loadouts(&ctx, &f.match_id).await.get(&f.puuid).cloned() else {
            return Err(msg("Loadout not available yet, try again in a moment"));
        };
        let idn = if f.hidden { None } else { REFS.lock().unwrap().identity.get(&f.puuid).cloned() };
        let (card_id, title_id) = idn.unwrap_or((Value::Null, Value::Null));
        let card_path = format!("playercards/{}", js::s(&card_id));
        let title_path = format!("playertitles/{}", js::s(&title_id));
        let (card, title) = tokio::join!(
            async { if truthy(&card_id) { ctx.riot.val_api(&card_path).await.ok() } else { None } },
            async { if truthy(&title_id) { ctx.riot.val_api(&title_path).await.ok() } else { None } },
        );
        let mut out = l.as_object().cloned().unwrap_or_default();
        out.insert("card".into(), match card.filter(truthy) { Some(c) => obj(vec![("name", g(&c, &["displayName"])), ("art", g(&c, &["wideArt"]))]), None => Value::Null });
        out.insert("title".into(), title.map(|t| js::or(&t["titleText"], Value::Null)).unwrap_or(Value::Null));
        Ok(Value::Object(out))
    });

    // Pick / lock an agent is deliberately not exposed: this page is read-only.
}
