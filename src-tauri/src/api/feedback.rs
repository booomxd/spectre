// Suggestions and bug reports from the Suggestions page.
// Emailed to the developer through Web3Forms. Its free plan only accepts browser requests, so the page itself
// sends them; this module only hands over the settings. The access key can only send mail to the developer's
// inbox, so it is safe to ship. Without a key the page falls back to a prefilled GitHub issue.
use crate::core::{Ctx, Registry};
use serde_json::json;

// Free key from https://web3forms.com (form "Spectre Suggestions").
const WEB3FORMS_KEY: &str = "d34fbddf-d3b3-45be-b12e-5df89329c4eb";

pub fn register(reg: &mut Registry, _ctx: &Ctx) {
    reg.add("feedback:config", |ctx, _| async move {
        let version = ctx.app.as_ref().map(|a| a.package_info().version.to_string()).unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string());
        let key = if WEB3FORMS_KEY.is_empty() { None } else { Some(WEB3FORMS_KEY) };
        Ok(json!({ "key": key, "repo": "booomxd/spectre", "version": version }))
    });
}
