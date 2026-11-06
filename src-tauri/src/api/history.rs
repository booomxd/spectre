// Match history, match details, player search/profile and recent-activity channels. Port of public/api/history.js.
// Any player can be looked up by puuid (like any tracker). Hidden players are protected at the source:
// puuids of streamer-mode players and of unnamed strangers in match data are never handed to the UI.
use crate::api::known;
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use futures::future::{BoxFuture, FutureExt, Shared};
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Mutex;

// ---- small JS helpers ----

/// Object builder that mirrors a JS object literal's key order.
struct O(Map<String, Value>);
impl O {
    fn new() -> Self { O(Map::new()) }
    fn v(mut self, k: &str, v: impl Into<Value>) -> Self { self.0.insert(k.to_string(), v.into()); self }
    /// A field that may be undefined in JS (then it is left out of the JSON).
    fn u(mut self, k: &str, v: Option<&Value>) -> Self {
        if let Some(v) = v { self.0.insert(k.to_string(), v.clone()); }
        self
    }
    /// `...spread`
    fn ext(mut self, m: Map<String, Value>) -> Self {
        for (k, v) in m { self.0.insert(k, v); }
        self
    }
    fn done(self) -> Value { Value::Object(self.0) }
}

/// JS template-literal / `String(v)` of a handler argument or field (undefined when missing).
fn tpl(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Number(n)) => js::number(n.as_f64().unwrap_or(0.0)).to_string(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Array(_)) | Some(Value::Object(_)) => "[object Object]".into(),
    }
}

/// JS `encodeURIComponent`.
fn enc(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) { out.push(b as char); } else { out.push_str(&format!("%{b:02X}")); }
    }
    out
}

/// JS `Number(v)` for a field that may be undefined (then NaN, as in `x + undefined`).
fn n(v: Option<&Value>) -> f64 {
    match v {
        None | Some(Value::Array(_)) | Some(Value::Object(_)) => f64::NAN,
        Some(Value::String(t)) => key_num(t),
        Some(v) => js::num(v),
    }
}

/// JS `Number(key)` for an object key.
fn key_num(k: &str) -> f64 {
    let t = k.trim();
    if t.is_empty() { 0.0 } else { t.parse().unwrap_or(f64::NAN) }
}

/// `Math.max(s.CompetitiveTier || 0, ...Object.keys(s.WinsByTier || {}).map(Number))`
fn max_tier(s: &Value) -> f64 {
    let mut top = js::num(&js::or(&s["CompetitiveTier"], json!(0)));
    for (k, _) in js::entries(&s["WinsByTier"]) {
        let n = key_num(&k);
        if n.is_nan() { return f64::NAN; }
        if n > top { top = n; }
    }
    top
}

/// `puuid || riot.state.puuid`
fn id_of(ctx: &Ctx, a: &Args, i: usize) -> String {
    if a.truthy(i) { tpl(a.0.get(i)) } else { ctx.riot.puuid() }
}

// ---- limited-concurrency pd queue + caches ----
static LIMIT: Lazy<tokio::sync::Semaphore> = Lazy::new(|| tokio::sync::Semaphore::new(3));

type MatchFut = Shared<BoxFuture<'static, Res<Value>>>;
// matchId -> Promise<slim>, plus insertion order for eviction.
static MATCHES: Lazy<Mutex<(HashMap<String, MatchFut>, Vec<String>)>> = Lazy::new(|| Mutex::new((HashMap::new(), Vec::new())));

fn get_match(ctx: &Ctx, match_id: &str) -> MatchFut {
    let mut c = MATCHES.lock().unwrap();
    if let Some(f) = c.0.get(match_id) { return f.clone(); }
    let (ctx2, id) = (ctx.clone(), match_id.to_string());
    // Started right away, like a JS promise; removed from the cache if it fails.
    let handle = tauri::async_runtime::spawn(async move {
        let res = async {
            let _permit = LIMIT.acquire().await.map_err(|e| msg(e.to_string()))?;
            ctx2.riot.pd("get", &format!("match-details/v1/matches/{id}"), None).await
        }.await;
        let out = res.and_then(|m| slim(&m));
        if out.is_err() {
            let mut c = MATCHES.lock().unwrap();
            c.0.remove(&id);
            c.1.retain(|k| k != &id);
        }
        out
    });
    let fut: MatchFut = async move {
        match handle.await { Ok(r) => r, Err(e) => Err(msg(e.to_string())) }
    }.boxed().shared();
    c.0.insert(match_id.to_string(), fut.clone());
    c.1.push(match_id.to_string());
    if c.0.len() > 120 {
        let first = c.1.remove(0);
        c.0.remove(&first);
    }
    fut
}

