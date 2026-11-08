// Friends, presences, friend requests and the current party.
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use base64::Engine;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::sync::Mutex;

/// JS `encodeURIComponent`.
fn enc(s: &str) -> String {
    let mut out = String::new();
    for b in s.bytes() {
        if b.is_ascii_alphanumeric() || b"-_.!~*'()".contains(&b) { out.push(b as char); } else { out.push_str(&format!("%{b:02X}")); }
    }
    out
}

/// JS `String(arg)` for a handler argument (undefined when missing).
fn js_string(v: Option<&Value>) -> String {
    match v {
        None => "undefined".into(),
        Some(Value::Null) => "null".into(),
        Some(Value::String(s)) => s.clone(),
        Some(v) => v.to_string(),
    }
}

/// Copies `src[key]` into `out[name]` only when present (JS leaves undefined fields out of the JSON).
fn put(out: &mut Map<String, Value>, name: &str, v: Option<&Value>) {
    if let Some(v) = v { out.insert(name.to_string(), v.clone()); }
}

/// `a || b || ... || default`.
fn or_chain(vals: &[&Value], default: Value) -> Value {
    vals.iter().find(|v| truthy(v)).map(|v| (*v).clone()).unwrap_or(default)
}

/// `a ?? b ?? ... ?? default`.
fn nullish_chain(vals: &[&Value], default: Value) -> Value {
    vals.iter().find(|v| !v.is_null()).map(|v| (*v).clone()).unwrap_or(default)
}

fn decode(p: &Value) -> Value {
    if !truthy(&p["private"]) { return Value::Null; }
    let Some(s) = p["private"].as_str() else { return Value::Null };
    // Lenient like Node's Buffer.from(s, 'base64'): url-safe chars allowed, junk skipped, stops at '=', no padding needed.
    let mut clean: String = s.chars().take_while(|&c| c != '=')
        .filter_map(|c| match c { '-' => Some('+'), '_' => Some('/'), c if c.is_ascii_alphanumeric() || c == '+' || c == '/' => Some(c), _ => None })
        .collect();
    if clean.len() % 4 == 1 { clean.pop(); }
    let engine = base64::engine::GeneralPurpose::new(&base64::alphabet::STANDARD,
        base64::engine::GeneralPurposeConfig::new().with_decode_allow_trailing_bits(true)
            .with_decode_padding_mode(base64::engine::DecodePaddingMode::Indifferent));
    engine.decode(clean).ok()
        .and_then(|b| serde_json::from_str(&String::from_utf8_lossy(&b)).ok())
        .unwrap_or(Value::Null)
}

// Normalises both the nested and the flat presence layouts.
fn flatten(d: &Value) -> Value {
    let (pl, pa, ma) = (&d["playerPresenceData"], &d["partyPresenceData"], &d["matchPresenceData"]);
    json!({
        "loop": or_chain(&[&ma["sessionLoopState"], &d["sessionLoopState"], &pa["partyOwnerSessionLoopState"]], json!("MENUS")),
        "map": or_chain(&[&ma["matchMap"], &d["matchMap"], &pa["partyOwnerMatchMap"]], json!("")),
        "queueId": or_chain(&[&ma["queueId"], &d["queueId"]], json!("")),
        "partyState": or_chain(&[&pa["partyState"], &d["partyState"]], json!("")),
        "partyId": or_chain(&[&d["partyId"], &pa["partyId"]], json!("")),
        "partySize": nullish_chain(&[&d["partySize"], &pa["partySize"]], json!(1)),
        "maxPartySize": nullish_chain(&[&d["maxPartySize"], &pa["maxPartySize"]], json!(5)),
        "ally": nullish_chain(&[&d["partyOwnerMatchScoreAllyTeam"], &pa["partyOwnerMatchScoreAllyTeam"]], json!(0)),
        "enemy": nullish_chain(&[&d["partyOwnerMatchScoreEnemyTeam"], &pa["partyOwnerMatchScoreEnemyTeam"]], json!(0)),
        "rank": nullish_chain(&[&pl["competitiveTier"], &d["competitiveTier"]], json!(0)),
        "level": nullish_chain(&[&pl["accountLevel"], &d["accountLevel"]], Value::Null),
        "card": or_chain(&[&pl["playerCardId"], &d["playerCardId"]], Value::Null),
        "idle": truthy(&d["isIdle"]),
        "spectre": truthy(&d["spectre"]),
    })
}

