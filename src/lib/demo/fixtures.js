// Sample world for demo mode (screenshots / UI work in a plain browser). Every name here is made up; asset ids are
// real public valorant-api.com ids so images render. Shapes mirror what the Rust handlers in src-tauri/src/api return.
import { BUDDIES, CARDS, SKINS, SPRAYS, WEAPON_ORDER } from './assets'

// ---- deterministic randomness ----
export function rng(seed) {
  let a = typeof seed === 'number' ? seed : [...String(seed)].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261)
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const int = (r, a, b) => a + Math.floor(r() * (b - a + 1))
const pickOne = (r, list) => list[Math.floor(r() * list.length)]
const round = (n, d = 0) => Math.round(n * 10 ** d) / 10 ** d

export const NOW = Date.now()
const MIN = 60e3, HOUR = 60 * MIN, DAY = 24 * HOUR

// ---- content ids (valorant-api.com) ----
export const AGENT = {
  jett: 'add6443a-41bd-e414-f6ad-e58d267f4e95', sova: '320b2a48-4d9b-a075-30f1-1f93a9b638fa', omen: '8e253930-4c05-31dd-1b6c-968525494517',
  killjoy: '1e58de9c-4950-5125-93e9-a0aee9f98746', breach: '5f8d3a7f-467b-97f3-062c-13acf203c006', reyna: 'a3bfb853-43b2-7238-a4f1-ad90e9e46bcc',
  raze: 'f94c3b30-42be-e959-889c-5aa313dba261', viper: '707eab51-4836-f488-046a-cda6bf494859', fade: 'dade69b4-4f5a-8528-247b-219e5a1facd6',
  cypher: '117ed9e3-49f3-6512-3ccf-0cada7e3823b', clove: '1dbf2edd-4729-0984-3115-daa5eed44993', neon: 'bb2a4828-46eb-8cd1-e765-15848195d751',
  sage: '569fdd95-4d10-43ab-ca70-79becc718b46', skye: '6f2a04ca-43e0-be17-7f36-b3908627744d', astra: '41fb69c1-4189-7b37-f117-bcaf1e96f1bf',
  kayo: '601dbbe7-43ce-be57-2a40-4abd24953621', chamber: '22697a3d-45bf-8dd7-4fec-84a9e28c69d7', gekko: 'e370fa57-4757-3604-3648-499e1f642d3f',
  iso: '0e38b510-41a8-5780-5e8f-568b2a4f2d6c', harbor: '95b78ed7-4637-86d9-7e41-71ba8c293152', brimstone: '9f0d8ba9-4140-b941-57d3-a7ad57c6b417',
}
export const AGENT_INFO = {
  [AGENT.jett]: ['Jett', 'Duelist'], [AGENT.sova]: ['Sova', 'Initiator'], [AGENT.omen]: ['Omen', 'Controller'], [AGENT.killjoy]: ['Killjoy', 'Sentinel'],
  [AGENT.breach]: ['Breach', 'Initiator'], [AGENT.reyna]: ['Reyna', 'Duelist'], [AGENT.raze]: ['Raze', 'Duelist'], [AGENT.viper]: ['Viper', 'Controller'],
  [AGENT.fade]: ['Fade', 'Initiator'], [AGENT.cypher]: ['Cypher', 'Sentinel'], [AGENT.clove]: ['Clove', 'Controller'], [AGENT.neon]: ['Neon', 'Duelist'],
  [AGENT.sage]: ['Sage', 'Sentinel'], [AGENT.skye]: ['Skye', 'Initiator'], [AGENT.astra]: ['Astra', 'Controller'], [AGENT.kayo]: ['KAY/O', 'Initiator'],
  [AGENT.chamber]: ['Chamber', 'Sentinel'], [AGENT.gekko]: ['Gekko', 'Initiator'], [AGENT.iso]: ['Iso', 'Duelist'], [AGENT.harbor]: ['Harbor', 'Controller'],
  [AGENT.brimstone]: ['Brimstone', 'Controller'],
}
export const agentObj = id => ({
  id, name: AGENT_INFO[id][0], icon: `https://media.valorant-api.com/agents/${id}/displayicon.png`, role: AGENT_INFO[id][1],
})

export const MAP = {
  ascent: { uuid: '7eaecc1b-4337-bbf6-6ab9-04b8f06b3319', name: 'Ascent', url: '/Game/Maps/Ascent/Ascent' },
  split: { uuid: 'd960549e-485c-e861-8d71-aa9d1aed12a2', name: 'Split', url: '/Game/Maps/Bonsai/Bonsai' },
  bind: { uuid: '2c9d57ec-4431-9c5e-2939-8f9ef6dd5cba', name: 'Bind', url: '/Game/Maps/Duality/Duality' },
  haven: { uuid: '2bee0dc9-4ffe-519b-1cbd-7fbe763a6047', name: 'Haven', url: '/Game/Maps/Triad/Triad' },
  lotus: { uuid: '2fe4ed3a-450a-948b-6d6b-e89a78e680a9', name: 'Lotus', url: '/Game/Maps/Jam/Jam' },
  sunset: { uuid: '92584fbe-486a-b1b2-9faa-39b0f486b498', name: 'Sunset', url: '/Game/Maps/Juliett/Juliett' },
  pearl: { uuid: 'fd267378-4d1d-484f-ff52-77821ed10dc2', name: 'Pearl', url: '/Game/Maps/Pitt/Pitt' },
  icebox: { uuid: 'e2ad5c54-4114-a870-9641-8ea21279579a', name: 'Icebox', url: '/Game/Maps/Port/Port' },
  abyss: { uuid: '224b0a95-48b9-f703-1bd8-67aca101a61f', name: 'Abyss', url: '/Game/Maps/Infinity/Infinity' },
  corrode: { uuid: '1c18ab1f-420d-0d8b-71d0-77ad3c439115', name: 'Corrode', url: '/Game/Maps/Rook/Rook' },
}
const mapSplash = m => `https://media.valorant-api.com/maps/${m.uuid}/splash.png`
const mapList = m => `https://media.valorant-api.com/maps/${m.uuid}/listviewicon.png`

