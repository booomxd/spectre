import { For, Match, Show, Switch, createMemo, createSignal, onCleanup, onMount } from 'solid-js'
import { st } from '../lib/st.js'
import { FiEyeOff, FiLock, FiUnlock, FiX } from 'solid-icons/fi'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useTiers } from '../lib/content'
import { AgentIcon, RankIcon } from './live/parts'
import { displayName } from './live/PlayerRow'
import { PARTY_COLORS, queueName } from './live/util'
import logo from '../assets/spectre-logo.svg'

const cx = (...c) => c.filter(Boolean).join(' ')
const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

// Overlay settings, kept live: changes in the main window apply here right away
function useOverlaySettings() {
  const [s, setS] = createSignal(null)
  onMount(() => { invoke('settings:get').then(setS).catch(() => { }) })
  useEvent('settings:changed', setS)
  const o = () => s()?.overlay || {}
  return {
    get opacity() { const v = o().opacity; return v >= 0.2 && v <= 1 ? +v : 0.9 },
    get scale() { const v = o().scale; return v >= 0.6 && v <= 2 ? +v : 1 },
    get showPeak() { return o().showPeak !== false },
    get locked() { return !!o().locked },
    get hotkey() { return o().hotkey || '' },
  }
}

function Row(props) {
  
    const color = () => (props.p.party != null ? PARTY_COLORS[props.p.party % PARTY_COLORS.length] : null)
    const t = () => (props.tiers?.[props.p.rank])
    const sub = () => ([props.p.level != null && `Lv ${props.p.level}`, props.p.scouted && `${props.p.scouted.kd.toFixed(2)} KD`, props.p.scouted?.hs != null && `${props.p.scouted.hs}% HS`].filter(Boolean).join(' · '))
    return (<div class={cx('relative flex items-center gap-2 h-10 pl-1.5 pr-2 rounded-xl', props.p.self ? 'accent-soft' : 'bg-surface-2/60 border border-line/50')}>
      {color() && <span class='absolute left-0 top-2.5 bottom-2.5 w-[2px] rounded-r-full' style={st({ background: color() })} title={props.p.party === 0 ? 'Your party' : 'Premade party'} />}
      <AgentIcon agent={props.p.agent} size={28} locked={props.p.locked} class='!rounded-[9px]' />
      <div class='flex-1 min-w-0 leading-tight'>
        <div class={cx('flex items-center gap-1 text-[12px] font-semibold', props.p.self ? 'text-accent' : 'text-text')}>
          <span class='truncate'>{displayName(props.p)}</span>
          {props.p.hidden && <FiEyeOff class='shrink-0 text-muted' size={10} title='Name hidden by streamer mode' />}
        </div>
        {sub() && <div class='text-[9.5px] text-muted truncate'>{sub()}</div>}
      </div>
      {props.p.ranked && (<>
        <div class='text-right leading-tight shrink-0'>
          <div class='tier-text text-[10.5px] font-semibold tracking-tight' style={st(props.p.rank && t() ? { '--tier': `#${t().color.slice(0, 6)}` } : undefined)}>{props.p.rank ? title(t()?.tierName) : 'Unranked'}</div>
          {props.p.rank > 0 && <div class='text-[9.5px] text-muted tabular-nums'>{props.p.rr} RR</div>}
        </div>
        <RankIcon tier={props.p.rank} size={24} />
        {props.showPeak && props.p.peak > props.p.rank && <RankIcon tier={props.p.peak} size={16} class='opacity-70 -ml-1' />}
      </>)}
    </div>)
  
}

function Team(props) {
  
    
    const ranked = () => (props.players.filter(p => p.ranked && p.rank > 0))
    const avg = () => (ranked().length ? Math.round(ranked().reduce((a, p) => a + p.rank, 0) / ranked().length) : 0)
    return (<Show when={!(!props.players.length)} fallback={null}><div class='mb-2.5 last:mb-0'>
      <div class='flex items-center gap-1.5 px-1.5 mb-1.5'>
        <span class={cx('w-1.5 h-1.5 rounded-full bg-current', props.tone)} />
        <span class={cx('text-[10px] font-bold tracking-[0.14em] uppercase', props.tone)}>{props.label}</span>
        <span class='text-[10px] font-semibold text-muted tabular-nums'>{props.players.length}</span>
        {avg() > 0 && <span class='ml-auto flex items-center gap-1 text-[10px] text-muted'>avg <RankIcon tier={avg()} size={14} /> {title(props.tiers?.[avg()]?.tierName)}</span>}
      </div>
      <div class='grid gap-1'><For each={props.players}>{(p, i) => <Row p={p} showPeak={props.showPeak} tiers={props.tiers} />}</For></div>
    </div></Show>)
  
}

function Hint(props) {
  return <div class='h-full flex flex-col items-center justify-center gap-1 px-6 text-center text-[11px] text-muted'>{props.children}</div>
}

