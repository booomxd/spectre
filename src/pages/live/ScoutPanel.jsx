import React, { useCallback, useEffect, useState } from 'react'
import { FiActivity, FiExternalLink } from 'react-icons/fi'
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

function RankCard({ heading, tier, rr, sub }) {
  const color = useRankColor(tier)
  return (
    <div className='glass relative overflow-hidden rounded-[22px] p-5 flex items-center gap-4'>
      {color && <span className='absolute -right-10 -top-12 w-48 h-48 rounded-full pointer-events-none opacity-60' style={{ background: `radial-gradient(closest-side, ${color}40, transparent)` }} />}
      <RankGlow tier={tier} size={56} className='relative' />
      <div className='relative min-w-0'>
        <div className='eyebrow'>{heading}</div>
        <div className='display text-[24px] mt-1.5 text-text truncate'><TierName tier={tier} /></div>
        <div className='mt-1 flex items-center gap-2 text-[11.5px] text-muted tabular-nums min-w-0'>
          {rr != null && tier > 0 && <span className='font-semibold text-accent shrink-0'>{rr} RR</span>}
          {sub && <span className='truncate'>{sub}</span>}
        </div>
      </div>
    </div>
  )
}

function Performance({ r }) {
  const wr = Math.round(r.wins / r.matches * 100)
  const stat = (value, name) => (
    <div className='glass-inset rounded-2xl px-4 py-3'>
      <div className='font-display text-[22px] font-bold tracking-tight leading-tight text-text tabular-nums'>{value}</div>
      <div className='mt-0.5 text-[11px] text-muted'>{name}</div>
    </div>
  )
  return (
    <div className='glass rounded-[22px] p-5'>
      <Heading hint={`Last ${r.matches} competitive matches`}
        right={<span className='text-[12px] text-muted tabular-nums'><b className='text-good'>{r.wins}W</b> · <b className='text-bad'>{r.losses}L</b></span>}>Recent form</Heading>
      <div className='flex items-end gap-4'>
        <div className='display text-[38px] text-text tabular-nums'>{wr}<span className='text-[22px] text-muted'>%</span></div>
        <div className='flex-1 pb-2'>
          <div className='text-[11px] text-muted mb-1.5'>Win rate</div>
          <div className='h-2 rounded-full bg-bad/25 overflow-hidden'>
            <div className='h-full w-full rounded-full bg-gradient-to-r from-good/60 to-good origin-left shadow-[0_0_12px_rgb(var(--good)/0.6)]' style={{ transform: `scaleX(${wr / 100})` }} />
          </div>
        </div>
      </div>
      <div className='grid grid-cols-3 2xl:grid-cols-6 gap-2.5 mt-5'>
        {stat(r.kda.toFixed(2), 'KDA ratio')}
        {stat(r.acs, 'Avg combat score')}
        {stat(r.hs != null ? `${r.hs}%` : '-', 'Headshot %')}
        {stat(`${r.kast}%`, 'KAST %')}
        {stat(r.adr, 'Damage / round')}
        {stat(r.fb, 'First bloods')}
      </div>
    </div>
  )
}

function RankHistory({ history, peak, seasons }) {
  const start = id => Date.parse(seasons[id]?.startTime) || 0
  const acts = [...history].sort((a, b) => start(b.seasonId) - start(a.seasonId))
  if (!acts.length) return <Empty icon={FiActivity} title='No competitive acts' className='py-6' />
  return (
    <Stagger className='grid gap-2.5 grid-cols-1 xl:grid-cols-2'>
      {acts.map((a, i) => {
        const isPeak = a.seasonId === peak.seasonId
        return (
          <Item key={a.seasonId} index={i} className={cx('flex items-center gap-3 rounded-2xl px-3.5 py-3', isPeak ? 'accent-soft' : 'glass')}>
            <RankIcon tier={a.tier} size={34} />
            <div className='min-w-0 flex-1 leading-tight'>
              <div className='flex items-center gap-1.5 text-[13px] font-semibold text-text'><TierName tier={a.tier} />{isPeak && <Badge tone='accent'>Peak</Badge>}</div>
              <div className='text-[11px] text-muted mt-0.5'>{seasonName(seasons, a.seasonId) || 'Act'}</div>
            </div>
            <div className='text-right leading-tight shrink-0'>
              {a.tier > 0 && <div className='text-[12px] font-semibold text-accent tabular-nums'>{a.rr} RR</div>}
              <div className='text-[11px] text-muted tabular-nums mt-0.5'>{a.wins}W / {a.games} games</div>
            </div>
          </Item>
        )
      })}
    </Stagger>
  )
}

