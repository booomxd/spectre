// Discord Rich Presence over Discord's local IPC pipe (no dependencies).
// Frame = int32 LE opcode + int32 LE length + JSON. Opcodes: 0 handshake, 1 frame, 2 close, 3 ping, 4 pong.
use crate::api::scout;
use crate::api::settings::{load, merge};
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use base64::Engine;
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tokio::io::{AsyncReadExt, AsyncWriteExt, ReadHalf, WriteHalf};
use tokio::net::windows::named_pipe::{ClientOptions, NamedPipeClient};
use tokio::sync::oneshot;

fn queue_name(q: &str) -> Option<&'static str> {
    Some(match q {
        "competitive" => "Competitive", "unrated" => "Unrated", "spikerush" => "Spike Rush", "deathmatch" => "Deathmatch", "ggteam" => "Escalation",
        "onefa" => "Replication", "swiftplay" => "Swiftplay", "hurm" => "Team Deathmatch", "premier" => "Premier", "newmap" => "New Map",
        "snowball" => "Snowball Fight", "" => "Custom Game",
        _ => return None,
    })
}
fn pipe(n: u32) -> String { format!(r"\\?\pipe\discord-ipc-{n}") }
// Spectre's own Discord application; its name is what friends see after "Playing". Public, not a secret.
const APP_ID: &str = "1566720776202231818";
fn cap(s: &str) -> String {
    let mut c = s.chars();
    match c.next() { Some(f) => format!("{f}{}", c.as_str().to_lowercase()), None => String::new() }
}

// ---- JS string conversions for the activity text ----

/// `${v}` in a template literal (None = undefined).
fn tpl(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        Some(Value::String(s)) => s.clone(),
        Some(Value::Bool(b)) => b.to_string(),
        Some(Value::Number(n)) => num_str(n.as_f64().unwrap_or(0.0)),
        Some(Value::Array(a)) => a.iter().map(|x| join_str(Some(x))).collect::<Vec<_>>().join(","),
        Some(Value::Object(_)) => "[object Object]".into(),
    }
}
/// How Array.prototype.join stringifies an element (null / undefined become "").
fn join_str(v: Option<&Value>) -> String { match v { None | Some(Value::Null) => String::new(), _ => tpl(v) } }
fn num_str(f: f64) -> String { if f.fract() == 0.0 && f.abs() < 1e21 { format!("{}", f as i64) } else { format!("{f}") } }

// ---- connection state (module-level `let`s in the JS) ----

type Reply = oneshot::Sender<Result<Value, String>>;
type Writer = Arc<tokio::sync::Mutex<WriteHalf<NamedPipeClient>>>;

struct Sock { id: u64, w: Writer, reader: tokio::task::AbortHandle }

#[derive(Default)]
struct St {
    sock: Option<Sock>,
    user: Option<Value>,
    client_id: Option<String>,
    last_error: Option<String>,
    last_activity: Value,
    last_update: Option<i64>,
    pending: HashMap<String, Reply>,
    state_key: Option<String>,
    state_start: i64,
    timer: Option<tokio::task::AbortHandle>,
}

static ST: Lazy<Mutex<St>> = Lazy::new(|| Mutex::new(St { state_start: now_ms(), ..Default::default() }));
static SOCK_IDS: AtomicU64 = AtomicU64::new(1);

fn frame(op: i32, data: &Value) -> Vec<u8> {
    let body = serde_json::to_vec(data).unwrap_or_default();
    let mut out = Vec::with_capacity(8 + body.len());
    out.extend_from_slice(&op.to_le_bytes());
    out.extend_from_slice(&(body.len() as i32).to_le_bytes());
    out.extend_from_slice(&body);
    out
}

/// Fire-and-forget write (Node's socket.write: errors only surface on the ignored 'error' event).
async fn write(w: &Writer, bytes: Vec<u8>) {
    let mut w = w.lock().await;
    let _ = w.write_all(&bytes).await;
    let _ = w.flush().await;
}

fn drop_conn(st: &mut St) {
    st.sock = None; st.user = None; st.client_id = None;
    for (_, p) in st.pending.drain() { let _ = p.send(Err("Disconnected".into())); }
}

