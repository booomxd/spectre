// Shared helpers for the weapon / loadout / presence tool pages.
import { useMemo } from 'react'
import { useContent } from '../../lib/content'
import { useInvoke } from '../../lib/ipc'

export const CATEGORIES = [
  { key: 'Sidearm', label: 'Sidearms' },
  { key: 'SMG', label: 'SMGs' },
  { key: 'Shotgun', label: 'Shotguns' },
  { key: 'Rifle', label: 'Rifles' },
  { key: 'Sniper', label: 'Snipers' },
  { key: 'Heavy', label: 'Heavy' },
  { key: 'Melee', label: 'Melee' },
]
export const NO_TITLE = '00000000-0000-0000-0000-000000000000'
export const lc = s => (s || '').toLowerCase()
export const catKey = w => (w.category || '').split('::').pop()
export const skinImage = s => s?.displayIcon || s?.levels?.[0]?.displayIcon || s?.chromas?.[0]?.fullRender || null
export const isStandard = (w, s) => lc(s.uuid) === lc(w.defaultSkinUuid)
// "EEquippableSkinLevelItem::VFX" -> "VFX", "FinisherAnimation" -> "Finisher Animation"
export const levelItemLabel = l => (l?.levelItem || '').split('::').pop().replace(/([a-z])([A-Z])/g, '$1 $2')

// Weapons with their real skins (no "Random Favorite" placeholder), in category order.
export function useWeapons() {
  const raw = useContent('weapons')
  return useMemo(() => {
    if (!raw) return null
    const order = k => CATEGORIES.findIndex(c => c.key === k)
    return raw.map(w => ({ ...w, skins: w.skins.filter(s => !/^random favorite/i.test(s.displayName)) }))
      .sort((a, b) => order(catKey(a)) - order(catKey(b)) || a.displayName.localeCompare(b.displayName))
  }, [raw])
}

// contenttiers by uuid: { displayName, displayIcon, highlightColor }
export function useContentTiers() {
  const raw = useContent('contenttiers')
  return useMemo(() => raw ? Object.fromEntries(raw.map(t => [lc(t.uuid), t])) : {}, [raw])
}
export const tierColor = t => t?.highlightColor ? '#' + t.highlightColor.slice(0, 6) : undefined

// Entitlements as lowercase sets (levels, chromas, cards, titles, sprays) + buddies [{id, instance}].
export function useOwned(skip) {
  const { data, error, loading, reload } = useInvoke('loadout:owned', [], { skip })
  const owned = useMemo(() => data && ({
    levels: new Set(data.levels.map(lc)), chromas: new Set(data.chromas.map(lc)),
    cards: new Set(data.cards.map(lc)), titles: new Set(data.titles.map(lc)), sprays: new Set(data.sprays.map(lc)),
    buddies: data.buddies,
  }), [data])
  return { owned, error, loading, reload }
}

export const skinOwned = (w, s, o) => isStandard(w, s) || !!(o && s.levels.some(l => o.levels.has(lc(l.uuid))))
export const levelOwned = (s, l, o) => l === s.levels[0] || !!(o && o.levels.has(lc(l.uuid)))
export const chromaOwned = (s, c, o) => c === s.chromas[0] || !!(o && o.chromas.has(lc(c.uuid)))

// Premier division id -> label
export function divisionLabel(d) {
  d = Number(d) || 0
  if (d === 0) return 'Unseeded'
  if (d === 21) return 'Contender'
  if (d === 22) return 'Invite'
  const names = ['Open', 'Intermediate', 'Advanced', 'Elite']
  return `${names[Math.floor((d - 1) / 5)] || 'Division'} ${((d - 1) % 5) + 1}`
}

export const QUEUES = [
  { value: 'unrated', label: 'Unrated' },
  { value: 'competitive', label: 'Competitive' },
  { value: 'swiftplay', label: 'Swiftplay' },
  { value: 'spikerush', label: 'Spike Rush' },
  { value: 'deathmatch', label: 'Deathmatch' },
  { value: 'hurm', label: 'Team Deathmatch' },
  { value: 'ggteam', label: 'Escalation' },
  { value: 'onefa', label: 'Replication' },
  { value: 'snowball', label: 'Snowball Fight' },
  { value: 'premier', label: 'Premier' },
  { value: 'newmap', label: 'New Map' },
  { value: '', label: 'Custom Game' },
]
export const GAME_STATES = [
  { value: 'MENUS', label: 'In Menus' },
  { value: 'QUEUE', label: 'In Queue' },
  { value: 'PREGAME', label: 'Agent Select' },
  { value: 'INGAME', label: 'In Game' },
  { value: 'RANGE', label: 'In The Range' },
]
