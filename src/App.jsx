import { useEffect, useState } from 'react'
import { FiDownload, FiMinus, FiSquare, FiX } from 'react-icons/fi'
import { GROUPS, PAGES, STRATEGIES, navigate } from './nav'
import { invoke, isOverlayWindow, openExternal, useEvent } from './lib/ipc'
import { RiotProvider, useRiot } from './lib/riot'
import { applySavedTheme } from './lib/theme'
import logo from './assets/spectre-logo.svg'
import { Button, Modal, ToastHost, toast } from './ui'
import Overlay from './pages/Overlay'

const cx = (...c) => c.filter(Boolean).join(' ')

// New-release prompt: a dialog once per version, then an Update button that stays in the title bar.
// Installed copies update in place; portable copies open the release page to download.
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
        className='accent-fill h-7 mr-2 px-3.5 rounded-full text-xs font-semibold flex items-center gap-1.5 text-bg hover:brightness-110 disabled:opacity-80 transition-[filter,opacity]'>
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

function TitleBar({ tab, setTab }) {
  return (
    <div data-tauri-drag-region className='drag h-12 shrink-0 flex items-center justify-between pl-3 pr-1.5'>
      <div className='glass flex items-center gap-0.5 p-1 rounded-full'>
        {[{ id: 'home', label: 'Home' }, { id: 'strategies', label: 'Tactics' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx('h-7 px-4 rounded-full text-xs font-semibold transition-all duration-200',
              tab === t.id ? 'accent-soft text-text' : 'text-muted hover:text-text')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className='flex items-center gap-0.5'>
        <UpdateButton />
        {[['win:minimize', FiMinus, 'hover:bg-surface-2 hover:text-text'], ['win:maximize', FiSquare, 'hover:bg-surface-2 hover:text-text'], ['win:close', FiX, 'hover:bg-bad hover:text-white']].map(([ch, Icon, hov]) => (
          <button key={ch} onClick={() => invoke(ch)} className={cx('w-10 h-8 flex items-center justify-center text-muted rounded-full transition-colors', hov)}>
            <Icon size={ch === 'win:maximize' ? 12 : 15} />
          </button>
        ))}
      </div>
    </div>
  )
}

function Sidebar({ page, setPage }) {
  const riot = useRiot()
  return (
    <aside className='glass-strong w-[220px] shrink-0 flex flex-col ml-3 mb-3 rounded-2xl overflow-hidden'>
      <div className='px-4 pt-4 pb-3 flex items-center gap-2.5'>
        <img src={logo} alt='' className='w-8 h-8 rounded-[10px] shadow-[0_6px_18px_-6px_rgb(var(--accent)/0.6)]' draggable={false} />
        <div className='font-brand text-lg font-bold leading-none'>SPECTRE</div>
      </div>
      <nav className='flex-1 overflow-y-auto px-2.5 pb-2'>
        {GROUPS.map(g => (
          <div key={g.label} className='mb-2.5'>
            <div className='px-2.5 pb-1 pt-2 text-[11px] font-semibold text-muted/70'>{g.label}</div>
            {g.pages.map(p => {
              const active = page === p.id
              return (
                <button key={p.id} onClick={() => setPage(p.id)}
                  className={cx('group relative w-full flex items-center gap-3 h-9 px-2.5 rounded-[10px] text-[13px] font-medium transition-all duration-200',
                    active ? 'accent-soft text-text' : 'text-muted hover:text-text hover:bg-surface-2')}>
                  <p.icon className={cx('shrink-0 transition-colors', active ? 'text-accent' : 'group-hover:text-text')} size={15} />
                  {p.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div className='glass m-2.5 p-3 rounded-xl flex items-center gap-3'>
        <span className={cx('w-2 h-2 rounded-full shrink-0', riot.connected ? 'bg-good shadow-[0_0_10px_rgb(var(--good))]' : 'bg-warn anim-pulse')} />
        <div className='min-w-0'>
          <div className='text-[13px] font-semibold truncate'>{riot.connected ? riot.gameName : 'Not connected'}</div>
          <div className='text-[11px] text-muted truncate'>{riot.connected ? `#${riot.tagLine} · ${String(riot.shard).toUpperCase()}` : 'Waiting for Riot Client'}</div>
        </div>
      </div>
    </aside>
  )
}

// Keeps a page mounted after its first visit and only hides it, so its state survives navigation.
function KeepAlive({ id, active, visited, children }) {
  if (!visited.has(id)) return null
  return <div className={cx('absolute inset-0', active ? 'anim-page' : 'hidden')}>{children}</div>
}

function Shell() {
  const [tab, setTab] = useState('home')
  const [page, setPage] = useState('dashboard')
  const [params, setParams] = useState({})
  const [visited] = useState(() => new Set())
  visited.add(page)

  useEffect(() => {
    invoke('settings:get').then(s => s?.startPage && PAGES[s.startPage] && setPage(s.startPage)).catch(() => { })
  }, [])

  useEffect(() => {
    const onNav = e => {
      setTab('home')
      setPage(e.detail.page)
      setParams(p => ({ ...p, [e.detail.page]: e.detail.params || {} }))
    }
    window.addEventListener('spectre:navigate', onNav)
    return () => window.removeEventListener('spectre:navigate', onNav)
  }, [])

  const Strat = STRATEGIES.component
  return (
    <div className='h-full flex flex-col relative'>
      <div className='backdrop' aria-hidden='true'><div className='orb orb-1' /><div className='orb orb-2' /><div className='orb orb-3' /></div>
      <div className='relative z-10'><TitleBar tab={tab} setTab={setTab} /></div>
      <div className='flex-1 flex min-h-0 relative z-10'>
        <div className={cx('flex-1 flex min-h-0', tab !== 'home' && 'hidden')}>
          <Sidebar page={page} setPage={setPage} />
          <main className='flex-1 relative min-w-0'>
            {Object.values(PAGES).map(p => (
              <KeepAlive key={p.id} id={p.id} active={page === p.id} visited={visited}>
                <p.component params={params[p.id] || {}} active={tab === 'home' && page === p.id} />
              </KeepAlive>
            ))}
          </main>
        </div>
        <div className={cx('flex-1 min-h-0', tab !== 'strategies' ? 'hidden' : 'anim-page')}>
          <Strat active={tab === 'strategies'} />
        </div>
      </div>
    </div>
  )
}

export default function App() {
  useEffect(applySavedTheme, [])
  // The overlay window loads the same bundle.
  const isOverlay = isOverlayWindow()
  return (
    <RiotProvider>
      {isOverlay ? <Overlay /> : <Shell />}
      <ToastHost />
    </RiotProvider>
  )
}
