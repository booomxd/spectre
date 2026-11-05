# Spectre: Electron (Node) backend -> Tauri 2 (Rust) port guide

Repo: `C:\Users\shaur\ValoDaiv`, branch `tauri`. The React UI (`src/`) stays; it calls every backend channel through ONE
Rust command `ipc(channel, args)` and listens for events with the same names. Your job: port JS modules in `public/` to
Rust in `src-tauri/src/api/`, **behaving identically**: same channel names, same argument order, same JSON output
(field names, nesting, null vs missing, number values, ordering of arrays), same error texts, same caching and
background behavior, same privacy rules (streamer-mode players are never named). Do not "improve" behavior.

Already written (read them, don't change them unless your task says so; if you truly need a core change, explain it in
your result instead): `src-tauri/src/core/{mod.rs,error.rs,riot.rs,js.rs}`, `src-tauri/src/lib.rs`,
`src-tauri/src/api/{mod.rs,settings.rs}` (settings.rs is a complete reference port of public/api/settings.js; copy its style).
Signature stubs (filled by one agent, used by others): `src-tauri/src/api/known.rs`, `src-tauri/src/api/scout.rs`.

## The module shape
```rust
// Port of public/api/memo.js.  (keep a one-line header like the JS file's, then the JS comments where they help)
use crate::core::error::{msg, Res};
use crate::core::{js, truthy, Args, Ctx, Registry};
use serde_json::{json, Value};

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("memo:list", |ctx, _| async move { ... Ok(value) });
    reg.add("memo:get", |ctx, a: Args| async move { let puuid = a.str(0); ... });
    // background work (JS setInterval/setTimeout at load): use crate::core::every(delay, period, move || { let ctx = ctx.clone(); async move { ... } })
}
```
- Handlers return `Res<Value>` (`Result<Value, Error>`). Return `Ok(Value::Null)` where JS returned undefined/nothing.
- `Args`: `a.val(i)` (Value, Null if missing), `a.str(i)`, `a.opt_str(i)`, `a.truthy(i)`, `a.i64(i)`, `a.f64(i)`, `a.get::<T>(i)`.
- Module-level state (JS `let cache = ...` in the module closure) -> `static X: once_cell::sync::Lazy<std::sync::Mutex<...>>`
  (or `tokio::sync::Mutex` if held across `.await`). Never hold a std Mutex across `.await`.
- Shared singletons in JS (`require('../known')(riot)`, `require('../scout')(riot)`, `require('./settings')`) map to
  `crate::api::known::*`, `crate::api::scout::*`, `crate::api::settings::{load, update, on_change, defaults, merge}`.

## Riot / HTTP (`ctx.riot`, see core/riot.rs)
| JS | Rust |
| --- | --- |
| `riot.local('get', p, body)` | `ctx.riot.local("get", &p, None).await?` (body: `Some(json!(...))`) |
| `riot.pd / glz / shared` | `ctx.riot.pd("get", &p, None).await?` etc. |
| `riot.valApi('agents')` | `ctx.riot.val_api("agents").await?` (returns the `data` field) |
| `riot.names(list)` | `ctx.riot.names(&list).await?` -> `Map<puuid, {gameName, tagLine}>` |
| `riot.state.puuid / connected` | `ctx.riot.puuid()`, `ctx.riot.connected()`, `ctx.riot.state()` (copy: shard, region, game_name...) |
| `riot.readStore(n, fb) / writeStore` | `ctx.riot.read_store("n", json!({}))`, `ctx.riot.write_store("n", &v)?` |
| `riot.errMsg(e)` | `e.to_string()` |
| `err.response?.status` | `e.status()` (`Option<u16>`); `err.response?.data` -> `e.body()` |
| `axios.get(url)` (external) | `crate::core::riot::send(ctx.riot.http().get(url)).await?` (parsed JSON or string) |
| `Date.now()` | `crate::core::riot::now_ms()` |
| `Date.parse(iso)` | `js::parse_date(&v)` |
| `crypto.randomUUID()` | `uuid::Uuid::new_v4().to_string()` |
| `Promise.all([a, b])` | `tokio::join!(a, b)` / `futures::future::join_all` |
| limited-concurrency map keeping order | `futures::stream::iter(items).map(f).buffered(n).collect::<Vec<_>>().await` |
| `x.catch(() => null)` | `x.await.ok()` |
| `throw new Error('text')` | `return Err(msg("text"))` or `crate::bail!("text")` |
| `emit(ch, payload)` | `ctx.emit("ch", payload)` |

