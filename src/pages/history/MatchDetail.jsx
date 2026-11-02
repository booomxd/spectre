import { FiClock, FiFlag, FiScissors, FiSearch, FiTarget, FiZap, FiEdit3 } from 'react-icons/fi'
import { useInvoke } from '../../lib/ipc'
import { Badge, ErrorState, Skeleton } from '../../ui'
import { AgentIcon, RESULT, TierIcon, cx, fmtDate, fmtLen, playerLabel, useAgents, useMaps } from './shared'
import { MemoBadge } from './MemoEditor'

const COLS = 'grid-cols-[minmax(0,1fr)_44px_44px_30px_30px_30px_40px_44px_44px_28px_28px_56px]'
const HEAD = ['', 'Rank', 'ACS', 'K', 'D', 'A', '+/-', 'ADR', 'HS%', 'FB', 'FD', '']

const ROUND_ICON = { elim: FiTarget, defuse: FiScissors, detonate: FiZap, time: FiClock, surrender: FiFlag }
const ROUND_LABEL = { elim: 'Elimination', defuse: 'Spike defused', detonate: 'Spike detonated', time: 'Time ran out', surrender: 'Surrender' }

function Row({ p, me, agents, memo, onSearch, onMemo }) {
  const diff = p.kills - p.deaths
  return (
    <div className={cx('grid items-center gap-2 px-3 h-11 text-[13px] border-t border-line/60', COLS, p.puuid && p.puuid === me && 'bg-accent/10')}>
      <div className='flex items-center gap-2.5 min-w-0'>
        <AgentIcon id={p.agent} agents={agents} size={30} />
        <div className='min-w-0'>
          <div title={p.hidden ? 'Hidden by VALORANT' : undefined} className={cx('truncate font-semibold leading-tight', p.hidden && 'text-muted')}>{playerLabel(p, agents)}</div>
          <div className='flex items-center gap-1.5'>
            {p.hidden && <span title='Hidden by VALORANT' className='text-[10px] uppercase tracking-wider text-muted'>Hidden</span>}
            {memo && <MemoBadge memo={memo} onClick={() => onMemo(p)} />}
          </div>
        </div>
      </div>
      <TierIcon tier={p.tier} size={24} />
      <span className='font-display font-bold'>{p.acs}</span>
      <span>{p.kills}</span><span>{p.deaths}</span><span>{p.assists}</span>
      <span className={diff > 0 ? 'text-good' : diff < 0 ? 'text-bad' : 'text-muted'}>{diff > 0 ? '+' : ''}{diff}</span>
      <span>{p.adr ?? '-'}</span>
      <span>{p.hs != null ? p.hs : '-'}</span>
      <span className='text-muted'>{p.fb}</span><span className='text-muted'>{p.fd}</span>
      <div className='flex justify-end gap-1'>
        {p.known && !p.hidden && (
          <>
            <button title='View profile' onClick={() => onSearch(p)} className='w-6 h-6 rounded-md text-muted hover:text-accent hover:bg-surface-2 flex items-center justify-center transition-colors'><FiSearch /></button>
            <button title='Note' onClick={() => onMemo(p)} className='w-6 h-6 rounded-md text-muted hover:text-accent hover:bg-surface-2 flex items-center justify-center transition-colors'><FiEdit3 /></button>
          </>
        )}
      </div>
    </div>
  )
}

