import { useState } from 'react'
import { FiExternalLink, FiFolder, FiRefreshCw, FiTrash2 } from 'react-icons/fi'
import { Badge, Button, Card, Label, Modal, SectionTitle, Select, Skeleton, Toggle, withToast } from '../../ui'
import { invoke, openExternal, useInvoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'

const START_PAGES = [
  ['dashboard', 'Dashboard'], ['friends', 'Friends'], ['live', 'Live Match'], ['progression', 'Progression'], ['loadout', 'Loadout'],
  ['search', 'Player Search'], ['history', 'Match History'], ['memo', 'Notes'], ['activity', 'Encounters'], ['shop', 'Shop'],
  ['discord', 'Discord'], ['weapons', 'Weapons'], ['leaderboard', 'Leaderboard'], ['rank', 'Rank Editor'],
  ['customize', 'Customize'], ['premier', 'Premier'], ['status', 'Status'], ['patchnotes', 'Patch Notes'], ['settings', 'Settings'],
].map(([value, label]) => ({ value, label }))

const Row = ({ children }) => <div className='py-3.5 first:pt-0 last:pb-0 border-b border-line last:border-0'>{children}</div>

// Slider that only saves when released, so dragging does not spam the store.
function Slider({ label, value, min, max, step, onCommit, format }) {
  const [v, setV] = useState(null)
  const shown = v ?? value
  const commit = () => { if (v != null) { onCommit(v); setV(null) } }
  return (
    <div>
      <div className='flex items-center justify-between mb-1'>
        <span className='text-[13px]'>{label}</span>
        <span className='font-display text-sm text-accent'>{format(shown)}</span>
      </div>
      <input type='range' min={min} max={max} step={step} value={shown} style={{ accentColor: 'rgb(var(--accent))' }}
        className='w-full cursor-pointer' onChange={e => setV(+e.target.value)} onMouseUp={commit} onKeyUp={commit} onTouchEnd={commit} />
    </div>
  )
}

export function General({ settings, save }) {
  return (
    <section>
      <SectionTitle>General</SectionTitle>
      <Card className='p-5'>
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

export function Overlay({ settings, save }) {
  const o = settings.overlay
  return (
    <section>
      <SectionTitle>Overlay</SectionTitle>
      <Card className='p-5 grid gap-6 sm:grid-cols-2'>
        <Slider label='Opacity' min={0.3} max={1} step={0.05} value={o.opacity} format={v => Math.round(v * 100) + '%'}
          onCommit={v => save({ overlay: { opacity: v } })} />
        <Slider label='Scale' min={0.7} max={1.5} step={0.05} value={o.scale} format={v => v.toFixed(2) + 'x'}
          onCommit={v => save({ overlay: { scale: v } })} />
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
      <div className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>{k}</div>
      <div className='font-display text-lg font-bold uppercase'>{v || '-'}</div>
    </div>
  )
  return (
    <section>
      <SectionTitle right={<Badge tone={riot.connected ? 'good' : 'bad'}>{riot.connected ? 'Connected' : 'Offline'}</Badge>}>Connection</SectionTitle>
      <Card className='p-5 flex flex-wrap items-center gap-x-10 gap-y-4'>
        <span className={'w-3 h-3 rounded-full ' + (riot.connected ? 'bg-good anim-pulse' : 'bg-bad')} />
        {cell('Region', riot.region)}
        {cell('Shard', riot.shard)}
        <div className='min-w-0'>
          <div className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>Client version</div>
          <div className='text-[13px] truncate max-w-[280px]'>{riot.clientVersion || '-'}</div>
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
      <Card className='p-5'>
        <Row>
          <div className='flex items-center justify-between gap-4'>
            <div className='min-w-0'>
              <div className='text-[13px]'>Data folder</div>
              <div className='text-[11px] text-muted truncate'>{info.data?.dataPath || '...'}</div>
            </div>
            <Button icon={FiFolder} onClick={() => withToast(invoke('app:openDataFolder'))}>Open</Button>
          </div>
        </Row>
        <Row>
          <div className='flex items-center justify-between gap-4'>
            <div>
              <div className='text-[13px]'>Cached data</div>
              <div className='text-[11px] text-muted'>Clears the browser cache. Settings, notes and presets are kept.</div>
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
export function About() {
  const info = useInvoke('app:info')
  return (
    <section>
      <SectionTitle>About</SectionTitle>
      <Card className='p-5'>
        <div className='flex items-center justify-between gap-4 flex-wrap'>
          <div>
            <div className='font-display text-2xl font-bold uppercase leading-none'>Spectre <span className='text-accent'>2.0</span></div>
            <div className='text-[12px] text-muted mt-1.5'>
              {info.loading ? <Skeleton className='h-3 w-24' /> : `Version ${info.data?.version || '-'}${info.data?.electron ? ` · Electron ${info.data.electron}` : ''}`}
            </div>
          </div>
          <div className='flex gap-2'>
            {LINKS.map(([l, u]) => <Button key={u} size='sm' icon={FiExternalLink} onClick={() => openExternal(u)}>{l}</Button>)}
          </div>
        </div>

        <p className='text-[13px] text-text/90 mt-4 leading-relaxed'>
          A desktop app for VALORANT players: store, friends, live match details, match history, progression, loadouts and tactics, in one place.
        </p>

        <div className='grid sm:grid-cols-3 gap-3 mt-4'>
          {[
            ['Private by design', 'Notes, playbooks, presets and settings are stored only on this PC. No accounts, analytics or tracking.'],
            ['Uses your Riot Client', 'Signs in through the Riot Client already running on your PC. Your password is never asked for or stored.'],
            ['Free & non-commercial', 'A personal project shared with friends. Not for sale.'],
          ].map(([t, d]) => (
            <div key={t} className='rounded-lg border border-line bg-surface-2/50 p-3'>
              <div className='text-[12px] font-semibold text-text'>{t}</div>
              <div className='text-[11px] text-muted mt-1 leading-relaxed'>{d}</div>
            </div>
          ))}
        </div>

        <div className='border-t border-line mt-4 pt-3 grid gap-1.5 text-[11px] text-muted/80 leading-relaxed'>
          <p>Game data and imagery courtesy of valorant-api.com.</p>
          <p>Spectre isn't endorsed by Riot Games and doesn't reflect the views or opinions of Riot Games or anyone officially involved in producing or managing Riot Games properties. Riot Games and all associated properties are trademarks or registered trademarks of Riot Games, Inc.</p>
          <p>Third-party tools are used at your own risk.</p>
        </div>
      </Card>
    </section>
  )
}
