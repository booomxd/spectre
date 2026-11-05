// Errors every handler returns. The renderer gets the same text the Electron backend's errMsg() produced:
// "<status> <message or errorCode>" for HTTP failures, the plain message otherwise.
use serde_json::Value;
use std::fmt;

#[derive(Debug, Clone)]
pub enum Error {
    /// An HTTP response with a non-success status, with its parsed body (Null if it wasn't JSON).
    Http { status: u16, body: Value },
    Msg(String),
}

pub type Res<T = Value> = Result<T, Error>;

impl Error {
    /// HTTP status, like JS `err.response?.status`.
    pub fn status(&self) -> Option<u16> {
        match self {
            Error::Http { status, .. } => Some(*status),
            Error::Msg(_) => None,
        }
    }
    /// Response body, like JS `err.response?.data`.
    pub fn body(&self) -> Option<&Value> {
        match self {
            Error::Http { body, .. } => Some(body),
            Error::Msg(_) => None,
        }
    }
}

impl fmt::Display for Error {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Error::Http { status, body } => {
                let detail = body.get("message").and_then(Value::as_str)
                    .or_else(|| body.get("errorCode").and_then(Value::as_str))
                    .unwrap_or("");
                write!(f, "{}", format!("{status} {detail}").trim())
            }
            Error::Msg(m) => write!(f, "{m}"),
        }
    }
}

impl std::error::Error for Error {}

/// Plain error from a message: `return Err(msg("Enter a Riot ID"))`.
pub fn msg(m: impl Into<String>) -> Error { Error::Msg(m.into()) }

/// `bail!("...")` returns early with a message error, like JS `throw new Error(...)`.
#[macro_export]
macro_rules! bail {
    ($($t:tt)*) => { return Err($crate::core::error::Error::Msg(format!($($t)*))) };
}

impl From<reqwest::Error> for Error {
    fn from(e: reqwest::Error) -> Self {
        if e.is_timeout() { return Error::Msg(format!("timeout of request exceeded ({})", e.url().map(|u| u.host_str().unwrap_or("")).unwrap_or(""))); }
        Error::Msg(e.to_string())
    }
}
impl From<std::io::Error> for Error { fn from(e: std::io::Error) -> Self { Error::Msg(e.to_string()) } }
impl From<serde_json::Error> for Error { fn from(e: serde_json::Error) -> Self { Error::Msg(e.to_string()) } }
impl From<tauri::Error> for Error { fn from(e: tauri::Error) -> Self { Error::Msg(e.to_string()) } }
impl From<String> for Error { fn from(e: String) -> Self { Error::Msg(e) } }
impl From<&str> for Error { fn from(e: &str) -> Self { Error::Msg(e.to_string()) } }
