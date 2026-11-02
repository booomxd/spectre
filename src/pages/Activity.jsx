import { useMemo, useState } from 'react'
import { FiActivity, FiRefreshCw } from 'react-icons/fi'
import { useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { navigate } from '../nav'
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
    <div className={cx('group flex items-center gap-2 h-11 pl-1.5 pr-2.5 rounded-xl border bg-surface-2 transition-colors',
      p.rel === 'mate' ? 'border-good/25' : 'border-line')}>
      <AgentIcon id={p.agent} agents={agents} size={32} />
      <div className='min-w-0 max-w-[170px]'>
        <button disabled={p.hidden || !p.known} title={p.known ? undefined : 'Hidden by VALORANT'} onClick={() => openPlayer(p)}
          className={cx('block max-w-full truncate text-[13px] font-semibold leading-tight text-left', (p.hidden || !p.known) ? 'text-muted cursor-default' : 'hover:text-accent transition-colors')}>
          {playerLabel(p, agents)}
        </button>
        <div className='flex items-center gap-1.5 text-[10px] text-muted leading-tight'>
          {p.hidden && <span className='uppercase tracking-wider'>Hidden</span>}
          {total > 1 && <span className='text-accent font-bold'>x{total}</span>}
          <span>{p.kills}/{p.deaths}/{p.assists}</span>
        </div>
      </div>
      <TierIcon tier={p.tier} size={22} />
      {memo ? <MemoBadge memo={memo} onClick={() => onMemo(p)} />
        : p.known && !p.hidden && <button onClick={() => onMemo(p)} className='text-[10px] font-bold uppercase tracking-wider text-muted opacity-0 group-hover:opacity-100 hover:text-accent transition'>Note</button>}
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
    <div className='flex flex-col gap-3'>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className='h-32 rounded-xl' />)}</div>
  )

  return (
    <>
      <div className='flex items-center justify-between mb-4'>
        <Tabs tabs={FILTERS} value={filter} onChange={setFilter} />
        <Button size='sm' icon={FiRefreshCw} loading={loading} onClick={() => reload(true)}>Refresh</Button>
      </div>

      {frequent.length > 0 && filter === 'all' && (
        <div className='mb-5 anim-rise'>
          <SectionTitle>Seen most often</SectionTitle>
          <div className='flex flex-wrap gap-2'>
            {frequent.map(f => (
              <button key={f.puuid} onClick={() => openPlayer({ ...f, known: true })} className='lift flex items-center gap-2 h-11 pl-1.5 pr-3 rounded-xl border border-line bg-surface'>
                <AgentIcon id={f.agent} agents={agents} size={32} />
                <div className='text-left'>
                  <div className='text-[13px] font-semibold leading-tight'>{f.name.gameName}<span className='text-muted'>#{f.name.tagLine}</span></div>
                  <div className='text-[10px] text-muted'>Played with {f.with} / against {f.against}</div>
                </div>
              </button>
            ))}
          </div>
        </div>
      )}

      {!groups.length ? <Empty icon={FiActivity} title='Nobody to show' hint={filter === 'memo' ? 'Add notes to players and they show up here.' : 'No recent matches found.'} />
        : (
          <div className='stagger flex flex-col gap-3'>
            {groups.map((m, i) => {
              const R = RESULT[m.result]
              const map = maps[m.mapId]
              return (
                <Card key={m.matchId} style={{ '--i': Math.min(i, 10) }} className='relative overflow-hidden'>
                  <div className='relative flex items-center gap-3 px-4 h-14 border-b border-line'>
                    {map?.splash && <img src={map.splash} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover opacity-25' draggable={false} />}
                    <div className='absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-surface/30' />
                    <span className={cx('relative w-1 h-7 rounded-full', R.bar)} />
                    <div className='relative'>
                      <div className='font-display text-base font-bold uppercase leading-none'>{map?.displayName || 'Match'}</div>
                      <div className='text-[11px] text-muted mt-1'>{m.mode} - {timeAgo(m.start)}</div>
                    </div>
                    <div className='relative ml-auto flex items-center gap-2'>
                      {m.score && <span className='text-xs text-muted'>{m.score.us} - {m.score.them}</span>}
                      <Badge tone={R.tone}>{R.label}</Badge>
                    </div>
                  </div>
                  <div className='p-3 flex flex-wrap gap-2'>
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
