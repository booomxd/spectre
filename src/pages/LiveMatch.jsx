import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on, onMount } from 'solid-js'
import { st } from '../lib/st.js'
import { FiMonitor, FiRadio, FiUsers, FiX } from 'solid-icons/fi'
import { Page, Card, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, SegmentedTabs, Stagger, Swap, FadeIn, Item, withToast } from '../ui'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useTiers } from '../lib/content'
import PlayerRow from './live/PlayerRow'
import Drawer from './live/Drawer'
import ScoutPanel from './live/ScoutPanel'
import SkinsPanel from './live/SkinsPanel'
import Lobby from './live/Lobby'
import LobbyRead from './live/LobbyRead'
import Loadout from './Loadout'
import { GunIcon, ModeIcon, PlayerCard, RankGlow, RankIcon } from './live/parts'
import { queueName, useMemos } from './live/util'

const cx = (...c) => c.filter(Boolean).join(' ')
const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const SkinsIcon = () => <GunIcon size={14} />

// average current rank of the ranked players in a list
const avgRank = players => {
  const r = players.filter(p => p.ranked && p.rank > 0)
  return r.length ? Math.round(r.reduce((a, p) => a + p.rank, 0) / r.length) : 0
}

const SPLASH_MASK = { WebkitMaskImage: 'linear-gradient(90deg, transparent 8%, #000 62%)', maskImage: 'linear-gradient(90deg, transparent 8%, #000 62%)' }
const GRID = {
  backgroundImage: 'linear-gradient(rgb(var(--line) / calc(var(--grid-a) * 2)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / calc(var(--grid-a) * 2)) 1px, transparent 1px)',
  backgroundSize: '28px 28px', WebkitMaskImage: 'radial-gradient(ellipse at 20% 60%, #000, transparent 70%)', maskImage: 'radial-gradient(ellipse at 20% 60%, #000, transparent 70%)',
}

function TeamAvg(props) {
  const tiersA = useTiers()
  return (
    <div class={cx('flex items-center gap-3', props.tone === 'bad' && 'flex-row-reverse text-right')}>
      <RankGlow tier={props.tier} size={42} />
      <div class='leading-tight'>
        <div class={cx('eyebrow', props.tone === 'bad' ? '!text-bad' : '!text-good')}>{props.label}</div>
        <div class='mt-1 text-[14px] font-semibold tracking-tight text-text whitespace-nowrap'>{props.tier ? title(tiersA()?.[props.tier]?.tierName) : 'Unranked'}</div>
      </div>
    </div>
  )
}

// match hero: map art bleeding in from the right, a faint grid, the map name as display type, and team average ranks
function Banner(props) {
  
    const live = () => (props.m.state === 'ingame')
    const ffa = () => (live() && props.m.queueId === 'deathmatch')
    const allies = () => (avgRank(props.m.players.filter(p => !p.enemy))), enemies = () => (avgRank(props.m.players.filter(p => p.enemy)))
    return (<FadeIn class='glass relative overflow-hidden mb-8 rounded-[28px] h-[208px]'>
      {props.m.map?.splash && <img decoding='async' src={props.m.map.splash} alt='' class='absolute inset-y-0 right-0 w-[78%] h-full object-cover opacity-80' style={st(SPLASH_MASK)} draggable={false} />}
      <div class='absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent' />
      <div class='absolute inset-0 pointer-events-none' style={st(GRID)} />
      <span class='halo -left-20 -bottom-32 w-[420px] h-[320px] opacity-80' />
      <div class='relative h-full flex items-end justify-between gap-6 p-7'>
        <div class='min-w-0'>
          <div class='flex items-center gap-2 mb-3'>
            <span class={cx('inline-flex items-center gap-2 h-6 px-2.5 rounded-full text-[10.5px] font-bold tracking-[0.12em] uppercase border',
              live() ? 'bg-good/12 text-good border-good/30' : 'bg-warn/12 text-warn border-warn/30')}>
              <span class={cx('w-1.5 h-1.5 rounded-full anim-pulse', live() ? 'bg-good shadow-[0_0_8px_rgb(var(--good))]' : 'bg-warn')} />{live() ? 'Live' : 'Agent select'}
            </span>
            <Badge><ModeIcon queue={props.m.queueId} size={11} />{queueName(props.m.queueId)}</Badge>
            {props.m.server && <Badge class='capitalize'>{props.m.server}</Badge>}
          </div>
          <h2 class='display text-[64px] leading-[0.9] text-text drop-shadow-[0_4px_24px_rgb(0_0_0/0.35)]'>{props.m.map?.name || 'Unknown map'}</h2>
        </div>
        <div class='flex items-center gap-5 shrink-0'>
          {!ffa() && (live()
            ? <div class='glass-strong flex items-center gap-5 rounded-full pl-3 pr-3 py-2.5'>
              <TeamAvg label='Your team' tier={allies()} />
              <span class='display text-[15px] text-muted'>vs</span>
              <TeamAvg label='Opponents' tier={enemies()} tone='bad' />
            </div>
            : <div class='glass-strong rounded-full pl-3 pr-5 py-2.5'><TeamAvg label='Team average' tier={allies()} /></div>)}
          {props.m.state === 'pregame' && <Button variant='primary' size='lg' icon={SkinsIcon} onClick={props.onChangeSkins}>Change skins</Button>}
        </div>
      </div>
    </FadeIn>)
  
}

