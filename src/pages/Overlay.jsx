import React, { useEffect, useState } from 'react'
import { FiEyeOff, FiLock, FiUnlock, FiX } from 'react-icons/fi'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useTiers } from '../lib/content'
import { AgentIcon, RankIcon } from './live/parts'
import { displayName } from './live/PlayerRow'
import { PARTY_COLORS, queueName } from './live/util'
import logo from '../assets/spectre-logo.svg'

const cx = (...c) => c.filter(Boolean).join(' ')
const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())

// Overlay settings, kept live: changes in the main window apply here right away.
function useOverlaySettings() {
  const [s, setS] = useState(null)
  useEffect(() => { invoke('settings:get').then(setS).catch(() => { }) }, [])
  useEvent('settings:changed', setS)
  const o = s?.overlay || {}
  return {
    opacity: o.opacity >= 0.2 && o.opacity <= 1 ? +o.opacity : 0.9,
    scale: o.scale >= 0.6 && o.scale <= 2 ? +o.scale : 1,
    showPeak: o.showPeak !== false, locked: !!o.locked, hotkey: o.hotkey || '',
  }
}

function Row({ p, showPeak, tiers }) {
  const color = p.party != null ? PARTY_COLORS[p.party % PARTY_COLORS.length] : null
  const t = tiers?.[p.rank]
  const sub = [p.level != null && `Lv ${p.level}`, p.scouted && `${p.scouted.kd.toFixed(2)} KD`, p.scouted?.hs != null && `${p.scouted.hs}% HS`].filter(Boolean).join(' · ')
  return (
    <div className={cx('flex items-center gap-2 h-10 pl-1 pr-2 rounded-lg transition-colors', p.self ? 'accent-soft' : 'bg-surface-2/70 border border-line/60')}>
      <span className='w-[3px] h-6 rounded-full shrink-0' style={{ background: color || 'transparent' }} title={color ? 'Your party' : undefined} />
      <AgentIcon agent={p.agent} size={28} locked={p.locked} className='!rounded-lg' />
      <div className='flex-1 min-w-0 leading-tight'>
        <div className={cx('flex items-center gap-1 text-[12px] font-semibold', p.self ? 'text-accent' : 'text-text')}>
          <span className='truncate'>{displayName(p)}</span>
          {p.hidden && <FiEyeOff className='shrink-0 text-muted' size={10} title='Name hidden by streamer mode' />}
        </div>
        {sub && <div className='text-[9.5px] text-muted truncate'>{sub}</div>}
      </div>
      {p.ranked && (<>
        <div className='text-right leading-tight shrink-0'>
          <div className='text-[10.5px] font-semibold' style={{ color: p.rank && t ? `#${t.color.slice(0, 6)}` : undefined }}>{p.rank ? title(t?.tierName) : 'Unranked'}</div>
          {p.rank > 0 && <div className='text-[9.5px] text-muted tabular-nums'>{p.rr} RR</div>}
        </div>
        <RankIcon tier={p.rank} size={24} />
        {showPeak && p.peak > p.rank && <RankIcon tier={p.peak} size={16} className='opacity-70 -ml-1' />}
      </>)}
    </div>
  )
}

function Team({ label, players, tone, showPeak, tiers }) {
  if (!players.length) return null
  const ranked = players.filter(p => p.ranked && p.rank > 0)
  const avg = ranked.length ? Math.round(ranked.reduce((a, p) => a + p.rank, 0) / ranked.length) : 0
  return (
    <div className='mb-2.5 last:mb-0'>
      <div className='flex items-center gap-2 px-1 mb-1.5'>
        <span className={cx('text-[10.5px] font-semibold tracking-[0.12em] uppercase', tone)}>{label}</span>
        <span className='px-1.5 rounded-full bg-surface-2 border border-line/60 text-[10px] text-muted tabular-nums'>{players.length}</span>
        {avg > 0 && <span className='ml-auto flex items-center gap-1 text-[10px] text-muted'>avg <RankIcon tier={avg} size={14} /> {title(tiers?.[avg]?.tierName)}</span>}
      </div>
      <div className='grid gap-1'>{players.map((p, i) => <Row key={p.ref || i} p={p} showPeak={showPeak} tiers={tiers} />)}</div>
    </div>
  )
}

function Hint({ children }) {
  return <div className='h-full flex flex-col items-center justify-center gap-1 px-6 text-center text-[11px] text-muted'>{children}</div>
}

