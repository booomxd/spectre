// Spectre website: theme swatches, screenshot viewer, lightbox, card spotlight and live release info from GitHub.
const REPO = 'booomxd/spectre'
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const bind = name => $$(`[data-bind="${name}"]`)
const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches
const store = {
  get: k => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k, v) => { try { localStorage.setItem(k, v) } catch {} },
}

// Themes: the same twelve as the app. The page defaults to Amethyst to match the ghost logo.
const THEMES = {
  midnight: ['Midnight', '255 70 85', '255 140 120'],
  onyx: ['Onyx', '235 235 235', '160 160 160'],
  ember: ['Ember', '255 128 48', '255 190 90'],
  glacier: ['Glacier', '86 200 255', '160 230 255'],
  verdant: ['Verdant', '62 220 140', '160 240 190'],
  amethyst: ['Amethyst', '176 120 255', '230 160 255'],
  gilded: ['Gilded', '232 190 90', '255 225 150'],
  aurora: ['Aurora', '45 212 191', '167 139 250'],
  sakura: ['Sakura', '255 121 176', '255 190 215'],
  abyss: ['Abyss', '92 132 255', '120 220 255'],
  sunset: ['Sunset', '255 94 140', '255 176 92'],
  pearl: ['Pearl', '99 91 255', '214 92 255'],
}
function setTheme(key, save) {
  const t = THEMES[key]
  if (!t) return
  document.documentElement.style.setProperty('--a', t[1])
  document.documentElement.style.setProperty('--a2', t[2])
  $$('.swatches button').forEach(b => b.setAttribute('aria-pressed', b.dataset.theme === key))
  bind('theme-name').forEach(el => { el.textContent = t[0] })
  if (save) store.set('spectre-site-theme', key)
}
setTheme(THEMES[store.get('spectre-site-theme')] ? store.get('spectre-site-theme') : 'amethyst')
$$('.swatches button').forEach(b => b.addEventListener('click', () => setTheme(b.dataset.theme, true)))

// Nav glass gets denser once the page scrolls; the hero window flattens out as it comes into view.
const nav = $('.nav')
const win = $('.window')
let ticking = false
function onScroll() {
  ticking = false
  nav.classList.toggle('scrolled', scrollY > 12)
  if (win && !reduced) {
    const p = Math.min(1, Math.max(0, scrollY / (innerHeight * 0.55)))
    win.style.setProperty('--rx', `${14 * (1 - p)}deg`)
    win.style.setProperty('--s', 0.94 + 0.06 * p)
  }
}
addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(onScroll) } }, { passive: true })
onScroll()

// Scroll reveal
const reveal = new IntersectionObserver(entries => entries.forEach(e => {
  if (!e.isIntersecting) return
  e.target.classList.add('in')
  reveal.unobserve(e.target)
}), { rootMargin: '0px 0px -8% 0px' })
$$('.reveal').forEach(el => reveal.observe(el))

// Cursor spotlight on cards
$$('.card').forEach(c => c.addEventListener('pointermove', e => {
  const r = c.getBoundingClientRect()
  c.style.setProperty('--mx', `${e.clientX - r.left}px`)
  c.style.setProperty('--my', `${e.clientY - r.top}px`)
}))

// Screenshot viewer
const SHOTS = [
  { title: 'Live Match', src: 'screenshots/live-match.png', alt: 'Live Match: both teams with current rank, peak rank and Vandal / Phantom skins',
    text: 'Both teams with current-act rank, RR, peak rank and Vandal / Phantom skins. Your party is marked with a colored bar.' },
  { title: 'Scout', src: 'screenshots/scout.png', alt: 'Scout panel with rank history, recent performance and matches',
    text: 'Any player\'s rank history, recent performance (KDA, ACS, HS %, KAST, ADR, first bloods), top agents and last 10 competitive matches.' },
  { title: 'Skins', src: 'screenshots/skins.png', alt: 'Skins panel with card, sprays, weapon skins and buddies',
    text: 'Anyone\'s card, title, sprays, and every weapon skin with its gun buddy.' },
  { title: 'Overlay', src: 'screenshots/overlay.jpg', alt: 'In-game overlay with both teams\' ranks',
    text: 'Both teams\' ranks over the game. Ctrl+Shift+O shows or hides it, Ctrl+Shift+L lets clicks pass through.' },
  { title: 'Lobby & Party', src: 'screenshots/lobby.png', alt: 'Lobby and party controls',
    text: 'Invite friends by Riot ID, share invite codes, pick a mode, ready up and start matchmaking.' },
  { title: 'Discord', src: 'screenshots/discord.png', alt: 'Discord Rich Presence settings and profile preview',
    text: 'Rich Presence with mode, map art, score, rank and party, plus a profile preview with sample scenarios.' },
]
const tabs = $$('.tab')
const tablist = $('.tabs')
const ind = $('.tab-ind')
const viewer = $('#viewer')
const vImg = $('#viewer-img')
const progress = $('.progress')
let cur = 0
let token = 0

