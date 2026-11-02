// Shared UI kit. Every page builds from these so spacing, color and motion stay consistent.
// Colors come from theme tokens (see tailwind.config.js): bg, surface, surface-2, line, text, muted, accent, good, bad, warn.
import React, { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle, FiInbox, FiLoader, FiX } from 'react-icons/fi'
import { useRiot } from '../lib/riot'

const cx = (...c) => c.filter(Boolean).join(' ')

// Page frame: header (title, subtitle, actions) + scrolling body.
export function Page({ title, subtitle, actions, children, className, bodyClassName }) {
  return (
    <div className={cx('h-full flex flex-col', className)}>
      {(title || actions) && (
        <header className='flex items-end justify-between gap-4 px-7 pt-6 pb-5'>
          <div className='min-w-0'>
            {title && <h1 className='font-display text-[30px] font-bold leading-none tracking-tight text-text'>{title}</h1>}
            {subtitle && <p className='mt-2 text-[13px] text-muted'>{subtitle}</p>}
          </div>
          {actions && <div className='flex items-center gap-2 shrink-0'>{actions}</div>}
        </header>
      )}
      <div className={cx('flex-1 overflow-y-auto px-7 pb-7', bodyClassName)}>{children}</div>
    </div>
  )
}

export function Card({ className, hover, children, as: Tag = 'div', ...rest }) {
  return <Tag className={cx('glass rounded-xl', hover && 'lift cursor-pointer', className)} {...rest}>{children}</Tag>
}

export function SectionTitle({ children, right, className }) {
  return (
    <div className={cx('flex items-center justify-between mb-3', className)}>
      <h2 className='text-[11px] font-semibold tracking-[0.16em] uppercase text-muted'>{children}</h2>
      {right}
    </div>
  )
}

const BTN = {
  primary: 'accent-fill text-bg hover:brightness-110',
  subtle: 'glass text-text hover:border-accent/40 hover:bg-surface-2',
  ghost: 'text-muted hover:text-text hover:bg-surface-2',
  danger: 'bg-bad/15 text-bad border border-bad/30 hover:bg-bad/25',
}
export function Button({ variant = 'subtle', size = 'md', loading, icon: Icon, className, children, disabled, ...rest }) {
  const sz = size === 'sm' ? 'h-8 px-3.5 text-xs' : size === 'lg' ? 'h-11 px-6 text-sm' : 'h-9 px-4 text-[13px]'
  return (
    <button disabled={disabled || loading}
      className={cx('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none', sz, BTN[variant], className)} {...rest}>
      {loading ? <FiLoader className='animate-spin' /> : Icon && <Icon />}
      {children}
    </button>
  )
}

const FIELD = 'glass-field w-full h-9 rounded-lg px-3 text-[13px] text-text placeholder:text-muted/60 outline-none transition-[border-color,box-shadow] duration-200'
export const Input = React.forwardRef(({ className, ...rest }, ref) => <input ref={ref} className={cx(FIELD, className)} {...rest} />)
export const Textarea = React.forwardRef(({ className, ...rest }, ref) => <textarea ref={ref} className={cx(FIELD, 'h-auto py-2 resize-none', className)} {...rest} />)
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
      <span className='text-[12px] font-semibold text-muted'>{children}</span>
      {hint && <p className='text-[11px] text-muted/70 mt-0.5'>{hint}</p>}
    </div>
  )
}

export function Toggle({ checked, onChange, label, hint, disabled }) {
  return (
    <label className={cx('flex items-center justify-between gap-4 cursor-pointer', disabled && 'opacity-50 pointer-events-none')}>
      {(label || hint) && <span><span className='block text-[13px] text-text'>{label}</span>{hint && <span className='block text-[11px] text-muted'>{hint}</span>}</span>}
      <button type='button' onClick={() => onChange(!checked)}
        className={cx('relative w-11 h-6 rounded-full transition-all duration-300 shrink-0', checked ? 'accent-fill' : 'glass-field')}>
        <span className={cx('absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-all duration-300', checked ? 'left-[23px]' : 'left-[3px]')} />
      </button>
    </label>
  )
}

// Segmented tabs with a sliding indicator.
export function Tabs({ tabs, value, onChange, className }) {
  const refs = useRef({})
  const [bar, setBar] = useState({ left: 0, width: 0 })
  useLayoutEffect(() => {
    const el = refs.current[value]
    if (el) setBar({ left: el.offsetLeft, width: el.offsetWidth })
  }, [value, tabs.length])
  return (
    <div className={cx('glass relative inline-flex p-1 rounded-full', className)}>
      <span className='accent-soft absolute top-1 bottom-1 rounded-full transition-all duration-300 ease-out' style={bar} />
      {tabs.map(t => {
        const v = t.value ?? t
        return (
          <button key={v} ref={el => (refs.current[v] = el)} onClick={() => onChange(v)}
            className={cx('relative z-10 h-7 px-3.5 rounded-full text-xs font-semibold transition-colors', value === v ? 'text-text' : 'text-muted hover:text-text')}>
            {t.label ?? t}
          </button>
        )
      })}
    </div>
  )
}

