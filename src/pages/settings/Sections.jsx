import { For, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiDownload, FiExternalLink, FiFolder, FiMonitor, FiRefreshCw, FiTrash2 } from 'solid-icons/fi'
import { Badge, Button, Card, Label, Modal, SectionTitle, Select, Skeleton, Toggle, withToast } from '../../ui'
import { invoke, openExternal, useEvent, useInvoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'

const START_PAGES = [
  ['last', 'Where I left off'], ['dashboard', 'Home'], ['live', 'Live Match'],
  ['progression', 'Career: Progression'], ['history', 'Career: Matches'], ['activity', 'Career: Encounters'], ['leaderboard', 'Career: Leaderboard'],
  ['friends', 'Squad: Friends'], ['friendlog', 'Squad: Feed'], ['memo', 'Squad: Notes'], ['search', 'Squad: Lookup'],
  ['loadout', 'Arsenal: Loadout'], ['shop', 'Arsenal: Store'], ['weapons', 'Arsenal: Weapons'],
  ['strategies', 'Playbook'], ['discord', 'Discord'], ['patchnotes', "What's new"], ['settings', 'Settings'],
].map(([value, label]) => ({ value, label }))

const Row = (props) => <div class='py-4 first:pt-0 last:pb-0 border-b border-line last:border-0'>{props.children}</div>

// slider that only saves when released
function Slider(props) {
  const [vS, setV] = createSignal(null)
  
    const shown = () => (vS() ?? props.value)
    const commit = () => { if (vS() != null) { props.onCommit(vS()); setV(null) } }
    return (<div>
      <div class='flex items-center justify-between mb-2'>
        <span class='text-[13px] text-text'>{props.label}</span>
        <span class='accent-soft h-6 px-2.5 rounded-full inline-flex items-center font-display text-[12px] font-semibold text-accent tabular-nums'>{props.format(shown())}</span>
      </div>
      <input type='range' min={props.min} max={props.max} step={props.step} value={shown()} style={st({ accentColor: 'rgb(var(--accent))' })}
        class='w-full h-1.5 cursor-pointer' onChange={e => setV(+e.target.value)} onMouseUp={commit} onKeyUp={commit} onTouchEnd={commit} />
    </div>)
  
}

export function General(props) {
  return (
    <section>
      <SectionTitle>General</SectionTitle>
      <Card class='p-6 rounded-2xl'>
        <Row><Toggle checked={props.settings.launchAtLogin} onChange={v => props.save({ launchAtLogin: v })} label='Launch at login' hint='Start Spectre in the tray when you sign in to Windows' /></Row>
        <Row><Toggle checked={props.settings.closeToTray !== false} onChange={v => props.save({ closeToTray: v })} label='Close to tray' hint='The close button keeps Spectre running in the hidden icons; use Quit in its tray menu to exit' /></Row>
        <Row><Toggle checked={props.settings.minimizeToTray} onChange={v => props.save({ minimizeToTray: v })} label='Minimize to tray' hint='Keep running in the background when minimized' /></Row>
        <Row><Toggle checked={props.settings.wishlistAlerts !== false} onChange={v => props.save({ wishlistAlerts: v })} label='Wishlist alerts' hint='A Windows notification when a skin on your wishlist is in your store' /></Row>
        <Row><Toggle checked={props.settings.sessionAlerts !== false} onChange={v => props.save({ sessionAlerts: v })} label='Session summary' hint='When you close VALORANT, a notification with your games, wins, losses and RR for that session' /></Row>
        <Row>
          <Label hint='The page Spectre opens on'>Start page</Label>
          <Select class='max-w-xs' value={props.settings.startPage} options={START_PAGES} onChange={e => props.save({ startPage: e.target.value })} />
        </Row>
      </Card>
    </section>
  )
}

// KeyboardEvent.code -> global-shortcut accelerator key
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

// click, then press a combo
function Keybind(props) {
  const [recS, setRec] = createSignal(false)
  const change = { current: props.onChange }
  createEffect(on(() => [recS()], () => {
    if (!recS()) return
    invoke('overlay:pauseHotkeys', true).catch(() => { })
    const onKey = e => {
      e.preventDefault(); e.stopPropagation()
      const mods = [e.ctrlKey && 'Ctrl', e.altKey && 'Alt', e.shiftKey && 'Shift'].filter(Boolean)
      if (e.key === 'Escape' && !mods.length) { setRec(false); return }
      if (e.key === 'Backspace' && !mods.length) { change.current(''); setRec(false); return }
      const key = acceleratorKey(e.code)
      if (!key || (!mods.length && !/^F\d+$/.test(key))) return
      props.onChange([...mods, key].join('+')); setRec(false)
    }
    window.addEventListener('keydown', onKey, true)
    { onCleanup(() => { window.removeEventListener('keydown', onKey, true); invoke('overlay:pauseHotkeys', false).catch(() => { }) }); return }
  }))
  
    return (<div class='flex items-center gap-2 shrink-0'>
      {props.ok === false && !recS() && <span class='text-[11px] text-bad'>In use by another app</span>}
      <button onClick={() => setRec(r => !r)} onBlur={() => setRec(false)}
        class={'min-w-[160px] h-9 px-3.5 rounded-full text-[12px] font-semibold flex items-center justify-center gap-1 transition duration-200 ' +
          (recS() ? 'accent-soft border border-transparent text-accent anim-pulse' : 'glass-field text-text hover:border-accent/40')}>
        {recS() ? 'Press keys... (Esc to cancel)' : props.value
          ? props.value.split('+').map(k => <kbd class='min-w-[22px] px-1.5 py-0.5 rounded-md border border-line bg-surface-2 text-text font-sans text-[11px] text-center'>{k}</kbd>)
          : <span class='text-muted'>Not set</span>}
      </button>
    </div>)
  
}

export function Overlay(props) {
  const [hotkeysS, setHotkeys] = createSignal({})
  onMount(() => { invoke('overlay:hotkeys').then(setHotkeys).catch(() => { }) })
  useEvent('overlay:hotkeys', setHotkeys)
  
    const o = () => (props.settings.overlay)
    const set = patch => props.save({ overlay: patch })
    return (<section>
      <SectionTitle right={<Button size='sm' icon={FiMonitor} onClick={() => withToast(invoke('overlay:toggle'))}>Show / hide</Button>}>Overlay</SectionTitle>
      <Card class='p-6 rounded-2xl'>
        <Row>
          <div class='flex items-center justify-between gap-4'>
            <Label hint='Show or hide the overlay from anywhere, even in game. Backspace while recording clears it.'>Toggle overlay</Label>
            <Keybind value={o().hotkey} ok={hotkeysS().toggle?.ok} onChange={v => set({ hotkey: v })} />
          </div>
        </Row>
        <Row>
          <div class='flex items-center justify-between gap-4'>
            <Label hint='Lock the overlay so clicks pass through to the game, or unlock it to move and resize it.'>Lock / unlock</Label>
            <Keybind value={o().lockHotkey} ok={hotkeysS().lock?.ok} onChange={v => set({ lockHotkey: v })} />
          </div>
        </Row>
        <Row><Toggle checked={!!o().autoShow} onChange={v => set({ autoShow: v })} label='Show automatically during matches' hint='Opens at agent select and hides again back in the menus' /></Row>
        <Row><Toggle checked={!!o().locked} onChange={v => set({ locked: v })} label='Click-through' hint='Clicks go to the game instead of the overlay. Use the lock hotkey to unlock it in game.' /></Row>
        <Row><Toggle checked={o().showPeak !== false} onChange={v => set({ showPeak: v })} label='Show peak rank' hint='A small peak icon next to players whose peak is above their current rank' /></Row>
        <Row>
          <div class='grid gap-6 sm:grid-cols-2'>
            <Slider label='Opacity' min={0.3} max={1} step={0.05} value={o().opacity} format={v => Math.round(v * 100) + '%'} onCommit={v => set({ opacity: v })} />
            <Slider label='Scale' min={0.7} max={1.5} step={0.05} value={o().scale} format={v => v.toFixed(2) + 'x'} onCommit={v => set({ scale: v })} />
          </div>
        </Row>
        <p class='text-[11px] text-muted mt-4 leading-relaxed'>The overlay shows over VALORANT in <b class='text-text font-semibold'>Windowed fullscreen</b>. Exclusive fullscreen draws over everything, overlays included.</p>
      </Card>
    </section>)
  
}

export function Connection() {
  const riotA = useRiot()
  const [busyS, setBusy] = createSignal(false)
  
    const reconnect = async () => { setBusy(true); await withToast(invoke('riot:connect'), 'Connected to the Riot Client'); setBusy(false) }
    const cell = (k, v) => (
    <div>
      <div class='text-[12px] font-semibold text-muted'>{k}</div>
      <div class='font-display text-xl font-bold tracking-tight uppercase mt-0.5'>{v || '-'}</div>
    </div>
  )
    return (<section>
      <SectionTitle right={<Badge tone={riotA().connected ? 'good' : 'bad'}>{riotA().connected ? 'Connected' : 'Offline'}</Badge>}>Connection</SectionTitle>
      <Card class='p-6 rounded-2xl flex flex-wrap items-center gap-x-10 gap-y-4'>
        <span class={'w-3 h-3 rounded-full ring-4 ' + (riotA().connected ? 'bg-good ring-good/20 shadow-[0_0_12px_rgb(var(--good)/0.7)] anim-pulse' : 'bg-bad ring-bad/20')} />
        {cell('Region', riotA().region)}
        {cell('Shard', riotA().shard)}
        <div class='min-w-0'>
          <div class='text-[12px] font-semibold text-muted'>Client version</div>
          <div class='text-[13px] text-text truncate max-w-[280px] mt-1 tabular-nums'>{riotA().clientVersion || '-'}</div>
        </div>
        <Button class='ml-auto' icon={FiRefreshCw} loading={busyS()} onClick={reconnect}>Reconnect</Button>
      </Card>
    </section>)
  
}

export function Data() {
  const info = useInvoke('app:info')
  const [confirmS, setConfirm] = createSignal(false)
  
    const clear = async () => { await withToast(invoke('app:clearCache'), 'Cache cleared'); setConfirm(false) }
    return (<section>
      <SectionTitle>Data</SectionTitle>
      <Card class='p-6 rounded-2xl'>
        <Row>
          <div class='flex items-center justify-between gap-4'>
            <div class='min-w-0'>
              <div class='text-[13px] text-text'>Data folder</div>
              <div class='text-[11px] text-muted truncate mt-0.5'>{info.data?.dataPath || '...'}</div>
            </div>
            <Button icon={FiFolder} onClick={() => withToast(invoke('app:openDataFolder'))}>Open</Button>
          </div>
        </Row>
        <Row>
          <div class='flex items-center justify-between gap-4'>
            <div>
              <div class='text-[13px] text-text'>Cached data</div>
              <div class='text-[11px] text-muted mt-0.5'>Clears the browser cache. Settings, notes and presets are kept.</div>
            </div>
            <Button variant='danger' icon={FiTrash2} onClick={() => setConfirm(true)}>Clear cache</Button>
          </div>
        </Row>
      </Card>
      <Modal open={confirmS()} onClose={() => setConfirm(false)} title='Clear cache?' width={400}
        footer={<><Button variant='ghost' onClick={() => setConfirm(false)}>Cancel</Button><Button variant='danger' onClick={clear}>Clear</Button></>}>
        <p class='text-[13px] text-muted'>Cached images and content will be downloaded again the next time they are needed.</p>
      </Modal>
    </section>)
  
}

const LINKS = [
  ['valorant-api.com', 'https://valorant-api.com'],
  ['VALORANT website', 'https://playvalorant.com'],
]

// manual update check
function Updates() {
  const [sS, setS] = createSignal(null)
  const [busyS, setBusy] = createSignal(false)
  const [pctS, setPct] = createSignal(null)
  onMount(() => { invoke('update:status').then(setS).catch(() => { }) })
  useEvent('update:status', setS)
  useEvent('update:progress', p => setPct(p.pct ?? 0))
  
    const check = async () => {
    setBusy(true)
    const r = await withToast(invoke('update:check'))
    if (r) setS(r)
    setBusy(false)
  }
    const install = async () => {
    if (!sS().canInstall) return openExternal(sS().url)
    setPct(0)
    if (!await withToast(invoke('update:install'))) setPct(null)
  }
    const text = () => (pctS() != null ? `Updating... ${pctS()}%`
    : !sS() ? 'Spectre checks for updates on launch and every 6 hours.'
      : sS().available ? `Spectre ${sS().latest} is available. You're on ${sS().current}.`
        : `You're up to date (${sS().current}).`)
    return (<div class='glass mt-5 flex items-center gap-3 flex-wrap rounded-xl px-5 py-4'>
      <div class='min-w-0 flex-1'>
        <div class='text-[13px] font-semibold text-text'>Updates</div>
        <div class={`text-[11px] mt-0.5 ${sS()?.available ? 'text-accent' : 'text-muted'}`}>{text()}</div>
      </div>
      {sS()?.available && <Button size='sm' variant='primary' icon={FiDownload} loading={pctS() != null} onClick={install}>{sS().canInstall ? 'Update now' : 'Download'}</Button>}
      <Button size='sm' icon={FiRefreshCw} loading={busyS()} disabled={pctS() != null} onClick={check}>Check for updates</Button>
    </div>)
  
}
export function About() {
  const info = useInvoke('app:info')
  return (
    <section>
      <SectionTitle>About</SectionTitle>
      <Card class='p-6 rounded-2xl'>
        <div class='flex items-center justify-between gap-4 flex-wrap'>
          <div>
            <div class='font-display text-[28px] font-bold tracking-tight leading-none'>Spectre <span class='text-accent'>{info.data?.version?.split('.').slice(0, 2).join('.') || ''}</span></div>
            <div class='text-[12px] text-muted mt-2 tabular-nums'>
              {info.loading ? <Skeleton class='h-3 w-24' /> : `Version ${info.data?.version || '-'}${info.data?.tauri ? ` · Tauri ${info.data.tauri}` : ''}`}
            </div>
          </div>
          <div class='flex flex-wrap gap-2'>
            <For each={LINKS}>{([l, u]) => <Button size='sm' icon={FiExternalLink} onClick={() => openExternal(u)}>{l}</Button>}</For>
          </div>
        </div>

        <Updates />

        <p class='text-[13px] text-text/90 mt-5 leading-relaxed'>
          A desktop app for VALORANT players: store, friends, live match details, match history, progression, loadouts and tactics, in one place.
        </p>

        <div class='grid sm:grid-cols-3 gap-4 mt-5'>
          <For each={[
            ['Private by design', 'Notes, playbooks, presets and settings are stored only on this PC. No accounts, analytics or tracking.'],
            ['Uses your Riot Client', 'Signs in through the Riot Client already running on your PC. Your password is never asked for or stored.'],
            ['Free & non-commercial', 'A personal project shared with friends. Not for sale.'],
          ]}>{([t, d]) => (
            <div class='glass rounded-xl p-4'>
              <div class='text-[13px] font-semibold text-text'>{t}</div>
              <div class='text-[11px] text-muted mt-1.5 leading-relaxed'>{d}</div>
            </div>
          )}</For>
        </div>

        <div class='border-t border-line mt-5 pt-4 grid gap-1.5 text-[11px] text-muted/80 leading-relaxed'>
          <p>Game data and imagery courtesy of valorant-api.com.</p>
          <p>Spectre isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
          <p>Third-party tools are used at your own risk.</p>
        </div>
      </Card>
    </section>
  )
}