/// s.destroy(): closes the pipe; its 'close' handler drops the state if it is still the current socket.
fn destroy(id: u64) {
    let mut st = ST.lock().unwrap();
    if st.sock.as_ref().map(|s| s.id) == Some(id) {
        if let Some(s) = &st.sock { s.reader.abort(); }
        drop_conn(&mut st);
    }
}

async fn reader(id: u64, mut r: ReadHalf<NamedPipeClient>, w: Writer) {
    let mut buf: Vec<u8> = Vec::new();
    let mut chunk = vec![0u8; 16 * 1024];
    loop {
        let n = match r.read(&mut chunk).await { Ok(0) | Err(_) => break, Ok(n) => n };
        buf.extend_from_slice(&chunk[..n]);
        while buf.len() >= 8 {
            let op = i32::from_le_bytes(buf[0..4].try_into().unwrap());
            let len = i32::from_le_bytes(buf[4..8].try_into().unwrap()).max(0) as usize;
            if buf.len() < 8 + len { break; }
            let m: Value = serde_json::from_slice(&buf[8..8 + len]).unwrap_or_else(|_| js::obj());
            buf.drain(..8 + len);
            match op {
                3 => write(&w, frame(4, &m)).await,
                2 => {
                    let e = js::or(&m["message"], json!("Discord closed the connection"));
                    ST.lock().unwrap().last_error = Some(tpl(Some(&e)));
                    destroy(id);
                    return;
                }
                1 => {
                    let key = js::or(&m["nonce"], m["evt"].clone());
                    let Some(key) = key.as_str() else { continue };
                    let p = ST.lock().unwrap().pending.remove(key);
                    if let Some(p) = p {
                        let r = if m["evt"] == "ERROR" { Err(tpl(Some(&js::or(&m["data"]["message"], json!("Discord error"))))) } else { Ok(m.clone()) };
                        let _ = p.send(r);
                    }
                }
                _ => {}
            }
        }
    }
    // 'close'
    destroy(id);
}

/// Registers a waiter for `key` before the request is written.
fn wait_for(key: &str) -> oneshot::Receiver<Result<Value, String>> {
    let (tx, rx) = oneshot::channel();
    ST.lock().unwrap().pending.insert(key.to_string(), tx);
    rx
}
async fn await_reply(key: &str, rx: oneshot::Receiver<Result<Value, String>>) -> Res<Value> {
    match tokio::time::timeout(Duration::from_millis(5000), rx).await {
        Ok(Ok(r)) => r.map_err(msg),
        Ok(Err(_)) => Err(msg("Disconnected")),
        Err(_) => { ST.lock().unwrap().pending.remove(key); Err(msg("Discord did not respond")) }
    }
}

fn try_pipe(n: u32) -> std::io::Result<NamedPipeClient> { ClientOptions::new().open(pipe(n)) }

async fn open(id: &str) -> Res<()> {
    {
        let st = ST.lock().unwrap();
        if st.sock.is_some() && st.user.is_some() && st.client_id.as_deref() == Some(id) { return Ok(()); }
    }
    close().await;
    let mut s = None;
    for i in 0..10 { if let Ok(c) = try_pipe(i) { s = Some(c); break; } }
    let Some(s) = s else { return Err(msg("Discord is not running (no IPC pipe found)")) };
    let (r, w) = tokio::io::split(s);
    let w: Writer = Arc::new(tokio::sync::Mutex::new(w));
    let sid = SOCK_IDS.fetch_add(1, Ordering::SeqCst);
    let reader = tokio::spawn(reader(sid, r, w.clone())).abort_handle();
    {
        let mut st = ST.lock().unwrap();
        st.sock = Some(Sock { id: sid, w: w.clone(), reader });
        st.client_id = Some(id.to_string());
    }
    let ready = wait_for("READY");
    write(&w, frame(0, &json!({ "v": 1, "client_id": id }))).await;
    match await_reply("READY", ready).await {
        Ok(m) => {
            let u = &m["data"]["user"];
            ST.lock().unwrap().user = if truthy(u) { Some(u.clone()) } else { None };
            Ok(())
        }
        Err(e) => {
            let m = ST.lock().unwrap().last_error.clone().unwrap_or_else(|| e.to_string());
            destroy(sid);
            drop_conn(&mut ST.lock().unwrap());
            Err(msg(m))
        }
    }
}

