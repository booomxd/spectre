// Puuids the VALORANT client itself lets the user see: self, friends and current party members, plus the
// streamer-mode players of the user's current match. One shared cache for every module. Port of public/known.js.
use crate::core::error::Res;
use crate::core::Ctx;
use std::collections::HashSet;

/// Self + friends + party members (cached 30 s). Fails if the friends list can't be read, instead of caching a
/// self-only set that would treat every friend as a stranger.
pub async fn known_puuids(ctx: &Ctx) -> Res<HashSet<String>> { let _ = ctx; todo!("port public/known.js") }

/// Self + friends only.
pub async fn friend_puuids(ctx: &Ctx) -> Res<HashSet<String>> { let _ = ctx; todo!("port public/known.js") }

/// Self + current party members (incognito members who aren't friends are left out).
pub async fn party_puuids(ctx: &Ctx) -> Res<HashSet<String>> { let _ = ctx; todo!("port public/known.js") }

/// Streamer-mode players in your current agent select or match (cached 15 s). None when the game can't be read.
pub async fn live_hidden(ctx: &Ctx) -> Option<HashSet<String>> { let _ = ctx; todo!("port public/known.js") }
