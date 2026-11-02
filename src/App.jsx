import { useEffect, useState } from 'react'
import { FiDownload, FiMinus, FiSquare, FiX } from 'react-icons/fi'
import { GROUPS, PAGES, STRATEGIES, navigate } from './nav'
import { invoke, openExternal, useEvent } from './lib/ipc'
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
        className='h-7 mr-2 px-3 rounded-md text-xs font-semibold flex items-center gap-1.5 bg-accent text-bg hover:opacity-90 disabled:opacity-80 transition-opacity'>
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
    <div className='drag h-11 shrink-0 flex items-center justify-between border-b border-line bg-bg pl-4 pr-1'>
      <div className='flex items-center gap-1 p-1 rounded-lg bg-surface border border-line'>
        {[{ id: 'home', label: 'Home' }, { id: 'strategies', label: 'Tactics' }].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            className={cx('h-7 px-3 rounded-md text-xs font-semibold transition-all duration-200',
              tab === t.id ? 'bg-surface-2 text-text border border-line' : 'text-muted hover:text-text border border-transparent')}>
            {t.label}
          </button>
        ))}
      </div>
      <div className='flex items-center'>
        <UpdateButton />
        {[['win:minimize', FiMinus, 'hover:bg-surface-2'], ['win:maximize', FiSquare, 'hover:bg-surface-2'], ['win:close', FiX, 'hover:bg-accent hover:text-bg']].map(([ch, Icon, hov]) => (
          <button key={ch} onClick={() => invoke(ch)} className={cx('w-11 h-9 flex items-center justify-center text-muted rounded-md transition-colors', hov)}>
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
    <aside className='w-[220px] shrink-0 flex flex-col border-r border-line bg-bg'>
      <div className='px-5 pt-5 pb-4 flex items-center gap-2.5'>
        <img src={logo} alt='' className='w-8 h-8' draggable={false} />
        <div>
          <div className='font-display text-lg font-bold leading-none tracking-widest'>SPECTRE</div>
        </div>
      </div>
      <nav className='flex-1 overflow-y-auto px-3 pb-3'>
        {GROUPS.map(g => (
          <div key={g.label} className='mb-3'>
            <div className='px-2.5 pb-1.5 pt-2 text-[10px] font-semibold tracking-[0.2em] uppercase text-muted/70'>{g.label}</div>
            {g.pages.map(p => {
              const active = page === p.id
              return (
                <button key={p.id} onClick={() => setPage(p.id)}
                  className={cx('group relative w-full flex items-center gap-3 h-9 px-2.5 rounded-lg text-[13px] font-medium transition-all duration-150',
                    active ? 'bg-surface-2 text-text' : 'text-muted hover:text-text hover:bg-surface')}>
                  <span className={cx('absolute left-0 top-2 bottom-2 w-[3px] rounded-full bg-accent transition-all duration-200', active ? 'opacity-100' : 'opacity-0 scale-y-0')} />
                  <p.icon className={cx('shrink-0 transition-colors', active ? 'text-accent' : 'group-hover:text-text')} size={15} />
                  {p.label}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
      <div className='m-3 p-3 rounded-xl border border-line bg-surface flex items-center gap-3'>
        <span className={cx('w-2 h-2 rounded-full shrink-0', riot.connected ? 'bg-good' : 'bg-warn anim-pulse')} />
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
    <div className='h-full flex flex-col'>
      <TitleBar tab={tab} setTab={setTab} />
      <div className='flex-1 flex min-h-0 relative'>
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
  // The overlay window loads the same bundle with #/overlay.
  const isOverlay = window.location.hash === '#/overlay'
  return (
    <RiotProvider>
      {isOverlay ? <Overlay /> : <Shell />}
      <ToastHost />
    </RiotProvider>
  )
}