async fn send(activity: Value) -> Res<Value> {
    let nonce = uuid::Uuid::new_v4().to_string();
    let res = wait_for(&nonce);
    let w = ST.lock().unwrap().sock.as_ref().map(|s| s.w.clone());
    let Some(w) = w else {
        ST.lock().unwrap().pending.remove(&nonce);
        return Err(msg("Cannot read properties of null (reading 'write')"));
    };
    let body = json!({ "cmd": "SET_ACTIVITY", "args": { "pid": std::process::id(), "activity": activity }, "nonce": nonce });
    write(&w, frame(1, &body)).await;
    await_reply(&nonce, res).await
}

/// Clears the activity, then closes the pipe.
async fn close() {
    let cur = ST.lock().unwrap().sock.as_ref().map(|s| (s.id, s.w.clone()));
    if let Some((id, w)) = cur {
        let _ = send(Value::Null).await;
        write(&w, frame(2, &json!({}))).await;
        let mut st = ST.lock().unwrap();
        if let Some(s) = st.sock.as_ref().filter(|s| s.id == id) { s.reader.abort(); }
        drop(w);
        drop_conn(&mut st);
        return;
    }
    drop_conn(&mut ST.lock().unwrap());
}

// ---- presence -> activity ----

/// Own presence -> parsed object, or null when VALORANT is not running.
async fn my_presence(ctx: &Ctx) -> Res<Value> {
    let r = ctx.riot.local("get", "chat/v4/presences", None).await?;
    let Some(list) = r["presences"].as_array() else { return Err(msg("Cannot read properties of undefined (reading 'filter')")) };
    let puuid = ctx.riot.state().puuid;
    let mine: Vec<&Value> = list.iter().filter(|p| puuid.as_deref().is_some_and(|id| p["puuid"] == id) && truthy(&p["private"])).collect();
    let Some(me) = mine.iter().find(|p| p["product"] == "valorant").or(mine.first()) else { return Ok(Value::Null) };
    // Buffer.from(x, 'base64') is lenient: skips whitespace and accepts missing padding.
    let b64: String = js::s(&me["private"]).chars().filter(|c| !c.is_whitespace()).collect();
    let lenient = base64::engine::GeneralPurpose::new(&base64::alphabet::STANDARD,
        base64::engine::GeneralPurposeConfig::new().with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent).with_decode_allow_trailing_bits(true));
    let raw = lenient.decode(b64).map_err(|e| msg(e.to_string()))?;
    Ok(serde_json::from_slice(&raw)?)
}

/// `str.toLowerCase().replace(/\b\w/g, c => c.toUpperCase())`
fn title_case(s: &str) -> String {
    let word = |c: char| c.is_ascii_alphanumeric() || c == '_';
    let mut prev = false;
    s.to_lowercase().chars().map(|c| { let up = word(c) && !prev; prev = word(c); if up { c.to_ascii_uppercase() } else { c } }).collect()
}

/// Rank names and icons from the current tier table.
async fn tier_info(ctx: &Ctx, tier: &Value) -> Value {
    if !truthy(tier) { return Value::Null; }
    let Ok(eps) = ctx.riot.val_api("competitivetiers").await else { return Value::Null };
    let Some(last) = eps.as_array().and_then(|a| a.last()) else { return Value::Null };
    let t = js::arr(&last["tiers"]).into_iter().find(|x| x["tier"].as_f64().is_some() && x["tier"].as_f64() == tier.as_f64());
    match t {
        Some(t) => json!({ "name": title_case(&js::s(&t["tierName"])), "icon": js::or(&t["largeIcon"], t["smallIcon"].clone()) }),
        None => Value::Null,
    }
}

/// `{ ...(await tierInfo(tier)), tier, rr }`
async fn rank_obj(ctx: &Ctx, tier: Value, rr: Value) -> Value {
    let mut o = tier_info(ctx, &tier).await.as_object().cloned().unwrap_or_default();
    o.insert("tier".into(), tier);
    o.insert("rr".into(), rr);
    Value::Object(o)
}