static NAMES: Lazy<Mutex<HashMap<String, Value>>> = Lazy::new(|| Mutex::new(HashMap::new())); // puuid -> {gameName, tagLine} | null

async fn resolve_names(ctx: &Ctx, puuids: &[String]) -> Map<String, Value> {
    let mut need: Vec<String> = Vec::new();
    {
        let c = NAMES.lock().unwrap();
        for p in puuids {
            if !p.is_empty() && !c.contains_key(p) && !need.contains(p) { need.push(p.clone()); }
        }
    }
    for chunk in need.chunks(40) {
        // On failure leave uncached so a later call can retry.
        if let Ok(got) = ctx.riot.names(chunk).await {
            let mut c = NAMES.lock().unwrap();
            for p in chunk {
                let v = got.get(p).filter(|g| truthy(&g["gameName"])).cloned().unwrap_or(Value::Null);
                c.insert(p.clone(), v);
            }
        }
    }
    let c = NAMES.lock().unwrap();
    puuids.iter().map(|p| (p.clone(), c.get(p).filter(|v| truthy(v)).cloned().unwrap_or(Value::Null))).collect()
}

// ---- match slimming: drop positions etc., keep what the UI needs ----
fn slim(m: &Value) -> Res<Value> {
    if m.is_null() { return Err(msg("Cannot read properties of null (reading 'matchInfo')")); }
    let info = &m["matchInfo"];
    if info.is_null() {
        let what = if m.get("matchInfo").is_some() { "null" } else { "undefined" };
        return Err(msg(format!("Cannot read properties of {what} (reading 'matchId')")));
    }
    let rounds: Vec<Value> = js::arr(&m["roundResults"]).iter().map(|r| {
        let stats: Vec<Value> = js::arr(&r["playerStats"]).iter().map(|s| {
            let kills: Vec<Value> = js::arr(&s["kills"]).iter()
                .map(|k| O::new().u("killer", k.get("killer")).u("victim", k.get("victim")).u("t", k.get("roundTime")).done()).collect();
            let damage: Vec<Value> = js::arr(&s["damage"]).iter()
                .map(|d| O::new().u("damage", d.get("damage")).u("head", d.get("headshots")).u("body", d.get("bodyshots")).u("leg", d.get("legshots")).done()).collect();
            O::new().u("subject", s.get("subject")).v("kills", kills).v("damage", damage).done()
        }).collect();
        O::new().u("num", r.get("roundNum")).v("result", js::or(&r["roundResult"], json!(""))).v("code", js::or(&r["roundResultCode"], json!("")))
            .u("winner", r.get("winningTeam")).u("role", r.get("winningTeamRole"))
            .v("site", js::or(&r["plantSite"], json!("")))
            .v("stats", stats).done()
    }).collect();
    let teams: Vec<Value> = js::arr(&m["teams"]).iter()
        .map(|t| O::new().u("id", t.get("teamId")).v("won", truthy(&t["won"])).u("roundsWon", t.get("roundsWon")).u("roundsPlayed", t.get("roundsPlayed")).done())
        .collect();
    let players: Vec<Value> = js::arr(&m["players"]).iter().filter(|p| !truthy(&p["isObserver"])).map(|p| {
        O::new().u("puuid", p.get("subject")).u("team", p.get("teamId")).u("party", p.get("partyId"))
            .v("agent", js::lower(&p["characterId"])).v("tier", js::or(&p["competitiveTier"], json!(0)))
            .v("level", js::or(&p["accountLevel"], json!(0))).u("card", p.get("playerCard")).u("title", p.get("playerTitle"))
            .v("stats", js::or(&p["stats"], js::obj())).v("rounds", js::or(&p["stats"]["roundsPlayed"], json!(0))).done()
    }).collect();
    Ok(O::new().u("id", info.get("matchId")).u("mapId", info.get("mapId")).v("queue", js::or(&info["queueID"], json!("")))
        .u("start", info.get("gameStartMillis")).u("length", info.get("gameLengthMillis"))
        .v("teams", teams).v("players", players).v("rounds", rounds).done())
}

