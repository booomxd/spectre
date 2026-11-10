// In-app announcements. The list is a small JSON file on the Spectre website (docs/announcements.json), so a new
// announcement goes live for every user by editing that file and pushing; no app release is needed.
// The app only downloads this one file; nothing is sent from the user's PC.
use crate::core::error::Res;
use crate::core::riot::{now_ms, send};
use crate::core::{js, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::Duration;

const URL: &str = "https://spectreclient.pages.dev/announcements.json";
static CACHE: Lazy<Mutex<(i64, Vec<Value>)>> = Lazy::new(|| Mutex::new((0, Vec::new())));

fn version(ctx: &Ctx) -> String {
    ctx.app.as_ref().map(|a| a.package_info().version.to_string()).unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string())
}

/// The file is either `[ {...}, ... ]` or `{ "items": [ ... ] }`. Anything else (a missing file, the site's HTML
/// fallback, a network error) means no announcements, never an error shown to the user.
async fn fetch(ctx: &Ctx) -> Vec<Value> {
    {
        let c = CACHE.lock().unwrap();
        if c.0 != 0 && now_ms() - c.0 < 20 * 60 * 1000 { return c.1.clone(); }
    }
    let req = ctx.riot.http().get(format!("{URL}?t={}", now_ms() / 60000))
        .header("User-Agent", "Spectre").header("Cache-Control", "no-cache").timeout(Duration::from_secs(8));
    let items = match send(req).await {
        Ok(Value::Array(a)) => a,
        Ok(v) if v["items"].is_array() => js::arr(&v["items"]),
        _ => Vec::new(),
    };
    // Keep only well-formed entries: an id and a title are required.
    let items: Vec<Value> = items.into_iter()
        .filter(|a| a["id"].as_str().is_some_and(|s| !s.is_empty()) && a["title"].as_str().is_some_and(|s| !s.is_empty()))
        .take(10).collect();
    *CACHE.lock().unwrap() = (now_ms(), items.clone());
    items
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    // Returns { items, version }. Date windows, version ranges and dismissals are applied in the app.
    reg.add("announce:list", |ctx, _| async move {
        let items: Res<Vec<Value>> = Ok(fetch(&ctx).await);
        Ok(json!({ "items": items?, "version": version(&ctx) }))
    });
}