// Acts (valorant-api seasons): current first.
export const ACTS = ['d816f426-48ea-f052-117f-9697a155b319', '8102cd81-43a0-d0d7-bd59-47b8fe9bed1b', '4f0864e2-40af-28a4-de2c-0e9e64e75f23', 'ce2783e8-44fc-dd48-3da3-33b5ba6c4a22']
export const CURRENT_ACT = { id: ACTS[0], name: 'ACT VI' }

export const TITLE = { lurker: '5c3e2030-4d8a-a242-04b1-ff872557ebfd', ace: '254021ec-426c-85de-3eba-faaeff17a5f5', clutch: '08ac32fb-450a-34b8-4aef-d88e50ebd3cb' }
export const CARD = Object.fromEntries(CARDS.map(c => [c.id, c]))
const cardIds = CARDS.map(c => c.id)

// ---- players ----
const pu = n => `5ae7d0c0-1d2e-4f3a-9b1c-${n.toString(16).padStart(12, '0')}`
const P = (n, gameName, tagLine, extra = {}) => ({ puuid: pu(n), gameName, tagLine, card: cardIds[n % cardIds.length], level: 40 + (n * 37) % 380, ...extra })

export const ME = P(1, 'Nova', 'EUW', { card: 'e9c8d760-4d06-4037-4882-6bab3610d9ea', level: 247, tier: 19, rr: 64, peak: 21 })
export const FRIENDS = [
  P(2, 'kairo', '777', { tier: 20 }), P(3, 'Lumen', 'ttv', { tier: 18 }), P(4, 'saltwater', '000', { tier: 16 }), P(5, 'Mirae', 'KR1', { tier: 21 }),
  P(6, 'Pixelfox', 'uwu', { tier: 14 }), P(7, 'driftwood', 'NA1', { tier: 17 }), P(8, 'Halcyon', '4242', { tier: 22 }), P(9, 'yuzu', 'mint', { tier: 12 }),
  P(10, 'Orbit', 'zz', { tier: 15 }), P(11, 'tempest', 'EU2', { tier: 19 }), P(12, 'Quill', 'ink', { tier: 13 }), P(13, 'Ember', 'lit', { tier: 18 }),
]
export const STRANGERS = [
  P(20, 'Vexa', '0419', { tier: 19 }), P(21, 'Tidecaller', 'EUW', { tier: 18 }), P(22, 'nightjar', '999', { tier: 20 }), P(23, 'Sorrel', '5150', { tier: 19 }),
  P(24, 'b0nfire', 'gg', { tier: 18 }), P(25, 'Marrow', '001', { tier: 20 }), P(26, 'Kestrel', 'EUNE', { tier: 17 }), P(27, 'glasswing', '7', { tier: 19 }),
  P(28, 'Rook', 'mid', { tier: 18 }), P(29, 'Cinder', 'ace', { tier: 20 }), P(30, 'Wren', 'zzz', { tier: 19 }), P(31, 'Juniper', 'EU1', { tier: 17 }),
  P(32, 'Atlas', '404', { tier: 18 }), P(33, 'mossy', 'frog', { tier: 19 }), P(34, 'Zephyr', 'air', { tier: 21 }), P(35, 'Fable', 'tale', { tier: 16 }),
]
// A streamer-mode (incognito) player: the app never knows or shows their name, level or card.
export const INCOGNITO = P(40, '', '', { tier: 20, incognito: true })
export const EVERYONE = [ME, ...FRIENDS, ...STRANGERS, INCOGNITO]
export const BY_PUUID = Object.fromEntries(EVERYONE.map(p => [p.puuid, p]))
const by = name => EVERYONE.find(p => p.gameName === name)
// Players the user has met in a live match or searched for, so match details may name them.
export const KNOWN = new Set([...FRIENDS, ...STRANGERS.slice(0, 6)].map(p => p.puuid))
export const FRIEND_SET = new Set(FRIENDS.map(p => p.puuid))
export const nameOf = p => p && !p.incognito ? { gameName: p.gameName, tagLine: p.tagLine } : null

