// Spectre's Tauri backend. The React app calls every backend channel through one `ipc` command, with the same
// channel names and arguments the Electron app used (2.4.x), and listens for events with the same names.
pub mod api;
pub mod core;
mod migrate;

use crate::core::error::msg;
use crate::core::riot::{data_dir, Riot};
use crate::core::{truthy, Args, Ctx, Registry};
use serde_json::{json, Value};
use std::sync::Arc;
use std::time::Duration;
use tauri::menu::{Menu, MenuItem};
use tauri::tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent};
use tauri::{Manager, WindowEvent};

pub struct Backend {
    pub ctx: Ctx,
    pub reg: Registry,
}

#[tauri::command]
async fn ipc(backend: tauri::State<'_, Arc<Backend>>, channel: String, args: Option<Vec<Value>>) -> Result<Value, String> {
    let b = backend.inner().clone();
    b.reg.call(b.ctx.clone(), &channel, args.unwrap_or_default()).await
}

fn main_window(ctx: &Ctx) -> core::error::Res<tauri::WebviewWindow> {
    ctx.app()?.get_webview_window("main").ok_or_else(|| msg("The main window is gone"))
}

/// Brings the main window back from the tray or the taskbar.
fn show_main(app: &tauri::AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.show();
        let _ = w.unminimize();
        let _ = w.set_focus();
    }
}

/// App-level channels: the Riot connection, opening links, and the frameless window's buttons.
pub fn register_core(reg: &mut Registry) {
    reg.add("riot:status", |ctx, _| async move { Ok(ctx.riot.status()) });
    reg.add("riot:connect", |ctx, _| async move { ctx.riot.connect().await });
    reg.add("app:openExternal", |ctx, a: Args| async move {
        use tauri_plugin_opener::OpenerExt;
        ctx.app()?.opener().open_url(a.str(0), None::<&str>).map_err(|e| msg(e.to_string()))?;
        Ok(Value::Null)
    });
    // With "Minimize to tray" on, minimizing hides Spectre to the tray instead of the taskbar.
    reg.add("win:minimize", |ctx, _| async move {
        let w = main_window(&ctx)?;
        if truthy(&api::settings::load(&ctx)["minimizeToTray"]) { w.hide()?; } else { w.minimize()?; }
        Ok(Value::Null)
    });
    reg.add("win:maximize", |ctx, _| async move {
        let w = main_window(&ctx)?;
        if w.is_maximized()? { w.unmaximize()?; } else { w.maximize()?; }
        Ok(Value::Null)
    });
    // With "Close to tray" on (the default), the close button hides Spectre to the tray; Quit in the tray menu exits.
    reg.add("win:close", |ctx, _| async move {
        if truthy(&api::settings::load(&ctx)["closeToTray"]) { main_window(&ctx)?.hide()?; } else { ctx.app()?.exit(0); }
        Ok(Value::Null)
    });
}

/// Keep trying to connect until the Riot Client is up, and tell the renderer when it changes.
fn connect_loop(ctx: Ctx) {
    core::spawn(async move {
        loop {
            if !ctx.riot.connected() {
                let status = match ctx.riot.connect().await { Ok(s) => s, Err(_) => ctx.riot.status() };
                ctx.emit("riot:status", status);
            }
            tokio::time::sleep(Duration::from_secs(if ctx.riot.connected() { 60 } else { 5 })).await;
        }
    });
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_autostart::init(tauri_plugin_autostart::MacosLauncher::LaunchAgent, Some(vec!["--minimized"])))
        .setup(|app| {
            let riot = Arc::new(Riot::new());
            riot.set_store_dir(data_dir().join("store"));
            let ctx = Ctx { riot, app: Some(app.handle().clone()), is_dev: cfg!(debug_assertions) };
            let mut reg = Registry::default();
            register_core(&mut reg);
            api::register_all(&mut reg, &ctx);
            app.manage(Arc::new(Backend { ctx: ctx.clone(), reg }));
            migrate::run(&ctx);

            // Launch at login is on by default. Keep the Windows startup entry in sync with the setting (this also
            // refreshes older entries so they pass --minimized). Dev builds never touch it.
            if !ctx.is_dev {
                use tauri_plugin_autostart::ManagerExt;
                let al = app.autolaunch();
                let _ = if truthy(&api::settings::load(&ctx)["launchAtLogin"]) { al.enable() } else { al.disable() };
            }
            // Started by Windows at login: stay in the tray. Otherwise show the window (it starts hidden).
            if !std::env::args().any(|a| a == "--minimized") {
                if let Some(w) = app.get_webview_window("main") { let _ = w.show(); let _ = w.set_focus(); }
            }

            // Tray: click (or "Show Spectre") brings the window back; used by "Minimize to tray".
            let show = MenuItem::with_id(app, "show", "Show Spectre", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            TrayIconBuilder::with_id("main")
                .icon(app.default_window_icon().cloned().expect("app icon"))
                .tooltip("Spectre")
                .menu(&Menu::with_items(app, &[&show, &quit])?)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, e| match e.id().as_ref() {
                    "show" => show_main(app),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, e| {
                    if let TrayIconEvent::Click { button: MouseButton::Left, button_state: MouseButtonState::Up, .. } = e { show_main(tray.app_handle()); }
                })
                .build(app)?;

            connect_loop(ctx);
            Ok(())
        })
        // Alt+F4 / taskbar close follow "Close to tray"; if the main window is really destroyed, Spectre quits.
        .on_window_event(|w, e| {
            if w.label() != "main" { return; }
            match e {
                WindowEvent::CloseRequested { api, .. } => {
                    let to_tray = w.app_handle().try_state::<Arc<Backend>>()
                        .map(|b| truthy(&api::settings::load(&b.ctx)["closeToTray"])).unwrap_or(false);
                    if to_tray { api.prevent_close(); let _ = w.hide(); }
                }
                WindowEvent::Destroyed => w.app_handle().exit(0),
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![ipc])
        .run(tauri::generate_context!())
        .expect("error while running Spectre");
}

/// Builds the backend without a window, for the spectre-try CLI.
pub fn headless() -> (Ctx, Registry) {
    let riot = Arc::new(Riot::new());
    riot.set_store_dir(std::env::temp_dir().join("spectre-try").join("store"));
    let ctx = Ctx { riot, app: None, is_dev: true };
    let mut reg = Registry::default();
    register_core(&mut reg);
    api::register_all(&mut reg, &ctx);
    (ctx, reg)
}

/// `{ ok, data }` / `{ ok: false, error }` like the Electron handlers, for the CLI's output.
pub fn envelope(r: Result<Value, String>) -> Value {
    match r { Ok(data) => json!({ "ok": true, "data": data }), Err(error) => json!({ "ok": false, "error": error }) }
}
