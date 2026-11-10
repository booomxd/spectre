// Always-on-top transparent overlay window (the app's own bundle; the React app detects it by the window label "overlay").
// Shown without stealing focus from the game, toggled from the app or a global hotkey, optionally click-through
// ("locked") and optionally shown automatically while you're in agent select or a match.
use crate::api::settings;
use crate::core::error::{msg, Res};
use crate::core::{js, truthy, Args, Ctx, Registry};
use once_cell::sync::Lazy;
use serde_json::{json, Map, Value};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{Arc, Mutex};
use std::time::Duration;
use tauri::webview::PageLoadEvent;
use tauri::{Manager, WebviewWindow, WindowEvent};

// JS `let win`. Never call window methods while holding this lock (they may wait on the main thread, whose
// window-event handlers lock it too): clone the handle out with `win()`.
static WIN: Lazy<Mutex<Option<WebviewWindow>>> = Lazy::new(|| Mutex::new(None));

fn defaults() -> Value { json!({ "width": 340, "height": 480, "x": null, "y": 80 }) }
fn saved(ctx: &Ctx) -> Value { settings::merge(&defaults(), &ctx.riot.read_store("overlay", json!({}))) }
fn cfg(ctx: &Ctx) -> Value { settings::load(ctx)["overlay"].clone() }
fn win() -> Option<WebviewWindow> { WIN.lock().unwrap().clone() }
fn visible() -> bool { win().map(|w| w.is_visible().unwrap_or(false)).unwrap_or(false) }
fn state(ctx: &Ctx) -> Value { json!({ "open": visible(), "locked": truthy(&cfg(ctx)["locked"]) }) }

// Electron's getPosition / getSize are in DIPs (logical pixels); Tauri reports physical ones.
fn save_pos(ctx: &Ctx) {
    let Some(w) = win() else { return };
    let (Ok(scale), Ok(pos), Ok(size)) = (w.scale_factor(), w.outer_position(), w.outer_size()) else { return };
    let pos = pos.to_logical::<f64>(scale);
    let size = size.to_logical::<f64>(scale);
    let _ = ctx.riot.write_store("overlay", &json!({
        "x": js::round_i(pos.x), "y": js::round_i(pos.y), "width": js::round_i(size.width), "height": js::round_i(size.height),
    }));
}

// Native show / hide / click-through. tao drops its "don't focus" marker right after creating the window, so its
// show() (and any style change it applies to a visible window, e.g. set_ignore_cursor_events) ends in
// ShowWindow(SW_SHOW), which activates the overlay and can take focus from the game (a hotkey press gives the app
// foreground rights). Electron's showInactive / setIgnoreMouseEvents never activate, so these go straight to user32;
// tao's own visibility / cursor flags are never changed after creation, so it never re-applies styles over these.
#[cfg(windows)]
mod native {
    use std::ffi::c_void;
    type Hwnd = *mut c_void;
    #[link(name = "user32")]
    extern "system" {
        fn ShowWindow(hwnd: Hwnd, cmd: i32) -> i32;
        fn GetWindowLongW(hwnd: Hwnd, index: i32) -> i32;
        fn SetWindowLongW(hwnd: Hwnd, index: i32, value: i32) -> i32;
        fn SetWindowPos(hwnd: Hwnd, after: Hwnd, x: i32, y: i32, cx: i32, cy: i32, flags: u32) -> i32;
    }
    const SW_HIDE: i32 = 0;
    const SW_SHOWNOACTIVATE: i32 = 4;
    const GWL_EXSTYLE: i32 = -20;
    const WS_EX_TRANSPARENT: i32 = 0x20;
    const WS_EX_LAYERED: i32 = 0x80000;
    // SWP_NOSIZE | SWP_NOMOVE | SWP_NOZORDER | SWP_NOACTIVATE | SWP_FRAMECHANGED
    const SWP_REFRESH: u32 = 0x1 | 0x2 | 0x4 | 0x10 | 0x20;
    pub fn show_inactive(h: isize) { unsafe { ShowWindow(h as Hwnd, SW_SHOWNOACTIVATE); } }
    pub fn hide(h: isize) { unsafe { ShowWindow(h as Hwnd, SW_HIDE); } }
    // Same styles tao / Chromium use for ignoring the mouse.
    pub fn click_through(h: isize, on: bool) {
        unsafe {
            let ex = GetWindowLongW(h as Hwnd, GWL_EXSTYLE);
            let next = if on { ex | WS_EX_TRANSPARENT | WS_EX_LAYERED } else { ex & !(WS_EX_TRANSPARENT | WS_EX_LAYERED) };
            if next != ex {
                SetWindowLongW(h as Hwnd, GWL_EXSTYLE, next);
                SetWindowPos(h as Hwnd, std::ptr::null_mut(), 0, 0, 0, 0, SWP_REFRESH);
            }
        }
    }
    /// Runs `f(hwnd)` on the main (window) thread and waits for it, so state read right after sees the change.
    pub fn on_main(w: &tauri::WebviewWindow, f: impl FnOnce(isize) + Send + 'static) {
        let Ok(h) = w.hwnd() else { return };
        let h = h.0 as isize;
        let (tx, rx) = std::sync::mpsc::channel();
        if w.run_on_main_thread(move || { f(h); let _ = tx.send(()); }).is_ok() { let _ = rx.recv(); }
    }
}

