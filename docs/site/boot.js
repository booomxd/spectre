// Runs before first paint: marks JS as available, mirrors prefers-reduced-motion as html.rm and applies the saved theme,
// so the accent never flashes. Kept tiny and external so the Content-Security-Policy needs no inline script.
(function () {
  var root = document.documentElement
  root.classList.add('js')

  // html.rm switches every loop, transition and scroll-driven animation to its final state (see style.css).
  var rm = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)')
  var setRm = function () { root.classList.toggle('rm', !!(rm && rm.matches)) }
  setRm()
  if (rm && rm.addEventListener) rm.addEventListener('change', setRm)

  // The same twelve themes as the app: [name, accent, second glow].
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
  }

  var hex = function (h) { return [1, 3, 5].map(function (i) { return parseInt(h.slice(i, i + 2), 16) }) }
  var toHex = function (c) { return '#' + c.map(function (v) { return Math.round(Math.max(0, Math.min(255, v))).toString(16).padStart(2, '0') }).join('') }
  var lum = function (c) {
    var l = c.map(function (v) { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4) })
    return 0.2126 * l[0] + 0.7152 * l[1] + 0.0722 * l[2]
  }
  var ratio = function (a, b) { var x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05) }
  var BG = hex('#0a0d12')
  var LIGHT = hex('#f2f4f7')

  // Picks AA-safe colours for each accent: the button fill and its label, and an accent shade for small text.
  function tokens(accent, light) {
    var a = hex(accent)
    var white = [255, 255, 255]
    var btn = null
    for (var k = 1; k >= 0.7; k -= 0.02) {
      var c = a.map(function (v) { return v * k })
      if (ratio(c, white) >= 4.5) { btn = { bg: toHex(c), fg: '#ffffff' }; break }
    }
    if (!btn) btn = { bg: accent, fg: '#0b0b12' }
    var text = a
    // Small accent text: lighten on the dark ground, darken on Pearl's light ground.
    if (light) for (var d = 0; d <= 1 && ratio(text, LIGHT) < 4.8; d += 0.05) text = a.map(function (v) { return v * (1 - d) })
    else for (var t = 0; t <= 1 && ratio(text, BG) < 4.8; t += 0.05) text = a.map(function (v) { return v + (255 - v) * t })
    return { btn: btn, text: toHex(text) }
  }

  function apply(key) {
    var t = THEMES[key]
    if (!t) return false
    var k = tokens(t[1], key === 'pearl')
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
