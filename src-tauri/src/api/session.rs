// Session summary: when VALORANT closes, one Windows notification with the games played while it was open and, for
// ranked games, wins, losses and the RR gained or lost. Nothing is stored; the session is "since Spectre saw the game
// start", so Spectre has to be running (it sits in the tray by default) for the whole session to count.
use crate::core::error::Res;
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Value};
use std::sync::Mutex;
use std::time::Duration;

const TICK: Duration = Duration::from_secs(30);
/// Games that began up to this long before Spectre noticed the game still count (Spectre checks every 30 seconds).
const MARGIN_MS: i64 = 2 * 60 * 1000;

/// When the game was first seen running (ms), or None while it is closed.
static SINCE: Lazy<Mutex<Option<i64>>> = Lazy::new(|| Mutex::new(None));

async fn game_running(ctx: &Ctx) -> Option<bool> {
    let s = ctx.riot.local("get", "product-session/v1/external-sessions", None).await.ok()?;
    Some(s.as_object().map(|o| o.values().any(|v| v["productId"] == "valorant")).unwrap_or(false))
}

fn plural(n: i64, one: &str, many: &str) -> String { format!("{n} {}", if n == 1 { one } else { many }) }

/// The numbers for games that started at or after `since`.
async fn summary(ctx: &Ctx, since: i64) -> Res<Value> {
    let p = ctx.riot.puuid();
    let from = since - MARGIN_MS;
    let hist = ctx.riot.pd("get", &format!("match-history/v1/history/{p}?startIndex=0&endIndex=20"), None).await?;
    let games = js::arr(&hist["History"]).iter().filter(|h| js::num(&h["GameStartTime"]) as i64 >= from).count() as i64;
    let ups = ctx.riot.pd("get", &format!("mmr/v1/players/{p}/competitiveupdates?startIndex=0&endIndex=20&queue=competitive"), None).await
        .unwrap_or(Value::Null);
    let (mut wins, mut losses, mut rr) = (0i64, 0i64, 0i64);
    for m in js::arr(&ups["Matches"]).iter().filter(|m| js::num(&m["MatchStartTime"]) as i64 >= from) {
        let e = js::num(&m["RankedRatingEarned"]);
        if !e.is_finite() { continue; }
        if e > 0.0 { wins += 1 } else if e < 0.0 { losses += 1 }
        rr += e as i64;
    }
    Ok(json!({ "games": games, "wins": wins, "losses": losses, "rr": rr, "ranked": wins + losses }))
}

async fn announce(ctx: &Ctx, since: i64) {
    if !truthy(&super::settings::load(ctx)["sessionAlerts"]) { return; }
    let Ok(s) = summary(ctx, since).await else { return };
    let games = s["games"].as_i64().unwrap_or(0);
    if games == 0 { return; }
    let mut body = format!("{} played.", plural(games, "game", "games"));
    if s["ranked"].as_i64().unwrap_or(0) > 0 {
        let rr = s["rr"].as_i64().unwrap_or(0);
        body.push_str(&format!(" Ranked: {}, {}, {}{} RR.",
            plural(s["wins"].as_i64().unwrap_or(0), "win", "wins"), plural(s["losses"].as_i64().unwrap_or(0), "loss", "losses"),
            if rr > 0 { "+" } else { "" }, rr));
    }
    super::wishlist::notify(ctx, "Session summary", &body);
}

pub fn register(_reg: &mut Registry, ctx: &Ctx) {
    let c = ctx.clone();
    crate::core::every(Duration::from_secs(40), TICK, move || {
        let c = c.clone();
        async move {
            let st = c.riot.state();
            if !st.connected || st.puuid.as_deref().unwrap_or("").is_empty() { return; }
            let Some(running) = game_running(&c).await else { return };
            // Decide under the lock, then do the network work after releasing it.
            let ended = {
                let mut since = SINCE.lock().unwrap();
                match (running, *since) {
                    (true, None) => { *since = Some(now_ms()); None }
                    (false, Some(t)) => { *since = None; Some(t) }
                    _ => None,
                }
            };
            if let Some(t) = ended {
                // Give Riot a moment to file the last match before reading the history.
                tokio::time::sleep(Duration::from_secs(8)).await;
                announce(&c, t).await;
            }
        }
    });
}
