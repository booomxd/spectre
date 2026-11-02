import { useEffect, useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { Card, ErrorState, Page, SectionTitle, Skeleton, Toggle, toast } from '../ui'
import { invoke, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useSettings } from './settings/useSettings'

const cx = (...c) => c.filter(Boolean).join(' ')

// [setting, label, hint, requires]
const MATCH = [
  ['showMode', 'Game mode', 'Competitive, Deathmatch, Swiftplay...'],
  ['showMap', 'Map image', 'Map art as the large image.'],
  ['showAgent', 'Agent', "The agent you're playing."],
  ['agentImage', 'Agent as main image', 'Show your agent big instead of the map. Requires Agent.', 'showAgent'],
  ['showRank', 'Rank', 'Tier and RR; icon when the image slot is free.'],
  ['showPeak', 'Peak rank', 'Add your peak rank beside current.'],
]
const SESSION = [
  ['showLevel', 'Account level', 'Show your account level.'],
  ['showParty', 'Party size', 'Your stack size, or "Solo".'],
  ['showScore', 'Round score', 'Live score in team modes.'],
  ['showElapsed', 'Elapsed time', 'Timer counting up from match start.'],
  ['showLobby', 'Show in lobby', 'Keep presence on between matches (off = in-match only).'],
]
const SCENARIOS = [['live', 'Live'], ['competitive', 'Competitive'], ['deathmatch', 'Deathmatch'], ['teamdm', 'Team DM'], ['pregame', 'Agent Select'], ['lobby', 'Lobby'], ['queue', 'In Queue']]

const elapsed = start => {
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// How the activity looks on a Discord profile.
function Activity({ activity }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  const a = activity.assets || {}
  return (
    <div key={activity.details + (activity.state || '')} className='anim-fade flex gap-3.5'>
      <div className='relative w-[72px] h-[72px] shrink-0'>
        {a.large_image
          ? <img src={a.large_image} alt={a.large_text} title={a.large_text} className='w-full h-full rounded-lg object-cover' draggable={false} />
          : <div className='w-full h-full rounded-lg bg-surface-2 border border-line flex items-center justify-center'><FaDiscord className='text-2xl text-muted' /></div>}
        {a.small_image && <img src={a.small_image} alt={a.small_text} title={a.small_text} className='absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-bg p-0.5' draggable={false} />}
      </div>
      <div className='min-w-0 flex flex-col justify-center gap-0.5'>
        <div className='text-[14px] font-bold'>Spectre</div>
        <div className='text-[13px] truncate'>{activity.details}</div>
        {activity.state && <div className='text-[12px] text-muted truncate'>{activity.state}</div>}
        {activity.timestamps?.start && <div className='text-[12px] text-good'>{elapsed(activity.timestamps.start)} elapsed</div>}
      </div>
    </div>
  )
}

function Options({ title, items, d, save }) {
  return (
    <div>
      <div className='flex items-center gap-3 mb-1.5'>
        <span className='text-[11px] font-semibold tracking-[0.14em] uppercase text-accent'>{title}</span>
        <span className='flex-1 h-px bg-line' />
      </div>
      <div className='grid sm:grid-cols-2 gap-x-10'>
        {items.map(([k, label, hint, needs]) => (
          <div key={k} className='py-4 border-b border-line/60'>
            <Toggle checked={!!d[k] && (!needs || !!d[needs])} disabled={needs && !d[needs]} label={label} hint={hint} onChange={v => save({ discord: { [k]: v } })} />
          </div>
        ))}
      </div>
    </div>
  )
}

export default function Discord({ active }) {
  const riot = useRiot()
  const { settings, error, save } = useSettings()
  const status = useInvoke('discord:status', [], { poll: 4000, skip: active === false })
  const [scenario, setScenario] = useState('competitive')
  const [busy, setBusy] = useState(false)
  const d = settings?.discord
  const s = status.data || {}

  const key = d ? Object.entries(d).filter(([k]) => k !== 'enabled').map(([, v]) => v).join() : ''
  const preview = useInvoke('discord:preview', [scenario], { deps: [key, riot.connected], poll: scenario === 'live' ? 15000 : undefined, skip: !riot.connected || !d || active === false })

  const setEnabled = async on => {
    setBusy(true)
    try { await invoke(on ? 'discord:connect' : 'discord:disconnect'); toast.success(on ? 'Rich Presence is live' : 'Presence cleared') }
    catch (e) { toast.error(e.message) }
    setBusy(false); status.reload(true)
  }

  if (error) return <Page title='Discord'><ErrorState error={error} /></Page>
  const pill = s.connected ? ['Presence enabled', 'bg-good'] : s.error && s.enabled ? ['Not connected', 'bg-bad'] : s.enabled ? ['Connecting', 'bg-warn'] : ['Presence off', 'bg-muted']

  return (
    <Page title='Discord presence' subtitle='Your session, on display. You choose the details.'
      actions={<span className='glass inline-flex items-center gap-2 h-9 px-4 rounded-full text-xs font-semibold text-text'><FaDiscord className='text-base text-[#5865F2]' />{pill[0]}<span className={cx('w-2 h-2 rounded-full', pill[1])} /></span>}>
      {!d ? <Skeleton className='h-80 rounded-xl' /> : (
        <div className='grid gap-6 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)] items-start stagger'>
          <div className='flex flex-col gap-6'>
            <Card className='anim-rise p-6' style={{ '--i': 0 }}>
              <SectionTitle right={<FaDiscord className='text-muted' />}>Rich Presence</SectionTitle>
              <Toggle checked={!!d.enabled} disabled={busy} onChange={setEnabled} label='Enable Rich Presence'
                hint='Shows your current match on your Discord profile while you play. Discord desktop needs to be running on this PC.' />
              {s.enabled && (s.connected
                ? <p className='mt-4 inline-flex items-center min-h-[24px] py-1 px-3 rounded-full border border-good/30 bg-good/15 text-xs font-medium text-good'>Showing on {s.user?.username || 'your'}'s profile · updates every 15s</p>
                : s.error && <p className='mt-4 rounded-xl border border-bad/30 bg-bad/15 px-3.5 py-2.5 text-xs text-bad'>{s.error}</p>)}
            </Card>
            <Card className='anim-rise p-6 flex flex-col gap-6' style={{ '--i': 1 }}>
              <SectionTitle>Presence details</SectionTitle>
              <Options title='Match context' items={MATCH} d={d} save={save} />
              <Options title='Session context' items={SESSION} d={d} save={save} />
            </Card>
          </div>

          <Card className='anim-rise p-6 xl:sticky xl:top-0' style={{ '--i': 2 }}>
            <SectionTitle right={<FaDiscord className='text-muted' />}>Profile preview</SectionTitle>
            <div className='flex flex-wrap gap-2 mb-5'>
              {SCENARIOS.map(([id, label]) => (
                <button key={id} onClick={() => setScenario(id)}
                  className={cx('h-8 px-3.5 rounded-full border text-xs font-semibold transition-all',
                    scenario === id ? 'accent-soft border-transparent text-text' : 'glass text-muted hover:text-text hover:border-accent/40')}>{label}</button>
              ))}
            </div>
            <div className='glass rounded-xl p-4'>
              <div className='text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-3'>Playing a game</div>
              {!riot.connected ? <p className='text-[13px] text-muted py-6 text-center'>Waiting for the Riot Client.</p>
                : preview.loading && !preview.data ? <Skeleton className='h-[72px] rounded-lg' />
                  : preview.data?.activity ? <Activity activity={preview.data.activity} />
                    : <p className='text-[13px] text-muted py-6 text-center'>{scenario === 'live' ? 'Nothing to show right now. Start VALORANT, or turn on Show in lobby.' : 'Hidden here: Show in lobby is off.'}</p>}
            </div>
            <p className='mt-4 text-xs leading-relaxed text-muted'>Sample scenarios show how your settings appear on Discord, using your real rank. Live shows exactly what's being sent now.</p>
          </Card>
        </div>
      )}
    </Page>
  )
}
