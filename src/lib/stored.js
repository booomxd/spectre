// useState that remembers its value between launches (localStorage). For small view choices such as a filter or the
// selected tab; `allowed` (optional) rejects a saved value that no longer exists.
import { useCallback, useState } from 'react'

const read = (key, fallback, allowed) => {
  try {
    const raw = localStorage.getItem('spectre:' + key)
    if (raw == null) return fallback
    const v = JSON.parse(raw)
    return allowed && !allowed.includes(v) ? fallback : v
  } catch { return fallback }
}

export function useStored(key, fallback, allowed) {
  const [value, setValue] = useState(() => read(key, fallback, allowed))
  const set = useCallback(v => {
    setValue(v)
    try { localStorage.setItem('spectre:' + key, JSON.stringify(v)) } catch { /* storage unavailable */ }
  }, [key])
  return [value, set]
}

export const readStored = read
