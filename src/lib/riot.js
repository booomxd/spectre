import { createSignal } from 'solid-js'
import { invoke, listenEvent } from './ipc'

// Riot connection status, shared app-wide (one signal, no provider needed)
const [status, setStatus] = createSignal({ connected: false })
let started = false
function start() {
  if (started) return
  started = true
  invoke('riot:status').then(setStatus).catch(() => { })
  listenEvent('riot:status', setStatus)
}

// accessor: riot().connected, riot().gameName ...
export function useRiot() { start(); return status }
export const RiotProvider = props => { start(); return props.children }