function moveIndicator() {
  const t = tabs[cur]
  ind.style.left = `${t.offsetLeft}px`
  ind.style.width = `${t.offsetWidth}px`
}
function restartProgress() {
  if (!viewer.classList.contains('auto')) return
  progress.style.animation = 'none'
  void progress.offsetWidth
  progress.style.animation = ''
}
function stopAuto() { viewer.classList.remove('auto') }

function show(i, { user = false, focus = false } = {}) {
  cur = (i + SHOTS.length) % SHOTS.length
  const s = SHOTS[cur]
  tabs.forEach((t, j) => {
    t.setAttribute('aria-selected', j === cur)
    t.tabIndex = j === cur ? 0 : -1
  })
  viewer.setAttribute('aria-labelledby', tabs[cur].id)
  moveIndicator()
  const t = tabs[cur]
  tablist.scrollTo({ left: t.offsetLeft - (tablist.clientWidth - t.offsetWidth) / 2, behavior: reduced ? 'auto' : 'smooth' })
  if (focus) t.focus()
  if (user) stopAuto()
  else restartProgress()

  const mine = ++token
  vImg.classList.add('out')
  const next = new Image()
  next.src = s.src
  const swap = () => {
    if (mine !== token) return
    vImg.src = s.src
    vImg.alt = s.alt
    $('#viewer-title').textContent = s.title
    $('#viewer-text').textContent = s.text
    vImg.classList.remove('out')
  }
  next.decode().then(swap, swap)
}

tabs.forEach((t, i) => t.addEventListener('click', () => show(i, { user: true })))
tablist.addEventListener('keydown', e => {
  const step = { ArrowRight: 1, ArrowLeft: -1 }[e.key]
  if (step) { e.preventDefault(); show(cur + step, { user: true, focus: true }) }
  if (e.key === 'Home') { e.preventDefault(); show(0, { user: true, focus: true }) }
  if (e.key === 'End') { e.preventDefault(); show(SHOTS.length - 1, { user: true, focus: true }) }
})
$$('[data-step]').forEach(b => b.addEventListener('click', () => show(cur + Number(b.dataset.step), { user: true })))
progress.addEventListener('animationend', () => show(cur + 1))
addEventListener('resize', moveIndicator)
document.fonts?.ready.then(moveIndicator)
moveIndicator()

// Autoplay only while the viewer is on screen, and never with reduced motion.
if (!reduced) {
  viewer.classList.add('auto')
  new IntersectionObserver(([e]) => viewer.classList.toggle('visible', e.isIntersecting), { threshold: 0.5 }).observe(viewer)
}
// Warm the cache so switching tabs is instant.
addEventListener('load', () => SHOTS.forEach(s => { new Image().src = s.src }))

// Lightbox
const lb = $('#lightbox')
const lbImg = $('#lb-img')
let lbIndex = 0
function lbShow(i) {
  lbIndex = (i + SHOTS.length) % SHOTS.length
  const s = SHOTS[lbIndex]
  lbImg.src = s.src
  lbImg.alt = s.alt
  $('#lb-cap').textContent = `${s.title} · ${s.text}`
}
function openLightbox(i) {
  stopAuto()
  lbShow(i)
  lb.showModal()
}
$('.viewer-stage').addEventListener('click', () => openLightbox(cur))
$$('[data-open]').forEach(b => b.addEventListener('click', () => openLightbox(Number(b.dataset.open))))
$('.lb-close').addEventListener('click', () => lb.close())
$$('[data-lb]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); lbShow(lbIndex + Number(b.dataset.lb)) }))
lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close() })
lb.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') lbShow(lbIndex + 1)
  if (e.key === 'ArrowLeft') lbShow(lbIndex - 1)
})

