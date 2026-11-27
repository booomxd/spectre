import { createMemo } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiUser } from 'solid-icons/fi'
import { useContent, useTiers } from '../../lib/content'
import { useInvoke } from '../../lib/ipc'
import { navigate } from '../../nav'

// opens a player's profile in Player Search
export function openPlayer(p) {
  if (p?.puuid) navigate('search', { puuid: p.puuid })
}

export const cx = (...c) => c.filter(Boolean).join(' ')

// valorant-api content lookups, keyed for fast access
// each returns an accessor
const keyed = (path, key) => { const list = useContent(path); return createMemo(() => Object.fromEntries((list() || []).map(a => [a[key], a]))) }
export const useAgents = () => keyed('agents?isPlayableCharacter=true', 'uuid')
export const useMaps = () => keyed('maps', 'mapUrl')
export const useCards = () => keyed('playercards', 'uuid')
export const useSeasons = () => keyed('seasons', 'uuid')
export function seasonName(seasons, id) {
  const s = seasons[id]
  if (!s) return ''
  const parent = s.parentUuid && seasons[s.parentUuid]
  return parent ? `${shortEpisode(parent.displayName)} ${shortAct(s.displayName)}` : s.displayName
}

// "ACT II" -> "A2", "EPISODE 9" -> "E9", "V26" stays "V26"
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

// display label for a player: Riot ID, or the agent name when the name is hidden
export function playerLabel(p, agents) {
  return p.name ? riotId(p.name) : agents[p.agent]?.displayName || 'Hidden player'
}

export function AgentIcon({ id, agents, size = 36, className }) {
  const a = agents[id]
  return (
    <div class={cx('shrink-0 rounded-lg bg-surface-2 border border-line overflow-hidden flex items-center justify-center shadow-[inset_0_1px_0_rgb(255_255_255/0.06)]', className)} style={st({ width: size, height: size })}>
      {a ? <img decoding='async' src={a.displayIcon} alt={a.displayName} title={a.displayName} class='w-full h-full object-cover' draggable={false} /> : <FiUser class='text-muted' />}
    </div>
  )
}

export function TierIcon({ tier, size = 28, showName }) {
  const tiers = useTiers()
  const t = tiers?.[tier]
  if (!t || !tier) return <span class='text-muted text-[12px]'>{showName ? 'Unranked' : '-'}</span>
  return (
    <span class='inline-flex items-center gap-2' title={t.tierName}>
      <img decoding='async' src={t.smallIcon} alt={t.tierName} style={st({ width: size, height: size })} draggable={false} />
      {/* .tier-text keeps the tier color readable on the light theme */}
      {showName && <span class='tier-text text-[12px] font-semibold' style={st({ '--tier': `#${t.color.slice(0, 6)}` })}>{t.tierName}</span>}
    </span>
  )
}

export const kd = (k, d) => (d ? k / d : k).toFixed(2)

// all saved memos as a { puuid: memo } map
export function useMemos(skip) {
  const res = useInvoke('memo:list', [], { skip })
  const map = createMemo(() => Object.fromEntries((res.data || []).map(m => [m.puuid, m])))
  return { get memos() { return res.data || [] }, get map() { return map() }, reload: q => res.reload(q) }
}
