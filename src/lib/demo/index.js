// Demo-data mode: answers every backend channel from sample fixtures so the UI runs in a plain browser
import { setTheme, THEMES } from '../theme'
import { BUDDY_LEVELS, CONTRACTS, GUNS, OWNED_CHROMAS, OWNED_LEVELS } from './assets'
import * as F from './fixtures'

const params = new URLSearchParams(window.location.search)
const clone = v => (v == null ? v : JSON.parse(JSON.stringify(v)))
const wait = (ms = 120) => new Promise(r => setTimeout(r, ms + Math.random() * 120))

// ---- events ----
const listeners = new Map()
export function listen(channel, fn) {
  if (!listeners.has(channel)) listeners.set(channel, new Set())
  listeners.get(channel).add(fn)
  return () => listeners.get(channel)?.delete(fn)
}
export function emit(channel, payload) { listeners.get(channel)?.forEach(fn => { try { fn(clone(payload)) } catch (e) { console.error(e) } }) }

// ---- in-memory stores (reset on reload; nothing leaves the page) ----
const SPRAY_TYPE = 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475'
const settingsDefaults = {
  launchAtLogin: true, minimizeToTray: false, closeToTray: true,
  overlay: { opacity: 0.9, scale: 1, autoShow: false, locked: false, showPeak: true, hotkey: 'Ctrl+Shift+O', lockHotkey: 'Ctrl+Shift+L' },
  discord: {
    enabled: false, showMode: true, showMap: true, showAgent: false, agentImage: false, showRank: true, showPeak: false,
    showLevel: false, showParty: true, showScore: true, showElapsed: true, showLobby: true,
  },
  startPage: params.get('page') || 'dashboard', spectrePresence: true,
  experimental: params.get('experimental') === '1',
}
const db = {
  settings: settingsDefaults,
  memos: Object.fromEntries(F.MEMOS.map(m => [m.puuid, m])),
  notebook: clone(F.NOTEBOOK),
  playbooks: clone(F.PLAYBOOKS),
  recent: [F.FRIENDS[0], F.STRANGERS[2], F.FRIENDS[4]].map(p => ({ puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine })),
  friendlog: clone(F.FRIENDLOG),
  presets: [
    { id: 'preset-kuronami', name: 'Kuronami', createdAt: F.NOW - 864e5 * 6, loadout: { Guns: GUNS, ActiveExpressions: [], Identity: {} } },
    { id: 'preset-classic', name: 'Clean defaults', createdAt: F.NOW - 864e5 * 20, loadout: { Guns: GUNS, ActiveExpressions: [], Identity: {} } },
  ],
  loadout: {
    Subject: F.ME.puuid, Version: 42,
    Guns: GUNS.map((g, i) => (i % 3 === 0 ? { ...g, CharmInstanceID: `c0ffee00-0000-4000-8000-00000000000${i % 5}`, CharmID: '', CharmLevelID: BUDDY_LEVELS[i % BUDDY_LEVELS.length] } : g)),
    ActiveExpressions: [
      { TypeID: SPRAY_TYPE, AssetID: '89565f02-495e-e6f0-5f67-959626122909' },
      { TypeID: SPRAY_TYPE, AssetID: '4352547a-41de-277c-6083-0ea12bf04ff6' },
      { TypeID: SPRAY_TYPE, AssetID: '515a130a-4a2e-e0a4-9a73-c784f8f16e2a' },
    ],
    Identity: { PlayerCardID: F.ME.card, PlayerTitleID: F.TITLE.lurker, AccountLevel: F.ME.level, PreferredLevelBorderID: '9c4afb15-40d7-3557-062a-4bb198cb9958', HideAccountLevel: false },
    Incognito: false,
  },
  overrides: {}, keep: false,
}

// strip "_private" helper keys used to build fixtures
const pub = o => (o && typeof o === 'object' && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).filter(([k]) => !k.startsWith('_'))) : o)