// Own rank (current act + RR, peak), cached for five minutes.
static RANK_CACHE: Lazy<Mutex<(i64, Value)>> = Lazy::new(|| Mutex::new((0, Value::Null)));
async fn my_rank(ctx: &Ctx) -> Value {
    { let c = RANK_CACHE.lock().unwrap(); if now_ms() - c.0 < 300000 { return c.1.clone(); } }
    let value = match scout::rank(ctx, &ctx.riot.puuid()).await {
        Ok(r) => json!({ "tier": r["current"]["tier"], "rr": r["current"]["rr"], "peak": r["peak"]["tier"] }),
        Err(_) => Value::Null,
    };
    *RANK_CACHE.lock().unwrap() = (now_ms(), value.clone());
    value
}

// The agent you're playing, from the live match (presence doesn't carry it).
static AGENT_CACHE: Lazy<Mutex<(Value, Value)>> = Lazy::new(|| Mutex::new((Value::Null, Value::Null)));
async fn my_agent(ctx: &Ctx) -> Value {
    let puuid = ctx.riot.puuid();
    let r: Res<Value> = async {
        let p = ctx.riot.glz("get", &format!("core-game/v1/players/{puuid}"), None).await?;
        { let c = AGENT_CACHE.lock().unwrap(); if c.0 == p["MatchID"] && truthy(&c.1) { return Ok(c.1.clone()); } }
        let m = ctx.riot.glz("get", &format!("core-game/v1/matches/{}", tpl(p.get("MatchID"))), None).await?;
        let cid = js::arr(&m["Players"]).into_iter().find(|x| x["Subject"] == puuid.as_str()).map(|x| x["CharacterID"].clone()).unwrap_or(Value::Null);
        let a = if truthy(&cid) {
            let agents = ctx.riot.val_api("agents?isPlayableCharacter=true").await?;
            js::arr(&agents).into_iter().find(|x| js::lower(&x["uuid"]) == js::lower(&cid))
        } else { None };
        let value = a.map(|a| json!({ "name": a["displayName"], "icon": a["displayIcon"] })).unwrap_or(Value::Null);
        *AGENT_CACHE.lock().unwrap() = (p["MatchID"].clone(), value.clone());
        Ok(value)
    }.await;
    r.unwrap_or(Value::Null)
}

fn put(o: &mut Map<String, Value>, k: &str, v: Option<&Value>) -> bool {
    // An undefined value still counts as a key for Object.keys, but JSON drops it.
    if let Some(v) = v { o.insert(k.into(), v.clone()); }
    true
}

