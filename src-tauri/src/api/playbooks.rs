// Strategy playbooks: folders (playbooks) of strategies, each with steps of board items. Port of public/api/playbooks.js.
use crate::api::memo::slice16;
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Args, Ctx, Registry};
use base64::Engine;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::{json, Map, Value};

fn load(ctx: &Ctx) -> Vec<Value> {
    match ctx.riot.read_store("playbooks", json!([])) { Value::Array(a) => a, _ => Vec::new() }
}

/// JS `a === b` where None is undefined (objects / arrays are never equal, numbers compare by value).
fn strict_eq(a: Option<&Value>, b: Option<&Value>) -> bool {
    match (a, b) {
        (None, None) => true,
        (Some(Value::Number(x)), Some(Value::Number(y))) => x.as_f64() == y.as_f64(),
        (Some(Value::Object(_)), _) | (Some(Value::Array(_)), _) => false,
        (Some(x), Some(y)) => x == y,
        _ => false,
    }
}

fn get_id(p: &Value) -> Option<&Value> { p.as_object().and_then(|o| o.get("id")) }

// JS `.` never matches a line terminator.
static DATA_URL: Lazy<Regex> = Lazy::new(|| Regex::new(r"^data:image/png;base64,([^\n\r\x{2028}\x{2029}]+)$").unwrap());

/// Node's lenient `Buffer.from(s, 'base64')`: accepts the url-safe alphabet, skips anything else, stops at '='.
fn node_base64(s: &str) -> Vec<u8> {
    let (mut out, mut acc, mut bits) = (Vec::new(), 0u32, 0u32);
    for c in s.chars() {
        let v = match c {
            'A'..='Z' => c as u32 - 'A' as u32,
            'a'..='z' => c as u32 - 'a' as u32 + 26,
            '0'..='9' => c as u32 - '0' as u32 + 52,
            '+' | '-' => 62,
            '/' | '_' => 63,
            '=' => break,
            _ => continue,
        };
        acc = (acc << 6) | v;
        bits += 6;
        if bits >= 8 { bits -= 8; out.push((acc >> bits) as u8); acc &= (1 << bits) - 1; }
    }
    out
}
static UNSAFE: Lazy<Regex> = Lazy::new(|| Regex::new(r#"[/:*?"<>|]+"#).unwrap());
static MEDIA: Lazy<Regex> = Lazy::new(|| Regex::new(r"^https://media\.valorant-api\.com/").unwrap());

async fn image_data(ctx: &Ctx, u: &str) -> Res<String> {
    let res = ctx.riot.http().get(u).timeout(std::time::Duration::from_secs(15)).send().await?;
    if !res.status().is_success() { return Err(msg(format!("Request failed with status code {}", res.status().as_u16()))); }
    let ty = res.headers().get("content-type").and_then(|h| h.to_str().ok()).filter(|s| !s.is_empty()).unwrap_or("image/png").to_string();
    let bytes = res.bytes().await?;
    Ok(format!("data:{ty};base64,{}", base64::engine::general_purpose::STANDARD.encode(&bytes)))
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("playbooks:list", |ctx, _| async move { Ok(Value::Array(load(&ctx))) });

    // Upsert a whole playbook by id.
    reg.add("playbooks:save", |ctx, a: Args| async move {
        let pb = a.val(0);
        if !truthy(&pb["id"]) { return Err(msg("Playbook id missing")); }
        let mut all = load(&ctx);
        match all.iter().position(|p| strict_eq(get_id(p), get_id(&pb))) {
            Some(i) => all[i] = pb.clone(),
            None => all.push(pb.clone()),
        }
        ctx.riot.write_store("playbooks", &Value::Array(all))?;
        Ok(json!({ "id": pb["id"], "savedAt": now_ms() }))
    });

    reg.add("playbooks:delete", |ctx, a: Args| async move {
        let id = a.0.first().cloned();
        let all: Vec<Value> = load(&ctx).into_iter().filter(|p| !strict_eq(get_id(p), id.as_ref())).collect();
        ctx.riot.write_store("playbooks", &Value::Array(all))?;
        Ok(json!(true))
    });

    // Saves a PNG data URL through a native save dialog.
    reg.add("playbooks:exportPng", |ctx, a: Args| async move {
        let p = a.val(0);
        let data_url = js::s(&js::or(&p["dataUrl"], json!("")));
        let b64 = DATA_URL.captures(&data_url).and_then(|c| c.get(1)).map(|m| m.as_str().to_string()).ok_or_else(|| msg("Invalid image data"))?;
        let name = crate::api::tools::js_string(&js::or(&p["name"], json!("strategy")));
        let safe = slice16(&UNSAFE.replace_all(&name, "-"), 80);
        let app = ctx.app()?.clone();
        let picked = tokio::task::spawn_blocking(move || {
            use tauri::Manager;
            use tauri_plugin_dialog::DialogExt;
            let mut d = app.dialog().file()
                .set_title("Export strategy image")
                .set_file_name(format!("{safe}.png"))
                .add_filter("PNG image", &["png"]);
            if let Some(w) = app.get_webview_window("main") { d = d.set_parent(&w); }
            d.blocking_save_file()
        }).await.map_err(|e| msg(e.to_string()))?;
        let Some(path) = picked.and_then(|p| p.into_path().ok()) else { return Ok(json!({ "canceled": true })) };
        std::fs::write(&path, node_base64(&b64))?;
        Ok(json!({ "saved": true, "path": path.to_string_lossy() }))
    });

    // valorant-api.com images have no CORS headers, so fetch them here as data URLs to keep the export canvas untainted.
    reg.add("playbooks:imageData", |ctx, a: Args| async move {
        let mut urls: Vec<String> = Vec::new();
        for u in js::arr(&a.val(0)) {
            let u = crate::api::tools::js_string(&u);
            if !urls.contains(&u) && MEDIA.is_match(&u) { urls.push(u); }
        }
        // Keys land in completion order, like the JS `out[u] = ...` inside Promise.all.
        let mut pending: futures::stream::FuturesUnordered<_> = urls.iter().map(|u| { let ctx = &ctx; async move { (u, image_data(ctx, u).await) } }).collect();
        let mut out = Map::new();
        while let Some((u, r)) = futures::StreamExt::next(&mut pending).await {
            // missing image: renderer draws a placeholder
            if let Ok(d) = r { out.insert(u.clone(), json!(d)); }
        }
        Ok(Value::Object(out))
    });
}