// puuid -> best presence (VALORANT first, then any other game; riot_client entries are skipped).
async fn presences(ctx: &Ctx) -> Res<HashMap<String, Value>> {
    let res = ctx.riot.local("get", "chat/v4/presences", None).await?;
    let mut out: HashMap<String, Value> = HashMap::new();
    for p in js::arr(&res["presences"]) {
        if !truthy(&p["puuid"]) || p["product"] == "riot_client" { continue; }
        let id = js::s(&p["puuid"]);
        if out.get(&id).is_some_and(|o| o["product"] == "valorant") { continue; }
        let d = if p["product"] == "valorant" { decode(&p) } else { Value::Null };
        let data = if truthy(&d) { flatten(&d) } else { Value::Null };
        out.insert(id, json!({ "product": p["product"], "chat": p["state"], "name": p["game_name"], "tag": p["game_tag"], "data": data }));
    }
    Ok(out)
}

async fn friends(ctx: &Ctx) -> Res<Value> {
    let (list, pres) = tokio::join!(ctx.riot.local("get", "chat/v4/friends", None), presences(ctx));
    let (list, pres) = (list?, pres?);
    let maps = ctx.riot.val_api("maps").await.unwrap_or_else(|_| json!([]));
    let map_name = |url: &Value| js::arr(&maps).into_iter().find(|m| &m["mapUrl"] == url)
        .map(|m| js::or(&m["displayName"], Value::Null)).unwrap_or(Value::Null);
    let rows = js::arr(&list["friends"]).into_iter().map(|f| {
        let p = pres.get(&js::s(&f["puuid"]));
        let d = p.map(|p| p["data"].clone()).unwrap_or(Value::Null);
        let mut state = "offline";
        if let Some(p) = p {
            if !d.is_null() {
                state = if truthy(&d["idle"]) || p["chat"] == "away" { "away" }
                    else if d["loop"] == "INGAME" { "ingame" }
                    else if d["loop"] == "PREGAME" { "pregame" }
                    else if d["partyState"] == "MATCHMAKING" { "queue" } else { "menus" };
            } else {
                state = if p["chat"] == "away" { "away" } else { "menus" };
            }
        }
        let mut o = Map::new();
        put(&mut o, "puuid", f.get("puuid"));
        put(&mut o, "pid", f.get("pid"));
        put(&mut o, "gameName", f.get("game_name"));
        put(&mut o, "tagLine", f.get("game_tag"));
        o.insert("online".into(), json!(p.is_some()));
        o.insert("product".into(), p.map(|p| js::or(&p["product"], Value::Null)).unwrap_or(Value::Null));
        o.insert("note".into(), js::or(&f["note"], json!("")));
        o.insert("spectre".into(), json!(truthy(&d["spectre"])));
        o.insert("lastOnline".into(), js::or(&f["last_online_ts"], Value::Null));
        let in_match = d["loop"] == "INGAME" || d["loop"] == "PREGAME";
        o.insert("status".into(), json!({
            "state": state, "queueId": js::or(&d["queueId"], Value::Null),
            "map": if in_match { map_name(&d["map"]) } else { Value::Null },
            "score": if d["loop"] == "INGAME" { json!([d["ally"], d["enemy"]]) } else { Value::Null },
            "partySize": js::nullish(&d["partySize"], json!(1)), "maxPartySize": js::nullish(&d["maxPartySize"], json!(5)),
            "rank": js::or(&d["rank"], json!(0)), "level": d["level"],
            "partyId": js::or(&d["partyId"], Value::Null), "card": js::or(&d["card"], Value::Null),
        }));
        Value::Object(o)
    }).collect::<Vec<_>>();
    Ok(Value::Array(rows))
}

async fn party_id(ctx: &Ctx) -> Res<Value> {
    let me = ctx.riot.glz("get", &format!("parties/v1/players/{}", ctx.riot.puuid()), None).await?;
    Ok(js::or(&me["CurrentPartyID"], Value::Null))
}

async fn in_party(ctx: &Ctx) -> Res<String> {
    let id = party_id(ctx).await?;
    if !truthy(&id) { return Err(msg("You are not in a party")); }
    Ok(js::s(&id))
}

