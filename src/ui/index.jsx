// shared UI kit
import React, { createContext, useContext, useEffect, useId, useState, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle, FiInbox, FiLoader, FiX } from 'react-icons/fi'
import { useRiot } from '../lib/riot'
import { AnimatePresence, Pill, SPRING, m } from './motion'

export { MotionProvider, PageTransition, Pill, Stagger, Item, FadeIn, Swap, m, AnimatePresence, LayoutGroup, useReducedMotion, EASE, SPRING, SPRING_SOFT } from './motion'
export { default as CommandPalette } from './CommandPalette'

export const cx = (...c) => c.filter(Boolean).join(' ')

// Set by the shell / Settings: `section` is the dock section a page belongs to (shown as the eyebrow over the title);
// `embedded` renders a page inside another page (Settings > Experimental) without its own scroller or outer padding.
export const PageContext = createContext({ section: null, embedded: false })

// true while the page a component lives in is the one on screen
export const PageActiveContext = createContext(true)
export const usePageActive = () => useContext(PageActiveContext)

const onVisibility = cb => { document.addEventListener('visibilitychange', cb); return () => document.removeEventListener('visibilitychange', cb) }
// false while the window is minimized, hidden to the tray or otherwise not visible
export const useDocumentVisible = () => useSyncExternalStore(onVisibility, () => document.visibilityState !== 'hidden', () => true)

// current time (ms) that ticks every `interval` ms, aligned to the interval so second readouts change together
export function useNow(interval = 1000) {
  const active = usePageActive()
  const visible = useDocumentVisible()
  const running = active && visible
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    if (!running) return
    let t = 0
    const tick = () => { const n = Date.now(); setNow(n); t = setTimeout(tick, interval - (n % interval) + 5) }
    tick()
    return () => clearTimeout(t)
  }, [running, interval])
  return now
}

// page frame: eyebrow + display title + subtitle + actions, then a scrolling body
export function Page({ title, subtitle, actions, eyebrow, children, className, bodyClassName }) {
  const { section, embedded } = useContext(PageContext)
  const kicker = eyebrow ?? section
  if (embedded) {
    return (
      <div className={className}>
        {(title || actions) && (
          <header className='flex items-end justify-between gap-4 pb-5'>
            <div className='min-w-0'>
              {title && <h2 className='display text-[26px] text-text'>{title}</h2>}
              {subtitle && <p className='mt-2 text-[13px] text-muted'>{subtitle}</p>}
            </div>
            {actions && <div className='flex items-center gap-2 shrink-0'>{actions}</div>}
          </header>
        )}
        <div className={bodyClassName}>{children}</div>
      </div>
    )
  }
  return (
    <div className={cx('h-full flex flex-col', className)}>
      {(title || actions) && (
        <header className='flex items-end justify-between gap-6 px-8 pt-7 pb-6'>
          <div className='min-w-0'>
            {kicker && title && <div className='eyebrow mb-2.5 flex items-center gap-2'><span className='w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]' />{kicker}</div>}
            {title && <h1 className='display text-[38px] text-text'>{title}</h1>}
            {subtitle && <p className='mt-2.5 text-[13.5px] text-muted max-w-2xl'>{subtitle}</p>}
          </div>
          {actions && <div className='flex items-center gap-2 shrink-0'>{actions}</div>}
        </header>
      )}
      <div className={cx('flex-1 overflow-y-auto px-8 pb-8', bodyClassName)}>{children}</div>
    </div>
  )
}

// keyboard access for a clickable element that is not a <button>: focusable, announced as a button, Enter / Space click
export function pressable(onClick) {
  if (!onClick) return {}
  return {
    role: 'button', tabIndex: 0, onClick,
    onKeyDown: e => {
      if (e.target !== e.currentTarget || (e.key !== 'Enter' && e.key !== ' ')) return
      e.preventDefault()
      onClick(e)
    },
  }
}

