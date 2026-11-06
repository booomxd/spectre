// Battle pass, agent contracts, account XP and competitive history.
use crate::core::{js, truthy, Args, Ctx, Registry};
use serde_json::{json, Map, Value};
use std::collections::HashMap;

/// `{ k: src.k, ... }` where a missing source property stays undefined (left out of the JSON), like JS.
fn pick(src: &Value, keys: &[(&str, &str)]) -> Map<String, Value> {
    let mut o = Map::new();
    for (k, sk) in keys { if let Some(v) = src.get(*sk) { o.insert(k.to_string(), v.clone()); } }
    o
}

/// JS `Number(x)` for a handler argument (NaN for unparseable strings).
fn number_arg(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::Bool(b) => if *b { 1.0 } else { 0.0 },
        Value::String(s) => if s.trim().is_empty() { 0.0 } else { s.trim().parse().unwrap_or(f64::NAN) },
        Value::Null => 0.0,
        _ => f64::NAN,
    }
}

/// JS `Number(obj.k)` in arithmetic: a missing property is NaN, null is 0.
fn prop_num(obj: &Value, k: &str) -> f64 { obj.get(k).map_or(f64::NAN, number_arg) }

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("progression:contracts", |ctx, _| async move {
        let path = format!("contracts/v1/contracts/{}", ctx.riot.puuid());
        let (c, defs) = tokio::join!(ctx.riot.pd("get", &path, None), ctx.riot.val_api("contracts"));
        let (c, defs) = (c?, defs?);
        let mut by_id: HashMap<String, Value> = HashMap::new();
        for d in js::arr(&defs) { by_id.insert(js::s(&d["uuid"]), d); }
        let rows: Vec<Value> = js::arr(&c["Contracts"]).iter().map(|ct| {
            let def = ct.get("ContractDefinitionID").and_then(|id| by_id.get(&js::s(id))).cloned().unwrap_or(Value::Null);
            let prog = &ct["ContractProgression"];
            let rel = &def["content"]["relationType"];
            let mut o = Map::new();
            if let Some(v) = ct.get("ContractDefinitionID") { o.insert("id".into(), v.clone()); }
            o.insert("name".into(), js::or(&def["displayName"], json!("Contract")));
            o.insert("type".into(), js::or(rel, Value::Null));
            let rel_uuid = |kind: &str| if rel == kind { def["content"].get("relationUuid").cloned() } else { Some(Value::Null) };
            if let Some(v) = rel_uuid("Agent") { o.insert("agentId".into(), v); }
            if let Some(v) = rel_uuid("Season") { o.insert("seasonId".into(), v); }
            o.insert("xp".into(), js::or(&prog["TotalProgressionEarned"], json!(0)));
            o.insert("towardsNext".into(), js::or(&ct["ProgressionTowardsNextLevel"], json!(0)));
            o.insert("progressionLevel".into(), js::or(&ct["ProgressionLevelReached"], json!(0)));
            // levels: each chapter has levels with xp + reward
            let chapters: Vec<Value> = js::arr(&def["content"]["chapters"]).iter().map(|ch| {
                let mut co = pick(ch, &[("isEpilogue", "isEpilogue")]);
                let levels: Vec<Value> = js::arr(&ch["levels"]).iter().map(|l| {
                    let mut lo = pick(l, &[("xp", "xp"), ("vpCost", "vpCost"), ("doughCost", "doughCost"), ("isPurchasableWithVP", "isPurchasableWithVP")]);
                    let reward = if truthy(&l["reward"]) { Value::Object(pick(&l["reward"], &[("type", "type"), ("uuid", "uuid"), ("amount", "amount")])) } else { Value::Null };
                    lo.insert("reward".into(), reward);
                    Value::Object(lo)
                }).collect();
                co.insert("levels".into(), Value::Array(levels));
                let free: Vec<Value> = js::arr(&ch["freeRewards"]).iter()
                    .map(|r| Value::Object(pick(r, &[("type", "type"), ("uuid", "uuid"), ("amount", "amount")]))).collect();
                co.insert("freeRewards".into(), Value::Array(free));
                Value::Object(co)
            }).collect();
            o.insert("chapters".into(), Value::Array(chapters));
            Value::Object(o)
        }).collect();
        Ok(json!({ "active": js::or(&c["ActiveSpecialContract"], Value::Null), "contracts": rows }))
    });

    reg.add("progression:account", |ctx, _| async move {
        let x = ctx.riot.pd("get", &format!("account-xp/v1/players/{}", ctx.riot.puuid()), None).await?;
        let history: Vec<Value> = js::arr(&x["History"]).iter().take(10).map(|h| {
            let mut o = pick(h, &[("id", "MatchID"), ("start", "MatchStart")]);
            let xp = if truthy(&h["StartProgress"]) && truthy(&h["EndProgress"]) {
                // NaN (a missing XP) serializes as null
                js::number(prop_num(&h["EndProgress"], "XP") - prop_num(&h["StartProgress"], "XP"))
            } else { json!(0) };
            o.insert("xp".into(), xp);
            Value::Object(o)
        }).collect();
        Ok(json!({ "level": js::or(&x["Progress"]["Level"], json!(0)), "xp": js::or(&x["Progress"]["XP"], json!(0)), "history": history }))
    });

    reg.add("progression:rrHistory", |ctx, a: Args| async move {
        let count = if a.0.is_empty() { 20.0 } else { number_arg(&a.val(0)) };
        let end = if count.is_nan() { f64::NAN } else { count.min(20.0) };
        let end = if end.is_nan() { "NaN".to_string() } else { js::number(end).to_string() };
        let r = ctx.riot.pd("get", &format!("mmr/v1/players/{}/competitiveupdates?startIndex=0&endIndex={end}&queue=competitive", ctx.riot.puuid()), None).await?;
        let mut out: Vec<Value> = js::arr(&r["Matches"]).iter().filter(|m| !m["TierAfterUpdate"].is_null() && truthy(&m["MapID"])).map(|m| {
            let mut o = pick(m, &[
                ("id", "MatchID"), ("mapId", "MapID"), ("time", "MatchStartTime"), ("tierBefore", "TierBeforeUpdate"), ("tierAfter", "TierAfterUpdate"),
                ("rrBefore", "RankedRatingBeforeUpdate"), ("rrAfter", "RankedRatingAfterUpdate"), ("change", "RankedRatingEarned"),
            ]);
            // absolute RR on the ladder: tier*100 + rr (Radiant/Immortal keep counting upward)
            let ladder = js::number(prop_num(m, "TierAfterUpdate") * 100.0 + prop_num(m, "RankedRatingAfterUpdate"));
            o.insert("ladder".into(), ladder);
            Value::Object(o)
        }).collect();
        out.reverse();
        Ok(Value::Array(out))
    });
}
