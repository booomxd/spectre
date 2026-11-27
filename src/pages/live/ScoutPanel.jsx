import { For, createEffect, createSignal, on, Show } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiActivity, FiExternalLink } from 'solid-icons/fi'
import { Badge, Button, Empty, ErrorState, Heading, Item, Skeleton, Stagger, Swap, Tabs } from '../../ui'
import { invoke } from '../../lib/ipc'
import { useTiers } from '../../lib/content'
import { navigate } from '../../nav'
import { cx, seasonName, timeAgo, useAgents, useMaps, useSeasons } from '../history/shared'
import { PanelHeader } from './Drawer'
import { RankGlow, RankIcon, useRankColor } from './parts'

const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

function TierName({ tier }) {
  const tiers = useTiers()
  return tier && tiers?.[tier] ? title(tiers[tier].tierName) : 'Unranked'
}

function RankCard(props) {
  const colorA = useRankColor(() => props.tier)
  return (
    <div class='glass relative overflow-hidden rounded-[22px] p-5 flex items-center gap-4'>
      {colorA() && <span class='absolute -right-10 -top-12 w-48 h-48 rounded-full pointer-events-none opacity-60' style={st({ background: `radial-gradient(closest-side, ${colorA()}40, transparent)` })} />}
      <RankGlow tier={props.tier} size={56} class='relative' />
      <div class='relative min-w-0'>
        <div class='eyebrow'>{props.heading}</div>
        <div class='display text-[24px] mt-1.5 text-text truncate'><TierName tier={props.tier} /></div>
        <div class='mt-1 flex items-center gap-2 text-[11.5px] text-muted tabular-nums min-w-0'>
          {props.rr != null && props.tier > 0 && <span class='font-semibold text-accent shrink-0'>{props.rr} RR</span>}
          {props.sub && <span class='truncate'>{props.sub}</span>}
        </div>
      </div>
    </div>
  )
}

function Performance(props) {
  
    const wr = () => (Math.round(props.r.wins / props.r.matches * 100))
    const stat = (value, name) => (
    <div class='glass-inset rounded-2xl px-4 py-3'>
      <div class='font-display text-[22px] font-bold tracking-tight leading-tight text-text tabular-nums'>{value}</div>
      <div class='mt-0.5 text-[11px] text-muted'>{name}</div>
    </div>
  )
    return (<div class='glass rounded-[22px] p-5'>
      <Heading hint={`Last ${props.r.matches} competitive matches`}
        right={<span class='text-[12px] text-muted tabular-nums'><b class='text-good'>{props.r.wins}W</b> · <b class='text-bad'>{props.r.losses}L</b></span>}>Recent form</Heading>
      <div class='flex items-end gap-5'>
        <div class='display text-[46px] text-text tabular-nums'>{wr()}<span class='text-[22px] text-muted'>%</span></div>
        <div class='flex-1 pb-2'>
          <div class='text-[11px] text-muted mb-1.5'>Win rate</div>
          <div class='h-2 rounded-full bg-bad/25 overflow-hidden'>
            <div class='h-full w-full rounded-full bg-gradient-to-r from-good/60 to-good origin-left shadow-[0_0_12px_rgb(var(--good)/0.6)]' style={st({ transform: `scaleX(${wr() / 100})` })} />
          </div>
        </div>
      </div>
      <div class='grid grid-cols-3 gap-2.5 mt-5'>
        {stat(props.r.kda.toFixed(2), 'KDA ratio')}
        {stat(props.r.acs, 'Avg combat score')}
        {stat(props.r.hs != null ? `${props.r.hs}%` : '-', 'Headshot %')}
        {stat(`${props.r.kast}%`, 'KAST %')}
        {stat(props.r.adr, 'Damage / round')}
        {stat(props.r.fb, 'First bloods')}
      </div>
    </div>)
  
}

