import { useMemo } from 'react'
import { FiUser } from 'react-icons/fi'
import { useContent, useTiers } from '../../lib/content'
import { useInvoke } from '../../lib/ipc'
import { navigate } from '../../nav'

// Opens a player's profile in Player Search. Hidden players never carry a puuid, so they can't be opened.
export function openPlayer(p) {
  if (p?.puuid) navigate('search', { puuid: p.puuid })
}

export const cx = (...c) => c.filter(Boolean).join(' ')

// valorant-api content lookups, keyed for fast access.
export function useAgents() {
  const list = useContent('agents?isPlayableCharacter=true')
  return useMemo(() => Object.fromEntries((list || []).map(a => [a.uuid, a])), [list])
}
export function useMaps() {
  const list = useContent('maps')
  return useMemo(() => Object.fromEntries((list || []).map(m => [m.mapUrl, m])), [list])
}
export function useCards() {
  const list = useContent('playercards')
  return useMemo(() => Object.fromEntries((list || []).map(c => [c.uuid, c])), [list])
}
export function useSeasons() {
  const list = useContent('seasons')
  return useMemo(() => Object.fromEntries((list || []).map(s => [s.uuid, s])), [list])
}
export function seasonName(seasons, id) {
  const s = seasons[id]
  if (!s) return ''
  const parent = s.parentUuid && seasons[s.parentUuid]
  return parent ? `${shortEpisode(parent.displayName)} ${shortAct(s.displayName)}` : s.displayName
}

// "ACT II" -> "A2", "EPISODE 9" -> "E9", "V26" stays "V26".
const ROMAN = { I: 1, V: 5, X: 10 }
const fromRoman = r => [...r].reduce((n, c, i, a) => n + (ROMAN[c] < (ROMAN[a[i + 1]] || 0) ? -ROMAN[c] : ROMAN[c]), 0)
const shortAct = name => { const m = /^ACT\s+([IVX]+)$/i.exec(name.trim()); return m ? `A${fromRoman(m[1].toUpperCase())}` : name }
const shortEpisode = name => { const m = /^EPISODE\s+(\d+)$/i.exec(name.trim()); return m ? `E${m[1]}` : name }

export function timeAgo(ms) {
  const s = Math.max(1, Math.floor((Date.now() - ms) / 1000))
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`
  return `${Math.floor(s / 604800)}w ago`
}
export const fmtDate = ms => new Date(ms).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
export const fmtLen = ms => `${Math.floor(ms / 60000)}m`

export const RESULT = {
  win: { label: 'Win', text: 'text-good', bar: 'bg-good', tone: 'good' },
  loss: { label: 'Loss', text: 'text-bad', bar: 'bg-bad', tone: 'bad' },
  draw: { label: 'Draw', text: 'text-warn', bar: 'bg-warn', tone: 'warn' },
}

export const riotId = n => (n ? `${n.gameName}#${n.tagLine}` : '')

// Display label for a player: Riot ID, or the agent name when the name is hidden.
export function playerLabel(p, agents) {
  return p.name ? riotId(p.name) : agents[p.agent]?.displayName || 'Hidden player'
}

export function AgentIcon({ id, agents, size = 36, className }) {
  const a = agents[id]
  return (
    <div className={cx('shrink-0 rounded-lg bg-surface-2 border border-line overflow-hidden flex items-center justify-center', className)} style={{ width: size, height: size }}>
      {a ? <img src={a.displayIcon} alt={a.displayName} title={a.displayName} className='w-full h-full object-cover' draggable={false} /> : <FiUser className='text-muted' />}
    </div>
  )
}

export function TierIcon({ tier, size = 28, showName }) {
  const tiers = useTiers()
  const t = tiers?.[tier]
  if (!t || !tier) return <span className='text-muted text-xs'>{showName ? 'Unranked' : '-'}</span>
  return (
    <span className='inline-flex items-center gap-1.5' title={t.tierName}>
      <img src={t.smallIcon} alt={t.tierName} style={{ width: size, height: size }} draggable={false} />
      {showName && <span className='text-xs font-semibold' style={{ color: `#${t.color.slice(0, 6)}` }}>{t.tierName}</span>}
    </span>
  )
}

export const kd = (k, d) => (d ? k / d : k).toFixed(2)

// All saved memos as a { puuid: memo } map.
export function useMemos(skip) {
  const { data, reload } = useInvoke('memo:list', [], { skip })
  const map = useMemo(() => Object.fromEntries((data || []).map(m => [m.puuid, m])), [data])
  return { memos: data || [], map, reload }
}