// Party members' current ranks (the party data doesn't carry them), cached for five minutes.
static RANK_CACHE: Lazy<Mutex<HashMap<String, (i64, Value)>>> = Lazy::new(|| Mutex::new(HashMap::new()));

async fn rank_of(ctx: &Ctx, puuid: String) -> Value {
    if let Some((at, tier)) = RANK_CACHE.lock().unwrap().get(&puuid) {
        if now_ms() - at < 300000 { return tier.clone(); }
    }
    let tier = match crate::api::scout::rank(ctx, &puuid).await {
        Ok(r) if r["current"].is_object() => r["current"]["tier"].clone(),
        _ => json!(0),
    };
    RANK_CACHE.lock().unwrap().insert(puuid, (now_ms(), tier.clone()));
    tier
}

// Direct messages. A DM conversation id (cid) is the friend's pid, e.g. "<puuid>@jp1.pvp.net".
fn to_message(ctx: &Ctx, m: &Value) -> Value {
    let mut o = Map::new();
    put(&mut o, "id", m.get("id"));
    put(&mut o, "cid", m.get("cid"));
    put(&mut o, "body", m.get("body"));
    o.insert("time".into(), js::number(js::num(&m["time"])));
    put(&mut o, "puuid", m.get("puuid"));
    put(&mut o, "gameName", m.get("game_name"));
    put(&mut o, "tagLine", m.get("game_tag"));
    o.insert("fromMe".into(), json!(m["puuid"].as_str() == ctx.riot.state().puuid.as_deref()));
    Value::Object(o)
}