// ---- scouting ----
// Full scout (live:scout): rank fields plus recent form, top agents and recent competitive matches.
export function scoutFor(key, tier = 18) {
  const r = rng('scout' + key)
  const maps = Object.values(MAP)
  const agents = [AGENT.jett, AGENT.raze, AGENT.reyna, AGENT.omen, AGENT.sova, AGENT.killjoy, AGENT.viper, AGENT.fade]
  const main = [pickOne(r, agents), pickOne(r, agents), pickOne(r, agents)]
  const matches = Array.from({ length: 10 }, (_, i) => {
    const win = r() < 0.55, us = win ? 13 : int(r, 5, 11), them = win ? int(r, 5, 11) : 13
    const n = us + them, kills = int(r, 9, 28), deaths = int(r, 10, 21), assists = int(r, 2, 11)
    return {
      start: NOW - (i + 1) * int(r, 5, 20) * HOUR, mapId: pickOne(r, maps).url, queue: 'competitive', agent: main[i % 3],
      result: win ? 'win' : 'loss', score: { us, them }, kills, deaths, assists,
      acs: int(r, 150, 320), adr: int(r, 100, 190), hs: int(r, 14, 36), kast: int(r, 58, 86), fb: int(r, 0, 5), rr: win ? int(r, 16, 24) : -int(r, 13, 20),
    }
  })
  const sum = f => matches.reduce((s, m) => s + f(m), 0)
  const kills = sum(m => m.kills), deaths = sum(m => m.deaths), assists = sum(m => m.assists)
  const agentsOut = [...new Set(matches.map(m => m.agent))].map(a => {
    const ms = matches.filter(m => m.agent === a)
    const k = ms.reduce((s, m) => s + m.kills, 0), d = ms.reduce((s, m) => s + m.deaths, 0)
    return { agent: a, games: ms.length, wins: ms.filter(m => m.result === 'win').length, kd: k / d, acs: round(ms.reduce((s, m) => s + m.acs, 0) / ms.length) }
  }).sort((a, b) => b.games - a.games)
  const peak = Math.min(27, tier + int(r, 0, 2))
  return {
    current: { tier, rr: int(r, 4, 96), seasonId: ACTS[0], wins: int(r, 12, 60), games: int(r, 25, 110) },
    peak: { tier: peak, seasonId: peak > tier ? ACTS[2] : ACTS[0] },
    history: ACTS.map((id, i) => ({ seasonId: id, tier: Math.max(3, tier - i + int(r, -1, 1)), rr: int(r, 0, 99), peak: Math.max(3, tier - i + 1), wins: int(r, 10, 50), games: int(r, 25, 90) })),
    recent: {
      matches: matches.length, wins: matches.filter(m => m.result === 'win').length, losses: matches.filter(m => m.result === 'loss').length,
      kd: kills / deaths, kda: (kills + assists) / deaths, acs: round(sum(m => m.acs) / 10), adr: round(sum(m => m.adr) / 10),
      hs: round(sum(m => m.hs) / 10), kast: round(sum(m => m.kast) / 10), fb: sum(m => m.fb),
    },
    agents: agentsOut, matches, historyPrivate: false,
  }
}
export const scoutSummary = s => ({ kd: s.recent.kd, acs: s.recent.acs, hs: s.recent.hs, wr: Math.round(s.recent.wins / s.recent.matches * 100) })

// ---- live match ----
function loadoutFor(key, hidden) {
  const r = rng('loadout' + key)
  const weapons = WEAPON_ORDER.filter(w => SKINS[w]).map(w => {
    const opts = SKINS[w], s = r() < 0.7 ? pickOne(r, opts) : opts[opts.length - 1]
    return { weapon: w, skin: s.skin, image: s.image, buddy: ['Vandal', 'Phantom', 'Operator', 'Sheriff'].includes(w) && r() < 0.7 ? pickOne(r, BUDDIES) : null }
  })
  const sprays = [pickOne(r, SPRAYS), pickOne(r, SPRAYS), pickOne(r, SPRAYS)].filter((s, i, a) => a.indexOf(s) === i)
  return { weapons, sprays, hidden }
}

const tok = n => (0x9e3779b97f4a7c15n * BigInt(n + 7)).toString(16).slice(-16).padStart(16, '0')
const LIVE_ROSTER = [
  // [player, agent, team, party]
  [ME, AGENT.jett, 'Blue', 0], [by('kairo'), AGENT.sova, 'Blue', 0], [by('Lumen'), AGENT.omen, 'Blue', null],
  [by('Vexa'), AGENT.killjoy, 'Blue', 1], [by('Tidecaller'), AGENT.breach, 'Blue', 1],
  [INCOGNITO, AGENT.reyna, 'Red', 2], [by('nightjar'), AGENT.raze, 'Red', 2], [by('Sorrel'), AGENT.viper, 'Red', 2],
  [by('b0nfire'), AGENT.fade, 'Red', null], [by('Marrow'), AGENT.cypher, 'Red', null],
]
export const LIVE_MATCH_ID = 'b7e1c0de-5a3f-4c2e-9d10-4e2f6a7b8c90'
export const LIVE = LIVE_ROSTER.map(([p, agent, team, party], i) => ({ p, agent, team, party, ref: tok(i), loadout: loadoutFor(i, p.incognito) }))
export const liveByRef = Object.fromEntries(LIVE.map(l => [l.ref, l]))
const scouted = {} // ref -> scout summary, like the backend keeps until the match changes

export function liveState() {
  const players = LIVE.map(({ p, agent, team, party, ref, loadout }) => {
    const isMe = p === ME, hidden = !!p.incognito
    const o = {
      ref, puuid: hidden ? null : p.puuid, self: isMe, hidden,
      gameName: hidden ? null : p.gameName, tagLine: hidden ? null : p.tagLine,
      agent: agentObj(agent), locked: true, team, enemy: team !== 'Blue',
      level: hidden ? null : p.level, card: hidden ? null : p.card,
      rank: p.tier, rr: rng('rr' + ref)() * 99 | 0, peak: Math.min(27, p.tier + 1),
      known: KNOWN.has(p.puuid), ranked: true, canScout: true,
      guns: loadout.weapons.filter(w => w.weapon === 'Vandal' || w.weapon === 'Phantom'),
      party: party,
      partySize: party == null ? null : LIVE_ROSTER.filter(r => r[3] === party).length,
    }
    if (isMe) o.rr = ME.rr
    if (scouted[ref] !== undefined) o.scouted = scouted[ref]
    if (p === by('kairo')) o.spectre = true
    return o
  })
  return {
    state: 'ingame', matchId: LIVE_MATCH_ID, queueId: 'competitive',
    map: { name: MAP.ascent.name, splash: mapSplash(MAP.ascent), listIcon: mapList(MAP.ascent) },
    server: 'frankfurt', players,
  }
}
export function liveScout(ref) {
  const l = liveByRef[ref]
  if (!l) throw new Error('That player is not in your current match')
  const s = scoutFor(ref, l.p.tier)
  scouted[ref] = scoutSummary(s)
  return s
}
export function liveLoadout(ref) {
  const l = liveByRef[ref]
  if (!l) throw new Error('That player is not in your current match')
  const card = l.p.incognito ? null : CARD[l.p.card] || CARDS[0]
  return {
    weapons: l.loadout.weapons, sprays: l.loadout.sprays,
    card: card ? { name: card.name, art: card.art } : null,
    title: l.p.incognito ? null : pickOne(rng('title' + ref), ['Lurker', 'Ace', 'Clutch', null]),
  }
}
// Pre-scout two players so the roster shows mini stats right away.
liveScout(LIVE[1].ref); liveScout(LIVE[6].ref)