function TopAgents({ list, agents }) {
  if (!list.length) return <Empty icon={FiActivity} title='No recent agents' className='py-6' />
  return (
    <Stagger className='grid gap-2.5'>
      {list.map((a, i) => {
        const ag = agents[a.agent]
        const wr = Math.round(a.wins / a.games * 100)
        return (
          <Item key={a.agent} index={i} className='glass flex items-center gap-3.5 rounded-2xl px-3.5 py-2.5'>
            {ag ? <img src={ag.displayIcon} alt='' className='w-11 h-11 rounded-xl object-cover' draggable={false} /> : <div className='w-11 h-11 rounded-xl bg-surface-2' />}
            <div className='min-w-0 flex-1 leading-tight'>
              <div className='text-[13px] font-semibold text-text'>{ag?.displayName || 'Agent'}</div>
              <div className='mt-1.5 flex items-center gap-2'>
                <div className='h-1 w-24 rounded-full bg-surface-2 overflow-hidden'><div className='h-full w-full bg-accent origin-left rounded-full' style={{ transform: `scaleX(${wr / 100})` }} /></div>
                <span className='text-[11px] text-muted tabular-nums'>{a.games} {a.games === 1 ? 'game' : 'games'} · {wr}% WR</span>
              </div>
            </div>
            <div className='text-right leading-tight'>
              <div className='text-[14px] font-semibold text-text tabular-nums'>{a.kd.toFixed(2)} <span className='text-[10px] text-muted font-semibold'>KD</span></div>
              <div className='text-[11px] text-muted tabular-nums mt-0.5'>{a.acs} ACS</div>
            </div>
          </Item>
        )
      })}
    </Stagger>
  )
}

const RESULTS = { win: ['Victory', 'good', 'bg-good'], loss: ['Defeat', 'bad', 'bg-bad'], draw: ['Draw', 'warn', 'bg-warn'] }
const MAP_MASK = { WebkitMaskImage: 'linear-gradient(90deg, transparent 30%, #000)', maskImage: 'linear-gradient(90deg, transparent 30%, #000)' }

function MatchRow({ m, agents, maps, i }) {
  const ag = agents[m.agent], map = maps[m.mapId]
  const [text, tone, edge] = RESULTS[m.result] || RESULTS.loss
  return (
    <Item index={i} className='glass relative overflow-hidden flex items-center gap-3 rounded-2xl pl-5 pr-4 py-3'>
      {map?.listViewIcon && <img src={map.listViewIcon} alt='' className='absolute inset-y-0 right-0 w-2/3 h-full object-cover opacity-[0.18] pointer-events-none' style={MAP_MASK} draggable={false} loading='lazy' />}
      <span className={cx('absolute left-0 top-3 bottom-3 w-[3px] rounded-r-full', edge)} />
      <div className='relative flex items-center gap-3 w-full min-w-0'>
        {ag ? <img src={ag.displayIcon} alt={ag.displayName} title={ag.displayName} className='w-10 h-10 rounded-xl object-cover shrink-0' draggable={false} /> : <div className='w-10 h-10 rounded-xl bg-surface-2 shrink-0' />}
        <div className='min-w-0 flex-1 leading-tight'>
          <div className='flex items-center gap-2'><Badge tone={tone}>{text}</Badge><span className='text-[13px] font-semibold text-text truncate'>{map?.displayName || 'Unknown map'}</span>{m.score && <span className='text-[11px] text-muted tabular-nums'>{m.score.us}-{m.score.them}</span>}</div>
          <div className='text-[11px] text-muted mt-1'>Competitive · {timeAgo(m.start)}</div>
        </div>
        <div className='text-right leading-tight shrink-0'>
          <div className='font-display text-[17px] font-bold tracking-tight text-text tabular-nums'>{m.kills}<span className='text-muted'>/</span>{m.deaths}<span className='text-muted'>/</span>{m.assists}</div>
          <div className='text-[11px] text-muted tabular-nums mt-0.5'>{m.acs} ACS · {m.kast}% KAST{m.hs != null ? ` · ${m.hs}% HS` : ''}</div>
          {m.rr != null && <div className={cx('text-[11px] font-semibold tabular-nums', m.rr > 0 ? 'text-good' : m.rr < 0 ? 'text-bad' : 'text-muted')}>{m.rr > 0 ? '+' : ''}{m.rr} RR</div>}
        </div>
      </div>
    </Item>
  )
}

