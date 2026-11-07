// Spectre's own releases on GitHub: patch notes, update checks and one-click updates.
// Installed copies download the new installer, verify it and run it (it closes Spectre, installs and relaunches).
// Dev builds and loose exes (no uninstaller next to them) just link to the release page.
use crate::core::error::{msg, Res};
use crate::core::riot::{now_ms, send};
use crate::core::{js, truthy, Ctx, Registry};
use futures::StreamExt;
use once_cell::sync::Lazy;
use regex::Regex;
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::io::Write;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Mutex;
use std::time::Duration;

// SPECTRE_UPDATE_REPO=owner/name points update checks at another repo (testing an update without a public release).
static REPO: Lazy<String> = Lazy::new(|| {
    let ok = Regex::new(r"^[\w.-]+/[\w.-]+$").unwrap();
    std::env::var("SPECTRE_UPDATE_REPO").ok().filter(|r| ok.is_match(r)).unwrap_or_else(|| "booomxd/spectre".to_string())
});
const CHECK_EVERY: Duration = Duration::from_millis(6 * 60 * 60 * 1000);

/// "2.10.0" > "2.9.1"
fn newer(a: &str, b: &str) -> bool {
    // String(x).split('.').map(Number), with `|| 0` turning NaN / missing into 0.
    let parts = |s: &str| -> Vec<f64> {
        s.split('.').map(|p| { let t = p.trim(); if t.is_empty() { 0.0 } else { t.parse::<f64>().unwrap_or(f64::NAN) } }).collect()
    };
    let (pa, pb) = (parts(a), parts(b));
    let at = |v: &Vec<f64>, i: usize| v.get(i).copied().filter(|x| !x.is_nan() && *x != 0.0).unwrap_or(0.0);
    for i in 0..3 {
        if at(&pa, i) != at(&pb, i) { return at(&pa, i) > at(&pb, i); }
    }
    false
}

/// Installed by the installer (has an uninstaller next to the exe), as opposed to a dev build or a loose exe.
/// Electron's NSIS build left "Uninstall Spectre.exe"; Tauri's NSIS installer leaves "uninstall.exe".
fn installed(ctx: &Ctx) -> bool {
    if ctx.is_dev { return false; }
    let Some(dir) = std::env::current_exe().ok().and_then(|p| p.parent().map(|d| d.to_path_buf())) else { return false };
    dir.join("Uninstall Spectre.exe").exists() || dir.join("uninstall.exe").exists()
}

fn current(ctx: &Ctx) -> String {
    ctx.app.as_ref().map(|a| a.package_info().version.to_string()).unwrap_or_else(|| env!("CARGO_PKG_VERSION").to_string())
}

static SETUP_EXE: Lazy<Regex> = Lazy::new(|| Regex::new(r"(?i)setup.*\.exe$").unwrap());
static CACHE: Lazy<Mutex<(i64, Option<Vec<Value>>)>> = Lazy::new(|| Mutex::new((0, None)));

async fn releases(ctx: &Ctx, force: bool) -> Res<Vec<Value>> {
    if !force {
        let c = CACHE.lock().unwrap();
        if let Some(list) = &c.1 { if now_ms() - c.0 < 10 * 60 * 1000 { return Ok(list.clone()); } }
    }
    let req = ctx.riot.http().get(format!("https://api.github.com/repos/{}/releases?per_page=20", *REPO))
        .header("Accept", "application/vnd.github+json").header("User-Agent", "Spectre").timeout(Duration::from_secs(10));
    let data = send(req).await?;
    let Some(rows) = data.as_array() else { return Err(msg("res.data.filter is not a function")) };
    let list: Vec<Value> = rows.iter().filter(|r| !truthy(&r["draft"]) && !truthy(&r["prerelease"])).map(|r| {
        let exe = js::arr(&r["assets"]).into_iter().find(|a| SETUP_EXE.is_match(&js::s(&a["name"])));
        let tag = js::s(&r["tag_name"]);
        json!({
            "version": tag.strip_prefix('v').unwrap_or(&tag), "name": js::or(&r["name"], r["tag_name"].clone()), "date": r["published_at"],
            "notes": js::or(&r["body"], json!("")), "url": r["html_url"],
            "installer": exe.map(|e| json!({
                "name": e["name"], "url": e["browser_download_url"], "size": e["size"], "digest": js::or(&e["digest"], Value::Null),
            })),
        })
    }).collect();
    *CACHE.lock().unwrap() = (now_ms(), Some(list.clone()));
    Ok(list)
}

/// The newest release by version number. GitHub lists releases by creation date, not version, so the first row can be
/// an older version (a re-published or back-filled release), which made the app offer a downgrade.
fn newest(list: Vec<Value>) -> Option<Value> {
    list.into_iter().reduce(|best, r| if newer(&js::s(&r["version"]), &js::s(&best["version"])) { r } else { best })
}

