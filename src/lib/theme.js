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
export function applySavedTheme() { document.documentElement.dataset.theme = getTheme() }
