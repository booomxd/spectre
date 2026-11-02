import React, { useState } from 'react'
import { FiEdit3, FiCrosshair } from 'react-icons/fi'
import { Badge, Button, withToast } from '../../ui'
import { invoke } from '../../lib/ipc'
import { navigate } from '../../nav'
import { useTiers } from '../../lib/content'
import { AgentIcon, PlayerCard, RankIcon } from './parts'
import { PARTY_COLORS } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')

// Display name respecting streamer mode: hidden players only ever show their agent.
export const displayName = p => p.hidden ? (p.agent?.name || 'Hidden player') : p.gameName ? p.gameName : '...'

const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

export default function PlayerRow({ p, i, memo, onScouted }) {
  const tiers = useTiers()
  const [scouting, setScouting] = useState(false)
  const color = p.party != null ? PARTY_COLORS[p.party % PARTY_COLORS.length] : null
  const open = () => p.puuid && navigate('search', { puuid: p.puuid })
  // Hidden players are scouted in place by an opaque token; their name and puuid never reach the UI.
  const scoutHidden = async () => {
    setScouting(true)
    if (await withToast(invoke('live:scoutHidden', p.anon))) await onScouted?.()
    setScouting(false)
  }
  const memoText = memo && (memo.note || memo.text || memo.title || 'Note')
  return (
    <div className={cx('anim-rise relative flex items-center gap-3 rounded-xl border bg-surface pl-4 pr-3 py-2 transition-colors hover:bg-surface-2/60', p.self ? 'border-accent/50' : 'border-line')} style={{ '--i': i }}>
      <span className='absolute left-0 top-2 bottom-2 w-1 rounded-full' style={{ background: color || 'transparent' }} title={color ? 'Premade party' : undefined} />
      <AgentIcon agent={p.agent} size={44} locked={p.locked} />
      {p.card && <PlayerCard id={p.card} size={34} className='hidden md:block' />}
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline gap-1.5 truncate'>
          {!p.puuid
            ? <span className='text-[13px] font-semibold text-text truncate'>{displayName(p)}</span>
            : <button className='text-[13px] font-semibold text-text truncate hover:text-accent transition-colors text-left' onClick={open}>{displayName(p)}</button>}
          {!p.hidden && p.tagLine && <span className='text-[11px] text-muted'>#{p.tagLine}</span>}
          {p.self && <Badge tone='accent'>You</Badge>}
          {p.spectre && !p.hidden && <span title='Uses Spectre'><Badge tone='accent'>Spectre</Badge></span>}
          {p.hidden && <span title='Hidden by VALORANT'><Badge>Hidden</Badge></span>}
          {p.agent && <span className='text-[11px] text-muted hidden lg:inline'>{p.locked ? p.agent.name : `${p.agent.name} (hovering)`}</span>}
          {!p.agent && <span className='text-[11px] text-muted'>Choosing...</span>}
        </div>
        <div className='flex items-center gap-2 text-[11px] text-muted'>
          {p.level != null && <span>Lv {p.level}</span>}
          {p.recent && <span title='Last competitive matches'>Last {p.recent.games}: {p.recent.wins}W · {p.recent.kd.toFixed(2)} K/D{p.recent.hs != null ? ` · ${p.recent.hs}% HS` : ''}</span>}
          {memo && (
            <button className='inline-flex items-center gap-1 text-warn hover:text-text transition-colors max-w-[220px]' title={memoText}
              onClick={() => navigate('memo', { puuid: p.puuid, name: `${p.gameName}#${p.tagLine}` })}>
              <FiEdit3 /> <span className='truncate'>{memoText}</span>
            </button>
          )}
        </div>
      </div>
      <div className='flex items-center gap-2 shrink-0'>
        {p.anon && p.recent === undefined && (
          <Button size='sm' variant='subtle' icon={FiCrosshair} loading={scouting} onClick={scoutHidden} title='Look up recent competitive form. Their name stays hidden.'>Scout</Button>
        )}
        {p.ranked ? (<>
          <div className='text-right leading-tight'>
            <div className='text-[12px] font-semibold text-text'>{p.rank ? title(tiers?.[p.rank]?.tierName) : 'Unranked'}</div>
            <div className='text-[11px] text-muted'>{p.rank ? `${p.rr} RR` : ' '}</div>
          </div>
          <RankIcon tier={p.rank} size={34} />
        </>) : p.scout ? (
          <Button size='sm' variant='subtle' icon={FiCrosshair} onClick={open} title={`Scout ${p.gameName}: rank and recent matches`}>Scout</Button>
        ) : <span className='text-[11px] text-muted' title='Streamer mode: hidden by VALORANT'>Hidden</span>}
        {p.ranked && (
          <div className='flex flex-col items-center w-10' title='Peak rank'>
            <RankIcon tier={p.peak} size={20} className='opacity-80' />
            <span className='text-[9px] uppercase tracking-wider text-muted'>Peak</span>
          </div>
        )}
      </div>
    </div>
  )
}
