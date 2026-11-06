import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiDownload, FiMinus, FiSearch, FiSquare, FiX, FiDroplet, FiFeather } from 'react-icons/fi'
import { EXPERIMENTAL_IDS, PAGES, SECTIONS, UTILITY, navigate, sectionOf } from './nav'
import { invoke, isOverlayWindow, openExternal, useEvent } from './lib/ipc'
import { RiotProvider, useRiot } from './lib/riot'
import { THEMES, applySavedTheme, getReduceMotion, setReduceMotion, setTheme } from './lib/theme'
import logo from './assets/spectre-logo.svg'
import { AnimatePresence, Button, CommandPalette, Modal, MotionProvider, PageContext, PageTransition, SPRING, SegmentedTabs, ToastHost, cx, m, toast, useReducedMotion } from './ui'
import { SETTINGS_TABS } from './pages/Settings'
import Overlay from './pages/Overlay'

// New-release prompt: a dialog once per version, then an Update button that stays in the title bar.
// Installed copies update in place; dev builds and loose exes open the release page to download.
function UpdateButton() {
  const [s, setS] = useState(null)
  const [pct, setPct] = useState(null)
  const [prompt, setPrompt] = useState(false)
  useEffect(() => { invoke('update:status').then(setS).catch(() => { }) }, [])
  useEvent('update:status', setS)
  useEvent('update:progress', p => setPct(p.pct ?? 0))
  useEffect(() => {
    if (!s?.available) return
    try { if (localStorage.getItem('spectre:update-seen') === s.latest) return; localStorage.setItem('spectre:update-seen', s.latest) } catch (e) { }
    setPrompt(true)
  }, [s?.available, s?.latest])
  if (!s?.available) return null
  const go = async () => {
    setPrompt(false)
    if (!s.canInstall) return openExternal(s.url)
    setPct(0)
    try { await invoke('update:install') } catch (e) { setPct(null); toast.error(e.message) }
  }
  return (
    <>
      <button onClick={go} disabled={pct != null} title={s.canInstall ? 'Download, install and restart' : 'Open the download page'}
        className='accent-fill h-8 mr-1.5 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 text-bg hover:brightness-110 disabled:opacity-80 transition-[filter,opacity]'>
        <FiDownload size={13} />{pct != null ? `Updating ${pct}%` : `${s.canInstall ? 'Update' : 'Download'} ${s.latest}`}
      </button>
      <Modal open={prompt} onClose={() => setPrompt(false)} title={`Spectre ${s.latest} is here`} width={420}
        footer={<><Button variant='ghost' onClick={() => setPrompt(false)}>Later</Button><Button variant='primary' icon={FiDownload} onClick={go}>{s.canInstall ? 'Update now' : 'Download'}</Button></>}>
        <p className='text-[13px] text-muted'>
          You're on {s.current}. {s.canInstall ? 'Spectre will download the update, install it and restart, which takes about a minute.' : 'Download the new version from the release page.'}
        </p>
        <button className='mt-3 text-[13px] font-semibold text-accent hover:underline' onClick={() => { setPrompt(false); navigate('patchnotes') }}>See what's new</button>
      </Modal>
    </>
  )
}

function WindowControls() {
  return (
    <div className='flex items-center'>
      {[['win:minimize', FiMinus, 'hover:bg-surface-2 hover:text-text'], ['win:maximize', FiSquare, 'hover:bg-surface-2 hover:text-text'], ['win:close', FiX, 'hover:bg-bad hover:text-white']].map(([ch, Icon, hov]) => (
        <button key={ch} onClick={() => invoke(ch)} aria-label={ch.slice(4)} className={cx('w-10 h-8 flex items-center justify-center text-muted rounded-full transition-colors', hov)}>
          <Icon size={ch === 'win:maximize' ? 12 : 15} />
        </button>
      ))}
    </div>
  )
}