// Live release info: version, download links, sizes, checksums, download count and release notes.
const esc = s => s.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])
const inline = s => esc(s)
  .replace(/`([^`]+)`/g, '<code>$1</code>')
  .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
  .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
  .replace(/(^|[\s(])_([^_]+)_(?=[\s).,]|$)/g, '$1<em>$2</em>')

// Renders the release body: each "###" section becomes a column, the download section and footer are skipped.
function renderNotes(body) {
  const out = []
  let col = null
  let list = false
  let skip = false
  const closeList = () => { if (list) { col.push('</ul>'); list = false } }
  const closeCol = () => { if (col) { closeList(); out.push(`<div class="col">${col.join('')}</div>`); col = null } }
  for (const raw of body.replace(/\r/g, '').split('\n')) {
    const line = raw.trim()
    const h = line.match(/^###\s+(.*)/)
    if (h) {
      closeCol()
      skip = /download/i.test(h[1])
      if (!skip) col = [`<h4>${inline(h[1])}</h4>`]
      continue
    }
    if (skip || /^##?\s/.test(line) || !line || /^_.*_$/.test(line) || /^full details/i.test(line)) {
      if (!line) closeList()
      continue
    }
    const target = col || out
    if (/^[-*]\s+/.test(line)) {
      if (!col) continue
      if (!list) { col.push('<ul>'); list = true }
      col.push(`<li>${inline(line.replace(/^[-*]\s+/, ''))}</li>`)
      continue
    }
    closeList()
    target.push(line.startsWith('>') ? `<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>` : `<p>${inline(line)}</p>`)
  }
  closeCol()
  return out.join('')
}

const mb = n => `${(n / 1e6).toFixed(1)} MB`
const fmt = n => n.toLocaleString('en')

function fileMeta(el, a) {
  if (!el || !a) return
  const rows = [['File', esc(a.name)], ['Size', mb(a.size)]]
  if (a.count >= 100) rows.push(['Downloads', fmt(a.count)])
  if (a.digest) {
    const hash = a.digest.replace(/^sha256:/, '')
    rows.push(['SHA-256', `<button type="button" data-copy="${esc(hash)}" title="Copy SHA-256"><span>${esc(hash)}</span><svg class="i"><use href="#i-copy"/></svg></button>`])
  }
  el.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  el.hidden = false
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]')
  if (!b) return
  navigator.clipboard?.writeText(b.dataset.copy).then(() => {
    const span = $('span', b)
    const was = span.textContent
    span.textContent = 'Copied'
    setTimeout(() => { span.textContent = was }, 1400)
  })
})

function countUp(el, to) {
  if (reduced) { el.textContent = fmt(to); return }
  const start = performance.now()
  const tick = now => {
    const p = Math.min(1, (now - start) / 1400)
    el.textContent = fmt(Math.round(to * (1 - (1 - p) ** 3)))
    if (p < 1) requestAnimationFrame(tick)
  }
  requestAnimationFrame(tick)
}

async function releases() {
  try {
    const cached = JSON.parse(sessionStorage.getItem('spectre-releases'))
    if (cached && Date.now() - cached.at < 10 * 60e3) return cached.data
  } catch {}
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=100`, { headers: { Accept: 'application/vnd.github+json' } })
  if (!r.ok) throw new Error(`GitHub returned ${r.status}`)
  const data = (await r.json()).map(x => ({
    tag: x.tag_name, draft: x.draft, prerelease: x.prerelease, date: x.published_at, body: x.body || '', url: x.html_url,
    assets: x.assets.map(a => ({ name: a.name, size: a.size, url: a.browser_download_url, count: a.download_count, digest: a.digest })),
  }))
  try { sessionStorage.setItem('spectre-releases', JSON.stringify({ at: Date.now(), data })) } catch {}
  return data
}

async function loadRelease() {
  const all = await releases()
  const rel = all.find(r => !r.draft && !r.prerelease)
  if (!rel) return
  const isApp = a => /\.exe$|-win\.zip$/i.test(a.name)
  const installer = rel.assets.find(a => /^Spectre[ .]Setup.*\.exe$/i.test(a.name))
  const zip = rel.assets.find(a => /-win\.zip$/i.test(a.name))
  const total = all.reduce((n, r) => n + r.assets.filter(isApp).reduce((m, a) => m + a.count, 0), 0)
  const version = rel.tag.replace(/^v/, '')

  bind('tag').forEach(el => { el.textContent = `v${version}` })
  bind('version').forEach(el => { el.textContent = version })
  bind('version-label').forEach(el => { el.textContent = 'Latest version' })
  if (total >= 100) {
    bind('downloads-label').forEach(el => { el.textContent = 'Downloads' })
    bind('downloads').forEach(el => countUp(el, total))
  }
  if (installer) {
    bind('installer-href').forEach(el => { el.href = installer.url })
    bind('installer-sub').forEach(el => { el.textContent = `v${version} · ${mb(installer.size)}` })
    fileMeta(bind('installer-meta')[0], installer)
  }
  if (zip) {
    bind('zip-href').forEach(el => { el.href = zip.url })
    fileMeta(bind('zip-meta')[0], zip)
  }
  bind('date').forEach(el => { el.textContent = new Date(rel.date).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' }) })
  const notes = renderNotes(rel.body)
  if (notes) bind('notes').forEach(el => { el.innerHTML = notes })
}
loadRelease().catch(() => {})
