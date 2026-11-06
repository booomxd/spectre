// Rank and scouting for a player by puuid: current/peak rank and act history from the MMR endpoint, plus recent
// competitive form from competitive updates and match details. Results carry no names, match ids or teammates, so
// they are safe to show for streamer-mode players. One shared cache for every module.
use crate::core::error::Res;
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Ctx};
use futures::future::{BoxFuture, FutureExt, Shared};
use futures::StreamExt;
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::{Arc, Mutex};

// Before Episode 5 Act 1 (when Ascendant was added) tiers 21-24 were Immortal 1-3 and Radiant; today they are 24-27.
const ASCENDANT_START: i64 = 1655769600000; // Date.parse('2022-06-21T00:00:00Z')
// A death counts as traded (the T in KAST) if a teammate kills the killer within this window.
const TRADE_MS: f64 = 5000.0;

/// Current act id, plus the ids of acts from before Ascendant existed (all lowercase).
#[derive(Clone, Default)]
pub struct Acts {
    pub current: Option<String>,
    pub old: HashSet<String>,
}

static ACT_CACHE: Lazy<Mutex<Option<(i64, Acts)>>> = Lazy::new(|| Mutex::new(None));

/// Cached 10 minutes (1 minute when incomplete).
pub async fn acts(ctx: &Ctx) -> Acts {
    if let Some((at, a)) = ACT_CACHE.lock().unwrap().as_ref() {
        if now_ms() - at < 600000 { return a.clone(); }
    }
    let mut current: Option<String> = None;
    let mut old = HashSet::new();
    if let Ok(c) = ctx.riot.shared("get", "content-service/v3/content", None).await {
        let s = js::arr(&c["Seasons"]).into_iter().find(|s| truthy(&s["IsActive"]) && s["Type"] == "act");
        current = s.and_then(|s| s["ID"].as_str().map(str::to_lowercase)).filter(|x| !x.is_empty());
    }
    if let Ok(list) = ctx.riot.val_api("seasons").await {
        let now = now_ms();
        // A missing uuid throws in JS and ends the loop; mirror that with a labelled break.
        'seasons: for s in js::arr(&list) {
            if s["type"] != "EAresSeasonType::Act" { continue; }
            let start = js::parse_date(&s["startTime"]);
            if start.is_some_and(|t| t < ASCENDANT_START) {
                match s["uuid"].as_str() { Some(u) => { old.insert(u.to_lowercase()); } None => break 'seasons }
            }
            if current.is_none() && start.is_some_and(|t| t <= now) && js::parse_date(&s["endTime"]).is_some_and(|t| t > now) {
                match s["uuid"].as_str() { Some(u) => current = Some(u.to_lowercase()), None => break 'seasons }
            }
        }
    }
    // Incomplete data is retried after a minute rather than kept for ten.
    let at = if current.is_some() && !old.is_empty() { now_ms() } else { now_ms() - 540000 };
    let a = Acts { current, old };
    *ACT_CACHE.lock().unwrap() = Some((at, a.clone()));
    a
}

/// `Math.round` keeping NaN as null, like JSON.stringify does.
fn rnd(x: f64) -> Value { js::number(js::round(x)) }

/// { current: { tier, rr, seasonId, wins, games }, peak: { tier, seasonId }, history: [...] }. Errors if MMR fails.
pub async fn rank(ctx: &Ctx, puuid: &str) -> Res<Value> {
    let path = format!("mmr/v1/players/{puuid}");
    let (d, a) = tokio::join!(ctx.riot.pd("get", &path, None), acts(ctx));
    let d = d?;
    let fix = |id: &str, t: f64| if a.old.contains(id) && t > 20.0 { t + 3.0 } else { t };
    let seasons: Vec<(String, Value)> = js::entries(&d["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"])
        .into_iter().map(|(id, s)| (id.to_lowercase(), s)).collect();
    let mut peak_tier = 0.0_f64;
    let mut peak = json!({ "tier": 0, "seasonId": null });
    let mut history = Vec::new();
    for (id, s) in &seasons {
        let mut top = js::num(&js::or(&s["CompetitiveTier"], json!(0)));
        for (k, _) in js::entries(&s["WinsByTier"]) {
            // Number(key): NaN for non-numeric keys, which poisons Math.max like in JS.
            let n = if k.trim().is_empty() { 0.0 } else { k.trim().parse::<f64>().unwrap_or(f64::NAN) };
            top = if n.is_nan() || top.is_nan() { f64::NAN } else { top.max(n) };
        }
        let top = fix(id, top);
        if top > peak_tier { peak_tier = top; peak = json!({ "tier": js::number(top), "seasonId": id }); }
        if truthy(&s["NumberOfGames"]) {
            history.push(json!({
                "seasonId": id, "tier": js::number(fix(id, js::num(&js::or(&s["CompetitiveTier"], json!(0))))),
                "rr": js::or(&s["RankedRating"], json!(0)), "peak": js::number(top),
                "wins": js::or(&s["NumberOfWins"], json!(0)), "games": s["NumberOfGames"].clone(),
            }));
        }
    }
    let current = if let Some(cur_id) = &a.current {
        // Only this act counts: someone who hasn't played or finished placements this act is Unranked.
        let cur = seasons.iter().find(|(id, _)| id == cur_id).map(|(_, s)| s.clone()).unwrap_or(Value::Null);
        json!({
            "tier": js::or(&cur["CompetitiveTier"], json!(0)), "rr": js::or(&cur["RankedRating"], json!(0)), "seasonId": cur_id,
            "wins": js::or(&cur["NumberOfWins"], json!(0)), "games": js::or(&cur["NumberOfGames"], json!(0)),
        })
    } else {
        let l = &d["LatestCompetitiveUpdate"];
        let sid = l["SeasonID"].as_str().map(str::to_lowercase).filter(|x| !x.is_empty());
        json!({
            "tier": js::or(&l["TierAfterUpdate"], json!(0)), "rr": js::or(&l["RankedRatingAfterUpdate"], json!(0)),
            "seasonId": sid, "wins": 0, "games": 0,
        })
    };
    if js::num(&current["tier"]) > peak_tier { peak = json!({ "tier": current["tier"].clone(), "seasonId": current["seasonId"].clone() }); }
    Ok(json!({ "current": current, "peak": peak, "history": history }))
}

// Match details trimmed to what scouting needs; matches never change, so they are cached.
struct Kill { killer: Value, victim: Value, assists: Vec<Value>, t: f64 }
struct Round { kills: Vec<Kill>, damage: HashMap<String, (f64, f64, f64)> }
struct Team { id: Value, won: bool, rounds: Value }
struct Player { id: Value, team: Value, agent: String, stats: Value }
struct Slim { map_id: Value, queue: Value, start: Value, teams: Vec<Team>, players: Vec<Player>, rounds: Vec<Round> }

type MatchFut = Shared<BoxFuture<'static, Result<Arc<Slim>, crate::core::error::Error>>>;
static MATCH_CACHE: Lazy<Mutex<(HashMap<String, MatchFut>, VecDeque<String>)>> = Lazy::new(|| Mutex::new((HashMap::new(), VecDeque::new())));

fn get_match(ctx: &Ctx, id: String) -> MatchFut {
    let mut c = MATCH_CACHE.lock().unwrap();
    if let Some(f) = c.0.get(&id) { return f.clone(); }
    let (ctx2, id2) = (ctx.clone(), id.clone());
    let fut: MatchFut = async move {
        let r = ctx2.riot.pd("get", &format!("match-details/v1/matches/{id2}"), None).await.map(|m| Arc::new(slim(&m)));
        if r.is_err() {
            let mut c = MATCH_CACHE.lock().unwrap();
            c.0.remove(&id2);
            c.1.retain(|k| k != &id2);
        }
        r
    }.boxed().shared();
    c.0.insert(id.clone(), fut.clone());
    c.1.push_back(id);
    if c.0.len() > 150 {
        if let Some(first) = c.1.pop_front() { c.0.remove(&first); }
    }
    fut
}

fn slim(m: &Value) -> Slim {
    let or0 = |v: &Value| js::or(v, json!(0));
    Slim {
        map_id: js::or(&m["matchInfo"]["mapId"], json!("")), queue: js::or(&m["matchInfo"]["queueID"], json!("")),
        start: or0(&m["matchInfo"]["gameStartMillis"]),
        teams: js::arr(&m["teams"]).iter().map(|t| Team { id: t["teamId"].clone(), won: truthy(&t["won"]), rounds: or0(&t["roundsWon"]) }).collect(),
        players: js::arr(&m["players"]).iter().filter(|p| !truthy(&p["isObserver"]))
            .map(|p| Player { id: p["subject"].clone(), team: p["teamId"].clone(), agent: js::lower(&p["characterId"]), stats: js::or(&p["stats"], js::obj()) }).collect(),
        rounds: js::arr(&m["roundResults"]).iter().map(|r| {
            let ps = js::arr(&r["playerStats"]);
            let mut kills: Vec<Kill> = ps.iter().flat_map(|s| js::arr(&s["kills"])).map(|k| Kill {
                killer: k["killer"].clone(), victim: k["victim"].clone(), assists: js::arr(&js::or(&k["assistants"], json!([]))),
                t: js::num(&js::nullish(&k["timeSinceRoundStartMillis"], js::nullish(&k["roundTime"], json!(0)))),
            }).collect();
            kills.sort_by(|a, b| a.t.partial_cmp(&b.t).unwrap_or(std::cmp::Ordering::Equal));
            let mut damage = HashMap::new();
            for s in &ps {
                let mut acc = (0.0, 0.0, 0.0);
                for d in js::arr(&s["damage"]) {
                    let (h, b, l) = (js::num(&d["headshots"]), js::num(&d["bodyshots"]), js::num(&d["legshots"]));
                    acc = (acc.0 + js::num(&d["damage"]), acc.1 + h, acc.2 + h + b + l);
                }
                let key = s["subject"].as_str().map(str::to_string).unwrap_or_else(|| "undefined".into());
                damage.insert(key, acc);
            }
            Round { kills, damage }
        }).collect(),
    }
}

// One player's line for one match. No match id or other players are included.
struct Line { v: Map<String, Value>, kills: f64, deaths: f64, assists: f64, acs: f64, adr: f64, fb: f64, win: bool, loss: bool, agent: String, head: f64, shots: f64, kast: f64, rounds: f64 }

fn summarize(m: &Slim, puuid: &str, update: &Value) -> Option<Line> {
    let me = m.players.iter().find(|p| p.id == puuid)?;
    let team_of = |id: &Value| m.players.iter().filter(|p| &p.id == id).last().map(|p| p.team.clone()).unwrap_or(Value::Null);
    let (mut dmg, mut head, mut shots, mut fb, mut kast) = (0.0, 0.0, 0.0, 0.0, 0.0);
    for r in &m.rounds {
        if let Some(d) = r.damage.get(puuid) { dmg += d.0; head += d.1; shots += d.2; }
        if r.kills.first().is_some_and(|k| k.killer == puuid) { fb += 1.0; }
        let death = r.kills.iter().find(|k| k.victim == puuid);
        let traded = death.is_some_and(|d| r.kills.iter().any(|k| k.victim == d.killer && team_of(&k.killer) == me.team && k.t >= d.t && k.t - d.t <= TRADE_MS));
        if death.is_none() || traded || r.kills.iter().any(|k| k.killer == puuid || k.assists.iter().any(|a| a == puuid)) { kast += 1.0; }
    }
    let st = &me.stats;
    let n = if !m.rounds.is_empty() { m.rounds.len() as f64 } else if truthy(&st["roundsPlayed"]) { js::num(&st["roundsPlayed"]) } else { 1.0 };
    let mine = m.teams.iter().find(|t| t.id == me.team);
    let other = m.teams.iter().find(|t| t.id != me.team);
    let result = if m.teams.len() == 2 && !m.teams.iter().any(|t| t.won) { "draw" } else if mine.is_some_and(|t| t.won) { "win" } else { "loss" };
    let score = match (mine, other) { (Some(a), Some(b)) => json!({ "us": a.rounds, "them": b.rounds }), _ => Value::Null };
    let or0 = |v: &Value| js::or(v, json!(0));
    let (kills, deaths, assists) = (or0(&st["kills"]), or0(&st["deaths"]), or0(&st["assists"]));
    let acs = js::round(js::num(&or0(&st["score"])) / n);
    let adr = js::round(dmg / n);
    let v = json!({
        "start": m.start, "mapId": m.map_id, "queue": m.queue, "agent": me.agent,
        "result": result, "score": score,
        "kills": kills, "deaths": deaths, "assists": assists,
        "acs": js::number(acs), "adr": js::number(adr), "hs": if shots != 0.0 { rnd(head / shots * 100.0) } else { Value::Null },
        "kast": rnd(kast / n * 100.0), "fb": js::number(fb), "rr": js::nullish(&update["RankedRatingEarned"], Value::Null),
    });
    Some(Line {
        v: v.as_object().cloned().unwrap_or_default(), kills: js::num(&kills), deaths: js::num(&deaths), assists: js::num(&assists),
        acs, adr, fb, win: result == "win", loss: result == "loss", agent: me.agent.clone(), head, shots, kast, rounds: n,
    })
}

fn aggregate(ms: &[Line]) -> Value {
    if ms.is_empty() { return Value::Null; }
    let sum = |f: &dyn Fn(&Line) -> f64| ms.iter().map(f).sum::<f64>();
    let (kills, deaths, assists) = (sum(&|m| m.kills), sum(&|m| m.deaths), sum(&|m| m.assists));
    let (rounds, shots) = (sum(&|m| m.rounds), sum(&|m| m.shots));
    json!({
        "matches": ms.len(), "wins": ms.iter().filter(|m| m.win).count(), "losses": ms.iter().filter(|m| m.loss).count(),
        "kd": js::number(if deaths != 0.0 { kills / deaths } else { kills }),
        "kda": js::number(if deaths != 0.0 { (kills + assists) / deaths } else { kills + assists }),
        "acs": rnd(sum(&|m| m.acs * m.rounds) / rounds), "adr": rnd(sum(&|m| m.adr * m.rounds) / rounds),
        "hs": if shots != 0.0 { rnd(sum(&|m| m.head) / shots * 100.0) } else { Value::Null },
        "kast": rnd(sum(&|m| m.kast) / rounds * 100.0), "fb": js::number(sum(&|m| m.fb)),
    })
}

fn top_agents(ms: &[Line]) -> Value {
    // (agent, games, wins, kills, deaths, score, rounds) in first-seen order, like Object.values.
    let mut by: Vec<(String, f64, f64, f64, f64, f64, f64)> = Vec::new();
    for m in ms {
        let i = match by.iter().position(|a| a.0 == m.agent) { Some(i) => i, None => { by.push((m.agent.clone(), 0.0, 0.0, 0.0, 0.0, 0.0, 0.0)); by.len() - 1 } };
        let a = &mut by[i];
        a.1 += 1.0; if m.win { a.2 += 1.0; }
        a.3 += m.kills; a.4 += m.deaths; a.5 += m.acs * m.rounds; a.6 += m.rounds;
    }
    by.sort_by(|x, y| y.1.partial_cmp(&x.1).unwrap_or(std::cmp::Ordering::Equal));
    Value::Array(by.into_iter().map(|a| json!({
        "agent": a.0, "games": js::number(a.1), "wins": js::number(a.2),
        "kd": js::number(if a.4 != 0.0 { a.3 / a.4 } else { a.3 }), "acs": rnd(a.5 / a.6),
    })).collect())
}

static SCOUT_CACHE: Lazy<Mutex<HashMap<String, (i64, Value)>>> = Lazy::new(|| Mutex::new(HashMap::new()));

/// Full scout: rank fields plus recent, agents, matches, historyPrivate. Cached five minutes per player.
pub async fn scout(ctx: &Ctx, puuid: &str) -> Res<Value> {
    if let Some((at, v)) = SCOUT_CACHE.lock().unwrap().get(puuid) {
        if now_ms() - at < 5 * 60 * 1000 { return Ok(v.clone()); }
    }
    let cu_path = format!("mmr/v1/players/{puuid}/competitiveupdates?startIndex=0&endIndex=10&queue=competitive");
    let (r, cu) = tokio::join!(rank(ctx, puuid), ctx.riot.pd("get", &cu_path, None));
    let r = r?;
    let cu = cu.ok();
    let mut updates: Option<Value> = cu.as_ref().map(|c| c["Matches"].clone()).filter(truthy);
    if updates.is_none() {
        let h = ctx.riot.pd("get", &format!("match-history/v1/history/{puuid}?startIndex=0&endIndex=10&queue=competitive"), None).await.ok();
        updates = h.filter(truthy).map(|h| Value::Array(js::arr(&h["History"]).iter().map(|x| json!({ "MatchID": x["MatchID"] })).collect()));
    }
    let list = updates.as_ref().map(js::arr).unwrap_or_default();
    let ms: Vec<Line> = futures::stream::iter(list).map(|u| {
        let id = match &u["MatchID"] { Value::Null => "undefined".to_string(), v => js::s(v) };
        let f = get_match(ctx, id);
        async move { f.await.ok().and_then(|m| summarize(&m, puuid, &u)) }
    }).buffered(3).collect::<Vec<_>>().await.into_iter().flatten().collect();
    let mut value = r.as_object().cloned().unwrap_or_default();
    value.insert("recent".into(), aggregate(&ms));
    value.insert("agents".into(), top_agents(&ms));
    value.insert("matches".into(), Value::Array(ms.into_iter().map(|m| Value::Object(m.v)).collect()));
    value.insert("historyPrivate".into(), Value::Bool(updates.is_none()));
    let value = Value::Object(value);
    SCOUT_CACHE.lock().unwrap().insert(puuid.to_string(), (now_ms(), value.clone()));
    Ok(value)
}
