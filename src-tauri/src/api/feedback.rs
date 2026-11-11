// suggestions and bug reports from the Suggestions page
use crate::core::{Ctx, Registry};
use serde_json::json;

// free key from https://web3forms.com
const WEB3FORMS_KEY: &str = "d34fbddf-d3b3-45be-b12e-5df89329c4eb";

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("feedback:config", |ctx, _| async move {
        let version = ctx.app.as_ref().map(|a| a.package_info().version.to_string()).unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string());
        let key = if WEB3FORMS_KEY.is_empty() { None } else { Some(WEB3FORMS_KEY) };
        Ok(json!({ "key": key, "repo": "booomxd/spectre", "version": version }))
    });
}
