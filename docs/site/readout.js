// Spectre website motion layer: the hero instrument loop, feature tabs, overlay keys, the leader fallback and the
// release roll. Timers only toggle classes and custom properties; layout is read on load and on resize, never in the loop.
(() => {
  const $ = (s, el = document) => el.querySelector(s)
  const $$ = (s, el = document) => [...el.querySelectorAll(s)]
  const root = document.documentElement
  const rm = () => root.classList.contains('rm')
  const esc = s => s.replace(/[&<>"]/g, c => `&#${c.charCodeAt(0)};`)
  const twoFrames = fn => requestAnimationFrame(() => requestAnimationFrame(fn))

  function rollify(el, zero) {
    const text = el.textContent.trim()
    if (el.dataset.v || !/\d/.test(text)) return false
    el.dataset.v = text
    let i = 0
    el.innerHTML = `<span class="sr">${esc(text)}</span>` + [...text].map(c => /\d/.test(c)
      ? `<span class="dg" aria-hidden="true" data-n="${c}" style="--n:${zero ? 0 : c};--i:${i++}"></span>`
      : `<span aria-hidden="true">${c === ' ' ? '&#160;' : esc(c)}</span>`).join('')
    return true
  }

  const R = $('#resolve')
  if (R) {
    const rows = $$('.row', R)
    const ph = $('.phase', R)
    const status = $('[data-status]', R)
    const ret = $('.reticle', R)
    const snapEl = $('.ret-snap', R)
    const scan = $('.scan', R)
    const ticks = $$('[data-tick]', R)
    $$('.num[data-roll]', R).forEach(n => rollify(n))

    let pos = []
    let cur = 0
    let flip = false
    const aim = k => {
      cur = k
      if (!pos[k]) return
      ret.style.setProperty('--rx', `${pos[k][0]}px`)
      ret.style.setProperty('--ry', `${pos[k][1]}px`)
    }
    const measure = () => {
      pos = rows.map(r => [r.offsetLeft, r.offsetTop])
      ret.style.setProperty('--rw', `${rows[0].offsetWidth}px`)
      ret.style.setProperty('--rh', `${rows[0].offsetHeight}px`)
      aim(cur)
    }
    const snap = () => { flip = !flip; snapEl.className = `ret ret-snap ${flip ? 'a' : 'b'}` }
    const phase = (n, text) => { ph.dataset.stop = n; status.textContent = text }
    const tick = up => ticks.forEach(n => {
      const v = Number(n.dataset.v) + (up ? 1 : 0)
      $$('.dg', n).pop().style.setProperty('--n', v % 10)
      $('.sr', n).textContent = v
    })
    const blank = () => {
      R.classList.add('is-blank')
      rows.forEach(r => r.classList.remove('on'))
      scan.classList.remove('go')
      tick(false)
    }
    const resolved = () => {
      R.classList.remove('is-blank')
      rows.forEach(r => r.classList.add('on'))
      phase(2, 'Round 1, 0 to 0')
      tick(false)
      aim(0)
    }

    let idx = 0
    let t0 = 0
    let elapsed = 0
    let timer = 0
    let running = false
    let paused = false
    let seen = false
    const steps = [
      [0, () => { blank(); phase(1, 'Agent select') }],
      [400, () => scan.classList.add('go')],
      ...rows.map((r, k) => [600 + k * 140, () => { aim(k); snap(); r.classList.add('on') }]),
      [3200, () => { aim(0); snap(); R.classList.remove('is-blank') }],
      [6000, () => { phase(2, 'Round 1, 0 to 0'); tick(true) }],
      [10000, () => phase(3, 'Round 13, 7 to 5')],
      [12000, blank],
      [12400, () => { idx = -1; t0 = performance.now() }],
    ]
    const next = () => { timer = setTimeout(fire, Math.max(0, steps[idx][0] - (performance.now() - t0))) }
    function fire() { steps[idx][1](); idx++; next() }
    const sync = () => {
      const want = !paused && seen && !document.hidden && !rm()
      if (want && !running) { running = true; R.classList.add('running'); t0 = performance.now() - elapsed; next() }
      else if (!want && running) { running = false; R.classList.remove('running'); clearTimeout(timer); elapsed = performance.now() - t0 }
    }

    const btn = document.createElement('button')
    btn.type = 'button'
    btn.className = 'pause-btn'
    btn.setAttribute('aria-label', 'Pause the demo')
    btn.setAttribute('aria-pressed', 'false')
    btn.addEventListener('click', () => { paused = !paused; btn.setAttribute('aria-pressed', String(paused)); sync() })
    const mode = () => {
      if (rm()) { sync(); btn.remove(); resolved(); idx = 0; elapsed = 0 }
      else { $('.inst-chrome', R).append(btn); sync() }
    }

    if (!rm()) phase(1, 'Agent select')
    measure()
    let rt = 0
    new ResizeObserver(() => { clearTimeout(rt); rt = setTimeout(measure, 150) }).observe($('.roster', R))
    new IntersectionObserver(([e]) => { seen = e.isIntersecting; sync() }, { threshold: 0.15 }).observe(R)
    document.addEventListener('visibilitychange', sync)
    matchMedia('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => setTimeout(mode))
    mode()
  }

  const tabs = $$('.dock-tabs [role="tab"]')
  const panels = tabs.map(t => document.getElementById(t.getAttribute('aria-controls')))
  if (tabs.length) {
    let on = 0
    let leaveT = 0
    panels.forEach((p, i) => { p.hidden = i !== 0 })
    const preload = i => { const img = $('img', panels[i]); if (img) img.loading = 'eager' }
    const select = (i, focus) => {
      if (focus) tabs[i].focus()
      if (i === on) return
      const out = panels[on]
      const inn = panels[i]
      panels.forEach(p => { if (p !== out && p !== inn) { p.hidden = true; p.classList.remove('is-current', 'is-leaving', 'is-entering') } })
      tabs.forEach((t, j) => { t.setAttribute('aria-selected', String(j === i)); t.tabIndex = j === i ? 0 : -1 })
      on = i
      preload(i)
      clearTimeout(leaveT)
      out.classList.remove('is-current', 'is-entering')
      inn.classList.remove('is-leaving')
      inn.classList.add('is-current')
      inn.hidden = false
      if (rm()) { out.hidden = true; return }
      out.classList.add('is-leaving')
      inn.classList.add('is-entering')
      twoFrames(() => inn.classList.remove('is-entering'))
      leaveT = setTimeout(() => { out.hidden = true; out.classList.remove('is-leaving') }, 440)
    }
    tabs.forEach((t, i) => {
      t.addEventListener('click', () => select(i))
      t.addEventListener('pointerenter', () => preload(i))
      t.addEventListener('focus', () => preload(i))
    })
    $('.dock-tabs').addEventListener('keydown', e => {
      const n = tabs.length
      const k = { ArrowRight: on + 1, ArrowLeft: on - 1, Home: 0, End: n - 1 }[e.key]
      if (k === undefined) return
      e.preventDefault()
      select((k + n) % n, true)
    })
  }

  const kt = $('.keycap-toggle')
  const stage = $('.overlay-stage')
  if (kt && stage) {
    let busy = 0
    kt.addEventListener('click', () => {
      const show = kt.getAttribute('aria-pressed') !== 'true'
      kt.setAttribute('aria-pressed', String(show))
      const caps = $$('kbd', kt)
      clearTimeout(busy)
      if (rm()) { stage.classList.toggle('is-on', show); return }
      caps.forEach((c, i) => setTimeout(() => c.classList.add('down'), i * 60))
      busy = setTimeout(() => {
        caps.forEach(c => c.classList.remove('down'))
        stage.classList.toggle('is-on', show)
      }, (caps.length - 1) * 60 + 90)
    })
  }

  const lf = $('.live-figure')
  if (lf && !(window.CSS && CSS.supports('animation-timeline: view()'))) {
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { lf.classList.add('drawn'); o.disconnect() } }, { threshold: 0.4 }).observe(lf)
  }

  const rel = $('.release-readout')
  if (rel) {
    let seen = false
    const roll = () => {
      if (!seen) return
      $$('[data-roll-late]', rel).forEach(el => {
        if (!rollify(el, !rm())) return
        twoFrames(() => $$('.dg', el).forEach(d => d.style.setProperty('--n', d.dataset.n)))
      })
    }
    new IntersectionObserver((es, o) => { if (es[0].isIntersecting) { seen = true; roll(); o.disconnect() } }, { threshold: 0.4 }).observe(rel)
    document.addEventListener('spectre:release', roll)
  }
})()
