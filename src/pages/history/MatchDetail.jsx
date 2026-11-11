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
    <div className={cx('grid items-center gap-2 px-5 h-[52px] text-[13px] tabular-nums border-t border-line transition-colors', COLS, p.puuid && p.puuid === me ? 'accent-soft' : 'hover:bg-surface-2')}>
      <div className='flex items-center gap-2.5 min-w-0'>
        <AgentIcon id={p.agent} agents={agents} size={34} className='!rounded-xl' />
        <div className='min-w-0'>
          <div title={p.hidden ? 'Name hidden by streamer mode' : undefined} className={cx('truncate font-semibold leading-tight', p.hidden && 'text-muted')}>{playerLabel(p, agents)}</div>
          <div className='flex items-center gap-1.5'>
            {p.hidden && <span title='Name hidden by streamer mode' className='text-[11px] font-medium text-muted'>Hidden</span>}
            {memo && <MemoBadge memo={memo} onClick={() => onMemo(p)} />}
          </div>
        </div>
      </div>
      <TierIcon tier={p.tier} size={24} />
      <span className='font-display font-bold tracking-tight'>{p.acs}</span>
      <span>{p.kills}</span><span>{p.deaths}</span><span>{p.assists}</span>
      <span className={cx('font-semibold', diff > 0 ? 'text-good' : diff < 0 ? 'text-bad' : 'text-muted')}>{diff > 0 ? '+' : ''}{diff}</span>
      <span>{p.adr ?? '-'}</span>
      <span>{p.hs != null ? p.hs : '-'}</span>
      <span className='text-muted'>{p.fb}</span><span className='text-muted'>{p.fd}</span>
      <div className='flex justify-end gap-0.5'>
        {p.puuid && !p.hidden && (
          <>
            <button title='View profile' onClick={() => onSearch(p)} className='w-7 h-7 rounded-full text-muted hover:text-accent hover:bg-surface-2 flex items-center justify-center transition-colors'><FiSearch /></button>
            <button title='Note' onClick={() => onMemo(p)} className='w-7 h-7 rounded-full text-muted hover:text-accent hover:bg-surface-2 flex items-center justify-center transition-colors'><FiEdit3 /></button>
          </>
        )}
      </div>
    </div>
  )
}

function Scoreboard({ title, tone, players, me, agents, memos, onSearch, onMemo }) {
  return (
    <div className='glass rounded-2xl overflow-hidden'>
      <div className='flex items-center justify-between px-5 h-12'>
        <span className='flex items-center gap-2.5'>
          <span className={cx('w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]', tone === 'text-good' ? 'bg-good text-good' : tone === 'text-bad' ? 'bg-bad text-bad' : 'bg-muted text-muted')} />
          <span className='font-display text-[15px] font-bold tracking-tight text-text'>{title}</span>
        </span>
        <span className='eyebrow !text-[10px]'>{players.length} players</span>
      </div>
      <div className={cx('grid gap-2 px-5 h-8 items-center border-t border-line bg-surface-2/50 text-[10px] font-semibold uppercase tracking-[0.08em] text-muted', COLS)}>
        {HEAD.map((h, i) => <span key={i}>{h}</span>)}
      </div>
      {players.map(p => <Row key={p.key} p={p} me={me} agents={agents} memo={memos[p.puuid]} onSearch={onSearch} onMemo={onMemo} />)}
    </div>
  )
}

// Round-by-round strip: one lane per team, icon sits in the lane of the round winner
function Timeline({ rounds, teams, myTeam }) {
  const enemy = teams.find(t => t.id !== myTeam)?.id
  const lanes = [{ id: myTeam, label: 'You' }, { id: enemy, label: 'Enemy' }]
  const gap = i => (i === 12 || i === 24 ? 'ml-3' : '')
  return (
    <div className='glass rounded-2xl p-5 overflow-x-auto'>
      <div className='eyebrow !text-[10px] mb-3'>Rounds</div>
      <div className='flex flex-col gap-1.5 min-w-max'>
        {lanes.map((lane, li) => (
          <div key={lane.id} className='flex items-center gap-1'>
            <span className='w-12 text-[12px] font-semibold text-muted'>{lane.label}</span>
            {rounds.map((r, i) => {
              const Icon = ROUND_ICON[r.kind] || FiClock
              const won = r.winner === lane.id
              return (
                <div key={r.num} className={cx('w-6 h-6 rounded-full flex items-center justify-center text-[11px] border', gap(i),
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
          {rounds.map((r, i) => <span key={r.num} className={cx('w-6 text-center text-[10px] text-muted tabular-nums', gap(i))}>{r.num + 1}</span>)}
        </div>
      </div>
      <div className='flex flex-wrap gap-x-4 gap-y-1.5 mt-3 pt-3 border-t border-line text-[11px] text-muted'>
        {Object.keys(ROUND_ICON).map(k => { const I = ROUND_ICON[k]; return <span key={k} className='inline-flex items-center gap-1.5'><I />{ROUND_LABEL[k]}</span> })}
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
    <div className='flex flex-col gap-4'>
      <Skeleton className='h-24 rounded-2xl' /><Skeleton className='h-48 rounded-xl' /><Skeleton className='h-48 rounded-xl' />
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
    <div className='flex flex-col gap-4'>
      <div className='glass relative overflow-hidden rounded-3xl h-32 flex items-center px-7'>
        {map?.splash && <img decoding='async' src={map.splash} alt='' className='absolute inset-0 w-full h-full object-cover opacity-55' draggable={false} />}
        {/* fades the map art into the modal's own fill so text stays readable on light and dark themes */}
        <div className='absolute inset-0 bg-gradient-to-r from-panel via-panel/75 to-panel/10' />
        <div className='relative flex items-center gap-5 w-full'>
          <div>
            <div className='eyebrow !text-[10px] mb-2'>{data.mode}</div>
            <div className={cx('display text-[40px]', R.text)}>{R.label}</div>
            <div className='text-[12px] text-muted mt-2'>{map?.displayName || 'Unknown map'}</div>
          </div>
          {!ffa && <div className='display text-[48px] tabular-nums ml-6'>{team(myTeam)?.roundsWon ?? 0}<span className='text-muted mx-1.5'>:</span>{data.teams.find(t => t.id !== myTeam)?.roundsWon ?? 0}</div>}
          <div className='ml-auto text-right text-[12px] text-muted leading-relaxed'>
            <div>{fmtDate(data.start)}</div><div>{fmtLen(data.length)} long</div>
          </div>
        </div>
      </div>
      {groups.map(g => <Scoreboard key={g.id} title={g.title} tone={g.tone} players={g.players} me={me} agents={agents} memos={memos} onSearch={onSearch} onMemo={onMemo} />)}
      {!ffa && data.rounds.length > 1 && <Timeline rounds={data.rounds} teams={data.teams} myTeam={myTeam} />}
      {data.players.some(p => p.hidden) && <Badge className='self-start' title='Hidden by streamer mode'>{data.namesLimited
        ? "Couldn't check your current match, so only you, friends and party are named"
        : 'Streamer-mode players in your current match show only their agent'}</Badge>}
    </div>
  )
}