export default function Overlay() {
  const riotA = useRiot()
  const os = useOverlaySettings()
  const live = useInvoke('live:state', [], { poll: 4000, skip: () => (!riotA().connected) })
  const tiersA = useTiers()
  onMount(() => {
    // color-scheme: normal too
    const root = document.documentElement.style
    const prev = [root.background, root.colorScheme, document.body.style.background]
    root.background = 'transparent'
    root.colorScheme = 'normal'
    document.body.style.background = 'transparent'
    onCleanup(() => { root.background = prev[0]; root.colorScheme = prev[1]; document.body.style.background = prev[2] })
  })
  const d = () => live.data
  const inMatch = () => !!d() && d().state !== 'menus'
  const ffa = () => d()?.state === 'ingame' && d().queueId === 'deathmatch'
  const key = () => os.hotkey && <kbd class='kbd text-text font-sans'>{os.hotkey}</kbd>
  const view = createMemo(() => !riotA().connected ? 'riot' : live.loading && !d() ? 'loading' : live.error && !d() ? 'error' : !inMatch() ? 'wait' : ffa() ? 'ffa' : 'teams')
  return (
    <div class='h-screen w-screen overflow-hidden p-1' style={st({ zoom: os.scale })}>
      {/* no backdrop blur and no motion beyond one fade: the overlay sits over the game and must stay cheap */}
      <div class='relative h-full flex flex-col rounded-[20px] border border-line overflow-hidden anim-fade shadow-[inset_0_1px_0_rgb(255_255_255/0.08)]'
        style={st({ background: `linear-gradient(180deg, rgb(var(--panel) / ${os.opacity}), rgb(var(--bg) / ${os.opacity}))` })}>
        <span class='absolute -top-16 left-1/2 -translate-x-1/2 w-56 h-24 rounded-full pointer-events-none' style={st({ background: `radial-gradient(closest-side, rgb(var(--accent) / ${0.22 * os.opacity}), transparent)` })} />
        <div class={cx('relative flex items-center gap-2 pl-3 pr-1.5 h-10 shrink-0 select-none', !os.locked && 'cursor-move')} data-tauri-drag-region>
          {/* only the bar itself starts a window drag */}
          <img decoding='async' src={logo} alt='' class='w-4 h-4 shrink-0 pointer-events-none' draggable={false} />
          <span class='pointer-events-none flex-1 min-w-0 truncate font-display text-[12.5px] font-bold tracking-tight text-text'>
            {inMatch() ? `${d().map?.name || 'Match'} · ${queueName(d().queueId)}` : 'Spectre'}
          </span>
          {inMatch() && <span class={cx('pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold', d().state === 'ingame' ? 'bg-good/[0.15] text-good border-good/30' : 'bg-warn/[0.15] text-warn border-warn/30')}>
            <span class={cx('w-1.5 h-1.5 rounded-full anim-pulse', d().state === 'ingame' ? 'bg-good' : 'bg-warn')} />{d().state === 'ingame' ? 'Live' : 'Agent select'}
          </span>}
          <button class='w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors'
            title='Lock: clicks pass through to the game' onClick={() => invoke('overlay:lock', true).catch(() => { })}>{os.locked ? <FiLock size={12} /> : <FiUnlock size={12} />}</button>
          <button class='w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-bad hover:bg-bad/[0.15] transition-colors'
            title={os.hotkey ? `Hide (${os.hotkey})` : 'Hide'} onClick={() => invoke('overlay:close').catch(() => { })}><FiX size={13} /></button>
        </div>
        <div class='hairline shrink-0' />
        <div class='relative flex-1 min-h-0 overflow-y-auto p-1.5 pt-2'>
          <Switch>
            <Match when={view() === 'riot'}><Hint>Waiting for the Riot Client...</Hint></Match>
            <Match when={view() === 'loading'}><div class='grid gap-1'>{Array.from({ length: 6 }, () => <div class='skeleton h-10 rounded-xl' />)}</div></Match>
            <Match when={view() === 'error'}><Hint><span class='text-bad'>{live.error}</span></Hint></Match>
            <Match when={view() === 'wait'}><Hint><span class='text-text font-semibold'>Waiting for a match</span>The overlay fills in at agent select.{key() && <span class='mt-1'>{key()} shows or hides it.</span>}</Hint></Match>
            <Match when={view() === 'ffa'}><Team label='Players' tone='text-accent' players={d().players} showPeak={os.showPeak} tiers={tiersA()} /></Match>
            <Match when={view() === 'teams'}>
              <Team label={d().state === 'pregame' ? 'Your team' : 'Allies'} tone='text-good' players={d().players.filter(p => !p.enemy)} showPeak={os.showPeak} tiers={tiersA()} />
              {d().state === 'pregame'
                ? <div class='px-1 text-[10px] text-muted'>Enemies appear when the match starts.</div>
                : <Team label='Enemies' tone='text-bad' players={d().players.filter(p => p.enemy)} showPeak={os.showPeak} tiers={tiersA()} />}
            </Match>
          </Switch>
        </div>
      </div>
    </div>
  )
}