function Team(props) {
  const tiersA = useTiers()
  
    const avg = () => (avgRank(props.players))
    const dot = () => ({ bad: 'bg-bad shadow-[0_0_10px_rgb(var(--bad))]', good: 'bg-good shadow-[0_0_10px_rgb(var(--good))]' }[props.tone] || 'bg-accent shadow-[0_0_10px_rgb(var(--accent))]')
    const line = () => ({ bad: 'from-bad/50', good: 'from-good/45' }[props.tone] || 'from-accent/50')
    return (<section class='min-w-0'>
      <header class='flex items-center gap-3 px-1 mb-3'>
        <span class={cx('w-2 h-2 rounded-full', dot())} />
        <h2 class='font-display text-[19px] font-bold tracking-tight text-text'>{props.title}</h2>
        <span class='text-[12px] font-semibold text-muted tabular-nums'>{props.players.length}</span>
        {avg() > 0 && <span class='ml-auto flex items-center gap-1.5 text-[11.5px] text-muted'>Avg <RankIcon tier={avg()} size={18} /><span class='text-text font-semibold'>{title(tiersA()?.[avg()]?.tierName)}</span></span>}
      </header>
      <div class={cx('h-px mb-4 bg-gradient-to-r to-transparent', line())} />
      <Stagger class='grid gap-2.5' step={0.04}>
        <For each={props.players}>{(p, i) => <PlayerRow p={p} i={i()} memo={p.puuid && props.memos[p.puuid]} onScout={props.onScout} onSkins={props.onSkins} />}</For>
      </Stagger>
    </section>)
  
}

