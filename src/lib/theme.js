// App themes. The id is applied as <html data-theme>; tokens live in index.css.
export const THEMES = [
  { id: 'midnight', name: 'Midnight', swatch: '#ff4655' },
  { id: 'onyx', name: 'Onyx', swatch: '#ebebeb' },
  { id: 'ember', name: 'Ember', swatch: '#ff8030' },
  { id: 'glacier', name: 'Glacier', swatch: '#56c8ff' },
  { id: 'verdant', name: 'Verdant', swatch: '#3edc8c' },
  { id: 'amethyst', name: 'Amethyst', swatch: '#b078ff' },
  { id: 'gilded', name: 'Gilded', swatch: '#e8be5a' },
]

const KEY = 'spectre.theme'
export function getTheme() {
  try { return localStorage.getItem(KEY) || 'midnight' } catch (e) { return 'midnight' }
}
export function setTheme(id) {
  document.documentElement.dataset.theme = id
  try { localStorage.setItem(KEY, id) } catch (e) { }
}
export function applySavedTheme() { document.documentElement.dataset.theme = getTheme() }
