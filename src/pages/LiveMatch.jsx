import React, { useEffect, useRef, useState } from 'react'
import { FiMonitor, FiRadio, FiUsers, FiX } from 'react-icons/fi'
import { Page, Card, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, SegmentedTabs, Stagger, Swap, FadeIn, Item, withToast } from '../ui'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useTiers } from '../lib/content'
import PlayerRow from './live/PlayerRow'
import Drawer from './live/Drawer'
import ScoutPanel from './live/ScoutPanel'
import SkinsPanel from './live/SkinsPanel'
import Lobby from './live/Lobby'
import Loadout from './Loadout'
import { GunIcon, ModeIcon, PlayerCard, RankGlow, RankIcon } from './live/parts'
import { queueName, useMemos } from './live/util'

const cx = (...c) => c.filter(Boolean).join(' ')
const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const SkinsIcon = () => <GunIcon size={14} />

// Average current rank of the ranked players in a list (0 when nobody is ranked or visible).
const avgRank = players => {
  const r = players.filter(p => p.ranked && p.rank > 0)
  return r.length ? Math.round(r.reduce((a, p) => a + p.rank, 0) / r.length) : 0
}

const SPLASH_MASK = { WebkitMaskImage: 'linear-gradient(90deg, transparent 8%, #000 62%)', maskImage: 'linear-gradient(90deg, transparent 8%, #000 62%)' }
const GRID = {
  backgroundImage: 'linear-gradient(rgb(var(--line) / calc(var(--grid-a) * 2)) 1px, transparent 1px), linear-gradient(90deg, rgb(var(--line) / calc(var(--grid-a) * 2)) 1px, transparent 1px)',
  backgroundSize: '28px 28px', WebkitMaskImage: 'radial-gradient(ellipse at 20% 60%, #000, transparent 70%)', maskImage: 'radial-gradient(ellipse at 20% 60%, #000, transparent 70%)',
}

function TeamAvg({ label, tier, tone }) {
  const tiers = useTiers()
  return (
    <div className={cx('flex items-center gap-3', tone === 'bad' && 'flex-row-reverse text-right')}>
      <RankGlow tier={tier} size={42} />
      <div className='leading-tight'>
        <div className={cx('eyebrow', tone === 'bad' ? '!text-bad' : '!text-good')}>{label}</div>
        <div className='mt-1 text-[14px] font-semibold tracking-tight text-text whitespace-nowrap'>{tier ? title(tiers?.[tier]?.tierName) : 'Unranked'}</div>
      </div>
    </div>
  )
}

// Match hero: map art bleeding in from the right, a faint grid, the map name as display type, and team average ranks.
function Banner({ m, onChangeSkins }) {
  const live = m.state === 'ingame'
  const ffa = live && m.queueId === 'deathmatch'
  const allies = avgRank(m.players.filter(p => !p.enemy)), enemies = avgRank(m.players.filter(p => p.enemy))
  return (
    <FadeIn className='glass relative overflow-hidden mb-6 rounded-[28px] h-[208px]'>
      {m.map?.splash && <img src={m.map.splash} alt='' className='absolute inset-y-0 right-0 w-[78%] h-full object-cover opacity-80' style={SPLASH_MASK} draggable={false} />}
      <div className='absolute inset-0 bg-gradient-to-t from-bg/70 via-transparent to-transparent' />
      <div className='absolute inset-0 pointer-events-none' style={GRID} />
      <span className='halo -left-20 -bottom-32 w-[420px] h-[320px] opacity-80' />
      <div className='relative h-full flex items-end justify-between gap-5 p-6'>
        <div className='min-w-0'>
          <div className='flex items-center gap-2 mb-3'>
            <span className={cx('inline-flex items-center gap-2 h-6 px-2.5 rounded-full text-[10.5px] font-bold tracking-[0.12em] uppercase border',
              live ? 'bg-good/12 text-good border-good/30' : 'bg-warn/12 text-warn border-warn/30')}>
              <span className={cx('w-1.5 h-1.5 rounded-full anim-pulse', live ? 'bg-good shadow-[0_0_8px_rgb(var(--good))]' : 'bg-warn')} />{live ? 'Live' : 'Agent select'}
            </span>
            <Badge><ModeIcon queue={m.queueId} size={11} />{queueName(m.queueId)}</Badge>
            {m.server && <Badge className='capitalize'>{m.server}</Badge>}
          </div>
          <h2 className='display text-[52px] leading-[0.9] text-text drop-shadow-[0_4px_24px_rgb(0_0_0/0.35)]'>{m.map?.name || 'Unknown map'}</h2>
        </div>
        <div className='flex items-center gap-4 shrink-0'>
          {!ffa && (live
            ? <div className='glass-strong flex items-center gap-4 rounded-full pl-3 pr-3 py-2.5'>
              <TeamAvg label='Your team' tier={allies} />
              <span className='display text-[15px] text-muted'>vs</span>
              <TeamAvg label='Opponents' tier={enemies} tone='bad' />
            </div>
            : <div className='glass-strong rounded-full pl-3 pr-5 py-2.5'><TeamAvg label='Team average' tier={allies} /></div>)}
          {m.state === 'pregame' && <Button variant='primary' size='lg' icon={SkinsIcon} onClick={onChangeSkins}>Change skins</Button>}
        </div>
      </div>
    </FadeIn>
  )
}

