import React, { useEffect, useState } from 'react'
import { FiMove, FiX } from 'react-icons/fi'
import { invoke, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { AgentIcon, RankIcon } from './live/parts'
import { displayName } from './live/PlayerRow'
import { PARTY_COLORS, queueName } from './live/util'

const drag = { WebkitAppRegion: 'drag' }
const noDrag = { WebkitAppRegion: 'no-drag' }

// Settings come from another module; tolerate it being absent or shaped differently.
function useOverlaySettings() {
  const [s, setS] = useState({ opacity: 0.92, scale: 1 })
  useEffect(() => {
    invoke('settings:get').then(all => {
      const op = all?.['overlay.opacity'] ?? all?.overlay?.opacity
      const sc = all?.['overlay.scale'] ?? all?.overlay?.scale
      setS({ opacity: op >= 0.2 && op <= 1 ? +op : 0.92, scale: sc >= 0.6 && sc <= 2 ? +sc : 1 })
    }).catch(() => { })
  }, [])
  return s
}

function Row({ p }) {
  const color = p.party != null ? PARTY_COLORS[p.party % PARTY_COLORS.length] : null
  return (
    <div className='flex items-center gap-2 h-8 px-2 rounded-md bg-white/[0.04]'>
      <span className='w-1 h-4 rounded-full shrink-0' style={{ background: color || 'transparent' }} />
      <AgentIcon agent={p.agent} size={24} locked={p.locked} className='!rounded-md' />
      <span className={`flex-1 truncate text-[12px] font-semibold ${p.self ? 'text-accent' : 'text-text'}`}>{displayName(p)}</span>
      {p.ranked && p.rank > 0 && <span className='text-[10px] text-muted'>{p.rr}</span>}
      {p.ranked && <RankIcon tier={p.rank} size={22} />}
    </div>
  )
}

function Team({ label, players, tone }) {
  if (!players.length) return null
  return (
    <div className='mb-2'>
      <div className={`px-1 mb-1 text-[10px] font-bold tracking-[0.16em] uppercase ${tone}`}>{label}</div>
      <div className='grid gap-1'>{players.map((p, i) => <Row key={p.puuid || i} p={p} />)}</div>
    </div>
  )
}

export default function Overlay() {
  const { connected } = useRiot()
  const { opacity, scale } = useOverlaySettings()
  const live = useInvoke('live:state', [], { poll: 4000, skip: !connected })
  const d = live.data

  useEffect(() => {
    const prev = [document.documentElement.style.background, document.body.style.background]
    document.documentElement.style.background = 'transparent'
    document.body.style.background = 'transparent'
    return () => { document.documentElement.style.background = prev[0]; document.body.style.background = prev[1] }
  }, [])

  const live_ = d && d.state !== 'menus'
  return (
    <div className='h-screen w-screen overflow-hidden' style={{ zoom: scale }}>
      <div className='h-full flex flex-col rounded-xl border border-white/10 bg-bg backdrop-blur-md anim-fade' style={{ background: `rgb(var(--bg) / ${opacity})` }}>
        <div className='flex items-center gap-2 px-3 h-8 shrink-0 border-b border-white/10 cursor-move select-none' style={drag}>
          <FiMove className='text-muted text-xs' />
          <span className='flex-1 truncate text-[11px] font-bold tracking-[0.14em] uppercase text-muted'>
            {live_ ? `${d.map?.name || 'Match'} · ${queueName(d.queueId)}` : 'Spectre'}
          </span>
          <button className='text-muted hover:text-bad transition-colors' style={noDrag} onClick={() => invoke('overlay:close').catch(() => { })}><FiX /></button>
        </div>
        <div className='flex-1 overflow-y-auto p-2'>
          {!connected ? <p className='p-3 text-center text-[11px] text-muted'>Waiting for the Riot Client...</p>
            : live.loading && !d ? <div className='grid gap-1'>{Array.from({ length: 6 }, (_, i) => <div key={i} className='skeleton h-8 rounded-md' />)}</div>
              : live.error && !d ? <p className='p-3 text-center text-[11px] text-bad'>{live.error}</p>
                : !live_ ? <p className='p-6 text-center text-[11px] text-muted'>No live match. The overlay fills in at agent select.</p>
                  : <>
                    <Team label={d.state === 'pregame' ? 'Your team' : 'Allies'} tone='text-accent' players={d.players.filter(p => !p.enemy)} />
                    <Team label='Enemies' tone='text-bad' players={d.players.filter(p => p.enemy)} />
                  </>}
        </div>
      </div>
    </div>
  )
}
