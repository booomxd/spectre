import React from 'react'
import { FiBarChart2, FiCopy, FiEdit3, FiEye, FiEyeOff, FiUsers } from 'react-icons/fi'
import { Badge, Item, toast } from '../../ui'
import { navigate } from '../../nav'
import { useTiers } from '../../lib/content'
import { AgentIcon, RankGlow, RankIcon, useRankColor } from './parts'
import { PARTY_COLORS, cardWide, partyLabel } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')

// Display name respecting streamer mode: hidden players only ever show their agent.
export const displayName = p => p.hidden ? (p.agent?.name || 'Hidden player') : p.gameName ? p.gameName : '...'

const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

// Fade the wide card art in from the right so text on the left stays readable.
const ART_MASK = { WebkitMaskImage: 'linear-gradient(90deg, transparent 18%, #000 78%)', maskImage: 'linear-gradient(90deg, transparent 18%, #000 78%)' }

function RankBlock({ tier, rr, peak }) {
  const tiers = useTiers()
  return (
    <div className='flex items-center gap-3 shrink-0 w-[148px]'>
      <RankGlow tier={tier} size={36} />
      <div className='leading-tight min-w-0'>
        <div className='text-[13px] font-semibold tracking-tight text-text truncate'>{tier ? title(tiers?.[tier]?.tierName) : 'Unranked'}</div>
        <div className='mt-0.5 flex items-center gap-1.5 text-[11px] text-muted tabular-nums'>
          {tier > 0 && <span>{rr} RR</span>}
          {peak > 0 && <span className='inline-flex items-center gap-1' title={`Peak: ${title(tiers?.[peak]?.tierName)}`}>
            {tier > 0 && <span className='w-0.5 h-0.5 rounded-full bg-muted' />}Peak <RankIcon tier={peak} size={14} />
          </span>}
        </div>
      </div>
    </div>
  )
}

// Recent competitive form, shown once a player has been scouted (null: scouted, but no recent competitive games).
function MiniStats({ s }) {
  if (!s) return <div className='mt-2 text-[11px] text-muted'>No recent competitive matches</div>
  const chip = (value, label, tone) => (
    <span className='inline-flex items-baseline gap-1'>
      <b className={cx('text-[12px] font-semibold tabular-nums', tone || 'text-text')}>{value}</b><span className='text-[9.5px] font-semibold tracking-wide text-muted'>{label}</span>
    </span>
  )
  return (
    <div className='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5'>
      {chip(s.kd.toFixed(2), 'KD', s.kd >= 1.2 ? 'text-good' : s.kd < 0.9 ? 'text-bad' : null)}{chip(s.acs, 'ACS')}{s.hs != null && chip(`${s.hs}%`, 'HS')}{chip(`${s.wr}%`, 'WR')}
    </div>
  )
}

const iconBtn = 'w-9 h-9 shrink-0 rounded-full text-muted glass-inset hover:text-text hover:bg-surface-2 hover:border-accent/40 transition-colors flex items-center justify-center'