function Team({ title: name, tone, players, memos, onScout, onSkins, cols }) {
  const avg = avgRank(players)
  const tiers = useTiers()
  // Allies read green and opponents red in every theme (the game's own convention); free-for-all uses the accent.
  const dot = { bad: 'bg-bad shadow-[0_0_10px_rgb(var(--bad))]', good: 'bg-good shadow-[0_0_10px_rgb(var(--good))]' }[tone] || 'bg-accent shadow-[0_0_10px_rgb(var(--accent))]'
  const line = { bad: 'from-bad/50', good: 'from-good/45' }[tone] || 'from-accent/50'
  return (
    <section className='min-w-0'>
      <header className='flex items-center gap-3 px-1 mb-3'>
        <span className={cx('w-2 h-2 rounded-full', dot)} />
        <h2 className='font-display text-[19px] font-bold tracking-tight text-text'>{name}</h2>
        <span className='text-[12px] font-semibold text-muted tabular-nums'>{players.length}</span>
        {avg > 0 && <span className='ml-auto flex items-center gap-1.5 text-[11.5px] text-muted'>Avg <RankIcon tier={avg} size={18} /><span className='text-text font-semibold'>{title(tiers?.[avg]?.tierName)}</span></span>}
      </header>
      <div className={cx('h-px mb-4 bg-gradient-to-r to-transparent', line)} />
      <Stagger className={cx('grid gap-2.5', cols && 'xl:grid-cols-2 xl:gap-x-8')} step={0.04}>
        {players.map((p, i) => <PlayerRow key={p.ref || i} p={p} i={i} memo={p.puuid && memos[p.puuid]} onScout={onScout} onSkins={onSkins} />)}
      </Stagger>
    </section>
  )
}

