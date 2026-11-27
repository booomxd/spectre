import { For, Show } from 'solid-js'
import { FiClock, FiFlag, FiScissors, FiSearch, FiTarget, FiZap, FiEdit3 } from 'solid-icons/fi'
import { useInvoke } from '../../lib/ipc'
import { Badge, ErrorState, Skeleton } from '../../ui'
import { AgentIcon, RESULT, TierIcon, cx, fmtDate, fmtLen, playerLabel, useAgents, useMaps } from './shared'
import { MemoBadge } from './MemoEditor'

const COLS = 'grid-cols-[minmax(0,1fr)_44px_44px_30px_30px_30px_40px_44px_44px_28px_28px_56px]'
const HEAD = ['', 'Rank', 'ACS', 'K', 'D', 'A', '+/-', 'ADR', 'HS%', 'FB', 'FD', '']

const ROUND_ICON = { elim: FiTarget, defuse: FiScissors, detonate: FiZap, time: FiClock, surrender: FiFlag }
const ROUND_LABEL = { elim: 'Elimination', defuse: 'Spike defused', detonate: 'Spike detonated', time: 'Time ran out', surrender: 'Surrender' }

function Row(props) {
  
    const diff = () => (props.p.kills - props.p.deaths)
    return (<div class={cx('grid items-center gap-2 px-5 h-[52px] text-[13px] tabular-nums border-t border-line transition-colors', COLS, props.p.puuid && props.p.puuid === props.me ? 'accent-soft' : 'hover:bg-surface-2')}>
      <div class='flex items-center gap-2.5 min-w-0'>
        <AgentIcon id={props.p.agent} agents={props.agents} size={34} class='!rounded-xl' />
        <div class='min-w-0'>
          <div title={props.p.hidden ? 'Name hidden by streamer mode' : undefined} class={cx('truncate font-semibold leading-tight', props.p.hidden && 'text-muted')}>{playerLabel(props.p, props.agents)}</div>
          <div class='flex items-center gap-1.5'>
            {props.p.hidden && <span title='Name hidden by streamer mode' class='text-[11px] font-medium text-muted'>Hidden</span>}
            {props.memo && <MemoBadge memo={props.memo} onClick={() => props.onMemo(props.p)} />}
          </div>
        </div>
      </div>
      <TierIcon tier={props.p.tier} size={24} />
      <span class='font-display font-bold tracking-tight'>{props.p.acs}</span>
      <span>{props.p.kills}</span><span>{props.p.deaths}</span><span>{props.p.assists}</span>
      <span class={cx('font-semibold', diff() > 0 ? 'text-good' : diff() < 0 ? 'text-bad' : 'text-muted')}>{diff() > 0 ? '+' : ''}{diff()}</span>
      <span>{props.p.adr ?? '-'}</span>
      <span>{props.p.hs != null ? props.p.hs : '-'}</span>
      <span class='text-muted'>{props.p.fb}</span><span class='text-muted'>{props.p.fd}</span>
      <div class='flex justify-end gap-0.5'>
        {props.p.puuid && !props.p.hidden && (
          <>
            <button title='View profile' onClick={() => props.onSearch(props.p)} class='w-7 h-7 rounded-full text-muted hover:text-accent hover:bg-surface-2 flex items-center justify-center transition-colors'><FiSearch /></button>
            <button title='Note' onClick={() => props.onMemo(props.p)} class='w-7 h-7 rounded-full text-muted hover:text-accent hover:bg-surface-2 flex items-center justify-center transition-colors'><FiEdit3 /></button>
          </>
        )}
      </div>
    </div>)
  
}

function Scoreboard(props) {
  return (
    <div class='glass rounded-2xl overflow-hidden'>
      <div class='flex items-center justify-between px-5 h-12'>
        <span class='flex items-center gap-2.5'>
          <span class={cx('w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]', props.tone === 'text-good' ? 'bg-good text-good' : props.tone === 'text-bad' ? 'bg-bad text-bad' : 'bg-muted text-muted')} />
          <span class='font-display text-[15px] font-bold tracking-tight text-text'>{props.title}</span>
        </span>
        <span class='eyebrow !text-[10px]'>{props.players.length} players</span>
      </div>
      <div class={cx('grid gap-2 px-5 h-8 items-center border-t border-line bg-surface-2/50 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted', COLS)}>
        <For each={HEAD}>{(h, i) => <span>{h}</span>}</For>
      </div>
      <For each={props.players}>{p => <Row p={p} me={props.me} agents={props.agents} memo={props.memos[p.puuid]} onSearch={props.onSearch} onMemo={props.onMemo} />}</For>
    </div>
  )
}

