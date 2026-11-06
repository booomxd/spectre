# Testing the 2.4.0 (Electron) -> 3.0.0 (Tauri) update without a public release

Both updaters read the GitHub repo from the environment variable `SPECTRE_UPDATE_REPO` (`owner/name`); unset or
malformed -> `booomxd/spectre`, exactly as before. In the Tauri app that is `src-tauri/src/api/updates.rs`. The Electron
backend has been removed from the repo; its copy of the override lives only in git history (commit `8d2bffc`,
`public/api/updates.js`), so the test 2.4.0 is built from that commit (step 2).

## 0. Where to test
Do this in a throwaway Windows (VM, or a second local Windows user account), not on the account that has the real 2.4.0
install: the test installs, uninstalls and rewrites `HKCU\...\Run`. Windows Sandbox works too (it resets on close).

## 1. Test repo and releases
1. Create a **public** GitHub repo, e.g. `<you>/spectre-update-test` (the updater calls the API without a token, so a
   private repo returns 404 and the check fails).
2. Build the Tauri app as 3.0.0: set `"version": "3.0.0"` in `package.json` (tauri.conf.json takes it from there), then
   `npm run app:build`. The installer is `target/release/bundle/nsis/Spectre_3.0.0_x64-setup.exe`
   (matches `/setup.*\.exe$/i`).
3. In the test repo create release tag `v3.0.0-test`, attach that exe, **publish it as a normal release** (drafts and
   pre-releases are ignored by the updater). Check the asset has a `digest` (`sha256:...`) in
   `https://api.github.com/repos/<you>/spectre-update-test/releases` (the updater verifies it when present).
4. Later, for step 4.7: build the same app as `3.0.1`, release `v3.0.1-test` with its setup exe. Do not publish it before
   steps 3-4 are done, or 2.4.0 would jump straight to it.

## 2. A 2.4.0 that knows the switch
The released 2.4.0 does not read `SPECTRE_UPDATE_REPO`; build one that does from commit `8d2bffc` (the last commit
with the Electron app; version 2.4.0) in a separate worktree, from the repo root:
```powershell
git worktree add ..\spectre-electron-2.4 8d2bffc
cd ..\spectre-electron-2.4
npm ci
npm run electron:build
```
Install `release\Spectre Setup 2.4.0.exe` (electron-builder's output folder in that worktree) in the test Windows.
Afterwards remove the worktree with `git worktree remove ..\spectre-electron-2.4`.

Prepare state that must survive:
- Sign in / use the app so `%APPDATA%\Spectre\store` has data (settings, notes, playbooks, match cache...). Copy the
  folder somewhere as a reference (`robocopy %APPDATA%\Spectre\store C:\before /E`).
- Settings -> turn **Launch at login** on. Check `reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run`
  shows `electron.app.Spectre  REG_SZ  C:\Users\<u>\AppData\Local\Programs\spectre\Spectre.exe`.
- Note: Start menu shortcut `Spectre`, desktop shortcut, Apps list entry `Spectre 2.4.0`, uninstall key
  `HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall\<guid>` (`reg query ...\Uninstall /s /f Spectre`).

## 3. Run 2.4.0 against the test repo
Quit Spectre completely (tray -> Quit; a second launch would only focus the running one, which lacks the variable), then:
```powershell
$env:SPECTRE_UPDATE_REPO = '<you>/spectre-update-test'
& "$env:LOCALAPPDATA\Programs\spectre\Spectre.exe"
```
Wait ~8 s (first check) or use the update button: it must offer 3.0.0-test with install available. Click update. Expect
the progress bar, Spectre closes, the Tauri installer runs and starts Spectre 3.0.0.

## 4. Checks after the update
1. **Single install**: Settings -> Apps lists exactly one `Spectre` (3.0.0), no `Spectre 2.4.0`.
   `reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Uninstall /s /f Spectre` shows only the Tauri key.
2. **Old folder gone**: `%LOCALAPPDATA%\Programs\spectre` does not exist (or is empty); the app runs from
   `%LOCALAPPDATA%\Spectre\spectre.exe`.
3. **Shortcuts**: one Start menu `Spectre` and (if there was one) one desktop shortcut, both opening 3.0.0; no broken
   shortcut left pointing at the old folder.
4. **Autostart**: `reg query HKCU\Software\Microsoft\Windows\CurrentVersion\Run` has no `electron.app.Spectre`, and has
   `Spectre  REG_SZ  C:\Users\<u>\AppData\Local\Spectre\spectre.exe ` (written by `src-tauri/src/migrate.rs` because Launch at login
   was on). Task Manager -> Startup apps shows one Spectre, enabled. Sign out/in: Spectre starts once.
   Repeat the whole test with Launch at login **off**: no Spectre value at all afterwards.
5. **Data intact**: Spectre shows the same settings/notes/playbooks; compare `%APPDATA%\Spectre\store` with the copy
   (`robocopy C:\before %APPDATA%\Spectre\store /E /L /NJH /NJS` lists nothing missing).
6. **Idempotent**: restart 3.0.0 a few times; the Run key does not change.
7. **Later updates**: quit 3.0.0, publish `v3.0.1-test` (step 1.4), start 3.0.0 with the same `SPECTRE_UPDATE_REPO`.
   `update:status` must report `available: true, canInstall: true` (installed copy: `uninstall.exe` next to the exe).
   Optionally click update and check 3.0.1 replaces 3.0.0 in place.
8. Without the variable, 3.0.0 checks `booomxd/spectre` again (no test release offered).

If check 1-3 fail, the Tauri NSIS installer is not removing the Electron install: it needs an installer hook that runs
the old `QuietUninstallString` (`"...\Programs\spectre\Uninstall Spectre.exe" /currentuser /S`) without touching
`%APPDATA%\Spectre`.

## 5. Clean up
Delete the test releases/repo. Never set `SPECTRE_UPDATE_REPO` on a user's machine.