// ---- match history ----
const MODE = { competitive: 'Competitive', unrated: 'Unrated', swiftplay: 'Swiftplay' }
const HIST_PLAN = [
  ['competitive', 'ascent', AGENT.jett, 'win'], ['competitive', 'bind', AGENT.jett, 'loss'], ['competitive', 'lotus', AGENT.neon, 'win'],
  ['unrated', 'haven', AGENT.jett, 'win'], ['competitive', 'sunset', AGENT.raze, 'win'], ['competitive', 'split', AGENT.jett, 'loss'],
  ['swiftplay', 'pearl', AGENT.reyna, 'win'], ['competitive', 'icebox', AGENT.jett, 'win'], ['competitive', 'abyss', AGENT.neon, 'loss'],
  ['competitive', 'ascent', AGENT.jett, 'draw'], ['unrated', 'corrode', AGENT.iso, 'loss'], ['competitive', 'haven', AGENT.jett, 'win'],
  ['competitive', 'bind', AGENT.raze, 'loss'], ['swiftplay', 'lotus', AGENT.jett, 'win'], ['competitive', 'sunset', AGENT.jett, 'win'],
]
const POOL = [AGENT.sova, AGENT.omen, AGENT.killjoy, AGENT.breach, AGENT.reyna, AGENT.raze, AGENT.viper, AGENT.fade, AGENT.cypher, AGENT.clove,
  AGENT.sage, AGENT.skye, AGENT.astra, AGENT.kayo, AGENT.chamber, AGENT.gekko, AGENT.harbor, AGENT.brimstone, AGENT.neon, AGENT.iso]

export const MATCHES = HIST_PLAN.map(([queue, mapKey, myAgent, result], i) => {
  const r = rng('match' + i)
  const id = `0d5c${i.toString(16).padStart(4, '0')}-7a1b-4c3d-8e9f-${(0xa0b1c2d3e4f5 + i * 7919).toString(16).slice(-12)}`
  const target = queue === 'swiftplay' ? 5 : 13
  let us, them
  if (result === 'draw') { us = 12; them = 12 } else if (result === 'win') { us = target; them = int(r, Math.floor(target * 0.3), target - 2) } else { them = target; us = int(r, Math.floor(target * 0.3), target - 2) }
  const rounds = us + them
  const start = NOW - (i * 9 + int(r, 2, 6)) * HOUR - int(r, 0, 50) * MIN
  // Teammates: a friend or two most games, the rest strangers. One incognito enemy now and then.
  const mates = [FRIENDS[i % 4], ...(i % 3 === 0 ? [FRIENDS[(i + 5) % 12]] : [])]
  const strangers = [...STRANGERS].sort(() => r() - 0.5)
  const allies = [...mates, ...strangers.slice(0, 4 - mates.length)]
  const enemies = strangers.slice(4 - mates.length, 9 - mates.length)
  if (i % 4 === 1) enemies[0] = INCOGNITO
  const agents = [...POOL].filter(a => a !== myAgent).sort(() => r() - 0.5)
  const party = `party-${i}`
  const mk = (p, team, agent, isMe) => {
    const kills = isMe ? int(r, 14, 29) : int(r, 6, 26)
    const deaths = int(r, 9, 20), assists = int(r, 2, 10)
    const score = Math.round((kills * 200 + assists * 50 + int(r, 0, 1500)) * rounds / 22)
    const head = int(r, 12, 40), body = int(r, 50, 110), leg = int(r, 2, 14)
    const dmg = rounds * int(r, 105, isMe ? 175 : 165)
    return {
      puuid: p.puuid, team, party: isMe || mates.includes(p) ? party : `solo-${p.puuid}`, agent, tier: p.tier, level: p.level, card: p.card,
      title: TITLE.lurker, stats: { kills, deaths, assists, score, roundsPlayed: rounds },
      _shots: { head, body, leg }, _dmg: dmg, _fb: int(r, 0, isMe ? 5 : 3), _fd: int(r, 0, 3),
    }
  }
  const players = [
    mk(ME, 'Blue', myAgent, true), ...allies.map((p, j) => mk(p, 'Blue', agents[j], false)),
    ...enemies.map((p, j) => mk(p, 'Red', agents[4 + j], false)),
  ]
  const roundList = []
  let a = 0, b = 0
  for (let n = 0; n < rounds; n++) {
    const blueWins = (a < us && (b >= them || r() < us / rounds))
    if (blueWins) a++; else b++
    const winner = blueWins ? 'Blue' : 'Red'
    const blueAttack = n < 12 ? true : n < 24 ? false : n % 2 === 0
    const role = (winner === 'Blue') === blueAttack ? 'Attacker' : 'Defender'
    const kind = role === 'Attacker' ? pickOne(r, ['elim', 'elim', 'detonate']) : pickOne(r, ['elim', 'elim', 'defuse', 'time'])
    roundList.push({ num: n, kind, winner, role, site: kind === 'elim' && r() < 0.5 ? '' : pickOne(r, ['A', 'B', ...(mapKey === 'haven' || mapKey === 'lotus' ? ['C'] : [])]) })
  }
  const teams = [
    { id: 'Blue', won: result === 'win', roundsWon: us, roundsPlayed: rounds },
    { id: 'Red', won: result === 'loss', roundsWon: them, roundsPlayed: rounds },
  ]
  return { id, mapId: MAP[mapKey].url, queue, start, length: (28 + rounds * 1.6 + int(r, 0, 6)) * MIN | 0, teams, players, rounds: roundList, result }
})
export const matchById = Object.fromEntries(MATCHES.map(m => [m.id, m]))

