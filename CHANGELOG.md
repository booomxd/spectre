# 📜 Changelog

## Unreleased

### ⚙️ Under the hood
- The app's backend is rewritten in Rust on Tauri 2, replacing Electron and Node
- Updating from 2.4.x removes the old Electron install and keeps your settings, notes, playbooks and Launch at login

## 2.4.0

### 📝 Notes
- Notes is now a notebook: sections with their own color and icon, each holding notes, crosshair codes, links and chat snippets
- Everything saves as you type, and Reset notes starts over
- Notes on players still open from Live Match, Friends and scoreboards

### 👤 Activity
- New page: a timeline of friends who added you, removed you or changed their name, with filters, search and Copy ID

### 🛠️ Fixes
- Short player names no longer get cut off in Live Match rows
- The in-game overlay stays fully see-through around its rounded corners

## 2.3.0

### ✨ A cleaner UI
- A completely redesigned look: frosted glass panels over a soft, glowing backdrop that follows your theme
- A clearer, more readable layout with roomier spacing and calmer headings
- SF Pro typography (when it's installed; Inter otherwise)
- Rounder buttons, chips and switches, with smoother motion throughout
- Five new themes: Aurora, Sakura, Abyss, Sunset and Pearl, Spectre's first light theme
- A refreshed theme picker with a live preview of every theme

## 2.2.1

### 🕘 Match history
- Every player in a match is named, with profile and note buttons, like other trackers
- Streamer-mode players in your current match stay hidden everywhere, match histories included

### 🎭 LARP
- Customize no longer refuses cards and titles you don't own (they're presence-only)

### 🔫 Images
- Default skins show the real gun instead of valorant-api's "X" placeholder
- Game modes show their VALORANT icons in Lobby & Party and Live Match
- The Weapons icon is the in-game kill-feed silhouette

### ⬆️ Updates
- **Check for updates** button in Settings → About

### 🛠️ Fixes
- No more "Entitlements token is not ready yet": Spectre waits for the Riot Client and renews its tokens before they expire
- The taskbar, desktop shortcut and Task Manager show Spectre's ghost and name instead of Electron's
- Scout's recent matches and unavailable buddies in Loadout are dimmed as intended

## 2.2.0

### ⬆️ In-app updates
- Spectre checks for new releases and offers a one-click update that downloads, verifies, installs and restarts
- Portable copies get a link to the new download

### 🖥️ Overlay
- Global hotkeys: show / hide (default `Ctrl+Shift+O`) and lock / unlock (default `Ctrl+Shift+L`)
- Click-through mode, so the game gets every click
- Optional auto-show during agent select and matches
- No longer steals focus from the game; settings apply instantly
- Refined rows: colored rank with RR, peak icon, KD for scouted players, team average rank, Deathmatch as one list

### 📜 Patch Notes
- Separate tabs for Spectre and VALORANT notes

### 💡 Suggestions
- New page to send ideas and bug reports straight to the developer

### 🎨 App
- Settings → About shows the real version

## 2.1.0

### 🎯 Live Match
- New player cards with card art, current and peak rank, and Vandal / Phantom skins
- **Scout** side panel for every player once the match starts: rank history, recent performance (KDA, ACS, HS %, KAST, ADR, first bloods), top agents and the last 10 competitive matches
- **Skins** side panel: anyone's card, title, sprays, weapon skins and buddies
- Agent select shows every teammate's rank; scouting opens once the match starts
- **Change skins** during agent select
- Deathmatch splits players across both columns
- Streamer-mode players stay nameless everywhere

### 👥 Lobby & Party
- New tab: party members, invite by Riot ID, invite codes, mode picker, matchmaking, ready and party access

### 🎮 Discord
- Built-in Spectre Discord app: one switch, no setup
- Map art, agent and rank images, new detail options, and a profile preview with sample scenarios

### 🎭 LARP (was Profile Tools)
- Skin Changer removed (use Loadout or Change skins)
- Cards and titles are presence-only, and any of them can be shown

### 🎨 App
- New ghost logo for the sidebar, window, taskbar and installer
- The skin dialog applies right away instead of queueing changes

## 2.0.0

First public release.

### Live
- Dashboard with rank, peak, wallet, daily offers, battle pass and online friends
- Friends, friend requests, party and direct-message chat
- Live Match for agent select and in-game, with an always-on-top overlay
  - Current-act rank, RR and peak rank for every player once the match starts
  - Peaks from before Ascendant (Episodes 1-4) are mapped to today's tiers, so an old Immortal peak no longer shows as Ascendant
  - Streamer-mode players stay nameless; Scout shows their recent competitive form without revealing who they are
  - Agent select shows ranks only for you, friends and party

### Stats
- Progression: battle pass, contracts, account level and RR history
- Loadout with owned-only equipping and saved presets
- Player Search by Riot ID with act history and recent form
- Match History with full scoreboards and round breakdowns
- Player notes and encounters

### Explore
- Shop with bundles, daily offers, accessories and Night Market
- Discord Rich Presence
- Weapons browser with damage falloff and skin previews
- Regional competitive leaderboard

### Profile Tools
- Skin Changer, Rank Editor, Customize, Premier and Status presence editors, with optional auto re-apply

### Tactics
- Strategy board with maps, agents, abilities and drawing tools, plus saved playbooks

### App
- Seven themes, start page, launch at login, minimize to tray and overlay settings
