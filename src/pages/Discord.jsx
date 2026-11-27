import { For, createSignal, Show } from 'solid-js'
import { FaBrandsDiscord as FaDiscord } from 'solid-icons/fa'
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

// how the activity looks on a Discord profile
function Activity(props) {
  const nowA = useNow()
  
    const a = () => (props.activity.assets || {})
    return (<div class='flex gap-4'>
      <div class='relative w-[84px] h-[84px] shrink-0'>
        {a().large_image
          ? <img decoding='async' src={a().large_image} alt={a().large_text} title={a().large_text} class='w-full h-full rounded-xl object-cover' draggable={false} />
          : <div class='w-full h-full rounded-xl glass-inset flex items-center justify-center'><FaDiscord class='text-2xl text-muted' /></div>}
        {a().small_image && <img decoding='async' src={a().small_image} alt={a().small_text} title={a().small_text} class='absolute -bottom-1.5 -right-1.5 w-7 h-7 rounded-full bg-bg p-0.5' draggable={false} />}
      </div>
      <div class='min-w-0 flex flex-col justify-center gap-0.5'>
        <div class='text-[14px] font-bold text-text'>Spectre</div>
        <div class='text-[13px] text-text/90 truncate'>{props.activity.details}</div>
        {props.activity.state && <div class='text-[12.5px] text-muted truncate'>{props.activity.state}</div>}
        {props.activity.timestamps?.start && <div class='text-[12px] font-medium text-good tabular-nums'>{elapsed(props.activity.timestamps.start, nowA())} elapsed</div>}
      </div>
    </div>)
  
}

function Group(props) {
  return (
    <FadeIn delay={props.delay}>
      <div class='flex items-end justify-between gap-4 mb-3 px-1'>
        <div>
          <h3 class='font-display text-[17px] font-bold tracking-tight text-text'>{props.title}</h3>
          <p class='text-[12px] text-muted mt-0.5'>{props.hint}</p>
        </div>
      </div>
      <Card class='px-6 py-1'>
        <For each={props.items}>{([k, label, h, needs], i) => (
          <div class={cx('py-4', i() > 0 && 'border-t border-line/60')}>
            <Toggle checked={!!props.d[k] && (!needs || !!props.d[needs])} disabled={needs && !props.d[needs]} label={label} hint={h} onChange={v => props.save({ discord: { [k]: v } })} />
          </div>
        )}</For>
      </Card>
    </FadeIn>
  )
}

export default function Discord(props) {
  const riotA = useRiot()
  const __settings = useSettings()
  const status = useInvoke('discord:status', [], { poll: () => (props.active === false ? undefined : 4000) })
  const [scenarioS, setScenario] = createSignal('competitive')
  const [busyS, setBusy] = createSignal(false)
  const d = () => (__settings.settings?.discord)
  const s = () => (status.data || {})
  const key = () => (d() ? Object.entries(d()).filter(([k]) => k !== 'enabled').map(([, v]) => v).join() : '')
  const preview = useInvoke('discord:preview', () => [scenarioS()], { deps: () => ([key(), riotA().connected]), poll: () => (scenarioS() === 'live' ? 15000 : undefined), skip: () => (!riotA().connected || !d() || props.active === false) })
  
    const setEnabled = async on => {
    setBusy(true)
    try { await invoke(on ? 'discord:connect' : 'discord:disconnect'); toast.success(on ? 'Rich Presence is live' : 'Presence cleared') }
    catch (e) { toast.error(e.message) }
    setBusy(false); status.reload(true)
  }
    
    const pill = () => (s().connected ? ['Live on Discord', 'bg-good'] : s().error && s().enabled ? ['Not connected', 'bg-bad'] : s().enabled ? ['Connecting', 'bg-warn'] : ['Presence off', 'bg-muted'])
    return (<Show when={!(__settings.error)} fallback={<Page title='Discord'><ErrorState error={__settings.error} /></Page>}><Page title='Discord' subtitle='Your session on your Discord profile. You choose what it shows.'>
      {!d() ? <div class='max-w-3xl space-y-5'><Skeleton class='h-72 rounded-3xl' /><Skeleton class='h-80 rounded-3xl' /></div> : (
        <div class='max-w-3xl flex flex-col gap-10 pb-4'>
          {/* hero: status + switch + live profile preview */}
          <FadeIn>
            <Card class='relative overflow-hidden rounded-3xl'>
              <span class='halo -top-28 -right-24 w-96 h-96' />
              <div class='relative p-7 flex items-start gap-5'>
                <span class='glass-inset w-14 h-14 rounded-2xl flex items-center justify-center shrink-0'><FaDiscord class='text-[28px] text-[#5865F2]' /></span>
                <div class='min-w-0 flex-1'>
                  <div class='flex items-center gap-2 text-[12px] font-semibold text-muted'>
                    <span class={cx('w-2 h-2 rounded-full', pill()[1], s().connected && 'shadow-[0_0_10px_currentColor] text-good')} />{pill()[0]}
                  </div>
                  <h2 class='display text-[24px] text-text mt-1'>Rich Presence</h2>
                  <p class='text-[12.5px] text-muted mt-1 max-w-md leading-relaxed'>Shows your current match on your Discord profile while you play. Discord desktop needs to be running on this PC.</p>
                  {s().enabled && (s().connected
                    ? <p class='mt-3 inline-flex items-center h-7 px-3 rounded-full border border-good/30 bg-good/12 text-[11.5px] font-medium text-good'>Showing on {s().user?.username || 'your'}'s profile · updates every 15s</p>
                    : s().error && <p class='mt-3 rounded-xl border border-bad/30 bg-bad/12 px-3.5 py-2.5 text-xs text-bad'>{s().error}</p>)}
                </div>
                <div class='pt-1'><Toggle checked={s().enabled ?? !!d().enabled} disabled={busyS()} onChange={setEnabled} /></div>
              </div>

              <div class='relative px-7 pb-7'>
                <div class='hairline mb-6' />
                <div class='flex flex-wrap items-center justify-between gap-3 mb-4'>
                  <span class='eyebrow'>Profile preview</span>
                  <SegmentedTabs size='sm' layoutId='discord-scenario' value={scenarioS()} onChange={setScenario} tabs={SCENARIOS.map(([value, label]) => ({ value, label }))} />
                </div>
                <div class='glass-inset rounded-2xl p-5 min-h-[124px]'>
                  <div class='text-[10.5px] font-bold tracking-[0.14em] uppercase text-muted mb-3.5'>Playing a game</div>
                  <Swap id={scenarioS()}>
                    {!riotA().connected ? <p class='text-[13px] text-muted py-4 text-center'>Waiting for the Riot Client.</p>
                      : preview.loading && !preview.data ? <Skeleton class='h-[84px] rounded-xl' />
                        : preview.data?.activity ? <Activity activity={preview.data.activity} />
                          : <p class='text-[13px] text-muted py-4 text-center'>{scenarioS() === 'live' ? 'Nothing to show right now. Start VALORANT, or turn on Show in lobby.' : 'Hidden here: Show in lobby is off.'}</p>}
                  </Swap>
                </div>
                <p class='mt-3 text-[11.5px] leading-relaxed text-muted'>Sample scenarios show how your settings appear on Discord, using your real rank. Live shows exactly what's being sent now.</p>
              </div>
            </Card>
          </FadeIn>

          <Group title='Match' hint='What people see about the game you are in' items={MATCH} d={d()} save={__settings.save} delay={0.06} />
          <Group title='Session' hint='Your stack, score and timing' items={SESSION} d={d()} save={__settings.save} delay={0.1} />
        </div>
      )}
    </Page></Show>)
  
}