function Idle({ active }) {
  const party = useInvoke('social:party', [], { poll: active ? 5000 : undefined })
  const members = party.data?.members || []
  return (
    <div className='grid gap-4 lg:grid-cols-[1fr_360px] 2xl:grid-cols-[1fr_420px] items-start'>
      <Card className='relative overflow-hidden p-8 rounded-[28px] min-h-[320px] flex items-center justify-center'>
        <div className='absolute inset-0 pointer-events-none' style={{ ...GRID, WebkitMaskImage: 'radial-gradient(circle at 50% 45%, #000, transparent 65%)', maskImage: 'radial-gradient(circle at 50% 45%, #000, transparent 65%)' }} />
        {/* Radar rings: static, only the inner dot pulses (opacity). */}
        <div className='absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-1/2 pointer-events-none'>
          {[260, 190, 120].map(s => <span key={s} className='absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full border border-accent/15' style={{ width: s, height: s }} />)}
        </div>
        <Empty icon={FiRadio} title='Waiting for a match' hint='Queue up and this page fills with both teams, and your party as soon as agent select starts.' className='relative' />
      </Card>
      <Card className='p-5 rounded-[28px]'>
        <div className='flex items-center justify-between mb-3 px-1'>
          <span className='eyebrow'>Your party</span>
          {members.length > 0 && <span className='flex items-center gap-2 min-w-0 text-[11px] text-muted tabular-nums'>
            {party.data?.queueId && <span className='inline-flex items-center gap-1 min-w-0'><ModeIcon queue={party.data.queueId} size={11} className='shrink-0' /><span className='truncate'>{queueName(party.data.queueId)}</span></span>}
            <span className='shrink-0'>{members.length}/5</span>
          </span>}
        </div>
        {party.loading && !party.data ? <Skeleton className='h-14 rounded-2xl' />
          : !members.length ? <p className='px-1 py-1.5 text-[12px] text-muted'>No party found.</p>
            : <Stagger className='grid gap-1.5'>
              {members.map((m, i) => (
                <Item key={m.puuid} index={i} className='flex items-center gap-3 rounded-2xl px-2.5 py-2 glass-inset'>
                  <PlayerCard id={m.hidden ? null : m.card} name={m.hidden ? null : m.gameName} size={36} />
                  <div className='min-w-0 flex-1 leading-tight'>
                    <div className='text-[13px] font-semibold text-text truncate'>{m.hidden ? 'Hidden player' : m.gameName || '...'}<span className='ml-0.5 text-[11px] text-muted font-normal'>{!m.hidden && m.tagLine && ` #${m.tagLine}`}</span></div>
                    <div className='mt-0.5 text-[11px] text-muted tabular-nums truncate'>{[m.level != null && `Lv ${m.level}`, m.owner && 'Leader', m.ready ? 'Ready' : 'Standby'].filter(Boolean).join(' · ')}</div>
                  </div>
                  <RankIcon tier={m.rank} size={26} />
                </Item>
              ))}
            </Stagger>}
      </Card>
    </div>
  )
}