// Round-by-round strip: one lane per team, icon sits in the lane of the round winner
function Timeline(props) {
  
    const enemy = () => (props.teams.find(t => t.id !== props.myTeam)?.id)
    const lanes = () => ([{ id: props.myTeam, label: 'You' }, { id: enemy(), label: 'Enemy' }])
    const gap = i => (i === 12 || i === 24 ? 'ml-3' : '')
    return (<div class='glass rounded-2xl p-5 overflow-x-auto'>
      <div class='eyebrow !text-[10px] mb-3'>Rounds</div>
      <div class='flex flex-col gap-1.5 min-w-max'>
        <For each={lanes()}>{(lane, li) => (
          <div class='flex items-center gap-1'>
            <span class='w-12 text-[12px] font-semibold text-muted'>{lane.label}</span>
            <For each={props.rounds}>{(r, i) => {
              const Icon = ROUND_ICON[r.kind] || FiClock
              const won = () => (r.winner === lane.id)
              return (
                <div class={cx('w-6 h-6 rounded-full flex items-center justify-center text-[11px] border', gap(i()),
                  won() ? (li() === 0 ? 'bg-good/15 border-good/40 text-good' : 'bg-bad/15 border-bad/40 text-bad') : 'border-transparent text-transparent')}
                  title={won() ? `Round ${r.num + 1}: ${ROUND_LABEL[r.kind]}${r.site ? ` (${r.site})` : ''}` : undefined}>
                  {won() && <Icon />}
                </div>
              )
            }}</For>
          </div>
        )}</For>
        <div class='flex items-center gap-1'>
          <span class='w-12' />
          <For each={props.rounds}>{(r, i) => <span class={cx('w-6 text-center text-[10px] text-muted tabular-nums', gap(i()))}>{r.num + 1}</span>}</For>
        </div>
      </div>
      <div class='flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-line text-[11px] text-muted'>
        <For each={Object.keys(ROUND_ICON)}>{k => { const I = ROUND_ICON[k]; return <span class='inline-flex items-center gap-1.5'><I />{ROUND_LABEL[k]}</span> }}</For>
      </div>
    </div>)
  
}

export default function MatchDetail(props) {
  const agentsA = useAgents()
  const mapsA = useMaps()
  const __invoke = useInvoke('history:detail', () => [props.matchId])
  
    
    
    const map = () => (mapsA()[__invoke.data.mapId])
    const mine = () => (__invoke.data.players.find(p => p.puuid === props.me))
    const ffa = () => (__invoke.data.teams.length > 2)
    const team = id => __invoke.data.teams.find(t => t.id === id)
    const sorted = list => [...list].sort((a, b) => b.points - a.points)
    const myTeam = () => (mine()?.team || __invoke.data.teams[0]?.id)
    const result = () => (ffa() ? (team(myTeam())?.won ? 'win' : 'loss') : __invoke.data.teams.every(t => !t.won) ? 'draw' : team(myTeam())?.won ? 'win' : 'loss')
    const R = () => (RESULT[result()])
    const groups = () => (ffa() ? [{ id: 'all', title: 'Scoreboard', tone: 'text-muted', players: sorted(__invoke.data.players).sort((a, b) => b.kills - a.kills) }]
    : [myTeam(), ...__invoke.data.teams.map(t => t.id).filter(id => id !== myTeam())].map((id, i) => ({
      id, title: `${i === 0 ? 'Your team' : 'Enemy team'} - ${team(id)?.roundsWon ?? 0} rounds`, tone: team(id)?.won ? 'text-good' : 'text-bad',
      players: sorted(__invoke.data.players.filter(p => p.team === id)),
    })))
    return (<Show when={!(__invoke.error && !__invoke.data)} fallback={<ErrorState error={__invoke.error} onRetry={__invoke.reload} />}><Show when={!(__invoke.loading || !__invoke.data)} fallback={<div class='flex flex-col gap-4'>
      <Skeleton class='h-24 rounded-2xl' /><Skeleton class='h-48 rounded-xl' /><Skeleton class='h-48 rounded-xl' />
    </div>}><div class='flex flex-col gap-4'>
      <div class='glass relative overflow-hidden rounded-3xl h-32 flex items-center px-7'>
        {map()?.splash && <img decoding='async' src={map().splash} alt='' class='absolute inset-0 w-full h-full object-cover opacity-55' draggable={false} />}
        {/* fades the map art into the modal's own fill so text stays readable on light and dark themes */}
        <div class='absolute inset-0 bg-gradient-to-r from-panel via-panel/75 to-panel/10' />
        <div class='relative flex items-center gap-5 w-full'>
          <div>
            <div class='eyebrow !text-[10px] mb-2'>{__invoke.data.mode}</div>
            <div class={cx('display text-[40px]', R().text)}>{R().label}</div>
            <div class='text-[12px] text-muted mt-2'>{map()?.displayName || 'Unknown map'}</div>
          </div>
          {!ffa() && <div class='display text-[48px] tabular-nums ml-6'>{team(myTeam())?.roundsWon ?? 0}<span class='text-muted mx-1.5'>:</span>{__invoke.data.teams.find(t => t.id !== myTeam())?.roundsWon ?? 0}</div>}
          <div class='ml-auto text-right text-[12px] text-muted leading-relaxed'>
            <div>{fmtDate(__invoke.data.start)}</div><div>{fmtLen(__invoke.data.length)} long</div>
          </div>
        </div>
      </div>
      <For each={groups()}>{g => <Scoreboard title={g.title} tone={g.tone} players={g.players} me={props.me} agents={agentsA()} memos={(props.memos ?? {})} onSearch={props.onSearch} onMemo={props.onMemo} />}</For>
      {!ffa() && __invoke.data.rounds.length > 1 && <Timeline rounds={__invoke.data.rounds} teams={__invoke.data.teams} myTeam={myTeam()} />}
      {__invoke.data.players.some(p => p.hidden) && <Badge class='self-start' title='Hidden by streamer mode'>{__invoke.data.namesLimited
        ? "Couldn't check your current match, so only you, friends and party are named"
        : 'Streamer-mode players in your current match show only their agent'}</Badge>}
    </div></Show></Show>)
  
}
