import { useEffect, useState } from 'react'
import { getContent } from '../../lib/content'
import { skinImage } from '../tools/gear'

// Item type ids used by the store.
export const TYPE = {
  skin: 'e7c63390-eda7-46e0-bb7a-a6abdacd2433',
  buddy: 'dd3bf334-87f3-40bd-b043-682a57a8dc3a',
  spray: 'd5f120f8-ff8c-4aac-92ea-f2b5acbe9475',
  card: '3f296c07-64c3-494c-923b-fe692a4fa1bd',
  title: 'de7caa6b-adf7-4588-bbd1-143831e786c6',
}
export const CUR = { vp: '85ad13f7-3d1b-5128-9eb2-7cd8ee0b5741', rad: 'e59aa87c-4cbf-517a-5983-6e81511be9b7', kc: '85ca954a-41f2-ce94-9b45-8ca3dd39a00d' }

let promise
// Loads everything needed to resolve item ids into { name, icon, kind, tier, skin } once.
function load() {
  if (!promise) {
    const get = p => getContent(p).catch(() => [])
    promise = Promise.all(['weapons/skins', 'buddies/levels', 'sprays', 'playercards', 'playertitles', 'contenttiers', 'bundles', 'currencies', 'agents?isPlayableCharacter=true'].map(get)).then(
      ([skins, buddies, sprays, cards, titles, tiers, bundles, currencies, agents]) => {
        const items = new Map()
        const tierMap = Object.fromEntries(tiers.map(t => [t.uuid, t]))
        for (const s of skins) {
          const tier = tierMap[s.contentTierUuid]
          const icon = skinImage(s)
          const base = { name: s.displayName, icon, kind: 'skin', tier, skin: s }
          items.set(s.uuid, base)
          for (const l of s.levels || []) items.set(l.uuid, base)
          for (const c of s.chromas || []) items.set(c.uuid, { ...base, name: c.displayName, icon: c.fullRender || c.displayIcon || icon })
        }
        for (const b of buddies) items.set(b.uuid, { name: b.displayName, icon: b.displayIcon, kind: 'buddy' })
        for (const s of sprays) items.set(s.uuid, { name: s.displayName, icon: s.fullTransparentIcon || s.displayIcon, kind: 'spray' })
        for (const c of cards) items.set(c.uuid, { name: c.displayName, icon: c.displayIcon, wide: c.wideArt, large: c.largeArt, kind: 'card' })
        for (const t of titles) items.set(t.uuid, { name: t.titleText || t.displayName, kind: 'title' })
        for (const c of currencies) items.set(c.uuid, { name: c.displayName, icon: c.displayIcon, kind: 'currency' })
        for (const a of agents) items.set(a.uuid, { name: a.displayName, icon: a.displayIcon, kind: 'agent', agent: a })
        return { items, bundles: Object.fromEntries(bundles.map(b => [b.uuid, b])), tiers: tierMap, agents }
      })
  }
  return promise
}

export function useCatalog() {
  const [cat, setCat] = useState(null)
  useEffect(() => { let live = true; load().then(c => live && setCat(c)); return () => { live = false } }, [])
  return cat
}

// Picks the active season battle pass from the contracts list.
export const pickPass = contracts => (contracts || []).filter(c => c.type === 'Season').sort((a, b) => b.progressionLevel - a.progressionLevel)[0] || null

// Maps battle pass reward types to catalog ids.
export const rewardItem = (cat, r) => (r && cat?.items.get(r.uuid)) || null

export const fmt = n => (n ?? 0).toLocaleString()

export function fmtDuration(s) {
  s = Math.max(0, Math.floor(s))
  const d = Math.floor(s / 86400), h = Math.floor(s % 86400 / 3600), m = Math.floor(s % 3600 / 60), sec = s % 60
  if (d > 0) return `${d}d ${h}h ${m}m`
  if (h > 0) return `${h}h ${String(m).padStart(2, '0')}m ${String(sec).padStart(2, '0')}s`
  return `${m}m ${String(sec).padStart(2, '0')}s`
}

// Live countdown from a "seconds left" snapshot taken when it loaded.
export function useCountdown(secondsLeft) {
  const [t0] = useState(() => Date.now())
  const [, tick] = useState(0)
  useEffect(() => { const i = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(i) }, [])
  if (secondsLeft == null) return null
  return Math.max(0, secondsLeft - (Date.now() - t0) / 1000)
}