function RankHistory(props) {
  
    const start = id => Date.parse(props.seasons[id]?.startTime) || 0
    const acts = () => ([...props.history].sort((a, b) => start(b.seasonId) - start(a.seasonId)))
    
    return (<Show when={!(!acts().length)} fallback={<Empty icon={FiActivity} title='No competitive acts' class='py-8' />}><Stagger class='grid gap-2.5 grid-cols-1 xl:grid-cols-2'>
      {acts().map((a, i) => {
        const isPeak = a.seasonId === props.peak.seasonId
        return (
          <Item index={i} class={cx('flex items-center gap-3 rounded-2xl px-3.5 py-3', isPeak ? 'accent-soft' : 'glass')}>
            <RankIcon tier={a.tier} size={34} />
            <div class='min-w-0 flex-1 leading-tight'>
              <div class='flex items-center gap-1.5 text-[13px] font-semibold text-text'><TierName tier={a.tier} />{isPeak && <Badge tone='accent'>Peak</Badge>}</div>
              <div class='text-[11px] text-muted mt-0.5'>{seasonName(props.seasons, a.seasonId) || 'Act'}</div>
            </div>
            <div class='text-right leading-tight shrink-0'>
              {a.tier > 0 && <div class='text-[12px] font-semibold text-accent tabular-nums'>{a.rr} RR</div>}
              <div class='text-[11px] text-muted tabular-nums mt-0.5'>{a.wins}W / {a.games} games</div>
            </div>
          </Item>
        )
      })}
    </Stagger></Show>)
  
}

function TopAgents(props) {
  
    
    return (<Show when={!(!props.list.length)} fallback={<Empty icon={FiActivity} title='No recent agents' class='py-8' />}><Stagger class='grid gap-2.5'>
      {props.list.map((a, i) => {
        const ag = props.agents[a.agent]
        const wr = Math.round(a.wins / a.games * 100)
        return (
          <Item index={i} class='glass flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5'>
            {ag ? <img decoding='async' src={ag.displayIcon} alt='' class='w-11 h-11 rounded-xl object-cover' draggable={false} /> : <div class='w-11 h-11 rounded-xl bg-surface-2' />}
            <div class='min-w-0 flex-1 leading-tight'>
              <div class='text-[13px] font-semibold text-text'>{ag?.displayName || 'Agent'}</div>
              <div class='mt-1.5 flex items-center gap-2'>
                <div class='h-1 w-24 rounded-full bg-surface-2 overflow-hidden'><div class='h-full w-full bg-accent origin-left rounded-full' style={st({ transform: `scaleX(${wr / 100})` })} /></div>
                <span class='text-[11px] text-muted tabular-nums'>{a.games} {a.games === 1 ? 'game' : 'games'} · {wr}% WR</span>
              </div>
            </div>
            <div class='text-right leading-tight'>
              <div class='text-[14px] font-semibold text-text tabular-nums'>{a.kd.toFixed(2)} <span class='text-[10px] text-muted font-semibold'>KD</span></div>
              <div class='text-[11px] text-muted tabular-nums mt-0.5'>{a.acs} ACS</div>
            </div>
          </Item>
        )
      })}
    </Stagger></Show>)
  
}

const RESULTS = { win: ['Victory', 'good', 'bg-good'], loss: ['Defeat', 'bad', 'bg-bad'], draw: ['Draw', 'warn', 'bg-warn'] }
const MAP_MASK = { WebkitMaskImage: 'linear-gradient(90deg, transparent 30%, #000)', maskImage: 'linear-gradient(90deg, transparent 30%, #000)' }

function MatchRow(props) {
  
    const ag = () => (props.agents[props.m.agent]), map = () => (props.maps[props.m.mapId])
    const __d0 = () => (RESULTS[props.m.result] || RESULTS.loss), text = () => __d0()?.[0], tone = () => __d0()?.[1], edge = () => __d0()?.[2]
    return (<Item index={props.i} class='glass relative overflow-hidden flex items-center gap-3 rounded-2xl pl-5 pr-4 py-3'>
      {map()?.listViewIcon && <img decoding='async' src={map().listViewIcon} alt='' class='absolute inset-y-0 right-0 w-2/3 h-full object-cover opacity-[0.18] pointer-events-none' style={st(MAP_MASK)} draggable={false} loading='lazy' />}
      <span class={cx('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', edge())} />
      <div class='relative flex items-center gap-3 w-full min-w-0'>
        {ag() ? <img decoding='async' src={ag().displayIcon} alt={ag().displayName} title={ag().displayName} class='w-10 h-10 rounded-xl object-cover shrink-0' draggable={false} /> : <div class='w-10 h-10 rounded-xl bg-surface-2 shrink-0' />}
        <div class='min-w-0 flex-1 leading-tight'>
          <div class='flex items-center gap-2'><Badge tone={tone()}>{text()}</Badge><span class='text-[13px] font-semibold text-text truncate'>{map()?.displayName || 'Unknown map'}</span>{props.m.score && <span class='text-[11px] text-muted tabular-nums'>{props.m.score.us}-{props.m.score.them}</span>}</div>
          <div class='text-[11px] text-muted mt-1'>Competitive · {timeAgo(props.m.start)}</div>
        </div>
        <div class='text-right leading-tight shrink-0'>
          <div class='font-display text-[17px] font-bold tracking-tight text-text tabular-nums'>{props.m.kills}<span class='text-muted'>/</span>{props.m.deaths}<span class='text-muted'>/</span>{props.m.assists}</div>
          <div class='text-[11px] text-muted tabular-nums mt-0.5'>{props.m.acs} ACS · {props.m.kast}% KAST{props.m.hs != null ? ` · ${props.m.hs}% HS` : ''}</div>
          {props.m.rr != null && <div class={cx('text-[11px] font-semibold tabular-nums', props.m.rr > 0 ? 'text-good' : props.m.rr < 0 ? 'text-bad' : 'text-muted')}>{props.m.rr > 0 ? '+' : ''}{props.m.rr} RR</div>}
        </div>
      </div>
    </Item>)
  
}

