// profile tools: presence overrides (rank, profile, Premier, status) on the private Valorant presence
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use base64::Engine;
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::collections::BTreeMap;
use std::sync::Mutex;

/// `p.split('.').reduce((o, k) => o?.[k], obj)`: None is JS undefined (a null leaf is Some(Null)).
fn get_path<'a>(obj: &'a Value, p: &str) -> Option<&'a Value> {
    let mut cur = Some(obj);
    for k in p.split('.') {
        cur = match cur? {
            Value::Object(o) => o.get(k),
            Value::Array(a) => k.parse::<usize>().ok().and_then(|i| a.get(i)),
            _ => None,
        };
    }
    cur
}

// Riot alternates between nested (playerPresenceData.x) and flat (x) payloads
fn set_path(obj: &mut Value, p: &str, value: Value) {
    let mut keys: Vec<&str> = p.split('.').collect();
    let last = keys.pop().unwrap_or_default();
    let has_parent = matches!(get_path_keys(obj, &keys), Some(Value::Object(_)) | Some(Value::Array(_)));
    if has_parent {
        let mut cur = &mut *obj;
        for k in &keys {
            cur = match cur {
                Value::Object(o) => o.get_mut(*k).unwrap(),
                Value::Array(a) => &mut a[k.parse::<usize>().unwrap()],
                _ => unreachable!(),
            };
        }
        match cur {
            Value::Object(o) => { o.insert(last.to_string(), value); }
            Value::Array(a) => { if let Some(slot) = last.parse::<usize>().ok().and_then(|i| a.get_mut(i)) { *slot = value; } }
            _ => {}
        }
    } else if !keys.is_empty() {
        if let Value::Object(o) = obj { o.insert(last.to_string(), value); }
    }
}

fn get_path_keys<'a>(obj: &'a Value, keys: &[&str]) -> Option<&'a Value> {
    if keys.is_empty() { return Some(obj); }
    get_path(obj, &keys.join("."))
}

fn resolved_path(obj: &Value, p: &str) -> String {
    if get_path(obj, p).is_some() || !p.contains('.') { p.to_string() } else { p.rsplit('.').next().unwrap_or(p).to_string() }
}

/// JS `===` for JSON values
fn strict_eq(a: Option<&Value>, b: &Value) -> bool {
    match (a, b) {
        (None, _) => false,
        (Some(Value::Number(x)), Value::Number(y)) => x.as_f64() == y.as_f64(),
        (Some(Value::Object(_)), _) | (Some(Value::Array(_)), _) => false,
        (Some(x), y) => x == y,
    }
}

