// React-style inline style objects for Solid: camelCase keys become kebab-case, and bare numbers get px where CSS needs a unit
const UNITLESS = new Set(['opacity', 'z-index', 'font-weight', 'line-height', 'flex', 'flex-grow', 'flex-shrink', 'order', 'zoom', 'scale', 'fill-opacity', 'stroke-opacity', 'stop-opacity', 'flood-opacity', 'grid-row', 'grid-column', 'grid-row-start', 'grid-row-end', 'grid-column-start', 'grid-column-end', 'aspect-ratio', 'animation-iteration-count', 'tab-size', 'orphans', 'widows', 'column-count'])
const cache = new Map()
const key = k => {
  if (k.startsWith('--')) return k
  let v = cache.get(k)
  if (!v) { v = k.replace(/^(Webkit|Moz|ms)(?=[A-Z])/, m => '-' + m.toLowerCase()).replace(/[A-Z]/g, m => '-' + m.toLowerCase()); cache.set(k, v) }
  return v
}
export function st(o) {
  if (!o || typeof o !== 'object') return o
  const out = {}
  for (const k in o) {
    const v = o[k]
    if (v == null || v === false) continue
    const kk = key(k)
    out[kk] = typeof v === 'number' && !kk.startsWith('--') && !UNITLESS.has(kk) ? v + 'px' : v
  }
  return out
}