## JS semantics (core/js.rs) — use these, don't hand-roll
`v["a"]["b"]` on `serde_json::Value` behaves like `v?.a?.b` (Null when missing). `js::num` (Number()), `js::int`,
`js::s` (string or ""), `js::lower`, `js::or(a, default)` (`a || b`), `js::nullish` (`a ?? b`), `js::arr` (`v || []`),
`js::entries` (`Object.entries`), `truthy(&v)` (`!!v`), `js::round` / `js::round_i` (**Math.round**: halves go up — do not
use f64::round), `js::number(f64)` (integer-valued floats serialize as integers, like JS: `3` not `3.0`).
**Numbers matter**: JS `kills / deaths` that is whole prints `2`, not `2.0` — wrap computed f64s with `js::number`.
Keep JS's `toLowerCase()`s, `|| 0` defaults, `.filter(Boolean)`s, sort orders (JS sort is stable; use `sort_by` which is stable).
JSON object key order: serde_json has `preserve_order`, so `json!({...})` keeps the order you write — mirror the JS literal.

## Tauri-only pieces
- Windows: `ctx.app()?` is the `AppHandle` (None in the CLI -> those channels error there, that's fine).
  `use tauri::Manager;` -> `app.get_webview_window("main")`. New windows: `tauri::WebviewWindowBuilder::new(app, "overlay", tauri::WebviewUrl::App("index.html".into()))`.
  The React app detects the overlay by window label `overlay` (no `#/overlay` hash needed).
- Global hotkeys: `tauri_plugin_global_shortcut::GlobalShortcutExt` -> `app.global_shortcut().on_shortcut("Ctrl+Shift+O", |app, sc, ev| ...)`
  (fire on `ShortcutState::Pressed`), `.unregister(...)`. Electron accelerator strings like `Ctrl+Shift+O` parse the same.
- Open URL / folder: `tauri_plugin_opener::OpenerExt` (`app.opener().open_url(url, None::<&str>)`).
- Save dialog: `tauri_plugin_dialog::DialogExt` (`app.dialog().file().add_filter(..).blocking_save_file()` inside `tokio::task::spawn_blocking`).
- Launch at login: `tauri_plugin_autostart::ManagerExt`.
- Discord IPC pipe: `tokio::net::windows::named_pipe::ClientOptions::new().open(r"\\?\pipe\discord-ipc-0")`.
- Spawning an installer: `std::process::Command::new(path).spawn()`, then `app.exit(0)` after ~800 ms.

## Building and checking
From `C:\Users\shaur\ValoDaiv\src-tauri`: `cargo check --bin spectre-try` (fast; the app binary needs the built UI only at
`cargo build` time). Many agents share the target dir; cargo waits for the lock ("Blocking waiting for file lock") — that's
normal, just wait. Fix every error and warning in YOUR files. Don't touch other agents' files; if another file breaks the
build, wait a minute and retry (it's being edited), and report it if it persists.

## Comparing against the original (verify stage)
Both backends can be called from the command line against the live Riot Client (it is running on this PC):
- JS:   `cd C:\Users\shaur\ValoDaiv && node scripts/try.js <channel> '<jsonArg>' ...`
- Rust: `cd C:\Users\shaur\ValoDaiv\src-tauri && cargo run -q --bin spectre-try -- <channel> '<jsonArg>' ...`
Both use the same temp data folder (`%TEMP%\spectre-try\store`), never the user's real data.
**NEVER call channels that change anything on the account or send anything**: loadout:save, loadout:equip, loadout:presetApply,
social:addFriend, social:acceptRequest, social:declineRequest, social:cancelRequest, social:removeFriend, social:partyAccess,
social:invite, social:queue, social:matchmaking, social:ready, social:inviteCode, social:joinCode, social:partyRemove,
chat:send, tools:keep, tools:reset, tools:rank, tools:profile, tools:premier, tools:status, discord:connect, update:install,
overlay:* , win:*, app:openExternal, app:openDataFolder, playbooks:exportPng. Read-only and temp-store channels are fine.
Compare outputs structurally (same keys, types, array lengths, same values except time-varying ones like timestamps,
countdowns, live presence). Treat every difference as a bug in the Rust port unless the JS output is itself time-dependent.
