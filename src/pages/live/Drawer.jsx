import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiEyeOff, FiX } from 'react-icons/fi'
import { AnimatePresence, Badge, SPRING_SOFT, Scrim, m, useReducedMotion } from '../../ui'
import { AgentIcon, RankGlow, useRankColor } from './parts'

// Side panel that springs in from the right, below the window's top bar (the dock row stays usable for window controls).
// Closes on Escape or a scrim click. The scrim has no blur; only the panel itself blurs (never stacked).
export default function Drawer({ open, onClose, children, width = 'min(820px, 62vw)' }) {
  const reduce = useReducedMotion()
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  return createPortal(
    <AnimatePresence>
      {open && (
        <Scrim key='drawer' className='top-16' onMouseDown={onClose}>
          <m.aside className='glass-strong absolute right-3 top-3 bottom-3 flex flex-col overflow-hidden rounded-3xl' style={{ width }} onMouseDown={e => e.stopPropagation()}
            initial={reduce ? { opacity: 0 } : { opacity: 0, x: 48 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: 32, transition: { duration: 0.16 } }}
            transition={SPRING_SOFT}>
            {children}
          </m.aside>
        </Scrim>
      )}
    </AnimatePresence>, document.body)
}

// Panel heading for a live-match player. Hidden players show only their agent, never a name.
export function PanelHeader({ player: p, sub, actions, onClose }) {
  const color = useRankColor(p.ranked ? p.rank : 0)
  return (
    <header className='relative shrink-0 overflow-hidden px-6 pt-5 pb-5'>
      <span className='absolute -left-16 -top-24 w-72 h-72 rounded-full pointer-events-none opacity-70'
        style={{ background: `radial-gradient(closest-side, ${color ? color + '38' : 'rgb(var(--accent) / 0.22)'}, transparent)` }} />
      <div className='relative flex items-center gap-4'>
        <AgentIcon agent={p.agent} size={60} className='!rounded-[20px] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)]' />
        <div className='min-w-0 flex-1'>
          <div className='eyebrow mb-1.5'>{sub}</div>
          <div className='flex items-baseline gap-2 min-w-0'>
            <h3 className='display text-[24px] text-text truncate'>{p.hidden ? (p.agent?.name || 'Hidden player') : p.gameName || '...'}</h3>
            {!p.hidden && p.tagLine && <span className='text-[14px] text-muted shrink-0'>#{p.tagLine}</span>}
            {p.hidden && <span className='self-center' title='Name hidden by streamer mode'><Badge><FiEyeOff /> Hidden</Badge></span>}
          </div>
        </div>
        {p.ranked && p.rank > 0 && <RankGlow tier={p.rank} size={40} className='mr-1' />}
        {actions}
        <button className='w-9 h-9 shrink-0 rounded-full glass-inset text-muted hover:text-text hover:bg-surface-2 transition-colors flex items-center justify-center' onClick={onClose} title='Close'><FiX /></button>
      </div>
      <div className='hairline absolute inset-x-6 bottom-0' />
    </header>
  )
}
