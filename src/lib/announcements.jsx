// In-app announcements
//
// docs/announcements.json entry:
//   { "id": "unique-id", "title": "Short title", "body": "Plain text, line breaks kept",
//     "level": "info" | "warn", "image": "https://...", "link": "https://...", "linkLabel": "Read more",
//     "from": "2026-11-12", "until": "2026-11-20", "minVersion": "3.0.0", "maxVersion": "3.9.9" }
// Only id and title are required. A new id shows an edited announcement again to everyone.
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiAlertTriangle, FiArrowUpRight, FiBell, FiX } from 'react-icons/fi'
import { openExternal, useInvoke } from './ipc'
import { AnimatePresence, cx, m } from '../ui'

const KEY = 'spectre:announce-seen'
const readSeen = () => { try { return JSON.parse(localStorage.getItem(KEY)) || [] } catch { return [] } }

// "4.0.0" vs "3.9.1": -1, 0 or 1
const cmp = (a, b) => {
  const p = s => String(s).split('.').map(x => parseInt(x, 10) || 0)
  const [x, y] = [p(a), p(b)]
  for (let i = 0; i < 3; i++) if ((x[i] || 0) !== (y[i] || 0)) return (x[i] || 0) > (y[i] || 0) ? 1 : -1
  return 0
}
const time = (v, end) => {
  if (v == null || v === '') return null
  const t = typeof v === 'number' ? v : Date.parse(v)
  if (Number.isNaN(t)) return null
  // A bare date ("2026-11-20") as "until" lasts through that whole day
  return end && typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? t + 864e5 - 1 : t
}
const https = u => (typeof u === 'string' && /^https:\/\//i.test(u) ? u : null)

export function pending(items, version, seen, now = Date.now()) {
  return (items || []).filter(a => {
    if (seen.includes(a.id)) return false
    const from = time(a.from), until = time(a.until, true)
    if (from != null && now < from) return false
    if (until != null && now > until) return false
    if (a.minVersion && version && cmp(version, a.minVersion) < 0) return false
    if (a.maxVersion && version && cmp(version, a.maxVersion) > 0) return false
    return true
  })
}

export default function Announcements() {
  const { data } = useInvoke('announce:list', [], { poll: 3 * 60 * 60 * 1000 })
  const [seen, setSeen] = useState(readSeen)
  const list = pending(data?.items, data?.version, seen)
  const a = list[0]
  const panel = useRef(null)

  const close = () => {
    if (!a) return
    const next = [...seen, a.id].slice(-200)
    setSeen(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }
  const open = () => { const l = https(a?.link); if (l) openExternal(l); close() }

  // Escape closes; focus moves into the popup so keyboard users land on it
  useEffect(() => {
    if (!a) return
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const id = requestAnimationFrame(() => panel.current?.focus({ preventScroll: true }))
    return () => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(id) }
  }, [a?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  const warn = a?.level === 'warn'
  const Icon = warn ? FiAlertTriangle : FiBell
  const link = https(a?.link), image = https(a?.image)

  return createPortal(
    <AnimatePresence>
      {a && (
        <m.div key='announce' className='fixed inset-0 z-[90] grid place-items-center p-6 bg-black/60 backdrop-blur-[6px]'
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.25 }}>
          <m.div key={a.id} ref={panel} role='dialog' aria-modal='true' aria-labelledby='announce-title' tabIndex={-1}
            className={cx('announce-card glass-strong relative w-[560px] max-w-full max-h-[85vh] overflow-y-auto rounded-[30px] outline-none', warn && 'is-warn')}
            initial={{ opacity: 0, scale: 0.88, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: 'spring', stiffness: 320, damping: 24, mass: 0.9 }}>
            <button type='button' onClick={close} aria-label='Close announcement' title='Close'
              className='absolute right-4 top-4 z-10 w-9 h-9 rounded-full grid place-items-center text-muted hover:text-text bg-black/25 hover:bg-surface-2 transition-colors'><FiX size={17} /></button>

            {image && <img decoding='async' src={image} alt='' className='w-full max-h-[230px] object-cover rounded-t-[30px]' />}

            <div className='px-8 pb-7 pt-8'>
              <div className='flex items-center gap-3 mb-5'>
                <span className={cx('announce-icon relative w-12 h-12 rounded-2xl grid place-items-center shrink-0', warn ? 'bg-warn/15 text-warn' : 'accent-soft text-accent')}>
                  <Icon size={22} />
                </span>
                <div>
                  <div className={cx('eyebrow', warn ? '!text-warn' : '!text-accent')}>{warn ? 'Important' : 'Announcement'}</div>
                  {list.length > 1 && <div className='text-[11.5px] text-muted mt-0.5 tabular-nums'>1 of {list.length}</div>}
                </div>
              </div>

              <h2 id='announce-title' className='display text-[30px] leading-[1.1] text-text pr-6' translate='no'>{a.title}</h2>
              {a.body && <p className='mt-3 text-[14.5px] leading-relaxed text-muted whitespace-pre-line' translate='no'>{a.body}</p>}

              <div className='mt-7 flex flex-wrap items-center justify-end gap-2.5'>
                <button type='button' onClick={close}
                  className='h-11 px-5 rounded-2xl text-[13.5px] font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors'>
                  {list.length > 1 ? 'Next' : 'Got it'}
                </button>
                {link && (
                  <button type='button' onClick={open}
                    className={cx('h-11 px-5 rounded-2xl text-[13.5px] font-semibold inline-flex items-center gap-2 text-bg transition active:scale-[0.97] hover:brightness-110', warn ? 'bg-warn' : 'accent-fill')}>
                    <span translate='no'>{a.linkLabel || 'Open'}</span><FiArrowUpRight size={15} />
                  </button>
                )}
              </div>
            </div>
          </m.div>
        </m.div>
      )}
    </AnimatePresence>, document.body)
}
