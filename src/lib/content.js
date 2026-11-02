import { useEffect, useState } from 'react'
import axios from 'axios'

// valorant-api.com content (agents, maps, weapons, competitivetiers, playercards...), cached per path.
const cache = new Map()
export function getContent(path) {
  if (!cache.has(path)) {
    cache.set(path, axios.get('https://valorant-api.com/v1/' + path).then(r => r.data.data).catch(e => { cache.delete(path); throw e }))
  }
  return cache.get(path)
}

export function useContent(path) {
  const [data, setData] = useState(null)
  useEffect(() => { let live = true; getContent(path).then(d => live && setData(d)).catch(() => { }); return () => { live = false } }, [path])
  return data
}

// Latest competitive tier list: tier number -> { tierName, smallIcon, largeIcon, color }.
export function useTiers() {
  const seasons = useContent('competitivetiers')
  if (!seasons) return null
  return Object.fromEntries(seasons[seasons.length - 1].tiers.map(t => [t.tier, t]))
}
