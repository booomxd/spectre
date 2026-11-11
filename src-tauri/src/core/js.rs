// helpers that reproduce JavaScript semantics on serde_json values
use serde_json::{Map, Value};

/// JS `Number(v)` for the values Riot APIs return: null/false/missing -> 0, true -> 1, numeric strings parsed, NaN -> 0
pub fn num(v: &Value) -> f64 {
    match v {
        Value::Number(n) => n.as_f64().unwrap_or(0.0),
        Value::Bool(b) => if *b { 1.0 } else { 0.0 },
        Value::String(s) => s.trim().parse().unwrap_or(0.0),
        _ => 0.0,
    }
}

/// `num` truncated to an integer
pub fn int(v: &Value) -> i64 { num(v) as i64 }

/// the string value, or ""
pub fn s(v: &Value) -> String {
    match v {
        Value::String(x) => x.clone(),
        Value::Number(n) => n.to_string(),
        Value::Bool(b) => b.to_string(),
        _ => String::new(),
    }
}

/// lowercased string value (`(v || '').toLowerCase()`)
pub fn lower(v: &Value) -> String { s(v).to_lowercase() }

/// JS `a || b`: `a` if truthy, else `b`
pub fn or(a: &Value, b: Value) -> Value { if super::truthy(a) { a.clone() } else { b } }

/// JS `a ?? b`: `a` unless it is null/missing
pub fn nullish(a: &Value, b: Value) -> Value { if a.is_null() { b } else { a.clone() } }

/// the array's items (cloned), or empty if it isn't an array
pub fn arr(v: &Value) -> Vec<Value> { v.as_array().cloned().unwrap_or_default() }

/// the object's entries (cloned), or empty (`Object.entries(v || {})`), in insertion order
pub fn entries(v: &Value) -> Vec<(String, Value)> {
    v.as_object().map(|o| o.iter().map(|(k, v)| (k.clone(), v.clone())).collect()).unwrap_or_default()
}

/// empty JSON object
pub fn obj() -> Value { Value::Object(Map::new()) }

/// JS `Math.round`
pub fn round(x: f64) -> f64 { (x + 0.5).floor() }

/// `Math.round` as an integer JSON number
pub fn round_i(x: f64) -> i64 { round(x) as i64 }

/// A JSON number that stays an integer when it is one
pub fn number(x: f64) -> Value {
    if x.is_finite() && x.fract() == 0.0 && x.abs() < 9.0e15 { Value::from(x as i64) } else { serde_json::Number::from_f64(x).map(Value::Number).unwrap_or(Value::Null) }
}

/// milliseconds since the epoch for an ISO date string (`Date.parse`), or None
pub fn parse_date(v: &Value) -> Option<i64> {
    let t = v.as_str()?;
    chrono::DateTime::parse_from_rfc3339(t).ok().map(|d| d.timestamp_millis())
        .or_else(|| chrono::NaiveDateTime::parse_from_str(t, "%Y-%m-%dT%H:%M:%S%.f").ok().map(|d| d.and_utc().timestamp_millis()))
}