// Scout of a live-match player: rank, act history, recent form and matches
export default function ScoutPanel(props) {
  const [stateS, setState] = createSignal({ data: null, error: null })
  const [tabS, setTab] = createSignal('history')
  const agentsA = useAgents(), mapsA = useMaps(), seasonsA = useSeasons()
  createEffect(on(() => props.player.ref, () => load()))
    const load = () => {
    setState({ data: null, error: null })
    invoke('live:scout', props.player.ref)
      .then(data => { setState({ data, error: null }); props.onLoaded?.() })
      .catch(e => setState({ data: null, error: e.message }))
  }
    const d = () => (stateS().data)
    const top = () => (d()?.agents?.[0] && agentsA()[d().agents[0].agent]?.displayName)
    const profile = () => (props.player.puuid && !props.player.hidden && !props.player.self && (
    <Button size='sm' variant='subtle' icon={FiExternalLink} onClick={() => { props.onClose(); navigate('search', { puuid: props.player.puuid }) }}>Profile</Button>
  ))
    return (<>
      <PanelHeader player={props.player} sub={['Player scout', top() && `Mains ${top()}`].filter(Boolean).join(' · ')} actions={profile()} onClose={props.onClose} />
      <div class='flex-1 overflow-y-auto px-7 py-6'>
        {!d() && !stateS().error ? (
          <div class='grid gap-3'>
            <div class='grid grid-cols-2 gap-3'><Skeleton class='h-[104px] rounded-[22px]' /><Skeleton class='h-[104px] rounded-[22px]' /></div>
            <Skeleton class='h-[230px] rounded-[22px]' /><Skeleton class='h-[140px] rounded-[22px]' />
          </div>
        ) : stateS().error ? <ErrorState error={stateS().error} onRetry={load} /> : (
          <Stagger class='flex flex-col gap-6' step={0.05}>
            <Item index={0} class='grid grid-cols-2 gap-3'>
              <RankCard heading='Current rank' tier={d().current.tier} rr={d().current.rr}
                sub={[seasonName(seasonsA(), d().current.seasonId), d().current.games ? `${d().current.wins}W / ${d().current.games} games` : null].filter(Boolean).join(' · ')} />
              <RankCard heading='Career peak' tier={d().peak.tier} sub={seasonName(seasonsA(), d().peak.seasonId)} />
            </Item>

            <Item index={1}>
              {d().recent ? <Performance r={d().recent} />
                : <Empty icon={FiActivity} title={d().historyPrivate ? 'Match history unavailable' : 'No recent competitive matches'} class='py-6' />}
            </Item>

            <Item index={2}>
              <Tabs value={tabS()} onChange={setTab} class='mb-4' layoutId='scout-tabs'
                tabs={[{ value: 'history', label: 'Rank history', count: d().history.length }, { value: 'agents', label: 'Top agents', count: d().agents.length }]} />
              <Swap id={tabS()}>{tabS() === 'history' ? <RankHistory history={d().history} peak={d().peak} seasons={seasonsA()} /> : <TopAgents list={d().agents} agents={agentsA()} />}</Swap>
            </Item>

            {d().matches.length > 0 && (
              <Item index={3}>
                <Heading right={<Badge>{d().matches.length}</Badge>}>Recent matches</Heading>
                <Stagger class='grid gap-2.5'><For each={d().matches}>{(m, i) => <MatchRow m={m} agents={agentsA()} maps={mapsA()} i={i()} />}</For></Stagger>
              </Item>
            )}
          </Stagger>
        )}
      </div>
    </>)
  
}