/// Turns a session snapshot into a Discord activity. Shared by the live presence and the preview scenarios.
/// s: { phase: 'ingame'|'pregame'|'queue'|'lobby', mode, map: {name, image}, score: [a, b], agent: {name, icon},
///      rank: {name, rr, icon}, peak: {name}, level, party: [size, max], partyId, start }
fn format(s: &Value, cfg: &Value) -> Value {
    if !truthy(s) { return Value::Null; }
    let phase = s["phase"].as_str().unwrap_or("");
    let ingame = phase == "ingame";
    let live = ingame || phase == "pregame";
    if !live && !truthy(&cfg["showLobby"]) { return Value::Null; }
    let where_: Option<Value> = match phase { "ingame" => Some(Value::Null), "pregame" => Some(json!("Agent select")), "queue" => Some(json!("In queue")), "lobby" => Some(json!("Lobby")), _ => None };
    let details: Option<Value> = if ingame {
        let mut d: Option<Value> = if truthy(&cfg["showMode"]) { s.get("mode").cloned() } else { Some(json!("In a match")) };
        if truthy(&cfg["showScore"]) && truthy(&s["score"]) {
            d = Some(json!(format!("{} ({} – {})", tpl(d.as_ref()), tpl(s["score"].get(0)), tpl(s["score"].get(1)))));
        }
        if truthy(&cfg["showMap"]) && truthy(&s["map"]) {
            d = Some(json!(format!("{} · {}", tpl(d.as_ref()), tpl(s["map"].get("name")))));
        }
        d
    } else if truthy(&cfg["showMode"]) && truthy(&s["mode"]) {
        Some(json!(format!("{} · {}", tpl(where_.as_ref()), tpl(s.get("mode")))))
    } else { where_ };

    let mut parts: Vec<String> = Vec::new();
    let rank = &s["rank"];
    if truthy(&cfg["showRank"]) && truthy(rank) {
        parts.push(if !rank["rr"].is_null() { format!("{} ({} RR)", tpl(rank.get("name")), tpl(rank.get("rr"))) } else { join_str(rank.get("name")) });
    }
    if truthy(&cfg["showPeak"]) && truthy(&s["peak"]) { parts.push(format!("Peak {}", tpl(s["peak"].get("name")))); }
    if truthy(&cfg["showAgent"]) && truthy(&s["agent"]) && ingame { parts.push(join_str(s["agent"].get("name"))); }
    if truthy(&cfg["showLevel"]) && truthy(&s["level"]) { parts.push(format!("Lv {}", tpl(s.get("level")))); }
    if truthy(&cfg["showParty"]) && truthy(&s["party"]) {
        let p = &s["party"];
        parts.push(if js::num(&p[0]) > 1.0 { format!("{}/{}", tpl(p.get(0)), tpl(p.get(1))) } else { "Solo".into() });
    }

    let mut activity = Map::new();
    put(&mut activity, "details", details.as_ref());
    if !parts.is_empty() { activity.insert("state".into(), json!(parts.join(" · "))); }
    if truthy(&cfg["showElapsed"]) && truthy(&s["start"]) { activity.insert("timestamps".into(), json!({ "start": s["start"] })); }
    // Large image: agent (if chosen), else the map; the rank icon fills it when free, else sits in the small slot.
    let large: Option<(Option<&Value>, Option<&Value>)> = if truthy(&cfg["showAgent"]) && truthy(&cfg["agentImage"]) && truthy(&s["agent"]) && ingame {
        Some((s["agent"].get("icon"), s["agent"].get("name")))
    } else if truthy(&cfg["showMap"]) && truthy(&s["map"]["image"]) && ingame {
        Some((s["map"].get("image"), s["map"].get("name")))
    } else { None };
    let rank_icon = if truthy(&cfg["showRank"]) && truthy(&rank["icon"]) { Some((rank.get("icon"), rank.get("name"))) } else { None };
    let mut assets = Map::new();
    let mut any = false;
    if let Some((img, text)) = large {
        any |= put(&mut assets, "large_image", img); put(&mut assets, "large_text", text);
        if let Some((img, text)) = rank_icon { put(&mut assets, "small_image", img); put(&mut assets, "small_text", text); }
    } else if let Some((img, text)) = rank_icon {
        any |= put(&mut assets, "large_image", img); put(&mut assets, "large_text", text);
    }
    if any { activity.insert("assets".into(), Value::Object(assets)); }
    Value::Object(activity)
}

