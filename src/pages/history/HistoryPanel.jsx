import { For, Match, Show, Switch, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { st } from '../../lib/st.js'
import { FiClock, FiChevronRight, FiLoader, FiShare2, FiStar } from 'solid-icons/fi'
import { invoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'
import { useTiers } from '../../lib/content'
import { useStored } from '../../lib/stored'
import { drawMatchCard, shareCard } from '../../lib/shareCard'
import logo from '../../assets/spectre-logo.svg'
import { Button, Card, Empty, ErrorState, Modal, Skeleton, toast } from '../../ui'
import { AgentIcon, RESULT, TierIcon, cx, fmtDate, kd, timeAgo, useAgents, useMaps, useMemos, openPlayer } from './shared'
import { CareerBar, FormPills, StatCell, StatStrip } from './career'
import MatchDetail from './MatchDetail'
import { MemoModal } from './MemoEditor'

const QUEUES = [
  { value: 'all', label: 'All' }, { value: 'competitive', label: 'Competitive' }, { value: 'unrated', label: 'Unrated' },
  { value: 'swiftplay', label: 'Swiftplay' }, { value: 'deathmatch', label: 'Deathmatch' }, { value: 'premier', label: 'Premier' },
]

// survives page switches so revisiting history is instant
const sumCache = new Map()

function Summary(props) {
  
    const team = () => (props.rows.filter(r => !r.ffa))
    const wins = () => (team().filter(r => r.result === 'win').length)
    const kills = () => (props.rows.reduce((a, r) => a + r.kills, 0))
    const deaths = () => (props.rows.reduce((a, r) => a + r.deaths, 0))
    const acs = () => (props.rows.length ? Math.round(props.rows.reduce((a, r) => a + r.acs, 0) / props.rows.length) : 0)
    const hsRows = () => (props.rows.filter(r => r.hs != null))
    const hs = () => (hsRows().length ? Math.round(hsRows().reduce((a, r) => a + r.hs, 0) / hsRows().length) : null)
    const rate = () => (team().length ? Math.round(wins() / team().length * 100) : null)
    const top = createMemo(() => {
    const c = {}
    props.rows.forEach(r => { c[r.agent] = (c[r.agent] || 0) + 1 })
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 4)
  })
    return (<StatStrip>
      <StatCell label='Win rate' value={rate() != null ? rate() + '%' : '-'} sub={team().length ? `${wins()}W ${team().length - wins()}L` : 'no team games'} tone={rate() == null ? undefined : rate() >= 50 ? 'good' : 'bad'} />
      <StatCell label='Avg K/D' value={kd(kills(), deaths())} sub={`${kills()} / ${deaths()}`} />
      <StatCell label='Avg ACS' value={acs() || '-'} sub={`${props.rows.length} matches`} />
      <StatCell label='Headshot' value={hs() != null ? hs() + '%' : '-'} sub='average' />
      <StatCell label='Form' sub='oldest to newest' class='min-w-[170px]'>
        <FormPills class='mt-3 h-7' results={team().slice(0, 10).reverse().map(r => r.result)} />
      </StatCell>
      <StatCell label='Most played' class='min-w-[230px]'>
        <div class='flex gap-2.5 mt-2.5'>
          <For each={top()}>{([id, n]) => (
            <div class='relative'>
              <AgentIcon id={id} agents={props.agents} size={36} class='!rounded-xl' />
              <span class='absolute -bottom-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-panel border border-line text-[10px] font-bold tabular-nums flex items-center justify-center'>{n}</span>
            </div>
          )}</For>
        </div>
      </StatCell>
    </StatStrip>)
  
}

function Metric(props) {
  return (
    <div class={props["class"]}>
      <div class={cx('font-display text-[16px] font-bold tracking-tight leading-none tabular-nums', props.tone)}>{props.value}</div>
      <div class='text-[10.5px] font-medium text-muted mt-1.5 uppercase tracking-[0.08em]'>{props.label}</div>
    </div>
  )
}

const titleCase = t => (t || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

function MatchRow(props) {
  const tiersA = useTiers()
  const [sharingS, setSharing] = createSignal(false)
  
    const map = () => (props.s && props.maps[props.s.mapId])
    const share = async e => {
    e.stopPropagation()
    if (sharingS() || !props.s) return
    setSharing(true)
    try {
      const t = props.rr && tiersA()?.[props.rr.tierAfter]
      const agent = props.agents[props.s.agent]
      const blob = await drawMatchCard({
        result: props.s.result, score: props.s.ffa ? null : `${props.s.score.us} - ${props.s.score.them}`, map: [map()?.displayName, props.s.mvp === 'match' ? 'Match MVP' : props.s.mvp === 'team' ? 'Team MVP' : null].filter(Boolean).join('  ·  '), mode: props.s.mode, agent: agent?.displayName,
        kda: `${props.s.kills} / ${props.s.deaths} / ${props.s.assists}`, kd: kd(props.s.kills, props.s.deaths), acs: props.s.acs, hs: props.s.hs != null ? `${props.s.hs}%` : null, adr: props.s.adr,
        rr: props.rr ? props.rr.earned : null, rankName: t ? titleCase(t.tierName) : null, name: props.name, when: fmtDate(props.item.start),
      }, { splash: map()?.splash, agentIcon: agent?.displayIcon, rankIcon: t?.largeIcon || t?.smallIcon, logo })
      const how = await shareCard(blob, `spectre-${(map()?.displayName || 'match').toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${String(props.item.matchId).slice(0, 8)}.png`)
      toast.success(how === 'copied' ? 'Match card copied. Paste it into Discord.' : 'Match card saved to Pictures\\Spectre')
    } catch (err) { toast.error(err.message || 'Could not make the match card') }
    setSharing(false)
  }
    
    
    const R = () => (RESULT[props.s.result])
    const glow = () => (props.s.result === 'win' ? 'var(--good)' : props.s.result === 'loss' ? 'var(--bad)' : 'var(--warn)')
    return (<Show when={!(props.s === undefined)} fallback={<Skeleton class='h-[80px] rounded-2xl' />}><Show when={!(!props.s)} fallback={<Card style={st({ '--i': props.index })} class='h-[80px] px-6 flex items-center text-[12px] text-muted'>Match details unavailable <span class='ml-auto'>{timeAgo(props.item.start)}</span></Card>}><Card hover onClick={() => props.onOpen(props.item.matchId)} style={st({ '--i': props.index })} class='group relative overflow-hidden h-[80px] flex items-stretch'>
      {/* result tint washes in from the left edge */}
      <span class='absolute inset-y-0 left-0 w-1/2 pointer-events-none' style={st({ background: `linear-gradient(90deg, rgb(${glow()} / 0.13), transparent)` })} />
      <span class={cx('absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full', R().bar)} style={st({ boxShadow: `0 0 12px rgb(${glow()} / 0.7)` })} />
      <div class='relative w-44 shrink-0'>
        {/* map art fades into the glass row */}
        {map()?.splash && (
          <div class='absolute inset-0' style={st({ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 50%, transparent)', maskImage: 'linear-gradient(90deg, transparent, #000 25%, #000 50%, transparent)' })}>
            <img decoding='async' src={map().splash} alt='' loading='lazy' class='absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-105' draggable={false} />
            <div class='absolute inset-0 bg-gradient-to-t from-black/75 via-black/30 to-black/5' />
          </div>
        )}
        <div class='absolute left-5 bottom-3'>
          <div class={cx('font-display text-[16px] font-bold tracking-tight leading-none', map()?.splash ? 'text-white' : 'text-text')}>{map()?.displayName || 'Map'}</div>
          <div class={cx('text-[11px] mt-1', map()?.splash ? 'text-white/75' : 'text-muted')}>{props.s.mode}</div>
        </div>
      </div>
      <div class='relative flex items-center gap-6 pl-3 pr-5 flex-1 min-w-0'>
        <AgentIcon id={props.s.agent} agents={props.agents} size={46} class='!rounded-xl' />
        <div class='w-24'>
          <div class={cx('display text-[22px]', R().text)}>{R().label}</div>
          <div class='text-[12px] text-muted mt-1 tabular-nums'>{props.s.ffa ? 'Free for all' : `${props.s.score.us} - ${props.s.score.them}`}</div>
        </div>
        <Metric class='w-24' value={`${props.s.kills} / ${props.s.deaths} / ${props.s.assists}`} label={`${kd(props.s.kills, props.s.deaths)} K/D`} />
        <Metric class='w-14' value={props.s.acs} label='ACS' />
        <Metric class='w-14 hidden md:block' value={props.s.hs != null ? `${props.s.hs}%` : '-'} label='HS' />
        <div class='w-20 hidden lg:flex items-center gap-2'>
          {props.rr ? (
            <>
              <TierIcon tier={props.rr.tierAfter} size={24} />
              <span class={cx('font-display text-[16px] font-bold tabular-nums', props.rr.earned > 0 ? 'text-good' : props.rr.earned < 0 ? 'text-bad' : 'text-muted')}>{props.rr.earned > 0 ? '+' : ''}{props.rr.earned}</span>
            </>
          ) : <span class='text-[12px] text-muted'>-</span>}
        </div>
        <div class='ml-auto flex items-center gap-3 shrink-0'>
          {props.s.mvp && (
            <span title={props.s.mvp === 'match' ? 'Top combat score on the winning team' : 'Top combat score on the team'}
              class={cx('inline-flex items-center gap-1.5 h-6 px-2.5 rounded-full border text-[10.5px] font-bold uppercase tracking-[0.08em] whitespace-nowrap',
                props.s.mvp === 'match' ? 'bg-warn/12 text-warn border-warn/35' : 'bg-surface-2 text-text border-line')}>
              <FiStar size={11} fill={props.s.mvp === 'match' ? 'currentColor' : 'none'} />{props.s.mvp === 'match' ? 'Match MVP' : 'Team MVP'}
            </span>
          )}
          <button type='button' aria-label='Copy a share card for this match' title='Copy share card' onClick={share} onKeyDown={e => e.stopPropagation()}
            class={cx('w-8 h-8 rounded-full glass-inset flex items-center justify-center text-muted hover:text-accent transition-[opacity,color] duration-200 focus-visible:opacity-100', sharingS() ? 'opacity-100' : 'opacity-0 group-hover:opacity-100')}>
            {sharingS() ? <FiLoader class='animate-spin' size={13} /> : <FiShare2 size={13} />}
          </button>
          <span class='text-[12px] text-muted' title={fmtDate(props.item.start)}>{timeAgo(props.item.start)}</span>
          <FiChevronRight class='text-muted transition-transform duration-300 ease-out group-hover:translate-x-0.5 group-hover:text-accent' />
        </div>
      </div>
    </Card></Show></Show>)
  
}

// match list + summary header + scoreboard modal for one player
export default function HistoryPanel(props) {
  const riotA = useRiot()
  const agentsA = useAgents()
  const mapsA = useMaps()
  const memos = useMemos()
  const step = () => props.step ?? 20
  const id = () => props.puuid || riotA().puuid
  const own = () => !props.puuid || props.puuid === riotA().puuid
  const [savedQueueS, saveQueue] = useStored('history-queue', 'all', QUEUES.map(q => q.value))
  const [queueS, setQueueState] = createSignal(own() ? savedQueueS() : 'all')
  const [countS, setCount] = createSignal(step())
  const [listS, setList] = createSignal({ data: null, error: null, loading: true })
  // per-match stores: a row only re-renders when its own summary or rr arrives
  const [sums, setSums] = createStore({})
  const [rr, setRr] = createStore({})
  const [openS, setOpen] = createSignal(null)
  const [memoTargetS, setMemoTarget] = createSignal(null)
  const asked = new Set()
  const setQueue = q => { setQueueState(q); if (own()) saveQueue(q) }

  // switching to another player resets the filter
  createEffect(on(id, () => {
    setQueueState(own() ? savedQueueS() : 'all')
    setCount(step()); setList({ data: null, error: null, loading: true }); setRr(reconcile({}))
  }, { defer: true }))
  createEffect(on(queueS, () => { setCount(step()); setList(l => ({ ...l, data: null, loading: true })) }, { defer: true }))
  const load = () => {
    const who = id()
    if (!who) return
    let live = true
    setList(l => ({ ...l, loading: true, error: null }))
    invoke('history:list', who, { queue: queueS(), start: 0, end: countS() })
      .then(data => live && setList({ data, error: null, loading: false }))
      .catch(e => live && setList(l => ({ ...l, error: e.message, loading: false })))
    onCleanup(() => { live = false })
  }
  createEffect(on([id, queueS, countS], load))
  createEffect(on(id, who => {
    if (!who) return
    let live = true
    invoke('history:rr', who).then(r => live && setRr(reconcile(r || {}))).catch(() => { })
    onCleanup(() => { live = false })
  }))
  createEffect(on([() => listS().data, id], ([data, who]) => {
    for (const m of data?.matches || []) {
      const key = `${who}|${m.matchId}`
      if (sumCache.has(key)) { if (sums[key] === undefined) setSums(key, sumCache.get(key)); continue }
      if (asked.has(key)) continue
      asked.add(key)
      invoke('history:summary', m.matchId, who)
        .catch(() => false)
        .then(r => { sumCache.set(key, r || false); setSums(key, r || false) })
    }
  }))

  // "Load more" refetches from the top, so reuse the match objects already shown (finished matches never change):
  // <For> then keeps their rows, share state and focus, and only appends the new ones
  const seen = new Map()
  const matches = createMemo(() => (listS().data?.matches || []).map(m => {
    const k = `${id()}|${m.matchId}`
    if (!seen.has(k)) seen.set(k, m)
    return seen.get(k)
  }))
  const loaded = createMemo(() => matches().map(m => sums[`${id()}|${m.matchId}`]).filter(Boolean))
  const allTags = createMemo(() => [...new Set(memos.memos.flatMap(m => m.tags))])
  const goSearch = p => { setOpen(null); openPlayer(p) }
  const openMemo = p => setMemoTarget({ puuid: p.puuid, name: p.name ? `${p.name.gameName}#${p.name.tagLine}` : '' })
  const state = createMemo(() => {
    const l = listS()
    if (l.error && !l.data) return 'error'
    if (l.loading && !l.data) return 'loading'
    return matches().length ? 'list' : 'empty'
  })

  return (
    <div>
      <CareerBar tabs={QUEUES} value={queueS()} onChange={setQueue}
        right={listS().data && <span>{matches().length} of {listS().data.total} matches</span>} />

      <Switch>
        <Match when={state() === 'error'}><ErrorState error={listS().error} onRetry={load} /></Match>
        <Match when={state() === 'loading'}>
          <div class='flex flex-col gap-2.5'><Skeleton class='h-[98px] rounded-2xl mb-2.5' /><For each={Array.from({ length: 6 })}>{() => <Skeleton class='h-[80px] rounded-2xl' />}</For></div>
        </Match>
        <Match when={state() === 'empty'}>
          <Empty icon={FiClock} title='No matches found' hint={queueS() === 'all' ? 'This player has no recent matches, or their history is private.' : 'Nothing in this queue recently. Try another filter.'} />
        </Match>
        <Match when={state() === 'list'}>
          <Show when={loaded().length > 0} fallback={<StatStrip loading />}><Summary rows={loaded()} agents={agentsA()} /></Show>
          <div class='stagger cv-list flex flex-col gap-2.5'>
            <For each={matches()}>{(m, i) => (
              <MatchRow item={m} s={sums[`${id()}|${m.matchId}`]} rr={rr[m.matchId]} agents={agentsA()} maps={mapsA()} index={Math.min(i(), 12)} onOpen={setOpen} name={id() === riotA().puuid ? riotA().gameName : null} />
            )}</For>
          </div>
          <Show when={matches().length < (listS().data?.total || 0)}>
            <div class='flex justify-center mt-6'>
              <Button loading={listS().loading} onClick={() => setCount(c => c + step())}>Load more</Button>
            </div>
          </Show>
        </Match>
      </Switch>

      <Modal open={!!openS()} onClose={() => setOpen(null)} width={1000} title='Match'>
        <Show when={openS()} keyed>{mid => <MatchDetail matchId={mid} me={id()} memos={memos.map} onSearch={goSearch} onMemo={openMemo} />}</Show>
      </Modal>
      <MemoModal open={!!memoTargetS()} onClose={() => setMemoTarget(null)} target={memoTargetS()} memos={memos.map} allTags={allTags()} onChanged={memos.reload} />
    </div>
  )
}
