import React, { useCallback, useEffect, useState } from 'react'
import { FiActivity, FiExternalLink } from 'react-icons/fi'
import { Badge, Button, Empty, ErrorState, Skeleton, Tabs } from '../../ui'
import { invoke } from '../../lib/ipc'
import { useTiers } from '../../lib/content'
import { navigate } from '../../nav'
import { cx, seasonName, timeAgo, useAgents, useMaps, useSeasons } from '../history/shared'
import { PanelHeader } from './Drawer'
import { RankIcon } from './parts'

const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const label = 'text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'

function TierName({ tier }) {
  const tiers = useTiers()
  return tier && tiers?.[tier] ? title(tiers[tier].tierName) : 'Unranked'
}

function RankCard({ heading, tier, rr, sub }) {
  return (
    <div className='flex items-center gap-3 p-4'>
      <RankIcon tier={tier} size={46} />
      <div className='min-w-0'>
        <div className={label}>{heading}</div>
        <div className='font-display text-xl font-bold leading-tight'><TierName tier={tier} /></div>
        {rr != null && tier > 0 && <div className='text-[12px] font-bold text-accent'>{rr} RR</div>}
        {sub && <div className='text-[11px] text-muted'>{sub}</div>}
      </div>
    </div>
  )
}

function Performance({ r }) {
  const wr = Math.round(r.wins / r.matches * 100)
  const stat = (value, name) => (
    <div>
      <div className='font-display text-2xl font-bold leading-tight'>{value}</div>
      <div className='text-[11px] text-muted'>{name}</div>
    </div>
  )
  return (
    <div className='rounded-xl border border-line bg-surface p-4'>
      <div className='flex items-center justify-between'>
        <span className='text-sm font-bold'>Recent performance</span>
        <span className='text-xs text-muted'>{r.matches} competitive matches</span>
      </div>
      <div className='flex items-center justify-between mt-3 text-[12px]'>
        <span><b className='text-text'>{wr}%</b> <span className='text-muted'>win rate</span></span>
        <span className='text-muted'>{r.wins}W · {r.losses}L</span>
      </div>
      <div className='mt-1.5 h-1.5 rounded-full bg-bad/40 overflow-hidden'><div className='h-full rounded-full bg-good' style={{ width: `${wr}%` }} /></div>
      <div className='grid grid-cols-3 gap-x-4 gap-y-4 mt-4'>
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
  if (!acts.length) return <Empty icon={FiActivity} title='No competitive acts' className='py-8' />
  return (
    <div className='grid gap-2 grid-cols-1 xl:grid-cols-2 stagger'>
      {acts.map((a, i) => {
        const isPeak = a.seasonId === peak.seasonId
        return (
          <div key={a.seasonId} style={{ '--i': Math.min(i, 12) }}
            className={cx('anim-rise flex items-center gap-3 rounded-xl border bg-surface px-3 py-2.5', isPeak ? 'border-accent/50' : 'border-line')}>
            <RankIcon tier={a.tier} size={34} />
            <div className='min-w-0 flex-1 leading-tight'>
              <div className='flex items-center gap-1.5 text-[13px] font-bold'><TierName tier={a.tier} />{isPeak && <Badge tone='accent'>Peak</Badge>}</div>
              <div className='text-[11px] text-muted'>{seasonName(seasons, a.seasonId) || 'Act'}</div>
            </div>
            <div className='text-right leading-tight shrink-0'>
              {a.tier > 0 && <div className='text-[12px] font-bold text-accent'>{a.rr} RR</div>}
              <div className='text-[11px] text-muted'>{a.wins}W / {a.games} games</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function TopAgents({ list, agents }) {
  if (!list.length) return <Empty icon={FiActivity} title='No recent agents' className='py-8' />
  return (
    <div className='grid gap-2 stagger'>
      {list.map((a, i) => {
        const ag = agents[a.agent]
        return (
          <div key={a.agent} style={{ '--i': i }} className='anim-rise flex items-center gap-3 rounded-xl border border-line bg-surface px-3 py-2'>
            {ag ? <img src={ag.displayIcon} alt='' className='w-9 h-9 rounded-lg object-cover' draggable={false} /> : <div className='w-9 h-9 rounded-lg bg-surface-2' />}
            <div className='min-w-0 flex-1 leading-tight'>
              <div className='text-[13px] font-bold'>{ag?.displayName || 'Agent'}</div>
              <div className='text-[11px] text-muted'>{a.games} {a.games === 1 ? 'game' : 'games'} · {Math.round(a.wins / a.games * 100)}% win rate</div>
            </div>
            <div className='text-right leading-tight'>
              <div className='text-[13px] font-bold'>{a.kd.toFixed(2)} <span className='text-[10px] text-muted font-semibold'>KD</span></div>
              <div className='text-[11px] text-muted'>{a.acs} ACS</div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

const RESULTS = { win: ['Victory', 'good', 'border-l-good'], loss: ['Defeat', 'bad', 'border-l-bad'], draw: ['Draw', 'warn', 'border-l-warn'] }

function MatchRow({ m, agents, maps, i }) {
  const ag = agents[m.agent], map = maps[m.mapId]
  const [text, tone, edge] = RESULTS[m.result] || RESULTS.loss
  return (
    <div className={cx('anim-rise relative overflow-hidden flex items-center gap-3 rounded-xl border border-line border-l-2 bg-surface px-3 py-2.5', edge)} style={{ '--i': Math.min(i, 12) }}>
      {map?.listViewIcon && <img src={map.listViewIcon} alt='' className='absolute inset-0 w-full h-full object-cover opacity-[0.15]' draggable={false} loading='lazy' />}
      <div className='relative flex items-center gap-3 w-full min-w-0'>
        {ag ? <img src={ag.displayIcon} alt={ag.displayName} title={ag.displayName} className='w-10 h-10 rounded-lg object-cover shrink-0' draggable={false} /> : <div className='w-10 h-10 rounded-lg bg-surface-2 shrink-0' />}
        <div className='min-w-0 flex-1 leading-tight'>
          <div className='flex items-center gap-2'><Badge tone={tone}>{text}</Badge><span className='text-[13px] font-bold truncate'>{map?.displayName || 'Unknown map'}</span>{m.score && <span className='text-[11px] text-muted'>{m.score.us}-{m.score.them}</span>}</div>
          <div className='text-[11px] text-muted mt-0.5'>Competitive · {timeAgo(m.start)}</div>
        </div>
        <div className='text-right leading-tight shrink-0'>
          <div className='font-display text-lg font-bold'>{m.kills}/{m.deaths}/{m.assists}</div>
          <div className='text-[10px] text-muted'>{m.acs} ACS · {m.kast}% KAST{m.hs != null ? ` · ${m.hs}% HS` : ''}</div>
          {m.rr != null && <div className={cx('text-[11px] font-bold', m.rr > 0 ? 'text-good' : m.rr < 0 ? 'text-bad' : 'text-muted')}>{m.rr > 0 ? '+' : ''}{m.rr} RR</div>}
        </div>
      </div>
    </div>
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
      <PanelHeader player={player} sub={['Player scout', top && `Recent: ${top}`].filter(Boolean).join(' · ')} actions={profile} onClose={onClose} />
      <div className='flex-1 overflow-y-auto px-5 py-4'>
        {!d && !state.error ? (
          <div className='grid gap-3'><Skeleton className='h-[92px] rounded-xl' /><Skeleton className='h-[190px] rounded-xl' /><Skeleton className='h-[140px] rounded-xl' /></div>
        ) : state.error ? <ErrorState error={state.error} onRetry={load} /> : (
          <div className='flex flex-col gap-5'>
            <div className='anim-rise grid grid-cols-2 divide-x divide-line rounded-xl border border-line bg-surface'>
              <RankCard heading='Current rank' tier={d.current.tier} rr={d.current.rr}
                sub={[seasonName(seasons, d.current.seasonId), d.current.games ? `${d.current.wins}W / ${d.current.games} games` : null].filter(Boolean).join(' · ')} />
              <RankCard heading='Career peak' tier={d.peak.tier} sub={seasonName(seasons, d.peak.seasonId)} />
            </div>

            {d.recent ? <div className='anim-rise'><Performance r={d.recent} /></div>
              : <Empty icon={FiActivity} title={d.historyPrivate ? 'Match history unavailable' : 'No recent competitive matches'} className='py-6' />}

            <div>
              <Tabs value={tab} onChange={setTab} className='mb-3'
                tabs={[{ value: 'history', label: `Rank history ${d.history.length}` }, { value: 'agents', label: `Top agents ${d.agents.length}` }]} />
              {tab === 'history' ? <RankHistory history={d.history} peak={d.peak} seasons={seasons} /> : <TopAgents list={d.agents} agents={agents} />}
            </div>

            {d.matches.length > 0 && (
              <div>
                <div className='flex items-center justify-between mb-2'>
                  <span className='font-display text-lg font-bold'>Recent matches</span>
                  <span className='text-xs text-muted'>{d.matches.length}</span>
                </div>
                <div className='grid gap-2 stagger'>{d.matches.map((m, i) => <MatchRow key={`${m.start}${i}`} m={m} agents={agents} maps={maps} i={i} />)}</div>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