// Per-player derived stats.
fn player_stats(m: &Value, p: &Value) -> Map<String, Value> {
    let rounds = m["rounds"].as_array().cloned().unwrap_or_default();
    let n_rounds = if !rounds.is_empty() { rounds.len() as f64 } else { js::num(&js::or(&p["rounds"], json!(1))) };
    let (mut dmg, mut head, mut shots, mut fb, mut fd) = (0f64, 0f64, 0f64, 0i64, 0i64);
    for r in &rounds {
        let stats = js::arr(&r["stats"]);
        for s in &stats {
            if s["subject"] == p["puuid"] {
                for d in js::arr(&s["damage"]) {
                    dmg += n(d.get("damage"));
                    head += n(d.get("head"));
                    shots += n(d.get("head")) + n(d.get("body")) + n(d.get("leg"));
                }
            }
        }
        let mut all: Vec<Value> = stats.iter().flat_map(|s| js::arr(&s["kills"])).collect();
        all.sort_by(|a, b| (n(a.get("t")) - n(b.get("t"))).partial_cmp(&0.0).unwrap_or(std::cmp::Ordering::Equal));
        if let Some(f) = all.first() {
            if f["killer"] == p["puuid"] { fb += 1; }
            if f["victim"] == p["puuid"] { fd += 1; }
        }
    }
    let st = &p["stats"];
    let score = js::num(&js::or(&st["score"], json!(0)));
    O::new()
        .v("kills", js::or(&st["kills"], json!(0))).v("deaths", js::or(&st["deaths"], json!(0)))
        .v("assists", js::or(&st["assists"], json!(0))).v("points", js::or(&st["score"], json!(0)))
        .v("acs", js::number(js::round(score / n_rounds)))
        .v("adr", if dmg != 0.0 && !dmg.is_nan() { js::number(js::round(dmg / n_rounds)) } else { Value::Null })
        .v("hs", if shots != 0.0 && !shots.is_nan() { js::number(js::round(head / shots * 100.0)) } else { Value::Null })
        .v("fb", fb).v("fd", fd)
        .0
}

fn mode_name(q: &str) -> String {
    if q.starts_with("premier") { return "Premier".into(); }
    let known = match q {
        "competitive" => "Competitive", "unrated" => "Unrated", "swiftplay" => "Swiftplay", "deathmatch" => "Deathmatch",
        "spikerush" => "Spike Rush", "hurm" => "Team Deathmatch", "ggteam" => "Escalation", "onefa" => "Replication",
        "snowball" => "Snowball Fight", "valaram" => "ARAM", "newmap" => "New Map", "" => "Custom",
        _ => {
            let mut c = q.chars();
            return match c.next() { Some(f) => f.to_uppercase().collect::<String>() + c.as_str(), None => String::new() };
        }
    };
    known.to_string()
}

fn summarize(m: &Value, puuid: &str) -> Option<Value> {
    let players = js::arr(&m["players"]);
    let me = players.iter().find(|p| p["puuid"].as_str() == Some(puuid))?;
    let teams = js::arr(&m["teams"]);
    let mine = teams.iter().find(|t| t["id"] == me["team"]);
    let other: Vec<&Value> = teams.iter().filter(|t| t["id"] != me["team"]).collect();
    let mut result = if mine.map(|t| truthy(&t["won"])).unwrap_or(false) { "win" } else { "loss" };
    if teams.len() == 2 && !teams.iter().any(|t| truthy(&t["won"])) { result = "draw"; }
    let ffa = teams.len() > 2;
    let score = if ffa { Value::Null } else {
        json!({
            "us": js::nullish(&mine.map(|t| t["roundsWon"].clone()).unwrap_or(Value::Null), json!(0)),
            "them": js::nullish(&other.first().map(|t| t["roundsWon"].clone()).unwrap_or(Value::Null), json!(0)),
        })
    };
    Some(O::new().u("matchId", m.get("id")).u("mapId", m.get("mapId")).v("queue", m["queue"].clone()).v("mode", mode_name(&js::s(&m["queue"])))
        .u("start", m.get("start")).u("length", m.get("length"))
        .v("agent", me["agent"].clone()).v("tier", me["tier"].clone()).v("result", result).v("ffa", ffa).v("score", score)
        .ext(player_stats(m, me)).done())
}

