// Spectre website: dock, theme ruler, screenshot lightbox and live release info from GitHub.
// The motion layer (hero instrument, tabs, overlay keys, leaders, release roll) lives in readout.js.
const REPO = 'booomxd/spectre'
const $ = (s, el = document) => el.querySelector(s)
const $$ = (s, el = document) => [...el.querySelectorAll(s)]
const bind = name => $$(`[data-bind="${name}"]`)

// ---------- Themes (palette and AA-safe tokens live in boot.js) ----------
const Theme = window.SpectreTheme
const calib = $('.calib')
function markTheme(key) {
  $$('.swatches button').forEach((b, i) => {
    b.setAttribute('aria-pressed', String(b.dataset.theme === key))
    if (b.dataset.theme === key && calib) calib.style.setProperty('--i', i)
  })
  const t = Theme?.themes[key]
  if (t) bind('theme-name').forEach(el => { el.textContent = t[0] })
}
if (Theme) {
  markTheme(document.documentElement.dataset.theme)
  $$('.swatches button').forEach(b => b.addEventListener('click', () => {
    Theme.apply(b.dataset.theme, true)
    markTheme(b.dataset.theme)
  }))
}

// ---------- Dock: mobile menu and the current section ----------
const dock = $('.dock')
const menuBtn = $('.dock-menu')
const links = $('#dock-links')
function setMenu(open) {
  dock.classList.toggle('open', open)
  menuBtn.setAttribute('aria-expanded', String(open))
  menuBtn.setAttribute('aria-label', open ? 'Close menu' : 'Open menu')
}
menuBtn.addEventListener('click', () => setMenu(!dock.classList.contains('open')))
links.addEventListener('click', e => { if (e.target.closest('a')) setMenu(false) })
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && dock.classList.contains('open')) { setMenu(false); menuBtn.focus() }
})
document.addEventListener('click', e => { if (dock.classList.contains('open') && !dock.contains(e.target)) setMenu(false) })

// The current section is the last observed one (in page order) crossing the middle band, so FAQ wins inside Download.
const navLinks = $$('.dock-links a[href^="#"]')
const watched = [...$$('main > section'), $('#faq')].filter(Boolean)
const inBand = new Set()
const sectionObserver = new IntersectionObserver(entries => {
  entries.forEach(e => (e.isIntersecting ? inBand.add(e.target) : inBand.delete(e.target)))
  const cur = watched.filter(s => inBand.has(s)).pop()
  if (!cur) return
  navLinks.forEach(a => {
    if (a.getAttribute('href') === `#${cur.id}`) a.setAttribute('aria-current', 'true')
    else a.removeAttribute('aria-current')
  })
}, { rootMargin: '-45% 0px -50% 0px' })
watched.forEach(s => sectionObserver.observe(s))

// ---------- Screenshots: skeleton until the file exists, lightbox for the rest ----------
const shots = $$('[data-shot]')
function markMissing(btn) {
  btn.classList.add('is-missing')
  btn.disabled = true
  btn.setAttribute('aria-hidden', 'true')
  btn.tabIndex = -1
}
shots.forEach(btn => {
  const img = $('img', btn)
  if (img.complete && img.naturalWidth === 0) markMissing(btn)
  else img.addEventListener('error', () => markMissing(btn), { once: true })
})

