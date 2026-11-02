# Development

## Setup

Requirements: Windows, Node.js 18 or newer, and the Riot Client installed (sign in to test anything that talks to Riot).

```
npm install
npm run electron:dev
```

This starts Vite on `http://localhost:5173` and opens Electron pointed at it. React changes hot-reload; backend changes in `public/` need an app restart.

## Architecture

```
public/            Electron main process (Node)
  main.js          Window, IPC wrapper, loads every module in api/
  riot.js          Shared Riot client: lockfile, tokens, local/pd/glz/shared requests, JSON store
  known.js         Self, friends and party puuids (shared cache)
  api/*.js         One backend module per feature, each registering IPC channels
src/               React UI (renderer)
  nav.js           Page registry: sidebar groups, ids and components
  lib/ipc.js       invoke() and useInvoke() for calling backend channels
  lib/theme.js     Theme list; tokens live in index.css
  ui/              Component kit (Button, Card, Badge, Page, ...)
  pages/           One file per page, with sub-folders for larger pages
scripts/try.js     Run a backend channel from the command line
```

### Backend modules

Each file in `public/api/` exports a function that receives a context and registers channels:

```js
module.exports = ({ riot, handle, emit }) => {
    handle('example:hello', async (name) => {
        const me = riot.state.gameName;
        return `Hello ${name}, from ${me}`;
    });
};
```

- `handle(channel, fn)` exposes `fn` to the renderer. Its return value arrives as `{ ok: true, data }`, and a thrown error arrives as `{ ok: false, error }`.
- `emit(channel, payload)` pushes an event to every window.
- `riot.local()` calls the Riot Client's local API. `riot.pd()`, `riot.glz()` and `riot.shared()` call Riot's game services with fresh tokens, retrying once if the token has expired.
- `riot.valApi(path)` fetches public content from valorant-api.com, cached for the session.
- `riot.readStore(name, fallback)` and `riot.writeStore(name, data)` persist JSON in the app's data folder.

New files in `public/api/` are loaded automatically at startup.

### Calling the backend from React

```jsx
import { invoke, useInvoke } from '../lib/ipc'

const rank = useInvoke('store:rank', [], { poll: 30000 })  // { data, error, loading, reload }
await invoke('tools:keep', true)                            // throws on error
```

### Adding a page

1. Create `src/pages/MyPage.jsx`.
2. Register it in a group in `src/nav.js` with an `id`, `label` and icon.
3. Navigate to it from anywhere with `navigate('my-page', params)`.

### Privacy rules in code

- Never pass the puuid of a streamer-mode (incognito) player to the renderer. `livematch.js` hands out per-match random tokens for those players instead.
- Never call the name service for incognito players.
- Agent select (`pregame`) only looks up ranks for self, friends and party.

## Testing a backend channel

`scripts/try.js` loads every backend module with a fake Electron context and calls one channel against the live Riot Client:

```
node scripts/try.js --list              # list all channels
node scripts/try.js store:rank          # call a channel
node scripts/try.js search:lookup "\"Name#Tag\""
```

Arguments are parsed as JSON when possible.

## Building

```
npm run electron:build
```

Runs `vite build` into `build/`, then electron-builder packages `release/Spectre Setup x.y.z.exe` (NSIS, one-click, per-user) and `release/Spectre-x.y.z-win.zip` (portable). Builds aren't code-signed, so Windows SmartScreen warns on first launch.

## Releasing

1. Bump `version` in `package.json` and add an entry to `CHANGELOG.md`.
2. Commit, then build with `npm run electron:build`.
3. Publish the build as a GitHub release with the GitHub CLI:

```
gh release create vX.Y.Z "release/Spectre Setup X.Y.Z.exe" "release/Spectre-X.Y.Z-win.zip" --repo booomxd/spectre --title "Spectre X.Y.Z" --notes-file notes.md
```
