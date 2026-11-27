import { For, createSignal, Show, createMemo } from 'solid-js'
import { st } from '../lib/st.js'
import { FiActivity, FiRefreshCw } from 'solid-icons/fi'
import { useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { Badge, Button, Card, Empty, ErrorState, Heading, Item, Page, RequireRiot, Skeleton, Stagger } from '../ui'
import { AgentIcon, RESULT, TierIcon, cx, playerLabel, timeAgo, useAgents, useMaps, useMemos, openPlayer } from './history/shared'
import { CareerBar, StatCell, StatStrip } from './history/career'
import { MemoBadge, MemoModal } from './history/MemoEditor'

const FILTERS = [
  { value: 'all', label: 'Everyone' }, { value: 'mate', label: 'Teammates' }, { value: 'opp', label: 'Opponents' }, { value: 'memo', label: 'Noted only' },
]

function Chip(props) {
  
    const seen = () => (props.p.puuid && props.people[props.p.puuid])
    const total = () => (seen() ? seen().with + seen().against : 1)
    return (<div class={cx('group flex items-center gap-2.5 h-[52px] pl-1.5 pr-3 rounded-2xl glass-inset transition-[border-color,transform] duration-200 hover:border-accent/40',
      props.p.rel === 'mate' && '!border-good/25')}>
      <AgentIcon id={props.p.agent} agents={props.agents} size={38} class='!rounded-xl' />
      <div class='min-w-0 flex-1'>
        <button disabled={props.p.hidden || !props.p.known} title={props.p.known ? undefined : 'Hidden by VALORANT'} onClick={() => openPlayer(props.p)}
          class={cx('block max-w-full truncate text-[13px] font-semibold tracking-tight leading-tight text-left', (props.p.hidden || !props.p.known) ? 'text-muted cursor-default' : 'text-text hover:text-accent transition-colors')}>
          {playerLabel(props.p, props.agents)}
        </button>
        <div class='flex items-center gap-1.5 text-[11px] text-muted leading-tight mt-1'>
          {props.p.hidden && <span class='font-medium'>Hidden</span>}
          {total() > 1 && <span class='text-accent font-bold tabular-nums'>x{total()}</span>}
          <span class='tabular-nums'>{props.p.kills}/{props.p.deaths}/{props.p.assists}</span>
        </div>
      </div>
      <TierIcon tier={props.p.tier} size={22} />
      {props.memo ? <MemoBadge memo={props.memo} onClick={() => props.onMemo(props.p)} />
        : props.p.known && !props.p.hidden && <button onClick={() => props.onMemo(props.p)} class='h-6 px-2.5 rounded-full border border-line text-[11px] font-semibold text-muted opacity-0 group-hover:opacity-100 hover:text-accent hover:border-accent/40 transition'>Note</button>}
    </div>)
  
}

// one recent match: map banner on the left, the people in it on the right
function MatchCard(props) {
  
    const R = () => (RESULT[props.m.result])
    const map = () => (props.maps[props.m.mapId])
    const glow = () => (props.m.result === 'win' ? 'var(--good)' : props.m.result === 'loss' ? 'var(--bad)' : 'var(--warn)')
    return (<Card class='relative overflow-hidden flex flex-col md:flex-row'>
      <div class='relative md:w-52 shrink-0 h-24 md:h-auto overflow-hidden'>
        {map()?.splash && <img decoding='async' src={map().splash} alt='' loading='lazy' class='absolute inset-0 w-full h-full object-cover' draggable={false} />}
        <div class='absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/10' />
        <span class='absolute inset-0' style={st({ background: `linear-gradient(180deg, transparent 40%, rgb(${glow()} / 0.28))` })} />
        <div class='relative h-full p-5 flex flex-col justify-end'>
          <div class='flex items-center gap-2'>
            <span class={cx('w-1.5 h-1.5 rounded-full', R().bar)} style={st({ boxShadow: `0 0 10px rgb(${glow()})` })} />
            <span class={cx('text-[11px] font-bold uppercase tracking-[0.12em]', map()?.splash ? 'text-white/90' : R().text)}>{R().label}{props.m.score ? ` ${props.m.score.us}-${props.m.score.them}` : ''}</span>
          </div>
          <div class={cx('display text-[22px] mt-1.5', map()?.splash ? 'text-white' : 'text-text')}>{map()?.displayName || 'Match'}</div>
          <div class={cx('text-[11.5px] mt-1', map()?.splash ? 'text-white/70' : 'text-muted')}>{props.m.mode} - {timeAgo(props.m.start)}</div>
        </div>
      </div>
      <div class='flex-1 p-4 grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-2 content-start'>
        <For each={props.m.players}>{p => <Chip p={p} people={props.people} memo={p.puuid ? props.memoMap[p.puuid] : null} agents={props.agents} onMemo={props.onMemo} />}</For>
      </div>
    </Card>)
  
}

function Content() {
  const riotA = useRiot()
  const agentsA = useAgents()
  const mapsA = useMaps()
  const __invoke = useInvoke('activity:recent', [20], { skip: () => (!riotA().connected) })
  const __memos = useMemos()
  const [filterS, setFilter] = createSignal('all')
  const [targetS, setTarget] = createSignal(null)
  
    const allTags = createMemo(() => [...new Set(__memos.memos.flatMap(m => m.tags))])
    const named = createMemo(() => Object.values(__invoke.data?.people || {}).filter(p => !p.hidden))
    const repeat = createMemo(() => named().filter(p => p.with + p.against > 1).sort((a, b) => (b.with + b.against) - (a.with + a.against)))
    const frequent = () => (repeat().slice(0, 8))
    const openMemo = p => setTarget({ puuid: p.puuid, name: p.name ? `${p.name.gameName}#${p.name.tagLine}` : '' })
    const groups = () => ((__invoke.data?.matches || []).map(m => ({
    ...m,
    players: m.players.filter(p => (filterS() === 'all' || (filterS() === 'memo' ? p.puuid && __memos.map[p.puuid] : p.rel === filterS()))),
  })).filter(m => m.players.length))
    const noted = () => (named().filter(p => __memos.map[p.puuid]).length)
    
    
    return (<Show when={!(__invoke.error && !__invoke.data)} fallback={<ErrorState error={__invoke.error} onRetry={__invoke.reload} />}><Show when={!(__invoke.loading && !__invoke.data)} fallback={<div class='flex flex-col gap-4'><Skeleton class='h-10 w-96 rounded-full' /><Skeleton class='h-[98px] rounded-2xl' />{Array.from({ length: 3 }, (_, i) => <Skeleton class='h-40 rounded-2xl' />)}</div>}><>
      <CareerBar tabs={FILTERS} value={filterS()} onChange={setFilter} layoutId='career-encounters'
        right={<Button size='sm' icon={FiRefreshCw} loading={__invoke.loading} onClick={() => __invoke.reload(true)}>Refresh</Button>} />

      <StatStrip>
        <StatCell label='Matches scanned' value={__invoke.data?.matches?.length ?? 0} sub='most recent first' />
        <StatCell label='Named players' value={named().length} sub='friends and party' />
        <StatCell label='Played with' value={named().filter(p => p.with > 0).length} sub='as teammates' tone='good' />
        <StatCell label='Played against' value={named().filter(p => p.against > 0).length} sub='as opponents' />
        <StatCell label='Repeat encounters' value={repeat().length} sub='seen more than once' tone='accent' />
        <StatCell label='With notes' value={noted()} sub='from your Notes' />
      </StatStrip>

      {frequent().length > 0 && filterS() === 'all' && (
        <div class='mb-7'>
          <Heading hint='Named players who keep showing up in your games'>Seen most often</Heading>
          <Stagger class='grid grid-cols-2 lg:grid-cols-4 gap-3'>
            <For each={frequent()}>{(f, i) => {
              const total = () => (f.with + f.against)
              return (
                <Item index={i()}>
                  <Card as='button' hover onClick={() => openPlayer({ ...f, known: true })} class='w-full text-left p-4'>
                    <div class='flex items-center gap-3'>
                      <AgentIcon id={f.agent} agents={agentsA()} size={40} class='!rounded-xl' />
                      <div class='min-w-0 flex-1'>
                        <div class='truncate text-[13.5px] font-semibold tracking-tight text-text'>{f.name.gameName}<span class='text-muted font-normal'>#{f.name.tagLine}</span></div>
                        <div class='text-[11px] text-muted mt-0.5'>{f.friend ? 'Friend' : 'Party'} - {total()} games</div>
                      </div>
                    </div>
                    <div class='mt-3.5 h-1.5 rounded-full glass-inset overflow-hidden flex'>
                      <span class='h-full bg-good' style={st({ flex: f.with })} />
                      <span class='h-full bg-bad/80' style={st({ flex: f.against })} />
                    </div>
                    <div class='mt-1.5 flex justify-between text-[10.5px] text-muted tabular-nums'><span>With {f.with}</span><span>Against {f.against}</span></div>
                  </Card>
                </Item>
              )
            }}</For>
          </Stagger>
        </div>
      )}

      {groups().length > 0 && <Heading hint={`${groups().length} matches`} right={__memos.memos.length > 0 && <Badge>{__memos.memos.length} notes saved</Badge>}>Recent matches</Heading>}
      {!groups().length ? <Empty icon={FiActivity} title='Nobody to show' hint={filterS() === 'memo' ? 'Add notes to players and they show up here.' : 'No recent matches found.'} />
        : (
          <div class='stagger flex flex-col gap-3'>
            <For each={groups()}>{(m, i) => (
              <div style={st({ '--i': Math.min(i(), 12) })}>
                <MatchCard m={m} people={__invoke.data.people} memoMap={__memos.map} agents={agentsA()} maps={mapsA()} onMemo={openMemo} />
              </div>
            )}</For>
          </div>
        )}
      <MemoModal open={!!targetS()} onClose={() => setTarget(null)} target={targetS()} memos={__memos.map} allTags={allTags()} onChanged={__memos.reload} />
    </></Show></Show>)
  
}

export default function Activity() {
  return (
    <Page title='Encounters' subtitle='Friends and party you played with in your last 20 matches. Other players stay hidden.'>
      <RequireRiot><Content /></RequireRiot>
    </Page>
  )
}
