import { For, Show } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiBarChart2, FiCopy, FiEdit3, FiEye, FiEyeOff, FiUsers } from 'solid-icons/fi'
import { Badge, Item, toast } from '../../ui'
import { navigate } from '../../nav'
import { useTiers } from '../../lib/content'
import { AgentIcon, RankGlow, RankIcon, useRankColor } from './parts'
import { PARTY_COLORS, cardWide, partyLabel } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')

// display name respecting streamer mode: hidden players only ever show their agent
export const displayName = p => p.hidden ? (p.agent?.name || 'Hidden player') : p.gameName ? p.gameName : '...'

const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

// fade the wide card art in from the right so text on the left stays readable
const ART_MASK = { WebkitMaskImage: 'linear-gradient(90deg, transparent 18%, #000 78%)', maskImage: 'linear-gradient(90deg, transparent 18%, #000 78%)' }

function RankBlock(props) {
  const tiersA = useTiers()
  return (
    <div class='flex items-center gap-3 shrink-0 w-[148px]'>
      <RankGlow tier={props.tier} size={36} />
      <div class='leading-tight min-w-0'>
        <div class='text-[13px] font-semibold tracking-tight text-text truncate'>{props.tier ? title(tiersA()?.[props.tier]?.tierName) : 'Unranked'}</div>
        <div class='mt-0.5 flex items-center gap-1.5 text-[11px] text-muted tabular-nums'>
          {props.tier > 0 && <span>{props.rr} RR</span>}
          {props.peak > 0 && <span class='inline-flex items-center gap-1' title={`Peak: ${title(tiersA()?.[props.peak]?.tierName)}`}>
            {props.tier > 0 && <span class='w-0.5 h-0.5 rounded-full bg-muted' />}Peak <RankIcon tier={props.peak} size={14} />
          </span>}
        </div>
      </div>
    </div>
  )
}

// recent competitive form, shown once a player has been scouted
function MiniStats(props) {
  
    
    const chip = (value, label, tone) => (
    <span class='inline-flex items-baseline gap-1'>
      <b class={cx('text-[12px] font-semibold tabular-nums', tone || 'text-text')}>{value}</b><span class='text-[9.5px] font-semibold tracking-wide text-muted'>{label}</span>
    </span>
  )
    return (<Show when={!(!props.s)} fallback={<div class='mt-2 text-[11px] text-muted'>No recent competitive matches</div>}><div class='mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-0.5'>
      {chip(props.s.kd.toFixed(2), 'KD', props.s.kd >= 1.2 ? 'text-good' : props.s.kd < 0.9 ? 'text-bad' : null)}{chip(props.s.acs, 'ACS')}{props.s.hs != null && chip(`${props.s.hs}%`, 'HS')}{chip(`${props.s.wr}%`, 'WR')}
    </div></Show>)
  
}

const iconBtn = 'w-9 h-9 shrink-0 rounded-full text-muted glass-inset hover:text-text hover:bg-surface-2 hover:border-accent/40 transition-colors flex items-center justify-center'

