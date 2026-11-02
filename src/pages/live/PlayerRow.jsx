import React from 'react'
import { FiBarChart2, FiCopy, FiEdit3, FiEye, FiEyeOff } from 'react-icons/fi'
import { Badge, Button, toast } from '../../ui'
import { navigate } from '../../nav'
import { useTiers } from '../../lib/content'
import { AgentIcon, RankIcon } from './parts'
import { PARTY_COLORS, cardWide } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')

// Display name respecting streamer mode: hidden players only ever show their agent.
export const displayName = p => p.hidden ? (p.agent?.name || 'Hidden player') : p.gameName ? p.gameName : '...'

const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

function RankStat({ tier, sub, className }) {
  const tiers = useTiers()
  return (
    <div className={cx('flex items-center gap-2 shrink-0 w-[116px]', className)}>
      <RankIcon tier={tier} size={30} />
      <div className='leading-tight min-w-0'>
        <div className='text-[12px] font-semibold text-text truncate'>{tier ? title(tiers?.[tier]?.tierName) : 'Unranked'}</div>
        <div className='text-[10px] text-muted truncate'>{sub}</div>
      </div>
    </div>
  )
}

// Recent competitive form, shown once a player has been scouted (null: scouted, but no recent competitive games).
function MiniStats({ s }) {
  if (!s) return <div className='mt-1 text-[10px] text-muted'>No recent competitive matches</div>
  const item = (value, label) => <span><b className='font-semibold text-text'>{value}</b> {label}</span>
  return (
    <div className='mt-1 flex flex-wrap items-center gap-x-3 text-[10px] uppercase tracking-wider text-muted'>
      {item(s.kd.toFixed(2), 'KD')}{item(s.acs, 'ACS')}{s.hs != null && item(`${s.hs}%`, 'HS')}{item(`${s.wr}%`, 'WR')}
    </div>
  )
}

const iconBtn = 'w-8 h-8 shrink-0 rounded-lg border border-line bg-surface-2/70 text-muted hover:text-text hover:border-accent/40 transition-colors flex items-center justify-center'

export default function PlayerRow({ p, i, memo, onScout, onSkins }) {
  const color = p.party != null ? PARTY_COLORS[p.party % PARTY_COLORS.length] : null
  const open = () => p.puuid && navigate('search', { puuid: p.puuid })
  const copy = () => navigator.clipboard.writeText(`${p.gameName}#${p.tagLine}`).then(() => toast('Riot ID copied')).catch(() => { })
  const memoText = memo && (memo.note || memo.text || memo.title || 'Note')
  return (
    <div className={cx('anim-rise relative overflow-hidden rounded-xl border bg-surface transition-colors', p.self ? 'border-accent/50' : 'border-line hover:border-accent/30')} style={{ '--i': i }}>
      {p.card && <img src={cardWide(p.card)} alt='' className='absolute inset-0 w-full h-full object-cover opacity-20' draggable={false} loading='lazy' />}
      <div className='absolute inset-0 bg-gradient-to-r from-surface via-surface/85 to-surface/50' />
      <span className='absolute left-0 top-0 bottom-0 w-1' style={{ background: color || 'transparent' }} title={color ? 'Premade party' : undefined} />
      <div className='relative flex items-center gap-3 pl-4 pr-3 py-3'>
        <AgentIcon agent={p.agent} size={46} locked={p.locked} />
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-1.5 min-w-0'>
            {!p.puuid
              ? <span className='text-[14px] font-bold text-text truncate'>{displayName(p)}</span>
              : <button className='text-[14px] font-bold text-text truncate hover:text-accent transition-colors text-left' onClick={open} title='Open profile'>{displayName(p)}</button>}
            {!p.hidden && p.tagLine && <span className='text-[11px] text-muted shrink-0'>#{p.tagLine}</span>}
            {!p.hidden && p.tagLine && <button className='text-muted hover:text-text transition-colors shrink-0' onClick={copy} title='Copy Riot ID'><FiCopy size={11} /></button>}
            {p.hidden && <span className='text-muted shrink-0' title='Name hidden by streamer mode'><FiEyeOff size={12} /></span>}
            {p.self && <Badge tone='accent'>You</Badge>}
            {p.spectre && !p.hidden && <span title='Uses Spectre'><Badge tone='accent'>Spectre</Badge></span>}
          </div>
          <div className='flex items-center gap-2 text-[11px] mt-0.5 min-w-0'>
            {p.agent ? <span className='font-semibold text-accent shrink-0'>{p.locked ? p.agent.name : `${p.agent.name} (hovering)`}</span> : <span className='text-muted'>Choosing...</span>}
            {p.level != null && <span className='text-muted shrink-0'>Lv {p.level}</span>}
            {memo && (
              <button className='inline-flex items-center gap-1 text-warn hover:text-text transition-colors min-w-0' title={memoText}
                onClick={() => navigate('memo', { puuid: p.puuid, name: `${p.gameName}#${p.tagLine}` })}>
                <FiEdit3 className='shrink-0' /> <span className='truncate'>{memoText}</span>
              </button>
            )}
          </div>
          {p.scouted !== undefined && <MiniStats s={p.scouted} />}
        </div>
        {p.ranked ? (<>
          <RankStat tier={p.rank} sub={p.rank ? `Current · ${p.rr} RR` : 'Current'} />
          <RankStat tier={p.peak} sub='Peak' className='hidden min-[1600px]:flex' />
          <div className='flex flex-col items-center w-9 shrink-0 min-[1600px]:hidden' title='Peak rank'>
            <RankIcon tier={p.peak} size={22} />
            <span className='text-[9px] uppercase tracking-wider text-muted'>Peak</span>
          </div>
        </>) : !p.canScout && <span className='text-[11px] text-muted' title='Streamer mode: hidden by VALORANT'>Hidden</span>}
        {/* Actions on top, Vandal and Phantom skins under them on wide windows. */}
        <div className='flex flex-col items-end gap-2 shrink-0'>
          <div className='flex items-center gap-1.5'>
            {p.canScout && <Button size='sm' variant='subtle' icon={FiBarChart2} onClick={() => onScout(p)} title='Rank history, recent form and matches'><span className='hidden min-[1600px]:inline'>Scout</span></Button>}
            {p.guns && <button className={iconBtn} onClick={() => onSkins(p)} title={`See ${displayName(p)}'s skins, sprays and gun buddies`}><FiEye /></button>}
          </div>
          {p.guns?.length > 0 && (
            <div className='hidden min-[1700px]:flex items-center gap-2'>
              {p.guns.map(g => <img key={g.weapon} src={g.image} alt={g.skin} title={g.skin} className='h-6 w-[76px] object-contain' draggable={false} loading='lazy' />)}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