// Scout of a live-match player: rank, act history, recent form and matches. The data never includes a name, so for
// streamer-mode players everything here stays anonymous; named players get a link to their full profile.
export default function ScoutPanel({ player, onLoaded, onClose }) {
  const [state, setState] = useState({ data: null, error: null })
  const [tab, setTab] = useState('history')
  const agents = useAgents(), maps = useMaps(), seasons = useSeasons()
  const load = useCallback(() => {
    setState({ data: null, error: null })
    invoke('live:scout', player.ref)
      .then(data => { setState({ data, error: null }); onLoaded?.() })
      .catch(e => setState({ data: null, error: e.message }))
  }, [player.ref])
  useEffect(load, [load])

  const d = state.data
  const top = d?.agents?.[0] && agents[d.agents[0].agent]?.displayName
  const profile = player.puuid && !player.hidden && !player.self && (
    <Button size='sm' variant='subtle' icon={FiExternalLink} onClick={() => { onClose(); navigate('search', { puuid: player.puuid }) }}>Profile</Button>
  )
  return (
    <>
      <PanelHeader player={player} sub={['Player scout', top && `Mains ${top}`].filter(Boolean).join(' · ')} actions={profile} onClose={onClose} />
      <div className='flex-1 overflow-y-auto px-6 py-5'>
        {!d && !state.error ? (
          <div className='grid gap-3'>
            <div className='grid grid-cols-2 gap-3'><Skeleton className='h-[104px] rounded-[22px]' /><Skeleton className='h-[104px] rounded-[22px]' /></div>
            <Skeleton className='h-[230px] rounded-[22px]' /><Skeleton className='h-[140px] rounded-[22px]' />
          </div>
        ) : state.error ? <ErrorState error={state.error} onRetry={load} /> : (
          <Stagger className='flex flex-col gap-5' step={0.05}>
            <Item index={0} className='grid grid-cols-2 gap-3'>
              <RankCard heading='Current rank' tier={d.current.tier} rr={d.current.rr}
                sub={[seasonName(seasons, d.current.seasonId), d.current.games ? `${d.current.wins}W / ${d.current.games} games` : null].filter(Boolean).join(' · ')} />
              <RankCard heading='Career peak' tier={d.peak.tier} sub={seasonName(seasons, d.peak.seasonId)} />
            </Item>

            <Item index={1}>
              {d.recent ? <Performance r={d.recent} />
                : <Empty icon={FiActivity} title={d.historyPrivate ? 'Match history unavailable' : 'No recent competitive matches'} className='py-5' />}
            </Item>

            <Item index={2}>
              <Tabs value={tab} onChange={setTab} className='mb-4' layoutId='scout-tabs'
                tabs={[{ value: 'history', label: 'Rank history', count: d.history.length }, { value: 'agents', label: 'Top agents', count: d.agents.length }]} />
              <Swap id={tab}>{tab === 'history' ? <RankHistory history={d.history} peak={d.peak} seasons={seasons} /> : <TopAgents list={d.agents} agents={agents} />}</Swap>
            </Item>

            {d.matches.length > 0 && (
              <Item index={3}>
                <Heading right={<Badge>{d.matches.length}</Badge>}>Recent matches</Heading>
                <Stagger className='grid gap-2.5'>{d.matches.map((m, i) => <MatchRow key={`${m.start}${i}`} m={m} agents={agents} maps={maps} i={i} />)}</Stagger>
              </Item>
            )}
          </Stagger>
        )}
      </div>
    </>
  )
}
