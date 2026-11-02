<div align="center">

<img src="src/assets/spectre-logo.svg" width="128" alt="Spectre logo" />

# Spectre

**👻 A sleek desktop companion for VALORANT on Windows**

Live match ranks, scouting, skins, your party, Discord presence and more, all through the Riot Client you're already signed in to.

[![Latest release](https://img.shields.io/github/v/release/booomxd/spectre?style=for-the-badge&color=8b5cf6&label=release)](https://github.com/booomxd/spectre/releases/latest)
[![Downloads](https://img.shields.io/github/downloads/booomxd/spectre/total?style=for-the-badge&color=6d28d9)](https://github.com/booomxd/spectre/releases)
![Windows](https://img.shields.io/badge/Windows-10%20%7C%2011-2a1458?style=for-the-badge&logo=windows&logoColor=white)
![Electron](https://img.shields.io/badge/Electron-33-2a1458?style=for-the-badge&logo=electron&logoColor=white)
![React](https://img.shields.io/badge/React-18-2a1458?style=for-the-badge&logo=react&logoColor=white)

**[🌐 Website](https://booomxd.github.io/spectre/)** · **[⬇️ Download](https://github.com/booomxd/spectre/releases/latest)** · **[✨ Features](docs/FEATURES.md)** · **[🔒 Privacy](docs/PRIVACY.md)** · **[🛠️ Development](docs/DEVELOPMENT.md)** · **[📜 Changelog](CHANGELOG.md)**

</div>

---

> [!NOTE]
> Spectre is a fan-made project. It isn't endorsed by Riot Games, and using third-party tools is at your own risk.

## ✨ Highlights

| | |
| --- | --- |
| 🎯 **Live Match** | Every player's current-act rank, RR and peak, their skins, and a one-click **Scout** with rank history, recent form and matches. |
| 👥 **Lobby & Party** | Invite friends, share invite codes, pick a mode, ready up and start matchmaking without opening the game. |
| 🔫 **Skins** | See anyone's loadout in a match, and change your own skins right from agent select. |
| 🎮 **Discord presence** | "Playing Spectre" with your mode, map art, score, rank and party, all fully customizable. |
| 🕶️ **Streamer-safe** | Players who hide their name in your match stay hidden everywhere in Spectre. No names, IDs or cards. |
| 🖥️ **In-game overlay** | Both teams' ranks over the game, toggled with a hotkey, with optional click-through and auto-show. |
| ⬆️ **Auto updates** | New versions show up in the app and install in one click. |
| 🎨 **Twelve glass themes** | Midnight, Onyx, Ember, Glacier, Verdant, Amethyst, Gilded, Aurora, Sakura, Abyss, Sunset and the light Pearl. |

## 📸 Preview

<p align="center">
  <a href="docs/screenshots/live-match.png"><img src="docs/screenshots/live-match.png" alt="Live Match: both teams with current rank, peak rank and Vandal / Phantom skins" /></a>
</p>

| 🔍 Scout any player | 🔫 See anyone's skins |
| :---: | :---: |
| [![Scout panel with rank history, recent performance and matches](docs/screenshots/scout.png)](docs/screenshots/scout.png) | [![Skins panel with card, sprays, weapon skins and buddies](docs/screenshots/skins.png)](docs/screenshots/skins.png) |

<p align="center">
  <a href="docs/screenshots/overlay.jpg"><img src="docs/screenshots/overlay.jpg" alt="In-game overlay with both teams' ranks" /></a>
  <br><sub>🖥️ The in-game overlay, toggled with <code>Ctrl+Shift+O</code></sub>
</p>

| 👥 Lobby & Party | 🎮 Discord presence |
| :---: | :---: |
| [![Lobby and party controls](docs/screenshots/lobby.png)](docs/screenshots/lobby.png) | [![Discord Rich Presence settings and profile preview](docs/screenshots/discord.png)](docs/screenshots/discord.png) |

<sub>Screenshots use sample data: the players, names and stats are made up. Streamer-mode players show only their agent, just like in a real match.</sub>

## ⬇️ Download

Grab the latest version from **[Releases](https://github.com/booomxd/spectre/releases/latest)**:

| File | What it is |
| --- | --- |
| 📦 `Spectre.Setup.x.y.z.exe` | Installer. One click, installs for your user only, adds a desktop shortcut. |
| 🗜️ `Spectre-x.y.z-win.zip` | Portable. Unzip anywhere and run `Spectre.exe`. |

**Requirements:** Windows 10 or 11 (64-bit), VALORANT installed, and the Riot Client open and signed in.

> [!TIP]
> Spectre isn't code-signed, so Windows SmartScreen may warn on first launch. Click **More info**, then **Run anyway**.

## 🧭 What's inside

| Section | Pages |
| --- | --- |
| 🔴 **Live** | Dashboard · Friends & chat · Live Match (with Lobby & Party and an always-on-top overlay) |
| 📊 **Stats** | Progression · Loadout · Player Search · Match History · Notes · Activity · Encounters |
| 🧭 **Explore** | Shop & Night Market · Discord · Weapons · Leaderboard |
| 🎭 **LARP** | Rank Editor · Customize (any card or title) · Premier · Status |
| 🗺️ **Tactics** | Strategy board with maps, agents, abilities and saved playbooks |

Every page is explained in **[docs/FEATURES.md](docs/FEATURES.md)**.

## 🔒 Privacy

- 🔑 No Riot password and no accounts: Spectre uses the Riot Client session already on your PC.
- 📡 No servers of its own, no analytics, no telemetry.
- 👻 Streamer-mode players in your match are never named or identified.
- 💾 Your settings and notes stay in `%APPDATA%\Spectre`.

Details in **[docs/PRIVACY.md](docs/PRIVACY.md)**.

## 🛡️ Safety

Spectre is **not a cheat** and never touches the game itself.

- 🚫 No reading or changing game memory or files, and nothing injected.
- 🧱 No contact with Vanguard: it's a regular desktop app.
- 🔌 It talks to Riot the same way the VALORANT client does, using your own signed-in session.
- 👀 It only changes things when you ask, like equipping a skin or inviting a friend.

> [!NOTE]
> Spectre is unofficial, so use it at your own risk 💜

## 🛠️ Build from source

```bash
npm install
npm run electron:dev      # run with hot reload
npm run electron:build    # installer + portable zip in release/
```

Requires Node.js 18+. Architecture, the backend test helper and the release process are in **[docs/DEVELOPMENT.md](docs/DEVELOPMENT.md)**.

## ❓ FAQ

<details>
<summary><b>Spectre says it's waiting for the Riot Client</b></summary>

Open the Riot Client and sign in. Spectre connects on its own within a few seconds.
</details>

<details>
<summary><b>Live Match is empty</b></summary>

It fills in once agent select starts. Before that, the Lobby & Party tab shows your party.
</details>

<details>
<summary><b>My LARP edits disappeared</b></summary>

VALORANT resets your presence when your party, queue or match changes. Turn on <b>Keep applied</b> and Spectre re-sends your edits automatically.
</details>

<details>
<summary><b>How do I uninstall?</b></summary>

Windows Settings → Apps → Installed apps → Spectre. For the portable version, delete its folder. To remove saved data too, delete <code>%APPDATA%\Spectre</code>.
</details>

## ⚖️ Legal

Spectre was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.

<div align="center">

Made with 👻 by <a href="https://github.com/booomxd">booomxd</a>

</div>