// Click-through: the game gets every click while locked.
#[cfg(windows)]
fn lock_window(w: &WebviewWindow, ctx: &Ctx) {
    let locked = truthy(&cfg(ctx)["locked"]);
    native::on_main(w, move |h| native::click_through(h, locked));
}
#[cfg(not(windows))]
fn lock_window(w: &WebviewWindow, ctx: &Ctx) { let _ = w.set_ignore_cursor_events(truthy(&cfg(ctx)["locked"])); }
fn apply_lock(ctx: &Ctx) { if let Some(w) = win() { lock_window(&w, ctx); } }

// Electron's showInactive (SW_SHOWNOACTIVATE). Tauri has no show/hide window events, so the 'show' / 'hide' emits
// happen here.
fn show_inactive(w: &WebviewWindow, ctx: &Ctx) {
    #[cfg(windows)]
    native::on_main(w, native::show_inactive);
    #[cfg(not(windows))]
    let _ = w.show();
    ctx.emit("overlay:state", state(ctx));
}
fn hide_window(w: &WebviewWindow) {
    #[cfg(windows)]
    native::on_main(w, native::hide);
    #[cfg(not(windows))]
    let _ = w.hide();
}

fn create(ctx: &Ctx) -> Res<()> {
    let app = ctx.app()?;
    let s = saved(ctx);
    let dim = |k: &str| s[k].as_f64().unwrap_or_else(|| defaults()[k].as_f64().unwrap_or(0.0));
    let ready = Arc::new(AtomicBool::new(false));
    let c = ctx.clone();
    let mut b = tauri::WebviewWindowBuilder::new(app, "overlay", tauri::WebviewUrl::App("index.html".into()))
        // Must match the main window's additionalBrowserArgs in tauri.conf.json exactly: WebView2 refuses to
        // create a second webview with different browser arguments in the same data folder.
        .additional_browser_args(crate::BROWSER_ARGS)
        .title("Spectre")
        .inner_size(dim("width"), dim("height"))
        .visible(false)
        .decorations(false)
        .transparent(true)
        .always_on_top(true)
        .skip_taskbar(true)
        .shadow(false)
        .resizable(true)
        .min_inner_size(260.0, 160.0)
        .focused(false)
        // ready-to-show (once): lock, show without focus, tell the renderer.
        .on_page_load(move |w, p| {
            if p.event() != PageLoadEvent::Finished || ready.swap(true, Ordering::SeqCst) { return; }
            lock_window(&w, &c);
            show_inactive(&w, &c);
            c.emit("overlay:state", state(&c));
        });
    // Electron centers the window when x is missing.
    b = match (s["x"].as_f64(), s["y"].as_f64()) {
        (Some(x), Some(y)) => b.position(x, y),
        _ => b.center(),
    };
    let w = b.build().map_err(|e| msg(e.to_string()))?;
    *WIN.lock().unwrap() = Some(w.clone());
    let c = ctx.clone();
    w.on_window_event(move |e| match e {
        WindowEvent::Moved(_) | WindowEvent::Resized(_) => save_pos(&c),
        WindowEvent::Destroyed => {
            *WIN.lock().unwrap() = None;
            c.emit("overlay:state", state(&c));
        }
        _ => {}
    });
    Ok(())
}

