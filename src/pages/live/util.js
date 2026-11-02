import { useEffect, useState } from 'react'
import { invoke } from '../../lib/ipc'
import { useContent } from '../../lib/content'

export const QUEUES = {
  competitive: 'Competitive', unrated: 'Unrated', swiftplay: 'Swiftplay', spikerush: 'Spike Rush', deathmatch: 'Deathmatch',
  ggteam: 'Escalation', onefa: 'Replication', hurm: 'Team Deathmatch', snowball: 'Snowball Fight', skirmish2v2: 'Skirmish 2v2',
  abilitydraftarena: 'Ability Draft', 'premier-seasonmatch': 'Premier', newmap: 'New Map', '': 'Custom Game',
}
export const queueName = id => QUEUES[id ?? ''] ?? (id ? id[0].toUpperCase() + id.slice(1) : 'Custom Game')

// Queue id -> valorant-api game mode, matched by the mode's asset folder (e.g. ".../GameModes/QuickBomb/...").
const MODE_ASSET = {
  competitive: 'Bomb', unrated: 'Bomb', newmap: 'Bomb', 'premier-seasonmatch': 'Bomb', '': 'Bomb', swiftplay: 'Swiftplay_EndOfRoundCredits',
  spikerush: 'QuickBomb', deathmatch: 'Deathmatch', ggteam: 'GunGame', onefa: 'OneForAll', hurm: 'HURM', snowball: 'SnowballFight',
  skirmish2v2: 'Skirmish', abilitydraftarena: 'AbilityDraftArena',
}
export function useModeIcon(queue) {
  const modes = useContent('gamemodes')
  const folder = MODE_ASSET[queue ?? '']
  return (folder && modes?.find(m => m.assetPath?.split('/').slice(-2, -1)[0] === folder)?.displayIcon) || null
}

// Sheriff kill-feed silhouette, used as the weapons icon.
export const GUN_ICON = 'https://media.valorant-api.com/weapons/e336c6b8-418d-9340-d77f-7a9e4cfe0702/killstreamicon.png'

export const cardIcon = id => id && `https://media.valorant-api.com/playercards/${id}/displayicon.png`
export const cardWide = id => id && `https://media.valorant-api.com/playercards/${id}/wideart.png`

// Colors used to mark players sharing a party.
export const PARTY_COLORS = ['#f5b942', '#4cc9f0', '#f472b6', '#a3e635', '#c084fc']

export const STATE_LABEL = { menus: 'In menus', queue: 'In queue', pregame: 'Agent select', ingame: 'In match', away: 'Away', offline: 'Offline' }

// Memo badges: 'memo:get' is owned by the memo page; missing handler just means no badge.
const memoCache = new Map()
export function useMemos(puuids) {
  const key = puuids.filter(Boolean).sort().join(',')
  const [memos, setMemos] = useState({})
  useEffect(() => {
    let live = true
    const ids = key ? key.split(',') : []
    Promise.all(ids.map(async id => {
      if (!memoCache.has(id)) memoCache.set(id, invoke('memo:get', id).catch(() => null))
      return [id, await memoCache.get(id)]
    })).then(rows => live && setMemos(Object.fromEntries(rows.filter(r => r[1]))))
    return () => { live = false }
  }, [key])
  return memos
}
export const clearMemoCache = () => memoCache.clear()
