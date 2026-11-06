// Puuids the VALORANT client itself lets the user see: self, friends and current party members, plus the
// streamer-mode players of the user's current match. One shared cache for every module. Port of public/known.js.
use crate::core::error::{msg, Res};
use crate::core::riot::now_ms;
use crate::core::{js, truthy, Ctx};
use once_cell::sync::Lazy;
use std::collections::HashSet;
use std::sync::Mutex;

#[derive(Clone, Default)]
struct Known {
    at: i64,
    all: HashSet<String>,
    party: HashSet<String>,
    friends: HashSet<String>,
}

static CACHE: Lazy<Mutex<Known>> = Lazy::new(|| Mutex::new(Known::default()));

async fn load(ctx: &Ctx) -> Res<Known> {
    {
        let c = CACHE.lock().unwrap();
        if now_ms() - c.at < 30000 { return Ok(c.clone()); }
    }
    let me = ctx.riot.puuid();
    let mut party = HashSet::from([me.clone()]);
    let mut all = HashSet::from([me.clone()]);
    let mut friends = HashSet::from([me.clone()]);
    // If the friends list can't be read, fail instead of caching a self-only set that would
    // treat every friend as a stranger (and e.g. wipe recent searches).
    let fl = ctx.riot.local("get", "chat/v4/friends", None).await?;
    if fl.is_null() { return Err(msg("Cannot read properties of null (reading 'friends')")); }
    for f in js::arr(&fl["friends"]) {
        if truthy(&f["puuid"]) { let p = js::s(&f["puuid"]); all.insert(p.clone()); friends.insert(p); }
    }
    // Not in a party / game closed: party is just you.
    if let Ok(pl) = ctx.riot.glz("get", &format!("parties/v1/players/{me}"), None).await {
        if truthy(&pl["CurrentPartyID"]) {
            if let Ok(p) = ctx.riot.glz("get", &format!("parties/v1/parties/{}", js::s(&pl["CurrentPartyID"])), None).await {
                for m in js::arr(&p["Members"]) {
                    let sub = js::s(&m["Subject"]);
                    if truthy(&m["PlayerIdentity"]["Incognito"]) && !all.contains(&sub) { continue; }
                    party.insert(sub.clone());
                    all.insert(sub);
                }
            }
        }
    }
    let k = Known { at: now_ms(), all, party, friends };
    *CACHE.lock().unwrap() = k.clone();
    Ok(k)
}

/// Self + friends + party members (cached 30 s). Fails if the friends list can't be read, instead of caching a
/// self-only set that would treat every friend as a stranger.
pub async fn known_puuids(ctx: &Ctx) -> Res<HashSet<String>> { Ok(load(ctx).await?.all) }

/// Self + friends only.
pub async fn friend_puuids(ctx: &Ctx) -> Res<HashSet<String>> { Ok(load(ctx).await?.friends) }

/// Self + current party members (incognito members who aren't friends are left out).
pub async fn party_puuids(ctx: &Ctx) -> Res<HashSet<String>> { Ok(load(ctx).await?.party) }

// Streamer-mode players in your current agent select or match. They stay hidden everywhere, match histories
// included, so other data can't unmask who you're playing with or against. None when the game can't be read.
static LIVE: Lazy<Mutex<(i64, Option<HashSet<String>>)>> = Lazy::new(|| Mutex::new((0, None)));

async fn read_live(ctx: &Ctx, me: &str) -> Res<HashSet<String>> {
    let mut hidden = HashSet::new();
    for base in ["core-game", "pregame"] {
        let p = match ctx.riot.glz("get", &format!("{base}/v1/players/{me}"), None).await {
            Ok(p) => p,
            Err(e) if e.status() == Some(404) => continue,
            Err(e) => return Err(e),
        };
        if !truthy(&p["MatchID"]) { continue; }
        let m = ctx.riot.glz("get", &format!("{base}/v1/matches/{}", js::s(&p["MatchID"])), None).await?;
        let players = if base == "core-game" { &m["Players"] } else { &m["AllyTeam"]["Players"] };
        for x in js::arr(players) {
            let sub = js::s(&x["Subject"]);
            if sub != me && truthy(&x["PlayerIdentity"]["Incognito"]) { hidden.insert(sub); }
        }
        break;
    }
    Ok(hidden)
}

/// Streamer-mode players in your current agent select or match (cached 15 s). None when the game can't be read.
pub async fn live_hidden(ctx: &Ctx) -> Option<HashSet<String>> {
    {
        let l = LIVE.lock().unwrap();
        if now_ms() - l.0 < 15000 { return l.1.clone(); }
    }
    let me = ctx.riot.puuid();
    let hidden = read_live(ctx, &me).await.ok();
    *LIVE.lock().unwrap() = (now_ms(), hidden.clone());
    hidden
}
