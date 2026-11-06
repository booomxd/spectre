// Shared Riot client used by every feature module in src/api.
// Connects through the local Riot Client (lockfile), then talks to the pd / glz / shared endpoints with the tokens it
// hands out.
use super::error::{msg, Error, Res};
use base64::Engine;
use once_cell::sync::Lazy;
use regex::Regex;
use reqwest::{Client, Method};
use serde_json::{json, Map, Value};
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Mutex, RwLock};
use std::time::Duration;

const CLIENT_PLATFORM: &str = "ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuNzY4LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9";
/// Tokens expire after about an hour: they are renewed after 45 minutes, and once more on an auth failure.
const TOKEN_TTL_MS: i64 = 45 * 60 * 1000;

#[derive(Default, Clone)]
pub struct State {
    pub connected: bool,
    pub port: String,
    pub password: String,
    pub access_token: String,
    pub entitlements_token: String,
    pub token_at: i64,
    pub puuid: Option<String>,
    pub game_name: Option<String>,
    pub tag_line: Option<String>,
    pub shard: Option<String>,
    pub region: Option<String>,
    pub client_version: Option<String>,
}

pub struct Riot {
    state: RwLock<State>,
    /// Remote (pd / glz / shared, valorant-api, GitHub...).
    http: Client,
    /// The Riot Client's local API uses a self-signed certificate on 127.0.0.1 only.
    local_http: Client,
    refresh: tokio::sync::Mutex<()>,
    api_cache: Mutex<HashMap<String, Value>>,
    store_dir: RwLock<Option<PathBuf>>,
}

/// Milliseconds since the epoch, like JS `Date.now()`.
pub fn now_ms() -> i64 { chrono::Utc::now().timestamp_millis() }

fn local_app_data() -> PathBuf { PathBuf::from(std::env::var("LOCALAPPDATA").unwrap_or_default()) }

fn read_log() -> String {
    std::fs::read(local_app_data().join("VALORANT").join("Saved").join("Logs").join("ShooterGame.log"))
        .map(|b| String::from_utf8_lossy(&b).into_owned())
        .unwrap_or_default()
}

fn cap(re: &Lazy<Regex>, text: &str) -> Option<String> { re.captures(text).and_then(|c| c.get(1)).map(|m| m.as_str().to_string()) }
static RE_VERSION: Lazy<Regex> = Lazy::new(|| Regex::new(r"CI server version: (\S+)").unwrap());
static RE_PD: Lazy<Regex> = Lazy::new(|| Regex::new(r"https://pd\.(\w+)\.a\.pvp\.net").unwrap());
static RE_GLZ: Lazy<Regex> = Lazy::new(|| Regex::new(r"https://glz-(\w+)-1\.\w+\.a\.pvp\.net").unwrap());

/// Sends a request and returns the parsed JSON body (a string if it isn't JSON, Null if empty).
/// Non-2xx responses become `Error::Http` with the parsed body, like an axios error.
pub async fn send(req: reqwest::RequestBuilder) -> Res<Value> {
    let res = req.send().await?;
    let status = res.status();
    let text = res.text().await.unwrap_or_default();
    let body = if text.trim().is_empty() { Value::Null } else { serde_json::from_str(&text).unwrap_or(Value::String(text)) };
    if status.is_success() { Ok(body) } else { Err(Error::Http { status: status.as_u16(), body }) }
}

fn method(m: &str) -> Method { Method::from_bytes(m.to_uppercase().as_bytes()).unwrap_or(Method::GET) }

impl Riot {
    pub fn new() -> Self {
        Riot {
            state: RwLock::new(State::default()),
            http: Client::builder().user_agent("Spectre").build().expect("http client"),
            local_http: Client::builder().danger_accept_invalid_certs(true).timeout(Duration::from_secs(8)).build().expect("local client"),
            refresh: tokio::sync::Mutex::new(()),
            api_cache: Mutex::new(HashMap::new()),
            store_dir: RwLock::new(None),
        }
    }

    /// A copy of the connection state.
    pub fn state(&self) -> State { self.state.read().unwrap().clone() }
    pub fn connected(&self) -> bool { self.state.read().unwrap().connected }
    /// The signed-in player's puuid ("" before the first connect).
    pub fn puuid(&self) -> String { self.state.read().unwrap().puuid.clone().unwrap_or_default() }
    /// HTTP client for anything that isn't the Riot Client's local API (valorant-api, GitHub, playvalorant...).
    pub fn http(&self) -> &Client { &self.http }