// Floating glass dock: the six sections, with a spring pill under the active one.
function Dock({ section, onSection }) {
  const reduce = useReducedMotion()
  return (
    <nav className='glass-strong flex items-center gap-0.5 p-1 rounded-full'>
      {SECTIONS.map(s => {
        const on = section === s.id
        return (
          <button key={s.id} onClick={() => onSection(s.id)} title={s.label}
            className={cx('relative h-9 px-3.5 rounded-full flex items-center gap-2 text-[13px] font-semibold transition-colors duration-200', on ? 'text-text' : 'text-muted hover:text-text')}>
            {on && <m.span layoutId='dock-pill' className='accent-soft absolute inset-0 rounded-full' transition={reduce ? { duration: 0 } : SPRING} />}
            <s.icon className={cx('relative shrink-0', on && 'text-accent')} size={15} />
            <span className='relative max-[1200px]:hidden'>{s.label}</span>
          </button>
        )
      })}
    </nav>
  )
}

function Brand() {
  const riot = useRiot()
  return (
    <div className='flex items-center gap-3 min-w-0'>
      <img src={logo} alt='' className='w-8 h-8 rounded-[10px] shadow-[0_6px_18px_-6px_rgb(var(--accent)/0.6)]' draggable={false} />
      <div className='min-w-0 leading-none'>
        <div className='font-brand text-[13px] text-text'>Spectre</div>
        <div className='mt-1 flex items-center gap-1.5 text-[11px] text-muted truncate max-[1200px]:hidden'>
          <span className={cx('w-1.5 h-1.5 rounded-full shrink-0', riot.connected ? 'bg-good shadow-[0_0_8px_rgb(var(--good))]' : 'bg-warn anim-pulse')} />
          <span className='truncate max-w-[160px]'>{riot.connected ? `${riot.gameName} #${riot.tagLine}` : 'Waiting for Riot Client'}</span>
        </div>
      </div>
    </div>
  )
}

