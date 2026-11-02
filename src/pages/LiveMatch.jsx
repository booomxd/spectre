import React, { useEffect, useState } from 'react'
import { FiMonitor, FiRadio, FiUsers } from 'react-icons/fi'
import { Page, Card, SectionTitle, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, Tabs, withToast } from '../ui'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import PlayerRow from './live/PlayerRow'
import Drawer from './live/Drawer'
import ScoutPanel from './live/ScoutPanel'
import SkinsPanel from './live/SkinsPanel'
import Lobby from './live/Lobby'
import Loadout from './Loadout'
import { GiCrossedSwords } from 'react-icons/gi'
import { FiX } from 'react-icons/fi'
import { PlayerCard, RankIcon } from './live/parts'
import { queueName, useMemos } from './live/util'

function Banner({ m, onChangeSkins }) {
  return (
    <Card className='relative overflow-hidden mb-5 anim-fade h-32'>
      {m.map?.splash && <img src={m.map.splash} alt='' className='absolute inset-0 w-full h-full object-cover opacity-50' />}
      <div className='absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent' />
      {m.state === 'pregame' && <Button className='absolute top-1/2 -translate-y-1/2 right-5' icon={GiCrossedSwords} onClick={onChangeSkins}>Change skins</Button>}
      <div className='relative h-full flex flex-col justify-end p-5'>
        <div className='flex items-center gap-2 mb-1'>
          <Badge tone={m.state === 'ingame' ? 'good' : 'warn'}>{m.state === 'ingame' ? 'In match' : 'Agent select'}</Badge>
          <Badge>{queueName(m.queueId)}</Badge>
          {m.server && <Badge className='capitalize'>{m.server}</Badge>}
        </div>
        <h2 className='font-display text-3xl font-bold uppercase leading-none'>{m.map?.name || 'Unknown map'}</h2>
      </div>
    </Card>
  )
}

function Team({ title, tone, players, memos, onScout, onSkins }) {
  return (
    <section className='min-w-0'>
      <SectionTitle right={<Badge tone={tone}>{players.length}</Badge>}>{title}</SectionTitle>
      <div className='grid gap-2 stagger'>
        {players.map((p, i) => <PlayerRow key={p.ref || i} p={p} i={i} memo={p.puuid && memos[p.puuid]} onScout={onScout} onSkins={onSkins} />)}
      </div>
    </section>
  )
}

