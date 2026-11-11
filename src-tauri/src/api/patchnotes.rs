// patch notes list from playvalorant.com's public news page data
use crate::core::error::{msg, Res};
use crate::core::{js, truthy, Args, Ctx, Registry};
use futures::future::{BoxFuture, FutureExt, Shared};
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::{Map, Value};
use std::sync::Mutex;

const BASE: &str = "https://playvalorant.com";
const URL: &str = "https://playvalorant.com/en-us/news/tags/patch-notes/";

type Notes = Shared<BoxFuture<'static, Res<Value>>>;
static CACHE: Lazy<Mutex<Option<Notes>>> = Lazy::new(|| Mutex::new(None));

static RE_DATA: Lazy<Regex> = Lazy::new(|| Regex::new(r#"<script id="__NEXT_DATA__"[^>]*>([\s\S]*?)</script>"#).unwrap());
static RE_TAG: Lazy<Regex> = Lazy::new(|| Regex::new(r"<[^>]*>").unwrap());
static RE_APOS: Lazy<Regex> = Lazy::new(|| Regex::new(r"&#39;|&apos;").unwrap());

fn strip(html: &Value) -> String {
    let s = if truthy(html) { js::s(html) } else { String::new() };
    let s = RE_TAG.replace_all(&s, "").replace("&amp;", "&");
    RE_APOS.replace_all(&s, "'").replace("&quot;", "\"").trim().to_string()
}

async fn fetch_notes(ctx: Ctx) -> Res<Value> {
    let req = ctx.riot.http().get(URL).timeout(std::time::Duration::from_secs(15)).header("User-Agent", "Mozilla/5.0");
    let res = crate::core::riot::send(req).await?;
    let text = match &res { Value::String(t) => t.clone(), other => other.to_string() };
    let Some(m) = RE_DATA.captures(&text).and_then(|c| c.get(1)) else { return Err(msg("Patch notes source changed (no page data)")) };
    let data: Value = serde_json::from_str(m.as_str())?;
    let blades = js::arr(&data["props"]["pageProps"]["page"]["blades"]);
    let items: Vec<Value> = blades.iter().filter(|b| b["items"].is_array()).flat_map(|b| js::arr(&b["items"])).collect();
    let mut out: Vec<Value> = items.iter().map(|i| {
        let link = js::s(&js::or(&i["action"]["payload"]["url"], Value::String(String::new())));
        let mut n = Map::new();
        if let Some(t) = i.get("title") { n.insert("title".into(), t.clone()); }
        n.insert("date".into(), js::or(&js::or(&i["publishedAt"], i["analytics"]["publishDate"].clone()), Value::Null));
        n.insert("image".into(), js::or(&js::or(&i["imageMedia"]["url"], i["media"]["url"].clone()), Value::Null));
        n.insert("description".into(), Value::String(strip(&i["description"]["body"])));
        n.insert("url".into(), Value::String(if link.starts_with("http") { link } else { format!("{BASE}{link}") }));
        Value::Object(n)
    }).filter(|n| truthy(&n["title"]) && n["url"] != BASE).collect();
    if out.is_empty() { return Err(msg("No patch notes found")); }
    // new Date(x): null -> 0, unparseable -> NaN
    let time = |v: &Value| -> f64 { if v.is_null() { 0.0 } else { js::parse_date(v).map(|t| t as f64).unwrap_or(f64::NAN) } };
    out.sort_by(|a, b| (time(&b["date"]) - time(&a["date"])).partial_cmp(&0.0).unwrap_or(std::cmp::Ordering::Equal));
    Ok(Value::Array(out))
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("patchnotes:list", |ctx, a: Args| async move {
        let fut = {
            let mut cache = CACHE.lock().unwrap();
            if cache.is_none() || a.truthy(0) {
                let f: BoxFuture<'static, Res<Value>> = async move {
                    let r = fetch_notes(ctx).await;
                    if r.is_err() { *CACHE.lock().unwrap() = None; }
                    r
                }.boxed();
                *cache = Some(f.shared());
            }
            cache.clone().unwrap()
        };
        fut.await
    });
}
