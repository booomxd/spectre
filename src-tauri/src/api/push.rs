// Riot Client push: the client's local WebSocket (same port and password as its local API, 127.0.0.1 only) says
// when friends, presences, friend requests or chat messages change. Spectre only listens: it subscribes to those
// events and tells the pages which data changed, so they refresh at once instead of polling every few seconds.
use crate::core::error::{msg, Res};
use crate::core::{shared, Ctx, Registry};
use base64::Engine;
use futures::{SinkExt, StreamExt};
use serde_json::{json, Value};
use std::collections::BTreeSet;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio_rustls::rustls::{self, pki_types};
use tokio_tungstenite::tungstenite::{client::IntoClientRequest, Message};

/// Riot event -> what the pages call it
const EVENTS: &[(&str, &str)] = &[
    ("OnJsonApiEvent_chat_v4_presences", "presences"),
    ("OnJsonApiEvent_chat_v4_friends", "friends"),
    ("OnJsonApiEvent_chat_v4_friendrequests", "requests"),
    ("OnJsonApiEvent_chat_v6_messages", "chat"),
    ("OnJsonApiEvent_chat_v6_conversations", "chat"),
];
/// a burst of events (a friend's presence updates several times in a row) becomes one refresh
const SETTLE: Duration = Duration::from_millis(250);

static LIVE: AtomicBool = AtomicBool::new(false);

fn set_live(ctx: &Ctx, live: bool) {
    if LIVE.swap(live, Ordering::SeqCst) != live { ctx.emit("riot:push", json!({ "live": live, "kinds": [] })); }
}

pub fn register(reg: &mut Registry, ctx: &Ctx) {
    reg.add("push:status", |_, _| async move { Ok(json!({ "live": LIVE.load(Ordering::SeqCst) })) });
    // inside the app only: the CLI has no pages to tell
    if ctx.app.is_some() {
        let ctx = ctx.clone();
        crate::core::spawn(async move {
            loop {
                if ctx.riot.connected() {
                    if let Err(e) = listen(&ctx).await { if ctx.is_dev { eprintln!("[push] {e}"); } }
                    set_live(&ctx, false);
                }
                // reconnects after the Riot Client restarts; the pages keep polling meanwhile
                tokio::time::sleep(Duration::from_secs(5)).await;
            }
        });
    }
}

async fn listen(ctx: &Ctx) -> Res<()> {
    let Some((port, password)) = ctx.riot.local_auth() else { return Err(msg("Not connected to the Riot Client")) };
    let port: u16 = port.parse().map_err(|_| msg("Bad Riot Client port"))?;
    let tcp = tokio::net::TcpStream::connect(("127.0.0.1", port)).await?;
    let tls = tokio_rustls::TlsConnector::from(Arc::new(local_tls()?))
        .connect(pki_types::ServerName::IpAddress(std::net::Ipv4Addr::LOCALHOST.into()), tcp).await?;
    let mut req = format!("wss://127.0.0.1:{port}/").into_client_request().map_err(|e| msg(e.to_string()))?;
    let auth = base64::engine::general_purpose::STANDARD.encode(format!("riot:{password}"));
    req.headers_mut().insert("Authorization", format!("Basic {auth}").parse().map_err(|_| msg("Bad Riot Client password"))?);
    let (mut ws, _) = tokio::time::timeout(Duration::from_secs(8), tokio_tungstenite::client_async(req, tls)).await
        .map_err(|_| msg("The Riot Client didn't answer"))?.map_err(|e| msg(e.to_string()))?;
    for (event, _) in EVENTS {
        ws.send(Message::Text(json!([5, event]).to_string().into())).await.map_err(|e| msg(e.to_string()))?;
    }
    set_live(ctx, true);

    let me = ctx.riot.puuid();
    let mut pending: BTreeSet<&'static str> = BTreeSet::new();
    loop {
        let next = if pending.is_empty() { None } else { Some(tokio::time::sleep(SETTLE)) };
        tokio::select! {
            frame = ws.next() => {
                let text = match frame {
                    Some(Ok(Message::Text(t))) => t,
                    Some(Ok(Message::Close(_))) | None => return Ok(()),
                    Some(Ok(_)) => continue,
                    Some(Err(e)) => return Err(msg(e.to_string())),
                };
                let Ok(Value::Array(m)) = serde_json::from_str::<Value>(text.as_str()) else { continue };
                if m.first().and_then(Value::as_i64) != Some(8) { continue; }
                let Some(kind) = EVENTS.iter().find(|(e, _)| m.get(1).and_then(Value::as_str) == Some(*e)).map(|(_, k)| *k) else { continue };
                pending.insert(kind);
                // your own presence carries your party: refresh it too
                if kind == "presences" {
                    let mine = m.get(2).and_then(|p| p["data"]["presences"].as_array())
                        .is_some_and(|list| list.iter().any(|p| p["puuid"].as_str() == Some(me.as_str())));
                    if mine { pending.insert("party"); }
                }
            }
            _ = async { if let Some(s) = next { s.await } else { std::future::pending::<()>().await } } => {
                shared::forget();
                ctx.emit("riot:push", json!({ "live": true, "kinds": pending.iter().collect::<Vec<_>>() }));
                pending.clear();
            }
        }
    }
}

/// TLS for 127.0.0.1 only: the Riot Client signs its local certificate itself, like the local API client
/// (`danger_accept_invalid_certs`), so the certificate isn't checked but the handshake signatures still are
fn local_tls() -> Res<rustls::ClientConfig> {
    let provider = Arc::new(rustls::crypto::ring::default_provider());
    let cfg = rustls::ClientConfig::builder_with_provider(provider.clone())
        .with_safe_default_protocol_versions().map_err(|e| msg(e.to_string()))?
        .dangerous().with_custom_certificate_verifier(Arc::new(LocalCert(provider)))
        .with_no_client_auth();
    Ok(cfg)
}

#[derive(Debug)]
struct LocalCert(Arc<rustls::crypto::CryptoProvider>);

impl rustls::client::danger::ServerCertVerifier for LocalCert {
    fn verify_server_cert(&self, _: &pki_types::CertificateDer<'_>, _: &[pki_types::CertificateDer<'_>], _: &pki_types::ServerName<'_>, _: &[u8], _: pki_types::UnixTime)
        -> Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }
    fn verify_tls12_signature(&self, message: &[u8], cert: &pki_types::CertificateDer<'_>, dss: &rustls::DigitallySignedStruct)
        -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls12_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }
    fn verify_tls13_signature(&self, message: &[u8], cert: &pki_types::CertificateDer<'_>, dss: &rustls::DigitallySignedStruct)
        -> Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        rustls::crypto::verify_tls13_signature(message, cert, dss, &self.0.signature_verification_algorithms)
    }
    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> { self.0.signature_verification_algorithms.supported_schemes() }
}
