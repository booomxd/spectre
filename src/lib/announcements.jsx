// In-app announcements
//
// docs/announcements.json entry:
//   { "id": "unique-id", "title": "Short title", "body": "Plain text, line breaks kept",
//     "level": "info" | "warn", "image": "https://...", "link": "https://...", "linkLabel": "Read more",
//     "from": "2026-11-12", "until": "2026-11-20", "minVersion": "3.0.0", "maxVersion": "3.9.9" }
// Only id and title are required. A new id shows an edited announcement again to everyone.
import { Show, createEffect, createMemo, createSignal, on, onCleanup } from 'solid-js'
import { Portal } from 'solid-js/web'
import { FiAlertTriangle, FiArrowUpRight, FiBell, FiX } from 'solid-icons/fi'
import { openExternal, useInvoke } from './ipc'
import { cx, useNow } from '../ui'

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
  const res = useInvoke('announce:list', [], { poll: 3 * 60 * 60 * 1000 })
  const [seen, setSeen] = createSignal(readSeen())
  // ticks every minute so an announcement appears when its window opens and leaves when it closes
  const nowA = useNow(60000)
  const list = createMemo(() => pending(res.data?.items, res.data?.version, seen(), nowA()))
  const a = () => list()[0]
  let panel

  const close = () => {
    if (!a()) return
    const next = [...seen(), a().id].slice(-200)
    setSeen(next)
    try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }
  const open = () => { const l = https(a()?.link); if (l) openExternal(l); close() }

  // Escape closes; focus moves into the popup so keyboard users land on it
  createEffect(on(() => a()?.id, id => {
    if (!id) return
    const onKey = e => { if (e.key === 'Escape') close() }
    window.addEventListener('keydown', onKey)
    const f = requestAnimationFrame(() => panel?.focus({ preventScroll: true }))
    onCleanup(() => { window.removeEventListener('keydown', onKey); cancelAnimationFrame(f) })
  }))

  const warn = () => a()?.level === 'warn'
  const link = () => https(a()?.link), image = () => https(a()?.image)

  return (
    <Show when={a()}>
      <Portal>
        <div class='anim-scrim fixed inset-0 z-[90] grid place-items-center p-6 bg-black/60 backdrop-blur-[6px]'>
          <div ref={panel} role='dialog' aria-modal='true' aria-labelledby='announce-title' tabIndex={-1}
            class={cx('anim-dialog announce-card glass-strong relative w-[560px] max-w-full max-h-[85vh] overflow-y-auto rounded-[30px] outline-none', warn() && 'is-warn')}>
            <button type='button' onClick={close} aria-label='Close announcement' title='Close'
              class='absolute right-4 top-4 z-10 w-9 h-9 rounded-full grid place-items-center text-muted hover:text-text bg-black/25 hover:bg-surface-2 transition-colors'><FiX size={17} /></button>

            <Show when={image()}><img decoding='async' src={image()} alt='' class='w-full max-h-[230px] object-cover rounded-t-[30px]' /></Show>

            <div class='px-8 pb-7 pt-8'>
              <div class='flex items-center gap-3 mb-5'>
                <span class={cx('announce-icon relative w-12 h-12 rounded-2xl grid place-items-center shrink-0', warn() ? 'bg-warn/15 text-warn' : 'accent-soft text-accent')}>
                  <Show when={warn()} fallback={<FiBell size={22} />}><FiAlertTriangle size={22} /></Show>
                </span>
                <div>
                  <div class={cx('eyebrow', warn() ? '!text-warn' : '!text-accent')}>{warn() ? 'Important' : 'Announcement'}</div>
                  <Show when={list().length > 1}><div class='text-[11.5px] text-muted mt-0.5 tabular-nums'>1 of {list().length}</div></Show>
                </div>
              </div>

              <h2 id='announce-title' class='display text-[30px] leading-[1.1] text-text pr-6' translate='no'>{a().title}</h2>
              <Show when={a().body}><p class='mt-3 text-[14.5px] leading-relaxed text-muted whitespace-pre-line' translate='no'>{a().body}</p></Show>

              <div class='mt-7 flex flex-wrap items-center justify-end gap-2.5'>
                <button type='button' onClick={close}
                  class='h-11 px-5 rounded-2xl text-[13.5px] font-semibold text-muted hover:text-text hover:bg-surface-2 transition-colors'>
                  {list().length > 1 ? 'Next' : 'Got it'}
                </button>
                <Show when={link()}>
                  <button type='button' onClick={open}
                    class={cx('h-11 px-5 rounded-2xl text-[13.5px] font-semibold inline-flex items-center gap-2 text-bg transition active:scale-[0.97] hover:brightness-110', warn() ? 'bg-warn' : 'accent-fill')}>
                    <span translate='no'>{a().linkLabel || 'Open'}</span><FiArrowUpRight size={15} />
                  </button>
                </Show>
              </div>
            </div>
          </div>
        </div>
      </Portal>
    </Show>
  )
}