    /// The Riot Client's local API.
    pub async fn local(&self, m: &str, path: &str, body: Option<Value>) -> Res<Value> {
        let (port, password) = { let s = self.state.read().unwrap(); (s.port.clone(), s.password.clone()) };
        if port.is_empty() { return Err(msg("Not connected to the Riot Client")); }
        let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{password}"));
        let mut req = self.local_http.request(method(m), format!("https://127.0.0.1:{port}/{}", path.trim_start_matches('/')))
            .header("Authorization", format!("Basic {auth}"))
            .header("Content-Type", "application/json");
        if let Some(b) = body { req = req.json(&b); }
        send(req).await
    }

    /// The Riot Client answers 400 "Entitlements token is not ready yet" for a few seconds while it renews its own
    /// session, so token reads are retried for a while. Concurrent refreshes wait for the one in flight.
    pub async fn refresh_tokens(&self) -> Res<()> {
        let started = now_ms();
        let _guard = self.refresh.lock().await;
        if self.state.read().unwrap().token_at >= started { return Ok(()); }
        let mut i = 0;
        loop {
            match self.local("get", "entitlements/v1/token", None).await {
                Ok(t) => {
                    let mut s = self.state.write().unwrap();
                    s.access_token = t["accessToken"].as_str().unwrap_or_default().to_string();
                    s.entitlements_token = t["token"].as_str().unwrap_or_default().to_string();
                    s.puuid = t["subject"].as_str().map(str::to_string);
                    s.token_at = now_ms();
                    return Ok(());
                }
                Err(e) if e.status() == Some(400) => {
                    if i >= 7 { return Err(msg("The Riot Client isn't ready yet. Try again in a moment, or restart the Riot Client if this keeps happening.")); }
                    tokio::time::sleep(Duration::from_millis(1500)).await;
                    i += 1;
                }
                Err(e) => return Err(e),
            }
        }
    }

    pub async fn connect(&self) -> Res<Value> {
        let lock = std::fs::read_to_string(local_app_data().join("Riot Games").join("Riot Client").join("Config").join("lockfile"))?;
        let parts: Vec<&str> = lock.split(':').collect();
        if parts.len() < 4 { return Err(msg("The Riot Client lockfile is unreadable")); }
        {
            let mut s = self.state.write().unwrap();
            s.port = parts[2].to_string();
            s.password = parts[3].to_string();
        }
        self.refresh_tokens().await?;

        // valorant-api.com lags behind live patches, so prefer the version the running game logged.
        let log = read_log();
        let mut client_version = cap(&RE_VERSION, &log);
        if client_version.is_none() {
            if let Ok(v) = send(self.http.get("https://valorant-api.com/v1/version")).await {
                client_version = v["data"]["riotClientVersion"].as_str().map(str::to_string);
            }
        }

        let mut shard = None;
        if let Ok(sessions) = self.local("get", "product-session/v1/external-sessions", None).await {
            if let Some(val) = sessions.as_object().and_then(|o| o.values().find(|s| s["productId"] == "valorant")) {
                let arg = val["launchConfiguration"]["arguments"].as_array()
                    .and_then(|a| a.iter().filter_map(Value::as_str).find(|a| a.contains("-ares-deployment")).map(str::to_string));
                if let Some(arg) = arg { shard = arg.split('=').nth(1).map(str::to_string); }
            }
        }
        // Without the game running there is no -ares-deployment arg; fall back to the game log,
        // then to the chat region (jp1 lives on ap, br/latam on na).
        let session = self.local("get", "chat/v1/session", None).await?;
        if shard.is_none() { shard = cap(&RE_PD, &log); }
        let chat_region: String = session["region"].as_str().unwrap_or("").chars().filter(|c| !c.is_ascii_digit()).collect();
        if shard.is_none() {
            shard = Some(match chat_region.as_str() { "jp" => "ap".into(), "br" | "latam" => "na".into(), r => r.to_string() });
        }
        let region = cap(&RE_GLZ, &log).or_else(|| if chat_region == "latam" || chat_region == "br" { Some(chat_region.clone()) } else { shard.clone() });

        {
            let mut s = self.state.write().unwrap();
            s.game_name = session["game_name"].as_str().map(str::to_string);
            s.tag_line = session["game_tag"].as_str().map(str::to_string);
            s.shard = shard;
            s.region = region;
            s.client_version = client_version;
            s.connected = true;
        }
        Ok(self.status())
    }

    /// Marks the connection lost (the connect loop then retries).
    pub fn disconnect(&self) { self.state.write().unwrap().connected = false; }

    pub fn status(&self) -> Value {
        let s = self.state.read().unwrap();
        json!({
            "connected": s.connected, "puuid": s.puuid, "gameName": s.game_name, "tagLine": s.tag_line,
            "shard": s.shard, "region": s.region, "clientVersion": s.client_version,
        })
    }