function Scoreboard({ title, tone, players, me, agents, memos, onSearch, onMemo }) {
  return (
    <div className='rounded-xl border border-line overflow-hidden'>
      <div className={cx('flex items-center justify-between px-3 h-9 bg-surface-2')}>
        <span className={cx('text-[11px] font-bold uppercase tracking-[0.16em]', tone)}>{title}</span>
        <span className='text-[10px] text-muted'>{players.length} players</span>
      </div>
      <div className={cx('grid gap-2 px-3 h-7 items-center text-[10px] font-semibold uppercase tracking-wider text-muted', COLS)}>
        {HEAD.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {players.map(p => <Row key={p.key} p={p} me={me} agents={agents} memo={memos[p.puuid]} onSearch={onSearch} onMemo={onMemo} />)}
    </div>
  )
}

// Round-by-round strip: one lane per team, icon sits in the lane of the round winner.
function Timeline({ rounds, teams, myTeam }) {
  const enemy = teams.find(t => t.id !== myTeam)?.id
  const lanes = [{ id: myTeam, label: 'You' }, { id: enemy, label: 'Enemy' }]
  const gap = i => (i === 12 || i === 24 ? 'ml-3' : '')
  return (
    <div className='rounded-xl border border-line p-3 overflow-x-auto'>
      <div className='flex flex-col gap-1.5 min-w-max'>
        {lanes.map((lane, li) => (
          <div key={lane.id} className='flex items-center gap-1'>
            <span className='w-12 text-[10px] font-semibold uppercase tracking-wider text-muted'>{lane.label}</span>
            {rounds.map((r, i) => {
              const Icon = ROUND_ICON[r.kind] || FiClock
              const won = r.winner === lane.id
              return (
                <div key={r.num} className={cx('w-6 h-6 rounded-md flex items-center justify-center text-[11px] border', gap(i),
                  won ? (li === 0 ? 'bg-good/15 border-good/40 text-good' : 'bg-bad/15 border-bad/40 text-bad') : 'border-transparent text-transparent')}
                  title={won ? `Round ${r.num + 1}: ${ROUND_LABEL[r.kind]}${r.site ? ` (${r.site})` : ''}` : undefined}>
                  {won && <Icon />}
                </div>
              )
            })}
          </div>
        ))}
        <div className='flex items-center gap-1'>
          <span className='w-12' />
          {rounds.map((r, i) => <span key={r.num} className={cx('w-6 text-center text-[9px] text-muted', gap(i))}>{r.num + 1}</span>)}
        </div>
      </div>
      <div className='flex flex-wrap gap-3 mt-2 pt-2 border-t border-line/60 text-[10px] text-muted'>
        {Object.keys(ROUND_ICON).map(k => { const I = ROUND_ICON[k]; return <span key={k} className='inline-flex items-center gap-1'><I />{ROUND_LABEL[k]}</span> })}
      </div>
    </div>
  )
}

export default function MatchDetail({ matchId, me, memos = {}, onSearch, onMemo }) {
  const agents = useAgents()
  const maps = useMaps()
  const { data, error, loading, reload } = useInvoke('history:detail', [matchId])
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (loading || !data) return (
    <div className='flex flex-col gap-3'>
      <Skeleton className='h-16 rounded-xl' /><Skeleton className='h-48 rounded-xl' /><Skeleton className='h-48 rounded-xl' />
    </div>
  )
  const map = maps[data.mapId]
  const mine = data.players.find(p => p.puuid === me)
  const ffa = data.teams.length > 2
  const team = id => data.teams.find(t => t.id === id)
  const sorted = list => [...list].sort((a, b) => b.points - a.points)
  const myTeam = mine?.team || data.teams[0]?.id
  const result = ffa ? (team(myTeam)?.won ? 'win' : 'loss') : data.teams.every(t => !t.won) ? 'draw' : team(myTeam)?.won ? 'win' : 'loss'
  const R = RESULT[result]
  const groups = ffa ? [{ id: 'all', title: 'Scoreboard', tone: 'text-muted', players: sorted(data.players).sort((a, b) => b.kills - a.kills) }]
    : [myTeam, ...data.teams.map(t => t.id).filter(id => id !== myTeam)].map((id, i) => ({
      id, title: `${i === 0 ? 'Your team' : 'Enemy team'} - ${team(id)?.roundsWon ?? 0} rounds`, tone: team(id)?.won ? 'text-good' : 'text-bad',
      players: sorted(data.players.filter(p => p.team === id)),
    }))
  return (
    <div className='flex flex-col gap-3'>
      <div className='relative overflow-hidden rounded-xl border border-line h-20 flex items-center px-4'>
        {map?.splash && <img src={map.splash} alt='' className='absolute inset-0 w-full h-full object-cover opacity-40' draggable={false} />}
        <div className='absolute inset-0 bg-gradient-to-r from-surface via-surface/70 to-transparent' />
        <div className='relative flex items-center gap-4 w-full'>
          <div>
            <div className={cx('font-display text-2xl font-bold uppercase leading-none', R.text)}>{R.label}</div>
            <div className='text-xs text-muted mt-1'>{map?.displayName || 'Unknown map'} - {data.mode}</div>
          </div>
          {!ffa && <div className='font-display text-3xl font-bold ml-2'>{team(myTeam)?.roundsWon ?? 0}<span className='text-muted mx-1.5'>:</span>{data.teams.find(t => t.id !== myTeam)?.roundsWon ?? 0}</div>}
          <div className='ml-auto text-right text-xs text-muted'>
            <div>{fmtDate(data.start)}</div><div>{fmtLen(data.length)} long</div>
          </div>
        </div>
      </div>
      {groups.map(g => <Scoreboard key={g.id} title={g.title} tone={g.tone} players={g.players} me={me} agents={agents} memos={memos} onSearch={onSearch} onMemo={onMemo} />)}
      {!ffa && data.rounds.length > 1 && <Timeline rounds={data.rounds} teams={data.teams} myTeam={myTeam} />}
      {data.players.some(p => p.hidden) && <Badge className='self-start' title='VALORANT hides other players'>Only you, friends and party members are named; everyone else shows their agent</Badge>}
    </div>
  )
}
