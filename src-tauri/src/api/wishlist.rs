// Store wishlist: skins you want, and a Windows notification when one turns up in your daily offers, the Night Market
// or a featured bundle. Stored in userData/wishlist.json as { items: [{ id, name }], notified: [keys] }, where id is
// the skin's first level uuid (what the store lists) and a key marks one alert per account, item and store rotation.
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::sync::atomic::{AtomicI64, Ordering};
use std::sync::Mutex;
use std::time::Duration;

const TICK: Duration = Duration::from_secs(5 * 60);
const MAX_ITEMS: usize = 100;

/// When the store is next worth reading (ms). 0 = as soon as the Riot Client is connected.
static NEXT_CHECK: AtomicI64 = AtomicI64::new(0);
/// The account the last check was for, so switching accounts checks again straight away.
static LAST_PUUID: Lazy<Mutex<String>> = Lazy::new(|| Mutex::new(String::new()));

fn load(ctx: &Ctx) -> Value {
    let v = ctx.riot.read_store("wishlist", json!({}));
    if v.is_object() { v } else { json!({}) }
}
fn id_of(v: &Value) -> String { v.as_str().unwrap_or("").trim().to_lowercase() }

/// A Windows notification from Spectre (does nothing in the command-line helper).
pub fn notify(ctx: &Ctx, title: &str, body: &str) {
    use tauri_plugin_notification::NotificationExt;
    if let Some(app) = &ctx.app { let _ = app.notification().builder().title(title).body(body).show(); }
}

/// Reads the store and returns the wishlist items on offer right now. New ones raise one notification.
async fn check(ctx: &Ctx) -> Res<Value> {
    let st = ctx.riot.state();
    let puuid = st.puuid.clone().unwrap_or_default();
    if !st.connected || puuid.is_empty() { return Err(msg("Waiting for the Riot Client")); }
    let mut data = load(ctx);
    let wanted = js::arr(&data["items"]);
    *LAST_PUUID.lock().unwrap() = puuid.clone();
    if wanted.is_empty() {
        NEXT_CHECK.store(now_ms() + 6 * 3600 * 1000, Ordering::SeqCst);
        return Ok(json!({ "hits": [] }));
    }

    let s = super::store::storefront(ctx).await?;
    let secs = |v: &Value| { let n = js::num(v); if n.is_finite() && n > 0.0 { n as i64 } else { 0 } };
    // (item id, where it is, seconds until that part of the store changes)
    let mut offers: Vec<(String, &str, i64)> = Vec::new();
    let sp = &s["SkinsPanelLayout"];
    let daily_left = secs(&sp["SingleItemOffersRemainingDurationInSeconds"]);
    let daily = js::arr(&sp["SingleItemStoreOffers"]);
    if daily.is_empty() {
        for id in js::arr(&sp["SingleItemOffers"]) { offers.push((id_of(&id), "daily", daily_left)); }
    } else {
        for o in &daily { offers.push((id_of(&o["Rewards"][0]["ItemID"]), "daily", daily_left)); }
    }
    let nm = &s["BonusStore"];
    let nm_left = secs(&nm["BonusStoreRemainingDurationInSeconds"]);
    for o in js::arr(&nm["BonusStoreOffers"]) { offers.push((id_of(&o["Offer"]["Rewards"][0]["ItemID"]), "night", nm_left)); }
    let fb = &s["FeaturedBundle"];
    let bundles = if truthy(&fb["Bundles"]) { js::arr(&fb["Bundles"]) } else if truthy(&fb["Bundle"]) { vec![fb["Bundle"].clone()] } else { vec![] };
    for b in &bundles {
        let left = secs(&b["DurationRemainingInSeconds"]);
        for i in js::arr(&b["Items"]) { offers.push((id_of(&i["Item"]["ItemID"]), "bundle", left)); }
    }

    let now_s = now_ms() / 1000;
    let mut notified: Vec<String> = js::arr(&data["notified"]).iter().filter_map(|v| v.as_str().map(String::from)).collect();
    let mut hits: Vec<Value> = Vec::new();
    let mut fresh: Vec<String> = Vec::new();
    for w in &wanted {
        let id = id_of(&w["id"]);
        if id.is_empty() { continue; }
        for (oid, place, left) in &offers {
            if *oid != id { continue; }
            hits.push(json!({ "id": id, "name": w["name"], "where": place, "secondsLeft": left }));
            // One alert per account, item and rotation: the rotation is named by the hour it ends.
            let key = format!("{puuid}:{id}:{place}:{}", (now_s + left + 1800) / 3600);
            if !notified.contains(&key) {
                notified.push(key);
                let name = w["name"].as_str().unwrap_or("A skin").to_string();
                if !fresh.contains(&name) { fresh.push(name); }
            }
        }
    }
    if !fresh.is_empty() {
        let n = notified.len();
        if n > 300 { notified.drain(..n - 300); }
        data["notified"] = json!(notified);
        ctx.riot.write_store("wishlist", &data)?;
        if truthy(&super::settings::load(ctx)["wishlistAlerts"]) {
            let body = if fresh.len() == 1 { format!("{} is in your store right now.", fresh[0]) }
                else { format!("{} wishlist skins are in your store: {}.", fresh.len(), fresh.join(", ")) };
            notify(ctx, "On your wishlist", &body);
        }
        ctx.emit("wishlist:hit", json!({ "names": fresh }));
    }
    // Look again just after the daily offers change, or in six hours at the latest.
    let wait = if daily_left > 0 { (daily_left + 90).min(6 * 3600) } else { 6 * 3600 };
    NEXT_CHECK.store(now_ms() + wait * 1000, Ordering::SeqCst);
    Ok(json!({ "hits": hits }))
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("wishlist:list", |ctx, _| async move { Ok(Value::Array(js::arr(&load(&ctx)["items"]))) });

    // Adds the skin, or removes it if it is already on the list. Argument: { id, name }.
    reg.add("wishlist:toggle", |ctx, a: Args| async move {
        let arg = a.0.first().cloned().unwrap_or(Value::Null);
        let id = id_of(&arg["id"]);
        if id.is_empty() { return Err(msg("Missing skin id")); }
        let mut data = load(&ctx);
        let mut items = js::arr(&data["items"]);
        let before = items.len();
        items.retain(|i| id_of(&i["id"]) != id);
        if items.len() == before {
            if items.len() >= MAX_ITEMS { return Err(msg("Your wishlist is full")); }
            let name: String = arg["name"].as_str().unwrap_or("Skin").chars().take(80).collect();
            items.push(json!({ "id": id, "name": name, "at": now_ms() }));
        }
        data["items"] = json!(items);
        ctx.riot.write_store("wishlist", &data)?;
        NEXT_CHECK.store(0, Ordering::SeqCst);
        ctx.emit("wishlist:changed", data["items"].clone());
        Ok(data["items"].clone())
    });

    reg.add("wishlist:check", |ctx, _| async move { check(&ctx).await });

    let c = ctx.clone();
    crate::core::every(Duration::from_secs(45), TICK, move || {
        let c = c.clone();
        async move {
            let st = c.riot.state();
            let puuid = st.puuid.clone().unwrap_or_default();
            if !st.connected || puuid.is_empty() { return; }
            let switched = *LAST_PUUID.lock().unwrap() != puuid;
            if switched || now_ms() >= NEXT_CHECK.load(Ordering::SeqCst) { let _ = check(&c).await; }
        }
    });
}
