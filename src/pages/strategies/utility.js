// Utility drawn to scale. Sizes are in metres and approximate; the board converts them with the map's
// own game-units-to-minimap multiplier, so a smoke covers the same share of every map as it does in game.
// circle: { r }   beam: { len, w, center? } (aimed with the rotate handle; center = grows both ways from the token)
const K = {
  smoke: '#cfd6e4', fire: '#ff7a3d', slow: '#7cc8ff', reveal: '#ffd24d', heal: '#6ef0a0', wall: '#7be0ff',
  blind: '#f4f4f4', stun: '#c08bff', zone: '#ff4655', toxin: '#61e07a',
}
const c = (r, kind) => ({ shape: 'circle', r, kind })
const b = (len, w, kind, center = false) => ({ shape: 'beam', len, w, kind, center })

const TABLE = {
  // smokes
  'cloudburst': c(3, 'smoke'), 'dark cover': c(4.1, 'smoke'), 'sky smoke': c(4.2, 'smoke'), 'poison cloud': c(4.5, 'toxin'),
  'nebula / dissipate': c(4.75, 'smoke'), 'nebula': c(4.75, 'smoke'), 'cyber cage': c(3.6, 'smoke'), 'cove': c(4.5, 'smoke'), 'ruse': c(4.1, 'smoke'),
  // area denial / damage
  'incendiary': c(4.5, 'fire'), 'hot hands': c(4.5, 'fire'), 'snake bite': c(4.5, 'toxin'), 'nanoswarm': c(4.5, 'fire'),
  'paint shells': c(7, 'fire'), 'mosh pit': c(6.5, 'fire'), 'orbital strike': c(9, 'zone'), "viper's pit": c(18, 'toxin'),
  'aftershock': c(3, 'fire'), 'meddle': c(4.5, 'stun'), 'molten': c(4.5, 'fire'), 'razorvine': c(5, 'fire'),
  'frag/ment': c(4, 'fire'), 'guided salvo': c(4.5, 'fire'),
  // slows, stuns, holds
  'slow orb': c(7, 'slow'), 'gravity well': c(4.75, 'stun'), 'nova pulse': c(4.75, 'stun'), 'gravnet': c(5.5, 'stun'),
  'seize': c(6.5, 'stun'), 'shock bolt': c(4, 'fire'), 'relay bolt': c(6, 'stun'), 'lockdown': c(32.5, 'stun'),
  'zero/point': c(15, 'stun'), 'null/cmd': c(42.5, 'stun'), 'steel garden': c(30, 'stun'),
  // info
  'recon bolt': c(30, 'reveal'), 'haunt': c(30, 'reveal'), 'sonic sensor': c(7, 'reveal'), 'alarmbot': c(5.5, 'reveal'),
  'trademark': c(13, 'reveal'), 'stim beacon': c(6, 'heal'), 'regrowth': c(18, 'heal'), 'healing orb': c(3, 'heal'),
  // walls and lines
  'toxic screen': b(60, 1.4, 'toxin'), 'blaze': b(20, 1.4, 'fire'), 'barrier orb': b(12, 1.6, 'wall', true),
  'high tide': b(50, 1.4, 'wall'), 'fast lane': b(40, 4.5, 'slow'), 'cascade': b(12, 6, 'wall'),
  'trapwire': b(10, 0.6, 'reveal', true), 'shear': b(8, 1.4, 'wall', true), 'contingency': b(12, 4, 'wall'),
  'cosmic divide': b(120, 1.4, 'wall', true), 'barrier mesh': b(12, 1.6, 'wall', true),
  // lines of effect
  'fault line': b(55, 9, 'stun'), 'rolling thunder': b(32, 30, 'stun'), 'paranoia': b(40, 7, 'blind'),
  'nightfall': b(40, 24, 'blind'), "hunter's fury": b(60, 3, 'zone'), 'reckoning': b(30, 20, 'stun'),
  'undercut': b(30, 3, 'stun'), 'annihilation': b(40, 3, 'zone'), 'armageddon': b(50, 16, 'fire'),
  'flashpoint': b(14, 8, 'blind'), 'flash/drive': b(14, 8, 'blind'), 'curveball': b(14, 8, 'blind'),
}

export const KIND_COLOR = K

// Looks an ability token up by its name ("Viper: Toxic Screen").
export function utilOf(it) {
  if (it?.type !== 'ability') return null
  const n = (it.name || '').split(': ').pop().toLowerCase()
  return TABLE[n] || null
}

// Board units per metre. valorant-api multipliers map game units (cm) to 0..1 minimap space.
export const ppmOf = (map) => (map?.xMultiplier ? Math.abs(map.xMultiplier) * 1e5 : 7)

// Geometry in board units: { circle: r } or { beam: x1,y1,x2,y2,w }.
export function utilGeom(it, ppm) {
  const u = utilOf(it); if (!u) return null
  if (u.shape === 'circle') return { ...u, r: u.r * ppm }
  const a = it.rot ?? -Math.PI / 2, len = u.len * ppm, dx = Math.cos(a), dy = Math.sin(a)
  const s = u.center ? len / 2 : 0
  return { ...u, w: Math.max(u.w * ppm, 3), x1: it.x - dx * s, y1: it.y - dy * s, x2: it.x + dx * (len - s), y2: it.y + dy * (len - s) }
}