const TONES = {
  neutral: 'bg-surface-2 text-muted border-line',
  accent: 'bg-accent/15 text-accent border-accent/30',
  good: 'bg-good/15 text-good border-good/30',
  bad: 'bg-bad/15 text-bad border-bad/30',
  warn: 'bg-warn/15 text-warn border-warn/30',
}
export function Badge({ tone = 'neutral', className, children }) {
  return <span className={cx('inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[10px] font-semibold tracking-wide uppercase', TONES[tone], className)}>{children}</span>
}

export function Stat({ label, value, sub, className }) {
  return (
    <div className={className}>
      <div className='text-[11px] font-medium text-muted'>{label}</div>
      <div className='font-display text-2xl font-bold text-text leading-tight tabular-nums'>{value}</div>
      {sub && <div className='text-[11px] text-muted'>{sub}</div>}
    </div>
  )
}

export function Skeleton({ className, style }) { return <div className={cx('skeleton', className)} style={style} /> }

export function Spinner({ className }) { return <FiLoader className={cx('animate-spin text-muted', className)} /> }

export function Empty({ icon: Icon = FiInbox, title, hint, action, className }) {
  return (
    <div className={cx('anim-fade flex flex-col items-center justify-center text-center gap-2 py-14', className)}>
      <div className='accent-soft w-14 h-14 rounded-2xl flex items-center justify-center text-accent text-xl mb-1'><Icon /></div>
      {title && <p className='text-sm font-semibold text-text'>{title}</p>}
      {hint && <p className='text-xs text-muted max-w-xs'>{hint}</p>}
      {action && <div className='mt-2'>{action}</div>}
    </div>
  )
}

export function ErrorState({ error, onRetry, className }) {
  return <Empty icon={FiAlertTriangle} title='Something went wrong' hint={error} className={className}
    action={onRetry && <Button size='sm' onClick={() => onRetry()}>Try again</Button>} />
}

// Renders children only when connected to the Riot Client; otherwise a friendly placeholder.
export function RequireRiot({ children, hint }) {
  const riot = useRiot()
  if (riot.connected) return children
  return <Empty icon={FiLoader} title='Waiting for the Riot Client' hint={hint || 'Open the Riot Client (and VALORANT for live features). Spectre connects automatically.'} />
}

export function Modal({ open, onClose, title, children, footer, width = 480 }) {
  useEffect(() => {
    if (!open) return
    const onKey = e => e.key === 'Escape' && onClose?.()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  if (!open) return null
  return createPortal(
    <div className='anim-fade fixed inset-0 z-50 flex items-center justify-center bg-black/45 backdrop-blur-md' onMouseDown={onClose}>
      <div className='glass-strong anim-pop rounded-2xl max-h-[85vh] flex flex-col' style={{ width }} onMouseDown={e => e.stopPropagation()}>
        <div className='flex items-center justify-between px-6 pt-5 pb-3'>
          <h3 className='font-display text-xl font-bold tracking-tight'>{title}</h3>
          <button className='w-8 h-8 -mr-2 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={onClose}><FiX /></button>
        </div>
        <div className='px-6 pb-6 overflow-y-auto'>{children}</div>
        {footer && <div className='px-6 py-4 border-t border-line flex justify-end gap-2'>{footer}</div>}
      </div>
    </div>, document.body)
}

// Toasts: toast.success('Saved'), toast.error('Failed: ...'), toast('Info').
const listeners = new Set()
let nextId = 1
export function toast(message, tone = 'neutral') { listeners.forEach(l => l({ id: nextId++, message, tone })) }
toast.success = m => toast(m, 'good')
toast.error = m => toast(m, 'bad')

export function ToastHost() {
  const [items, setItems] = useState([])
  useEffect(() => {
    const add = t => {
      setItems(list => [...list, t])
      setTimeout(() => setItems(list => list.filter(x => x.id !== t.id)), t.tone === 'bad' ? 4500 : 2800)
    }
    listeners.add(add)
    return () => listeners.delete(add)
  }, [])
  return createPortal(
    <div className='fixed bottom-5 right-5 z-[60] flex flex-col gap-2 items-end'>
      {items.map(t => (
        <div key={t.id} className={cx('glass-strong anim-rise flex items-center gap-2.5 max-w-sm rounded-full px-4 py-2.5 text-[13px] font-medium',
          t.tone === 'good' ? '!border-good/40' : t.tone === 'bad' ? '!border-bad/40' : '')}>
          <span className={cx('w-2 h-2 rounded-full shadow-[0_0_10px_currentColor]', t.tone === 'good' ? 'bg-good text-good' : t.tone === 'bad' ? 'bg-bad text-bad' : 'bg-accent text-accent')} />
          {t.message}
        </div>
      ))}
    </div>, document.body)
}

// Runs an async action with a toast for its outcome. Returns the result (or undefined on error).
export async function withToast(promise, success) {
  try { const r = await promise; if (success) toast.success(success); return r }
  catch (e) { toast.error(e.message); }
}