function playerStats(m, p) {
  const n = m.rounds.length || 1, st = p.stats, s = p._shots, shots = s.head + s.body + s.leg
  return {
    kills: st.kills, deaths: st.deaths, assists: st.assists, points: st.score, acs: Math.round(st.score / n),
    adr: Math.round(p._dmg / n), hs: Math.round(s.head / shots * 100), fb: p._fb, fd: p._fd,
  }
}

// history:summary for any player of a sample match (the user by default).
export function summary(matchId, puuid = ME.puuid) {
  const m = matchById[matchId]
  if (!m) throw new Error('Match not found')
  const me = m.players.find(p => p.puuid === puuid) || m.players[0]
  const mine = m.teams.find(t => t.id === me.team), other = m.teams.find(t => t.id !== me.team)
  let result = mine.won ? 'win' : 'loss'
  if (!m.teams.some(t => t.won)) result = 'draw'
  return {
    matchId: m.id, mapId: m.mapId, queue: m.queue, mode: MODE[m.queue] || m.queue, start: m.start, length: m.length,
    agent: me.agent, tier: me.tier, result, ffa: false, score: { us: mine.roundsWon, them: other.roundsWon }, ...playerStats(m, me),
  }
}

export function historyList(puuid, opts = {}) {
  const queue = opts.queue && opts.queue !== 'all' ? opts.queue : null
  const list = MATCHES.filter(m => !queue || m.queue === queue)
  const start = opts.start ?? 0, end = opts.end ?? 20
  return { puuid: puuid || ME.puuid, total: list.length, matches: list.slice(start, end).map(m => ({ matchId: m.id, start: m.start, queue: m.queue })) }
}

// Names only for the user and players they know (live-match roster or search), as the backend does.
export function detail(matchId) {
  const m = matchById[matchId]
  if (!m) throw new Error('Match not found')
  const myParty = m.players[0].party
  const players = m.players.map((p, i) => {
    const pl = BY_PUUID[p.puuid]
    const shown = p.puuid === ME.puuid || (KNOWN.has(p.puuid) && !pl.incognito)
    const base = {
      key: shown ? p.puuid : `x${i}`, team: p.team, agent: p.agent, tier: p.tier, known: KNOWN.has(p.puuid),
      name: shown ? nameOf(pl) : null, hidden: !shown, ...playerStats(m, p),
    }
    return shown ? { ...base, puuid: p.puuid, friend: FRIEND_SET.has(p.puuid), party: p.party === myParty, level: p.level, card: p.card } : base
  })
  return {
    matchId: m.id, mapId: m.mapId, queue: m.queue, mode: MODE[m.queue], start: m.start, length: m.length,
    teams: m.teams, players, rounds: m.rounds, namesLimited: true,
  }
}

// RR chain, newest first, ending at the user's current rank.
const COMP = MATCHES.filter(m => m.queue === 'competitive')
export const RR = (() => {
  const out = {}
  let tier = ME.tier, rr = ME.rr
  for (const m of COMP) {
    const r = rng('rr' + m.id)
    const earned = m.result === 'win' ? int(r, 17, 25) : m.result === 'loss' ? -int(r, 13, 20) : int(r, -2, 3)
    const after = rr, tierAfter = tier
    let before = rr - earned, tierBefore = tier
    if (before >= 100) { before -= 100; tierBefore++ }
    if (before < 0) { before += 100; tierBefore-- }
    out[m.id] = { earned, before, after, tierBefore, tierAfter, placement: false, map: m.mapId, start: m.start }
    tier = tierBefore; rr = before
  }
  return out
})()
export const rrMap = () => Object.fromEntries(Object.entries(RR).map(([id, v]) => [id, { earned: v.earned, before: v.before, after: v.after, tierBefore: v.tierBefore, tierAfter: v.tierAfter, placement: v.placement }]))
export function rrHistory(count = 20) {
  return COMP.slice(0, Math.min(count, 20)).map(m => {
    const v = RR[m.id]
    return {
      id: m.id, mapId: m.mapId, time: m.start, tierBefore: v.tierBefore, tierAfter: v.tierAfter,
      rrBefore: v.before, rrAfter: v.after, change: v.earned, ladder: v.tierAfter * 100 + v.after,
    }
  }).reverse()
}

// activity:recent: who you played with and against.
export function encounters(count = 20) {
  const people = {}
  const matches = MATCHES.slice(0, Math.min(count, 25)).map(m => {
    const sum = summary(m.id)
    const players = m.players.filter(p => p.puuid !== ME.puuid).map((p, i) => {
      const rel = p.team === 'Blue' ? 'mate' : 'opp'
      const base = { key: `${m.id}:${i}`, rel, agent: p.agent, tier: p.tier, kills: p.stats.kills, deaths: p.stats.deaths, assists: p.stats.assists }
      const pl = BY_PUUID[p.puuid]
      if (!KNOWN.has(p.puuid) || pl.incognito) return { ...base, known: false, name: null, hidden: true }
      const name = nameOf(pl)
      const e = people[p.puuid] ||= { puuid: p.puuid, friend: FRIEND_SET.has(p.puuid), name, hidden: false, with: 0, against: 0, lastSeen: m.start, agent: p.agent, tier: p.tier }
      e[rel === 'mate' ? 'with' : 'against']++
      return { ...base, puuid: p.puuid, friend: FRIEND_SET.has(p.puuid), known: true, name, hidden: false }
    })
    return { matchId: m.id, mapId: m.mapId, mode: sum.mode, queue: m.queue, start: m.start, result: sum.result, score: sum.score, agent: sum.agent, players }
  })
  return { matches, people }
}

