// App themes. The id is applied as <html data-theme>; tokens live in index.css.
// `swatch` is the accent, `glow` the second backdrop color, used by the theme picker.
export const THEMES = [
  { id: 'midnight', name: 'Midnight', swatch: '#ff4655', glow: '#ff8c78' },
  { id: 'onyx', name: 'Onyx', swatch: '#ebebf0', glow: '#a0a0aa' },
  { id: 'ember', name: 'Ember', swatch: '#ff8030', glow: '#ffbe5a' },
  { id: 'glacier', name: 'Glacier', swatch: '#56c8ff', glow: '#a0e6ff' },
  { id: 'verdant', name: 'Verdant', swatch: '#3edc8c', glow: '#a0f0be' },
  { id: 'amethyst', name: 'Amethyst', swatch: '#b078ff', glow: '#e6a0ff' },
  { id: 'gilded', name: 'Gilded', swatch: '#e8be5a', glow: '#ffe196' },
  { id: 'aurora', name: 'Aurora', swatch: '#2dd4bf', glow: '#a78bfa' },
  { id: 'sakura', name: 'Sakura', swatch: '#ff79b0', glow: '#ffbed7' },
  { id: 'abyss', name: 'Abyss', swatch: '#5c84ff', glow: '#78dcff' },
  { id: 'sunset', name: 'Sunset', swatch: '#ff5e8c', glow: '#ffb05c' },
  { id: 'pearl', name: 'Pearl', swatch: '#635bff', glow: '#d65cff', light: true },
  // Aesthetic themes
  { id: 'aero', name: 'Frutiger Aero', swatch: '#1ea0e6', glow: '#8be36a', light: true },
  { id: 'vaporwave', name: 'Vaporwave', swatch: '#ff71ce', glow: '#01cdfe' },
  { id: 'y2k', name: 'Y2K Chrome', swatch: '#78e6ff', glow: '#d68cff' },
  { id: 'lofi', name: 'Lo-fi', swatch: '#ffaa78', glow: '#c8a0ff' },
  { id: 'jamun', name: 'Minty Jamun', swatch: '#a860ff', glow: '#6ef0be' },
  { id: 'musashi', name: 'Musashi', swatch: '#c82424', glow: '#eceae2' },
]

const KEY = 'spectre.theme'
export function getTheme() {
  try {
    const id = localStorage.getItem(KEY)
    return THEMES.some(t => t.id === id) ? id : 'midnight'
  } catch (e) { return 'midnight' }
}
export function setTheme(id) {
  document.documentElement.dataset.theme = id
  try { localStorage.setItem(KEY, id) } catch (e) { }
}

// Reduce motion (Settings > Appearance). Stored per device like the theme. The OS setting
// (prefers-reduced-motion) is honored on top of this; see MotionProvider in src/ui/motion.jsx.
const MOTION_KEY = 'spectre.reduceMotion'
const MOTION_EVENT = 'spectre:reduce-motion'
export function getReduceMotion() {
  try { return localStorage.getItem(MOTION_KEY) === '1' } catch (e) { return false }
}
export function setReduceMotion(on) {
  if (on) document.documentElement.dataset.reduceMotion = ''
  else delete document.documentElement.dataset.reduceMotion
  try { localStorage.setItem(MOTION_KEY, on ? '1' : '0') } catch (e) { }
  window.dispatchEvent(new CustomEvent(MOTION_EVENT, { detail: on }))
}
// Effective reduced motion right now (the setting or the OS), for code outside React render (scroll behavior, rAF loops).
export function prefersReducedMotion() {
  if (getReduceMotion()) return true
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch (e) { return false }
}
export function onReduceMotion(fn) {
  const h = e => fn(e.detail)
  window.addEventListener(MOTION_EVENT, h)
  return () => window.removeEventListener(MOTION_EVENT, h)
}
export function applySavedTheme() {
  document.documentElement.dataset.theme = getTheme()
  if (getReduceMotion()) document.documentElement.dataset.reduceMotion = ''
  // Pause background motion while the window is hidden or minimized.
  const vis = () => { if (document.hidden) document.documentElement.dataset.hidden = ''; else delete document.documentElement.dataset.hidden }
  document.addEventListener('visibilitychange', vis); vis()
  // Also rest while another window has focus (usually the game), so Spectre isn't redrawing behind it.
  const idle = on => { if (on) document.documentElement.dataset.idle = ''; else delete document.documentElement.dataset.idle }
  window.addEventListener('blur', () => idle(true))
  window.addEventListener('focus', () => idle(false))
  idle(!document.hasFocus())
}
