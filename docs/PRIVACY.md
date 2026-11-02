# Privacy and data

## How Spectre signs in

Spectre doesn't ask for your Riot username or password. When the Riot Client is running, it reads the client's local connection file and requests a session token from the client on your own PC. It uses that token for Riot's game services the same way the VALORANT client does. The token stays in memory and is never written to disk or sent anywhere else.

## Where Spectre connects

| Destination | What for |
| --- | --- |
| Riot Client on `127.0.0.1` | Session token, friends, chat, party and presence |
| Riot game services (`*.a.pvp.net`) | Store, match history, ranks, loadout and live match data |
| `valorant-api.com` | Public game content: agent, map, weapon and rank images and names |
| `playvalorant.com` | Official patch notes |
| Discord on your PC (local pipe) | Rich Presence, only if you turn it on |

Spectre has no servers or accounts of its own, no analytics, and no telemetry.

## What is stored on your PC

Settings, player notes, loadout presets and playbooks are saved as JSON files in `%APPDATA%\Spectre\store`. Delete that folder to reset Spectre completely.

## Other players

- **Streamer mode is respected.** If a player hides their name in VALORANT, Spectre never shows their name, Riot ID, account level or player card. It never even asks Riot's name service about them. They're shown only by their agent.
- **Scouting a hidden player** shows only their rank and recent competitive form. The app's interface refers to them by a random code that changes every match, so no identifying data reaches the screen.
- **Agent select:** ranks are shown only for you, your friends and your party. No one else is looked up before the match starts.
- Player notes are private and never leave your PC.

## Disclaimer

Spectre is a fan-made project and isn't endorsed by Riot Games. It uses the Riot Client's local API and Riot's game services, which aren't official public APIs. Using third-party tools is at your own risk.
