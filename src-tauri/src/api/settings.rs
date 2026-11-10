// App settings (one JSON store) plus small app helpers used by the Settings page.
use crate::core::error::{msg, Res};
use crate::core::{Args, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::sync::Mutex;

pub fn defaults() -> Value {
    json!({
        "launchAtLogin": true,
        "minimizeToTray": false,
        "closeToTray": true,
        "wishlistAlerts": true,
        "sessionAlerts": true,
        "overlay": {
            "opacity": 0.9, "scale": 1, "autoShow": false, "locked": false, "showPeak": true,
            "hotkey": "Ctrl+Shift+O", "lockHotkey": "Ctrl+Shift+L",
        },
        "discord": {
            "enabled": false, "showMode": true, "showMap": true, "showAgent": false, "agentImage": false, "showRank": true, "showPeak": false,
            "showLevel": false, "showParty": true, "showScore": true, "showElapsed": true, "showLobby": true,
        },
        "startPage": "dashboard",
        "spectrePresence": true,
    })
}

/// `{ ...a, ...b }` for two JSON objects (non-objects count as empty).
pub fn merge(a: &Value, b: &Value) -> Value {
    let mut out: Map<String, Value> = a.as_object().cloned().unwrap_or_default();
    if let Some(b) = b.as_object() { for (k, v) in b { out.insert(k.clone(), v.clone()); } }
    Value::Object(out)
}

/// `{ ...a, ...b }` with the nested overlay / discord groups merged one level deep.
fn merge_settings(a: &Value, b: &Value) -> Value {
    let mut out = merge(a, b);
    for group in ["overlay", "discord"] {
        out[group] = merge(&a[group], &b[group]);
    }
    out
}

/// Stored values merged over the defaults (one level deep for the nested groups).
pub fn load(ctx: &Ctx) -> Value {
    let stored = ctx.riot.read_store("settings", json!({}));
    merge_settings(&defaults(), if stored.is_object() { &stored } else { &Value::Null })
}

type Listener = Box<dyn Fn(&Ctx, &Value, &Value) + Send + Sync>;
static LISTENERS: Lazy<Mutex<Vec<Listener>>> = Lazy::new(|| Mutex::new(Vec::new()));

/// Other backend modules (e.g. the overlay's hotkeys) can react to saved changes: f(ctx, next, patch).
pub fn on_change(f: impl Fn(&Ctx, &Value, &Value) + Send + Sync + 'static) { LISTENERS.lock().unwrap().push(Box::new(f)); }

/// Saves a patch over the current settings and tells listeners. Returns the new settings.
pub fn update(ctx: &Ctx, patch: &Value) -> Res<Value> {
    let next = merge_settings(&load(ctx), patch);
    ctx.riot.write_store("settings", &next)?;
    for f in LISTENERS.lock().unwrap().iter() { f(ctx, &next, patch); }
    Ok(next)
}

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("settings:get", |ctx, _| async move { Ok(load(&ctx)) });

    reg.add("settings:set", |ctx, a: Args| async move {
        let patch = if a.val(0).is_object() { a.val(0) } else { json!({}) };
        let next = update(&ctx, &patch)?;
        if patch.get("launchAtLogin").is_some() {
            if let Some(app) = &ctx.app {
                use tauri_plugin_autostart::ManagerExt;
                let al = app.autolaunch();
                let _ = if crate::core::truthy(&next["launchAtLogin"]) { al.enable() } else { al.disable() };
            }
        }
        ctx.emit("settings:changed", next.clone());
        Ok(next)
    });

    reg.add("app:info", |ctx, _| async move {
        let version = ctx.app.as_ref().map(|a| a.package_info().version.to_string()).unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string());
        Ok(json!({
            "version": version,
            "dataPath": crate::core::riot::data_dir().to_string_lossy(),
            "tauri": tauri::VERSION,
            "platform": std::env::consts::OS,
        }))
    });

    reg.add("app:openDataFolder", |ctx, _| async move {
        use tauri_plugin_opener::OpenerExt;
        ctx.app()?.opener().open_path(crate::core::riot::data_dir().to_string_lossy(), None::<&str>).map_err(|e| msg(e.to_string()))?;
        Ok(Value::Null)
    });

    // Clears the in-memory content caches; saved settings, memos etc. are kept. The webview's own data isn't wiped:
    // WebView2 can only clear all of it at once, which would also lose the theme and other page preferences.
    reg.add("app:clearCache", |ctx, _| async move {
        ctx.riot.clear_api_cache();
        Ok(json!(true))
    });
}
