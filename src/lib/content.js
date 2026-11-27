import { createMemo, createSignal } from 'solid-js'
import axios from 'axios'

// valorant-api.com content (agents, maps, weapons, competitivetiers, playercards...), cached per path
const cache = new Map()
const values = new Map() // path -> resolved data, so a second page reading the same path renders on its first pass
export function getContent(path) {
  if (!cache.has(path)) {
    cache.set(path, axios.get('https://valorant-api.com/v1/' + path).then(r => { values.set(path, r.data.data); return r.data.data }).catch(e => { cache.delete(path); throw e }))
  }
  return cache.get(path)
}

// Accessor for a content path; `path` may itself be an accessor. A falsy path loads nothing (null)
export function useContent(path) {
  const p = typeof path === 'function' ? path : () => path
  const [tick, setTick] = createSignal(0)
  return createMemo(() => {
    tick()
    const k = p()
    if (!k) return null
    if (values.has(k)) return values.get(k)
    getContent(k).then(() => setTick(t => t + 1)).catch(() => { })
    return null
  })
}

// Riot uses the all-zero GUID for "none"
const NONE = '00000000-0000-0000-0000-000000000000'
export const contentPath = (kind, id) => (id && id !== NONE ? `${kind}/${id}` : null)

// latest competitive tier list: tier number -> { tierName, smallIcon, largeIcon, color } (accessor)
export function useTiers() {
  const seasons = useContent('competitivetiers')
  return createMemo(() => {
    const s = seasons()
    if (!s) return null
    return Object.fromEntries(s[s.length - 1].tiers.map(t => [t.tier, t]))
  })
}
