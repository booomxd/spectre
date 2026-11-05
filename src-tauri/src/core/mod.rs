// Backend core: the Riot client, errors, and the channel registry the React app calls through one `ipc` command.
pub mod error;
pub mod js;
pub mod riot;

use error::{msg, Res};
use futures::future::BoxFuture;
use riot::Riot;
use serde::de::DeserializeOwned;
use serde_json::Value;
use std::collections::HashMap;
use std::future::Future;
use std::sync::Arc;
use tauri::{AppHandle, Emitter};

/// What every handler gets: the shared Riot client and, inside the app, the Tauri handle.
/// `app` is None in the spectre-try CLI, where window features are unavailable.
#[derive(Clone)]
pub struct Ctx {
    pub riot: Arc<Riot>,
    pub app: Option<AppHandle>,
    pub is_dev: bool,
}

impl Ctx {
    /// Push an event to every window (the renderer listens with useEvent), like Electron's webContents.send.
    pub fn emit(&self, channel: &str, payload: Value) {
        if let Some(app) = &self.app { let _ = app.emit(channel, payload); }
    }
    /// The Tauri handle, or an error in the CLI.
    pub fn app(&self) -> Res<&AppHandle> { self.app.as_ref().ok_or_else(|| msg("Not available outside the app")) }
}

/// Handler arguments, as the renderer passed them to invoke(channel, ...args).
pub struct Args(pub Vec<Value>);

impl Args {
    /// The i-th argument (Null if missing), like a JS parameter left undefined.
    pub fn val(&self, i: usize) -> Value { self.0.get(i).cloned().unwrap_or(Value::Null) }
    /// String argument, "" if missing or not a string.
    pub fn str(&self, i: usize) -> String { self.0.get(i).and_then(Value::as_str).unwrap_or_default().to_string() }
    pub fn opt_str(&self, i: usize) -> Option<String> { self.0.get(i).and_then(Value::as_str).map(str::to_string) }
    /// JS truthiness of the i-th argument (`!!arg`).
    pub fn truthy(&self, i: usize) -> bool { truthy(&self.val(i)) }
    pub fn i64(&self, i: usize) -> Option<i64> { self.0.get(i).and_then(|v| v.as_i64().or_else(|| v.as_f64().map(|f| f as i64))) }
    pub fn f64(&self, i: usize) -> Option<f64> { self.0.get(i).and_then(Value::as_f64) }
    /// Deserialize the i-th argument.
    pub fn get<T: DeserializeOwned>(&self, i: usize) -> Res<T> { Ok(serde_json::from_value(self.val(i))?) }
}

/// JS truthiness: false for null, false, 0, NaN and "".
pub fn truthy(v: &Value) -> bool {
    match v {
        Value::Null => false,
        Value::Bool(b) => *b,
        Value::Number(n) => n.as_f64().map(|f| f != 0.0 && !f.is_nan()).unwrap_or(true),
        Value::String(s) => !s.is_empty(),
        _ => true,
    }
}

type Handler = Arc<dyn Fn(Ctx, Args) -> BoxFuture<'static, Res<Value>> + Send + Sync>;

/// channel -> handler, filled by each module's `register`.
#[derive(Default, Clone)]
pub struct Registry(HashMap<String, Handler>);

impl Registry {
    /// Register `channel`. The handler returns any serializable value (or Value::Null for "nothing").
    pub fn add<F, Fut>(&mut self, channel: &str, f: F)
    where
        F: Fn(Ctx, Args) -> Fut + Send + Sync + 'static,
        Fut: Future<Output = Res<Value>> + Send + 'static,
    {
        self.0.insert(channel.to_string(), Arc::new(move |c, a| Box::pin(f(c, a))));
    }

    pub fn channels(&self) -> Vec<String> {
        let mut v: Vec<String> = self.0.keys().cloned().collect();
        v.sort();
        v
    }

    /// Runs a channel. Errors come back as the user-facing message (the renderer throws it as an Error).
    pub async fn call(&self, ctx: Ctx, channel: &str, args: Vec<Value>) -> Result<Value, String> {
        let Some(h) = self.0.get(channel).cloned() else { return Err(format!("No handler registered for '{channel}'")) };
        match h(ctx, Args(args)).await {
            Ok(v) => Ok(v),
            Err(e) => {
                eprintln!("[{channel}] {e}");
                Err(e.to_string())
            }
        }
    }
}

/// Spawns a background task on Tauri's runtime (works in the CLI too).
pub fn spawn<F>(f: F) where F: Future<Output = ()> + Send + 'static {
    tauri::async_runtime::spawn(f);
}

/// Runs `f` every `every` after an initial `delay`, forever (setInterval).
pub fn every<F, Fut>(delay: std::time::Duration, every: std::time::Duration, f: F)
where
    F: Fn() -> Fut + Send + Sync + 'static,
    Fut: Future<Output = ()> + Send + 'static,
{
    spawn(async move {
        tokio::time::sleep(delay).await;
        loop {
            f().await;
            tokio::time::sleep(every).await;
        }
    });
}
