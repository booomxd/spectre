import { Show } from 'solid-js'
import { FiAlertTriangle, FiAward, FiBarChart2, FiUsers } from 'solid-icons/fi'
import { FadeIn } from '../../ui'
import { useTiers } from '../../lib/content'
import { RankIcon } from './parts'
import { partyLabel } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')
const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

// A rank at or above Platinum 1 on an account under this level is worth a second look
const LOW_LEVEL = 40
const HIGH_RANK = 15

const ranked = ps => ps.filter(p => p.ranked && p.rank > 0)
// average rank as a decimal tier
const mean = ps => {
  const r = ranked(ps)
  return r.length ? r.reduce((a, p) => a + p.rank + Math.min(99, Math.max(0, p.rr || 0)) / 100, 0) / r.length : 0
}
// premade sizes on one side, biggest first: [3, 2] for a trio and a duo
const stacks = ps => {
  const by = new Map()
  ps.forEach(p => { if (p.partySize >= 2 && p.party != null) by.set(p.party, Math.max(by.get(p.party) || 0, p.partySize)) })
  return [...by.values()].sort((a, b) => b - a)
}
const top = ps => ranked(ps).reduce((best, p) => (!best || p.rank > best.rank || (p.rank === best.rank && p.rr > best.rr) ? p : best), null)
const lowLevel = ps => ps.filter(p => p.level != null && p.level > 0 && p.level < LOW_LEVEL && p.rank >= HIGH_RANK)
// Streamer-mode players are only ever called by their agent
const who = p => (p.hidden || !p.gameName ? p.agent?.name || 'Player' : p.gameName)

function Cell(props) {
  return (
    <div class='min-w-0 px-5 py-4'>
      <div class='flex items-center gap-2 eyebrow'><props.icon size={12} class={cx(props.tone === 'warn' ? 'text-warn' : 'text-accent')} />{props.label}</div>
      <div class='mt-2 text-[13px] leading-snug text-text'>{props.children}</div>
    </div>
  )
}

function Side(props) {
  return (
    <div class='flex items-center gap-2 min-w-0'>
      <span class={cx('w-1.5 h-1.5 rounded-full shrink-0', props.tone === 'bad' ? 'bg-bad' : 'bg-good')} />
      <span class='min-w-0 truncate'>{props.children}</span>
    </div>
  )
}

// A quick read of the lobby from what Live Match already shows: which side is ranked higher, who queued together, the highest rank on each side, and high ranks on low-level accounts
export default function LobbyRead(props) {
  const tiersA = useTiers()
  
    const name = t => title(tiersA()?.[t]?.tierName) || 'Unranked'
    const mine = () => (props.players.filter(p => !p.enemy))
    const theirs = () => (props.pregame ? [] : props.players.filter(p => p.enemy))
    const both = () => (theirs().length > 0)
    const a = () => (mean(mine())), b = () => (mean(theirs()))
    const gap = () => (a() && b() ? a() - b() : 0)
    const divisions = () => (Math.max(1, Math.round(Math.abs(gap()))))
    const verdict = () => (!both() || !a() || !b() ? null
    : Math.abs(gap()) < 0.75 ? 'Evenly ranked'
      : `${gap() > 0 ? 'Your team' : 'Opponents'} ranked about ${divisions()} ${divisions() === 1 ? 'division' : 'divisions'} higher`)
    const sm = () => (stacks(mine())), st = () => (stacks(theirs()))
    const stackText = s => (s.length ? s.map(partyLabel).join(' + ') : 'All solo')
    const tm = () => (top(mine())), tt = () => (top(theirs()))
    const flags = () => ([...lowLevel(mine()).map(p => ({ p, tone: 'good' })), ...lowLevel(theirs()).map(p => ({ p, tone: 'bad' }))])
    
    return (<Show when={!(!ranked(props.players).length && !sm().length && !st().length)} fallback={null}><FadeIn class='glass rounded-[22px] mb-8 grid sm:grid-cols-2 xl:grid-cols-4 divide-line max-xl:divide-y xl:divide-x overflow-hidden'>
      <Cell icon={FiBarChart2} label='Lobby read'>
        {verdict()
          ? <span class={cx('font-semibold', Math.abs(gap()) >= 0.75 && (gap() > 0 ? 'text-good' : 'text-bad'))}>{verdict()}</span>
          : <span class='text-muted'>{props.pregame ? 'Opponents show once the match starts' : 'Not enough ranked players to compare'}</span>}
      </Cell>
      <Cell icon={FiUsers} label='Premades'>
        <Side>{stackText(sm())}</Side>
        {both() && <Side tone='bad'>{stackText(st())}</Side>}
      </Cell>
      <Cell icon={FiAward} label='Highest rank'>
        {tm() ? <Side><RankIcon tier={tm().rank} size={16} class='inline-block align-[-3px] mr-1' />{name(tm().rank)} · {who(tm())}</Side> : <Side><span class='text-muted'>Unranked</span></Side>}
        {both() && (tt() ? <Side tone='bad'><RankIcon tier={tt().rank} size={16} class='inline-block align-[-3px] mr-1' />{name(tt().rank)} · {who(tt())}</Side> : <Side tone='bad'><span class='text-muted'>Unranked</span></Side>)}
      </Cell>
      <Cell icon={FiAlertTriangle} label='Low-level accounts' tone={flags().length ? 'warn' : undefined}>
        {flags().length
          ? flags().slice(0, 3).map(({ p, tone }) => <Side tone={tone}>{who(p)} · level {p.level} at {name(p.rank)}</Side>)
          : <span class='text-muted'>None at Platinum or above</span>}
      </Cell>
    </FadeIn></Show>)
  
}