function LiveBody({ active }) {
  const [overlay, setOverlay] = useState(false)
  useEffect(() => { invoke('overlay:state').then(s => setOverlay(s.open)).catch(() => { }) }, [])
  useEvent('overlay:state', s => setOverlay(s.open))
  // Poll fast while visible; slowly only if the overlay window needs the data.
  const poll = active ? 4000 : overlay ? 12000 : undefined
  const live = useInvoke('live:state', [], { poll })
  const d = live.data
  const memos = useMemos((d?.players || []).map(p => p.puuid))
  const rescout = () => live.reload(true)
  // Side panel: { kind: 'scout' | 'skins' | 'loadout', player }. Closed whenever the match changes.
  const [panel, setPanel] = useState(null)
  const closePanel = () => setPanel(null)
  useEffect(closePanel, [d?.matchId])
  // Dev demo only (?demo&scout): open Scout on a sample player for screenshots.
  const demoScout = useRef(false)
  useEffect(() => {
    if (!import.meta.env.DEV || demoScout.current || !d?.players?.length) return
    const q = new URLSearchParams(window.location.search)
    if (!q.has('demo') || !q.has('scout')) return
    demoScout.current = true
    setPanel({ kind: 'scout', player: d.players.find(p => p.name && !p.hidden && !p.self) || d.players[1] || d.players[0] })
  }, [d?.players])
  // Keep the last panel's content on screen while the drawer animates out.
  const last = useRef(null)
  if (panel) last.current = panel
  const shown = panel || last.current
  const rows = { memos, onScout: p => setPanel({ kind: 'scout', player: p }), onSkins: p => setPanel({ kind: 'skins', player: p }) }

  const toggle = () => withToast(invoke('overlay:toggle').then(s => setOverlay(s.open)))

  // Lobby & Party / Live Match tabs: follows the game (lobby in menus, live once agent select starts) until picked.
  const inMatch = d && d.state !== 'menus'
  const [picked, setPicked] = useState(null)
  useEffect(() => setPicked(null), [inMatch])
  const tab = picked || (inMatch ? 'live' : 'lobby')
  const actions = (<>
    <SegmentedTabs value={tab} onChange={setPicked} layoutId='live-tabs'
      tabs={[{ value: 'lobby', label: 'Lobby & Party', icon: FiUsers }, { value: 'live', label: 'Match', icon: FiRadio }]} />
    <Button icon={FiMonitor} variant={overlay ? 'glow' : 'subtle'} onClick={toggle} title='Show or hide the in-game overlay'>
      Overlay{overlay && <span className='w-1.5 h-1.5 rounded-full bg-good shadow-[0_0_8px_rgb(var(--good))]' />}
    </Button>
  </>)

  let body
  if (tab === 'lobby') body = <Lobby active={active} matchState={d?.state} />
  else if (live.loading && !d) body = (
    <div className='grid gap-3'>
      <Skeleton className='h-[208px] rounded-[28px] mb-4' />
      <div className='grid gap-7 xl:grid-cols-2'>{[0, 1].map(c => <div key={c} className='grid gap-2.5'>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className='h-[84px] rounded-[22px]' />)}</div>)}</div>
    </div>
  )
  else if (live.error && !d) body = <ErrorState error={live.error} onRetry={live.reload} />
  else if (!d || d.state === 'menus') body = <Idle active={active} />
  else {
    const mine = d.players.filter(p => !p.enemy)
    const theirs = d.players.filter(p => p.enemy)
    // Deathmatch is free-for-all (everyone shares one team), so split the roster evenly across both columns.
    const ffa = d.state === 'ingame' && d.queueId === 'deathmatch'
    const half = Math.ceil(d.players.length / 2)
    body = (
      <div>
        <Banner m={d} onChangeSkins={() => setPanel({ kind: 'loadout' })} />
        {d.state === 'pregame'
          ? <Team title='Your team' tone='good' players={mine} cols {...rows} />
          : ffa ? <div className='grid gap-x-8 gap-y-10 xl:grid-cols-2'>
            <Team title='Players' tone='accent' players={d.players.slice(0, half)} {...rows} />
            <Team title='Players' tone='accent' players={d.players.slice(half)} {...rows} />
          </div>
          : <div className='grid gap-x-8 gap-y-10 xl:grid-cols-2'>
            <Team title='Your team' tone='good' players={mine} {...rows} />
            <Team title='Opponents' tone='bad' players={theirs} {...rows} />
          </div>}
        <p className='mt-8 mx-auto max-w-3xl text-center text-[12px] leading-relaxed text-muted'>
          A colored edge and a Duo, Trio or stack tag mark players who queued together; gold is your party. Scout any player for rank history and recent matches, or use the eye for their skins. Streamer-mode players stay hidden, except you and friends in your party.
        </p>
      </div>
    )
  }
  return (
    <Page title='Live Match' subtitle={tab === 'lobby' ? 'Your party, queue and lobby settings' : d && d.state !== 'menus' ? 'Both rosters, refreshed every few seconds' : 'Agent select and in-game rosters, plus your party and lobby'} actions={actions}>
      <Swap id={tab}>{body}</Swap>
      <Drawer open={!!panel} onClose={closePanel} width={shown?.kind === 'loadout' ? 'min(1120px, 82vw)' : undefined}>
        {shown?.kind === 'loadout' && (
          // Your own loadout during agent select: same editor as the Loadout page, applied in game right away.
          <div className='relative flex-1 overflow-y-auto'>
            <button className='glass absolute right-5 top-5 z-10 w-9 h-9 rounded-full text-muted hover:text-text hover:border-accent/40 transition-colors flex items-center justify-center' onClick={closePanel} title='Close'><FiX /></button>
            <Loadout active />
          </div>
        )}
        {shown?.kind === 'scout' && <ScoutPanel key={shown.player.ref} player={shown.player} onLoaded={rescout} onClose={closePanel} />}
        {shown?.kind === 'skins' && <SkinsPanel key={shown.player.ref} player={shown.player} onClose={closePanel} />}
      </Drawer>
    </Page>
  )
}

export default function LiveMatch({ active }) {
  const { connected } = useRiot()
  return <RequireRiot>{connected && <LiveBody active={active} />}</RequireRiot>
}