// ---- social ----
const STATUS = [
  // [friend, state, extra]
  ['kairo', 'ingame', { queueId: 'competitive', map: 'Ascent', score: [7, 5], partySize: 2, partyId: 'party-live' }],
  ['Lumen', 'ingame', { queueId: 'competitive', map: 'Ascent', score: [7, 5] }],
  ['saltwater', 'menus', { queueId: 'unrated', partySize: 2 }],
  ['Mirae', 'queue', { queueId: 'competitive', partySize: 3 }],
  ['Pixelfox', 'away', { queueId: 'swiftplay' }],
  ['driftwood', 'pregame', { queueId: 'competitive', map: 'Lotus' }],
  ['Halcyon', 'offline', { lastOnline: NOW - 3 * HOUR }],
  ['yuzu', 'offline', { lastOnline: NOW - 2 * DAY }],
  ['Orbit', 'menus', { product: 'league_of_legends' }],
  ['tempest', 'offline', { lastOnline: NOW - 6 * DAY }],
  ['Quill', 'menus', { queueId: 'deathmatch' }],
  ['Ember', 'offline', { lastOnline: NOW - 26 * MIN }],
]
export function friendsList() {
  return STATUS.map(([name, state, x], i) => {
    const p = by(name), online = state !== 'offline', val = online && (x.product || 'valorant') === 'valorant'
    return {
      puuid: p.puuid, pid: `${p.puuid}@eu1.pvp.net`, gameName: p.gameName, tagLine: p.tagLine, online,
      product: online ? (x.product || 'valorant') : null, note: i === 0 ? 'duo main' : '', spectre: i < 2 || i === 4,
      lastOnline: x.lastOnline ?? NOW - (i + 1) * 7 * MIN,
      status: {
        state, queueId: val ? x.queueId || null : null, map: x.map || null, score: state === 'ingame' ? x.score : null,
        partySize: x.partySize || 1, maxPartySize: 5, rank: val ? p.tier : 0, level: val ? p.level : null,
        partyId: val ? x.partyId || `party-f${i}` : null, card: val ? p.card : null,
      },
    }
  })
}
export const party = () => ({
  id: 'party-live', state: 'DEFAULT', open: false, iOwn: true, queueId: 'competitive',
  queues: ['competitive', 'unrated', 'swiftplay', 'spikerush', 'deathmatch', 'ggteam', 'hurm', 'premier'], inviteCode: null,
  members: [ME, by('kairo')].map((p, i) => ({
    puuid: p.puuid, self: i === 0, owner: i === 0, ready: true, hidden: false, gameName: p.gameName, tagLine: p.tagLine,
    card: p.card, level: p.level, rank: p.tier,
  })),
})
export const requests = () => ({
  incoming: [{ puuid: by('Fable').puuid, gameName: 'Fable', tagLine: 'tale', direction: 'in' }],
  outgoing: [{ puuid: by('Atlas').puuid, gameName: 'Atlas', tagLine: '404', direction: 'out' }],
})

const cid = p => `${p.puuid}@eu1.pvp.net`
const msg = (p, body, ago, fromMe, n) => ({
  id: `m-${p.gameName}-${n}`, cid: cid(p), body, time: NOW - ago,
  puuid: fromMe ? ME.puuid : p.puuid, gameName: fromMe ? ME.gameName : p.gameName, tagLine: fromMe ? ME.tagLine : p.tagLine, fromMe,
})
export const CHATS = {
  [cid(by('kairo'))]: [
    ['queue after this one?', 52, false], ['ya one more', 50, true], ['bring the sova lineups for ascent b', 49, false],
    ['already practiced them lol', 47, true], ['gg that last round was insane', 3, false],
  ],
  [cid(by('Lumen'))]: [['are you streaming tonight', 180, true], ['maybe later, need to warm up', 175, false], ['ok ping me', 174, true]],
  [cid(by('Mirae'))]: [['5 stack tomorrow at 8?', 26 * 60, false], ['im in', 25 * 60, true]],
}
export const messagesFor = c => (CHATS[c] || []).map(([body, mins, fromMe], n) => msg(BY_PUUID[c.split('@')[0]], body, mins * MIN, fromMe, n))
export const conversations = () => Object.keys(CHATS).map((c, i) => {
  const list = messagesFor(c)
  return { cid: c, puuid: c.split('@')[0], unread: i === 0 ? 1 : 0, muted: false, last: list[list.length - 1] }
}).sort((a, b) => b.last.time - a.last.time)

