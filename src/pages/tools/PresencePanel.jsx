import { useEffect, useState } from 'react'
import { FiInfo, FiRotateCcw } from 'react-icons/fi'
import { Badge, Button, FadeIn, Skeleton, Toggle, withToast } from '../../ui'
import { invoke, useEvent, useInvoke } from '../../lib/ipc'
import { useRiot } from '../../lib/riot'
import { useContent, useTiers } from '../../lib/content'
import { NO_TITLE, QUEUES, divisionLabel, lc } from './gear'

// presence state + live refresh
export function usePresence(active) {
  const riot = useRiot()
  const st = useInvoke('tools:state', [], { skip: !riot.connected, poll: active ? 5000 : undefined })
  useEvent('tools:applied', () => st.reload(true))
  return st
}

// runs a tools:* write with a toast
export async function runTool(channel, arg, msg = 'Updated. Friends see it within a few seconds') {
  const r = await withToast(invoke(channel, arg), msg)
  return !!r
}

function statusText(s, maps) {
  if (!s) return ''
  const mode = QUEUES.find(q => q.value === s.queue)?.label || 'Custom Game'
  const map = maps?.find(m => m.mapUrl === s.map)?.displayName
  const base = { MENUS: 'In menus', QUEUE: `Queueing for ${mode}`, PREGAME: `Agent select${map ? ' on ' + map : ''}`, INGAME: `${mode}${map ? ' on ' + map : ''}`, RANGE: 'In the range' }[s.state] || ''
  return s.state === 'INGAME' ? `${base} (${s.ally ?? 0} - ${s.enemy ?? 0})` : base
}

// Live "how friends see you" card
export function PresencePanel({ presence, draft = {} }) {
  const riot = useRiot()
  const tiers = useTiers()
  const cards = useContent('playercards')
  const titles = useContent('playertitles')
  const maps = useContent('maps')
  const { data, error, loading } = presence
  const [keep, setKeep] = useState(true)
  useEffect(() => { if (data) setKeep(data.keep) }, [data?.keep])

  const cur = data?.current || {}
  const pp = cur.playerPresenceData || {}
  const pr = { ...(cur.premierPresenceData || {}), ...(draft.premier || {}) }
  const tier = draft.tier ?? pp.competitiveTier ?? 0
  const lb = draft.leaderboard ?? pp.leaderboardPosition ?? 0
  const level = draft.level ?? pp.accountLevel
  const cardId = draft.cardId ?? pp.playerCardId
  const titleId = draft.titleId !== undefined ? draft.titleId : pp.playerTitleId
  const card = cards?.find(c => lc(c.uuid) === lc(cardId))
  const title = titleId && lc(titleId) !== NO_TITLE ? titles?.find(t => lc(t.uuid) === lc(titleId)) : null
  const t = tiers?.[tier]
  const st = draft.status || (cur.matchPresenceData && {
    state: cur.partyPresenceData?.queueEntryTime && cur.partyPresenceData.partyState === 'MATCHMAKING' ? 'QUEUE' : cur.matchPresenceData.sessionLoopState,
    queue: cur.matchPresenceData.queueId, map: cur.matchPresenceData.matchMap,
    ally: cur.partyOwnerMatchScoreAllyTeam, enemy: cur.partyOwnerMatchScoreEnemyTeam,
  })
  const hasPremier = pr.rosterName || pr.rosterTag
  const overrideCount = Object.keys(data?.overrides || {}).length

  const toggleKeep = async v => {
    setKeep(v)
    await withToast(invoke('tools:keep', v), v ? undefined : 'Real profile restored')
    if (!v) presence.reload(true)
  }
  const reset = () => withToast(invoke('tools:reset'), 'Real profile restored').then(() => presence.reload(true))

  return (
    <FadeIn y={6} delay={0.04} className='glass rounded-2xl overflow-hidden'>
      {/* Friends-list preview: card banner, rank emblem, name */}
      <div className='h-24 relative bg-surface-2 [mask-image:linear-gradient(to_bottom,black_40%,transparent)]'>
        {card?.wideArt && <img decoding='async' key={card.uuid} src={card.wideArt} alt='' className='anim-fade w-full h-full object-cover' draggable={false} />}
      </div>
      <div className='px-4 -mt-9 relative'>
        <div className='flex items-end gap-3'>
          <div className='glass w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 bg-bg/60'>
            {t?.largeIcon ? <img decoding='async' key={tier} src={t.largeIcon} alt='' className='anim-pop w-10 h-10 object-contain' draggable={false} /> : <Skeleton className='w-9 h-9 rounded-full' />}
          </div>
          <div className='min-w-0 pb-0.5'>
            <div className='text-[15px] font-bold tracking-tight leading-tight text-text truncate'>{riot.gameName || 'Player'}<span className='text-muted font-medium text-[12px]'> #{riot.tagLine}</span></div>
            <div className='text-[11.5px] font-medium text-muted mt-0.5'>{t?.tierName || '...'}{lb > 0 && <span className='text-accent tabular-nums'> #{lb}</span>}</div>
          </div>
        </div>
        <div className='mt-3.5 flex items-center gap-1.5'>
          <span className='eyebrow text-[10px]'>Friends see</span>
          <span className='flex-1' />
          {data?.error && <Badge tone='warn'>No game</Badge>}
          {overrideCount > 0 && <Badge tone='accent'>{overrideCount} active</Badge>}
        </div>
        <div className='mt-2 rounded-xl glass-inset px-3 py-2.5 space-y-1.5 text-[11.5px]'>
          <Row k='Level' v={level ?? '-'} />
          <Row k='Title' v={title ? (title.titleText || title.displayName) : 'None'} />
          <Row k='Premier' v={hasPremier ? `${pr.showTag !== false && pr.rosterTag ? `[${pr.rosterTag}] ` : ''}${pr.rosterName || ''} - ${divisionLabel(pr.division)}` : 'No team'} />
          <Row k='Status' v={statusText(st, maps) || '-'} />
        </div>
        {loading && !data && <Skeleton className='h-3 mt-3 rounded-full' />}
        {error && <p className='text-[11px] text-bad mt-2'>{error}</p>}
        {data?.error && <p className='text-[11px] text-warn mt-2'>{data.error}</p>}
      </div>

      <div className='px-4 pt-4 pb-4'>
        <div className='hairline mb-3.5' />
        <Toggle checked={keep} onChange={toggleKeep} label='Keep applied' hint='Re-sends your edits every 5s whenever the game resets them' />
        <Button size='sm' variant='subtle' icon={FiRotateCcw} className='mt-3.5 w-full' onClick={reset} disabled={!overrideCount}>Reset overrides</Button>
        <p className='mt-3 flex gap-2 text-[11px] leading-relaxed text-muted'><FiInfo className='shrink-0 mt-0.5 text-accent' />Only your friends see this. It never touches your real rank or account.</p>
      </div>
    </FadeIn>
  )
}

const Row = ({ k, v }) => (
  <div className='flex justify-between gap-3'><span className='text-muted'>{k}</span><span className='text-right truncate font-medium text-text tabular-nums'>{v}</span></div>
)
