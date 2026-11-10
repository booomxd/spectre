import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

// Demo mode (screenshots / UI work): Vite dev server + plain browser + `?demo` answers every channel from sample
// fixtures in ./demo. import.meta.env.DEV is false in builds, so the demo code is dropped from production bundles.
const DEMO = import.meta.env.DEV && typeof window !== 'undefined' && !window.__TAURI_INTERNALS__ && new URLSearchParams(window.location.search).has('demo')
const demo = DEMO ? import('./demo/index.js').then(m => { m.demoBoot(); return m }) : null

// Calls a backend channel (one Rust `ipc` command routes them all); resolves with its data or throws its error message.
export async function invoke(channel, ...args) {
  if (DEMO) return (await demo).invoke(channel, ...args)
  try {
    return await tauriInvoke('ipc', { channel, args })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : e?.message || 'Request failed')
  }
}

// Subscribe to a backend event for the component's lifetime.
export function useEvent(channel, fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    let off = null, gone = false
    if (DEMO) {
      demo.then(m => { if (!gone) off = m.listen(channel, p => ref.current(p)) })
      return () => { gone = true; off?.() }
    }
    listen(channel, e => ref.current(e.payload)).then(un => { if (gone) un(); else off = un })
    return () => { gone = true; off?.() }
  }, [channel])
}

// Loads data from a handler. Re-runs when deps change, or on an interval if `poll` (ms) is set.
// Pass `skip` to hold off (e.g. until connected).
function sameJson(a, b) { try { return JSON.stringify(a) === JSON.stringify(b) } catch { return false } }

export function useInvoke(channel, args = [], { deps = [], poll, skip } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip })
  const reload = useCallback(async (quiet) => {
    if (!quiet) setState(s => ({ ...s, loading: true }))
    try {
      const data = await invoke(channel, ...args)
      // Quiet polls that return the same payload keep the old state object, so the page does not re-render.
      setState(s => (quiet && !s.error && !s.loading && s.data != null && sameJson(s.data, data)) ? s : { data, error: null, loading: false })
    }
    catch (e) { setState(s => ({ ...s, error: e.message, loading: false })) }
  }, [channel, JSON.stringify(args)])

  useEffect(() => {
    if (skip) return
    reload()
    if (!poll) return
    // No refreshing while the window is hidden (in the tray or minimized); it catches up as soon as it is shown.
    const t = setInterval(() => { if (!document.hidden) reload(true) }, poll)
    const onShow = () => { if (!document.hidden) reload(true) }
    document.addEventListener('visibilitychange', onShow)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', onShow) }
  }, [reload, skip, poll, ...deps])

  return { ...state, reload }
}

export const openExternal = url => invoke('app:openExternal', url)

// The in-game overlay is its own window running the same bundle.
export function isOverlayWindow() {
  if (DEMO) return new URLSearchParams(window.location.search).has('overlay')
  try { return getCurrentWindow().label === 'overlay' } catch (e) { return window.location.hash === '#/overlay' }
}