/// Snapshot of your current session from your own VALORANT presence (null when VALORANT is closed).
async fn snapshot(ctx: &Ctx, cfg: &Value) -> Value {
    let pv = my_presence(ctx).await.unwrap_or(Value::Null);
    if !truthy(&pv) { return Value::Null; }
    let mpd = &pv["matchPresenceData"];
    let ppd = &pv["partyPresenceData"];
    let lp = js::or(&js::or(&mpd["sessionLoopState"], pv["sessionLoopState"].clone()), json!("MENUS"));
    let queue = tpl(Some(&js::nullish(&js::nullish(&mpd["queueId"], pv["queueId"].clone()), json!("")))); // string key, like QUEUES[queue]
    let queue_v = js::nullish(&js::nullish(&mpd["queueId"], pv["queueId"].clone()), json!(""));
    let queued = ppd["partyState"] == "MATCHMAKING";
    let phase = if lp == "INGAME" { "ingame" } else if lp == "PREGAME" { "pregame" } else if queued { "queue" } else { "lobby" };
    let mode = match queue_name(&queue) { Some(n) => n.to_string(), None => if truthy(&queue_v) { cap(&queue) } else { "Custom Game".into() } };
    let mut s = Map::new();
    s.insert("phase".into(), json!(phase));
    s.insert("mode".into(), json!(mode));

    let map_url = js::or(&js::or(&mpd["matchMap"], ppd["partyOwnerMatchMap"].clone()), json!(""));
    if truthy(&map_url) && phase == "ingame" {
        if let Ok(maps) = ctx.riot.val_api("maps").await {
            if let Some(m) = js::arr(&maps).into_iter().find(|x| x["mapUrl"] == map_url) {
                s.insert("map".into(), json!({ "name": m["displayName"], "image": js::or(&m["listViewIcon"], m["splash"].clone()) }));
            }
        }
    }
    let ally = js::nullish(&ppd["partyOwnerMatchScoreAllyTeam"], pv["partyOwnerMatchScoreAllyTeam"].clone());
    let enemy = js::nullish(&ppd["partyOwnerMatchScoreEnemyTeam"], pv["partyOwnerMatchScoreEnemyTeam"].clone());
    if phase == "ingame" && !ally.is_null() && queue_v != "deathmatch" { s.insert("score".into(), json!([ally, enemy])); }
    if phase == "ingame" && truthy(&cfg["showAgent"]) { s.insert("agent".into(), my_agent(ctx).await); }
    if truthy(&cfg["showRank"]) || truthy(&cfg["showPeak"]) {
        let r = my_rank(ctx).await;
        if truthy(&r["tier"]) { s.insert("rank".into(), rank_obj(ctx, r["tier"].clone(), r["rr"].clone()).await); }
        if truthy(&r["peak"]) { s.insert("peak".into(), tier_info(ctx, &r["peak"]).await); }
    }
    s.insert("level".into(), js::nullish(&js::nullish(&pv["playerPresenceData"]["accountLevel"], pv["accountLevel"].clone()), Value::Null));
    let size = js::nullish(&ppd["partySize"], pv["partySize"].clone());
    let max = js::nullish(&js::nullish(&ppd["maxPartySize"], pv["maxPartySize"].clone()), json!(5));
    if !size.is_null() && js::num(&size) > 0.0 { s.insert("party".into(), json!([size, max])); }

    let key = format!("{phase}{queue}");
    let start = {
        let mut st = ST.lock().unwrap();
        if st.state_key.as_deref() != Some(key.as_str()) { st.state_key = Some(key); st.state_start = now_ms(); }
        st.state_start
    };
    s.insert("start".into(), json!(start));
    Value::Object(s)
}

async fn build(ctx: &Ctx, cfg: &Value) -> Value { format(&snapshot(ctx, cfg).await, cfg) }

/// Sample sessions for the preview tabs, using your real rank when available.
async fn scenario(ctx: &Ctx, name: &Value) -> Value {
    let (maps, agents, r) = tokio::join!(ctx.riot.val_api("maps"), ctx.riot.val_api("agents?isPlayableCharacter=true"), my_rank(ctx));
    let (maps, agents) = (js::arr(&maps.unwrap_or(Value::Null)), js::arr(&agents.unwrap_or(Value::Null)));
    let map = |n: &str| match maps.iter().find(|x| x["displayName"] == n) {
        Some(m) => json!({ "name": m["displayName"], "image": js::or(&m["listViewIcon"], m["splash"].clone()) }),
        None => json!({ "name": n }),
    };
    let agent = |n: &str| agents.iter().find(|x| x["displayName"] == n).map(|a| json!({ "name": a["displayName"], "icon": a["displayIcon"] })).unwrap_or(Value::Null);
    let rank = if truthy(&r["tier"]) { rank_obj(ctx, r["tier"].clone(), r["rr"].clone()).await } else { rank_obj(ctx, json!(25), json!(142)).await };
    let peak = tier_info(ctx, &js::or(&r["peak"], json!(26))).await;
    let now = now_ms();
    let base = json!({ "rank": rank, "peak": peak, "level": 212, "party": [3, 5], "start": now - 767000, "agent": agent("Jett") });
    let with = |extra: Value| crate::api::settings::merge(&base, &extra);
    match name.as_str().unwrap_or("") {
        "competitive" => with(json!({ "phase": "ingame", "mode": "Competitive", "map": map("Ascent"), "score": [9, 5] })),
        "deathmatch" => with(json!({ "phase": "ingame", "mode": "Deathmatch", "map": map("Abyss"), "party": [1, 5] })),
        "teamdm" => with(json!({ "phase": "ingame", "mode": "Team Deathmatch", "map": map("Piazza"), "score": [64, 51] })),
        "pregame" => with(json!({ "phase": "pregame", "mode": "Competitive", "start": now - 42000 })),
        "lobby" => with(json!({ "phase": "lobby", "mode": "Competitive", "start": now - 180000 })),
        "queue" => with(json!({ "phase": "queue", "mode": "Competitive", "start": now - 64000 })),
        _ => Value::Null,
    }
}

