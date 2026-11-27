import { Show, createMemo } from 'solid-js'
import { st } from '../../lib/st.js'
import { useTiers } from '../../lib/content'
import { GUN_ICON, cardIcon, queueName, useModeIcon } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')

// A white valorant-api icon drawn in the current text color
export function MaskIcon(props) {
  
    const mask = () => ({ WebkitMaskImage: `url(${props.src})`, maskImage: `url(${props.src})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' })
    return (<span role='img' aria-label={props.title} title={props.title} class={cx('inline-block shrink-0 bg-current', props["class"])} style={st({ width: props.width ?? (props.size ?? '1em'), height: (props.size ?? '1em'), ...mask(), ...props.style })} />)
  
}

// game mode icon for a queue id
export function ModeIcon(props) {
  const srcA = useModeIcon(() => props.queue)
  return <Show when={srcA()}><MaskIcon src={srcA()} size={(props.size ?? 16)} class={props["class"]} title={queueName(props.queue)} /></Show>
}

// gun silhouette, drawn wider than its box so it lines up with square icons
export function GunIcon(props) {
  
    const n = () => (typeof (props.size ?? 16) === 'number' ? (props.size ?? 16) : 16)
    return (<MaskIcon src={GUN_ICON} size={n()} width={n() * 1.6} class={props["class"]} style={st({ margin: `0 ${-n() * 0.3}px` })} />)
  
}

export function RankIcon(props) {
  const tiersA = useTiers()
  
    const t = () => (tiersA()?.[props.tier || 0])
    const src = () => (t()?.smallIcon || tiersA()?.[0]?.smallIcon)
    
    return (<Show when={!(!src())} fallback={<div class={cx('shrink-0 rounded-full bg-surface-2', props["class"])} style={st({ width: (props.size ?? 28), height: (props.size ?? 28) })} />}><img decoding='async' src={src()} alt={t()?.tierName || 'Unranked'} title={t()?.tierName || 'Unranked'} width={(props.size ?? 28)} height={(props.size ?? 28)} class={cx('shrink-0 object-contain', !props.tier && 'opacity-50', props["class"])} /></Show>)
  
}

// player card art; falls back to the name's capitalized initial when there is no card
export function PlayerCard(props) {
  
    const src = () => (cardIcon(props.id))
    const initial = () => (props.name ? [...props.name.trim()][0]?.toUpperCase() : null)
    return (<div class={cx('shrink-0 overflow-hidden rounded-[12px] bg-surface-2 border border-line flex items-center justify-center', props["class"])} style={st({ width: (props.size ?? 40), height: (props.size ?? 40) })}>
      {src() ? <img decoding='async' src={src()} alt='' class='w-full h-full object-cover' loading='lazy' />
        : initial() && <span class='font-display font-bold text-muted' style={st({ fontSize: (props.size ?? 40) * 0.42 })}>{initial()}</span>}
    </div>)
  
}

export function AgentIcon(props) {
  return (
    <div class={cx('shrink-0 overflow-hidden rounded-xl bg-surface-2 border border-line flex items-center justify-center text-muted text-xs', !(props.locked ?? true) && 'opacity-60', props["class"])} style={st({ width: (props.size ?? 40), height: (props.size ?? 40) })}>
      {props.agent?.icon ? <img decoding='async' src={props.agent.icon} alt={props.agent.name} title={props.agent.name} class='w-full h-full object-cover' /> : '?'}
    </div>
  )
}

export function StatusDot(props) {
  
    const color = () => (props.state === 'ingame' ? 'bg-good' : props.state === 'queue' || props.state === 'pregame' ? 'bg-warn' : props.state === 'menus' ? 'bg-accent' : props.state === 'away' ? 'bg-muted' : 'bg-line')
    return (<span class={cx('inline-block w-2 h-2 rounded-full', color(), (props.state === 'queue' || props.state === 'ingame') && 'anim-pulse', props["class"])} />)
  
}

// tier color as '#rrggbb'
// tier is an accessor; returns an accessor
export function useRankColor(tier) {
  const tiers = useTiers()
  return createMemo(() => {
    const t = tier()
    const c = t > 0 && tiers()?.[t]?.color
    return c ? `#${c.slice(0, 6)}` : null
  })
}

// rank icon sitting on a soft glow in its own tier color
export function RankGlow(props) {
  const colorA = useRankColor(() => props.tier)
  return (
    <span class={cx('relative inline-grid place-items-center shrink-0', props["class"])} style={st({ width: (props.size ?? 34), height: (props.size ?? 34) })}>
      {colorA() && <span class='absolute -inset-2 rounded-full opacity-60 pointer-events-none' style={st({ background: `radial-gradient(closest-side, ${colorA()}66, transparent)` })} />}
      <RankIcon tier={props.tier} size={(props.size ?? 34)} class='relative' />
    </span>
  )
}