// ---- leaderboard ----
const SYL = ['ka', 'ri', 'no', 'vel', 'zen', 'mi', 'ra', 'tox', 'lu', 'sha', 'ko', 'vy', 'ren', 'dai', 'xo', 'fen', 'yu', 'tor', 'ae', 'quin']
export function leaderboard({ start = 0, size = 100 } = {}) {
  const players = Array.from({ length: Math.min(size, 200) }, (_, i) => {
    const n = start + i, r = rng('lb' + n), anon = r() < 0.12
    const name = pickOne(r, SYL) + pickOne(r, SYL) + (r() < 0.4 ? pickOne(r, SYL) : '')
    return {
      ...(anon ? {} : { puuid: pu(1000 + n) }), known: false, friend: false, rank: n + 1, cardId: pickOne(r, cardIds), anonymous: anon,
      gameName: anon ? '' : name[0].toUpperCase() + name.slice(1), tagLine: anon ? '' : String(int(r, 1, 9999)),
      prefix: !anon && r() < 0.15 ? pickOne(r, ['NOVA', 'FLX', 'KOI', 'TSK']) : '',
      rr: Math.max(0, 1180 - n * 4 - int(r, 0, 3)), wins: int(r, 90, 260), tier: n < 500 ? 27 : 26, banned: false,
    }
  })
  return { season: CURRENT_ACT, total: 21874, start, players, you: null, shard: 'eu' }
}
export const lookupName = text => EVERYONE.find(p => !p.incognito && `${p.gameName}#${p.tagLine}`.toLowerCase() === text.toLowerCase())
export function profile(puuid) {
  const p = BY_PUUID[puuid] || { puuid, gameName: null, tagLine: null, tier: 15, level: 120, card: cardIds[0] }
  const self = puuid === ME.puuid
  return {
    puuid, gameName: p.gameName || null, tagLine: p.tagLine || null, level: p.level, cardId: p.card, titleId: TITLE.clutch,
    current: { tier: p.tier, rr: self ? ME.rr : rng('prof' + puuid)() * 99 | 0, seasonId: ACTS[0], wins: 34, games: 61, lastGame: NOW - 2 * HOUR },
    peak: { tier: Math.min(27, p.tier + (self ? 2 : 1)), seasonId: ACTS[2] }, leaderboardRank: null, notes: [], ...(self ? { self: true } : {}),
  }
}
export function searchScout(puuid) {
  const p = BY_PUUID[puuid] || { tier: 15 }
  const s = scoutFor('search' + puuid, p.tier)
  const kills = s.matches.reduce((a, m) => a + m.kills, 0), deaths = s.matches.reduce((a, m) => a + m.deaths, 0)
  return {
    acts: s.history.map(h => ({ seasonId: h.seasonId, tier: h.tier, peak: h.peak, wins: h.wins, games: h.games })),
    recent: { matches: 10, kills, deaths, kd: kills / deaths, hs: s.recent.hs, wins: s.recent.wins, team: 10 }, historyPrivate: false,
  }
}

// ---- notes, playbooks, friend log ----
export const MEMOS = [
  { puuid: by('kairo').puuid, name: 'kairo#777', tags: ['duo', 'igl'], rating: 1, text: 'Great comms. Sova lineups on Ascent B are clean.', updatedAt: NOW - 2 * DAY },
  { puuid: by('nightjar').puuid, name: 'nightjar#999', tags: ['aggressive', 'op'], rating: 0, text: 'Peeks mid with the Operator every pistol round.', updatedAt: NOW - 5 * HOUR },
  { puuid: by('Vexa').puuid, name: 'Vexa#0419', tags: ['chill'], rating: 1, text: 'Solid Killjoy, plays B anchor. Would queue again.', updatedAt: NOW - 3 * DAY },
]
const sec = (id, name, color, icon, notes, crosshairs = [], links = [], snippets = [], ago = DAY) => ({ id, name, color, icon, notes, crosshairs, links, snippets, updatedAt: NOW - ago })
export const NOTEBOOK = {
  sections: [
    sec('general', 'General', 'accent', 'note', 'Warm up: 10 min deathmatch, then 5 min range on hard bots.\nKeep crosshair at head height and clear angles one at a time.',
      [{ id: 'c1', name: 'Main', code: '0;P;c;5;h;0;f;0;0l;4;0o;2;0a;1;0f;0;1b;0' }, { id: 'c2', name: 'Op', code: '0;P;c;1;o;1;d;1;z;3;0b;0;1b;0' }],
      [{ id: 'l1', title: 'Lineups doc', url: 'https://example.com/lineups' }],
      [{ id: 's1', text: 'one more and then sleep' }, { id: 's2', text: 'nice try, next round' }], 2 * HOUR),
    sec('ascent', 'Ascent', 'blue', 'map', 'Attack: default A main + mid control. Save the Sova dart for B main.\nDefense: one on market, rotate early.', [], [], [], DAY),
    sec('aim', 'Aim routine', 'green', 'target', 'Mon / Wed / Fri: tracking. Tue / Thu: flicks. Weekend: just play.', [], [], [], 3 * DAY),
  ],
}
const tokenItem = (id, agent, x, y, team) => ({ id, type: 'agent', x, y, team, name: AGENT_INFO[agent][0], agentId: agent, icon: `https://media.valorant-api.com/agents/${agent}/displayicon.png` })
export const PLAYBOOKS = [{
  id: 'pb-scrims', name: 'Scrim set', createdAt: NOW - 9 * DAY,
  strategies: [
    {
      id: 'st-ascent-a', name: 'A split', mapId: MAP.ascent.uuid, side: 'attack', notes: 'Smoke heaven + tree, Sova dart from A main.', updatedAt: NOW - DAY,
      steps: [
        { id: 'sp1', name: 'Setup', items: [tokenItem('t1', AGENT.jett, 300, 720, 'ally'), tokenItem('t2', AGENT.sova, 360, 760, 'ally'), tokenItem('t3', AGENT.omen, 520, 640, 'ally'), { id: 'a1', type: 'arrow', x1: 300, y1: 700, x2: 260, y2: 420, color: '#ff4655', width: 6 }] },
        { id: 'sp2', name: 'Execute', items: [tokenItem('t1', AGENT.jett, 250, 380, 'ally'), tokenItem('t2', AGENT.sova, 330, 520, 'ally'), { id: 'x1', type: 'text', x: 200, y: 300, text: 'Plant default', color: '#ffffff', size: 24 }] },
      ],
    },
    { id: 'st-bind-b', name: 'B long fake', mapId: MAP.bind.uuid, side: 'attack', notes: '', updatedAt: NOW - 4 * DAY, steps: [{ id: 'sp3', name: 'Setup', items: [] }] },
  ],
}]
export const FRIENDLOG = {
  events: [
    { id: `${NOW - 3 * HOUR}-0`, type: 'added', puuid: by('Ember').puuid, name: 'Ember#lit', at: NOW - 3 * HOUR },
    { id: `${NOW - 2 * DAY}-0`, type: 'renamed', puuid: by('saltwater').puuid, name: 'saltwater#000', from: 'seafoam#000', at: NOW - 2 * DAY },
    { id: `${NOW - 4 * DAY}-0`, type: 'removed', puuid: pu(90), name: 'Glimmer#void', at: NOW - 4 * DAY },
    { id: `${NOW - 6 * DAY}-0`, type: 'added', puuid: by('Quill').puuid, name: 'Quill#ink', at: NOW - 6 * DAY },
  ],
  lastScan: NOW - 90e3, tracking: true, friends: FRIENDS.length,
}

