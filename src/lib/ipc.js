import { useCallback, useEffect, useRef, useState } from 'react'
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

// Calls a backend channel (one Rust `ipc` command routes them all); resolves with its data or throws its error message.
export async function invoke(channel, ...args) {
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
    listen(channel, e => ref.current(e.payload)).then(un => { if (gone) un(); else off = un })
    return () => { gone = true; off?.() }
  }, [channel])
}

// Loads data from a handler. Re-runs when deps change, or on an interval if `poll` (ms) is set.
// Pass `skip` to hold off (e.g. until connected).
export function useInvoke(channel, args = [], { deps = [], poll, skip } = {}) {
  const [state, setState] = useState({ data: null, error: null, loading: !skip })
  const reload = useCallback(async (quiet) => {
    if (!quiet) setState(s => ({ ...s, loading: true }))
    try { setState({ data: await invoke(channel, ...args), error: null, loading: false }) }
    catch (e) { setState(s => ({ ...s, error: e.message, loading: false })) }
  }, [channel, JSON.stringify(args)])

  useEffect(() => {
    if (skip) return
    reload()
    if (!poll) return
    const t = setInterval(() => reload(true), poll)
    return () => clearInterval(t)
  }, [reload, skip, poll, ...deps])

  return { ...state, reload }
}

export const openExternal = url => invoke('app:openExternal', url)

// The in-game overlay is its own window running the same bundle.
export function isOverlayWindow() {
  try { return getCurrentWindow().label === 'overlay' } catch (e) { return window.location.hash === '#/overlay' }
}
