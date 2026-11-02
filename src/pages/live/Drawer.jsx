import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { FiEyeOff, FiX } from 'react-icons/fi'
import { Badge } from '../../ui'
import { AgentIcon } from './parts'

// Side panel that slides in from the right, below the window's title bar. Closes on Escape or a backdrop click.
export default function Drawer({ open, onClose, children, width = 'min(820px, 62vw)' }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className='anim-fade fixed inset-x-0 bottom-0 top-11 z-40 bg-black/50' onMouseDown={onClose}>
      <aside className='anim-slide absolute right-0 top-0 bottom-0 flex flex-col border-l border-line bg-bg shadow-2xl' style={{ width }} onMouseDown={e => e.stopPropagation()}>
        {children}
      </aside>
    </div>, document.body)
}

// Panel heading for a live-match player. Hidden players show only their agent, never a name.
export function PanelHeader({ player: p, sub, actions, onClose }) {
  return (
    <header className='flex items-center gap-3 px-5 py-4 border-b border-line shrink-0'>
      <AgentIcon agent={p.agent} size={44} />
      <div className='min-w-0 flex-1'>
        <div className='flex items-center gap-2 min-w-0'>
          <h3 className='font-display text-xl font-bold truncate'>{p.hidden ? (p.agent?.name || 'Hidden player') : p.gameName || '...'}</h3>
          {!p.hidden && p.tagLine && <span className='text-sm text-muted shrink-0'>#{p.tagLine}</span>}
          {p.hidden && <span title='Name hidden by streamer mode'><Badge><FiEyeOff /> Hidden</Badge></span>}
        </div>
        <div className='text-xs text-muted truncate'>{sub}</div>
      </div>
      {actions}
      <button className='w-9 h-9 shrink-0 rounded-lg border border-line text-muted hover:text-text hover:border-accent/40 transition-colors flex items-center justify-center' onClick={onClose} title='Close'><FiX /></button>
    </header>
  )
}
