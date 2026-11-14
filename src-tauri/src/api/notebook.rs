// notes page notebook: sections, each with free notes, crosshair codes, links and chat snippets
use crate::api::memo::slice16;
use crate::core::js::js_string;
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use rand::Rng;
use serde_json::{json, Value};

const SECTIONS: usize = 60;
const NAME: usize = 40;
const NOTES: usize = 3000;
const ITEMS: usize = 100;
const LABEL: usize = 60;
const CODE: usize = 400;
const URL: usize = 500;
const SNIPPET: usize = 300;
const COLORS: [&str; 9] = ["accent", "red", "orange", "yellow", "green", "teal", "blue", "purple", "pink"];
const ICONS: [&str; 8] = ["note", "target", "map", "star", "flag", "book", "zap", "users"];

/// `String(v ??
fn str_(v: &Value, max: usize) -> String { slice16(&js_string(&js::nullish(v, json!(""))), max) }

/// `Math.random().toString(36).slice(2, 10)`
fn random_id() -> String {
    const CH: &[u8] = b"0123456789abcdefghijklmnopqrstuvwxyz";
    let mut r = rand::thread_rng();
    (0..8).map(|_| CH[r.gen_range(0..36)] as char).collect()
}

fn id(v: &Value) -> String { let s = str_(v, 40); if s.is_empty() { random_id() } else { s } }

/// JS `x.id` on null throws
fn not_null(v: &Value) -> Res<()> { if v.is_null() { Err(msg("Cannot read properties of null (reading 'id')")) } else { Ok(()) } }

fn list(v: &Value, f: impl Fn(&Value) -> Value) -> Res<Vec<Value>> {
    js::arr(v).iter().take(ITEMS).map(|x| { not_null(x)?; Ok(f(x)) }).collect()
}

/// JS `String.prototype.trim` (whitespace + line terminators
fn js_trim(s: &str) -> &str {
    s.trim_matches(|c: char| matches!(c, '\t' | '\n' | '\u{b}' | '\u{c}' | '\r' | ' ' | '\u{a0}' | '\u{1680}' | '\u{2000}'..='\u{200a}'
        | '\u{2028}' | '\u{2029}' | '\u{202f}' | '\u{205f}' | '\u{3000}' | '\u{feff}'))
}

/// JS `Number(v)` (NaN for anything non-numeric)
fn js_number(v: &Value) -> f64 {
    match v {
        Value::Null => 0.0,
        Value::Bool(b) => if *b { 1.0 } else { 0.0 },
        Value::Number(n) => n.as_f64().unwrap_or(f64::NAN),
        Value::String(s) => {
            let t = js_trim(s);
            if t.is_empty() { return 0.0; }
            let radix = |p: &str, r: u32| if p.chars().all(|c| c.is_ascii_alphanumeric()) { u64::from_str_radix(p, r).map(|x| x as f64).unwrap_or(f64::NAN) } else { f64::NAN };
            let pre = |p: &str| t.len() > 2 && t.get(..2).is_some_and(|x| x.eq_ignore_ascii_case(p));
            match t {
                "Infinity" | "+Infinity" => f64::INFINITY,
                "-Infinity" => f64::NEG_INFINITY,
                _ if pre("0x") => radix(&t[2..], 16),
                _ if pre("0o") => radix(&t[2..], 8),
                _ if pre("0b") => radix(&t[2..], 2),
                _ if t.chars().all(|c| c.is_ascii_digit() || matches!(c, '+' | '-' | '.' | 'e' | 'E')) => t.parse().unwrap_or(f64::NAN),
                _ => f64::NAN,
            }
        }
        Value::Array(a) => match a.len() { 0 => 0.0, 1 => js_number(&json!(js_string(&a[0]))), _ => f64::NAN },
        Value::Object(_) => f64::NAN,
    }
}

fn one_of(v: &Value, options: &[&str], fallback: &str) -> String {
    match v.as_str() { Some(s) if options.contains(&s) => s.to_string(), _ => fallback.to_string() }
}

fn clean(s: &Value) -> Res<Value> {
    not_null(s)?;
    let name = js_trim(&str_(&s["name"], NAME)).to_string();
    let updated = js_number(&s["updatedAt"]);
    Ok(json!({
        "id": id(&s["id"]),
        "name": if name.is_empty() { "Untitled".to_string() } else { name },
        "color": one_of(&s["color"], &COLORS, "accent"),
        "icon": one_of(&s["icon"], &ICONS, "note"),
        "notes": str_(&s["notes"], NOTES),
        "crosshairs": list(&s["crosshairs"], |c| json!({ "id": id(&c["id"]), "name": str_(&c["name"], LABEL), "code": str_(&c["code"], CODE) }))?,
        "links": list(&s["links"], |l| json!({ "id": id(&l["id"]), "title": str_(&l["title"], LABEL), "url": str_(&l["url"], URL) }))?,
        "snippets": list(&s["snippets"], |t| json!({ "id": id(&t["id"]), "text": str_(&t["text"], SNIPPET) }))?,
        "updatedAt": if updated != 0.0 && !updated.is_nan() { js::number(updated) } else { json!(now_ms()) },
    }))
}

fn fresh() -> Value { json!({ "sections": [clean(&json!({ "id": "general", "name": "General" })).unwrap_or_default()] }) }

fn load(ctx: &Ctx) -> Value {
    let d = ctx.riot.read_store("notebook", Value::Null);
    let has = match &d["sections"] { Value::Array(a) => !a.is_empty(), Value::String(s) => !s.is_empty(), Value::Object(o) => o.get("length").is_some_and(truthy), _ => false };
    if has { d } else { fresh() }
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("notebook:get", |ctx, _| async move { Ok(load(&ctx)) });

    reg.add("notebook:save", |ctx, a: Args| async move {
        let doc = a.val(0);
        let sections: Vec<Value> = match &doc["sections"] {
            Value::Array(a) => a.iter().take(SECTIONS).map(clean).collect::<Res<_>>()?,
            Value::String(s) if !s.is_empty() => return Err(msg("((intermediate value) || []).slice(...).map is not a function")),
            v if truthy(v) => return Err(msg("((intermediate value) || []).slice is not a function")),
            _ => Vec::new(),
        };
        let saved = if sections.is_empty() { fresh() } else { json!({ "sections": sections }) };
        ctx.riot.write_store("notebook", &saved)?;
        Ok(saved)
    });

    reg.add("notebook:reset", |ctx, _| async move {
        let d = fresh();
        ctx.riot.write_store("notebook", &d)?;
        Ok(d)
    });
}