// one live-match player
export default function PlayerRow(props) {
  const rankA = useRankColor(() => props.p.ranked ? props.p.rank : 0)
  
    const color = () => (props.p.party != null ? PARTY_COLORS[props.p.party % PARTY_COLORS.length] : null)
    const open = () => props.p.puuid && navigate('search', { puuid: props.p.puuid })
    const copy = () => navigator.clipboard.writeText(`${props.p.gameName}#${props.p.tagLine}`).then(() => toast('Riot ID copied')).catch(() => { })
    const memoText = () => (props.memo && (props.memo.note || props.memo.text || props.memo.title || 'Note'))
    return (<Item index={props.i} class={cx('glass group relative overflow-hidden rounded-[22px] transition-[border-color,box-shadow] duration-200',
      props.p.self ? 'accent-glow !border-accent/40' : 'hover:border-accent/30')}>
      {props.p.card && <img decoding='async' src={cardWide(props.p.card)} alt='' class='absolute inset-y-0 right-0 w-[70%] h-full object-cover opacity-[0.2] pointer-events-none' style={st(ART_MASK)} draggable={false} loading='lazy' />}
      {/* Rank-colored light behind the portrait */}
      {rankA() && <span class='absolute -left-10 top-1/2 -translate-y-1/2 w-44 h-44 rounded-full pointer-events-none opacity-50' style={st({ background: `radial-gradient(closest-side, ${rankA()}40, transparent)` })} />}
      {props.p.self && <span class='absolute inset-0 bg-gradient-to-r from-accent/[0.10] to-transparent pointer-events-none' />}
      {color() && <span class='absolute left-0 top-4 bottom-4 w-[3px] rounded-r-full' style={st({ background: color() })} title={props.p.party === 0 ? 'Your party' : 'Premade party'} />}
      {color() && <span class='absolute inset-0 pointer-events-none' style={st({ background: `linear-gradient(90deg, ${color()}14, transparent 38%)` })} />}

      <div class='relative flex items-center gap-4 pl-4 pr-3.5 py-3.5'>
        <div class='relative shrink-0'>
          <AgentIcon agent={props.p.agent} size={54} locked={props.p.locked} class='!rounded-2xl' />
          {props.p.level != null && <span class='absolute -bottom-1.5 left-1/2 -translate-x-1/2 h-4 px-1.5 rounded-full bg-panel border border-line text-[9px] font-bold text-muted tabular-nums leading-[14px]'>{props.p.level}</span>}
        </div>

        <div class='min-w-0 flex-1'>
          <div class='flex items-center gap-1.5 min-w-0'>
            {!props.p.puuid
              ? <span class='text-[15px] font-semibold tracking-tight text-text truncate shrink min-w-0'>{displayName(props.p)}</span>
              : <button class='text-[15px] font-semibold tracking-tight text-text truncate shrink min-w-0 hover:text-accent transition-colors text-left' onClick={open} title='Open profile'>{displayName(props.p)}</button>}
            {!props.p.hidden && props.p.tagLine && <span class='text-[11.5px] text-muted truncate shrink-0 max-w-[30%]'>#{props.p.tagLine}</span>}
            {!props.p.hidden && props.p.tagLine && <button class='text-muted opacity-0 group-hover:opacity-100 hover:text-text transition-opacity shrink-0' onClick={copy} title='Copy Riot ID'><FiCopy size={11} /></button>}
            {props.p.hidden && <span class='text-muted shrink-0' title='Name hidden by streamer mode'><FiEyeOff size={12} /></span>}
            {props.p.self && <Badge tone='accent'>You</Badge>}
            {color() && partyLabel(props.p.partySize) && (
              <span class='inline-flex items-center gap-1 h-5 px-2 rounded-full text-[10.5px] font-semibold shrink-0 border'
                style={st({ color: color(), borderColor: color() + '55', background: color() + '14' })} title={props.p.party === 0 ? 'Queued with you' : 'Queued together'}>
                <FiUsers size={10} />{partyLabel(props.p.partySize)}
              </span>
            )}
            {props.p.spectre && !props.p.hidden && <span title='Uses Spectre'><Badge tone='accent'>Spectre</Badge></span>}
          </div>
          <div class='flex items-center gap-2 text-[12px] mt-1 min-w-0'>
            {props.p.agent ? <span class={cx('font-semibold shrink-0', props.p.locked ? 'text-accent' : 'text-muted')}>{props.p.locked ? props.p.agent.name : `${props.p.agent.name} (hovering)`}</span> : <span class='text-muted'>Choosing...</span>}
            {props.memo && (
              <button class='inline-flex items-center gap-1 text-warn hover:text-text transition-colors min-w-0' title={memoText()}
                onClick={() => navigate('memo', { puuid: props.p.puuid, name: `${props.p.gameName}#${props.p.tagLine}` })}>
                <FiEdit3 class='shrink-0' /> <span class='truncate'>{memoText()}</span>
              </button>
            )}
          </div>
          {props.p.scouted !== undefined && <MiniStats s={props.p.scouted} />}
        </div>

        {props.p.ranked ? <RankBlock tier={props.p.rank} rr={props.p.rr} peak={props.p.peak} />
          : !props.p.canScout && <span class='inline-flex items-center gap-1.5 h-7 px-3 rounded-full glass-inset text-[11px] font-semibold text-muted shrink-0' title='Streamer mode: hidden by VALORANT'><FiEyeOff size={11} /> Hidden</span>}

        {/* actions on top, Vandal and Phantom skins under them on wide windows */}
        <div class='flex flex-col items-end gap-2 shrink-0'>
          <div class='flex items-center gap-1.5'>
            {props.p.canScout && (
              <button onClick={() => props.onScout(props.p)} title='Rank history, recent form and matches'
                class='h-9 px-3 rounded-full inline-flex items-center gap-1.5 text-[12px] font-semibold text-text accent-soft hover:bg-accent/20 transition-colors'>
                <FiBarChart2 class='text-accent' /><span class='hidden min-[1500px]:inline'>Scout</span>
              </button>
            )}
            {props.p.guns && <button class={iconBtn} onClick={() => props.onSkins(props.p)} title={`See ${displayName(props.p)}'s skins, sprays and gun buddies`}><FiEye /></button>}
          </div>
          {props.p.guns?.length > 0 && (
            <div class='hidden min-[1700px]:flex items-center gap-2.5'>
              <For each={props.p.guns}>{g => <img decoding='async' src={g.image} alt={g.skin} title={g.skin} class='h-6 w-[76px] object-contain' draggable={false} loading='lazy' />}</For>
            </div>
          )}
        </div>
      </div>
    </Item>)
  
}
