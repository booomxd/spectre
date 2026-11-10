# Development

## Setup

Requirements:
- Windows 10 or 11, with the Riot Client installed (sign in to test anything that talks to Riot).
- Node.js 18 or newer.
- Rust (stable, `x86_64-pc-windows-msvc`) from [rustup](https://rustup.rs).
- Visual Studio Build Tools with the "Desktop development with C++" workload (the MSVC linker and Windows SDK).
- Microsoft Edge WebView2 Runtime (already installed on Windows 11 and up-to-date Windows 10).

```
npm install
npm run app
```

`npm run app` (`tauri dev`) starts Vite on `http://localhost:5173`, builds the Rust backend and opens the app pointed at
Vite. React changes hot-reload; Rust changes rebuild and restart the app automatically.

## Architecture

```
src/                 React UI
  nav.js             Page registry: dock sections, sub-pages, ids and components
  lib/ipc.js         invoke(), useInvoke() and useEvent() for talking to the backend
  lib/theme.js       Theme list; tokens live in index.css
  ui/                Component kit (Button, Card, Badge, Page, CommandPalette, motion helpers, ...)
  pages/             One file per page, with sub-folders for larger pages
src-tauri/           Tauri 2 app (Rust)
  tauri.conf.json    Window, bundle and installer settings
  src/lib.rs         App setup (window, tray, plugins), the single `ipc` command, core channels
  src/core/          Ctx/Args/Registry (mod.rs), errors, Riot client + JSON store (riot.rs), JS-style helpers (js.rs)
  src/api/*.rs       One backend module per feature, each registering channels
  src/bin/try.rs     spectre-try: call a backend channel from the command line
  windows/           NSIS installer hooks (migration from the old Electron install)
  BACKEND.md         Backend developer notes
```

The UI never calls Tauri commands directly: `src/lib/ipc.js` sends every call through one Rust command,
`ipc(channel, args)`, which looks the channel up in a registry. Backend events reach the UI with `useEvent(channel, fn)`.

### Backend modules

Each file in `src-tauri/src/api/` has a `register` function that adds channels; `api/mod.rs` > `register_all` calls them all.

```rust
use crate::core::error::Res;
use crate::core::{Args, Ctx, Registry};
use serde_json::{json, Value};

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("example:hello", |ctx, a: Args| async move {
        let name = a.str(0);
        let me = ctx.riot.state().game_name.unwrap_or_default();
        Ok(json!(format!("Hello {name}, from {me}")))
    });
}
```

- A handler's `Ok(value)` arrives in the UI as the result of `invoke`; an `Err` is thrown there as an `Error` with its text.
- `ctx.emit(channel, payload)` pushes an event to every window.
- `ctx.riot.local()` calls the Riot Client's local API. `ctx.riot.pd()`, `glz()` and `shared()` call Riot's game services
  with fresh tokens, retrying once if the token has expired.
- `ctx.riot.val_api(path)` fetches public content from valorant-api.com, cached for the session.
- `ctx.riot.read_store(name, fallback)` and `ctx.riot.write_store(name, &data)` persist JSON in `%APPDATA%\Spectre\store`.

Adding a channel needs no Tauri command or capability change: add it with `reg.add` (a new module also goes into
`api/mod.rs`), then call it from React. More detail (argument helpers, JSON semantics, Tauri plugins) is in
[`src-tauri/BACKEND.md`](../src-tauri/BACKEND.md).

### Calling the backend from React

```jsx
import { invoke, useInvoke, useEvent } from '../lib/ipc'

const rank = useInvoke('store:rank', [], { poll: 30000 })  // { data, error, loading, reload }
await invoke('tools:keep', true)                            // throws on error
useEvent('settings:changed', s => setSettings(s))
```

### Adding a page

1. Create `src/pages/MyPage.jsx`.
2. Register it under a section in `src/nav.js` with an `id`, `label` and icon. It shows up in the dock and in the Ctrl+K search.
3. Navigate to it from anywhere with `navigate('my-page', params)`.

### Privacy rules in code

- Never pass the puuid of a streamer-mode (incognito) player to the UI. `api/livematch.rs` hands out per-match random
  tokens for those players instead.
- Never call the name service for incognito players.
- Agent select (`pregame`) only looks up ranks for self, friends and party.

## Testing a backend channel

`spectre-try` builds the backend without a window and calls one channel against the live Riot Client. From `src-tauri/`:

```
cargo run -q --bin spectre-try -- --list                  # list all channels
cargo run -q --bin spectre-try -- store:rank              # call a channel
cargo run -q --bin spectre-try -- search:lookup '"Name#Tag"'
```

Arguments are parsed as JSON when possible. It stores data in `%TEMP%\spectre-try\store`, never in your real app data.
Don't call channels that change your account or send anything (equipping, friend and party actions, chat, profile
tools); `src-tauri/BACKEND.md` has the full list.

## Checks

```
npm run lint                    # ESLint on src/
npm run build                   # Vite build into build/
cd src-tauri && cargo check     # Rust backend
```

## Building

```
npm run app:build
```

Runs `vite build` into `build/`, compiles the Rust app in release mode and packages
`src-tauri/target/release/bundle/nsis/Spectre_x.y.z_x64-setup.exe` (NSIS, per-user). Builds aren't code-signed, so
Windows SmartScreen warns on first launch. The installer also removes an old Electron install (2.4.x) and keeps its data;
see `src-tauri/BACKEND.md` > Migration from Electron.

## Releasing

1. Bump `version` in `package.json` (`tauri.conf.json` reads it from there) and in `src-tauri/Cargo.toml`, and add a
   section to `CHANGELOG.md`.
2. Build with `npm run app:build`, then commit and push.
3. Publish the build as a GitHub release with the GitHub CLI, using that CHANGELOG section as the notes. The in-app
   updater picks the release with the highest version and installs its asset whose name matches `setup*.exe`
   (silently, with `/P /UPDATE /R`), so keep `setup` in the file name:

```
cp "src-tauri/target/release/bundle/nsis/Spectre_X.Y.Z_x64-setup.exe" Spectre-X.Y.Z-setup.exe
gh release create vX.Y.Z Spectre-X.Y.Z-setup.exe --repo booomxd/spectre --title "Spectre X.Y.Z" --notes-file notes.md --latest
```

## Announcements

Each entry in [`docs/announcements.json`](announcements.json) opens once as a popup in the middle of Spectre, the next time each user starts the app (or within three hours if it is already open). Push a change to that file to publish; no app release is needed. Only `id` and `title` are required:

```json
{
  "items": [
    {
      "id": "patch-11-12",
      "title": "Spectre 4.0 is out",
      "body": "Faster tab switching and smoother scrolling.",
      "level": "info",
      "image": "https://example.com/banner.png",
      "link": "https://github.com/booomxd/spectre/releases/latest",
      "linkLabel": "Release notes",
      "from": "2026-11-12",
      "until": "2026-11-20",
      "minVersion": "3.0.0",
      "maxVersion": "3.9.9"
    }
  ]
}
```

- `level`: `info` (default) or `warn` (yellow, for problems or required updates).
- `from` / `until`: optional dates; `until` lasts through that whole day.
- `minVersion` / `maxVersion`: optional, to target users on certain versions (for example, everyone below 4.0).
- `link` / `image`: optional, must start with `https://`. The image shows across the top of the popup.
- `body` keeps line breaks (`
`).
- Each announcement shows once per PC: closing it hides it for good. If Spectre is closed while it is open, it shows again on the next start. Give an edited announcement a new `id` to show it to everyone again.
