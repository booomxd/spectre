import { useEffect, useMemo, useRef, useState } from 'react'
import { FiClock } from 'react-icons/fi'
import { invoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'
import { navigate } from '../../nav'
import { Button, Card, Empty, ErrorState, Modal, Skeleton, Tabs } from '../../ui'
import { AgentIcon, RESULT, TierIcon, cx, fmtDate, kd, timeAgo, useAgents, useMaps, useMemos, openPlayer } from './shared'
import MatchDetail from './MatchDetail'
import { MemoModal } from './MemoEditor'

const QUEUES = [
  { value: 'all', label: 'All' }, { value: 'competitive', label: 'Competitive' }, { value: 'unrated', label: 'Unrated' },
  { value: 'swiftplay', label: 'Swiftplay' }, { value: 'deathmatch', label: 'Deathmatch' }, { value: 'premier', label: 'Premier' },
]

// Survives page switches so revisiting history is instant.
const sumCache = new Map()

function Summary({ rows, agents }) {
  const team = rows.filter(r => !r.ffa)
  const wins = team.filter(r => r.result === 'win').length
  const kills = rows.reduce((a, r) => a + r.kills, 0)
  const deaths = rows.reduce((a, r) => a + r.deaths, 0)
  const acs = rows.length ? Math.round(rows.reduce((a, r) => a + r.acs, 0) / rows.length) : 0
  const top = useMemo(() => {
    const c = {}
    rows.forEach(r => { c[r.agent] = (c[r.agent] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [rows])
  const stat = (label, value, sub) => (
    <div className='min-w-[84px]'>
      <div className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>{label}</div>
      <div className='font-display text-2xl font-bold leading-tight'>{value}</div>
      {sub && <div className='text-[11px] text-muted'>{sub}</div>}
    </div>
  )
  return (
    <Card className='anim-rise p-4 mb-4 flex flex-wrap items-center gap-x-8 gap-y-3'>
      {stat('Win rate', team.length ? `${Math.round(wins / team.length * 100)}%` : '-', team.length ? `${wins}W ${team.length - wins}L` : 'no team games')}
      {stat('Avg K/D', kd(kills, deaths), `${kills} / ${deaths}`)}
      {stat('Avg ACS', acs || '-', `${rows.length} matches`)}
      <div className='ml-auto'>
        <div className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted mb-1.5'>Most played</div>
        <div className='flex gap-2'>
          {top.map(([id, n]) => (
            <div key={id} className='relative'>
              <AgentIcon id={id} agents={agents} size={36} />
              <span className='absolute -bottom-1 -right-1 min-w-[16px] h-4 px-1 rounded bg-bg border border-line text-[10px] font-bold flex items-center justify-center'>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function MatchRow({ item, s, rr, agents, maps, index, onOpen }) {
  const map = s && maps[s.mapId]
  if (s === undefined) return <Skeleton className='h-[68px] rounded-xl' />
  if (!s) return (
    <Card className='h-[68px] px-4 flex items-center text-xs text-muted'>Match details unavailable <span className='ml-auto'>{timeAgo(item.start)}</span></Card>
  )
  const R = RESULT[s.result]
  return (
    <Card hover onClick={() => onOpen(item.matchId)} style={{ '--i': index }} className='relative overflow-hidden h-[68px] flex items-stretch'>
      <span className={cx('w-1 shrink-0', R.bar)} />
      <div className='relative w-36 shrink-0'>
        {map?.splash && <img src={map.splash} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover' draggable={false} />}
        <div className='absolute inset-0 bg-gradient-to-r from-black/20 via-surface/40 to-surface' />
        <div className='absolute left-3 bottom-2'>
          <div className='font-display text-sm font-bold uppercase leading-none'>{map?.displayName || 'Map'}</div>
          <div className='text-[10px] text-muted mt-0.5'>{s.mode}</div>
        </div>
      </div>
      <div className='flex items-center gap-4 pl-3 pr-4 flex-1 min-w-0'>
        <AgentIcon id={s.agent} agents={agents} size={42} />
        <div className='w-20'>
          <div className={cx('font-display text-lg font-bold uppercase leading-none', R.text)}>{R.label}</div>
          <div className='text-xs text-muted mt-1'>{s.ffa ? 'Free for all' : `${s.score.us} - ${s.score.them}`}</div>
        </div>
        <div className='w-24'>
          <div className='text-sm font-semibold'>{s.kills} / {s.deaths} / {s.assists}</div>
          <div className='text-[11px] text-muted'>{kd(s.kills, s.deaths)} K/D</div>
        </div>
        <div className='w-14'>
          <div className='font-display text-base font-bold leading-none'>{s.acs}</div>
          <div className='text-[11px] text-muted mt-0.5'>ACS</div>
        </div>
        <div className='w-14 hidden md:block'>
          <div className='font-display text-base font-bold leading-none'>{s.hs != null ? `${s.hs}%` : '-'}</div>
          <div className='text-[11px] text-muted mt-0.5'>HS</div>
        </div>
        <div className='w-16 hidden lg:flex items-center gap-1.5'>
          {rr ? (
            <>
              <TierIcon tier={rr.tierAfter} size={22} />
              <span className={cx('text-sm font-bold', rr.earned > 0 ? 'text-good' : rr.earned < 0 ? 'text-bad' : 'text-muted')}>{rr.earned > 0 ? '+' : ''}{rr.earned}</span>
            </>
          ) : <span className='text-xs text-muted'>-</span>}
        </div>
        <div className='ml-auto text-right text-xs text-muted shrink-0' title={fmtDate(item.start)}>{timeAgo(item.start)}</div>
      </div>
    </Card>
  )
}

// Match list + summary header + scoreboard modal for one player (defaults to you).
export default function HistoryPanel({ puuid, step = 20 }) {
  const riot = useRiot()
  const id = puuid || riot.puuid
  const agents = useAgents()
  const maps = useMaps()
  const { memos, map: memoMap, reload: reloadMemos } = useMemos()
  const [queue, setQueue] = useState('all')
  const [count, setCount] = useState(step)
  const [list, setList] = useState({ data: null, error: null, loading: true })
  const [sums, setSums] = useState({})
  const [rr, setRr] = useState({})
  const [open, setOpen] = useState(null)
  const [memoTarget, setMemoTarget] = useState(null)
  const asked = useRef(new Set())

  useEffect(() => { setQueue('all'); setCount(step); setList({ data: null, error: null, loading: true }); setRr({}) }, [id])
  useEffect(() => { setCount(step); setList(l => ({ ...l, data: null, loading: true })) }, [queue])

  const load = () => {
    if (!id) return () => { }
    let live = true
    setList(l => ({ ...l, loading: true, error: null }))
    invoke('history:list', id, { queue, start: 0, end: count })
      .then(data => live && setList({ data, error: null, loading: false }))
      .catch(e => live && setList(l => ({ ...l, error: e.message, loading: false })))
    return () => { live = false }
  }
  useEffect(load, [id, queue, count])

  useEffect(() => { if (id) invoke('history:rr', id).then(setRr).catch(() => { }) }, [id])

  useEffect(() => {
    for (const m of list.data?.matches || []) {
      const key = `${id}|${m.matchId}`
      if (sumCache.has(key)) { setSums(s => (s[key] === undefined ? { ...s, [key]: sumCache.get(key) } : s)); continue }
      if (asked.current.has(key)) continue
      asked.current.add(key)
      invoke('history:summary', m.matchId, id)
        .catch(() => false)
        .then(r => { sumCache.set(key, r || false); setSums(s => ({ ...s, [key]: r || false })) })
    }
  }, [list.data, id])

  const matches = list.data?.matches || []
  const loaded = matches.map(m => sums[`${id}|${m.matchId}`]).filter(Boolean)
  const allTags = useMemo(() => [...new Set(memos.flatMap(m => m.tags))], [memos])

  const goSearch = p => { setOpen(null); openPlayer(p) }
  const openMemo = p => setMemoTarget({ puuid: p.puuid, name: p.name ? `${p.name.gameName}#${p.name.tagLine}` : '' })

  return (
    <div>
      <div className='flex items-center justify-between gap-3 mb-4'>
        <Tabs tabs={QUEUES} value={queue} onChange={setQueue} />
        {list.data && <span className='text-xs text-muted'>{matches.length} of {list.data.total}</span>}
      </div>

      {list.error && !list.data ? <ErrorState error={list.error} onRetry={load} />
        : list.loading && !list.data ? (
          <div className='flex flex-col gap-2'>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className='h-[68px] rounded-xl' />)}</div>
        ) : !matches.length ? <Empty icon={FiClock} title='No matches found' hint={queue === 'all' ? 'This player has no recent matches, or their history is private.' : 'Nothing in this queue recently. Try another filter.'} />
          : (
            <>
              {loaded.length > 0 && <Summary rows={loaded} agents={agents} />}
              <div className='stagger flex flex-col gap-2'>
                {matches.map((m, i) => (
                  <MatchRow key={m.matchId} item={m} s={sums[`${id}|${m.matchId}`]} rr={rr[m.matchId]} agents={agents} maps={maps} index={Math.min(i, 12)} onOpen={setOpen} />
                ))}
              </div>
              {matches.length < list.data.total && (
                <div className='flex justify-center mt-4'>
                  <Button loading={list.loading} onClick={() => setCount(c => c + step)}>Load more</Button>
                </div>
              )}
            </>
          )}

      <Modal open={!!open} onClose={() => setOpen(null)} width={1000} title='Match'>
        {open && <MatchDetail matchId={open} me={id} memos={memoMap} onSearch={goSearch} onMemo={openMemo} />}
      </Modal>
      <MemoModal open={!!memoTarget} onClose={() => setMemoTarget(null)} target={memoTarget} memos={memoMap} allTags={allTags} onChanged={reloadMemos} />
    </div>
  )
}