// Shown without taking focus, so the game keeps keyboard and mouse.
fn show(ctx: &Ctx) -> Res<()> {
    let Some(w) = win() else { return create(ctx) };
    lock_window(&w, ctx);
    show_inactive(&w, ctx);
    Ok(())
}
fn hide(ctx: &Ctx) {
    if visible() {
        save_pos(ctx);
        if let Some(w) = win() { hide_window(&w); }
        ctx.emit("overlay:state", state(ctx));
    }
}
fn toggle(ctx: &Ctx) -> Res<()> { if visible() { hide(ctx); Ok(()) } else { show(ctx) } }
fn destroy(ctx: &Ctx) {
    if let Some(w) = win() { save_pos(ctx); let _ = w.destroy(); }
    *WIN.lock().unwrap() = None;
}

fn set_locked(ctx: &Ctx, locked: bool) -> Res<()> {
    let next = settings::update(ctx, &json!({ "overlay": { "locked": locked } }))?;
    ctx.emit("settings:changed", next);
    ctx.emit("overlay:state", state(ctx));
    Ok(())
}

// ---- global hotkeys ----
struct Hotkeys { registered: Vec<String>, paused: bool, hotkeys: Value }
static HK: Lazy<Mutex<Hotkeys>> = Lazy::new(|| Mutex::new(Hotkeys { registered: Vec::new(), paused: false, hotkeys: json!({}) }));

/// Electron accelerator -> global-hotkey syntax. The Settings page records Electron names; the only one the
/// parser doesn't know is "Return".
fn accelerator(key: &str) -> String {
    key.split('+').map(|k| if k.eq_ignore_ascii_case("return") { "Enter" } else { k }).collect::<Vec<_>>().join("+")
}

// Holding HK across the plugin calls (they run on the main thread) serializes re-registration like JS's single thread;
// nothing on the main thread locks HK (hotkey presses are handed to the async runtime).
fn register_hotkeys_locked(ctx: &Ctx, hk: &mut Hotkeys) {
    // Not running inside the app (spectre-try).
    let Some(app) = ctx.app.clone() else { return };
    use tauri_plugin_global_shortcut::{GlobalShortcutExt, ShortcutState};
    let gs = app.global_shortcut();
    for k in hk.registered.drain(..) { let _ = gs.unregister(accelerator(&k).as_str()); }
    let c = cfg(ctx);
    let mut hotkeys = Map::new();
    for (name, key) in [("toggle", c["hotkey"].clone()), ("lock", c["lockHotkey"].clone())] {
        let mut ok = Value::Null;
        if truthy(&key) && !hk.paused {
            let done = match key.as_str() {
                Some(k) => {
                    let cx = ctx.clone();
                    gs.on_shortcut(accelerator(k).as_str(), move |_, _, ev| {
                        if ev.state != ShortcutState::Pressed { return; }
                        let cx = cx.clone();
                        // Off the main thread: building the window or re-registering hotkeys from here would deadlock.
                        crate::core::spawn(async move {
                            let _ = if name == "toggle" { toggle(&cx) } else { set_locked(&cx, !truthy(&cfg(&cx)["locked"])) };
                        });
                    })
                    .is_ok()
                }
                None => false,
            };
            ok = json!(done);
            if done { hk.registered.push(key.as_str().unwrap_or_default().to_string()); }
        }
        hotkeys.insert(name.to_string(), json!({ "key": js::or(&key, json!("")), "ok": ok }));
    }
    hk.hotkeys = Value::Object(hotkeys);
    ctx.emit("overlay:hotkeys", hk.hotkeys.clone());
}
fn register_hotkeys(ctx: &Ctx) { register_hotkeys_locked(ctx, &mut HK.lock().unwrap()); }