// card: glass surface, 24px radius by default (pages may still pass rounded-*). hover = lift + pointer spotlight
export function Card({ className, hover, glow, blur, children, as: Tag = 'div', onClick, ...rest }) {
  const press = typeof Tag === 'string' && Tag !== 'button' && Tag !== 'a' ? pressable(onClick) : { onClick }
  return (
    <Tag className={cx('glass rounded-2xl', hover && 'lift spot cursor-pointer', glow && 'accent-glow', blur && 'glass-blur', className)} {...press} {...rest}>{children}</Tag>
  )
}

export function SectionTitle({ children, right, className }) {
  return (
    <div className={cx('flex items-center justify-between gap-3 mb-3.5', className)}>
      <h2 className='eyebrow'>{children}</h2>
      {right}
    </div>
  )
}

// section heading for bento tiles / larger groups: bold title + optional hint and right slot
export function Heading({ children, hint, right, className }) {
  return (
    <div className={cx('flex items-end justify-between gap-3 mb-4', className)}>
      <div className='min-w-0'>
        <h3 className='font-display text-[17px] font-bold tracking-tight text-text'>{children}</h3>
        {hint && <p className='text-[12px] text-muted mt-1'>{hint}</p>}
      </div>
      {right}
    </div>
  )
}

const BTN = {
  primary: 'accent-fill text-bg hover:brightness-110',
  subtle: 'glass text-text hover:border-accent/40 hover:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-bad/12 text-bad border border-bad/30 hover:bg-bad/20',
  glow: 'accent-soft text-text hover:bg-accent/20',
}
export function Button({ variant = 'subtle', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }) {
  const sz = size === 'sm' ? 'h-8 px-3.5 text-xs' : size === 'lg' ? 'h-11 px-6 text-sm' : size === 'icon' ? 'h-9 w-9 text-[15px]' : 'h-9 px-4 text-[13px]'
  return (
    <button disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,filter,background-color,border-color,color,box-shadow] duration-200 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        sz, BTN[variant] || BTN.subtle, className)} {...rest}>
      {loading ? <FiLoader className='animate-spin' /> : Icon && <Icon />}
      {children}
    </button>
  )
}

const FIELD = 'glass-field w-full h-10 rounded-xl px-3.5 text-[13px] text-text placeholder:text-muted/60 outline-none transition-[border-color,box-shadow] duration-200'
export const Input = React.forwardRef(({ className, ...rest }, ref) => <input ref={ref} className={cx(FIELD, className)} {...rest} />)
export const Textarea = React.forwardRef(({ className, ...rest }, ref) => <textarea ref={ref} className={cx(FIELD, 'h-auto py-2.5 resize-none', className)} {...rest} />)
export function Select({ className, options, ...rest }) {
  return (
    <select className={cx(FIELD, 'pr-8 cursor-pointer', className)} {...rest}>
      {options.map(o => <option key={o.value} value={o.value} className='bg-panel text-text'>{o.label}</option>)}
    </select>
  )
}

export function Label({ children, hint }) {
  return (
    <div className='mb-1.5'>
      <span className='text-[12.5px] font-semibold text-text/90'>{children}</span>
      {hint && <p className='text-[11.5px] text-muted mt-0.5'>{hint}</p>}
    </div>
  )
}

// switch
export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cx('flex items-center justify-between gap-4 cursor-pointer', disabled && 'opacity-50 pointer-events-none')}>
      {(label || hint) && <span className='min-w-0'><span className='block text-[13px] font-medium text-text'>{label}</span>{hint && <span className='block text-[11.5px] text-muted mt-0.5'>{hint}</span>}</span>}
      <button type='button' role='switch' aria-checked={!!checked} aria-label={typeof label === 'string' ? label : undefined} onClick={() => onChange(!checked)}
        className={cx('relative w-11 h-6 rounded-full transition-[background-color,box-shadow] duration-300 shrink-0', checked ? 'accent-fill' : 'glass-field')}>
        <span className={cx('absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-spring', checked && 'translate-x-5')} />
      </button>
    </label>
  )
}

