// motion helpers. Pages and lists appear instantly; only feedback motion (pills, presses, dialogs) animates, in CSS.
import { Show, createSignal, onCleanup, splitProps } from 'solid-js'
import { Dynamic } from 'solid-js/web'
import { getReduceMotion, onReduceMotion, prefersReducedMotion } from '../lib/theme'

const cx = (...c) => c.filter(Boolean).join(' ')

// true when motion should be minimal (setting or OS). Accessor
const [reduce, setReduce] = createSignal(prefersReducedMotion())
if (typeof window !== 'undefined') {
  onReduceMotion(() => setReduce(prefersReducedMotion()))
  window.matchMedia?.('(prefers-reduced-motion: reduce)').addEventListener?.('change', () => setReduce(prefersReducedMotion()))
}
export const useReducedMotion = () => reduce
export { getReduceMotion }

// pointer spotlight for `.spot` cards: one delegated, rAF-throttled listener sets --mx / --my on the hovered card
let spotOn = false
function startSpotlight() {
  if (spotOn || typeof document === 'undefined') return
  spotOn = true
  let frame = 0, ev = null, last = null
  const run = () => {
    frame = 0
    if (reduce()) return
    const el = ev?.target?.closest?.('.spot')
    if (!el) return
    const r = el.getBoundingClientRect()
    el.style.setProperty('--mx', `${ev.clientX - r.left}px`)
    el.style.setProperty('--my', `${ev.clientY - r.top}px`)
    last = el
  }
  document.addEventListener('pointermove', e => { ev = e; if (!frame) frame = requestAnimationFrame(run) }, { passive: true })
  void last
}

export function MotionProvider(props) { startSpotlight(); return props.children }

// selected-option background (was a shared-layout spring; now a plain pill so selection changes are instant)
export function Pill(props) {
  return <span class={props.class || 'accent-soft absolute inset-0 rounded-full'} />
}

// page container: every visited page stays mounted; hidden ones skip layout and paint
export function PageTransition(props) {
  return (
    <div class={props.class} inert={props.active ? undefined : true} aria-hidden={props.active ? undefined : 'true'}
      style={{ 'content-visibility': props.active ? 'visible' : 'hidden', 'pointer-events': props.active ? undefined : 'none', 'z-index': props.active ? 1 : 0, contain: 'layout paint style', visibility: props.active ? 'visible' : 'hidden' }}>
      {props.children}
    </div>
  )
}

// layout wrappers kept from the old animated API: they render in place
function Plain(props) {
  const [own, rest] = splitProps(props, ['as', 'step', 'delay', 'index', 'y', 'children'])
  return <Dynamic component={own.as || 'div'} {...rest}>{own.children}</Dynamic>
}
export const Stagger = Plain
export const Item = Plain
export const FadeIn = Plain

// switches between keyed sub-views
// Remounts its content when `id` changes (the React version keyed it by id), so per-view state
// such as a half-typed form never carries over to the next section or tab.
export function Swap(props) {
  const k = () => `#${props.id ?? ''}`
  return <Show when={k()} keyed>{_id => <div class={props.class}>{props.children}</div>}</Show>
}

export { cx }