function Idle({ active }) {
  const party = useInvoke('social:party', [], { poll: active ? 5000 : undefined })
  const members = party.data?.members || []
  return (
    <div className='grid gap-6 lg:grid-cols-[1fr_340px] items-start'>
      <Card className='p-8'>
        <Empty icon={FiRadio} title='Waiting for a match' hint='Queue up and this page fills with both teams, and your party as soon as agent select starts.' />
      </Card>
      <div>
        <SectionTitle>Your party</SectionTitle>
        <Card className='p-4 grid gap-2.5 stagger'>
          {party.loading && !party.data ? <Skeleton className='h-12' />
            : !members.length ? <p className='text-[12px] text-muted'>No party found.</p>
              : members.map((m, i) => (
                <div key={m.puuid} className='anim-rise flex items-center gap-2.5' style={{ '--i': i }}>
                  <PlayerCard id={m.card} name={m.hidden ? null : m.gameName} size={34} />
                  <div className='min-w-0 flex-1 text-[13px] font-semibold truncate'>{m.hidden ? 'Hidden player' : m.gameName || '...'}<span className='text-[11px] text-muted font-normal'>{m.tagLine && ` #${m.tagLine}`}</span></div>
                  <RankIcon tier={m.rank} size={26} />
                </div>
              ))}
        </Card>
      </div>
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
  // Side panel: { kind: 'scout' | 'skins', player }. Closed whenever the match changes.
  const [panel, setPanel] = useState(null)
  const closePanel = () => setPanel(null)
  useEffect(closePanel, [d?.matchId])
  const rows = { memos, onScout: p => setPanel({ kind: 'scout', player: p }), onSkins: p => setPanel({ kind: 'skins', player: p }) }

  const toggle = () => withToast(invoke('overlay:toggle').then(s => setOverlay(s.open)))
  const actions = <Button icon={FiMonitor} variant={overlay ? 'primary' : 'subtle'} onClick={toggle}>Overlay</Button>

  // Lobby & Party / Live Match tabs: follows the game (lobby in menus, live once agent select starts) until picked.
  const inMatch = d && d.state !== 'menus'
  const [picked, setPicked] = useState(null)
  useEffect(() => setPicked(null), [inMatch])
  const tab = picked || (inMatch ? 'live' : 'lobby')
  const tabs = <Tabs className='mb-5' value={tab} onChange={setPicked} tabs={[{ value: 'lobby', label: 'Lobby & Party' }, { value: 'live', label: 'Live Match' }]} />

  let body
  if (tab === 'lobby') body = <Lobby active={active} matchState={d?.state} />
  else if (live.loading && !d) body = <div className='grid gap-3'><Skeleton className='h-32 rounded-xl' />{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className='h-14 rounded-xl' />)}</div>
  else if (live.error && !d) body = <ErrorState error={live.error} onRetry={live.reload} />
  else if (!d || d.state === 'menus') body = <Idle active={active} />
  else {
    const mine = d.players.filter(p => !p.enemy)
    const theirs = d.players.filter(p => p.enemy)
    // Deathmatch is free-for-all (everyone shares one team), so split the roster evenly across both columns.
    const ffa = d.state === 'ingame' && d.queueId === 'deathmatch'
    const half = Math.ceil(d.players.length / 2)
    body = (
      <div className='anim-fade'>
        <Banner m={d} onChangeSkins={() => setPanel({ kind: 'loadout' })} />
        {d.state === 'pregame'
          ? <div className='max-w-4xl'><Team title='Your team' tone='accent' players={mine} {...rows} /></div>
          : ffa ? <div className='grid gap-6 xl:grid-cols-2'>
            <Team title='Players' tone='accent' players={d.players.slice(0, half)} {...rows} />
            <Team title='Players' tone='accent' players={d.players.slice(half)} {...rows} />
          </div>
          : <div className='grid gap-6 xl:grid-cols-2'>
            <Team title='Your team' tone='accent' players={mine} {...rows} />
            <Team title='Opponents' tone='bad' players={theirs} {...rows} />
          </div>}
        <p className='mt-5 text-[11px] text-muted flex items-center gap-1.5'><FiUsers /> The colored bar marks your own party. Scout any player for rank history and recent matches, or use the eye for their skins. Streamer-mode players' names always stay hidden.</p>
      </div>
    )
  }
  return (
    <Page title='Live Match' subtitle={d && d.state !== 'menus' ? 'Updating every few seconds' : 'Agent select and in-game rosters'} actions={actions}>
      {tabs}
      {body}
      <Drawer open={!!panel} onClose={closePanel} width={panel?.kind === 'loadout' ? 'min(1120px, 82vw)' : undefined}>
        {panel?.kind === 'loadout' && (
          // Your own loadout during agent select: same editor as the Loadout page, applied in game right away.
          <div className='relative flex-1 overflow-y-auto'>
            <button className='absolute right-5 top-5 z-10 w-9 h-9 rounded-lg border border-line text-muted hover:text-text flex items-center justify-center' onClick={closePanel} title='Close'><FiX /></button>
            <Loadout active />
          </div>
        )}
        {panel?.kind === 'scout' && <ScoutPanel key={panel.player.ref} player={panel.player} onLoaded={rescout} onClose={closePanel} />}
        {panel?.kind === 'skins' && <SkinsPanel key={panel.player.ref} player={panel.player} onClose={closePanel} />}
      </Drawer>
    </Page>
  )
}

export default function LiveMatch({ active }) {
  const { connected } = useRiot()
  return <RequireRiot>{connected && <LiveBody active={active} />}</RequireRiot>
}