// segmented control with a spring pill that slides under the active option (shared layoutId). tabs: strings or { value, label, icon?, count? }. size: 'sm' | 'md' | 'lg'. variant: 'glass' (own container) | 'bare'
export function SegmentedTabs({ tabs, value, onChange, size = 'md', variant = 'glass', className, layoutId }) {
  const auto = useId()
  const id = layoutId || 'seg' + auto
  const h = size === 'sm' ? 'h-7 px-3 text-[12px]' : size === 'lg' ? 'h-9 px-4 text-[13px]' : 'h-8 px-3.5 text-[12.5px]'
  return (
    <div role='tablist' className={cx('relative inline-flex items-center gap-0.5', variant === 'glass' && 'glass p-1 rounded-full', className)}>
      {tabs.map(t => {
        const v = t?.value ?? t
        const on = value === v
        const Icon = t?.icon
        return (
          <button key={v} role='tab' aria-selected={on} onClick={() => onChange(v)}
            className={cx('relative rounded-full font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors duration-200', h, on ? 'text-text' : 'text-muted hover:text-text')}>
            {on && <Pill layoutId={id} />}
            {Icon && <Icon className={cx('relative', on && 'text-accent')} size={13} />}
            <span className='relative'>{t?.label ?? t}</span>
            {t?.count != null && <span className='relative text-[10px] font-bold text-muted tabular-nums'>{t.count}</span>}
          </button>
        )
      })}
    </div>
  )
}
// v2 name, same API
export function Tabs(props) { return <SegmentedTabs {...props} /> }

const TONES = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent/12 text-accent border-accent/30',
  good: 'bg-good/12 text-good border-good/30',
  bad: 'bg-bad/12 text-bad border-bad/30',
  warn: 'bg-warn/12 text-warn border-warn/30',
}
export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx('inline-flex items-center gap-1 h-5 px-2 shrink-0 whitespace-nowrap rounded-full border text-[10px] font-semibold tracking-wide uppercase', TONES[tone] || TONES.neutral, className)}>{children}</span>
}

export function Stat({ label, value, sub, className, size = 'md' }) {
  return (
    <div className={className}>
      <div className='text-[11px] font-semibold text-muted'>{label}</div>
      <div className={cx('font-display font-bold text-text leading-tight tabular-nums mt-0.5', size === 'lg' ? 'text-[34px] tracking-tight' : 'text-2xl')}>{value}</div>
      {sub && <div className='text-[11px] text-muted mt-0.5'>{sub}</div>}
    </div>
  )
}

export function Skeleton({ className, style }) { return <div className={cx('skeleton', className)} style={style} /> }

export function Spinner({ className }) { return <FiLoader className={cx('animate-spin text-muted', className)} /> }

export function Empty({ icon: Icon = FiInbox, title, hint, action, className }) {
  return (
    <div className={cx('anim-fade flex flex-col items-center justify-center text-center gap-2 py-16', className)}>
      <div className='relative mb-2'>
        <span className='halo -inset-6' />
        <div className='glass relative w-14 h-14 rounded-2xl flex items-center justify-center text-accent text-xl'><Icon /></div>
      </div>
      {title && <p className='text-[15px] font-semibold tracking-tight text-text'>{title}</p>}
      {hint && <p className='text-[12.5px] text-muted max-w-xs leading-relaxed'>{hint}</p>}
      {action && <div className='mt-3'>{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }) {
  return <Empty icon={FiAlertTriangle} title='Something went wrong' hint={error} className={className}
    action={onRetry && <Button size='sm' onClick={() => onRetry()}>Try again</Button>} />
}

// renders children only when connected to the Riot Client
export function RequireRiot({ children, hint }) {
  const riot = useRiot()
  if (riot.connected) return children
  return <Empty icon={FiLoader} title='Waiting for the Riot Client' hint={hint || 'Open the Riot Client (and VALORANT for live features). Spectre connects automatically.'} />
}

// dim layer under modals / the palette
export const Scrim = ({ onMouseDown, children, className }) => (
  <m.div className={cx('fixed inset-0 z-50 flex bg-[rgb(var(--scrim)/var(--scrim-a))]', className)} onMouseDown={onMouseDown}
    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18 }}>
    {children}
  </m.div>
)

