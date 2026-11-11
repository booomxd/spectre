import { useMemo, useState } from 'react'
import { FiActivity, FiRefreshCw } from 'react-icons/fi'
import { useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { Badge, Button, Card, Empty, ErrorState, Heading, Item, Page, RequireRiot, Skeleton, Stagger } from '../ui'
import { AgentIcon, RESULT, TierIcon, cx, playerLabel, timeAgo, useAgents, useMaps, useMemos, openPlayer } from './history/shared'
import { CareerBar, StatCell, StatStrip } from './history/career'
import { MemoBadge, MemoModal } from './history/MemoEditor'

const FILTERS = [
  { value: 'all', label: 'Everyone' }, { value: 'mate', label: 'Teammates' }, { value: 'opp', label: 'Opponents' }, { value: 'memo', label: 'Noted only' },
]

function Chip({ p, people, memo, agents, onMemo }) {
  const seen = p.puuid && people[p.puuid]
  const total = seen ? seen.with + seen.against : 1
  return (
    <div className={cx('group flex items-center gap-2.5 h-[52px] pl-1.5 pr-3 rounded-2xl glass-inset transition-[border-color,transform] duration-200 hover:border-accent/40',
      p.rel === 'mate' && '!border-good/25')}>
      <AgentIcon id={p.agent} agents={agents} size={38} className='!rounded-xl' />
      <div className='min-w-0 flex-1'>
        <button disabled={p.hidden || !p.known} title={p.known ? undefined : 'Hidden by VALORANT'} onClick={() => openPlayer(p)}
          className={cx('block max-w-full truncate text-[13px] font-semibold tracking-tight leading-tight text-left', (p.hidden || !p.known) ? 'text-muted cursor-default' : 'text-text hover:text-accent transition-colors')}>
          {playerLabel(p, agents)}
        </button>
        <div className='flex items-center gap-1.5 text-[11px] text-muted leading-tight mt-1'>
          {p.hidden && <span className='font-medium'>Hidden</span>}
          {total > 1 && <span className='text-accent font-bold tabular-nums'>x{total}</span>}
          <span className='tabular-nums'>{p.kills}/{p.deaths}/{p.assists}</span>
        </div>
      </div>
      <TierIcon tier={p.tier} size={22} />
      {memo ? <MemoBadge memo={memo} onClick={() => onMemo(p)} />
        : p.known && !p.hidden && <button onClick={() => onMemo(p)} className='h-6 px-2.5 rounded-full border border-line text-[11px] font-semibold text-muted opacity-0 group-hover:opacity-100 hover:text-accent hover:border-accent/40 transition'>Note</button>}
    </div>
  )
}

// one recent match: map banner on the left, the people in it on the right
function MatchCard({ m, people, memoMap, agents, maps, onMemo }) {
  const R = RESULT[m.result]
  const map = maps[m.mapId]
  const glow = m.result === 'win' ? 'var(--good)' : m.result === 'loss' ? 'var(--bad)' : 'var(--warn)'
  return (
    <Card className='relative overflow-hidden flex flex-col md:flex-row'>
      <div className='relative md:w-52 shrink-0 h-24 md:h-auto overflow-hidden'>
        {map?.splash && <img decoding='async' src={map.splash} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover' draggable={false} />}
        <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10' />
        <span className='absolute inset-0' style={{ background: `linear-gradient(180deg, transparent 40%, rgb(${glow} / 0.28))` }} />
        <div className='relative h-full p-5 flex flex-col justify-end'>
          <div className='flex items-center gap-2'>
            <span className={cx('w-1.5 h-1.5 rounded-full', R.bar)} style={{ boxShadow: `0 0 10px rgb(${glow})` }} />
            <span className={cx('text-[11px] font-bold uppercase tracking-[0.12em]', map?.splash ? 'text-white/90' : R.text)}>{R.label}{m.score ? ` ${m.score.us}-${m.score.them}` : ''}</span>
          </div>
          <div className={cx('display text-[22px] mt-1.5', map?.splash ? 'text-white' : 'text-text')}>{map?.displayName || 'Match'}</div>
          <div className={cx('text-[11.5px] mt-1', map?.splash ? 'text-white/70' : 'text-muted')}>{m.mode} - {timeAgo(m.start)}</div>
        </div>
      </div>
      <div className='flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 content-start'>
        {m.players.map(p => <Chip key={p.key} p={p} people={people} memo={p.puuid ? memoMap[p.puuid] : null} agents={agents} onMemo={onMemo} />)}
      </div>
    </Card>
  )
}

function Content() {
  const riot = useRiot()
  const agents = useAgents()
  const maps = useMaps()
  const { data, error, loading, reload } = useInvoke('activity:recent', [20], { skip: !riot.connected })
  const { memos, map: memoMap, reload: reloadMemos } = useMemos()
  const [filter, setFilter] = useState('all')
  const [target, setTarget] = useState(null)
  const allTags = useMemo(() => [...new Set(memos.flatMap(m => m.tags))], [memos])

  const named = useMemo(() => Object.values(data?.people || {}).filter(p => !p.hidden), [data])
  const repeat = useMemo(() => named.filter(p => p.with + p.against > 1).sort((a, b) => (b.with + b.against) - (a.with + a.against)), [named])
  const frequent = repeat.slice(0, 8)
  const openMemo = p => setTarget({ puuid: p.puuid, name: p.name ? `${p.name.gameName}#${p.name.tagLine}` : '' })

  const groups = (data?.matches || []).map(m => ({
    ...m,
    players: m.players.filter(p => (filter === 'all' || (filter === 'memo' ? p.puuid && memoMap[p.puuid] : p.rel === filter))),
  })).filter(m => m.players.length)
  const noted = named.filter(p => memoMap[p.puuid]).length

  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (loading && !data) return (
    <div className='flex flex-col gap-4'><Skeleton className='h-10 w-96 rounded-full' /><Skeleton className='h-[98px] rounded-2xl' />{Array.from({ length: 3 }, (_, i) => <Skeleton key={i} className='h-40 rounded-2xl' />)}</div>
  )

  return (
    <>
      <CareerBar tabs={FILTERS} value={filter} onChange={setFilter} layoutId='career-encounters'
        right={<Button size='sm' icon={FiRefreshCw} loading={loading} onClick={() => reload(true)}>Refresh</Button>} />

      <StatStrip>
        <StatCell label='Matches scanned' value={data?.matches?.length ?? 0} sub='most recent first' />
        <StatCell label='Named players' value={named.length} sub='friends and party' />
        <StatCell label='Played with' value={named.filter(p => p.with > 0).length} sub='as teammates' tone='good' />
        <StatCell label='Played against' value={named.filter(p => p.against > 0).length} sub='as opponents' />
        <StatCell label='Repeat encounters' value={repeat.length} sub='seen more than once' tone='accent' />
        <StatCell label='With notes' value={noted} sub='from your Notes' />
      </StatStrip>

      {frequent.length > 0 && filter === 'all' && (
        <div className='mb-7'>
          <Heading hint='Named players who keep showing up in your games'>Seen most often</Heading>
          <Stagger className='grid grid-cols-2 lg:grid-cols-4 gap-3'>
            {frequent.map((f, i) => {
              const total = f.with + f.against
              return (
                <Item key={f.puuid} index={i}>
                  <Card as='button' hover onClick={() => openPlayer({ ...f, known: true })} className='w-full text-left p-4'>
                    <div className='flex items-center gap-3'>
                      <AgentIcon id={f.agent} agents={agents} size={40} className='!rounded-xl' />
                      <div className='min-w-0 flex-1'>
                        <div className='truncate text-[13.5px] font-semibold tracking-tight text-text'>{f.name.gameName}<span className='text-muted font-normal'>#{f.name.tagLine}</span></div>
                        <div className='text-[11px] text-muted mt-0.5'>{f.friend ? 'Friend' : 'Party'} - {total} games</div>
                      </div>
                    </div>
                    <div className='mt-3.5 h-1.5 rounded-full glass-inset overflow-hidden flex'>
                      <span className='h-full bg-good' style={{ flex: f.with }} />
                      <span className='h-full bg-bad/80' style={{ flex: f.against }} />
                    </div>
                    <div className='mt-1.5 flex justify-between text-[10.5px] text-muted tabular-nums'><span>With {f.with}</span><span>Against {f.against}</span></div>
                  </Card>
                </Item>
              )
            })}
          </Stagger>
        </div>
      )}

      {groups.length > 0 && <Heading hint={`${groups.length} matches`} right={memos.length > 0 && <Badge>{memos.length} notes saved</Badge>}>Recent matches</Heading>}
      {!groups.length ? <Empty icon={FiActivity} title='Nobody to show' hint={filter === 'memo' ? 'Add notes to players and they show up here.' : 'No recent matches found.'} />
        : (
          <div className='stagger flex flex-col gap-3'>
            {groups.map((m, i) => (
              <div key={m.matchId} style={{ '--i': Math.min(i, 12) }}>
                <MatchCard m={m} people={data.people} memoMap={memoMap} agents={agents} maps={maps} onMemo={openMemo} />
              </div>
            ))}
          </div>
        )}
      <MemoModal open={!!target} onClose={() => setTarget(null)} target={target} memos={memoMap} allTags={allTags} onChanged={reloadMemos} />
    </>
  )
}

export default function Activity() {
  return (
    <Page title='Encounters' subtitle='Friends and party you played with in your last 20 matches. Other players stay hidden.'>
      <RequireRiot><Content /></RequireRiot>
    </Page>
  )
}
