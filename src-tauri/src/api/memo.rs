// player memos: notes, tags and a rating per puuid, stored in userData/memos.json
use crate::core::js::js_string;
use crate::core::error::msg;
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use serde_json::{json, Map, Value};

/// JS `s.slice(0, n)`
pub(crate) fn slice16(s: &str, n: usize) -> String {
    let units: Vec<u16> = s.encode_utf16().take(n).collect();
    String::from_utf16_lossy(&units)
}

fn load(ctx: &Ctx) -> Map<String, Value> {
    match ctx.riot.read_store("memos", json!({})) { Value::Object(o) => o, _ => Map::new() }
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("memo:list", |ctx, _| async move {
        let mut all: Vec<Value> = load(&ctx).into_iter().map(|(_, v)| v).collect();
        all.sort_by(|a, b| js::num(&b["updatedAt"]).partial_cmp(&js::num(&a["updatedAt"])).unwrap_or(std::cmp::Ordering::Equal));
        Ok(Value::Array(all))
    });

    reg.add("memo:get", |ctx, a: Args| async move {
        let key = js_string(&a.0.first().cloned().unwrap_or(json!("undefined")));
        Ok(js::or(load(&ctx).get(&key).unwrap_or(&Value::Null), Value::Null))
    });

    reg.add("memo:save", |ctx, a: Args| async move {
        let memo = a.val(0);
        if !truthy(&memo["puuid"]) { return Err(msg("Memo needs a puuid")); }
        let key = js_string(&memo["puuid"]);
        let mut all = load(&ctx);
        let old = all.get(&key).cloned().filter(truthy).unwrap_or_else(js::obj);
        let rating = match memo["rating"].as_f64() { Some(r) if r == -1.0 || r == 0.0 || r == 1.0 => js::number(r), _ => json!(0) };
        if truthy(&memo["tags"]) && !memo["tags"].is_array() { return Err(msg("(memo.tags || []).map is not a function")); }
        let mut tags: Vec<String> = Vec::new();
        for t in js::arr(&memo["tags"]) {
            let t = js_string(&t).trim().to_string();
            if !t.is_empty() && !tags.contains(&t) { tags.push(t); }
        }
        tags.truncate(12);
        let mut saved: Map<String, Value> = old.as_object().cloned().unwrap_or_default();
        saved.insert("puuid".into(), memo["puuid"].clone());
        saved.insert("name".into(), json!(slice16(&js_string(&js::or(&memo["name"], js::or(&old["name"], json!("")))), 64)));
        saved.insert("tags".into(), json!(tags));
        saved.insert("rating".into(), rating);
        saved.insert("text".into(), json!(slice16(&js_string(&js::or(&memo["text"], json!(""))), 2000)));
        saved.insert("updatedAt".into(), json!(now_ms()));
        if !memo["encounters"].is_null() { saved.insert("encounters".into(), memo["encounters"].clone()); }
        let saved = Value::Object(saved);
        all.insert(key, saved.clone());
        ctx.riot.write_store("memos", &Value::Object(all))?;
        Ok(saved)
    });

    reg.add("memo:delete", |ctx, a: Args| async move {
        let key = js_string(&a.0.first().cloned().unwrap_or(json!("undefined")));
        let mut all = load(&ctx);
        all.shift_remove(&key);
        ctx.riot.write_store("memos", &Value::Object(all))?;
        Ok(json!(true))
    });
}