export function Modal({ open, onClose, title, children, footer, width = 480 }) {
  const panel = React.useRef(null)
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  // keyboard focus moves into the dialog (unless a field inside already took it with autoFocus) and returns on close
  useEffect(() => {
    if (!open) return
    const prev = document.activeElement
    const id = requestAnimationFrame(() => { if (panel.current && !panel.current.contains(document.activeElement)) panel.current.focus({ preventScroll: true }) })
    return () => { cancelAnimationFrame(id); if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true }) }
  }, [open])
  return createPortal(
    <AnimatePresence>
      {open && (
        <Scrim key='modal' className='items-center justify-center' onMouseDown={onClose}>
          <m.div ref={panel} role='dialog' aria-modal='true' aria-label={typeof title === 'string' ? title : undefined} tabIndex={-1}
            className='glass-strong rounded-3xl max-h-[85vh] max-w-[calc(100vw-32px)] flex flex-col outline-none' style={{ width }} onMouseDown={e => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.96, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: 6 }} transition={SPRING}>
            <div className='flex items-center justify-between px-7 pt-6 pb-3'>
              <h3 className='display text-[22px] min-w-0'>{title}</h3>
              <button aria-label='Close' title='Close' className='w-8 h-8 -mr-2 shrink-0 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={onClose}><FiX /></button>
            </div>
            <div className='px-7 pb-6 overflow-y-auto'>{children}</div>
            {footer && <div className='px-7 py-4 border-t border-line flex justify-end gap-2'>{footer}</div>}
          </m.div>
        </Scrim>
      )}
    </AnimatePresence>, document.body)
}

// toasts: toast.success('Saved'), toast.error('Failed: ...'), toast
const listeners = new Set()
let nextId = 1
export function toast(message, tone = 'neutral') { listeners.forEach(l => l({ id: nextId++, message, tone })) }
toast.success = msg => toast(msg, 'good')
toast.error = msg => toast(msg, 'bad')

export function ToastHost() {
  const [items, setItems] = React.useState([])
  useEffect(() => {
    const add = t => {
      setItems(list => [...list, t])
      setTimeout(() => setItems(list => list.filter(x => x.id !== t.id)), t.tone === 'bad' ? 4500 : 2800)
    }
    listeners.add(add)
    return () => listeners.delete(add)
  }, [])
  return createPortal(
    <div role='status' aria-live='polite' className='fixed bottom-5 right-5 z-[60] flex flex-col gap-2 items-end pointer-events-none'>
      <AnimatePresence initial={false}>
        {items.map(t => (
          <m.div key={t.id} layout initial={{ opacity: 0, y: 14, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, x: 24, transition: { duration: 0.16 } }} transition={SPRING}
            className={cx('glass-strong pointer-events-auto flex items-center gap-2.5 max-w-sm rounded-[20px] px-4 py-2.5 text-[13px] font-medium leading-snug',
              t.tone === 'good' ? '!border-good/40' : t.tone === 'bad' ? '!border-bad/40' : '')}>
            <span className={cx('w-2 h-2 rounded-full shrink-0 shadow-[0_0_10px_currentColor]', t.tone === 'good' ? 'bg-good text-good' : t.tone === 'bad' ? 'bg-bad text-bad' : 'bg-accent text-accent')} />
            {t.message}
          </m.div>
        ))}
      </AnimatePresence>
    </div>, document.body)
}

// runs an async action with a toast for its outcome
export async function withToast(promise, success) {
  try { const r = await promise; if (success) toast.success(success); return r }
  catch (e) { toast.error(e.message); }
}
