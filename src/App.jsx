import { For, Show, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { FiDownload, FiMinus, FiSearch, FiSquare, FiX, FiDroplet, FiFeather } from 'solid-icons/fi'
import { PAGES, SECTIONS, UTILITY, navigate, sectionOf } from './nav'
import { invoke, isOverlayWindow, openExternal, useEvent } from './lib/ipc'
import { RiotProvider, useRiot } from './lib/riot'
import { THEMES, getReduceMotion, setReduceMotion, setTheme } from './lib/theme'
import logo from './assets/spectre-logo.svg'
import { Button, CommandPalette, Modal, MotionProvider, PageActiveContext, PageContext, PageTransition, Pill, SegmentedTabs, ToastHost, cx, toast } from './ui'
import { SETTINGS_TABS } from './pages/Settings'
import Overlay from './pages/Overlay'
import Announcements from './lib/announcements'

// New-release prompt: a dialog once per version, then an Update button that stays in the title bar
function UpdateButton() {
  const [s, setS] = createSignal(null)
  const [pct, setPct] = createSignal(null)
  const [prompt, setPrompt] = createSignal(false)
  invoke('update:status').then(setS).catch(() => { })
  useEvent('update:status', setS)
  useEvent('update:progress', p => setPct(p.pct ?? 0))
  createEffect(on(() => [s()?.available, s()?.latest], ([available, latest]) => {
    if (!available) return
    try { if (localStorage.getItem('spectre:update-seen') === latest) return; localStorage.setItem('spectre:update-seen', latest) } catch (e) { }
    setPrompt(true)
  }))
  const go = async () => {
    setPrompt(false)
    if (!s().canInstall) return openExternal(s().url)
    setPct(0)
    try { await invoke('update:install') } catch (e) { setPct(null); toast.error(e.message) }
  }
  return (
    <Show when={s()?.available}>
      <button onClick={go} disabled={pct() != null} title={s().canInstall ? 'Download, install and restart' : 'Open the download page'}
        class='accent-fill h-8 mr-1.5 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 text-bg hover:brightness-110 disabled:opacity-80 transition-[filter,opacity]'>
        <FiDownload size={13} />{pct() != null ? `Updating ${pct()}%` : `${s().canInstall ? 'Update' : 'Download'} ${s().latest}`}
      </button>
      <Modal open={prompt()} onClose={() => setPrompt(false)} title={`Spectre ${s().latest} is here`} width={420}
        footer={<><Button variant='ghost' onClick={() => setPrompt(false)}>Later</Button><Button variant='primary' icon={FiDownload} onClick={go}>{s().canInstall ? 'Update now' : 'Download'}</Button></>}>
        <p class='text-[13px] text-muted'>
          You're on {s().current}. {s().canInstall ? 'Spectre will download the update, install it and restart, which takes about a minute.' : 'Download the new version from the release page.'}
        </p>
        <button class='mt-3 text-[13px] font-semibold text-accent hover:underline' onClick={() => { setPrompt(false); navigate('patchnotes') }}>See what's new</button>
      </Modal>
    </Show>
  )
}

const WIN_LABEL = { 'win:minimize': 'Minimize', 'win:maximize': 'Maximize', 'win:close': 'Close to tray' }
function WindowControls() {
  return (
    <div class='flex items-center'>
      <For each={[['win:minimize', FiMinus, 'hover:bg-surface-2 hover:text-text'], ['win:maximize', FiSquare, 'hover:bg-surface-2 hover:text-text'], ['win:close', FiX, 'hover:bg-bad hover:text-white']]}>{([ch, Icon, hov]) => (
        <button onClick={() => invoke(ch)} aria-label={WIN_LABEL[ch]} title={WIN_LABEL[ch]} class={cx('w-10 h-8 flex items-center justify-center text-muted rounded-full transition-colors', hov)}>
          <Icon size={ch === 'win:maximize' ? 12 : 15} />
        </button>
      )}</For>
    </div>
  )
}

// floating glass dock: the six sections, with a pill under the active one
function Dock(props) {
  return (
    <nav class='glass-strong flex items-center gap-0.5 p-1 rounded-full'>
      <For each={SECTIONS}>{s => {
        const on_ = () => props.section === s.id
        return (
          <button onClick={() => props.onSection(s.id)} title={s.label} aria-label={s.label} aria-current={on_() ? 'page' : undefined}
            class={cx('relative h-9 px-3.5 rounded-full flex items-center gap-2 text-[13px] font-semibold transition-colors duration-150', on_() ? 'text-text' : 'text-muted hover:text-text')}>
            <Show when={on_()}><Pill /></Show>
            <Dynamic component={s.icon} class={cx('relative shrink-0', on_() && 'text-accent')} size={15} />
            <span class='relative max-[1200px]:hidden'>{s.label}</span>
          </button>
        )
      }}</For>
    </nav>
  )
}

function Brand() {
  const riot = useRiot()
  return (
    <div class='flex items-center gap-3 min-w-0'>
      <img decoding='async' src={logo} alt='' class='w-8 h-8 rounded-[10px] shadow-[0_6px_18px_-6px_rgb(var(--accent)/0.6)]' draggable={false} />
      <div class='min-w-0 leading-none'>
        <div class='font-brand text-[13px] text-text'>Spectre</div>
        <div class='mt-1 flex items-center gap-1.5 text-[11px] text-muted truncate max-[1200px]:hidden'>
          <span class={cx('w-1.5 h-1.5 rounded-full shrink-0', riot().connected ? 'bg-good shadow-[0_0_8px_rgb(var(--good))]' : 'bg-warn anim-pulse')} />
          <span class='truncate max-w-[160px]'>{riot().connected ? `${riot().gameName} #${riot().tagLine}` : 'Waiting for Riot Client'}</span>
        </div>
      </div>
    </div>
  )
}

// right side of the second row: palette trigger + utility pages
function Utilities(props) {
  return (
    <div class='flex items-center gap-2'>
      <button onClick={() => props.onPalette()} title='Search (Ctrl+K)' aria-label='Search (Ctrl+K)'
        class='glass h-9 pl-3 pr-1.5 rounded-full flex items-center gap-2 text-[12px] text-muted hover:text-text transition-colors'>
        <FiSearch size={14} /><span class='max-[1200px]:hidden'>Search</span><span class='kbd max-[1200px]:hidden'>Ctrl K</span>
      </button>
      <div class='glass flex items-center gap-0.5 p-1 rounded-full'>
        <For each={UTILITY}>{u => {
          const on_ = () => props.page === u.id
          return (
            <button onClick={() => props.onOpen(u.id)} title={u.label} aria-label={u.label} aria-current={on_() ? 'page' : undefined}
              class={cx('relative w-8 h-7 rounded-full flex items-center justify-center transition-colors', on_() ? 'text-accent' : 'text-muted hover:text-text')}>
              <Show when={on_()}><Pill /></Show>
              <Dynamic component={u.icon} class='relative' size={14} />
            </button>
          )
        }}</For>
      </div>
    </div>
  )
}

// page context per section
const CONTEXTS = Object.fromEntries(Object.values(PAGES).map(p => {
  const s = p.section && SECTIONS.find(x => x.id === p.section)
  return [p.id, { section: s ? s.label : 'Spectre' }]
}))

const NO_PARAMS = Object.freeze({})

function resolve(page, params) {
  if (!PAGES[page]) return ['dashboard', {}]
  return [page, params || {}]
}

// frutiger Aero bubbles (CSS hides them in every other theme): size, start, speed, delay, sway
const BUBBLES = [[5, 8, 24, 0, 3], [9, 22, 31, -9, -4], [3.5, 37, 21, -4, 5], [7, 55, 28, -15, -3], [4.5, 68, 23, -7, 4], [11, 80, 36, -20, -5], [3, 91, 19, -2, 3]]
  .map(([w, l, d, dl, sw]) => ({ width: w + 'vmax', height: w + 'vmax', left: l + '%', '--d': d + 's', '--dl': dl + 's', '--sway': sw + 'vmax' }))

function Shell() {
  const [page, setPage] = createSignal('dashboard')
  const [params, setParams] = createSignal({})
  const [palette, setPalette] = createSignal(false)
  const [visited, setVisited] = createSignal(new Set(['dashboard']))
  const lastInSection = {}
  const markVisited = id => { if (!visited().has(id)) setVisited(v => new Set(v).add(id)) }
  createEffect(() => markVisited(page()))

  // Pre-draw every page in the background, one at a time while the app is idle, so the first visit is instant too
  {
    const queue = Object.values(PAGES).map(p => p.id)
    let cancelled = false, timer = 0, idleId = 0
    const idle = window.requestIdleCallback || (fn => setTimeout(fn, 60))
    const unidle = window.cancelIdleCallback || clearTimeout
    const step = () => {
      if (cancelled) return
      const next = queue.find(id => !visited().has(id))
      if (!next) return
      markVisited(next)
      timer = setTimeout(() => { idleId = idle(step, { timeout: 400 }) }, 120)
    }
    timer = setTimeout(() => { idleId = idle(step, { timeout: 800 }) }, 1200)
    onCleanup(() => { cancelled = true; clearTimeout(timer); unidle(idleId) })
  }

  const section = createMemo(() => sectionOf(page()))
  createEffect(() => { const s = section(); if (s) lastInSection[s.id] = page() })

  const go = (id, p) => {
    const [to, prm] = resolve(id, p)
    setParams(x => ({ ...x, [to]: prm }))
    setPage(to)
  }

  invoke('settings:get').then(s => {
    if (!s?.startPage) return
    // "Where I left off": the page that was open when Spectre last closed
    let to = s.startPage
    if (to === 'last') { try { to = localStorage.getItem('spectre:last-page') || 'dashboard' } catch { to = 'dashboard' } }
    go(to)
  }).catch(() => { })
  createEffect(() => { const p = page(); try { localStorage.setItem('spectre:last-page', p) } catch { /* storage unavailable */ } })

  const onNav = e => go(e.detail.page, e.detail.params)
  window.addEventListener('spectre:navigate', onNav)
  const onKey = e => {
    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(o => !o) }
  }
  window.addEventListener('keydown', onKey)
  onCleanup(() => { window.removeEventListener('spectre:navigate', onNav); window.removeEventListener('keydown', onKey) })

  const openSection = id => {
    const s = SECTIONS.find(x => x.id === id)
    go(lastInSection[id] || s.pages[0].id)
  }

  const items = [
    ...SECTIONS.flatMap(s => s.pages.map(p => ({ id: 'p:' + p.id, label: p.label === s.label ? s.label : p.label, hint: s.pages.length > 1 ? s.label : '', group: 'Go to', icon: p.icon, keywords: s.label, run: () => go(p.id) }))),
    ...UTILITY.map(u => ({ id: 'p:' + u.id, label: u.label, group: 'App', icon: u.icon, run: () => go(u.id) })),
    ...SETTINGS_TABS.map(t => ({ id: 's:' + t.value, label: `Settings: ${t.label}`, group: 'Settings', icon: t.icon, keywords: 'preferences', run: () => go('settings', { tab: t.value }) })),
    { id: 'a:motion', label: 'Toggle reduce motion', group: 'Actions', icon: FiFeather, keywords: 'animation accessibility', run: () => { const v = !getReduceMotion(); setReduceMotion(v); toast(v ? 'Reduced motion on' : 'Reduced motion off') } },
    ...THEMES.map(t => ({ id: 't:' + t.id, label: `Theme: ${t.name}`, group: 'Themes', icon: FiDroplet, keywords: 'color appearance', run: () => setTheme(t.id) })),
  ]

  const sub = createMemo(() => { const s = section(); return s && s.pages.length > 1 ? s : null })
  return (
    <div class='h-full flex flex-col relative'>
      <div class='backdrop' aria-hidden='true'><div class='backdrop-fields'><span class='orb orb-1' /><span class='orb orb-2' /><span class='orb orb-3' /><span class='orb orb-4' /><For each={BUBBLES}>{b => <span class='bubble' style={b} />}</For></div></div>

      {/* row 1: brand, dock, update + window controls */}
      <header data-tauri-drag-region class='drag relative z-20 h-16 shrink-0 flex items-center justify-between pl-5 pr-2'>
        <Brand />
        <div class='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
          <Dock section={section()?.id} onSection={openSection} />
        </div>
        <div class='flex items-center'>
          <UpdateButton />
          <WindowControls />
        </div>
      </header>

      {/* row 2: section sub-tabs (centered), search + utility pages */}
      <div data-tauri-drag-region class='drag relative z-20 h-12 shrink-0 flex items-center justify-end px-5'>
        <div class='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
          <Show when={sub()} keyed>{s => (
            <SegmentedTabs size='sm' value={page()} onChange={go}
              tabs={s.pages.map(p => ({ value: p.id, label: p.label, icon: p.icon }))} />
          )}</Show>
        </div>
        <Utilities page={page()} onOpen={go} onPalette={() => setPalette(true)} />
      </div>

      <Announcements />

      <main class='flex-1 relative min-h-0 z-10'>
        <For each={Object.values(PAGES)}>{p => {
          const active = () => page() === p.id
          return (
            <Show when={visited().has(p.id)}>
              <PageContext.Provider value={CONTEXTS[p.id]}>
                <PageActiveContext.Provider value={active}>
                  <PageTransition active={active()} class='absolute inset-0'>
                    <Dynamic component={p.component} params={params()[p.id] || NO_PARAMS} active={active()} />
                  </PageTransition>
                </PageActiveContext.Provider>
              </PageContext.Provider>
            </Show>
          )
        }}</For>
      </main>

      <CommandPalette open={palette()} onClose={() => setPalette(false)} items={items} />
    </div>
  )
}

export default function App() {
  // the overlay window loads the same bundle
  const isOverlay = isOverlayWindow()
  return (
    <MotionProvider>
      <RiotProvider>
        {isOverlay ? <Overlay /> : <Shell />}
        <ToastHost />
      </RiotProvider>
    </MotionProvider>
  )
}
