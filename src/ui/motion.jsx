// Motion helpers. Everything animates transform / opacity only, and everything respects reduced motion
// (the OS setting and Settings > Appearance > Reduce motion).
//
// The app is wrapped once in <MotionProvider>. Use the `m.*` components (never `motion.*`: LazyMotion is strict).
// Shared-layout (layoutId) indicators need the domMax feature set, so the provider loads domMax instead of domAnimation.
import { createContext, useContext, useEffect, useState } from 'react'
import { AnimatePresence, LazyMotion, LayoutGroup, MotionConfig, domMax, m, useReducedMotion as useOsReducedMotion } from 'motion/react'
import { getReduceMotion, onReduceMotion } from '../lib/theme'

export { m, AnimatePresence, LayoutGroup }

export const EASE = [0.22, 1, 0.36, 1]
export const SPRING = { type: 'spring', stiffness: 520, damping: 40, mass: 0.9 }
export const SPRING_SOFT = { type: 'spring', stiffness: 320, damping: 32 }
const ReduceCtx = createContext(false)

// True when motion should be minimal (setting or OS).
export function useReducedMotion() { return useContext(ReduceCtx) }

// Pointer spotlight for `.spot` cards: one delegated, rAF-throttled listener sets --mx / --my on the hovered card.
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

export function MotionProvider({ children }) {
  const [setting, setSetting] = useState(getReduceMotion)
  useEffect(() => onReduceMotion(setSetting), [])
  const os = useOsReducedMotion()
  const reduce = setting || !!os
  useSpotlight(reduce)
  return (
    <LazyMotion features={domMax} strict>
      <MotionConfig reducedMotion={reduce ? 'always' : 'never'} transition={{ duration: 0.22, ease: EASE }}>
        <ReduceCtx.Provider value={reduce}>{children}</ReduceCtx.Provider>
      </MotionConfig>
    </LazyMotion>
  )
}

// Page enter: fade + 8px rise when `active` turns true. Kept-alive pages stay mounted, so this animates on every visit
// without remounting the page (state survives). Inactive pages are display:none.
export function PageTransition({ active = true, className, children }) {
  const reduce = useReducedMotion()
  return (
    <m.div className={className} style={{ display: active ? undefined : 'none' }}
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={active ? { opacity: 1, y: 0 } : { opacity: 0, y: reduce ? 0 : 8 }}
      transition={active ? { duration: reduce ? 0.12 : 0.22, ease: EASE } : { duration: 0 }}>
      {children}
    </m.div>
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

// One-off entrance for a single block. delay is in seconds.
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
