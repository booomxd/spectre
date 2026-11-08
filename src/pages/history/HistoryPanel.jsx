import { useEffect, useMemo, useRef, useState } from 'react'
import { FiClock, FiChevronRight } from 'react-icons/fi'
import { invoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'
import { Button, Card, Empty, ErrorState, Modal, Skeleton } from '../../ui'
import { AgentIcon, RESULT, TierIcon, cx, fmtDate, kd, timeAgo, useAgents, useMaps, useMemos, openPlayer } from './shared'
import { CareerBar, FormPills, StatCell, StatStrip } from './career'
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
  const hsRows = rows.filter(r => r.hs != null)
  const hs = hsRows.length ? Math.round(hsRows.reduce((a, r) => a + r.hs, 0) / hsRows.length) : null
  const rate = team.length ? Math.round(wins / team.length * 100) : null
  const top = useMemo(() => {
    const c = {}
    rows.forEach(r => { c[r.agent] = (c[r.agent] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4)
  }, [rows])
  return (
    <StatStrip>
      <StatCell label='Win rate' value={rate != null ? rate + '%' : '-'} sub={team.length ? `${wins}W ${team.length - wins}L` : 'no team games'} tone={rate == null ? undefined : rate >= 50 ? 'good' : 'bad'} />
      <StatCell label='Avg K/D' value={kd(kills, deaths)} sub={`${kills} / ${deaths}`} />
      <StatCell label='Avg ACS' value={acs || '-'} sub={`${rows.length} matches`} />
      <StatCell label='Headshot' value={hs != null ? hs + '%' : '-'} sub='average' />
      <StatCell label='Form' sub='oldest to newest' className='min-w-[170px]'>
        <FormPills className='mt-3 h-7' results={team.slice(0, 10).reverse().map(r => r.result)} />
      </StatCell>
      <StatCell label='Most played' className='min-w-[230px]'>
        <div className='flex gap-2.5 mt-2.5'>
          {top.map(([id, n]) => (
            <div key={id} className='relative'>
              <AgentIcon id={id} agents={agents} size={36} className='!rounded-xl' />
              <span className='absolute -bottom-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-panel border border-line text-[10px] font-bold tabular-nums flex items-center justify-center'>{n}</span>
            </div>
          ))}
        </div>
      </StatCell>
    </StatStrip>
  )
}

function Metric({ value, label, className, tone }) {
  return (
    <div className={className}>
      <div className={cx('font-display text-[16px] font-bold tracking-tight leading-none tabular-nums', tone)}>{value}</div>
      <div className='text-[10.5px] font-medium text-muted mt-1.5 uppercase tracking-[0.08em]'>{label}</div>
    </div>
  )
}

function MatchRow({ item, s, rr, agents, maps, index, onOpen }) {
  const map = s && maps[s.mapId]
  if (s === undefined) return <Skeleton className='h-[80px] rounded-2xl' />
  if (!s) return (
    <Card style={{ '--i': index }} className='h-[80px] px-6 flex items-center text-[12px] text-muted'>Match details unavailable <span className='ml-auto'>{timeAgo(item.start)}</span></Card>
  )
  const R = RESULT[s.result]
  const glow = s.result === 'win' ? 'var(--good)' : s.result === 'loss' ? 'var(--bad)' : 'var(--warn)'
  return (
    <Card hover onClick={() => onOpen(item.matchId)} style={{ '--i': index }} className='group relative overflow-hidden h-[80px] flex items-stretch'>
      {/* Result tint washes in from the left edge. */}
      <span className='absolute inset-y-0 left-0 w-1/2 pointer-events-none' style={{ background: `linear-gradient(90deg, rgb(${glow} / 0.13), transparent)` }} />
      <span className={cx('absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full', R.bar)} style={{ boxShadow: `0 0 12px rgb(${glow} / 0.7)` }} />
      <div className='relative w-44 shrink-0'>
        {/* Map art fades into the glass row; the dark scrim keeps the white label legible on any theme. */}
        {map?.splash && (
          <div className='absolute inset-0' style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 50%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 50%, transparent)' }}>
            <img src={map.splash} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105' draggable={false} />
            <div className='absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5' />
          </div>
        )}
        <div className='absolute left-5 bottom-3'>
          <div className={cx('font-display text-[16px] font-bold tracking-tight leading-none', map?.splash ? 'text-white' : 'text-text')}>{map?.displayName || 'Map'}</div>
          <div className={cx('text-[11px] mt-1', map?.splash ? 'text-white/75' : 'text-muted')}>{s.mode}</div>
        </div>
      </div>
      <div className='relative flex items-center gap-6 pl-3 pr-5 flex-1 min-w-0'>
        <AgentIcon id={s.agent} agents={agents} size={46} className='!rounded-xl' />
        <div className='w-24'>
          <div className={cx('display text-[22px]', R.text)}>{R.label}</div>
          <div className='text-[12px] text-muted mt-1 tabular-nums'>{s.ffa ? 'Free for all' : `${s.score.us} - ${s.score.them}`}</div>
        </div>
        <Metric className='w-24' value={`${s.kills} / ${s.deaths} / ${s.assists}`} label={`${kd(s.kills, s.deaths)} K/D`} />
        <Metric className='w-14' value={s.acs} label='ACS' />
        <Metric className='w-14 hidden md:block' value={s.hs != null ? `${s.hs}%` : '-'} label='HS' />
        <div className='w-20 hidden lg:flex items-center gap-2'>
          {rr ? (
            <>
              <TierIcon tier={rr.tierAfter} size={24} />
              <span className={cx('font-display text-[16px] font-bold tabular-nums', rr.earned > 0 ? 'text-good' : rr.earned < 0 ? 'text-bad' : 'text-muted')}>{rr.earned > 0 ? '+' : ''}{rr.earned}</span>
            </>
          ) : <span className='text-[12px] text-muted'>-</span>}
        </div>
        <div className='ml-auto flex items-center gap-3 shrink-0'>
          <span className='text-[12px] text-muted' title={fmtDate(item.start)}>{timeAgo(item.start)}</span>
          <FiChevronRight className='text-muted transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-accent' />
        </div>
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
      <CareerBar tabs={QUEUES} value={queue} onChange={setQueue}
        right={list.data && <span>{matches.length} of {list.data.total} matches</span>} />

      {list.error && !list.data ? <ErrorState error={list.error} onRetry={load} />
        : list.loading && !list.data ? (
          <div className='flex flex-col gap-2.5'><Skeleton className='h-[98px] rounded-2xl mb-2.5' />{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className='h-[80px] rounded-2xl' />)}</div>
        ) : !matches.length ? <Empty icon={FiClock} title='No matches found' hint={queue === 'all' ? 'This player has no recent matches, or their history is private.' : 'Nothing in this queue recently. Try another filter.'} />
          : (
            <>
              {loaded.length > 0 ? <Summary rows={loaded} agents={agents} /> : <StatStrip loading />}
              <div className='stagger flex flex-col gap-2.5'>
                {matches.map((m, i) => (
                  <MatchRow key={m.matchId} item={m} s={sums[`${id}|${m.matchId}`]} rr={rr[m.matchId]} agents={agents} maps={maps} index={Math.min(i, 12)} onOpen={setOpen} />
                ))}
              </div>
              {matches.length < list.data.total && (
                <div className='flex justify-center mt-6'>
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