function Idle(props) {
  const party = useInvoke('social:party', [], { poll: () => (props.active ? 5000 : undefined) })
  
    const members = () => (party.data?.members || [])
    return (<div class='grid gap-5 lg:grid-cols-[1fr_360px] items-start'>
      <Card class='relative overflow-hidden p-10 rounded-[28px] min-h-[320px] flex items-center justify-center'>
        <div class='absolute inset-0 pointer-events-none' style={st({ ...GRID, WebkitMaskImage: 'radial-gradient(circle at 50% 45%, #000, transparent 65%)', maskImage: 'radial-gradient(circle at 50% 45%, #000, transparent 65%)' })} />
        {/* radar rings: static, only the inner dot pulses */}
        <div class='absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 pointer-events-none'>
          <For each={[260, 190, 120]}>{s => <span class='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15' style={st({ width: s, height: s })} />}</For>
        </div>
        <Empty icon={FiRadio} title='Waiting for a match' hint='Queue up and this page fills with both teams, and your party as soon as agent select starts.' class='relative' />
      </Card>
      <Card class='p-5 rounded-[28px] min-w-0 overflow-hidden'>
        <div class='flex items-center justify-between mb-3 px-1'>
          <span class='eyebrow'>Your party</span>
          {members().length > 0 && <span class='text-[11px] text-muted tabular-nums'>{members().length}/5</span>}
        </div>
        {party.loading && !party.data ? <Skeleton class='h-14 rounded-2xl' />
          : !members().length ? <p class='px-1 py-1.5 text-[12px] text-muted'>No party found.</p>
            : <Stagger class='grid grid-cols-[minmax(0,1fr)] gap-1.5'>
              <For each={members()}>{(m, i) => (
                <Item index={i()} class='min-w-0 flex items-center gap-3 rounded-2xl px-2.5 py-2 glass-inset'>
                  <PlayerCard id={m.hidden ? null : m.card} name={m.hidden ? null : m.gameName} size={36} />
                  <div class='min-w-0 flex-1 text-[13px] font-semibold text-text truncate'>{m.hidden ? 'Hidden player' : m.gameName || '...'}<span class='ml-0.5 text-[11px] text-muted font-normal'>{!m.hidden && m.tagLine && ` #${m.tagLine}`}</span></div>
                  <RankIcon tier={m.rank} size={26} />
                </Item>
              )}</For>
            </Stagger>}
      </Card>
    </div>)
  
}