static DM_CID: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)^[0-9a-f-]{36}@[a-z0-9]+\.pvp\.net$").unwrap());

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("social:friends", |ctx, _| async move { friends(&ctx).await });

    // ---- Friend requests ----
    reg.add("social:requests", |ctx, _| async move {
        let res = ctx.riot.local("get", "chat/v4/friendrequests", None).await?;
        let (mut incoming, mut outgoing) = (Vec::new(), Vec::new());
        for r in js::arr(&res["requests"]) {
            let out = r["subscription"] == "pending_out";
            let mut o = Map::new();
            put(&mut o, "puuid", r.get("puuid"));
            put(&mut o, "gameName", r.get("game_name"));
            put(&mut o, "tagLine", r.get("game_tag"));
            o.insert("direction".into(), json!(if out { "out" } else { "in" }));
            if out { outgoing.push(Value::Object(o)) } else { incoming.push(Value::Object(o)) }
        }
        Ok(json!({ "incoming": incoming, "outgoing": outgoing }))
    });
    reg.add("social:addFriend", |ctx, a: Args| async move {
        if !a.truthy(0) || !a.truthy(1) { return Err(msg("Enter a Riot ID as Name#Tag")); }
        ctx.riot.local("post", "chat/v4/friendrequests", Some(json!({ "game_name": a.val(0), "game_tag": a.val(1) }))).await?;
        Ok(json!(true))
    });
    fn puuid_body(a: &Args) -> Value {
        let mut o = Map::new();
        put(&mut o, "puuid", a.0.first());
        Value::Object(o)
    }
    reg.add("social:acceptRequest", |ctx, a: Args| async move {
        ctx.riot.local("post", "chat/v4/friendrequests", Some(puuid_body(&a))).await?;
        Ok(json!(true))
    });
    // Decline (incoming) and cancel (outgoing) are the same DELETE.
    reg.add("social:declineRequest", |ctx, a: Args| async move {
        ctx.riot.local("delete", "chat/v4/friendrequests", Some(puuid_body(&a))).await?;
        Ok(json!(true))
    });
    reg.add("social:cancelRequest", |ctx, a: Args| async move {
        ctx.riot.local("delete", "chat/v4/friendrequests", Some(puuid_body(&a))).await?;
        Ok(json!(true))
    });
    reg.add("social:removeFriend", |ctx, a: Args| async move {
        ctx.riot.local("delete", "chat/v4/friends", Some(puuid_body(&a))).await?;
        Ok(json!(true))
    });

    // ---- Party ----
    reg.add("social:party", |ctx, _| async move {
        let id = party_id(&ctx).await?;
        if !truthy(&id) { return Ok(Value::Null); }
        let p = ctx.riot.glz("get", &format!("parties/v1/parties/{}", js::s(&id)), None).await?;
        let members = js::arr(&p["Members"]);
        // Streamer mode hides names, except yours and your friends' (the client shows those to you anyway).
        let me = ctx.riot.puuid();
        let friends = super::known::friend_puuids(&ctx).await.unwrap_or_default();
        let visible = |m: &Value| { let s = js::s(&m["Subject"]); s == me || friends.contains(&s) || !truthy(&m["PlayerIdentity"]["Incognito"]) };
        let shown: Vec<String> = members.iter().filter(|m| visible(m)).map(|m| js::s(&m["Subject"])).collect();
        let (names, ranks) = tokio::join!(
            ctx.riot.names(&shown),
            futures::future::join_all(members.iter().map(|m| rank_of(&ctx, js::s(&m["Subject"])))),
        );
        let names = names.unwrap_or_default();
        let i_own = members.iter().any(|m| m["Subject"] == me.as_str() && truthy(&m["IsOwner"]));
        let mm = &p["MatchmakingData"];
        let rows: Vec<Value> = members.iter().enumerate().map(|(i, m)| {
            let n = names.get(&js::s(&m["Subject"])).cloned().unwrap_or(Value::Null);
            let pi = &m["PlayerIdentity"];
            let mut o = Map::new();
            put(&mut o, "puuid", m.get("Subject"));
            o.insert("self".into(), json!(m["Subject"] == me.as_str()));
            o.insert("owner".into(), json!(truthy(&m["IsOwner"])));
            o.insert("ready".into(), json!(truthy(&m["IsReady"])));
            o.insert("hidden".into(), json!(!visible(m)));
            o.insert("gameName".into(), js::or(&n["gameName"], Value::Null));
            o.insert("tagLine".into(), js::or(&n["tagLine"], Value::Null));
            o.insert("card".into(), js::or(&pi["PlayerCardID"], Value::Null));
            o.insert("level".into(), if truthy(&pi["HideAccountLevel"]) { Value::Null } else { pi["AccountLevel"].clone() });
            o.insert("rank".into(), or_chain(&[&m["CompetitiveTier"], &ranks[i]], json!(0)));
            Value::Object(o)
        }).collect();
        let mut o = Map::new();
        put(&mut o, "id", p.get("ID"));
        put(&mut o, "state", p.get("State"));
        o.insert("open".into(), json!(p["Accessibility"] == "OPEN"));
        o.insert("iOwn".into(), json!(i_own));
        o.insert("queueId".into(), js::or(&mm["QueueID"], Value::Null));
        o.insert("queues".into(), js::or(&p["EligibleQueues"], json!([])));
        o.insert("inviteCode".into(), js::or(&p["InviteCode"], Value::Null));
        o.insert("members".into(), Value::Array(rows));
        Ok(Value::Object(o))
    });

    reg.add("social:partyAccess", |ctx, a: Args| async move {
        let id = in_party(&ctx).await?;
        let acc = if a.truthy(0) { "OPEN" } else { "CLOSED" };
        ctx.riot.glz("post", &format!("parties/v1/parties/{id}/accessibility"), Some(json!({ "accessibility": acc }))).await?;
        Ok(json!(true))
    });
    reg.add("social:invite", |ctx, a: Args| async move {
        let id = in_party(&ctx).await?;
        let path = format!("parties/v1/parties/{id}/invites/name/{}/tag/{}", enc(&js_string(a.0.first())), enc(&js_string(a.0.get(1))));
        ctx.riot.glz("post", &path, None).await?;
        Ok(json!(true))
    });
    // Lobby controls for your own party. Riot rejects them (with an error shown to the user) while a match is running.
    reg.add("social:queue", |ctx, a: Args| async move {
        let id = in_party(&ctx).await?;
        // The old makedefault?queueID= route now returns 404; the client uses POST .../queue with a JSON body.
        ctx.riot.glz("post", &format!("parties/v1/parties/{id}/queue"), Some(json!({ "queueID": js_string(a.0.first()) }))).await?;
        Ok(json!(true))
    });
    reg.add("social:matchmaking", |ctx, a: Args| async move {
        let id = in_party(&ctx).await?;
        ctx.riot.glz("post", &format!("parties/v1/parties/{id}/matchmaking/{}", if a.truthy(0) { "join" } else { "leave" }), None).await?;
        Ok(json!(true))
    });
    reg.add("social:ready", |ctx, a: Args| async move {
        let id = in_party(&ctx).await?;
        let path = format!("parties/v1/parties/{id}/members/{}/setReady", ctx.riot.puuid());
        ctx.riot.glz("post", &path, Some(json!({ "ready": a.truthy(0) }))).await?;
        Ok(json!(true))
    });
    reg.add("social:inviteCode", |ctx, a: Args| async move {
        let id = in_party(&ctx).await?;
        let create = a.truthy(0);
        let res = ctx.riot.glz(if create { "post" } else { "delete" }, &format!("parties/v1/parties/{id}/invitecode"), None).await?;
        Ok(if create { js::or(&res["InviteCode"], Value::Null) } else { Value::Null })
    });
    reg.add("social:joinCode", |ctx, a: Args| async move {
        let c = if a.truthy(0) { js_string(a.0.first()) } else { String::new() };
        let c = c.trim();
        if c.is_empty() { return Err(msg("Enter an invite code")); }
        ctx.riot.glz("post", &format!("parties/v1/players/joinbycode/{}", enc(c)), None).await?;
        Ok(json!(true))
    });

    // Leaving (own puuid) and kicking (another member, owner only) are the same DELETE.
    reg.add("social:partyRemove", |ctx, a: Args| async move {
        ctx.riot.glz("delete", &format!("parties/v1/players/{}", js_string(a.0.first())), None).await?;
        Ok(json!(true))
    });

    reg.add("chat:conversations", |ctx, _| async move {
        let (convs, msgs) = tokio::join!(
            ctx.riot.local("get", "chat/v6/conversations", None),
            ctx.riot.local("get", "chat/v6/messages", None),
        );
        let (convs, msgs) = (convs?, msgs?);
        let mut last: HashMap<String, Value> = HashMap::new();
        for m in js::arr(&msgs["messages"]) {
            let cid = js_string(m.get("cid"));
            let newer = match last.get(&cid) { None => true, Some(l) => js::num(&m["time"]) > js::num(&l["time"]) };
            if newer { last.insert(cid, m); }
        }
        let mut rows: Vec<(f64, Value)> = js::arr(&convs["conversations"]).into_iter()
            // DMs are type "chat" with a player pid as cid; party/team chats live on ares-* hosts.
            .filter(|c| c["type"] == "chat" && DM_CID.is_match(&js_string(c.get("cid"))))
            .map(|c| {
                let cid = js::s(&c["cid"]);
                let m = last.get(&cid).map(|m| to_message(&ctx, m));
                let time = m.as_ref().map(|m| js::num(&m["time"])).unwrap_or(0.0);
                let puuid = cid.split('@').next().unwrap_or_default().to_string();
                (time, json!({
                    "cid": cid, "puuid": puuid, "unread": js::or(&c["unread_count"], json!(0)),
                    "muted": truthy(&c["muted"]), "last": m.unwrap_or(Value::Null),
                }))
            })
            .collect();
        rows.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        Ok(Value::Array(rows.into_iter().map(|r| r.1).collect()))
    });

    reg.add("chat:messages", |ctx, a: Args| async move {
        let res = ctx.riot.local("get", &format!("chat/v6/messages?cid={}", enc(&js_string(a.0.first()))), None).await?;
        let mut rows: Vec<Value> = js::arr(&res["messages"]).iter().map(|m| to_message(&ctx, m)).collect();
        rows.sort_by(|a, b| js::num(&a["time"]).partial_cmp(&js::num(&b["time"])).unwrap_or(std::cmp::Ordering::Equal));
        Ok(Value::Array(rows))
    });

    reg.add("chat:send", |ctx, a: Args| async move {
        let body = if a.truthy(1) { js_string(a.0.get(1)) } else { String::new() };
        let body = body.trim().to_string();
        if body.is_empty() { return Err(msg("Message is empty")); }
        let mut req = Map::new();
        put(&mut req, "cid", a.0.first());
        req.insert("message".into(), json!(body));
        req.insert("type".into(), json!("chat"));
        let res = ctx.riot.local("post", "chat/v6/messages", Some(Value::Object(req))).await?;
        Ok(to_message(&ctx, &res))
    });
}