export default function Overlay() {
  const { connected } = useRiot()
  const { opacity, scale, showPeak, locked, hotkey } = useOverlaySettings()
  const live = useInvoke('live:state', [], { poll: 4000, skip: !connected })
  const tiers = useTiers()
  const d = live.data

  useEffect(() => {
    // color-scheme: normal too, so the dark theme's color-scheme never paints an opaque page behind the panel.
    const root = document.documentElement.style
    const prev = [root.background, root.colorScheme, document.body.style.background]
    root.background = 'transparent'
    root.colorScheme = 'normal'
    document.body.style.background = 'transparent'
    return () => { root.background = prev[0]; root.colorScheme = prev[1]; document.body.style.background = prev[2] }
  }, [])

  const inMatch = d && d.state !== 'menus'
  const ffa = d?.state === 'ingame' && d.queueId === 'deathmatch'
  const key = hotkey && <kbd className='px-1.5 rounded-md border border-line bg-surface-2 text-text font-sans'>{hotkey}</kbd>
  let body
  if (!connected) body = <Hint>Waiting for the Riot Client...</Hint>
  else if (live.loading && !d) body = <div className='grid gap-1'>{Array.from({ length: 6 }, (_, i) => <div key={i} className='skeleton h-10 rounded-lg' />)}</div>
  else if (live.error && !d) body = <Hint><span className='text-bad'>{live.error}</span></Hint>
  else if (!inMatch) body = <Hint><span className='text-text font-semibold'>Waiting for a match</span>The overlay fills in at agent select.{key && <span className='mt-1'>{key} shows or hides it.</span>}</Hint>
  else body = ffa
    ? <Team label='Players' tone='text-accent' players={d.players} showPeak={showPeak} tiers={tiers} />
    : <>
      <Team label={d.state === 'pregame' ? 'Your team' : 'Allies'} tone='text-accent' players={d.players.filter(p => !p.enemy)} showPeak={showPeak} tiers={tiers} />
      {d.state === 'pregame'
        ? <div className='px-1 text-[10px] text-muted'>Enemies appear when the match starts.</div>
        : <Team label='Enemies' tone='text-bad' players={d.players.filter(p => p.enemy)} showPeak={showPeak} tiers={tiers} />}
    </>

  return (
    <div className='h-screen w-screen overflow-hidden p-1' style={{ zoom: scale }}>
      <div className='h-full flex flex-col rounded-2xl border border-line overflow-hidden anim-fade shadow-[inset_0_1px_0_rgb(255_255_255/0.07)]'
        style={{ background: `linear-gradient(180deg, rgb(var(--panel) / ${opacity}), rgb(var(--bg) / ${opacity}))` }}>
        <div className={cx('flex items-center gap-2 pl-2.5 pr-2 h-9 shrink-0 border-b border-line select-none', !locked && 'cursor-move')} data-tauri-drag-region>
          {/* Only the bar itself starts a window drag, so its labels let clicks through to it. */}
          <img src={logo} alt='' className='w-4 h-4 shrink-0 pointer-events-none' draggable={false} />
          <span className='pointer-events-none flex-1 min-w-0 truncate font-display text-[12px] font-semibold tracking-tight text-text'>
            {inMatch ? `${d.map?.name || 'Match'} · ${queueName(d.queueId)}` : 'Spectre'}
          </span>
          {inMatch && <span className={cx('pointer-events-none flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold', d.state === 'ingame' ? 'bg-good/[0.15] text-good border-good/30' : 'bg-warn/[0.15] text-warn border-warn/30')}>
            <span className={cx('w-1.5 h-1.5 rounded-full anim-pulse', d.state === 'ingame' ? 'bg-good' : 'bg-warn')} />{d.state === 'ingame' ? 'Live' : 'Agent select'}
          </span>}
          <button className='w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors'
            title='Lock: clicks pass through to the game' onClick={() => invoke('overlay:lock', true).catch(() => { })}>{locked ? <FiLock size={12} /> : <FiUnlock size={12} />}</button>
          <button className='w-6 h-6 rounded-full flex items-center justify-center text-muted hover:text-bad hover:bg-bad/[0.15] transition-colors'
            title={hotkey ? `Hide (${hotkey})` : 'Hide'} onClick={() => invoke('overlay:close').catch(() => { })}><FiX size={13} /></button>
        </div>
        <div className='flex-1 min-h-0 overflow-y-auto p-1.5'>{body}</div>
      </div>
    </div>
  )
}
