// Data model + geometry helpers + PNG rasterizer for the strategy board.
// Board space is a 1000x1000 square (the map minimap); items store board coordinates.
import { invoke } from '../../lib/ipc'
import { KIND_COLOR, ppmOf, utilGeom } from './utility'
// PNG export text uses the app's font stack.
const FONT = '"SF Pro Text", "SF Pro Display", "SF Pro", -apple-system, BlinkMacSystemFont, Inter, "Segoe UI Variable Text", "Segoe UI", system-ui, sans-serif'

export const SIZE = 1000
export const GRID = 10
export const TOKEN_R = 28
export const COLORS = ['#ffffff', '#ff4655', '#f5a524', '#ffe14d', '#3ddc97', '#4cc9f0', '#7b5cff', '#ff7ab6']
export const WIDTHS = [3, 6, 10]

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4)
export const newStep = (name) => ({ id: uid(), name, items: [] })
export const newStrategy = (mapId, name = 'New strategy') => ({ id: uid(), name, mapId, side: 'attack', notes: '', steps: [newStep('Setup')], updatedAt: Date.now() })
export const newPlaybook = (name) => ({ id: uid(), name, createdAt: Date.now(), strategies: [] })

export const isToken = (it) => it.type === 'agent' || it.type === 'ability'
export const snapVal = (v) => Math.round(v / GRID) * GRID
export const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
export const ease = (t) => t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

// Ring colors: your team vs the enemy depend on which side you plan for.
export const teamColor = (team, side) => (team === 'enemy') === (side === 'attack') ? '#4cc9f0' : '#ff4655'

export function arrowHead(x1, y1, x2, y2, w) {
  const a = Math.atan2(y2 - y1, x2 - x1), len = 14 + w * 2.2, spread = 0.45
  const p = (ang) => [x2 - len * Math.cos(a + ang), y2 - len * Math.sin(a + ang)]
  const [ax, ay] = p(spread), [bx, by] = p(-spread)
  return [[x2, y2], [ax, ay], [bx, by]]
}

// Smooth freehand path through midpoints of the sampled points.
export function penPath(pts) {
  if (!pts.length) return ''
  if (pts.length === 1) return `M${pts[0][0]} ${pts[0][1]}l0.01 0`
  let d = `M${pts[0][0]} ${pts[0][1]}`
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i][0] + pts[i + 1][0]) / 2, my = (pts[i][1] + pts[i + 1][1]) / 2
    d += `Q${pts[i][0]} ${pts[i][1]} ${mx} ${my}`
  }
  const l = pts[pts.length - 1]
  return d + `L${l[0]} ${l[1]}`
}

export function moveItem(it, dx, dy, snap) {
  if (it.type === 'pen') return { ...it, points: it.points.map(([x, y]) => [x + dx, y + dy]) }
  if (it.type === 'line' || it.type === 'arrow') return { ...it, x1: it.x1 + dx, y1: it.y1 + dy, x2: it.x2 + dx, y2: it.y2 + dy }
  let x = it.x + dx, y = it.y + dy
  if (snap && (isToken(it) || it.type === 'text')) { x = snapVal(x); y = snapVal(y) }
  return { ...it, x, y }
}

export function bbox(it) {
  if (it.type === 'pen') {
    const xs = it.points.map(p => p[0]), ys = it.points.map(p => p[1])
    return [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)]
  }
  if (it.type === 'line' || it.type === 'arrow') return [Math.min(it.x1, it.x2), Math.min(it.y1, it.y2), Math.max(it.x1, it.x2), Math.max(it.y1, it.y2)]
  if (it.type === 'rect') return [it.x, it.y, it.x + it.w, it.y + it.h]
  if (it.type === 'text') { const w = (it.text || '').length * (it.size || 28) * 0.56; return [it.x, it.y - (it.size || 28), it.x + w, it.y + 6] }
  return [it.x - TOKEN_R, it.y - TOKEN_R, it.x + TOKEN_R, it.y + TOKEN_R]
}

// Interpolates between two steps for the play animation. Tokens present in both slide; everything else fades.
export function blend(from, to, t) {
  const fm = new Map(from.map(i => [i.id, i]))
  const tm = new Set(to.map(i => i.id))
  const out = []
  for (const it of to) {
    const f = fm.get(it.id)
    if (f && isToken(it) && isToken(f)) out.push({ ...it, x: f.x + (it.x - f.x) * t, y: f.y + (it.y - f.y) * t })
    else out.push(f ? it : { ...it, _op: t })
  }
  for (const it of from) if (!tm.has(it.id)) out.push({ ...it, _op: 1 - t })
  return out
}

function loadImg(src) {
  return new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src })
}

