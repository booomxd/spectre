// Feature modules, one per area of the app. Each registers its channels (and any background tasks).
use crate::core::{Ctx, Registry};

pub mod known;
pub mod scout;

pub mod discord;
pub mod feedback;
pub mod friendlog;
pub mod history;
pub mod leaderboard;
pub mod livematch;
pub mod loadout;
pub mod memo;
pub mod notebook;
pub mod overlay;
pub mod patchnotes;
pub mod playbooks;
pub mod progression;
pub mod settings;
pub mod social;
pub mod store;
pub mod tools;
pub mod updates;

pub fn register_all(reg: &mut Registry, ctx: &Ctx) {
    discord::register(reg, ctx);
    feedback::register(reg, ctx);
    friendlog::register(reg, ctx);
    history::register(reg, ctx);
    leaderboard::register(reg, ctx);
    livematch::register(reg, ctx);
    loadout::register(reg, ctx);
    memo::register(reg, ctx);
    notebook::register(reg, ctx);
    overlay::register(reg, ctx);
    patchnotes::register(reg, ctx);
    playbooks::register(reg, ctx);
    progression::register(reg, ctx);
    settings::register(reg, ctx);
    social::register(reg, ctx);
    store::register(reg, ctx);
    tools::register(reg, ctx);
    updates::register(reg, ctx);
}
