import { useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { Card, ErrorState, FadeIn, Page, SegmentedTabs, Skeleton, Swap, Toggle, cx, toast, useNow } from '../ui'
import { invoke, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useSettings } from './settings/useSettings'

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

const elapsed = (start, now) => {
  const s = Math.max(0, Math.floor((now - start) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// How the activity looks on a Discord profile.
function Activity({ activity }) {
  const now = useNow()
  const a = activity.assets || {}
  return (
    <div className='flex gap-4'>
      <div className='relative w-[84px] h-[84px] shrink-0'>
        {a.large_image
          ? <img src={a.large_image} alt={a.large_text} title={a.large_text} className='w-full h-full rounded-xl object-cover' draggable={false} />
          : <div className='w-full h-full rounded-xl glass-inset flex items-center justify-center'><FaDiscord className='text-2xl text-muted' /></div>}
        {a.small_image && <img src={a.small_image} alt={a.small_text} title={a.small_text} className='absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-bg p-0.5' draggable={false} />}
      </div>
      <div className='min-w-0 flex flex-col justify-center gap-0.5'>
        <div className='text-[14px] font-bold text-text'>Spectre</div>
        <div className='text-[13px] text-text/90 truncate'>{activity.details}</div>
        {activity.state && <div className='text-[12.5px] text-muted truncate'>{activity.state}</div>}
        {activity.timestamps?.start && <div className='text-[12px] font-medium text-good tabular-nums'>{elapsed(activity.timestamps.start, now)} elapsed</div>}
      </div>
    </div>
  )
}

function Group({ title, hint, items, d, save, delay }) {
  return (
    <FadeIn delay={delay}>
      <div className='flex items-end justify-between gap-4 mb-3 px-1'>
        <div>
          <h3 className='font-display text-[17px] font-bold tracking-tight text-text'>{title}</h3>
          <p className='text-[12px] text-muted mt-0.5'>{hint}</p>
        </div>
      </div>
      <Card className='px-6 py-1'>
        {items.map(([k, label, h, needs], i) => (
          <div key={k} className={cx('py-4', i > 0 && 'border-t border-line/60')}>
            <Toggle checked={!!d[k] && (!needs || !!d[needs])} disabled={needs && !d[needs]} label={label} hint={h} onChange={v => save({ discord: { [k]: v } })} />
          </div>
        ))}
      </Card>
    </FadeIn>
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
  const pill = s.connected ? ['Live on Discord', 'bg-good'] : s.error && s.enabled ? ['Not connected', 'bg-bad'] : s.enabled ? ['Connecting', 'bg-warn'] : ['Presence off', 'bg-muted']

  return (
    <Page title='Discord' subtitle='Your session on your Discord profile. You choose what it shows.'>
      {!d ? <div className='max-w-3xl space-y-5'><Skeleton className='h-72 rounded-3xl' /><Skeleton className='h-80 rounded-3xl' /></div> : (
        <div className='max-w-3xl flex flex-col gap-10 pb-4'>
          {/* Hero: status + switch + live profile preview */}
          <FadeIn>
            <Card className='relative overflow-hidden rounded-3xl'>
              <span className='halo -top-28 -right-24 w-96 h-96' />
              <div className='relative p-7 flex items-start gap-5'>
                <span className='glass-inset w-14 h-14 rounded-2xl flex items-center justify-center shrink-0'><FaDiscord className='text-[28px] text-[#5865F2]' /></span>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2 text-[12px] font-semibold text-muted'>
                    <span className={cx('w-2 h-2 rounded-full', pill[1], s.connected && 'shadow-[0_0_10px_currentColor] text-good')} />{pill[0]}
                  </div>
                  <h2 className='display text-[24px] text-text mt-1'>Rich Presence</h2>
                  <p className='text-[12.5px] text-muted mt-1 max-w-md leading-relaxed'>Shows your current match on your Discord profile while you play. Discord desktop needs to be running on this PC.</p>
                  {s.enabled && (s.connected
                    ? <p className='mt-3 inline-flex items-center h-7 px-3 rounded-full border border-good/30 bg-good/12 text-[11.5px] font-medium text-good'>Showing on {s.user?.username || 'your'}'s profile · updates every 15s</p>
                    : s.error && <p className='mt-3 rounded-xl border border-bad/30 bg-bad/12 px-3.5 py-2.5 text-xs text-bad'>{s.error}</p>)}
                </div>
                <div className='pt-1'><Toggle checked={!!d.enabled} disabled={busy} onChange={setEnabled} /></div>
              </div>

              <div className='relative px-7 pb-7'>
                <div className='hairline mb-6' />
                <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
                  <span className='eyebrow'>Profile preview</span>
                  <SegmentedTabs size='sm' layoutId='discord-scenario' value={scenario} onChange={setScenario} tabs={SCENARIOS.map(([value, label]) => ({ value, label }))} />
                </div>
                <div className='glass-inset rounded-2xl p-5 min-h-[124px]'>
                  <div className='text-[10.5px] font-bold tracking-[0.14em] uppercase text-muted mb-3.5'>Playing a game</div>
                  <Swap id={scenario}>
                    {!riot.connected ? <p className='text-[13px] text-muted py-4 text-center'>Waiting for the Riot Client.</p>
                      : preview.loading && !preview.data ? <Skeleton className='h-[84px] rounded-xl' />
                        : preview.data?.activity ? <Activity activity={preview.data.activity} />
                          : <p className='text-[13px] text-muted py-4 text-center'>{scenario === 'live' ? 'Nothing to show right now. Start VALORANT, or turn on Show in lobby.' : 'Hidden here: Show in lobby is off.'}</p>}
                  </Swap>
                </div>
                <p className='mt-3 text-[11.5px] leading-relaxed text-muted'>Sample scenarios show how your settings appear on Discord, using your real rank. Live shows exactly what's being sent now.</p>
              </div>
            </Card>
          </FadeIn>

          <Group title='Match' hint='What people see about the game you are in' items={MATCH} d={d} save={save} delay={0.06} />
          <Group title='Session' hint='Your stack, score and timing' items={SESSION} d={d} save={save} delay={0.1} />
        </div>
      )}
    </Page>
  )
}
