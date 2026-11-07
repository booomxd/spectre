import { useEffect, useRef, useState } from 'react'
import { FiDownload, FiExternalLink, FiFolder, FiMonitor, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { Badge, Button, Card, Label, Modal, SectionTitle, Select, Skeleton, Toggle, withToast } from '../../ui'
import { invoke, openExternal, useEvent, useInvoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'

const START_PAGES = [
  ['dashboard', 'Home'], ['live', 'Live Match'],
  ['progression', 'Career: Progression'], ['history', 'Career: Matches'], ['activity', 'Career: Encounters'], ['leaderboard', 'Career: Leaderboard'],
  ['friends', 'Squad: Friends'], ['friendlog', 'Squad: Feed'], ['memo', 'Squad: Notes'], ['search', 'Squad: Lookup'],
  ['loadout', 'Arsenal: Loadout'], ['shop', 'Arsenal: Store'], ['weapons', 'Arsenal: Weapons'],
  ['strategies', 'Playbook'], ['discord', 'Discord'], ['patchnotes', "What's new"], ['settings', 'Settings'],
].map(([value, label]) => ({ value, label }))

const Row = ({ children }) => <div className='py-4 first:pt-0 last:pb-0 border-b border-line last:border-0'>{children}</div>

// Slider that only saves when released, so dragging does not spam the store.
function Slider({ label, value, min, max, step, onCommit, format }) {
  const [v, setV] = useState(null)
  const shown = v ?? value
  const commit = () => { if (v != null) { onCommit(v); setV(null) } }
  return (
    <div>
      <div className='flex items-center justify-between mb-2'>
        <span className='text-[13px] text-text'>{label}</span>
        <span className='accent-soft h-6 px-2.5 rounded-full inline-flex items-center font-display text-[12px] font-semibold text-accent tabular-nums'>{format(shown)}</span>
      </div>
      <input type='range' min={min} max={max} step={step} value={shown} style={{ accentColor: 'rgb(var(--accent))' }}
        className='w-full h-1.5 cursor-pointer' onChange={e => setV(+e.target.value)} onMouseUp={commit} onKeyUp={commit} onTouchEnd={commit} />
    </div>
  )
}

export function General({ settings, save }) {
  return (
    <section>
      <SectionTitle>General</SectionTitle>
      <Card className='p-5 rounded-2xl'>
        <Row><Toggle checked={settings.launchAtLogin} onChange={v => save({ launchAtLogin: v })} label='Launch at login' hint='Start Spectre when you sign in to Windows' /></Row>
        <Row><Toggle checked={settings.minimizeToTray} onChange={v => save({ minimizeToTray: v })} label='Minimize to tray' hint='Keep running in the background when minimized' /></Row>
        <Row><Toggle checked={settings.spectrePresence !== false} onChange={v => save({ spectrePresence: v })} label='Show that I use Spectre' hint='Adds a small marker to your Riot presence so friends using Spectre can see you use it' /></Row>
        <Row>
          <Label hint='The page Spectre opens on'>Start page</Label>
          <Select className='max-w-xs' value={settings.startPage} options={START_PAGES} onChange={e => save({ startPage: e.target.value })} />
        </Row>
      </Card>
    </section>
  )
}

// KeyboardEvent.code -> global-shortcut accelerator key.
const CODE_KEYS = {
  Space: 'Space', Enter: 'Return', Tab: 'Tab', ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
  Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown', Insert: 'Insert', Delete: 'Delete', Backquote: '`',
  Minus: '-', Equal: '=', BracketLeft: '[', BracketRight: ']', Backslash: '\\', Semicolon: ';', Quote: "'", Comma: ',', Period: '.', Slash: '/',
}
function acceleratorKey(code) {
  if (/^Key[A-Z]$/.test(code)) return code.slice(3)
  if (/^Digit\d$/.test(code)) return code.slice(5)
  if (/^F\d{1,2}$/.test(code)) return code
  if (/^Numpad\d$/.test(code)) return 'num' + code.slice(6)
  return CODE_KEYS[code] || null
}

// Click, then press a combo. Needs Ctrl, Alt or Shift (F-keys work alone) so normal typing never triggers it.
// Esc cancels, Backspace clears. Global hotkeys are paused while recording so the current combo can be re-used.
function Keybind({ value, onChange, ok }) {
  const [rec, setRec] = useState(false)
  const change = useRef(onChange)
  change.current = onChange
  useEffect(() => {
    if (!rec) return
    invoke('overlay:pauseHotkeys', true).catch(() => { })
    const onKey = e => {
      e.preventDefault(); e.stopPropagation()
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean)
      if (e.key === 'Escape' && !mods.length) { setRec(false); return }
      if (e.key === 'Backspace' && !mods.length) { change.current(''); setRec(false); return }
      const key = acceleratorKey(e.code)
      if (!key || (!mods.length && !/^F\d+$/.test(key))) return
      change.current([...mods, key].join('+')); setRec(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => { window.removeEventListener('keydown', onKey, true); invoke('overlay:pauseHotkeys', false).catch(() => { }) }
  }, [rec])
  return (
    <div className='flex items-center gap-2 shrink-0'>
      {ok === false && !rec && <span className='text-[11px] text-bad'>In use by another app</span>}
      <button onClick={() => setRec(r => !r)} onBlur={() => setRec(false)}
        className={'min-w-[160px] h-9 px-3.5 rounded-full text-[12px] font-semibold flex items-center justify-center gap-1 transition duration-200 ' +
          (rec ? 'accent-soft border border-transparent text-accent anim-pulse' : 'glass-field text-text hover:border-accent/40')}>
        {rec ? 'Press keys... (Esc to cancel)' : value
          ? value.split('+').map(k => <kbd key={k} className='min-w-[22px] px-1.5 py-0.5 rounded-md border border-line bg-surface-2 text-text font-sans text-[11px] text-center'>{k}</kbd>)
          : <span className='text-muted'>Not set</span>}
      </button>
    </div>
  )
}

export function Overlay({ settings, save }) {
  const o = settings.overlay
  const [hotkeys, setHotkeys] = useState({})
  useEffect(() => { invoke('overlay:hotkeys').then(setHotkeys).catch(() => { }) }, [])
  useEvent('overlay:hotkeys', setHotkeys)
  const set = patch => save({ overlay: patch })
  return (
    <section>
      <SectionTitle right={<Button size='sm' icon={FiMonitor} onClick={() => withToast(invoke('overlay:toggle'))}>Show / hide</Button>}>Overlay</SectionTitle>
      <Card className='p-5 rounded-2xl'>
        <Row>
          <div className='flex items-center justify-between gap-4'>
            <Label hint='Show or hide the overlay from anywhere, even in game. Backspace while recording clears it.'>Toggle overlay</Label>
            <Keybind value={o.hotkey} ok={hotkeys.toggle?.ok} onChange={v => set({ hotkey: v })} />
          </div>
        </Row>
        <Row>
          <div className='flex items-center justify-between gap-4'>
            <Label hint='Lock the overlay so clicks pass through to the game, or unlock it to move and resize it.'>Lock / unlock</Label>
            <Keybind value={o.lockHotkey} ok={hotkeys.lock?.ok} onChange={v => set({ lockHotkey: v })} />
          </div>
        </Row>
        <Row><Toggle checked={!!o.autoShow} onChange={v => set({ autoShow: v })} label='Show automatically during matches' hint='Opens at agent select and hides again back in the menus' /></Row>
        <Row><Toggle checked={!!o.locked} onChange={v => set({ locked: v })} label='Click-through' hint='Clicks go to the game instead of the overlay. Use the lock hotkey to unlock it in game.' /></Row>
        <Row><Toggle checked={o.showPeak !== false} onChange={v => set({ showPeak: v })} label='Show peak rank' hint='A small peak icon next to players whose peak is above their current rank' /></Row>
        <Row>
          <div className='grid gap-5 sm:grid-cols-2'>
            <Slider label='Opacity' min={0.3} max={1} step={0.05} value={o.opacity} format={v => Math.round(v * 100) + '%'} onCommit={v => set({ opacity: v })} />
            <Slider label='Scale' min={0.7} max={1.5} step={0.05} value={o.scale} format={v => v.toFixed(2) + 'x'} onCommit={v => set({ scale: v })} />
          </div>
        </Row>
        <p className='text-[11px] text-muted mt-4 leading-relaxed'>The overlay shows over VALORANT in <b className='text-text font-semibold'>Windowed fullscreen</b>. Exclusive fullscreen draws over everything, overlays included.</p>
      </Card>
    </section>
  )
}

export function Connection() {
  const riot = useRiot()
  const [busy, setBusy] = useState(false)
  const reconnect = async () => { setBusy(true); await withToast(invoke('riot:connect'), 'Connected to the Riot Client'); setBusy(false) }
  const cell = (k, v) => (
    <div>
      <div className='text-[12px] font-semibold text-muted'>{k}</div>
      <div className='font-display text-xl font-bold tracking-tight uppercase mt-0.5'>{v || '-'}</div>
    </div>
  )
  return (
    <section>
      <SectionTitle right={<Badge tone={riot.connected ? 'good' : 'bad'}>{riot.connected ? 'Connected' : 'Offline'}</Badge>}>Connection</SectionTitle>
      <Card className='p-5 rounded-2xl flex flex-wrap items-center gap-x-10 gap-y-4'>
        <span className={'w-3 h-3 rounded-full ring-4 ' + (riot.connected ? 'bg-good ring-good/20 shadow-[0_0_12px_rgb(var(--good)/0.7)] anim-pulse' : 'bg-bad ring-bad/20')} />
        {cell('Region', riot.region)}
        {cell('Shard', riot.shard)}
        <div className='min-w-0'>
          <div className='text-[12px] font-semibold text-muted'>Client version</div>
          <div className='text-[13px] text-text truncate max-w-[280px] mt-1 tabular-nums'>{riot.clientVersion || '-'}</div>
        </div>
        <Button className='ml-auto' icon={FiRefreshCw} loading={busy} onClick={reconnect}>Reconnect</Button>
      </Card>
    </section>
  )
}

export function Data() {
  const info = useInvoke('app:info')
  const [confirm, setConfirm] = useState(false)
  const clear = async () => { await withToast(invoke('app:clearCache'), 'Cache cleared'); setConfirm(false) }
  return (
    <section>
      <SectionTitle>Data</SectionTitle>
      <Card className='p-5 rounded-2xl'>
        <Row>
          <div className='flex items-center justify-between gap-4'>
            <div className='min-w-0'>
              <div className='text-[13px] text-text'>Data folder</div>
              <div className='text-[11px] text-muted truncate mt-0.5'>{info.data?.dataPath || '...'}</div>
            </div>
            <Button icon={FiFolder} onClick={() => withToast(invoke('app:openDataFolder'))}>Open</Button>
          </div>
        </Row>
        <Row>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <div className='text-[13px] text-text'>Cached data</div>
              <div className='text-[11px] text-muted mt-0.5'>Clears the browser cache. Settings, notes and presets are kept.</div>
            </div>
            <Button variant='danger' icon={FiTrash2} onClick={() => setConfirm(true)}>Clear cache</Button>
          </div>
        </Row>
      </Card>
      <Modal open={confirm} onClose={() => setConfirm(false)} title='Clear cache?' width={400}
        footer={<><Button variant='ghost' onClick={() => setConfirm(false)}>Cancel</Button><Button variant='danger' onClick={clear}>Clear</Button></>}>
        <p className='text-[13px] text-muted'>Cached images and content will be downloaded again the next time they are needed.</p>
      </Modal>
    </section>
  )
}

const LINKS = [
  ['valorant-api.com', 'https://valorant-api.com'],
  ['VALORANT website', 'https://playvalorant.com'],
]

// Manual update check. Spectre also checks on launch and every 6 hours; installing works like the title-bar button.
function Updates() {
  const [s, setS] = useState(null)
  const [busy, setBusy] = useState(false)
  const [pct, setPct] = useState(null)
  useEffect(() => { invoke('update:status').then(setS).catch(() => { }) }, [])
  useEvent('update:status', setS)
  useEvent('update:progress', p => setPct(p.pct ?? 0))
  const check = async () => {
    setBusy(true)
    const r = await withToast(invoke('update:check'))
    if (r) setS(r)
    setBusy(false)
  }
  const install = async () => {
    if (!s.canInstall) return openExternal(s.url)
    setPct(0)
    if (!await withToast(invoke('update:install'))) setPct(null)
  }
  const text = pct != null ? `Updating... ${pct}%`
    : !s ? 'Spectre checks for updates on launch and every 6 hours.'
      : s.available ? `Spectre ${s.latest} is available. You're on ${s.current}.`
        : `You're up to date (${s.current}).`
  return (
    <div className='glass mt-5 flex items-center gap-3 flex-wrap rounded-xl px-5 py-4'>
      <div className='min-w-0 flex-1'>
        <div className='text-[13px] font-semibold text-text'>Updates</div>
        <div className={`text-[11px] mt-0.5 ${s?.available ? 'text-accent' : 'text-muted'}`}>{text}</div>
      </div>
      {s?.available && <Button size='sm' variant='primary' icon={FiDownload} loading={pct != null} onClick={install}>{s.canInstall ? 'Update now' : 'Download'}</Button>}
      <Button size='sm' icon={FiRefreshCw} loading={busy} disabled={pct != null} onClick={check}>Check for updates</Button>
    </div>
  )
}
export function About() {
  const info = useInvoke('app:info')
  return (
    <section>
      <SectionTitle>About</SectionTitle>
      <Card className='p-5 rounded-2xl'>
        <div className='flex items-center justify-between gap-4 flex-wrap'>
          <div>
            <div className='font-display text-[24px] font-bold tracking-tight leading-none'>Spectre <span className='text-accent'>{info.data?.version?.split('.').slice(0, 2).join('.') || ''}</span></div>
            <div className='text-[12px] text-muted mt-2 tabular-nums'>
              {info.loading ? <Skeleton className='h-3 w-24' /> : `Version ${info.data?.version || '-'}${info.data?.tauri ? ` · Tauri ${info.data.tauri}` : ''}`}
            </div>
          </div>
          <div className='flex flex-wrap gap-2'>
            {LINKS.map(([l, u]) => <Button key={u} size='sm' icon={FiExternalLink} onClick={() => openExternal(u)}>{l}</Button>)}
          </div>
        </div>

        <Updates />

        <p className='text-[13px] text-text/90 mt-5 leading-relaxed'>
          A desktop app for VALORANT players: store, friends, live match details, match history, progression, loadouts and tactics, in one place.
        </p>

        <div className='grid sm:grid-cols-3 gap-4 mt-5'>
          {[
            ['Private by design', 'Notes, playbooks, presets and settings are stored only on this PC. No accounts, analytics or tracking.'],
            ['Uses your Riot Client', 'Signs in through the Riot Client already running on your PC. Your password is never asked for or stored.'],
            ['Free & non-commercial', 'A personal project shared with friends. Not for sale.'],
          ].map(([t, d]) => (
            <div key={t} className='glass rounded-xl p-4'>
              <div className='text-[13px] font-semibold text-text'>{t}</div>
              <div className='text-[11px] text-muted mt-1.5 leading-relaxed'>{d}</div>
            </div>
          ))}
        </div>

        <div className='border-t border-line mt-5 pt-4 grid gap-1.5 text-[11px] text-muted/80 leading-relaxed'>
          <p>Game data and imagery courtesy of valorant-api.com.</p>
          <p>Spectre isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
          <p>Third-party tools are used at your own risk.</p>
        </div>
      </Card>
    </section>
  )
}
