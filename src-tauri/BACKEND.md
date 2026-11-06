# Spectre backend (Rust, Tauri 2)

The React UI (`src/`) calls every backend channel through ONE Tauri command, `ipc(channel, args)`
(`src/lib/ipc.js` > `invoke('memo:get', puuid)`), and listens for backend events by name (`useEvent('settings:changed', fn)`).
Channel names, argument order and JSON shapes are the same ones the Electron app (2.4.x) used, so the UI did not change.

## Layout
- `src/lib.rs`: app setup (window, tray, plugins), the `ipc` command, `register_core` (Riot connection,
  opening links, window buttons), `headless()` for the CLI.
- `src/core/`: `mod.rs` (`Ctx`, `Args`, `Registry`, `truthy`, `spawn`, `every`), `error.rs` (`Res`, `msg`, `bail!`),
  `riot.rs` (Riot Client lockfile, local/pd/glz/shared APIs, valorant-api.com, the JSON store in `%APPDATA%\Spectre\store`),
  `js.rs` (JavaScript-style value helpers).
- `src/api/`: one module per feature area, all registered in `api/mod.rs` > `register_all`.
- `src/migrate.rs` and `windows/installer-hooks.nsh`: one-time migration from the Electron install (see below).
- `src/bin/try.rs`: the `spectre-try` CLI.

## The module shape
```rust
// Player memos: notes, tags and a rating per puuid.
use crate::core::error::{msg, Res};
use crate::core::{js, truthy, Args, Ctx, Registry};
use serde_json::{json, Value};

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("memo:list", |ctx, _| async move { ... Ok(value) });
    reg.add("memo:get", |ctx, a: Args| async move { let puuid = a.str(0); ... });
    // background work: crate::core::every(delay, period, move || { let ctx = ctx.clone(); async move { ... } })
}
```
Adding a channel: `reg.add("area:name", ...)` in the right `api/*.rs` (or a new module added to `api/mod.rs`), then call
it from the UI with `invoke('area:name', ...args)`. No Tauri command or capability change is needed.

- Handlers return `Res<Value>`; the UI receives the data, or the error text as a thrown `Error`. Return `Ok(Value::Null)`
  for "nothing".
- `Args`: `a.val(i)` (Null if missing), `a.str(i)`, `a.opt_str(i)`, `a.truthy(i)`, `a.i64(i)`, `a.f64(i)`, `a.get::<T>(i)`.
- Module state: `static X: once_cell::sync::Lazy<std::sync::Mutex<...>>` (or `tokio::sync::Mutex` when held across
  `.await`). Never hold a std Mutex across `.await`.
- Shared pieces: `crate::api::known` (names of streamer-mode players), `crate::api::scout`, and
  `crate::api::settings::{load, update, on_change, defaults, merge}`.
- Events: `ctx.emit("channel", payload)` reaches every window.

## Riot / HTTP (`ctx.riot`, core/riot.rs)
- `ctx.riot.local("get", &path, None).await?` (body: `Some(json!(...))`); `pd`, `glz`, `shared` the same way.
- `ctx.riot.val_api("agents").await?` (the `data` field of valorant-api.com), `ctx.riot.names(&puuids).await?`.
- `ctx.riot.puuid()`, `connected()`, `state()` (shard, region, game name...).
- `ctx.riot.read_store("name", json!({}))` / `write_store("name", &v)?` for files in the store folder.
- Errors: `e.status()` (`Option<u16>`), `e.body()`. External HTTP: `crate::core::riot::send(ctx.riot.http().get(url)).await?`.
- Time: `crate::core::riot::now_ms()`, `js::parse_date(&v)`.

## JSON semantics (core/js.rs)
The UI was written against JavaScript values, so keep their behavior: `v["a"]["b"]` is Null when missing (like `v?.a?.b`),
`js::num`, `js::int`, `js::s`, `js::lower`, `js::or` (`a || b`), `js::nullish` (`a ?? b`), `js::arr`, `js::entries`,
`truthy(&v)`, `js::round` / `js::round_i` (halves go up, unlike `f64::round`), `js::number(f64)` (whole numbers serialize
as `3`, not `3.0`; wrap computed floats with it). serde_json has `preserve_order`, so `json!({...})` keeps the key order
you write.