// Rasterizes one step to a PNG data URL (mirrors the SVG rendering in Board.jsx).
export async function renderPng({ map, strat, step }) {
  const S = 1600, k = S / SIZE
  const urls = [map?.displayIcon, ...step.items.map(i => i.icon)].filter(Boolean)
  const data = await invoke('playbooks:imageData', urls).catch(() => ({}))
  const imgs = {}
  await Promise.all([...new Set(urls)].map(async u => { imgs[u] = data[u] ? await loadImg(data[u]) : null }))

  const c = document.createElement('canvas')
  c.width = S; c.height = S
  const g = c.getContext('2d')
  g.scale(k, k)
  g.fillStyle = '#0b0b0f'; g.fillRect(0, 0, SIZE, SIZE)
  if (imgs[map?.displayIcon]) g.drawImage(imgs[map.displayIcon], 0, 0, SIZE, SIZE)
  g.lineCap = 'round'; g.lineJoin = 'round'

  for (const it of step.items) {
    g.save()
    g.strokeStyle = g.fillStyle = it.color || '#fff'
    g.lineWidth = it.width || 4
    if (it.type === 'pen') {
      g.beginPath()
      const p = it.points
      g.moveTo(p[0][0], p[0][1])
      if (p.length === 1) g.lineTo(p[0][0] + 0.01, p[0][1])
      for (let i = 1; i < p.length - 1; i++) g.quadraticCurveTo(p[i][0], p[i][1], (p[i][0] + p[i + 1][0]) / 2, (p[i][1] + p[i + 1][1]) / 2)
      if (p.length > 1) g.lineTo(p[p.length - 1][0], p[p.length - 1][1])
      g.stroke()
    } else if (it.type === 'line' || it.type === 'arrow') {
      g.beginPath(); g.moveTo(it.x1, it.y1); g.lineTo(it.x2, it.y2); g.stroke()
      if (it.type === 'arrow') {
        const h = arrowHead(it.x1, it.y1, it.x2, it.y2, it.width || 4)
        g.beginPath(); g.moveTo(h[0][0], h[0][1]); g.lineTo(h[1][0], h[1][1]); g.lineTo(h[2][0], h[2][1]); g.closePath(); g.fill()
      }
    } else if (it.type === 'rect') {
      g.globalAlpha = 0.18; g.fillRect(it.x, it.y, it.w, it.h); g.globalAlpha = 1
      g.strokeRect(it.x, it.y, it.w, it.h)
    } else if (it.type === 'text') {
      g.font = `700 ${it.size || 28}px ${FONT}`
      g.lineWidth = 6; g.strokeStyle = 'rgba(0,0,0,.85)'; g.strokeText(it.text, it.x, it.y)
      g.fillText(it.text, it.x, it.y)
    } else if (isToken(it)) {
      const u = utilGeom(it, ppmOf(map)), col = u && KIND_COLOR[u.kind]
      if (u?.shape === 'circle') {
        g.beginPath(); g.arc(it.x, it.y, u.r, 0, Math.PI * 2)
        g.globalAlpha = u.kind === 'smoke' ? 0.42 : u.kind === 'reveal' ? 0.08 : 0.24; g.fillStyle = col; g.fill()
        g.globalAlpha = 0.85; g.strokeStyle = col; g.lineWidth = 2; if (u.kind === 'reveal') g.setLineDash([8, 6]); g.stroke(); g.setLineDash([]); g.globalAlpha = 1
      } else if (u?.shape === 'beam') {
        g.globalAlpha = u.w > 12 ? 0.26 : 0.8; g.strokeStyle = col; g.lineWidth = u.w; g.lineCap = u.w > 12 ? 'butt' : 'round'
        g.beginPath(); g.moveTo(u.x1, u.y1); g.lineTo(u.x2, u.y2); g.stroke(); g.globalAlpha = 1; g.lineCap = 'round'
      }
      const ring = it.type === 'agent' ? teamColor(it.team, strat.side) : col || 'rgba(255,255,255,.55)'
      const r = it.type === 'agent' ? TOKEN_R : u ? 12 : 24
      g.beginPath(); g.arc(it.x, it.y, r, 0, Math.PI * 2); g.fillStyle = '#111'; g.fill()
      const im = imgs[it.icon]
      if (im) {
        g.save(); g.beginPath(); g.arc(it.x, it.y, r - 4, 0, Math.PI * 2); g.clip()
        g.drawImage(im, it.x - (r - 4), it.y - (r - 4), (r - 4) * 2, (r - 4) * 2); g.restore()
      }
      g.beginPath(); g.arc(it.x, it.y, r, 0, Math.PI * 2); g.lineWidth = 4; g.strokeStyle = ring; g.stroke()
    }
    g.restore()
  }

  // caption
  g.fillStyle = 'rgba(11,11,15,.82)'; g.fillRect(0, SIZE - 46, SIZE, 46)
  g.fillStyle = '#fff'; g.font = `700 22px ${FONT}`; g.textBaseline = 'middle'
  g.fillText(`${strat.name}  /  ${step.name}`, 20, SIZE - 23)
  g.textAlign = 'right'; g.fillStyle = '#ff4655'
  g.fillText(`${(map?.displayName || '').toUpperCase()}  ${strat.side.toUpperCase()}`, SIZE - 20, SIZE - 23)
  return c.toDataURL('image/png')
}