const lb = $('#lightbox')
const lbImg = $('#lb-img')
let lbList = []
let lbIndex = 0
function gallery() {
  const seen = new Set()
  return shots.filter(b => !b.classList.contains('is-missing')).map(b => $('img', b)).filter(img => {
    const src = img.getAttribute('src')
    if (seen.has(src)) return false
    seen.add(src)
    return true
  })
}
function lbShow(i) {
  lbIndex = (i + lbList.length) % lbList.length
  const img = lbList[lbIndex]
  lbImg.src = img.getAttribute('src')
  lbImg.alt = img.alt
  $('#lb-cap').textContent = img.dataset.text ? `${img.dataset.title}: ${img.dataset.text}` : img.alt
}
shots.forEach(btn => btn.addEventListener('click', () => {
  if (btn.classList.contains('is-missing') || !lb.showModal) return
  lbList = gallery()
  const i = lbList.findIndex(img => img.getAttribute('src') === $('img', btn).getAttribute('src'))
  lbShow(Math.max(0, i))
  $$('.lb-nav').forEach(b => { b.hidden = lbList.length < 2 })
  lb.showModal()
}))
$('.lb-close').addEventListener('click', () => lb.close())
$$('[data-lb]').forEach(b => b.addEventListener('click', e => { e.stopPropagation(); lbShow(lbIndex + Number(b.dataset.lb)) }))
lb.addEventListener('click', e => { if (e.target === lb || e.target.tagName === 'FIGURE') lb.close() })
lb.addEventListener('keydown', e => {
  if (e.key === 'ArrowRight') lbShow(lbIndex + 1)
  if (e.key === 'ArrowLeft') lbShow(lbIndex - 1)
})

// ---------- Live release info: version, download link, size, checksum and release notes ----------
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
  const rows = [['File', esc(a.name)], ['Size', `<span class="num" data-roll-late>${mb(a.size)}</span>`]]
  if (a.count >= 100) rows.push(['Downloads', fmt(a.count)])
  if (a.digest) {
    const hash = a.digest.replace(/^sha256:/, '')
    rows.push(['SHA-256', `<button type="button" data-copy="${esc(hash)}" aria-label="Copy SHA-256 checksum"><span>${esc(hash)}</span><svg class="i" aria-hidden="true"><use href="#i-copy"/></svg></button>`])
  }
  el.innerHTML = rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join('')
  el.hidden = false
}
document.addEventListener('click', e => {
  const b = e.target.closest('[data-copy]')
  if (!b || !navigator.clipboard) return
  navigator.clipboard.writeText(b.dataset.copy).then(() => {
    const span = $('span', b)
    span.textContent = 'Copied'
    setTimeout(() => { span.textContent = b.dataset.copy }, 1400)
  }, () => {})
})

async function releases() {
  try {
    const cached = JSON.parse(sessionStorage.getItem('spectre-releases'))
    if (cached && Date.now() - cached.at < 10 * 60e3) return cached.data
  } catch {}
  const r = await fetch(`https://api.github.com/repos/${REPO}/releases?per_page=30`, { headers: { Accept: 'application/vnd.github+json' } })
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
  // Any Windows installer name: Spectre-x.y.z-setup.exe, Spectre_x.y.z_x64-setup.exe or the older Spectre.Setup.x.y.z.exe
  const installer = rel.assets.find(a => /setup.*\.exe$/i.test(a.name)) || rel.assets.find(a => /\.exe$/i.test(a.name))
  const version = rel.tag.replace(/^v/, '')

  bind('tag').forEach(el => { el.textContent = `v${version}` })
  bind('pill').forEach(el => { el.textContent = `Version ${version} is out. Read the notes` })
  if (installer) {
    bind('installer-href').forEach(el => { el.href = installer.url })
    bind('installer-sub').forEach(el => { el.textContent = `v${version}, ${mb(installer.size)}` })
    fileMeta(bind('installer-meta')[0], installer)
  }
  if (rel.date) bind('date').forEach(el => { el.textContent = new Date(rel.date).toLocaleDateString('en', { month: 'long', day: 'numeric', year: 'numeric' }) })
  const notes = renderNotes(rel.body)
  if (notes) bind('notes').forEach(el => { el.innerHTML = notes })
  // readout.js rolls the version and size digits when the release readout comes into view.
  window.SpectreRelease = { version }
  document.dispatchEvent(new CustomEvent('spectre:release'))
}
loadRelease().catch(() => {})
