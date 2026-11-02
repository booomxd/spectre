import { useEffect, useMemo, useRef, useState } from 'react'
import { FiClock } from 'react-icons/fi'
import { invoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'
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
    <div className='min-w-[90px]'>
      <div className='text-[12px] font-medium text-muted'>{label}</div>
      <div className='font-display text-[26px] font-bold tracking-tight leading-tight tabular-nums mt-0.5'>{value}</div>
      {sub && <div className='text-[11px] text-muted tabular-nums'>{sub}</div>}
    </div>
  )
  return (
    <Card className='anim-rise p-5 mb-5 flex flex-wrap items-center gap-x-10 gap-y-4'>
      {stat('Win rate', team.length ? `${Math.round(wins / team.length * 100)}%` : '-', team.length ? `${wins}W ${team.length - wins}L` : 'no team games')}
      {stat('Avg K/D', kd(kills, deaths), `${kills} / ${deaths}`)}
      {stat('Avg ACS', acs || '-', `${rows.length} matches`)}
      <div className='ml-auto'>
        <div className='text-[12px] font-medium text-muted mb-2'>Most played</div>
        <div className='flex gap-2.5'>
          {top.map(([id, n]) => (
            <div key={id} className='relative'>
              <AgentIcon id={id} agents={agents} size={36} />
              <span className='absolute -bottom-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-panel border border-line text-[10px] font-bold tabular-nums flex items-center justify-center'>{n}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function MatchRow({ item, s, rr, agents, maps, index, onOpen }) {
  const map = s && maps[s.mapId]
  if (s === undefined) return <Skeleton className='h-[72px] rounded-xl' />
  if (!s) return (
    <Card className='h-[72px] px-5 flex items-center text-[12px] text-muted'>Match details unavailable <span className='ml-auto'>{timeAgo(item.start)}</span></Card>
  )
  const R = RESULT[s.result]
  return (
    <Card hover onClick={() => onOpen(item.matchId)} style={{ '--i': index }} className='relative overflow-hidden h-[72px] flex items-stretch'>
      <span className={cx('w-[3px] shrink-0 my-3 rounded-r-full', R.bar)} />
      <div className='relative w-36 shrink-0'>
        {/* Map art fades into the glass row; the dark scrim keeps the white label legible on any theme. */}
        {map?.splash && (
          <div className='absolute inset-0' style={{ WebkitMaskImage: 'linear-gradient(90deg, #000 55%, transparent)', maskImage: 'linear-gradient(90deg, #000 55%, transparent)' }}>
            <img src={map.splash} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover' draggable={false} />
            <div className='absolute inset-0 bg-gradient-to-t from-black/70 via-black/25 to-black/5' />
          </div>
        )}
        <div className='absolute left-3.5 bottom-2.5'>
          <div className={cx('font-display text-[15px] font-bold tracking-tight leading-none', map?.splash ? 'text-white' : 'text-text')}>{map?.displayName || 'Map'}</div>
          <div className={cx('text-[11px] mt-1', map?.splash ? 'text-white/75' : 'text-muted')}>{s.mode}</div>
        </div>
      </div>
      <div className='flex items-center gap-5 pl-4 pr-5 flex-1 min-w-0'>
        <AgentIcon id={s.agent} agents={agents} size={42} />
        <div className='w-20'>
          <div className={cx('font-display text-lg font-bold tracking-tight leading-none', R.text)}>{R.label}</div>
          <div className='text-[12px] text-muted mt-1 tabular-nums'>{s.ffa ? 'Free for all' : `${s.score.us} - ${s.score.them}`}</div>
        </div>
        <div className='w-24'>
          <div className='text-sm font-semibold tabular-nums'>{s.kills} / {s.deaths} / {s.assists}</div>
          <div className='text-[11px] text-muted mt-0.5 tabular-nums'>{kd(s.kills, s.deaths)} K/D</div>
        </div>
        <div className='w-14'>
          <div className='font-display text-base font-bold tracking-tight leading-none tabular-nums'>{s.acs}</div>
          <div className='text-[11px] text-muted mt-0.5'>ACS</div>
        </div>
        <div className='w-14 hidden md:block'>
          <div className='font-display text-base font-bold tracking-tight leading-none tabular-nums'>{s.hs != null ? `${s.hs}%` : '-'}</div>
          <div className='text-[11px] text-muted mt-0.5'>HS</div>
        </div>
        <div className='w-16 hidden lg:flex items-center gap-1.5'>
          {rr ? (
            <>
              <TierIcon tier={rr.tierAfter} size={22} />
              <span className={cx('text-sm font-bold tabular-nums', rr.earned > 0 ? 'text-good' : rr.earned < 0 ? 'text-bad' : 'text-muted')}>{rr.earned > 0 ? '+' : ''}{rr.earned}</span>
            </>
          ) : <span className='text-[12px] text-muted'>-</span>}
        </div>
        <div className='ml-auto text-right text-[12px] text-muted shrink-0' title={fmtDate(item.start)}>{timeAgo(item.start)}</div>
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
      <div className='flex items-center justify-between gap-4 mb-5'>
        <Tabs tabs={QUEUES} value={queue} onChange={setQueue} />
        {list.data && <span className='text-[12px] text-muted tabular-nums'>{matches.length} of {list.data.total}</span>}
      </div>

      {list.error && !list.data ? <ErrorState error={list.error} onRetry={load} />
        : list.loading && !list.data ? (
          <div className='flex flex-col gap-2.5'>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className='h-[72px] rounded-xl' />)}</div>
        ) : !matches.length ? <Empty icon={FiClock} title='No matches found' hint={queue === 'all' ? 'This player has no recent matches, or their history is private.' : 'Nothing in this queue recently. Try another filter.'} />
          : (
            <>
              {loaded.length > 0 && <Summary rows={loaded} agents={agents} />}
              <div className='stagger flex flex-col gap-2.5'>
                {matches.map((m, i) => (
                  <MatchRow key={m.matchId} item={m} s={sums[`${id}|${m.matchId}`]} rr={rr[m.matchId]} agents={agents} maps={maps} index={Math.min(i, 12)} onOpen={setOpen} />
                ))}
              </div>
              {matches.length < list.data.total && (
                <div className='flex justify-center mt-5'>
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