// Right side of the second row: palette trigger + utility pages.
function Utilities({ page, onOpen, onPalette }) {
  const reduce = useReducedMotion()
  return (
    <div className='flex items-center gap-2'>
      <button onClick={onPalette} title='Search (Ctrl+K)'
        className='glass h-9 pl-3 pr-1.5 rounded-full flex items-center gap-2 text-[12px] text-muted hover:text-text transition-colors'>
        <FiSearch size={14} /><span className='max-[1200px]:hidden'>Search</span><span className='kbd max-[1200px]:hidden'>Ctrl K</span>
      </button>
      <div className='glass flex items-center gap-0.5 p-1 rounded-full'>
        {UTILITY.map(u => {
          const on = page === u.id
          return (
            <button key={u.id} onClick={() => onOpen(u.id)} title={u.label} aria-label={u.label}
              className={cx('relative w-8 h-7 rounded-full flex items-center justify-center transition-colors', on ? 'text-accent' : 'text-muted hover:text-text')}>
              {on && <m.span layoutId='util-pill' className='accent-soft absolute inset-0 rounded-full' transition={reduce ? { duration: 0 } : SPRING} />}
              <u.icon className='relative' size={14} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Page context per section (stable objects so pages do not re-render on every shell render).
const CONTEXTS = Object.fromEntries(Object.values(PAGES).map(p => {
  const s = p.section && SECTIONS.find(x => x.id === p.section)
  return [p.id, { section: s ? s.label : null, embedded: false }]
}))

// Experimental tool ids open Settings > Experimental focused on that tool; unknown ids fall back to Home.
function resolve(page, params) {
  if (EXPERIMENTAL_IDS.has(page)) return ['settings', { tab: 'experimental', tool: page }]
  if (!PAGES[page]) return ['dashboard', {}]
  return [page, params || {}]
}

function Shell() {
  const [page, setPage] = useState('dashboard')
  const [params, setParams] = useState({})
  const [palette, setPalette] = useState(false)
  const [visited] = useState(() => new Set())
  const lastInSection = useRef({})
  visited.add(page)
  const section = sectionOf(page)
  if (section) lastInSection.current[section.id] = page

  const go = useCallback((id, p) => {
    const [to, prm] = resolve(id, p)
    setPage(to)
    setParams(x => ({ ...x, [to]: prm }))
  }, [])

  useEffect(() => {
    invoke('settings:get').then(s => s?.startPage && go(s.startPage)).catch(() => { })
  }, [go])

  useEffect(() => {
    const onNav = e => go(e.detail.page, e.detail.params)
    window.addEventListener('spectre:navigate', onNav)
    return () => window.removeEventListener('spectre:navigate', onNav)
  }, [go])

  useEffect(() => {
    const onKey = e => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && e.key.toLowerCase() === 'k') { e.preventDefault(); setPalette(o => !o) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const openSection = id => {
    const s = SECTIONS.find(x => x.id === id)
    go(lastInSection.current[id] || s.pages[0].id)
  }

  const items = useMemo(() => [
    ...SECTIONS.flatMap(s => s.pages.map(p => ({ id: 'p:' + p.id, label: p.label === s.label ? s.label : p.label, hint: s.pages.length > 1 ? s.label : '', group: 'Go to', icon: p.icon, keywords: s.label, run: () => go(p.id) }))),
    ...UTILITY.map(u => ({ id: 'p:' + u.id, label: u.label, group: 'App', icon: u.icon, run: () => go(u.id) })),
    ...SETTINGS_TABS.filter(t => t.value !== 'experimental').map(t => ({ id: 's:' + t.value, label: `Settings: ${t.label}`, group: 'Settings', icon: t.icon, keywords: 'preferences', run: () => go('settings', { tab: t.value }) })),
    { id: 'a:motion', label: 'Toggle reduce motion', group: 'Actions', icon: FiFeather, keywords: 'animation accessibility', run: () => { const v = !getReduceMotion(); setReduceMotion(v); toast(v ? 'Reduced motion on' : 'Reduced motion off') } },
    ...THEMES.map(t => ({ id: 't:' + t.id, label: `Theme: ${t.name}`, group: 'Themes', icon: FiDroplet, keywords: 'color appearance', run: () => setTheme(t.id) })),
  ], [go])

  const sub = section && section.pages.length > 1 ? section : null
  return (
    <div className='h-full flex flex-col relative'>
      <div className='backdrop' aria-hidden='true'><div className='backdrop-fields' /></div>

      {/* Row 1: brand, dock, update + window controls. The bar itself is the window drag region. */}
      <header data-tauri-drag-region className='drag relative z-20 h-16 shrink-0 flex items-center justify-between pl-5 pr-2'>
        <Brand />
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
          <Dock section={section?.id} onSection={openSection} />
        </div>
        <div className='flex items-center'>
          <UpdateButton />
          <WindowControls />
        </div>
      </header>

      {/* Row 2: section sub-tabs (centered), search + utility pages (right). */}
      <div data-tauri-drag-region className='drag relative z-20 h-12 shrink-0 flex items-center justify-end px-5'>
        <div className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2'>
          <AnimatePresence mode='wait' initial={false}>
            {sub && (
              <m.div key={sub.id} initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }} transition={{ duration: 0.16 }}>
                <SegmentedTabs size='sm' layoutId={'sub-' + sub.id} value={page} onChange={go}
                  tabs={sub.pages.map(p => ({ value: p.id, label: p.label, icon: p.icon }))} />
              </m.div>
            )}
          </AnimatePresence>
        </div>
        <Utilities page={page} onOpen={go} onPalette={() => setPalette(true)} />
      </div>

      <main className='flex-1 relative min-h-0 z-10'>
        {Object.values(PAGES).map(p => visited.has(p.id) && (
          <PageContext.Provider key={p.id} value={CONTEXTS[p.id]}>
            <PageTransition active={page === p.id} className='absolute inset-0'>
              <p.component params={params[p.id] || {}} active={page === p.id} />
            </PageTransition>
          </PageContext.Provider>
        ))}
      </main>

      <CommandPalette open={palette} onClose={() => setPalette(false)} items={items} />
    </div>
  )
}

export default function App() {
  useEffect(applySavedTheme, [])
  // The overlay window loads the same bundle.
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
