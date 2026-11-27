import { createEffect, createSignal, on, onCleanup, untrack } from 'solid-js'
import { createStore, reconcile } from 'solid-js/store'
import { invoke as tauriInvoke } from '@tauri-apps/api/core'
import { listen } from '@tauri-apps/api/event'
import { getCurrentWindow } from '@tauri-apps/api/window'

// demo mode (screenshots / UI work): Vite dev server + plain browser + `?demo` answers every channel from sample fixtures in ./demo. import.meta.env.DEV is false in builds
const DEMO = import.meta.env.DEV && typeof window !== 'undefined' && !window.__TAURI_INTERNALS__ && new URLSearchParams(window.location.search).has('demo')
const demo = DEMO ? import('./demo/index.js').then(m => { m.demoBoot(); return m }) : null

// calls a backend channel
export async function invoke(channel, ...args) {
  if (DEMO) return (await demo).invoke(channel, ...args)
  try {
    return await tauriInvoke('ipc', { channel, args })
  } catch (e) {
    throw new Error(typeof e === 'string' ? e : e?.message || 'Request failed')
  }
}

// subscribe to a backend event; returns an unsubscribe function
export function listenEvent(channel, fn) {
  let off = null, gone = false
  if (DEMO) demo.then(m => { if (!gone) off = m.listen(channel, fn) })
  else listen(channel, e => fn(e.payload)).then(un => { if (gone) un(); else off = un })
  return () => { gone = true; off?.() }
}

// subscribe to a backend event for the owner's lifetime
export function useEvent(channel, fn) {
  onCleanup(listenEvent(channel, p => fn(p)))
}

const val = v => (typeof v === 'function' ? v() : v)
const json = v => { try { return JSON.stringify(v) } catch { return null } }

// Loads data from a handler. `args`, `poll` and `skip` may be accessors, so the call reloads when they change.
// The result is a reactive object: res.data / res.error / res.loading, plus res.reload(quiet?).
// Data is reconciled into a store (array items matched by `opts.key`, default 'id'), so a poll that changes one field only updates the DOM that reads that field.
export function useInvoke(channel, args = [], opts = {}) {
  const [state, setState] = createStore({ data: null, error: null, loading: !val(opts.skip) })
  let loadedFor = null, seq = 0, inflight = 0
  const key = () => json([channel, val(args), val(opts.deps)])
  const reload = async (quiet, forKey, background) => {
    // a background refresh (poll, refocus) never supersedes a request that is still running, so a handler
    // slower than the poll interval still lands; request changes (forKey) and explicit reloads always win
    if (background && inflight) return
    const a = untrack(() => val(args)) || []
    const mine = ++seq
    inflight = mine
    if (!quiet) setState('loading', true)
    try {
      const data = await invoke(channel, ...a)
      if (inflight === mine) inflight = 0
      if (mine !== seq) return
      if (forKey !== undefined) loadedFor = forKey
      setState('data', reconcile(data ?? null, { merge: true, key: opts.key || 'id' }))
      setState({ error: null, loading: false })
    } catch (e) {
      if (inflight === mine) inflight = 0
      if (mine !== seq) return
      if (forKey !== undefined) loadedFor = forKey
      setState({ error: e.message, loading: false })
    }
  }
  // fetch when the request (or skip) changes
  createEffect(on([key, () => val(opts.skip)], ([k, skip]) => {
    if (!skip) reload(k !== null && loadedFor === k, k)
  }))
  // polling: starts/stops with `poll`; resuming (e.g. the page becomes active again) refreshes quietly, pausing never fetches
  createEffect(on([() => val(opts.poll), () => val(opts.skip)], ([poll, skip], prev) => {
    if (skip || !poll) return
    if (prev && !prev[0] && !prev[1]) reload(true, undefined, true)
    // no refreshing while the window is hidden
    const t = setInterval(() => { if (!document.hidden) reload(true, undefined, true) }, poll)
    const onShow = () => { if (!document.hidden) reload(true, undefined, true) }
    document.addEventListener('visibilitychange', onShow)
    onCleanup(() => { clearInterval(t); document.removeEventListener('visibilitychange', onShow) })
  }))
  return {
    get data() { return state.data },
    get error() { return state.error },
    get loading() { return state.loading },
    reload: q => reload(q),
    mutate: fn => setState('data', d => fn(d)),
  }
}

export const openExternal = url => invoke('app:openExternal', url)

// the in-game overlay is its own window running the same bundle
export function isOverlayWindow() {
  if (DEMO) return new URLSearchParams(window.location.search).has('overlay')
  try { return getCurrentWindow().label === 'overlay' } catch (e) { return window.location.hash === '#/overlay' }
}

export { createSignal }