// One live-match player. Rendered inside a <Stagger> (the team column); only the first 12 rows animate in.
export default function PlayerRow({ p, i, memo, onScout, onSkins }) {
  const color = p.party != null ? PARTY_COLORS[p.party % PARTY_COLORS.length] : null
  const rank = useRankColor(p.ranked ? p.rank : 0)
  const open = () => p.puuid && navigate('search', { puuid: p.puuid })
  const copy = () => navigator.clipboard.writeText(`${p.gameName}#${p.tagLine}`).then(() => toast('Riot ID copied')).catch(() => { })
  const memoText = memo && (memo.note || memo.text || memo.title || 'Note')
  return (
    <Item index={i} className={cx('glass group relative overflow-hidden rounded-[22px] transition-[border-color,box-shadow] duration-200',
      p.self ? 'accent-glow !border-accent/40' : 'hover:border-accent/30')}>
      {p.card && <img src={cardWide(p.card)} alt='' className='absolute inset-y-0 right-0 w-[70%] h-full object-cover opacity-[0.2] pointer-events-none' style={ART_MASK} draggable={false} loading='lazy' />}
      {/* Rank-colored light behind the portrait. */}
      {rank && <span className='absolute -left-10 top-1/2 -translate-y-1/2 w-44 h-44 rounded-full pointer-events-none opacity-50' style={{ background: `radial-gradient(closest-side, ${rank}40, transparent)` }} />}
      {p.self && <span className='absolute inset-0 bg-gradient-to-r from-accent/[0.10] to-transparent pointer-events-none' />}
      {color && <span className='absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full' style={{ background: color }} title={p.party === 0 ? 'Your party' : 'Premade party'} />}
      {color && <span className='absolute inset-0 pointer-events-none' style={{ background: `linear-gradient(90deg, ${color}14, transparent 38%)` }} />}

      <div className='relative flex items-center gap-4 pl-4 pr-3.5 py-3.5'>
        <div className='relative shrink-0'>
          <AgentIcon agent={p.agent} size={54} locked={p.locked} className='!rounded-2xl' />
          {p.level != null && <span className='absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-4 px-1.5 rounded-full bg-panel border border-line text-[9px] font-bold text-muted tabular-nums leading-[14px]'>{p.level}</span>}
        </div>

        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-1.5 min-w-0'>
            {!p.puuid
              ? <span className='text-[15px] font-semibold tracking-tight text-text truncate shrink min-w-0'>{displayName(p)}</span>
              : <button className='text-[15px] font-semibold tracking-tight text-text truncate shrink min-w-0 hover:text-accent transition-colors text-left' onClick={open} title='Open profile'>{displayName(p)}</button>}
            {!p.hidden && p.tagLine && <span className='text-[11.5px] text-muted truncate shrink-0 max-w-[30%]'>#{p.tagLine}</span>}
            {!p.hidden && p.tagLine && <button className='text-muted opacity-0 group-hover:opacity-100 hover:text-text transition-opacity shrink-0' onClick={copy} title='Copy Riot ID'><FiCopy size={11} /></button>}
            {p.hidden && <span className='text-muted shrink-0' title='Name hidden by streamer mode'><FiEyeOff size={12} /></span>}
            {p.self && <Badge tone='accent'>You</Badge>}
            {color && partyLabel(p.partySize) && (
              <span className='inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10.5px] font-semibold shrink-0 border'
                style={{ color, borderColor: color + '55', background: color + '14' }} title={p.party === 0 ? 'Queued with you' : 'Queued together'}>
                <FiUsers size={10} />{partyLabel(p.partySize)}
              </span>
            )}
            {p.spectre && !p.hidden && <span title='Uses Spectre'><Badge tone='accent'>Spectre</Badge></span>}
          </div>
          <div className='flex items-center gap-2 text-[12px] mt-1 min-w-0'>
            {p.agent ? <span className={cx('font-semibold shrink-0', p.locked ? 'text-accent' : 'text-muted')}>{p.locked ? p.agent.name : `${p.agent.name} (hovering)`}</span> : <span className='text-muted'>Choosing...</span>}
            {memo && (
              <button className='inline-flex items-center gap-1 text-warn hover:text-text transition-colors min-w-0' title={memoText}
                onClick={() => navigate('memo', { puuid: p.puuid, name: `${p.gameName}#${p.tagLine}` })}>
                <FiEdit3 className='shrink-0' /> <span className='truncate'>{memoText}</span>
              </button>
            )}
          </div>
          {p.scouted !== undefined && <MiniStats s={p.scouted} />}
        </div>

        {p.ranked ? <RankBlock tier={p.rank} rr={p.rr} peak={p.peak} />
          : !p.canScout && <span className='inline-flex items-center gap-1.5 h-7 px-3 rounded-full glass-inset text-[11px] font-semibold text-muted shrink-0' title='Streamer mode: hidden by VALORANT'><FiEyeOff size={11} /> Hidden</span>}

        {/* Actions on top, Vandal and Phantom skins under them on wide windows. */}
        <div className='flex flex-col items-end gap-2 shrink-0'>
          <div className='flex items-center gap-1.5'>
            {p.canScout && (
              <button onClick={() => onScout(p)} title='Rank history, recent form and matches'
                className='h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold text-text accent-soft hover:bg-accent/20 transition-colors'>
                <FiBarChart2 className='text-accent' /><span className='hidden min-[1500px]:inline'>Scout</span>
              </button>
            )}
            {p.guns && <button className={iconBtn} onClick={() => onSkins(p)} title={`See ${displayName(p)}'s skins, sprays and gun buddies`}><FiEye /></button>}
          </div>
          {p.guns?.length > 0 && (
            <div className='hidden min-[1700px]:flex items-center gap-2.5'>
              {p.guns.map(g => <img key={g.weapon} src={g.image} alt={g.skin} title={g.skin} className='h-6 w-[76px] object-contain' draggable={false} loading='lazy' />)}
            </div>
          )}
        </div>
      </div>
    </Item>
  )
}