/// JS `String(v)`
pub(crate) fn js_string(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::String(s) => s.clone(),
        Value::Bool(b) => b.to_string(),
        Value::Number(n) => match n.as_f64() { Some(f) if n.is_f64() && f.fract() == 0.0 && f.abs() < 1e21 => format!("{}", f as i128), _ => n.to_string() },
        Value::Array(a) => a.iter().map(|x| if x.is_null() { String::new() } else { js_string(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `parseInt(v)` with a default for NaN
fn int(v: Option<&Value>, d: i64) -> i64 {
    let s = match v { None => return d, Some(v) => js_string(v) };
    let t = s.trim_start();
    let (neg, rest) = match t.chars().next() { Some('-') => (true, &t[1..]), Some('+') => (false, &t[1..]), _ => (false, t) };
    let digits: String = rest.chars().take_while(|c| c.is_ascii_digit()).collect();
    match digits.parse::<i64>() { Ok(n) => if neg { -n } else { n }, Err(_) => d }
}

/// Integer-valued floats as integers, recursively
fn normalize(v: Value) -> Value {
    match v {
        Value::Number(n) if n.is_f64() => js::number(n.as_f64().unwrap_or(0.0)),
        Value::Array(a) => Value::Array(a.into_iter().map(normalize).collect()),
        Value::Object(o) => Value::Object(o.into_iter().map(|(k, v)| (k, normalize(v))).collect()),
        v => v,
    }
}

fn pad(n: u32) -> String { format!("{n:02}") }
// presence timestamps look like 2026.11.01-21.40.05
fn queue_time() -> String {
    use chrono::{Datelike, Timelike};
    let d = chrono::Utc::now();
    format!("{}.{}.{}-{}.{}.{}", d.year(), pad(d.month()), pad(d.day()), pad(d.hour()), pad(d.minute()), pad(d.second()))
}

// `originals`: each overridden path's real value before Spectre first changed it
struct Tools { overrides: Map<String, Value>, keep: bool, originals: BTreeMap<String, Option<Value>>, gen: u64 }
static STATE: Lazy<Mutex<Tools>> = Lazy::new(|| Mutex::new(Tools { overrides: Map::new(), keep: true, originals: BTreeMap::new(), gen: 0 }));
// serializes presence writes
static APPLY: Lazy<tokio::sync::Mutex<()>> = Lazy::new(|| tokio::sync::Mutex::new(()));

fn overrides() -> Value { Value::Object(STATE.lock().unwrap().overrides.clone()) }

/// removes what `set_path` would have written for `p`
fn remove_path(obj: &mut Value, p: &str) {
    let mut keys: Vec<&str> = p.split('.').collect();
    let last = keys.pop().unwrap_or_default();
    let nested = !keys.is_empty() && matches!(get_path_keys(obj, &keys), Some(Value::Object(_)));
    let mut cur = Some(&mut *obj);
    if nested {
        for k in &keys { cur = match cur { Some(Value::Object(o)) => o.get_mut(*k), _ => None }; }
    }
    if let Some(Value::Object(o)) = cur { o.shift_remove(last); }
}

/// records the real (pre-override) value of every path not recorded yet, from presence data not yet overridden there
fn record_originals(originals: &mut BTreeMap<String, Option<Value>>, data: &Value, paths: impl IntoIterator<Item = String>) {
    for p in paths {
        if !originals.contains_key(&p) {
            let v = get_path(data, &resolved_path(data, &p)).cloned();
            originals.insert(p, v);
        }
    }
}

/// puts the recorded real values back
fn restore_originals(data: &mut Value, originals: &BTreeMap<String, Option<Value>>, applied: &Map<String, Value>) {
    for (p, orig) in originals {
        if let Some(a) = applied.get(p) {
            let current = get_path(data, &resolved_path(data, p)).cloned().map(normalize);
            if current != Some(normalize(a.clone())) { continue; }
        }
        match orig {
            Some(v) => set_path(data, p, v.clone()),
            None => remove_path(data, p),
        }
    }
}

// Spectre marker: friends running Spectre see this key in the private presence
fn marker_on(ctx: &Ctx) -> bool { crate::api::settings::load(ctx)["spectrePresence"] != json!(false) }
fn marker_version(ctx: &Ctx) -> String { ctx.app.as_ref().map(|a| a.package_info().version.to_string()).unwrap_or_else(|| "0".into()) }

async fn get_my_presence(ctx: &Ctx) -> Res<(Value, Value)> {
    let res = ctx.riot.local("get", "chat/v4/presences", None).await?;
    let puuid = ctx.riot.state().puuid;
    // the riot_client presence shares the puuid but has no private data
    let me = js::arr(&res["presences"]).into_iter()
        .find(|p| p["puuid"].as_str().map(str::to_string) == puuid && p["product"] == "valorant" && truthy(&p["private"]))
        .ok_or_else(|| msg("Valorant presence not found. Is the game running?"))?;
    let raw: String = js::s(&me["private"]).chars().filter(|c| !c.is_whitespace()).collect();
    let bytes = base64::engine::general_purpose::STANDARD.decode(&raw)
        .or_else(|_| base64::engine::general_purpose::STANDARD_NO_PAD.decode(raw.trim_end_matches('=')))
        .map_err(|e| msg(e.to_string()))?;
    let data: Value = serde_json::from_str(&String::from_utf8_lossy(&bytes))?;
    Ok((me, normalize(data)))
}

fn set_marker(ctx: &Ctx, data: &mut Value) {
    let (marker, version) = (marker_on(ctx), marker_version(ctx));
    if let Value::Object(o) = data {
        if marker { o.insert("spectre".into(), json!({ "v": version })); } else { o.shift_remove("spectre"); }
    }
}

async fn put_presence(ctx: &Ctx, presence: &Value, data: &Value) -> Res<()> {
    let private = base64::engine::general_purpose::STANDARD.encode(serde_json::to_string(data)?);
    ctx.riot.local("put", "chat/v2/me", Some(json!({
        "state": presence["state"],
        "private": private,
        "shared": { "actor": "", "details": "", "location": "", "product": "valorant", "time": now_ms() + 35000 },
    }))).await?;
    Ok(())
}

async fn apply_presence(ctx: &Ctx, force: bool) -> Res<()> {
    let _apply = APPLY.lock().await;
    let gen = STATE.lock().unwrap().gen;
    let (presence, mut data) = get_my_presence(ctx).await?;
    let entries: Vec<(String, Value)> = {
        let mut s = STATE.lock().unwrap();
        // A set / reset / keep change landed while the presence was read: this apply is stale
        if s.gen != gen { return Ok(()); }
        let entries: Vec<(String, Value)> = if force || s.keep { s.overrides.iter().map(|(k, v)| (k.clone(), v.clone())).collect() } else { Vec::new() };
        record_originals(&mut s.originals, &data, entries.iter().map(|(k, _)| k.clone()));
        entries
    };
    let marker = marker_on(ctx);
    let version = marker_version(ctx);
    let marker_ok = if marker { data["spectre"]["v"] == json!(version) } else { data.get("spectre").is_none() };
    if !force && marker_ok && entries.iter().all(|(p, v)| strict_eq(get_path(&data, &resolved_path(&data, p)), v)) { return Ok(()); }
    for (p, v) in entries { set_path(&mut data, &p, v); }
    set_marker(ctx, &mut data);
    if STATE.lock().unwrap().gen != gen { return Ok(()); }
    put_presence(ctx, &presence, &data).await?;
    ctx.emit("tools:applied", json!({ "overrides": overrides(), "at": now_ms() }));
    Ok(())
}

/// puts the real values back with one forced PUT
async fn restore_presence(ctx: &Ctx, originals: BTreeMap<String, Option<Value>>, applied: Map<String, Value>) -> Res<()> {
    let _apply = APPLY.lock().await;
    if originals.is_empty() { return Ok(()); }
    let Ok((presence, mut data)) = get_my_presence(ctx).await else { return Ok(()) };
    restore_originals(&mut data, &originals, &applied);
    set_marker(ctx, &mut data);
    put_presence(ctx, &presence, &data).await
}

async fn set(ctx: &Ctx, o: Vec<(&str, Value)>) -> Res<Value> {
    {
        let mut s = STATE.lock().unwrap();
        s.gen += 1;
        for (k, v) in o { s.overrides.insert(k.to_string(), v); }
    }
    apply_presence(ctx, true).await?;
    Ok(json!({ "overrides": overrides() }))
}

/// an explicit `null` argument: JS defaults (`= {}`) only replace undefined
fn null_arg(a: &Args) -> bool { !a.0.is_empty() && a.0[0].is_null() }
fn destructure_err(prop: &str) -> String {
    format!("Cannot destructure property '{prop}' of '(intermediate value)(intermediate value)(intermediate value)' as it is null.")
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    // Re-applies the overrides every 5 s
    if ctx.app.is_some() {
        let ctx = ctx.clone();
        crate::core::every(std::time::Duration::from_secs(5), std::time::Duration::from_secs(5), move || {
            let ctx = ctx.clone();
            async move {
                if !ctx.riot.connected() { return; }
                if let Err(e) = apply_presence(&ctx, false).await { println!("Presence re-apply error: {e}"); }
            }
        });
    }

    // current presence as friends see it (for the live preview) plus the active overrides
    reg.add("tools:state", |ctx, _| async move {
        let (current, error) = match get_my_presence(&ctx).await {
            Ok((_, d)) => (d, Value::Null),
            Err(e) => (Value::Null, json!(e.to_string())),
        };
        let keep = STATE.lock().unwrap().keep;
        Ok(json!({ "overrides": overrides(), "keep": keep, "current": current, "error": error }))
    });

    // keep off puts the real values back
    reg.add("tools:keep", |ctx, a: Args| async move {
        let keep = a.truthy(0);
        let restore = {
            let mut s = STATE.lock().unwrap();
            s.keep = keep;
            s.gen += 1;
            if keep { None } else { Some((std::mem::take(&mut s.originals), s.overrides.clone())) }
        };
        if let Some((originals, applied)) = restore {
            restore_presence(&ctx, originals, applied).await?;
            ctx.emit("tools:applied", json!({ "overrides": overrides(), "at": now_ms() }));
        }
        Ok(json!({ "keep": keep }))
    });

    reg.add("tools:reset", |ctx, _| async move {
        let (originals, applied) = {
            let mut s = STATE.lock().unwrap();
            s.gen += 1;
            (std::mem::take(&mut s.originals), std::mem::take(&mut s.overrides))
        };
        restore_presence(&ctx, originals, applied).await?;
        ctx.emit("tools:applied", json!({ "overrides": overrides(), "at": now_ms() }));
        Ok(json!({ "overrides": overrides() }))
    });

    reg.add("tools:rank", |ctx, a: Args| async move {
        let p = a.val(0);
        if null_arg(&a) { return Err(msg(destructure_err("tier"))); }
        let mut o = vec![("playerPresenceData.competitiveTier", json!(int(p.get("tier"), 0)))];
        if let Some(lb) = p.get("leaderboardPosition") { o.push(("playerPresenceData.leaderboardPosition", json!(int(Some(lb), 0).max(0)))); }
        set(&ctx, o).await
    });

    // account level / idle / card / title
    reg.add("tools:profile", |ctx, a: Args| async move {
        let p = a.val(0);
        if null_arg(&a) { return Err(msg(destructure_err("accountLevel"))); }
        let mut o = Vec::new();
        if let Some(v) = p.get("accountLevel") { o.push(("playerPresenceData.accountLevel", json!(int(Some(v), 1).max(1)))); }
        if let Some(v) = p.get("isIdle") { o.push(("isIdle", json!(truthy(v)))); }
        if truthy(&p["playerCardId"]) { o.push(("playerPresenceData.playerCardId", p["playerCardId"].clone())); }
        if let Some(v) = p.get("playerTitleId") { o.push(("playerPresenceData.playerTitleId", js::or(v, Value::Null))); }
        set(&ctx, o).await
    });

    reg.add("tools:premier", |ctx, a: Args| async move {
        let p = a.val(0);
        let mut roster_id = STATE.lock().unwrap().overrides.get("premierPresenceData.rosterId").cloned().unwrap_or(Value::Null);
        if !truthy(&roster_id) {
            if let Ok((_, d)) = get_my_presence(&ctx).await { roster_id = d["premierPresenceData"]["rosterId"].clone(); }
        }
        if null_arg(&a) { return Err(msg("Cannot read properties of null (reading 'rosterName')")); }
        let show_plating = truthy(&p["showPlating"]);
        set(&ctx, vec![
            ("premierPresenceData.rosterId", js::or(&roster_id, json!(uuid::Uuid::new_v4().to_string()))),
            ("premierPresenceData.rosterName", json!(js_string(&js::nullish(&p["rosterName"], json!(""))))),
            ("premierPresenceData.rosterTag", json!(js_string(&js::nullish(&p["rosterTag"], json!(""))))),
            ("premierPresenceData.division", json!(int(p.get("division"), 0))),
            ("premierPresenceData.score", json!(int(p.get("score"), 0))),
            ("premierPresenceData.showTag", json!(truthy(&p["showTag"]))),
            ("premierPresenceData.showPlating", json!(show_plating)),
            ("premierPresenceData.plating", json!(if show_plating { 1 } else { 0 })),
            ("premierPresenceData.showAura", json!(truthy(&p["showAura"]))),
        ]).await
    });

    // state: MENUS | QUEUE | PREGAME | INGAME | RANGE
    reg.add("tools:status", |ctx, a: Args| async move {
        let s = a.val(0);
        if null_arg(&a) { return Err(msg("Cannot read properties of null (reading 'state')")); }
        let state = js::or(&s["state"], json!("MENUS"));
        let queue = js::nullish(&s["queue"], json!(""));
        let range = state == "RANGE";
        let in_game = state == "PREGAME" || state == "INGAME" || range;
        let lp = if state == "QUEUE" { json!("MENUS") } else if range { json!("INGAME") } else { state.clone() };
        let custom = queue == "";
        let flow = if range { "ShootingRange" } else if custom { "CustomGame" } else if in_game || state == "QUEUE" { "Matchmaking" } else { "Invalid" };
        let mut map_path = js::or(&s["map"], json!(""));
        if range {
            let maps = ctx.riot.val_api("maps").await?;
            let found = js::arr(&maps).into_iter().find(|m| m["mapUrl"].as_str().is_some_and(|u| u.contains("Range"))).map(|m| m["mapUrl"].clone());
            map_path = js::or(&found.unwrap_or(Value::Null), map_path);
        }
        let max = match int(s.get("maxPartySize"), 5) { 0 => 5, m => m };
        let size = int(s.get("partySize"), 1).max(1).min(max);
        let ally = int(s.get("ally"), 0);
        let enemy = int(s.get("enemy"), 0);
        let match_map = if in_game { map_path } else { json!("") };
        set(&ctx, vec![
            ("matchPresenceData.sessionLoopState", lp.clone()),
            ("partyPresenceData.partyOwnerSessionLoopState", lp),
            ("matchPresenceData.queueId", queue.clone()),
            ("queueId", queue),
            ("matchPresenceData.provisioningFlow", json!(flow)),
            ("provisioningFlow", json!(flow)),
            ("partyPresenceData.partyOwnerProvisioningFlow", json!(flow)),
            ("matchPresenceData.matchMap", match_map.clone()),
            ("partyPresenceData.partyOwnerMatchMap", match_map),
            ("partyOwnerMatchScoreAllyTeam", json!(ally)),
            ("partyOwnerMatchScoreEnemyTeam", json!(enemy)),
            ("partyPresenceData.partyOwnerMatchScoreAllyTeam", json!(ally)),
            ("partyPresenceData.partyOwnerMatchScoreEnemyTeam", json!(enemy)),
            ("partyPresenceData.partyState", json!(if state == "QUEUE" { "MATCHMAKING" } else if custom && !in_game { "CUSTOM_GAME_SETUP" } else { "DEFAULT" })),
            ("partyPresenceData.queueEntryTime", json!(if state == "QUEUE" { queue_time() } else { "0001.01.01-00.00.00".to_string() })),
            ("partySize", json!(size)),
            ("maxPartySize", json!(max)),
            ("partyPresenceData.partySize", json!(size)),
            ("partyPresenceData.maxPartySize", json!(max)),
            ("partyPresenceData.partyAccessibility", json!(if truthy(&s["open"]) { "OPEN" } else { "CLOSED" })),
        ]).await
    });
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn restores_originals_and_drops_added_keys() {
        let real = json!({ "isIdle": false, "playerPresenceData": { "competitiveTier": 12, "accountLevel": 40 }, "partySize": 1 });
        let mut originals = BTreeMap::new();
        let paths = ["playerPresenceData.competitiveTier", "playerPresenceData.leaderboardPosition", "isIdle", "premierPresenceData.rosterName"];
        record_originals(&mut originals, &real, paths.iter().map(|p| p.to_string()));
        // A later record keeps the first (real) value
        record_originals(&mut originals, &json!({ "isIdle": true }), ["isIdle".to_string()]);
        assert_eq!(originals["isIdle"], Some(json!(false)));
        assert_eq!(originals["premierPresenceData.rosterName"], None);

        let mut applied = Map::new();
        applied.insert("playerPresenceData.competitiveTier".into(), json!(27));
        applied.insert("playerPresenceData.leaderboardPosition".into(), json!(5));
        applied.insert("isIdle".into(), json!(true));
        applied.insert("premierPresenceData.rosterName".into(), json!("Sample Squad"));
        let mut data = real.clone();
        for (p, v) in &applied { set_path(&mut data, p, v.clone()); }
        assert_eq!(data["rosterName"], json!("Sample Squad"));
        assert_eq!(data["playerPresenceData"]["leaderboardPosition"], json!(5));

        restore_originals(&mut data, &originals, &applied);
        assert_eq!(data, real);
    }

    #[test]
    fn keeps_newer_game_values() {
        let mut originals = BTreeMap::new();
        originals.insert("partySize".to_string(), Some(json!(1)));
        originals.insert("queueId".to_string(), None);
        let mut applied = Map::new();
        applied.insert("partySize".into(), json!(5));
        applied.insert("queueId".into(), json!("competitive"));
        // the game already published newer real values: leave them
        let mut data = json!({ "partySize": 2, "queueId": "unrated" });
        restore_originals(&mut data, &originals, &applied);
        assert_eq!(data, json!({ "partySize": 2, "queueId": "unrated" }));
    }
}
