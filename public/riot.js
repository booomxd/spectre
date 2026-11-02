// Shared Riot client used by every feature module in public/api.
// Connects through the local Riot Client (lockfile), then talks to the pd / glz / shared
// endpoints with the tokens it hands out.

const fs = require('fs');
const path = require('path');
const https = require('https');
const axios = require('axios');

const CLIENT_PLATFORM = 'ew0KCSJwbGF0Zm9ybVR5cGUiOiAiUEMiLA0KCSJwbGF0Zm9ybU9TIjogIldpbmRvd3MiLA0KCSJwbGF0Zm9ybU9TVmVyc2lvbiI6ICIxMC4wLjE5MDQyLjEuNzY4LjY0Yml0IiwNCgkicGxhdGZvcm1DaGlwc2V0IjogIlVua25vd24iDQp9';
const LOCAL = process.env.LOCALAPPDATA;
const insecure = new https.Agent({ rejectUnauthorized: false });

const state = {
    connected: false,
    port: null, password: null,
    accessToken: null, entitlementsToken: null,
    puuid: null, gameName: null, tagLine: null,
    shard: null, region: null, clientVersion: null,
};

function readLog() {
    try { return fs.readFileSync(path.join(LOCAL, 'VALORANT', 'Saved', 'Logs', 'ShooterGame.log'), 'utf8'); }
    catch (e) { return ''; }
}

async function local(method, p, body) {
    const res = await axios({
        method, url: `https://127.0.0.1:${state.port}/${p.replace(/^\//, '')}`, data: body, httpsAgent: insecure, timeout: 8000,
        headers: { Authorization: 'Basic ' + Buffer.from(`riot:${state.password}`).toString('base64'), 'Content-Type': 'application/json' },
    });
    return res.data;
}

async function refreshTokens() {
    const t = await local('get', 'entitlements/v1/token');
    state.accessToken = t.accessToken;
    state.entitlementsToken = t.token;
    state.puuid = t.subject;
}

async function connect() {
    const lock = fs.readFileSync(path.join(LOCAL, 'Riot Games', 'Riot Client', 'Config', 'lockfile'), 'utf8').split(':');
    state.port = lock[2];
    state.password = lock[3];
    await refreshTokens();

    // valorant-api.com lags behind live patches, so prefer the version the running game logged.
    const log = readLog();
    state.clientVersion = (log.match(/CI server version: (\S+)/) || [])[1] || null;
    if (!state.clientVersion) {
        try { state.clientVersion = (await axios.get('https://valorant-api.com/v1/version')).data.data.riotClientVersion; } catch (e) { }
    }

    try {
        const sessions = await local('get', 'product-session/v1/external-sessions');
        const val = Object.values(sessions).find(s => s.productId === 'valorant');
        const arg = (val?.launchConfiguration?.arguments || []).find(a => a.includes('-ares-deployment'));
        if (arg) state.shard = arg.split('=')[1];
    } catch (e) { }
    // Without the game running there is no -ares-deployment arg; fall back to the game log,
    // then to the chat region (jp1 lives on ap, br/latam on na).
    const session = await local('get', 'chat/v1/session');
    state.gameName = session.game_name;
    state.tagLine = session.game_tag;
    if (!state.shard) state.shard = (log.match(/https:\/\/pd\.(\w+)\.a\.pvp\.net/) || [])[1] || null;
    const chatRegion = (session.region || '').replace(/\d/g, '');
    if (!state.shard) state.shard = { jp: 'ap', br: 'na', latam: 'na' }[chatRegion] || chatRegion;
    state.region = (log.match(/https:\/\/glz-(\w+)-1\.\w+\.a\.pvp\.net/) || [])[1] || (['latam', 'br'].includes(chatRegion) ? chatRegion : state.shard);

    state.connected = true;
    return status();
}

function status() {
    const { connected, puuid, gameName, tagLine, shard, region, clientVersion } = state;
    return { connected, puuid, gameName, tagLine, shard, region, clientVersion };
}

function remoteHeaders() {
    return {
        Authorization: 'Bearer ' + state.accessToken,
        'X-Riot-Entitlements-JWT': state.entitlementsToken,
        'X-Riot-ClientVersion': state.clientVersion,
        'X-Riot-ClientPlatform': CLIENT_PLATFORM,
        'Content-Type': 'application/json',
    };
}

// Tokens expire after about an hour; refresh once and retry on an auth failure.
async function remote(base, method, p, body, retried) {
    if (!state.connected) throw new Error('Not connected to the Riot Client');
    try {
        const res = await axios({ method, url: base + '/' + p.replace(/^\//, ''), data: body, headers: remoteHeaders(), timeout: 10000 });
        return res.data;
    } catch (err) {
        const s = err.response?.status;
        if (!retried && (s === 400 || s === 401) && /token|claims|auth/i.test(JSON.stringify(err.response?.data || ''))) {
            await refreshTokens();
            return remote(base, method, p, body, true);
        }
        throw err;
    }
}

const pd = (method, p, body) => remote(`https://pd.${state.shard}.a.pvp.net`, method, p, body);
const glz = (method, p, body) => remote(`https://glz-${state.region}-1.${state.shard}.a.pvp.net`, method, p, body);
const shared = (method, p, body) => remote(`https://shared.${state.shard}.a.pvp.net`, method, p, body);

// valorant-api.com content (agents, maps, weapons, tiers...), cached for the session.
const apiCache = new Map();
async function valApi(p) {
    if (!apiCache.has(p)) {
        apiCache.set(p, axios.get('https://valorant-api.com/v1/' + p.replace(/^\//, '')).then(r => r.data.data).catch(e => { apiCache.delete(p); throw e; }));
    }
    return apiCache.get(p);
}

// puuid -> "Name#Tag". Some players are hidden by streamer mode; callers must respect that
// themselves using the match / presence data (this only resolves names).
async function names(puuids) {
    const list = [...new Set(puuids.filter(Boolean))];
    if (!list.length) return {};
    const rows = await pd('put', 'name-service/v2/players', list);
    return Object.fromEntries(rows.map(r => [r.Subject, { gameName: r.GameName, tagLine: r.TagLine }]));
}

// Small JSON store in the app's userData folder (memos, playbooks, presets, settings...).
let storeDir = null;
function setStoreDir(dir) { storeDir = dir; fs.mkdirSync(dir, { recursive: true }); }
function readStore(name, fallback) {
    try { return JSON.parse(fs.readFileSync(path.join(storeDir, name + '.json'), 'utf8')); }
    catch (e) { return fallback; }
}
function writeStore(name, data) {
    fs.writeFileSync(path.join(storeDir, name + '.json'), JSON.stringify(data, null, 2));
}

// Human-readable error for the renderer.
function errMsg(err) {
    if (err.response) return `${err.response.status} ${err.response.data?.message || err.response.data?.errorCode || ''}`.trim();
    return err.message || String(err);
}

module.exports = { state, connect, status, refreshTokens, local, pd, glz, shared, valApi, names, setStoreDir, readStore, writeStore, errMsg };
