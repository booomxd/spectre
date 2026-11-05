// Dev helper: call any backend channel against the live Riot Client without a window. Port of scripts/try.js.
//   cargo run --bin spectre-try -- <channel> [jsonArg1] [jsonArg2] ...
//   cargo run --bin spectre-try -- --list
// Prints `{ "ok": true, "data": ... }` or `{ "ok": false, "error": ... }` as JSON. Data is stored in a temp folder,
// never in %APPDATA%\Spectre.
use serde_json::Value;

#[tokio::main]
async fn main() {
    let (ctx, reg) = spectre_lib::headless();
    let argv: Vec<String> = std::env::args().skip(1).collect();
    let Some(channel) = argv.first().cloned().filter(|c| c != "--list") else {
        println!("{}", reg.channels().join("\n"));
        return;
    };
    if let Err(e) = ctx.riot.connect().await { eprintln!("connect failed: {e}"); }
    let args: Vec<Value> = argv[1..].iter().map(|a| serde_json::from_str(a).unwrap_or(Value::String(a.clone()))).collect();
    let out = spectre_lib::envelope(reg.call(ctx, &channel, args).await);
    println!("{}", serde_json::to_string_pretty(&out).unwrap());
    std::process::exit(0);
}