async fn tick(ctx: Ctx) {
    let cfg = load(&ctx)["discord"].clone();
    if !truthy(&cfg["enabled"]) {
        let has = ST.lock().unwrap().sock.is_some();
        if has { close().await; }
        return;
    }
    let r: Res<Value> = async {
        open(APP_ID).await?;
        let activity = build(&ctx, &cfg).await;
        send(activity.clone()).await?;
        Ok(activity)
    }.await;
    let mut st = ST.lock().unwrap();
    match r {
        Ok(activity) => { st.last_activity = activity; st.last_update = Some(now_ms()); st.last_error = None; }
        Err(e) => st.last_error = Some(e.to_string()),
    }
}

fn stop_loop() { if let Some(t) = ST.lock().unwrap().timer.take() { t.abort(); } }
fn start_loop(ctx: &Ctx) {
    stop_loop();
    let ctx = ctx.clone();
    // tick() now, then every 15 s, without waiting for the previous one (setInterval).
    let h = tokio::spawn(async move {
        loop {
            tokio::spawn(tick(ctx.clone()));
            tokio::time::sleep(Duration::from_millis(15000)).await;
        }
    });
    ST.lock().unwrap().timer = Some(h.abort_handle());
}

fn status(ctx: &Ctx) -> Value {
    let enabled = truthy(&load(ctx)["discord"]["enabled"]);
    let st = ST.lock().unwrap();
    let user = st.user.as_ref().map(|u| {
        let mut o = Map::new();
        for k in ["username", "id", "avatar"] { put(&mut o, k, u.get(k)); }
        Value::Object(o)
    }).unwrap_or(Value::Null);
    json!({
        "enabled": enabled, "connected": st.sock.is_some() && st.user.is_some(),
        "user": user, "error": st.last_error, "lastUpdate": st.last_update, "activity": st.last_activity,
    })
}

fn set_enabled(ctx: &Ctx, on: bool) -> Res<()> {
    let cur = load(ctx);
    let discord = merge(&cur["discord"], &json!({ "enabled": on }));
    let next = merge(&cur, &json!({ "discord": discord }));
    ctx.riot.write_store("settings", &next)?;
    // The Discord page's switch reads the settings, so tell the UI the saved value changed.
    ctx.emit("settings:changed", next);
    Ok(())
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("discord:status", |ctx, _| async move { Ok(status(&ctx)) });

    // The activity for a sample scenario ('competitive', 'deathmatch', ...), or as it would be sent right now ('live').
    reg.add("discord:preview", |ctx, a: Args| async move {
        let name = a.0.first().cloned().unwrap_or(json!("live")); // default parameter: only when the argument is missing
        let cfg = load(&ctx)["discord"].clone();
        let activity = if name == "live" { build(&ctx, &cfg).await } else { format(&scenario(&ctx, &name).await, &cfg) };
        Ok(json!({ "activity": activity }))
    });

    // Enables presence and connects now.
    reg.add("discord:connect", |ctx, _| async move {
        set_enabled(&ctx, true)?;
        ST.lock().unwrap().last_error = None;
        if let Err(e) = open(APP_ID).await {
            ST.lock().unwrap().last_error = Some(e.to_string());
            return Err(e);
        }
        start_loop(&ctx);
        tokio::time::sleep(Duration::from_millis(800)).await;
        Ok(status(&ctx))
    });

    reg.add("discord:disconnect", |ctx, _| async move {
        set_enabled(&ctx, false)?;
        stop_loop();
        close().await;
        { let mut st = ST.lock().unwrap(); st.last_activity = Value::Null; st.last_error = None; }
        Ok(status(&ctx))
    });

    // Resume on app start when it was enabled.
    if truthy(&load(ctx)["discord"]["enabled"]) {
        let ctx = ctx.clone();
        crate::core::spawn(async move {
            tokio::time::sleep(Duration::from_millis(4000)).await;
            start_loop(&ctx);
        });
    }
}