// ---- auto show while in agent select or a match ----
static WAS_IN_MATCH: AtomicBool = AtomicBool::new(false);
static AUTO_SHOWN: AtomicBool = AtomicBool::new(false);

async fn in_match(ctx: &Ctx) -> bool {
    for p in ["core-game", "pregame"] {
        if let Ok(v) = ctx.riot.glz("get", &format!("{p}/v1/players/{}", ctx.riot.puuid()), None).await {
            if truthy(&v["MatchID"]) { return true; }
        }
    }
    false
}

async fn auto_tick(ctx: &Ctx) {
    if !truthy(&cfg(ctx)["autoShow"]) || !ctx.riot.connected() { return; }
    let now = in_match(ctx).await;
    let was = WAS_IN_MATCH.load(Ordering::SeqCst);
    // Only act when a match starts or ends, so hiding it by hand mid-match sticks.
    if now && !was && !visible() {
        if show(ctx).is_err() { return; } // JS: the throw ends the tick before anything is updated
        AUTO_SHOWN.store(true, Ordering::SeqCst);
    }
    if !now && was && AUTO_SHOWN.load(Ordering::SeqCst) { hide(ctx); AUTO_SHOWN.store(false, Ordering::SeqCst); }
    WAS_IN_MATCH.store(now, Ordering::SeqCst);
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    settings::on_change(|ctx, _next, patch| {
        let o = &patch["overlay"];
        if !truthy(o) { return; }
        if o.get("hotkey").is_some() || o.get("lockHotkey").is_some() { register_hotkeys(ctx); }
        if o.get("locked").is_some() { apply_lock(ctx); }
    });

    {
        let ctx = ctx.clone();
        crate::core::every(Duration::from_millis(5000), Duration::from_millis(5000), move || {
            let ctx = ctx.clone();
            async move { auto_tick(&ctx).await }
        });
    }

    register_hotkeys(ctx);
    // The overlay goes away with the app instead of keeping it alive on its own.
    if let Some(main) = ctx.app.as_ref().and_then(|a| a.get_webview_window("main")) {
        let c = ctx.clone();
        main.on_window_event(move |e| { if let WindowEvent::Destroyed = e { destroy(&c); } });
    }

    reg.add("overlay:state", |ctx, _| async move { Ok(state(&ctx)) });
    reg.add("overlay:toggle", |ctx, _| async move { toggle(&ctx)?; Ok(state(&ctx)) });
    reg.add("overlay:close", |ctx, _| async move { hide(&ctx); Ok(state(&ctx)) });
    reg.add("overlay:lock", |ctx, a: Args| async move { set_locked(&ctx, a.truthy(0))?; Ok(state(&ctx)) });
    reg.add("overlay:hotkeys", |_, _| async move { Ok(HK.lock().unwrap().hotkeys.clone()) });
    // Paused while the Settings page records a new key, so pressing the current combo doesn't fire it.
    reg.add("overlay:pauseHotkeys", |ctx, a: Args| async move {
        let mut hk = HK.lock().unwrap();
        hk.paused = a.truthy(0);
        register_hotkeys_locked(&ctx, &mut hk);
        Ok(hk.hotkeys.clone())
    });
}
