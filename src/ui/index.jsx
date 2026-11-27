// shared UI kit
import { For, Show, children as resolveChildren, createContext, createEffect, createSignal, createUniqueId, onCleanup, splitProps, useContext } from 'solid-js'
import { Dynamic, Portal } from 'solid-js/web'
import { FiAlertTriangle, FiInbox, FiLoader, FiX } from 'solid-icons/fi'
import { useRiot } from '../lib/riot'
import { Pill } from './motion'

export { MotionProvider, PageTransition, Pill, Stagger, Item, FadeIn, Swap, useReducedMotion } from './motion'
export { default as CommandPalette } from './CommandPalette'

export const cx = (...c) => c.filter(Boolean).join(' ')

// set by the shell: `section` is the dock section a page belongs to (shown as the eyebrow over the title)
export const PageContext = createContext({ section: null })

// accessor: true while the page a component lives in is the one on screen
export const PageActiveContext = createContext(() => true)
export const usePageActive = () => useContext(PageActiveContext)

// accessor: false while the window is minimized, hidden to the tray or otherwise not visible
const [docVisible, setDocVisible] = createSignal(typeof document === 'undefined' || document.visibilityState !== 'hidden')
if (typeof document !== 'undefined') document.addEventListener('visibilitychange', () => setDocVisible(document.visibilityState !== 'hidden'))
export const useDocumentVisible = () => docVisible

// accessor for the current time (ms) that ticks every `interval` ms while the page is on screen, aligned to the interval
export function useNow(interval = 1000) {
  const active = usePageActive()
  const [now, setNow] = createSignal(Date.now())
  createEffect(() => {
    if (!active() || !docVisible()) return
    let t = 0
    const tick = () => { const n = Date.now(); setNow(n); t = setTimeout(tick, interval - (n % interval) + 5) }
    tick()
    onCleanup(() => clearTimeout(t))
  })
  return now
}