    async fn remote(&self, base: String, m: &str, path: &str, body: Option<Value>) -> Res<Value> {
        if !self.connected() { return Err(msg("Not connected to the Riot Client")); }
        if now_ms() - self.state.read().unwrap().token_at > TOKEN_TTL_MS { let _ = self.refresh_tokens().await; }
        let url = format!("{base}/{}", path.trim_start_matches('/'));
        let mut retried = false;
        loop {
            let s = self.state();
            let mut req = self.http.request(method(m), &url)
                .timeout(Duration::from_secs(10))
                .header("Authorization", format!("Bearer {}", s.access_token))
                .header("X-Riot-Entitlements-JWT", &s.entitlements_token)
                .header("X-Riot-ClientVersion", s.client_version.clone().unwrap_or_default())
                .header("X-Riot-ClientPlatform", CLIENT_PLATFORM)
                .header("Content-Type", "application/json");
            if let Some(b) = &body { req = req.json(b); }
            match send(req).await {
                Err(e) if !retried && matches!(e.status(), Some(400) | Some(401))
                    && Regex::new(r"(?i)token|claims|auth").unwrap().is_match(&e.body().map(|b| b.to_string()).unwrap_or_default()) => {
                    self.refresh_tokens().await?;
                    retried = true;
                }
                other => return other,
            }
        }
    }

    fn shard(&self) -> String { self.state.read().unwrap().shard.clone().unwrap_or_default() }
    fn region(&self) -> String { self.state.read().unwrap().region.clone().unwrap_or_default() }

    pub async fn pd(&self, m: &str, path: &str, body: Option<Value>) -> Res<Value> {
        self.remote(format!("https://pd.{}.a.pvp.net", self.shard()), m, path, body).await
    }
    pub async fn glz(&self, m: &str, path: &str, body: Option<Value>) -> Res<Value> {
        self.remote(format!("https://glz-{}-1.{}.a.pvp.net", self.region(), self.shard()), m, path, body).await
    }
    pub async fn shared(&self, m: &str, path: &str, body: Option<Value>) -> Res<Value> {
        self.remote(format!("https://shared.{}.a.pvp.net", self.shard()), m, path, body).await
    }

    /// valorant-api.com content (agents, maps, weapons, tiers...): the `data` field, cached for the session.
    pub async fn val_api(&self, path: &str) -> Res<Value> {
        let key = path.trim_start_matches('/').to_string();
        if let Some(v) = self.api_cache.lock().unwrap().get(&key) { return Ok(v.clone()); }
        let v = send(self.http.get(format!("https://valorant-api.com/v1/{key}"))).await?["data"].take();
        self.api_cache.lock().unwrap().insert(key, v.clone());
        Ok(v)
    }
    pub fn clear_api_cache(&self) { self.api_cache.lock().unwrap().clear(); }

    /// puuid -> { gameName, tagLine }. Some players are hidden by streamer mode; callers must respect that
    /// themselves using the match / presence data (this only resolves names).
    pub async fn names(&self, puuids: &[String]) -> Res<Map<String, Value>> {
        let mut list: Vec<String> = Vec::new();
        for p in puuids { if !p.is_empty() && !list.contains(p) { list.push(p.clone()); } }
        if list.is_empty() { return Ok(Map::new()); }
        let rows = self.pd("put", "name-service/v2/players", Some(json!(list))).await?;
        let mut out = Map::new();
        for r in rows.as_array().cloned().unwrap_or_default() {
            if let Some(id) = r["Subject"].as_str() {
                out.insert(id.to_string(), json!({ "gameName": r["GameName"], "tagLine": r["TagLine"] }));
            }
        }
        Ok(out)
    }

    // ---- Small JSON store in %APPDATA%\Spectre\store (memos, playbooks, presets, settings...) ----

    pub fn set_store_dir(&self, dir: PathBuf) {
        let _ = std::fs::create_dir_all(&dir);
        *self.store_dir.write().unwrap() = Some(dir);
    }
    pub fn store_dir(&self) -> PathBuf { self.store_dir.read().unwrap().clone().unwrap_or_else(|| PathBuf::from("store")) }

    /// The stored JSON, or `fallback` if it is missing or unreadable.
    pub fn read_store(&self, name: &str, fallback: Value) -> Value {
        std::fs::read_to_string(self.store_dir().join(format!("{name}.json")))
            .ok().and_then(|t| serde_json::from_str(&t).ok()).unwrap_or(fallback)
    }
    pub fn write_store(&self, name: &str, data: &Value) -> Res<()> {
        std::fs::write(self.store_dir().join(format!("{name}.json")), serde_json::to_string_pretty(data)?)?;
        Ok(())
    }
}

/// %APPDATA%\Spectre: the same folder the Electron app used, so settings, notes and playbooks carry over.
pub fn data_dir() -> PathBuf { PathBuf::from(std::env::var("APPDATA").unwrap_or_default()).join("Spectre") }
