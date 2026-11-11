// motion helpers
// the app is wrapped once in <MotionProvider>
import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react'
import { AnimatePresence, LazyMotion, LayoutGroup, MotionConfig, MotionGlobalConfig, PresenceContext, domMax, m } from 'motion/react'
import { getReduceMotion, onReduceMotion, prefersReducedMotion } from '../lib/theme'

export { m, AnimatePresence, LayoutGroup }

export const EASE = [0.22, 1, 0.36, 1]
export const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }
export const SPRING_SOFT = { type: 'spring', stiffness: 320, damping: 32 }
const ReduceCtx = createContext(false)

// reduced motion is truly instant: motion's own reducedMotion option only drops transform animations and still plays opacity fades
MotionGlobalConfig.skipAnimations = prefersReducedMotion()

// true when motion should be minimal (setting or OS)
export function useReducedMotion() { return useContext(ReduceCtx) }

// pointer spotlight for `.spot` cards: one delegated, rAF-throttled listener sets --mx / --my on the hovered card
function useSpotlight(off) {
  useEffect(() => {
    if (off) return
    let frame = 0, ev = null
    const run = () => {
      frame = 0
      const el = ev?.target?.closest?.('.spot')
      if (!el) return
      const r = el.getBoundingClientRect()
      el.style.setProperty('--mx', `${ev.clientX - r.left}px`)
      el.style.setProperty('--my', `${ev.clientY - r.top}px`)
    }
    const onMove = e => { ev = e; if (!frame) frame = requestAnimationFrame(run) }
    document.addEventListener('pointermove', onMove, { passive: true })
    return () => { document.removeEventListener('pointermove', onMove); if (frame) cancelAnimationFrame(frame) }
  }, [off])
}

// OS prefers-reduced-motion, live
const QUERY = '(prefers-reduced-motion: reduce)'
const onOsChange = cb => {
  const mq = window.matchMedia?.(QUERY)
  mq?.addEventListener('change', cb)
  return () => mq?.removeEventListener('change', cb)
}
const useOsReducedMotion = () => useSyncExternalStore(onOsChange, () => !!window.matchMedia?.(QUERY).matches, () => false)

export function MotionProvider({ children }) {
  const [setting, setSetting] = useState(getReduceMotion)
  useEffect(() => onReduceMotion(setSetting), [])
  const os = useOsReducedMotion()
  const reduce = setting || os
  // assigned during render (idempotent) so it is in place before any child starts an animation in its effects
  MotionGlobalConfig.skipAnimations = reduce
  useSpotlight(reduce)
  return (
    <LazyMotion features={domMax} strict>
      {/* reducedMotion stays 'never': the skip flag above already makes every animation instant when reducing */}
      <MotionConfig reducedMotion='never' transition={{ duration: 0.22, ease: EASE }}>
        <ReduceCtx.Provider value={reduce}>{children}</ReduceCtx.Provider>
      </MotionConfig>
    </LazyMotion>
  )
}

// sliding selection pill (shared layoutId) under the active tab / row
export function Pill({ layoutId, className = 'accent-soft absolute inset-0 rounded-full', transition }) {
  const reduce = useReducedMotion()
  return (
    <PresenceContext.Provider value={null}>
      <m.span layoutId={layoutId} className={className} transition={reduce ? { duration: 0 } : transition || SPRING} />
    </PresenceContext.Provider>
  )
}

// page enter: fade + 8px rise when `active` turns true
const cx = (...c) => c.filter(Boolean).join(' ')
export function PageTransition({ active = true, className, children }) {
  // every page stays drawn
  return (
    <div className={cx(className, active && 'page-in')} inert={active ? undefined : ''} aria-hidden={active ? undefined : true}
      style={{ contentVisibility: active ? 'visible' : 'hidden', pointerEvents: active ? undefined : 'none', zIndex: active ? 1 : 0, contain: 'layout paint style' }}>
      {children}
    </div>
  )
}

// Staggered entrance. <Stagger className='grid ...'>{items.map((x, i) => <Item key={x.id} index={i}>...</Item>)}</Stagger>
// Only the first `limit` (12) items animate; later ones render in place, so long lists stay cheap.
const LIMIT = 12
const container = (step, delay) => ({ hidden: {}, show: { transition: { staggerChildren: step, delayChildren: delay } } })
const ITEM = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  show: { opacity: 1, y: 0, scale: 1, transition: { duration: 0.32, ease: EASE } },
}
export function Stagger({ as = 'div', step = 0.035, delay = 0, className, children, ...rest }) {
  const Tag = m[as]
  return <Tag className={className} variants={container(step, delay)} initial='hidden' animate='show' {...rest}>{children}</Tag>
}
export function Item({ as = 'div', index = 0, className, children, ...rest }) {
  const Tag = m[as]
  if (index >= LIMIT) return <Tag className={className} initial={false} {...rest}>{children}</Tag>
  return <Tag className={className} variants={ITEM} {...rest}>{children}</Tag>
}

// One-off entrance for a single block. delay is in seconds
export function FadeIn({ as = 'div', delay = 0, y = 8, className, children, ...rest }) {
  const Tag = m[as]
  return (
    <Tag className={className} initial={{ opacity: 0, y }} animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, ease: EASE, delay }} {...rest}>{children}</Tag>
  )
}

// Cross-fades between keyed children (e.g. switching sub-views). <Swap id={tab}>...</Swap>
export function Swap({ id, className, children }) {
  return (
    <AnimatePresence mode='wait' initial={false}>
      <m.div key={id} className={className} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -4 }}
        transition={{ duration: 0.18, ease: EASE }}>
        {children}
      </m.div>
    </AnimatePresence>
  )
}
