# Spectre

A desktop companion for VALORANT on Windows. Spectre shows your store, friends and party, live match rosters with ranks, match history, progression and loadouts, and includes a tactics board and profile tools.

It connects through the Riot Client you're already signed in to, so there's no Riot login inside the app and no password to give it.

> Spectre is a fan-made project. It isn't endorsed by Riot Games, and using third-party tools is at your own risk.

## Download

Builds are published on the **[Spectre releases page](https://github.com/booomxd/spectre-releases/releases)**. Each release has:

- `Spectre Setup x.y.z.exe`: one-click installer, adds a desktop shortcut
- `Spectre-x.y.z-win.zip`: portable build, unzip and run `Spectre.exe`

Requirements: Windows 10 or 11 (64-bit), VALORANT installed, and the Riot Client open and signed in.

## Features

| Area | Pages |
| --- | --- |
| **Live** | Dashboard, Friends (requests, party, chat), Live Match with an always-on-top overlay |
| **Stats** | Progression, Loadout, Player Search, Match History, Notes, Encounters |
| **Explore** | Shop (bundles, daily offers, Night Market), Discord Rich Presence, Weapons, Leaderboard |
| **Profile Tools** | Skin Changer, Rank Editor, Customize, Premier, Status |
| **Tactics** | Strategy board with maps, agents, abilities and drawing tools, plus saved playbooks |

See [docs/FEATURES.md](docs/FEATURES.md) for what each page does.

## Privacy

Spectre has no servers or accounts of its own and sends no telemetry. It only talks to the Riot Client on your PC, Riot's game services, and public content sites for images and patch notes. Streamer-mode players are never named. Details are in [docs/PRIVACY.md](docs/PRIVACY.md).

## Running from source

```
npm install
npm run electron:dev
```

Requires Node.js 18 or newer. See [docs/DEVELOPMENT.md](docs/DEVELOPMENT.md) for the architecture, the backend test helper and the release process.

## Building

```
npm run electron:build
```

Writes `Spectre Setup x.y.z.exe` and `Spectre-x.y.z-win.zip` to `release/`.

## Documentation

- [Features](docs/FEATURES.md)
- [Privacy and data](docs/PRIVACY.md)
- [Development](docs/DEVELOPMENT.md)
- [Changelog](CHANGELOG.md)

## Legal

Spectre was created under Riot Games' "Legal Jibber Jabber" policy using assets owned by Riot Games. Riot Games does not endorse or sponsor this project. VALORANT and Riot Games are trademarks or registered trademarks of Riot Games, Inc.
