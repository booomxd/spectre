import React from 'react'
import { useTiers } from '../../lib/content'
import { GUN_ICON, cardIcon, queueName, useModeIcon } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')

// A white valorant-api icon drawn in the current text color, so it follows the theme like the other icons.
export function MaskIcon({ src, size = '1em', width, className, style, title }) {
  const mask = { WebkitMaskImage: `url(${src})`, maskImage: `url(${src})`, WebkitMaskSize: 'contain', maskSize: 'contain', WebkitMaskRepeat: 'no-repeat', maskRepeat: 'no-repeat', WebkitMaskPosition: 'center', maskPosition: 'center' }
  return <span role='img' aria-label={title} title={title} className={cx('inline-block shrink-0 bg-current', className)} style={{ width: width ?? size, height: size, ...mask, ...style }} />
}

// Game mode icon for a queue id (nothing until valorant-api's mode list loads).
export function ModeIcon({ queue, size = 16, className }) {
  const src = useModeIcon(queue)
  return src ? <MaskIcon src={src} size={size} className={className} title={queueName(queue)} /> : null
}

// Gun silhouette, drawn wider than its box so it lines up with square icons.
export function GunIcon({ size = 16, className }) {
  const n = typeof size === 'number' ? size : 16
  return <MaskIcon src={GUN_ICON} size={n} width={n * 1.6} className={className} style={{ margin: `0 ${-n * 0.3}px` }} />
}

export function RankIcon({ tier, size = 28, className }) {
  const tiers = useTiers()
  const t = tiers?.[tier || 0]
  const src = t?.smallIcon || tiers?.[0]?.smallIcon
  if (!src) return <div className={cx('shrink-0 rounded bg-surface-2', className)} style={{ width: size, height: size }} />
  return <img src={src} alt={t?.tierName || 'Unranked'} title={t?.tierName || 'Unranked'} width={size} height={size} className={cx('shrink-0 object-contain', !tier && 'opacity-50', className)} />
}

// Player card art; falls back to the name's capitalized initial when there is no card (e.g. offline friends).
export function PlayerCard({ id, name, size = 40, className }) {
  const src = cardIcon(id)
  const initial = name ? [...name.trim()][0]?.toUpperCase() : null
  return (
    <div className={cx('shrink-0 overflow-hidden rounded-lg bg-surface-2 border border-line flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {src ? <img src={src} alt='' className='w-full h-full object-cover' loading='lazy' />
        : initial && <span className='font-display font-bold text-muted' style={{ fontSize: size * 0.42 }}>{initial}</span>}
    </div>
  )
}

export function AgentIcon({ agent, size = 40, locked = true, className }) {
  return (
    <div className={cx('shrink-0 overflow-hidden rounded-lg bg-surface-2 border border-line flex items-center justify-center text-muted text-xs', !locked && 'opacity-60', className)} style={{ width: size, height: size }}>
      {agent?.icon ? <img src={agent.icon} alt={agent.name} title={agent.name} className='w-full h-full object-cover' /> : '?'}
    </div>
  )
}

export function StatusDot({ state, className }) {
  const color = state === 'ingame' ? 'bg-good' : state === 'queue' || state === 'pregame' ? 'bg-warn' : state === 'menus' ? 'bg-accent' : state === 'away' ? 'bg-muted' : 'bg-line'
  return <span className={cx('inline-block w-2 h-2 rounded-full', color, (state === 'queue' || state === 'ingame') && 'anim-pulse', className)} />
}
