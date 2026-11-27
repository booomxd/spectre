// signal that remembers its value between launches
import { createSignal } from 'solid-js'

const read = (key, fallback, allowed) => {
  try {
    const raw = localStorage.getItem('spectre:' + key)
    if (raw == null) return fallback
    const v = JSON.parse(raw)
    return allowed && !allowed.includes(v) ? fallback : v
  } catch { return fallback }
}

export function useStored(key, fallback, allowed) {
  const [value, setValue] = createSignal(read(key, fallback, allowed))
  const set = v => {
    const next = typeof v === 'function' ? v(value()) : v
    setValue(() => next)
    try { localStorage.setItem('spectre:' + key, JSON.stringify(next)) } catch { /* storage unavailable */ }
  }
  return [value, set]
}

export const readStored = read
