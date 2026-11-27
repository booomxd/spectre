import { Show, createEffect, createSignal, on, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import { st } from '../../lib/st.js'
import { FiEyeOff, FiX } from 'solid-icons/fi'
import { Badge, Scrim, cx, useReducedMotion } from '../../ui'
import { AgentIcon, RankGlow, useRankColor } from './parts'

// side panel that springs in from the right, below the window's top bar
export default function Drawer(props) {
  const reduceA = useReducedMotion()
  createEffect(on(() => [props.open, props.onClose], () => {
    if (!props.open) return
    const onKey = e => e.key === 'Escape' && props.onClose?.()
    window.addEventListener('keydown', onKey)
    onCleanup(() => window.removeEventListener('keydown', onKey))
  }))
  // stays mounted for a short exit slide after `open` turns false
  const [mounted, setMounted] = createSignal(!!props.open)
  const [closing, setClosing] = createSignal(false)
  createEffect(on(() => !!props.open, open => {
    if (open) { setClosing(false); setMounted(true); return }
    if (!mounted()) return
    if (reduceA()) { setMounted(false); return }
    setClosing(true)
    const t = setTimeout(() => { setMounted(false); setClosing(false) }, 170)
    onCleanup(() => clearTimeout(t))
  }, { defer: true }))
  return (
    <Show when={mounted()}>
      <Portal>
        <Scrim class={cx('top-16', closing() && 'anim-scrim-out pointer-events-none')} onMouseDown={props.onClose}>
          <aside class={cx('glass-strong absolute right-3 top-3 bottom-3 flex flex-col overflow-hidden rounded-3xl', closing() ? 'anim-drawer-out' : reduceA() ? 'anim-fade' : 'anim-drawer')} style={st({ width: (props.width ?? 'min(820px, 62vw)') })} onMouseDown={e => e.stopPropagation()}>
            {props.children}
          </aside>
        </Scrim>
      </Portal>
    </Show>
  )
}

// panel heading for a live-match player
export function PanelHeader(props) {
  const colorA = useRankColor(() => props.player.ranked ? props.player.rank : 0)
  return (
    <header class='relative shrink-0 overflow-hidden px-7 pt-6 pb-5'>
      <span class='absolute -left-16 -top-24 w-72 h-72 rounded-full pointer-events-none opacity-70'
        style={st({ background: `radial-gradient(closest-side, ${colorA() ? colorA() + '38' : 'rgb(var(--accent) / 0.22)'}, transparent)` })} />
      <div class='relative flex items-center gap-4'>
        <AgentIcon agent={props.player.agent} size={60} class='!rounded-[20px] shadow-[0_10px_30px_-12px_rgb(0_0_0/0.6)]' />
        <div class='min-w-0 flex-1'>
          <div class='eyebrow mb-1.5'>{props.sub}</div>
          <div class='flex items-baseline gap-2 min-w-0'>
            <h3 class='display text-[28px] text-text truncate'>{props.player.hidden ? (props.player.agent?.name || 'Hidden player') : props.player.gameName || '...'}</h3>
            {!props.player.hidden && props.player.tagLine && <span class='text-[14px] text-muted shrink-0'>#{props.player.tagLine}</span>}
            {props.player.hidden && <span class='self-center' title='Name hidden by streamer mode'><Badge><FiEyeOff /> Hidden</Badge></span>}
          </div>
        </div>
        {props.player.ranked && props.player.rank > 0 && <RankGlow tier={props.player.rank} size={40} class='mr-1' />}
        {props.actions}
        <button class='w-9 h-9 shrink-0 rounded-full glass-inset text-muted hover:text-text hover:bg-surface-2 transition-colors flex items-center justify-center' onClick={props.onClose} title='Close'><FiX /></button>
      </div>
      <div class='hairline absolute inset-x-6 bottom-0' />
    </header>
  )
}