// ---- misc ----
const splash = k => mapSplash(MAP[k])
export const PATCH_NOTES = [
  ['VALORANT Patch Notes 11.10', 0.6, 'abyss', 'Agent updates, a new map rotation and quality-of-life fixes.'],
  ['VALORANT Patch Notes 11.09', 14, 'corrode', 'Competitive tweaks and bug fixes across the board.'],
  ['VALORANT Patch Notes 11.08', 28, 'sunset', 'Weapon balance pass and performance improvements.'],
  ['VALORANT Patch Notes 11.07', 42, 'lotus', 'Map changes, agent tuning and social updates.'],
  ['VALORANT Patch Notes 11.06', 56, 'pearl', 'Premier updates and gameplay system fixes.'],
  ['VALORANT Patch Notes 11.05', 70, 'haven', 'Smaller patch focused on stability.'],
].map(([title, days, map, description]) => ({ title, date: new Date(NOW - days * DAY).toISOString(), image: splash(map), description, url: 'https://playvalorant.com/en-us/news/tags/patch-notes/' }))

export const RELEASES = [
  ['2.4.0', 3, '## What\'s new\n- Rust backend: faster start and lower memory use\n- Live match loadouts\n- Friend activity log'],
  ['2.3.2', 24, '## Fixes\n- Overlay hotkeys after sleep\n- Leaderboard paging'],
  ['2.3.0', 41, '## What\'s new\n- Strategy boards with PNG export\n- Notebook sections'],
].map(([v, days, notes]) => ({
  version: v, name: `Spectre v${v}`, date: new Date(NOW - days * DAY).toISOString(), notes, url: `https://github.com/booomxd/spectre/releases/tag/v${v}`,
  installer: { name: `Spectre_${v}_x64-setup.exe`, url: `https://github.com/booomxd/spectre/releases/download/v${v}/Spectre_${v}_x64-setup.exe`, size: 9_400_000, digest: null },
}))

// Discord preview scenarios, already formatted like the backend's format() with default settings.
export function discordPreview(name = 'live') {
  const rank = { large_image: 'https://media.valorant-api.com/competitivetiers/03621f52-342b-cf4e-4f86-9350a49c6d04/19/largeicon.png', large_text: 'Diamond 2' }
  const map = (m) => ({ large_image: mapList(MAP[m]), large_text: MAP[m].name, small_image: rank.large_image, small_text: rank.large_text })
  const state = 'Diamond 2 (64 RR) · 2/5'
  const A = {
    live: { details: 'Competitive (7 – 5) · Ascent', state, timestamps: { start: NOW - 24 * MIN }, assets: map('ascent') },
    competitive: { details: 'Competitive (9 – 5) · Ascent', state: 'Immortal 1 (142 RR) · 3/5', timestamps: { start: NOW - 767e3 }, assets: map('ascent') },
    deathmatch: { details: 'Deathmatch · Abyss', state: 'Immortal 1 (142 RR) · Solo', timestamps: { start: NOW - 767e3 }, assets: map('abyss') },
    teamdm: { details: 'Team Deathmatch (64 – 51) · Piazza', state: 'Immortal 1 (142 RR) · 3/5', timestamps: { start: NOW - 767e3 }, assets: rank },
    pregame: { details: 'Agent select · Competitive', state: 'Immortal 1 (142 RR) · 3/5', timestamps: { start: NOW - 42e3 }, assets: rank },
    lobby: { details: 'Lobby · Competitive', state: 'Immortal 1 (142 RR) · 3/5', timestamps: { start: NOW - 180e3 }, assets: rank },
    queue: { details: 'In queue · Competitive', state: 'Immortal 1 (142 RR) · 3/5', timestamps: { start: NOW - 64e3 }, assets: rank },
  }
  return { activity: A[name] ?? null }
}

// Your own presence as tools:state reads it (decoded private JSON).
export const PRESENCE = {
  isValid: true, sessionLoopState: 'INGAME', partyOwnerSessionLoopState: 'INGAME', isIdle: false,
  partyOwnerMatchScoreAllyTeam: 7, partyOwnerMatchScoreEnemyTeam: 5,
  playerPresenceData: { playerCardId: ME.card, playerTitleId: TITLE.lurker, preferredLevelBorderId: '', accountLevel: ME.level, competitiveTier: ME.tier, leaderboardPosition: 0 },
  matchPresenceData: { sessionLoopState: 'INGAME', provisioningFlow: 'Matchmaking', matchMap: MAP.ascent.url, queueId: 'competitive' },
  partyPresenceData: { partyId: 'party-live', isPartyOwner: true, partyState: 'DEFAULT', partyAccessibility: 'CLOSED', partySize: 2, maxPartySize: 5, queueEntryTime: '0001.01.01-00.00.00' },
  premierPresenceData: { rosterId: '', rosterName: '', rosterTag: '', division: 0, score: 0, showAura: false, showTag: false, showPlating: false },
}
