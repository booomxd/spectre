import { useMemo, useState } from 'react'
import { FiActivity, FiRefreshCw } from 'react-icons/fi'
import { useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { Badge, Button, Card, Empty, ErrorState, Page, RequireRiot, SectionTitle, Skeleton, Tabs } from '../ui'
import { AgentIcon, RESULT, TierIcon, cx, playerLabel, timeAgo, useAgents, useMaps, useMemos, openPlayer } from './history/shared'
import { MemoBadge, MemoModal } from './history/MemoEditor'

const FILTERS = [
  { value: 'all', label: 'Everyone' }, { value: 'mate', label: 'Teammates' }, { value: 'opp', label: 'Opponents' }, { value: 'memo', label: "Noted only" },
]

function Chip({ p, people, memo, agents, onMemo }) {
  const seen = p.puuid && people[p.puuid]
  const total = seen ? seen.with + seen.against : 1
  return (
    <div className={cx('group flex items-center gap-2.5 h-12 pl-1.5 pr-3 rounded-full border bg-surface-2 transition-colors hover:border-accent/40',
      p.rel === 'mate' ? 'border-good/30' : 'border-line')}>
      <AgentIcon id={p.agent} agents={agents} size={34} className='!rounded-full' />
      <div className='min-w-0 max-w-[170px]'>
        <button disabled={p.hidden || !p.known} title={p.known ? undefined : 'Hidden by VALORANT'} onClick={() => openPlayer(p)}
          className={cx('block max-w-full truncate text-[13px] font-semibold tracking-tight leading-tight text-left', (p.hidden || !p.known) ? 'text-muted cursor-default' : 'text-text hover:text-accent transition-colors')}>
          {playerLabel(p, agents)}
        </button>
        <div className='flex items-center gap-1.5 text-[11px] text-muted leading-tight mt-0.5'>
          {p.hidden && <span className='font-medium'>Hidden</span>}
          {total > 1 && <span className='text-accent font-bold tabular-nums'>x{total}</span>}
          <span className='tabular-nums'>{p.kills}/{p.deaths}/{p.assists}</span>
        </div>
      </div>
      <TierIcon tier={p.tier} size={22} />
      {memo ? <MemoBadge memo={memo} onClick={() => onMemo(p)} />
        : p.known && !p.hidden && <button onClick={() => onMemo(p)} className='h-6 px-2.5 rounded-full border border-line bg-surface-2 text-[11px] font-semibold text-muted opacity-0 group-hover:opacity-100 hover:text-accent hover:border-accent/40 transition'>Note</button>}
    </div>
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

  const frequent = useMemo(() => Object.values(data?.people || {}).filter(p => !p.hidden && p.with + p.against > 1).sort((a, b) => (b.with + b.against) - (a.with + a.against)).slice(0, 8), [data])
  const openMemo = p => setTarget({ puuid: p.puuid, name: p.name ? `${p.name.gameName}#${p.name.tagLine}` : '' })

  const groups = (data?.matches || []).map(m => ({
    ...m,
    players: m.players.filter(p => (filter === 'all' || (filter === 'memo' ? p.puuid && memoMap[p.puuid] : p.rel === filter))),
  })).filter(m => m.players.length)

  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (loading && !data) return (
    <div className='flex flex-col gap-4'>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className='h-36 rounded-2xl' />)}</div>
  )

  return (
    <>
      <div className='flex items-center justify-between gap-3 mb-5'>
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
        <Button size='sm' icon={FiRefreshCw} loading={loading} onClick={() => reload(true)}>Refresh</Button>
      </div>

      {frequent.length > 0 && filter === 'all' && (
        <div className='mb-7 anim-rise'>
          <SectionTitle>Seen most often</SectionTitle>
          <div className='flex flex-wrap gap-2.5'>
            {frequent.map(f => (
              <button key={f.puuid} onClick={() => openPlayer({ ...f, known: true })} className='glass lift flex items-center gap-2.5 h-12 pl-1.5 pr-4 rounded-full'>
                <AgentIcon id={f.agent} agents={agents} size={34} className='!rounded-full' />
                <div className='text-left'>
                  <div className='text-[13px] font-semibold tracking-tight text-text leading-tight'>{f.name.gameName}<span className='text-muted font-normal'>#{f.name.tagLine}</span></div>
                  <div className='text-[11px] text-muted mt-0.5'>Played with {f.with} / against {f.against}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!groups.length ? <Empty icon={FiActivity} title='Nobody to show' hint={filter === 'memo' ? 'Add notes to players and they show up here.' : 'No recent matches found.'} />
        : (
          <div className='stagger flex flex-col gap-4'>
            {groups.map((m, i) => {
              const R = RESULT[m.result]
              const map = maps[m.mapId]
              return (
                <Card key={m.matchId} style={{ '--i': Math.min(i, 10) }} className='relative overflow-hidden rounded-2xl'>
                  <div className='relative flex items-center gap-3.5 px-5 h-16 border-b border-line'>
                    {map?.splash && <img src={map.splash} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover opacity-30' draggable={false} />}
                    <div className='absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/70 to-bg/20' />
                    <span className={cx('relative w-1 h-8 rounded-full shadow-[0_0_10px_currentColor]', R.bar, R.text)} />
                    <div className='relative'>
                      <div className='font-display text-[17px] font-bold tracking-tight text-text leading-none'>{map?.displayName || 'Match'}</div>
                      <div className='text-[12px] text-muted mt-1.5'>{m.mode} - {timeAgo(m.start)}</div>
                    </div>
                    <div className='relative ml-auto flex items-center gap-2'>
                      {m.score && <span className='font-display text-[13px] font-semibold text-text tabular-nums'>{m.score.us} - {m.score.them}</span>}
                      <Badge tone={R.tone}>{R.label}</Badge>
                    </div>
                  </div>
                  <div className='p-4 flex flex-wrap gap-2.5'>
                    {m.players.map(p => <Chip key={p.key} p={p} people={data.people} memo={p.puuid ? memoMap[p.puuid] : null} agents={agents} onMemo={openMemo} />)}
                  </div>
                </Card>
              )
            })}
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
