// Competitive leaderboard for the player's shard and the current act. Port of public/api/leaderboard.js.
use crate::api::known;
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::collections::HashSet;
use std::sync::Mutex;

#[derive(Clone)]
struct Season { id: Value, name: Value, at: i64 }

static SEASON_CACHE: Lazy<Mutex<Option<Season>>> = Lazy::new(|| Mutex::new(None));

async fn current_season(ctx: &Ctx) -> Res<Season> {
    if let Some(s) = SEASON_CACHE.lock().unwrap().as_ref() {
        if now_ms() - s.at < 600000 { return Ok(s.clone()); }
    }
    let (mut id, mut name) = (Value::Null, Value::Null);
    if let Ok(c) = ctx.riot.shared("get", "content-service/v3/content", None).await {
        if let Some(act) = js::arr(&c["Seasons"]).into_iter().find(|s| truthy(&s["IsActive"]) && s["Type"] == "act") {
            id = act.get("ID").cloned().unwrap_or(Value::Null);
            name = act.get("Name").cloned().unwrap_or(Value::Null);
        }
    }
    if !truthy(&id) {
        let seasons = ctx.riot.val_api("seasons").await?;
        let now = now_ms();
        let act = js::arr(&seasons).into_iter().filter(|s| {
            s["type"] == "EAresSeasonType::Act"
                && js::parse_date(&s["startTime"]).is_some_and(|t| t <= now)
                && js::parse_date(&s["endTime"]).is_some_and(|t| t > now)
        }).last();
        let Some(act) = act else { return Err(msg("Could not determine the current act")) };
        id = act["uuid"].clone();
        name = act["displayName"].clone();
    }
    let s = Season { id, name, at: now_ms() };
    *SEASON_CACHE.lock().unwrap() = Some(s.clone());
    Ok(s)
}

/// JS template-literal text of a value (`${v}`).
fn tpl(v: &Value) -> String {
    match v {
        Value::Null => "null".into(),
        Value::String(s) => s.clone(),
        Value::Number(n) => n.as_f64().map(|f| js::number(f).to_string()).unwrap_or_else(|| n.to_string()),
        Value::Bool(b) => b.to_string(),
        Value::Array(_) => v.as_array().unwrap().iter().map(|x| if x.is_null() { String::new() } else { tpl(x) }).collect::<Vec<_>>().join(","),
        Value::Object(_) => "[object Object]".into(),
    }
}

/// `{ k: src.k, ... }` where a missing source property stays undefined (left out of the JSON), like JS.
fn put(o: &mut Map<String, Value>, k: &str, v: Option<&Value>) { if let Some(v) = v { o.insert(k.into(), v.clone()); } }

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("leaderboard:get", |ctx, a: Args| async move {
        let opts = a.val(0);
        // `({ start = 0, size = 100 } = {})` throws on an explicit null
        if !a.0.is_empty() && opts.is_null() { return Err(msg("Cannot read properties of null (reading 'start')")); }
        let start = opts.get("start").cloned().unwrap_or(json!(0));
        let size = opts.get("size").cloned().unwrap_or(json!(100));
        let season = current_season(&ctx).await?;
        // Math.min(Math.max(size, 1), 200)
        let sz = match &size { Value::Number(n) => n.as_f64().unwrap_or(f64::NAN), Value::String(s) => s.trim().parse().unwrap_or(f64::NAN), Value::Bool(b) => if *b { 1.0 } else { 0.0 }, Value::Null => 0.0, _ => f64::NAN };
        let sz = if sz.is_nan() { "NaN".to_string() } else { js::number(sz.max(1.0).min(200.0)).to_string() };
        let shard = ctx.riot.state().shard;
        let shard_s = shard.clone().unwrap_or_else(|| "null".into());
        let res = ctx.riot.pd("get", &format!("mmr/v1/leaderboards/affinity/{shard_s}/queue/competitive/season/{}?startIndex={}&size={sz}", tpl(&season.id), tpl(&start)), None).await?;
        let (mut ok, mut fr) = (HashSet::new(), HashSet::new());
        if let Ok(k) = known::known_puuids(&ctx).await {
            ok = k;
            if let Ok(f) = known::friend_puuids(&ctx).await { fr = f; }
        }
        // Riot's response as-is; puuids are only passed on for you and your friends/party (click-through).
        let players: Vec<Value> = js::arr(&res["Players"]).iter().map(|p| {
            let anon = truthy(&p["IsAnonymized"]);
            let pu = p.get("puuid").and_then(Value::as_str);
            let has = |set: &HashSet<String>| pu.is_some_and(|x| set.contains(x));
            let mut o = Map::new();
            if !anon { put(&mut o, "puuid", p.get("puuid")); }
            o.insert("known".into(), json!(has(&ok)));
            o.insert("friend".into(), json!(has(&fr)));
            put(&mut o, "rank", p.get("leaderboardRank"));
            put(&mut o, "cardId", p.get("PlayerCardID"));
            o.insert("anonymous".into(), json!(anon));
            if anon { o.insert("gameName".into(), json!("")); } else { put(&mut o, "gameName", p.get("gameName")); }
            if anon { o.insert("tagLine".into(), json!("")); } else { put(&mut o, "tagLine", p.get("tagLine")); }
            o.insert("prefix".into(), js::or(&p["prefix"], json!("")));
            put(&mut o, "rr", p.get("rankedRating"));
            put(&mut o, "wins", p.get("numberOfWins"));
            put(&mut o, "tier", p.get("competitiveTier"));
            o.insert("banned".into(), json!(truthy(&p["IsBanned"])));
            Value::Object(o)
        }).collect();
        let mut you = Value::Null;
        if start.as_f64() == Some(0.0) {
            if let Ok(mmr) = ctx.riot.pd("get", &format!("mmr/v1/players/{}", ctx.riot.puuid()), None).await {
                let s = &mmr["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"][tpl(&season.id).as_str()];
                if s["LeaderboardRank"].as_f64().is_some_and(|r| r > 0.0) {
                    let mut o = Map::new();
                    put(&mut o, "rank", s.get("LeaderboardRank"));
                    put(&mut o, "rr", s.get("RankedRating"));
                    put(&mut o, "wins", s.get("NumberOfWins"));
                    put(&mut o, "tier", s.get("CompetitiveTier"));
                    you = Value::Object(o);
                }
            }
        }
        Ok(json!({
            "season": { "id": season.id, "name": season.name }, "total": js::or(&res["totalPlayers"], json!(0)),
            "start": start, "players": players, "you": you, "shard": shard,
        }))
    });
}
