// Runs before first paint: marks JS as available (so scroll reveals can start hidden) and applies the saved theme,
// so the accent never flashes. Kept tiny and external so the Content-Security-Policy needs no inline script.
(function () {
  var root = document.documentElement
  root.classList.add('js')

  // The same eighteen themes as the app: [name, accent, second glow].
  var THEMES = {
    midnight: ['Midnight', '#ff4655', '#ff8c78'],
    onyx: ['Onyx', '#ebebf0', '#a0a0aa'],
    ember: ['Ember', '#ff8030', '#ffbe5a'],
    glacier: ['Glacier', '#56c8ff', '#a0e6ff'],
    verdant: ['Verdant', '#3edc8c', '#a0f0be'],
    amethyst: ['Amethyst', '#b078ff', '#e6a0ff'],
    gilded: ['Gilded', '#e8be5a', '#ffe196'],
    aurora: ['Aurora', '#2dd4bf', '#a78bfa'],
    sakura: ['Sakura', '#ff79b0', '#ffbed7'],
    abyss: ['Abyss', '#5c84ff', '#78dcff'],
    sunset: ['Sunset', '#ff5e8c', '#ffb05c'],
    pearl: ['Pearl', '#635bff', '#d65cff'],
    aero: ['Frutiger Aero', '#1ea0e6', '#8be36a'],
    vaporwave: ['Vaporwave', '#ff71ce', '#01cdfe'],
    y2k: ['Y2K Chrome', '#78e6ff', '#d68cff'],
    lofi: ['Lo-fi', '#ffaa78', '#c8a0ff'],
    jamun: ['Minty Jamun', '#a860ff', '#6ef0be'],
    musashi: ['Musashi', '#c82424', '#eceae2'],
  }

  var hex = function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) }) }
  var toHex = function (c) { return '#' + c.map(function (v) { return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0') }).join('') }
  var lum = function (c) {
    var l = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
  }
  var ratio = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  var BG = hex('#0b0b12')

  // Picks AA-safe colours for each accent: the button fill and its label, and an accent shade for small text.
  function tokens(accent) {
    var a = hex(accent)
    var white = [255, 255, 255]
    var btn = null
    for (var k = 1; k >= 0.7; k -= 0.02) {
      var c = a.map(function (v) { return v * k })
      if (ratio(c, white) >= 4.5) { btn = { bg: toHex(c), fg: '#ffffff' }; break }
    }
    if (!btn) btn = { bg: accent, fg: '#0b0b12' }
    var text = a
    for (var t = 0; t <= 1 && ratio(text, BG) < 4.8; t += 0.05) text = a.map(function (v) { return v + (255 - v) * t })
    return { btn: btn, text: toHex(text) }
  }

  function apply(key) {
    var t = THEMES[key]
    if (!t) return false
    var k = tokens(t[1])
    var s = root.style
    s.setProperty('--accent', t[1])
    s.setProperty('--accent-2', t[2])
    s.setProperty('--accent-text', k.text)
    s.setProperty('--btn-bg', k.btn.bg)
    s.setProperty('--btn-fg', k.btn.fg)
    root.dataset.theme = key
    return true
  }

  var saved = null
  try { saved = localStorage.getItem('spectre-site-theme') } catch (e) {}
  apply(THEMES[saved] ? saved : 'midnight')

  window.SpectreTheme = {
    themes: THEMES,
    apply: function (key, save) {
      if (!apply(key)) return
      if (save) { try { localStorage.setItem('spectre-site-theme', key) } catch (e) {} }
    },
  }
})()
