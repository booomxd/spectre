// Friend activity: snapshots your friends list and records who was added, removed or renamed since the last look.
// Stored per signed-in account in userData/friendlog.json as { [myPuuid]: { snapshot: { puuid: 'Name#Tag' }, events, lastScan } }.
use crate::api::tools::js_string;
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Ctx, Registry};
use futures::future::{BoxFuture, FutureExt, Shared};
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::sync::Mutex;
use std::time::Duration;

const SCAN_EVERY: Duration = Duration::from_secs(2 * 60);
const MAX_EVENTS: usize = 500;

fn load(ctx: &Ctx) -> Value { ctx.riot.read_store("friendlog", json!({})) }
/// `riot.state.puuid` as an object key (JS state starts with `puuid: null`, which becomes the key "null").
fn my_key(ctx: &Ctx) -> String { ctx.riot.state().puuid.unwrap_or_else(|| "null".into()) }
fn mine(ctx: &Ctx, all: &Value) -> Value {
    js::or(&all[my_key(ctx)], json!({ "snapshot": null, "events": [], "lastScan": null }))
}

type Scan = Shared<BoxFuture<'static, Res<Value>>>;
static SCANNING: Lazy<Mutex<Option<Scan>>> = Lazy::new(|| Mutex::new(None));

/// The account the Riot Client is signed in to right now, straight from the client.
async fn live_puuid(ctx: &Ctx) -> Option<String> {
    let s = ctx.riot.local("get", "chat/v1/session", None).await.ok()?;
    let p = js_string(&js::or(&s["puuid"], json!("")));
    if p.is_empty() { None } else { Some(p) }
}

async fn run_scan(ctx: &Ctx) -> Res<Value> {
    // Switching accounts: Spectre's cached puuid can lag behind the client for a moment, so the new account's
    // friends would be diffed against the old account's snapshot (hundreds of fake adds and removals). Only scan
    // when the client confirms the same account before and after reading the list.
    let key = my_key(ctx);
    if live_puuid(ctx).await.as_deref() != Some(key.as_str()) { return Ok(mine(ctx, &load(ctx))); }
    let res = ctx.riot.local("get", "chat/v4/friends", None).await?;
    if live_puuid(ctx).await.as_deref() != Some(key.as_str()) { return Ok(mine(ctx, &load(ctx))); }
    let mut now = Map::new();
    for f in js::arr(&js::or(&res["friends"], json!([]))) {
        if truthy(&f["puuid"]) {
            let name = format!("{}#{}", js_string(&js::or(&f["game_name"], json!(""))), js_string(&js::or(&f["game_tag"], json!(""))));
            now.insert(js_string(&f["puuid"]), json!(name));
        }
    }
    let mut all = load(ctx);
    let me = mine(ctx, &all);
    let snapshot = me["snapshot"].as_object().cloned();
    let snap_truthy = truthy(&me["snapshot"]);
    let snap_len = snapshot.as_ref().map_or(0, Map::len);
    // The Riot Client briefly reports an empty list while it starts; never read that as "everyone left".
    if now.is_empty() && snap_truthy && snap_len > 0 { return Ok(me); }
    let at = now_ms();
    let mut found: Vec<Value> = Vec::new();
    if snap_truthy {
        let snap = snapshot.clone().unwrap_or_default();
        for (puuid, name) in &now {
            match snap.get(puuid) {
                None => found.push(json!({ "type": "added", "puuid": puuid, "name": name, "at": at })),
                Some(old) if old != name && name != "#" => found.push(json!({ "type": "renamed", "puuid": puuid, "name": name, "from": old, "at": at })),
                _ => {}
            }
        }
        for (puuid, name) in &snap {
            if !now.contains_key(puuid) { found.push(json!({ "type": "removed", "puuid": puuid, "name": name, "at": at })); }
        }
    }
    // Keep a known name when the client hands back a blank one.
    for (puuid, name) in now.iter_mut() {
        if name == "#" {
            if let Some(old) = snapshot.as_ref().and_then(|s| s.get(puuid)).filter(|v| truthy(v)) { *name = old.clone(); }
        }
    }
    let mut events: Vec<Value> = found.iter().enumerate().map(|(i, e)| {
        let mut o = Map::new();
        o.insert("id".into(), json!(format!("{at}-{i}")));
        if let Some(e) = e.as_object() { for (k, v) in e { o.insert(k.clone(), v.clone()); } }
        Value::Object(o)
    }).collect();
    events.extend(js::arr(&me["events"]));
    events.truncate(MAX_EVENTS);
    let next = json!({ "snapshot": now, "lastScan": at, "events": events });
    if !all.is_object() { all = json!({}); }
    all[key.as_str()] = next.clone();
    ctx.riot.write_store("friendlog", &all)?;
    if !found.is_empty() { ctx.emit("friendlog:changed", json!({ "count": found.len() })); }
    Ok(next)
}

async fn scan(ctx: &Ctx) -> Res<Value> {
    let st = ctx.riot.state();
    if !st.connected || st.puuid.as_deref().unwrap_or("").is_empty() { return Err(msg("Waiting for the Riot Client")); }
    let fut = {
        let mut g = SCANNING.lock().unwrap();
        match g.as_ref() {
            Some(f) => f.clone(),
            None => {
                let ctx = ctx.clone();
                let f = async move {
                    let r = run_scan(&ctx).await;
                    *SCANNING.lock().unwrap() = None;
                    r
                }.boxed().shared();
                *g = Some(f.clone());
                f
            }
        }
    };
    fut.await
}

fn view(me: &Value) -> Value {
    let mut o = Map::new();
    if let Some(e) = me.get("events") { o.insert("events".into(), e.clone()); }
    if let Some(l) = me.get("lastScan") { o.insert("lastScan".into(), l.clone()); }
    o.insert("tracking".into(), json!(truthy(&me["snapshot"])));
    o.insert("friends".into(), json!(if truthy(&me["snapshot"]) { me["snapshot"].as_object().map_or(0, Map::len) } else { 0 }));
    Value::Object(o)
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("friendlog:list", |ctx, _| async move { Ok(view(&mine(&ctx, &load(&ctx)))) });
    reg.add("friendlog:scan", |ctx, _| async move { Ok(view(&scan(&ctx).await?)) });
    reg.add("friendlog:clear", |ctx, _| async move {
        let mut all = load(&ctx);
        let key = my_key(&ctx);
        if all[&key].is_object() {
            all[&key]["events"] = json!([]);
            ctx.riot.write_store("friendlog", &all)?;
        }
        Ok(view(&mine(&ctx, &all)))
    });

    let c = ctx.clone();
    crate::core::spawn(async move {
        tokio::time::sleep(Duration::from_secs(15)).await;
        let _ = scan(&c).await;
    });
    let c = ctx.clone();
    crate::core::every(SCAN_EVERY, SCAN_EVERY, move || {
        let c = c.clone();
        async move { let _ = scan(&c).await; }
    });
}