static STATUS: Lazy<Mutex<Value>> = Lazy::new(|| Mutex::new(json!({ "current": null, "available": false })));

async fn check(ctx: &Ctx) -> Res<Value> {
    let latest = newest(releases(ctx, true).await?);
    let cur = current(ctx);
    let available = latest.as_ref().map(|l| newer(&js::s(&l["version"]), &cur)).unwrap_or(false);
    let l = latest.unwrap_or(Value::Null);
    let status = json!({
        "current": cur, "latest": js::or(&l["version"], Value::Null), "available": available, "url": js::or(&l["url"], Value::Null),
        "canInstall": available && installed(ctx) && truthy(&l["installer"]),
    });
    *STATUS.lock().unwrap() = status.clone();
    if available { ctx.emit("update:status", status.clone()); }
    Ok(status)
}

static INSTALLING: AtomicBool = AtomicBool::new(false);

async fn install(ctx: &Ctx) -> Res<Value> {
    if INSTALLING.load(Ordering::SeqCst) { return Err(msg("Already updating")); }
    let latest = newest(releases(ctx, false).await?).unwrap_or(Value::Null);
    let can = truthy(&STATUS.lock().unwrap()["canInstall"]);
    if !can || !truthy(&latest["installer"]) { return Err(msg("No update to install")); }
    INSTALLING.store(true, Ordering::SeqCst);
    let r = download_and_run(ctx, &latest["installer"]).await;
    if r.is_err() { INSTALLING.store(false, Ordering::SeqCst); }
    r
}

async fn download_and_run(ctx: &Ctx, inst: &Value) -> Res<Value> {
    let dir = std::env::temp_dir().join("spectre-update");
    std::fs::create_dir_all(&dir)?;
    let file = dir.join(js::s(&inst["name"]));
    let req = ctx.riot.http().get(js::s(&inst["url"])).header("User-Agent", "Spectre");
    let res = tokio::time::timeout(Duration::from_secs(30), req.send()).await
        .map_err(|_| msg("timeout of 30000ms exceeded"))??;
    if !res.status().is_success() { return Err(msg(format!("Request failed with status code {}", res.status().as_u16()))); }
    let total = { let s = js::num(&inst["size"]); if s > 0.0 { s } else { res.content_length().unwrap_or(0) as f64 } };
    let mut hash = Sha256::new();
    let mut out = std::fs::File::create(&file)?;
    let (mut got, mut last_pct): (f64, Option<Option<i64>>) = (0.0, None);
    let mut stream = res.bytes_stream();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk?;
        hash.update(&chunk);
        out.write_all(&chunk)?;
        got += chunk.len() as f64;
        let pct = if total > 0.0 { Some((got / total * 100.0).floor() as i64) } else { None };
        if last_pct != Some(pct) { last_pct = Some(pct); ctx.emit("update:progress", json!({ "pct": pct })); }
    }
    out.flush()?;
    drop(out);
    // GitHub publishes a sha256 for release assets; refuse a download that doesn't match it.
    let want = js::s(&inst["digest"]);
    let want = want.strip_prefix("sha256:").unwrap_or(&want);
    if !want.is_empty() && hex::encode(hash.finalize()) != want {
        let _ = std::fs::remove_file(&file);
        return Err(msg("Download was corrupted, please try again"));
    }
    // Tauri's NSIS flags: /UPDATE skips the "an older version is installed" page and keeps shortcuts as they are,
    // /P (passive) shows only a progress bar with no wizard clicks, and /R starts Spectre again when it finishes.
    std::process::Command::new(&file).args(["/P", "/UPDATE", "/R"]).spawn()?;
    if let Some(app) = ctx.app.clone() {
        crate::core::spawn(async move {
            tokio::time::sleep(Duration::from_millis(800)).await;
            app.exit(0);
        });
    }
    Ok(json!(true))
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("spectre:releases", |ctx, _| async move { Ok(Value::Array(releases(&ctx, false).await?)) });
    reg.add("update:status", |ctx, _| async move {
        let s = STATUS.lock().unwrap().clone();
        if truthy(&s["current"]) { Ok(s) } else { check(&ctx).await }
    });
    reg.add("update:check", |ctx, _| async move { check(&ctx).await });
    reg.add("update:install", |ctx, _| async move { install(&ctx).await });

    let c = ctx.clone();
    crate::core::spawn(async move {
        tokio::time::sleep(Duration::from_millis(8000)).await;
        let _ = check(&c).await;
    });
    let c = ctx.clone();
    crate::core::every(CHECK_EVERY, CHECK_EVERY, move || { let c = c.clone(); async move { let _ = check(&c).await; } });
}