function LiveBody(props) {
  const [overlayS, setOverlay] = createSignal(false)
  onMount(() => { invoke('overlay:state').then(s => setOverlay(s.open)).catch(() => { }) })
  useEvent('overlay:state', s => setOverlay(s.open))
  const live = useInvoke('live:state', [], { key: 'ref', poll: () => (props.active ? 4000 : overlayS() ? 12000 : undefined) })
  const d = () => live.data
  const memosA = useMemos(() => (d()?.players || []).map(p => p.puuid))
  const [panelS, setPanel] = createSignal(null)
  const closePanel = () => setPanel(null)
  const rescout = () => live.reload(true)
  createEffect(on(() => d()?.matchId, closePanel, { defer: true }))
  let demoScout = false
  createEffect(on(() => d()?.players, players => {
    if (!import.meta.env.DEV || demoScout || !players?.length) return
    const q = new URLSearchParams(window.location.search)
    if (!q.has('demo') || !q.has('scout')) return
    demoScout = true
    setPanel({ kind: 'scout', player: players.find(p => p.name && !p.hidden && !p.self) || players[1] || players[0] })
  }))
  // keep the last panel's content while the drawer closes
  let last = null
  const shown = createMemo(() => (last = panelS() || last))
  const [pickedS, setPicked] = createSignal(null)
  const inMatch = createMemo(() => !!d() && d().state !== 'menus')
  createEffect(on(inMatch, () => setPicked(null), { defer: true }))
  const tab = () => pickedS() || (inMatch() ? 'live' : 'lobby')
  const rows = { get memos() { return memosA() }, onScout: p => setPanel({ kind: 'scout', player: p }), onSkins: p => setPanel({ kind: 'skins', player: p }) }
  const toggle = () => withToast(invoke('overlay:toggle').then(s => setOverlay(s.open)))
  const view = createMemo(() => {
    if (tab() === 'lobby') return 'lobby'
    if (live.loading && !d()) return 'loading'
    if (live.error && !d()) return 'error'
    if (!d() || d().state === 'menus') return 'idle'
    return d().state === 'pregame' ? 'pregame' : d().state === 'ingame' && d().queueId === 'deathmatch' ? 'ffa' : 'teams'
  })
  const mine = createMemo(() => (d()?.players || []).filter(p => !p.enemy))
  const theirs = createMemo(() => (d()?.players || []).filter(p => p.enemy))
  const half = () => Math.ceil((d()?.players?.length || 0) / 2)
  const actions = (<>
    <SegmentedTabs value={tab()} onChange={setPicked} layoutId='live-tabs'
      tabs={[{ value: 'lobby', label: 'Lobby & Party', icon: FiUsers }, { value: 'live', label: 'Match', icon: FiRadio }]} />
    <Button icon={FiMonitor} variant={overlayS() ? 'glow' : 'subtle'} onClick={toggle} title='Show or hide the in-game overlay'>
      Overlay{overlayS() && <span class='w-1.5 h-1.5 rounded-full bg-good shadow-[0_0_8px_rgb(var(--good))]' />}
    </Button>
  </>)

  return (
    <Page title='Live Match' subtitle={tab() === 'lobby' ? 'Your party, queue and lobby settings' : inMatch() ? 'Both rosters, refreshed every few seconds' : 'Agent select and in-game rosters, plus your party and lobby'} actions={actions}>
      <Switch>
        <Match when={view() === 'lobby'}><Lobby active={props.active} matchState={d()?.state} /></Match>
        <Match when={view() === 'loading'}>
          <div class='grid gap-3'>
            <Skeleton class='h-[208px] rounded-[28px] mb-5' />
            <div class='grid gap-7 xl:grid-cols-2'><For each={[0, 1]}>{() => <div class='grid gap-2.5'>{Array.from({ length: 5 }, () => <Skeleton class='h-[84px] rounded-[22px]' />)}</div>}</For></div>
          </div>
        </Match>
        <Match when={view() === 'error'}><ErrorState error={live.error} onRetry={live.reload} /></Match>
        <Match when={view() === 'idle'}><Idle active={props.active} /></Match>
        <Match when={true}>
          <div>
            <Banner m={d()} onChangeSkins={() => setPanel({ kind: 'loadout' })} />
            <Show when={view() !== 'ffa'}><LobbyRead players={d().players} pregame={view() === 'pregame'} /></Show>
            <Switch>
              <Match when={view() === 'pregame'}><div class='max-w-4xl'><Team title='Your team' tone='good' players={mine()} {...rows} /></div></Match>
              <Match when={view() === 'ffa'}>
                <div class='grid gap-x-8 gap-y-10 xl:grid-cols-2'>
                  <Team title='Players' tone='accent' players={d().players.slice(0, half())} {...rows} />
                  <Team title='Players' tone='accent' players={d().players.slice(half())} {...rows} />
                </div>
              </Match>
              <Match when={true}>
                <div class='grid gap-x-8 gap-y-10 xl:grid-cols-2'>
                  <Team title='Your team' tone='good' players={mine()} {...rows} />
                  <Team title='Opponents' tone='bad' players={theirs()} {...rows} />
                </div>
              </Match>
            </Switch>
            <p class='mt-8 mx-auto max-w-3xl text-center text-[12px] leading-relaxed text-muted'>
              A colored edge and a Duo, Trio or stack tag mark players who queued together; gold is your party. Scout any player for rank history and recent matches, or use the eye for their skins. Streamer-mode players stay hidden, except you and friends in your party.
            </p>
          </div>
        </Match>
      </Switch>
      <Drawer open={!!panelS()} onClose={closePanel} width={shown()?.kind === 'loadout' ? 'min(1120px, 82vw)' : undefined}>
        <Show when={shown()?.kind === 'loadout'}>
          {/* your own loadout during agent select: same editor as the Loadout page, applied in game right away */}
          <div class='relative flex-1 overflow-y-auto'>
            <button class='glass absolute right-5 top-5 z-10 w-9 h-9 rounded-full text-muted hover:text-text hover:border-accent/40 transition-colors flex items-center justify-center' onClick={closePanel} title='Close'><FiX /></button>
            <Loadout active />
          </div>
        </Show>
        {/* keyed by the player's ref, so a panel never shows one player's data under another's header */}
        <Show when={shown()?.kind === 'scout' && (shown().player?.ref || shown().player)} keyed>{_ref => <ScoutPanel player={shown().player} onLoaded={rescout} onClose={closePanel} />}</Show>
        <Show when={shown()?.kind === 'skins' && (shown().player?.ref || shown().player)} keyed>{_ref => <SkinsPanel player={shown().player} onClose={closePanel} />}</Show>
      </Drawer>
    </Page>
  )
}

export default function LiveMatch(props) {
  const riotA = useRiot()
  return <RequireRiot><Show when={riotA().connected}><LiveBody active={props.active} /></Show></RequireRiot>
}