function storefront() {
  const H = 3600
  const offer = (id, price) => ({ id, itemId: id, price })
  return {
    bundles: [{
      id: '69d9b2be-4439-0785-780b-ba8951053683', secondsLeft: 5 * 86400 + 7 * H, totalBase: 9900, totalDiscounted: 7100, discountPercent: 0.28, wholesaleOnly: false,
      items: [
        ['636c1f83-44f7-6bc4-0b24-88a1beb66c2d', 'e7c63390-eda7-46e0-bb7a-a6abdacd2433', 2675], ['0c989088-43ef-22ad-cc43-81a27bde2377', 'e7c63390-eda7-46e0-bb7a-a6abdacd2433', 2675],
        ['72b3bacc-48ac-85f7-ec38-5ab629654486', 'e7c63390-eda7-46e0-bb7a-a6abdacd2433', 2675], ['60edaaf5-41b2-1652-af0a-2dafed7bc71e', 'e7c63390-eda7-46e0-bb7a-a6abdacd2433', 2675],
        ['99b0edce-48db-b898-1d6f-0fa89795226d', 'e7c63390-eda7-46e0-bb7a-a6abdacd2433', 5350], ['15ec0de5-4d3e-8342-fa72-6d964e348104', 'dd3bf334-87f3-40bd-b043-682a57a8dc3a', 475],
        ['1a127cbf-4131-3581-da59-529b7e0d9495', '3f296c07-64c3-494c-923b-fe692a4fa1bd', 375], ['515a130a-4a2e-e0a4-9a73-c784f8f16e2a', 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475', 325],
      ].map(([id, typeId, base]) => ({ id, typeId, amount: 1, base, price: Math.round(base * 0.72), discount: 0.28 })),
    }],
    daily: [
      offer('c9678d8c-4327-f397-b0ec-dca3c3d6fb15', 1775), offer('c00e786e-4e6f-0ef7-0ce3-32ba9918ba41', 1775),
      offer('2b555f97-46bb-5949-3531-979f5bc817f0', 1775), offer('ba42fe63-457a-78ce-4499-47950a698129', 1775),
    ],
    dailySecondsLeft: 9 * H + 23 * 60,
    night: {
      secondsLeft: 6 * 86400 + 2 * H,
      offers: [
        ['9f6e4612-433b-aea9-1683-3db7aee90848', 2175, 41, true], ['4e435234-49a2-1444-4640-908692c855b8', 2175, 33, true],
        ['ed8a1109-4e48-f077-636b-e98dd332bfcc', 1775, 28, true], ['82db01d1-4192-167b-9f53-78ba374c39ac', 2175, 22, false],
        ['f7862f1f-4340-6e42-b1fa-0ebcdcf43456', 1775, 19, false], ['0ff7ff25-42cf-769a-4e6d-bd833121302d', 2175, 36, false],
      ].map(([id, base, d, revealed], i) => ({ id: `nm-${i}`, itemId: id, base, price: Math.round(base * (1 - d / 100)), discount: d, revealed })),
    },
    accessories: {
      secondsLeft: 2 * 86400 + 11 * H,
      offers: [
        ['a40f0146-4420-645d-6d53-73a362900af0', '3f296c07-64c3-494c-923b-fe692a4fa1bd', 2500], ['89565f02-495e-e6f0-5f67-959626122909', 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475', 3000],
        ['2d4dcbe6-452e-6b68-f977-c5ac74dc61eb', 'dd3bf334-87f3-40bd-b043-682a57a8dc3a', 4000], ['254021ec-426c-85de-3eba-faaeff17a5f5', 'de7caa6b-adf7-4588-bbd1-143831e786c6', 2000],
      ].map(([itemId, typeId, price], i) => ({ id: `acc-${i}`, contractId: CONTRACTS[0].id, itemId, typeId, price, currencyId: '85ca954a-41f2-ce94-9b45-8ca3dd39a00d' })),
    },
  }
}

const owned = () => ({
  levels: OWNED_LEVELS, chromas: OWNED_CHROMAS,
  cards: [...new Set([F.ME.card, ...Object.keys(F.CARD)])], titles: Object.values(F.TITLE),
  buddies: BUDDY_LEVELS.map((id, i) => ({ id, instance: `c0ffee00-0000-4000-8000-00000000000${i}` })),
  sprays: ['89565f02-495e-e6f0-5f67-959626122909', '4352547a-41de-277c-6083-0ea12bf04ff6', '515a130a-4a2e-e0a4-9a73-c784f8f16e2a', '88296964-422d-3e9a-fcd0-1f8d7e97f66c'],
})

const ok = v => () => v
const fail = m => () => { throw new Error(m) }
const setSettings = patch => {
  const cur = db.settings
  db.settings = { ...cur, ...patch, overlay: { ...cur.overlay, ...patch?.overlay }, discord: { ...cur.discord, ...patch?.discord } }
  emit('settings:changed', db.settings)
  return db.settings
}
const presenceOut = () => ({ overrides: { ...db.overrides } })
const applyTool = obj => {
  for (const [k, v] of Object.entries(obj || {})) if (v !== undefined) db.overrides[k] = v
  emit('tools:applied', { overrides: db.overrides, at: Date.now() })
  return presenceOut()
}
const riotStatus = { connected: true, puuid: F.ME.puuid, gameName: F.ME.gameName, tagLine: F.ME.tagLine, shard: 'eu', region: 'eu', clientVersion: 'release-11.10-shipping-14-3456789' }
const overlayState = { open: params.has('overlay'), locked: false }

// channel -> handler(...args)
const H = {
  'riot:status': ok(riotStatus),
  'riot:connect': ok(riotStatus),
  'app:openExternal': ok(null),
  'app:openDataFolder': ok(null),
  'app:clearCache': ok(true),
  'app:info': ok({ version: '2.4.0', dataPath: 'C:\\Users\\you\\AppData\\Roaming\\spectre', tauri: '2.9.0', platform: 'windows' }),
  'win:minimize': ok(null), 'win:maximize': ok(null), 'win:close': ok(null),

  'settings:get': () => db.settings,
  'settings:set': p => setSettings(p && typeof p === 'object' ? p : {}),

  'live:state': () => (params.get('live') === 'idle' ? { state: 'menus' } : F.liveState()),
  'live:scout': ref => F.liveScout(ref),
  'live:loadout': ref => F.liveLoadout(ref),

  'history:list': (puuid, opts) => F.historyList(puuid, opts || {}),
  'history:summary': (id, puuid) => F.summary(id, puuid || F.ME.puuid),
  'history:rr': () => F.rrMap(),
  'history:detail': id => {
    const d = F.detail(id)
    return { ...d, players: d.players.map(pub) }
  },
  'activity:recent': n => F.encounters(n ?? 20),

  'search:lookup': text => {
    const t = String(text || ''), i = t.lastIndexOf('#')
    if (i <= 0 || !t.slice(i + 1).trim()) throw new Error('Enter a Riot ID like Name#Tag')
    const p = F.lookupName(t.trim())
    if (!p) throw new Error(`No player found for ${t.slice(0, i).trim()}#${t.slice(i + 1).trim()}`)
    return { puuid: p.puuid, gameName: p.gameName, tagLine: p.tagLine }
  },
  'search:profile': puuid => F.profile(puuid),
  'search:scout': puuid => F.searchScout(puuid),
  'search:recent': () => db.recent,
  'search:pushRecent': e => {
    if (!e?.puuid) return []
    db.recent = [e, ...db.recent.filter(x => x.puuid !== e.puuid)].slice(0, 12)
    return db.recent
  },
  'search:clearRecent': () => (db.recent = []),

  'social:friends': () => F.friendsList(),
  'social:requests': () => F.requests(),
  'social:party': () => F.party(),
  'social:addFriend': (n, t) => { if (!n || !t) throw new Error('Enter a Riot ID as Name#Tag'); return true },
  'social:acceptRequest': ok(true), 'social:declineRequest': ok(true), 'social:cancelRequest': ok(true), 'social:removeFriend': ok(true),
  'social:partyAccess': ok(true), 'social:invite': ok(true), 'social:queue': ok(true), 'social:matchmaking': ok(true), 'social:ready': ok(true),
  'social:inviteCode': create => (create ? 'K7Q2XD' : null),
  'social:joinCode': c => { if (!String(c || '').trim()) throw new Error('Enter an invite code'); return true },
  'social:partyRemove': ok(true),
  'chat:conversations': () => F.conversations(),
  'chat:messages': cid => F.messagesFor(cid),
  'chat:send': (cid, body) => {
    const text = String(body || '').trim()
    if (!text) throw new Error('Message is empty')
    // echo only: nothing is sent anywhere
    return { id: `local-${Date.now()}`, cid, body: text, time: Date.now(), puuid: F.ME.puuid, gameName: F.ME.gameName, tagLine: F.ME.tagLine, fromMe: true }
  },

  'wishlist:list': () => db.wishlist || [],
  // sample announcement so demo screenshots show the banner
  'announce:list': () => ({ version: '4.0.0', items: [{ id: 'demo-welcome', title: 'Spectre 4.0 is here', body: 'Faster tab switching and smoother scrolling. Thanks for using Spectre!', link: 'https://github.com/booomxd/spectre/releases', linkLabel: 'Release notes' }] }),
  'wishlist:toggle': w => { const l = db.wishlist || []; db.wishlist = l.some(i => i.id === w.id) ? l.filter(i => i.id !== w.id) : [...l, w]; return db.wishlist },
  'wishlist:check': ok({ hits: [] }),
  'share:save': ok('C:/Users/demo/Pictures/Spectre/card.png'),
  'store:wallet': ok({ vp: 2350, rad: 45, kc: 8450 }),
  'store:storefront': () => storefront(),
  'store:rank': ok({ tier: F.ME.tier, rr: F.ME.rr, lastChange: 21, peak: F.ME.peak, seasonId: F.ACTS[0] }),
  'store:identity': () => ({ cardId: db.loadout.Identity.PlayerCardID, titleId: db.loadout.Identity.PlayerTitleID, level: F.ME.level, hideLevel: false }),

  'progression:contracts': ok({ active: CONTRACTS[1].id, contracts: CONTRACTS }),
  'progression:account': ok({
    level: F.ME.level, xp: 3120,
    history: F.MATCHES.slice(0, 10).map((m, i) => ({ id: m.id, start: m.start, xp: [4200, 3900, 5100, 1800, 4400, 3600, 1500, 4800, 3200, 4100][i] })),
  }),
  'progression:rrHistory': n => F.rrHistory(n ?? 20),

  'leaderboard:get': opts => F.leaderboard(opts || {}),

  'loadout:get': () => db.loadout,
  'loadout:owned': () => owned(),
  'loadout:save': next => {
    db.loadout = {
      ...db.loadout, Guns: next?.Guns || db.loadout.Guns, ActiveExpressions: next?.ActiveExpressions || db.loadout.ActiveExpressions,
      Identity: { ...db.loadout.Identity, ...next?.Identity }, Version: db.loadout.Version + 1,
    }
    return db.loadout
  },
  'loadout:equip': (weaponId, skinId, levelId, chromaId) => {
    db.loadout = {
      ...db.loadout, Version: db.loadout.Version + 1,
      Guns: db.loadout.Guns.map(g => (g.ID.toLowerCase() === String(weaponId).toLowerCase() ? { ...g, SkinID: skinId, SkinLevelID: levelId || g.SkinLevelID, ChromaID: chromaId || g.ChromaID } : g)),
    }
    return db.loadout
  },
  'loadout:identity': o => H['loadout:save']({
    Identity: {
      ...(o?.cardId ? { PlayerCardID: o.cardId } : {}), ...(o && 'titleId' in o ? { PlayerTitleID: o.titleId || '00000000-0000-0000-0000-000000000000' } : {}),
      ...(o?.borderId ? { PreferredLevelBorderID: o.borderId } : {}), ...(o && 'hideLevel' in o ? { HideAccountLevel: !!o.hideLevel } : {}),
    },
  }),
  'loadout:presets': () => db.presets,
  'loadout:presetSave': name => {
    const n = String(name || '').trim() || `Preset ${db.presets.length + 1}`
    db.presets = [...db.presets, { id: `preset-${Date.now()}`, name: n, createdAt: Date.now(), loadout: { Guns: db.loadout.Guns, ActiveExpressions: db.loadout.ActiveExpressions, Identity: {} } }]
    return db.presets
  },
  'loadout:presetRename': (id, name) => (db.presets = db.presets.map(p => (p.id === id && String(name || '').trim() ? { ...p, name: String(name).trim() } : p))),
  'loadout:presetDelete': id => (db.presets = db.presets.filter(p => p.id !== id)),
  'loadout:presetApply': id => {
    if (!db.presets.some(p => p.id === id)) throw new Error('Preset not found')
    return { loadout: db.loadout, skipped: [] }
  },

  'memo:list': () => Object.values(db.memos).sort((a, b) => b.updatedAt - a.updatedAt),
  'memo:get': puuid => db.memos[puuid] || null,
  'memo:save': m => {
    if (!m?.puuid) throw new Error('Memo needs a puuid')
    const old = db.memos[m.puuid] || {}
    const rating = [-1, 0, 1].includes(m.rating) ? m.rating : 0
    const tags = [...new Set((m.tags || []).map(t => String(t).trim()).filter(Boolean))].slice(0, 12)
    db.memos[m.puuid] = { ...old, puuid: m.puuid, name: String(m.name || old.name || '').slice(0, 64), tags, rating, text: String(m.text || '').slice(0, 2000), updatedAt: Date.now(), ...(m.encounters != null ? { encounters: m.encounters } : {}) }
    return db.memos[m.puuid]
  },
  'memo:delete': puuid => { delete db.memos[puuid]; return true },

  'notebook:get': () => db.notebook,
  'notebook:save': doc => (db.notebook = { sections: (doc?.sections || []).length ? clone(doc.sections).slice(0, 60) : clone(F.NOTEBOOK.sections.slice(0, 1)) }),
  'notebook:reset': () => (db.notebook = { sections: [{ id: 'general', name: 'General', color: 'accent', icon: 'note', notes: '', crosshairs: [], links: [], snippets: [], updatedAt: Date.now() }] }),

  'playbooks:list': () => db.playbooks,
  'playbooks:save': pb => {
    if (!pb?.id) throw new Error('Playbook id missing')
    const i = db.playbooks.findIndex(p => p.id === pb.id)
    db.playbooks = i >= 0 ? db.playbooks.map((p, j) => (j === i ? clone(pb) : p)) : [...db.playbooks, clone(pb)]
    return { id: pb.id, savedAt: Date.now() }
  },
  'playbooks:delete': id => { db.playbooks = db.playbooks.filter(p => p.id !== id); return true },
  'playbooks:exportPng': ok({ canceled: true }),
  'playbooks:imageData': ok({}),

  'friendlog:list': () => db.friendlog,
  'friendlog:scan': () => (db.friendlog = { ...db.friendlog, lastScan: Date.now() }),
  'friendlog:clear': () => (db.friendlog = { ...db.friendlog, events: [] }),

  'patchnotes:list': ok(F.PATCH_NOTES),
  'feedback:config': ok({ key: 'demo', repo: 'booomxd/spectre', version: '2.4.0' }),

  'discord:status': () => ({ enabled: false, connected: false, user: null, error: null, lastUpdate: null, activity: null }),
  'discord:preview': name => F.discordPreview(name ?? 'live'),
  'discord:connect': ok({ enabled: false, connected: false, user: null, error: 'Discord is not running (demo)', lastUpdate: null, activity: null }),
  'discord:disconnect': ok({ enabled: false, connected: false, user: null, error: null, lastUpdate: null, activity: null }),

  'overlay:state': () => overlayState,
  'overlay:toggle': () => { overlayState.open = !overlayState.open; emit('overlay:state', overlayState); return overlayState },
  'overlay:close': () => { overlayState.open = false; emit('overlay:state', overlayState); return overlayState },
  'overlay:lock': on => { overlayState.locked = !!on; setSettings({ overlay: { locked: !!on } }); emit('overlay:state', overlayState); return overlayState },
  'overlay:hotkeys': () => ({ toggle: { key: db.settings.overlay.hotkey, ok: true }, lock: { key: db.settings.overlay.lockHotkey, ok: true } }),
  'overlay:pauseHotkeys': ok(true),

  'tools:state': () => ({ overrides: { ...db.overrides }, keep: db.keep, current: F.PRESENCE, error: null }),
  'tools:keep': on => { db.keep = !!on; if (!on) db.overrides = {}; return { keep: db.keep } },
  'tools:reset': () => { db.overrides = {}; emit('tools:applied', { overrides: {}, at: Date.now() }); return presenceOut() },
  'tools:rank': p => applyTool({ 'playerPresenceData.competitiveTier': p?.tier ?? 0, 'playerPresenceData.leaderboardPosition': p?.leaderboard }),
  'tools:profile': p => applyTool({ 'playerPresenceData.accountLevel': p?.accountLevel, 'playerPresenceData.playerCardId': p?.playerCardId, 'playerPresenceData.playerTitleId': p?.playerTitleId }),
  'tools:premier': p => applyTool(Object.fromEntries(Object.entries(p || {}).map(([k, v]) => [`premierPresenceData.${k}`, v]))),
  'tools:status': s => applyTool({ 'matchPresenceData.sessionLoopState': s?.state || 'MENUS', 'matchPresenceData.queueId': s?.queue, 'matchPresenceData.matchMap': s?.map }),

  'spectre:releases': ok(F.RELEASES),
  'update:status': ok({ current: '2.4.0', latest: '2.4.0', available: false, url: F.RELEASES[0].url, canInstall: false }),
  'update:check': ok({ current: '2.4.0', latest: '2.4.0', available: false, url: F.RELEASES[0].url, canInstall: false }),
  'update:install': fail('Updates are disabled in demo mode'),
}

export async function invoke(channel, ...args) {
  const h = H[channel]
  if (!h) {
    console.warn(`[demo] no fixture for "${channel}"`)
    throw new Error(`Demo: no data for ${channel}`)
  }
  await wait(channel === 'live:scout' ? 500 : 80)
  return clone(await h(...args))
}

export const isOverlay = () => params.has('overlay')

// runs once when demo mode loads: theme, experimental flag, starting page, and a guard on outgoing form posts
let booted = false
export function demoBoot() {
  if (booted) return
  booted = true
  const theme = params.get('theme')
  if (theme && THEMES.some(t => t.id === theme)) setTheme(theme)
  if (params.get('experimental') === '1') {
    try { localStorage.setItem('spectre.experimental', '1') } catch (e) { /* storage unavailable */ }
  }
  // the feedback page posts to a form service
  const realFetch = window.fetch.bind(window)
  window.fetch = (url, opts) => (String(url).includes('api.web3forms.com')
    ? Promise.resolve(new Response(JSON.stringify({ success: true, message: 'Demo: not sent' }), { headers: { 'Content-Type': 'application/json' } }))
    : realFetch(url, opts))
  // open the requested page once the shell has mounted its navigate listener
  const page = params.get('page')
  if (page) {
    const go = (tries = 0) => {
      if (document.getElementById('root')?.childElementCount) {
        setTimeout(() => window.dispatchEvent(new CustomEvent('spectre:navigate', { detail: { page, params: {} } })), 150)
      } else if (tries < 200) requestAnimationFrame(() => go(tries + 1))
    }
    go()
  }
  console.info('[demo] Spectre demo mode: sample data only')
}
