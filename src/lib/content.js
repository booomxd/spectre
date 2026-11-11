import { useEffect, useState } from 'react'
import axios from 'axios'

// valorant-api.com content (agents, maps, weapons, competitivetiers, playercards...), cached per path
const cache = new Map()
export function getContent(path) {
  if (!cache.has(path)) {
    cache.set(path, axios.get('https://valorant-api.com/v1/' + path).then(r => r.data.data).catch(e => { cache.delete(path); throw e }))
  }
  return cache.get(path)
}

// A falsy path loads nothing (returns null)
export function useContent(path) {
  const [data, setData] = useState(null)
  useEffect(() => {
    if (!path) return
    let live = true
    getContent(path).then(d => live && setData(d)).catch(() => { })
    return () => { live = false }
  }, [path])
  return path ? data : null
}

// Riot uses the all-zero GUID for "none"
const NONE = '00000000-0000-0000-0000-000000000000'
export const contentPath = (kind, id) => (id && id !== NONE ? `${kind}/${id}` : null)

// latest competitive tier list: tier number -> { tierName, smallIcon, largeIcon, color }
export function useTiers() {
  const seasons = useContent('competitivetiers')
  if (!seasons) return null
  return Object.fromEntries(seasons[seasons.length - 1].tiers.map(t => [t.tier, t]))
}