// matchId -> RR change for competitive games
static RR_CACHE: Lazy<Mutex<HashMap<String, (i64, Value)>>> = Lazy::new(|| Mutex::new(HashMap::new()));
static SCOUT_CACHE: Lazy<Mutex<HashMap<String, (i64, Value)>>> = Lazy::new(|| Mutex::new(HashMap::new())); // puuid -> { at, value }

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    // ---- history ----
    reg.add("history:list", |ctx, a: Args| async move {
        let id = id_of(&ctx, &a, 0);
        let opts = match a.0.get(1) { Some(v) if !v.is_null() => v.clone(), _ => js::obj() };
        let queue = opts.get("queue").cloned().unwrap_or(json!(""));
        let start = opts.get("start").cloned().unwrap_or(json!(0));
        let end = opts.get("end").cloned().unwrap_or(json!(20));
        let q = if truthy(&queue) && queue != json!("all") { format!("&queue={}", enc(&tpl(Some(&queue)))) } else { String::new() };
        let res = ctx.riot.pd("get", &format!("match-history/v1/history/{id}?startIndex={}&endIndex={}{q}", tpl(Some(&start)), tpl(Some(&end))), None).await?;
        let matches: Vec<Value> = js::arr(&res["History"]).iter()
            .map(|h| O::new().u("matchId", h.get("MatchID")).u("start", h.get("GameStartTime")).u("queue", h.get("QueueID")).done()).collect();
        Ok(json!({ "puuid": id, "total": js::or(&res["Total"], json!(0)), "matches": matches }))
    });

    reg.add("history:summary", |ctx, a: Args| async move {
        let id = id_of(&ctx, &a, 1);
        let m = get_match(&ctx, &tpl(a.0.get(0))).await?;
        Ok(summarize(&m, &id).unwrap_or(Value::Null))
    });

    reg.add("history:rr", |ctx, a: Args| async move {
        let id = id_of(&ctx, &a, 0);
        if let Some((at, data)) = RR_CACHE.lock().unwrap().get(&id) {
            if now_ms() - at < 60000 { return Ok(data.clone()); }
        }
        let mut data = Map::new();
        let mut s = 0;
        while s < 60 {
            let res = match ctx.riot.pd("get", &format!("mmr/v1/players/{id}/competitiveupdates?startIndex={s}&endIndex={}&queue=competitive", s + 20), None).await {
                Ok(r) => r,
                Err(_) => break,
            };
            let list = js::arr(&res["Matches"]);
            for u in &list {
                let v = O::new()
                    .v("earned", js::number(n(u.get("RankedRatingAfterUpdate")) - n(u.get("RankedRatingBeforeUpdate"))))
                    .u("before", u.get("RankedRatingBeforeUpdate")).u("after", u.get("RankedRatingAfterUpdate"))
                    .u("tierBefore", u.get("TierBeforeUpdate")).u("tierAfter", u.get("TierAfterUpdate"))
                    .v("placement", truthy(&u["IsPlacementMatch"])).done();
                data.insert(tpl(u.get("MatchID")), v);
            }
            if list.len() < 20 { break; }
            s += 20;
        }
        let data = Value::Object(data);
        RR_CACHE.lock().unwrap().insert(id, (now_ms(), data.clone()));
        Ok(data)
    });

    reg.add("history:detail", |ctx, a: Args| async move {
        let m = get_match(&ctx, &tpl(a.0.get(0))).await?;
        let (ok, fr, live) = tokio::join!(known::known_puuids(&ctx), known::friend_puuids(&ctx), known::live_hidden(&ctx));
        let (ok, fr) = (ok?, fr?);
        let state = ctx.riot.state();
        let me = state.puuid.clone().unwrap_or_default();
        // Everyone is named like on any tracker, except streamer-mode players in your current match. If the current
        // match can't be read, only you, friends and party are named.
        let shown = |p: &str| p == me || match &live { Some(l) => !l.contains(p), None => ok.contains(p) };
        let mp = js::arr(&m["players"]);
        let want: Vec<String> = mp.iter().map(|p| js::s(&p["puuid"])).filter(|p| shown(p)).collect();
        let names = resolve_names(&ctx, &want).await;
        let my_party = mp.iter().find(|p| p["puuid"].as_str() == Some(me.as_str())).map(|p| p["party"].clone()).unwrap_or(Value::Null);
        // Hidden players are agent-only, with no puuid.
        let players: Vec<Value> = mp.iter().enumerate().map(|(i, p)| {
            let pid = js::s(&p["puuid"]);
            let is_known = ok.contains(&pid);
            let nm = if pid == me {
                json!({ "gameName": state.game_name, "tagLine": state.tag_line })
            } else if shown(&pid) { names.get(&pid).cloned().unwrap_or(Value::Null) } else { Value::Null };
            let has = truthy(&nm);
            let base = if has { O::new().u("key", p.get("puuid")) } else { O::new().v("key", format!("x{i}")) };
            let base = base.u("team", p.get("team")).v("agent", p["agent"].clone()).v("tier", p["tier"].clone()).v("known", is_known)
                .v("name", if has { nm.clone() } else { Value::Null }).v("hidden", !has).ext(player_stats(&m, p));
            if has {
                base.u("puuid", p.get("puuid")).v("friend", fr.contains(&pid)).v("party", truthy(&my_party) && p["party"] == my_party)
                    .v("level", p["level"].clone()).u("card", p.get("card")).done()
            } else { base.done() }
        }).collect();
        let rounds: Vec<Value> = js::arr(&m["rounds"]).iter().map(|r| {
            let code = js::s(&r["code"]);
            let result = js::s(&r["result"]);
            let res_l = result.to_lowercase();
            let kind = if code == "Elimination" || res_l.contains("elimin") { "elim" }
                else if code == "Defuse" || res_l.contains("defus") { "defuse" }
                else if code == "Detonate" || res_l.contains("detonat") { "detonate" }
                else if format!("{code}{result}").to_lowercase().contains("surrender") { "surrender" }
                else { "time" };
            O::new().u("num", r.get("num")).v("kind", kind).u("winner", r.get("winner")).u("role", r.get("role")).v("site", r["site"].clone()).done()
        }).collect();
        Ok(O::new().u("matchId", m.get("id")).u("mapId", m.get("mapId")).v("queue", m["queue"].clone()).v("mode", mode_name(&js::s(&m["queue"])))
            .u("start", m.get("start")).u("length", m.get("length"))
            .v("teams", m["teams"].clone()).v("players", players).v("rounds", rounds).v("namesLimited", live.is_none()).done())
    });

    // ---- activity: who you recently played with / against ----
    reg.add("activity:recent", |ctx, a: Args| async move {
        let count = match a.0.get(0) { None | Some(Value::Null) => 20.0, Some(v) => js::num(v) };
        let me = ctx.riot.puuid();
        let end = js::number(count.min(25.0));
        let list = ctx.riot.pd("get", &format!("match-history/v1/history/{me}?startIndex=0&endIndex={}", tpl(Some(&end))), None).await?;
        let futs: Vec<MatchFut> = js::arr(&list["History"]).iter().map(|h| get_match(&ctx, &tpl(h.get("MatchID")))).collect();
        let matches: Vec<Value> = futures::future::join_all(futs).await.into_iter().filter_map(|r| r.ok()).collect();
        let ok = known::known_puuids(&ctx).await?;
        let fr = known::friend_puuids(&ctx).await?;
        let want: Vec<String> = matches.iter().flat_map(|m| js::arr(&m["players"]).iter().map(|p| js::s(&p["puuid"])).collect::<Vec<_>>())
            .filter(|p| ok.contains(p)).collect();
        let names = resolve_names(&ctx, &want).await;
        let mut people = Map::new();
        let mut out: Vec<Value> = Vec::new();
        for m in &matches {
            let mp = js::arr(&m["players"]);
            let Some(mine) = mp.iter().find(|p| p["puuid"].as_str() == Some(me.as_str())) else { continue };
            let Some(sum) = summarize(m, &me) else { continue };
            let n_teams = js::arr(&m["teams"]).len();
            let mid = tpl(m.get("id"));
            let players: Vec<Value> = mp.iter().filter(|p| p["puuid"].as_str() != Some(me.as_str())).enumerate().map(|(i, p)| {
                let rel = if n_teams > 2 { "opp" } else if p["team"] == mine["team"] { "mate" } else { "opp" };
                let st = &p["stats"];
                let base = O::new().v("key", format!("{mid}:{i}")).v("rel", rel).v("agent", p["agent"].clone()).v("tier", p["tier"].clone())
                    .u("kills", st.get("kills")).u("deaths", st.get("deaths")).u("assists", st.get("assists"));
                let pid = js::s(&p["puuid"]);
                if !ok.contains(&pid) { return base.v("known", false).v("name", Value::Null).v("hidden", true).done(); }
                let nm = names.get(&pid).cloned().unwrap_or(Value::Null);
                let e = people.entry(pid.clone()).or_insert_with(|| {
                    O::new().u("puuid", p.get("puuid")).v("friend", fr.contains(&pid)).v("name", nm.clone()).v("hidden", !truthy(&nm))
                        .v("with", 0).v("against", 0).u("lastSeen", m.get("start")).v("agent", p["agent"].clone()).v("tier", p["tier"].clone()).done()
                });
                let k = if rel == "mate" { "with" } else { "against" };
                e[k] = js::number(js::num(&e[k]) + 1.0);
                base.u("puuid", p.get("puuid")).v("friend", fr.contains(&pid)).v("known", true).v("name", nm.clone()).v("hidden", !truthy(&nm)).done()
            }).collect();
            out.push(O::new().u("matchId", m.get("id")).u("mapId", m.get("mapId")).v("mode", sum["mode"].clone()).v("queue", m["queue"].clone())
                .u("start", m.get("start")).v("result", sum["result"].clone()).v("score", sum["score"].clone()).v("agent", sum["agent"].clone())
                .v("players", players).done());
        }
        Ok(json!({ "matches": out, "people": people }))
    });

    // ---- player search ----
    reg.add("search:lookup", |ctx, a: Args| async move {
        let text = if a.truthy(0) { tpl(a.0.get(0)) } else { String::new() };
        let i = text.rfind('#').filter(|&i| i > 0);
        let game_name = i.map(|i| text[..i].trim().to_string()).unwrap_or_default();
        let tag_line = i.map(|i| text[i + 1..].trim().to_string()).unwrap_or_default();
        if game_name.is_empty() || tag_line.is_empty() { return Err(msg("Enter a Riot ID like Name#Tag")); }
        let res = ctx.riot.local("get", &format!("player-account/aliases/v1/lookup?gameName={}&tagLine={}", enc(&game_name), enc(&tag_line)), None).await?;
        let hit = if res.is_array() { res[0].clone() } else { Value::Null };
        if !truthy(&hit["puuid"]) { crate::bail!("No player found for {game_name}#{tag_line}"); }
        Ok(json!({
            "puuid": hit["puuid"],
            "gameName": js::or(&hit["alias"]["game_name"], json!(game_name)),
            "tagLine": js::or(&hit["alias"]["tag_line"], json!(tag_line)),
        }))
    });

    reg.add("search:profile", |ctx, a: Args| async move {
        let arg = a.0.get(0).cloned();
        let puuid = tpl(arg.as_ref());
        let state = ctx.riot.state();
        let mut out = O::new().u("puuid", arg.as_ref()).v("gameName", Value::Null).v("tagLine", Value::Null).v("level", Value::Null)
            .v("cardId", Value::Null).v("titleId", Value::Null).v("current", Value::Null).v("peak", Value::Null)
            .v("leaderboardRank", Value::Null).v("notes", json!([])).0;
        let mut notes: Vec<Value> = Vec::new();
        // Keys later assigned `undefined` (kept in place, left out of the JSON).
        let mut undef: Vec<&str> = Vec::new();
        // `puuid === riot.state.puuid` (state.puuid is null until connected).
        let is_self = match (&arg, &state.puuid) {
            (Some(Value::String(x)), Some(me)) => x == me,
            (Some(Value::Null), None) => true,
            _ => false,
        };
        if is_self {
            out.insert("gameName".into(), state.game_name.clone().map(Value::from).unwrap_or(Value::Null));
            out.insert("tagLine".into(), state.tag_line.clone().map(Value::from).unwrap_or(Value::Null));
            out.insert("self".into(), json!(true));
        } else {
            let want: Vec<String> = arg.as_ref().and_then(Value::as_str).map(|s| vec![s.to_string()]).unwrap_or_default();
            let nm = resolve_names(&ctx, &want).await.get(&puuid).cloned().unwrap_or(Value::Null);
            if truthy(&nm) {
                out.insert("gameName".into(), nm["gameName"].clone());
                out.insert("tagLine".into(), nm["tagLine"].clone());
            }
        }
        let (mmr_path, hist_path) = (format!("mmr/v1/players/{puuid}"), format!("match-history/v1/history/{puuid}?startIndex=0&endIndex=1"));
        let (mmr, hist) = tokio::join!(ctx.riot.pd("get", &mmr_path, None), ctx.riot.pd("get", &hist_path, None));
        let mmr = match mmr { Ok(v) => v, Err(e) => { notes.push(json!(format!("Rank data unavailable: {e}"))); Value::Null } };
        let hist = hist.unwrap_or(Value::Null);
        if truthy(&mmr) {
            let skills = js::or(&mmr["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"], js::obj());
            let latest = &mmr["LatestCompetitiveUpdate"];
            let (mut peak_tier, mut peak_season) = (0f64, Value::Null);
            for (sid, s) in js::entries(&skills) {
                let top = max_tier(&s);
                if top > peak_tier { peak_tier = top; peak_season = json!(sid); }
            }
            if !latest["TierAfterUpdate"].is_null() {
                let s = skills.get(tpl(latest.get("SeasonID"))).cloned().unwrap_or(Value::Null);
                out.insert("current".into(), O::new().v("tier", latest["TierAfterUpdate"].clone()).u("rr", latest.get("RankedRatingAfterUpdate"))
                    .u("seasonId", latest.get("SeasonID")).v("wins", s["NumberOfWins"].clone()).v("games", s["NumberOfGames"].clone())
                    .u("lastGame", latest.get("MatchStartTime")).done());
                out.insert("leaderboardRank".into(), if js::num(&s["LeaderboardRank"]) > 0.0 { s["LeaderboardRank"].clone() } else { Value::Null });
            }
            if peak_tier > 0.0 { out.insert("peak".into(), json!({ "tier": js::number(peak_tier), "seasonId": peak_season })); }
            if !latest["TierAfterUpdate"].is_null() && js::num(&latest["TierAfterUpdate"]) > peak_tier {
                out.insert("peak".into(), O::new().v("tier", latest["TierAfterUpdate"].clone()).u("seasonId", latest.get("SeasonID")).done());
            }
        }
        let first = hist["History"][0].clone();
        if !truthy(&hist) { notes.push(json!("Match history is private or unavailable")); }
        if truthy(&first) {
            if let Ok(m) = get_match(&ctx, &tpl(first.get("MatchID"))).await {
                if let Some(p) = js::arr(&m["players"]).iter().find(|x| x.get("puuid") == arg.as_ref()) {
                    for (k, f) in [("level", "level"), ("cardId", "card"), ("titleId", "title")] {
                        undef.retain(|u| *u != k);
                        match p.get(f) { Some(v) => { out.insert(k.into(), v.clone()); } None => { out.insert(k.into(), Value::Null); undef.push(k); } }
                    }
                }
            }
        }
        if is_self {
            if let Ok(x) = ctx.riot.pd("get", &format!("account-xp/v1/players/{puuid}"), None).await {
                if !x["Progress"].is_null() {
                    undef.retain(|u| *u != "level");
                    match x["Progress"].get("Level") { Some(v) => { out.insert("level".into(), v.clone()); } None => { out.insert("level".into(), Value::Null); undef.push("level"); } }
                }
            }
        }
        out.insert("notes".into(), Value::Array(notes));
        Ok(Value::Object(out.into_iter().filter(|(k, _)| !undef.contains(&k.as_str())).collect()))
    });

    // Scout details, fetched only when a profile is opened: per-act history + recent competitive form.
    reg.add("search:scout", |ctx, a: Args| async move {
        let puuid = tpl(a.0.get(0));
        if let Some((at, v)) = SCOUT_CACHE.lock().unwrap().get(&puuid) {
            if now_ms() - at < 5 * 60 * 1000 { return Ok(v.clone()); }
        }
        let (mmr_path, hist_path) = (format!("mmr/v1/players/{puuid}"), format!("match-history/v1/history/{puuid}?startIndex=0&endIndex=10&queue=competitive"));
        let (mmr, hist) = tokio::join!(ctx.riot.pd("get", &mmr_path, None), ctx.riot.pd("get", &hist_path, None));
        let (mmr, hist) = (mmr.unwrap_or(Value::Null), hist.unwrap_or(Value::Null));
        let mut acts: Vec<Value> = Vec::new();
        for (season_id, s) in js::entries(&js::or(&mmr["QueueSkills"]["competitive"]["SeasonalInfoBySeasonID"], js::obj())) {
            if !truthy(&s["NumberOfGames"]) { continue; }
            let peak = max_tier(&s);
            acts.push(json!({
                "seasonId": season_id, "tier": js::or(&s["CompetitiveTier"], json!(0)), "peak": js::number(peak),
                "wins": js::or(&s["NumberOfWins"], json!(0)), "games": js::or(&s["NumberOfGames"], json!(0)),
            }));
        }
        let futs: Vec<_> = js::arr(&hist["History"]).iter().map(|h| {
            let f = get_match(&ctx, &tpl(h.get("MatchID")));
            let p = puuid.clone();
            async move { f.await.ok().and_then(|m| summarize(&m, &p)) }
        }).collect();
        let sums: Vec<Value> = futures::future::join_all(futs).await.into_iter().flatten().collect();
        let kills: f64 = sums.iter().map(|r| js::num(&r["kills"])).sum();
        let deaths: f64 = sums.iter().map(|r| js::num(&r["deaths"])).sum();
        let hs: Vec<&Value> = sums.iter().filter(|r| !r["hs"].is_null()).collect();
        let team: Vec<&Value> = sums.iter().filter(|r| !truthy(&r["ffa"])).collect();
        let recent = if sums.is_empty() { Value::Null } else {
            json!({
                "matches": sums.len(), "kills": js::number(kills), "deaths": js::number(deaths),
                "kd": js::number(if deaths != 0.0 { kills / deaths } else { kills }),
                "hs": if hs.is_empty() { Value::Null } else { js::number(js::round(hs.iter().map(|r| js::num(&r["hs"])).sum::<f64>() / hs.len() as f64)) },
                "wins": team.iter().filter(|r| r["result"] == "win").count(), "team": team.len(),
            })
        };
        let value = json!({ "acts": acts, "recent": recent, "historyPrivate": !truthy(&hist) });
        SCOUT_CACHE.lock().unwrap().insert(puuid, (now_ms(), value.clone()));
        Ok(value)
    });

    reg.add("search:recent", |ctx, _| async move { Ok(ctx.riot.read_store("recent-searches", json!([]))) });
    reg.add("search:pushRecent", |ctx, a: Args| async move {
        let entry = a.val(0);
        if !truthy(&entry["puuid"]) { return Ok(json!([])); }
        let mut list = vec![entry.clone()];
        list.extend(js::arr(&ctx.riot.read_store("recent-searches", json!([]))).into_iter().filter(|e| e["puuid"] != entry["puuid"]));
        list.truncate(12);
        let list = Value::Array(list);
        ctx.riot.write_store("recent-searches", &list)?;
        Ok(list)
    });
    reg.add("search:clearRecent", |ctx, _| async move {
        ctx.riot.write_store("recent-searches", &json!([]))?;
        Ok(json!([]))
    });
}
