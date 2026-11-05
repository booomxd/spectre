// Rank and scouting for a player by puuid. Results carry no names, match ids or teammates, so they are safe to show
// for streamer-mode players. One shared cache for every module. Port of public/scout.js.
use crate::core::error::Res;
use crate::core::Ctx;
use serde_json::Value;
use std::collections::HashSet;

/// Current act id, plus the ids of acts from before Ascendant existed (all lowercase).
#[derive(Clone, Default)]
pub struct Acts {
    pub current: Option<String>,
    pub old: HashSet<String>,
}

/// Cached 10 minutes (1 minute when incomplete).
pub async fn acts(ctx: &Ctx) -> Acts { let _ = ctx; todo!("port public/scout.js") }

/// { current: { tier, rr, seasonId, wins, games }, peak: { tier, seasonId }, history: [...] }. Errors if MMR fails.
pub async fn rank(ctx: &Ctx, puuid: &str) -> Res<Value> { let _ = (ctx, puuid); todo!("port public/scout.js") }

/// Full scout: rank fields plus recent, agents, matches, historyPrivate. Cached five minutes per player.
pub async fn scout(ctx: &Ctx, puuid: &str) -> Res<Value> { let _ = (ctx, puuid); todo!("port public/scout.js") }