## Tauri pieces
- `ctx.app()?` is the `AppHandle` (an error in the CLI, so window/dialog channels don't work there).
  `app.get_webview_window("main")`; the overlay window has label `overlay` (the UI detects it by label).
- Global hotkeys: `tauri_plugin_global_shortcut` (the Settings page records accelerator strings like `Ctrl+Shift+O`;
  `api/overlay.rs` converts them). Links/folders: `tauri_plugin_opener`. Save dialog: `tauri_plugin_dialog` (inside
  `spawn_blocking`). Launch at login: `tauri_plugin_autostart`.

## spectre-try (calling channels without a window)
From `src-tauri/`, with the Riot Client running:
```
cargo run -q --bin spectre-try -- --list
cargo run -q --bin spectre-try -- <channel> '<jsonArg1>' '<jsonArg2>' ...
```
Prints `{ "ok": true, "data": ... }` or `{ "ok": false, "error": ... }`. It stores data in `%TEMP%\spectre-try\store`,
never in the real `%APPDATA%\Spectre`. `cargo check --bin spectre-try` is the fastest build check.

**Never call channels that change the account or send anything** from the CLI: loadout:save, loadout:equip,
loadout:presetApply, social:addFriend, social:acceptRequest, social:declineRequest, social:cancelRequest,
social:removeFriend, social:partyAccess, social:invite, social:queue, social:matchmaking, social:ready,
social:inviteCode, social:joinCode, social:partyRemove, chat:send, tools:keep, tools:reset, tools:rank, tools:profile,
tools:premier, tools:status, discord:connect, update:install, overlay:*, win:*, app:openExternal, app:openDataFolder,
playbooks:exportPng. Read-only and store-only channels are fine.

## Migration from Electron
Spectre 2.4.x (Electron, electron-builder NSIS oneClick, per-user) updates by downloading the newest GitHub release asset
matching `/setup.*\.exe$/i` (Tauri names it `Spectre_<ver>_x64-setup.exe`), starting it with no arguments and quitting
~800 ms later. `tauri.conf.json` > `bundle.windows.nsis.installerHooks` points at `windows/installer-hooks.nsh`:
- `NSIS_HOOK_PREINSTALL` (before any file is copied): reads
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\30f18f89-1d16-50ed-ad44-867d3f1d6e05` (electron-builder's
  UUIDv5 of appId `com.spectre.app`) and `HKCU\Software\30f18f89-...\InstallLocation` (normally
  `%LOCALAPPDATA%\Programs\spectre`). If present: waits up to ~10 s for the old `Spectre.exe` to be released, copies
  `Uninstall Spectre.exe` to `$PLUGINSDIR` and runs `/S /currentuser --updated /KEEP_APP_DATA _?=<dir>` with ExecWait
  (up to 3 tries; falls back to running in place). `--updated` keeps app data and makes the old uninstaller close a
  still-running Electron app without a prompt; the old shortcuts and uninstall entry are removed. Failures are tolerated
  (the Tauri install continues). A stale key (exe and uninstaller both gone) is deleted. It refuses to target `$INSTDIR`
  or `%APPDATA%\Spectre`.
- Autostart: Electron's `HKCU\...\Run "electron.app.Spectre"` (+ its `StartupApproved\Run` value) is deleted; if it was
  present and not disabled in Task Manager, `NSIS_HOOK_POSTINSTALL` writes `Run "Spectre" = "<instdir>\spectre.exe "`,
  the name/format tauri-plugin-autostart uses, so "Launch at login" survives. `src/migrate.rs` repeats this check on
  first run.
- User data (`%APPDATA%\Spectre\store`, `core/riot.rs data_dir()`) is never touched. Tauri's own keys
  (`Uninstall\Spectre`, `$LOCALAPPDATA\Spectre`) differ from Electron's, so the hook is a no-op on clean machines and on
  later Tauri -> Tauri updates.

Testing that update path end to end: `UPDATE-TEST.md`.