// page frame: eyebrow + display title + subtitle + actions, then a scrolling body
export function Page(props) {
  const ctx = useContext(PageContext)
  const kicker = () => props.eyebrow ?? ctx.section
  // JSX props create a new node on every read: resolve once
  const actions = resolveChildren(() => props.actions)
  return (
    <div class={cx('h-full flex flex-col', props.class)}>
      <Show when={props.title || actions()}>
        <header class='flex items-end justify-between gap-6 px-8 pt-7 pb-6'>
          <div class='min-w-0'>
            <Show when={kicker() && props.title}><div class='eyebrow mb-2.5 flex items-center gap-2'><span class='w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_10px_rgb(var(--accent))]' />{kicker()}</div></Show>
            <Show when={props.title}><h1 class='display text-[38px] text-text'>{props.title}</h1></Show>
            <Show when={props.subtitle}><p class='mt-2.5 text-[13.5px] text-muted max-w-2xl'>{props.subtitle}</p></Show>
          </div>
          <Show when={actions()}><div class='flex items-center gap-2 shrink-0'>{actions()}</div></Show>
        </header>
      </Show>
      <div class={cx('flex-1 overflow-y-auto px-8 pb-8 scroll-body', props.bodyClass)}>{props.children}</div>
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
export function Card(props) {
  const [own, rest] = splitProps(props, ['class', 'hover', 'glow', 'blur', 'children', 'as', 'onClick'])
  const tag = () => own.as || 'div'
  const press = () => (typeof tag() === 'string' && tag() !== 'button' && tag() !== 'a' ? pressable(own.onClick) : { onClick: own.onClick })
  return (
    <Dynamic component={tag()} class={cx('glass rounded-2xl', own.hover && 'lift spot cursor-pointer', own.glow && 'accent-glow', own.blur && 'glass-blur', own.class)} {...press()} {...rest}>{own.children}</Dynamic>
  )
}

export function SectionTitle(props) {
  return (
    <div class={cx('flex items-center justify-between gap-3 mb-3.5', props.class)}>
      <h2 class='eyebrow'>{props.children}</h2>
      {props.right}
    </div>
  )
}

// section heading for bento tiles / larger groups: bold title + optional hint and right slot
export function Heading(props) {
  return (
    <div class={cx('flex items-end justify-between gap-3 mb-4', props.class)}>
      <div class='min-w-0'>
        <h3 class='font-display text-[17px] font-bold tracking-tight text-text'>{props.children}</h3>
        <Show when={props.hint}><p class='text-[12px] text-muted mt-1'>{props.hint}</p></Show>
      </div>
      {props.right}
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
export function Button(props) {
  const [own, rest] = splitProps(props, ['variant', 'size', 'loading', 'icon', 'class', 'children', 'disabled'])
  const sz = () => own.size === 'sm' ? 'h-8 px-3.5 text-xs' : own.size === 'lg' ? 'h-11 px-6 text-sm' : own.size === 'icon' ? 'h-9 w-9 text-[15px]' : 'h-9 px-4 text-[13px]'
  return (
    <button disabled={own.disabled || own.loading}
      class={cx('inline-flex items-center justify-center gap-2 rounded-full font-semibold transition-[transform,filter,background-color,border-color,color,box-shadow] duration-200 ease-out active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none',
        sz(), BTN[own.variant || 'subtle'] || BTN.subtle, own.class)} {...rest}>
      <Show when={own.loading} fallback={own.icon && <Dynamic component={own.icon} />}><FiLoader class='animate-spin' /></Show>
      {own.children}
    </button>
  )
}

const FIELD = 'glass-field w-full h-10 rounded-xl px-3.5 text-[13px] text-text placeholder:text-muted/60 outline-none transition-[border-color,box-shadow] duration-200'
export function Input(props) {
  const [own, rest] = splitProps(props, ['class'])
  return <input class={cx(FIELD, own.class)} {...rest} />
}
export function Textarea(props) {
  const [own, rest] = splitProps(props, ['class'])
  return <textarea class={cx(FIELD, 'h-auto py-2.5 resize-none', own.class)} {...rest} />
}
export function Select(props) {
  const [own, rest] = splitProps(props, ['class', 'options', 'value'])
  return (
    <select class={cx(FIELD, 'pr-8 cursor-pointer', own.class)} {...rest} value={own.value ?? ''}>
      <For each={own.options}>{o => <option value={o.value} selected={String(o.value) === String(own.value)} class='bg-panel text-text'>{o.label}</option>}</For>
    </select>
  )
}

export function Label(props) {
  return (
    <div class='mb-1.5'>
      <span class='text-[12.5px] font-semibold text-text/90'>{props.children}</span>
      <Show when={props.hint}><p class='text-[11.5px] text-muted mt-0.5'>{props.hint}</p></Show>
    </div>
  )
}

// switch
export function Toggle(props) {
  const label = resolveChildren(() => props.label)
  return (
    <label class={cx('flex items-center justify-between gap-4 cursor-pointer', props.disabled && 'opacity-50 pointer-events-none')}>
      <Show when={label() || props.hint}><span class='min-w-0'><span class='block text-[13px] font-medium text-text'>{label()}</span><Show when={props.hint}><span class='block text-[11.5px] text-muted mt-0.5'>{props.hint}</span></Show></span></Show>
      <button type='button' role='switch' aria-checked={!!props.checked} aria-label={typeof props.label === 'string' ? props.label : undefined} onClick={() => props.onChange(!props.checked)}
        class={cx('relative w-11 h-6 rounded-full transition-[background-color,box-shadow] duration-300 shrink-0', props.checked ? 'accent-fill' : 'glass-field')}>
        <span class={cx('absolute top-[3px] left-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-[0_2px_6px_rgb(0_0_0/0.35)] transition-transform duration-300 ease-spring', props.checked && 'translate-x-5')} />
      </button>
    </label>
  )
}

// segmented control with a pill under the active option. tabs: strings or { value, label, icon?, count? }. size: 'sm' | 'md' | 'lg'. variant: 'glass' (own container) | 'bare'
export function SegmentedTabs(props) {
  const h = () => props.size === 'sm' ? 'h-7 px-3 text-[12px]' : props.size === 'lg' ? 'h-9 px-4 text-[13px]' : 'h-8 px-3.5 text-[12.5px]'
  return (
    <div role='tablist' class={cx('relative inline-flex items-center gap-0.5', (props.variant || 'glass') === 'glass' && 'glass p-1 rounded-full', props.class)}>
      <For each={props.tabs}>{t => {
        const v = t?.value ?? t
        const on = () => props.value === v
        return (
          <button role='tab' aria-selected={on()} onClick={() => props.onChange(v)}
            class={cx('relative rounded-full font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors duration-150', h(), on() ? 'text-text' : 'text-muted hover:text-text')}>
            <Show when={on()}><Pill /></Show>
            <Show when={t?.icon}><Dynamic component={t.icon} class={cx('relative', on() && 'text-accent')} size={13} /></Show>
            <span class='relative'>{t?.label ?? t}</span>
            <Show when={t?.count != null}><span class='relative text-[10px] font-bold text-muted tabular-nums'>{t.count}</span></Show>
          </button>
        )
      }}</For>
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
export function Badge(props) {
  return <span class={cx('inline-flex items-center gap-1 h-5 px-2 shrink-0 whitespace-nowrap rounded-full border text-[10px] font-semibold tracking-wide uppercase', TONES[props.tone || 'neutral'] || TONES.neutral, props.class)}>{props.children}</span>
}

export function Stat(props) {
  return (
    <div class={props.class}>
      <div class='text-[11px] font-semibold text-muted'>{props.label}</div>
      <div class={cx('font-display font-bold text-text leading-tight tabular-nums mt-0.5', props.size === 'lg' ? 'text-[34px] tracking-tight' : 'text-2xl')}>{props.value}</div>
      <Show when={props.sub}><div class='text-[11px] text-muted mt-0.5'>{props.sub}</div></Show>
    </div>
  )
}

export function Skeleton(props) { return <div class={cx('skeleton', props.class)} style={props.style} /> }

export function Spinner(props) { return <FiLoader class={cx('animate-spin text-muted', props.class)} /> }

export function Empty(props) {
  const action = resolveChildren(() => props.action)
  return (
    <div class={cx('anim-fade flex flex-col items-center justify-center text-center gap-2 py-16', props.class)}>
      <div class='relative mb-2'>
        <span class='halo -inset-6' />
        <div class='glass relative w-14 h-14 rounded-2xl flex items-center justify-center text-accent text-xl'><Dynamic component={props.icon || FiInbox} /></div>
      </div>
      <Show when={props.title}><p class='text-[15px] font-semibold tracking-tight text-text'>{props.title}</p></Show>
      <Show when={props.hint}><p class='text-[12.5px] text-muted max-w-xs leading-relaxed'>{props.hint}</p></Show>
      <Show when={action()}><div class='mt-3'>{action()}</div></Show>
    </div>
  )
}

export function ErrorState(props) {
  return <Empty icon={FiAlertTriangle} title='Something went wrong' hint={props.error} class={props.class}
    action={props.onRetry && <Button size='sm' onClick={() => props.onRetry()}>Try again</Button>} />
}

// renders children only when connected to the Riot Client
export function RequireRiot(props) {
  const riot = useRiot()
  return (
    <Show when={riot().connected} fallback={<Empty icon={FiLoader} title='Waiting for the Riot Client' hint={props.hint || 'Open the Riot Client (and VALORANT for live features). Spectre connects automatically.'} />}>
      {props.children}
    </Show>
  )
}

// dim layer under modals / the palette
export function Scrim(props) {
  return (
    <div class={cx('anim-scrim fixed inset-0 z-50 flex bg-[rgb(var(--scrim)/var(--scrim-a))]', props.class)} onMouseDown={props.onMouseDown}>
      {props.children}
    </div>
  )
}

export function Modal(props) {
  return (
    <Show when={props.open}>
      <ModalBody {...props} />
    </Show>
  )
}
function ModalBody(props) {
  let panel
  const prev = document.activeElement
  const onKey = e => e.key === 'Escape' && props.onClose?.()
  window.addEventListener('keydown', onKey)
  // keyboard focus moves into the dialog (unless a field inside already took it with autofocus) and returns on close
  const id = requestAnimationFrame(() => { if (panel && !panel.contains(document.activeElement)) panel.focus({ preventScroll: true }) })
  onCleanup(() => {
    window.removeEventListener('keydown', onKey)
    cancelAnimationFrame(id)
    if (prev && prev.isConnected && prev.focus) prev.focus({ preventScroll: true })
  })
  const footer = resolveChildren(() => props.footer)
  return (
    <Portal>
      <Scrim class='items-center justify-center' onMouseDown={() => props.onClose?.()}>
        <div ref={panel} role='dialog' aria-modal='true' aria-label={typeof props.title === 'string' ? props.title : undefined} tabIndex={-1}
          class='anim-dialog glass-strong rounded-3xl max-h-[85vh] max-w-[calc(100vw-32px)] flex flex-col outline-none' style={{ width: `${props.width || 480}px` }} onMouseDown={e => e.stopPropagation()}>
          <div class='flex items-center justify-between px-7 pt-6 pb-3'>
            <h3 class='display text-[22px] min-w-0'>{props.title}</h3>
            <button aria-label='Close' title='Close' class='w-8 h-8 -mr-2 shrink-0 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => props.onClose?.()}><FiX /></button>
          </div>
          <div class='px-7 pb-6 overflow-y-auto'>{props.children}</div>
          <Show when={footer()}><div class='px-7 py-4 border-t border-line flex justify-end gap-2'>{footer()}</div></Show>
        </div>
      </Scrim>
    </Portal>
  )
}

// toasts: toast.success('Saved'), toast.error('Failed: ...'), toast
const [toasts, setToasts] = createSignal([])
let nextId = 1
export function toast(message, tone = 'neutral') {
  const t = { id: nextId++, message, tone }
  setToasts(list => [...list, t])
  setTimeout(() => setToasts(list => list.filter(x => x.id !== t.id)), tone === 'bad' ? 4500 : 2800)
}
toast.success = msg => toast(msg, 'good')
toast.error = msg => toast(msg, 'bad')

export function ToastHost() {
  return (
    <Portal>
      <div role='status' aria-live='polite' class='fixed bottom-5 right-5 z-[60] flex flex-col gap-2 items-end pointer-events-none'>
        <For each={toasts()}>{t => (
          <div class={cx('anim-toast glass-strong pointer-events-auto flex items-center gap-2.5 max-w-sm rounded-[20px] px-4 py-2.5 text-[13px] font-medium leading-snug',
            t.tone === 'good' ? '!border-good/40' : t.tone === 'bad' ? '!border-bad/40' : '')}>
            <span class={cx('w-2 h-2 rounded-full shrink-0 shadow-[0_0_10px_currentColor]', t.tone === 'good' ? 'bg-good text-good' : t.tone === 'bad' ? 'bg-bad text-bad' : 'bg-accent text-accent')} />
            {t.message}
          </div>
        )}</For>
      </div>
    </Portal>
  )
}

// runs an async action with a toast for its outcome
export async function withToast(promise, success) {
  try { const r = await promise; if (success) toast.success(success); return r }
  catch (e) { toast.error(e.message) }
}

export { createUniqueId, resolveChildren }
