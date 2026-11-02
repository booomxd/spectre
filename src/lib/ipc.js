import { useCallback, useEffect, useRef, useState } from 'react'

const { ipcRenderer } = window.require('electron')

// Calls a main-process handler; resolves with its data or throws its error message.
export async function invoke(channel, ...args) {
  const res = await ipcRenderer.invoke(channel, ...args)
  if (!res?.ok) throw new Error(res?.error || 'Request failed')
  return res.data
}

// Subscribe to a main-process event for the component's lifetime.
export function useEvent(channel, fn) {
  const ref = useRef(fn)
  ref.current = fn
  useEffect(() => {
    const listener = (e, payload) => ref.current(payload)
    ipcRenderer.on(channel, listener)
    return () => ipcRenderer.removeListener(channel, listener)
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
