// Right panel: agent tokens, ability icons and strategy notes.
import { useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiSearch } from 'react-icons/fi'
import { Empty, Input, Skeleton, Tabs, Textarea } from '../../ui'
import { teamColor } from './model'

// Pointer-based drag onto the board. Native HTML drag and drop is swallowed by the app window on Windows,
// which made drags fail and clicks unreliable. A press that doesn't move counts as a click (place at centre).
function usePointerDrag(onDropAt, onPlace) {
  const [ghost, setGhost] = useState(null)
  const ref = useRef(null)
  const start = (e, payload, after) => {
    if (e.button !== 0) return
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY
    let moved = false
    const move = (ev) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) < 5) return
      if (!moved) { moved = true; setGhost({ icon: payload.icon, ability: payload.type === 'ability' }) }
      if (ref.current) ref.current.style.transform = `translate(${ev.clientX}px, ${ev.clientY}px)`
    }
    const up = (ev) => {
      window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up)
      setGhost(null)
      if (ev.type === 'pointercancel') return
      if (moved) onDropAt(payload, ev.clientX, ev.clientY)
      else onPlace(payload)
      after?.()
    }
    window.addEventListener('pointermove', move); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  // Keyboard: Enter / Space places at the centre of the board.
  const keys = (payload, after) => (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPlace(payload); after?.() } }
  const layer = ghost && createPortal(
    <div ref={ref} className='fixed left-0 top-0 z-[100] pointer-events-none' style={{ transform: 'translate(-999px, -999px)' }}>
      <div className={`-translate-x-1/2 -translate-y-1/2 w-12 h-12 rounded-full overflow-hidden border-2 border-accent shadow-xl ${ghost.ability ? 'bg-black/80 grid place-items-center' : 'bg-black'}`}>
        <img src={ghost.icon} alt='' className={ghost.ability ? 'w-7 h-7' : 'w-full h-full object-cover'} />
      </div>
    </div>, document.body)
  return { start, keys, layer }
}

// The agent you last picked (here or on the board) keeps its abilities one drag away under the agent grid.
export default function Palette({ agents, side, placed, onPlace, onDropAt, notes, onNotes, focus, onFocus }) {
  const dnd = usePointerDrag(onDropAt, onPlace)
  const [tab, setTab] = useState('agents')
  const [team, setTeam] = useState('ally')
  const [q, setQ] = useState('')
  const abilityAgent = focus, setAbilityAgent = onFocus

  const list = useMemo(() => (agents || []).filter(a => a.displayName.toLowerCase().includes(q.toLowerCase())), [agents, q])
  const ag = (agents || []).find(a => a.uuid === abilityAgent) || agents?.[0]
  const picked = (agents || []).find(a => a.uuid === focus)
  const abilities = (ag?.abilities || []).filter(a => a.displayIcon)
  const abilityPayload = (a, ab) => ({ type: 'ability', agentId: a.uuid, name: `${a.displayName}: ${ab.displayName}`, icon: ab.displayIcon })

  return (
    <div className='glass h-full flex flex-col rounded-[28px] overflow-hidden'>
      <div className='p-4 pb-3'>
        <Tabs tabs={[{ value: 'agents', label: 'Agents' }, { value: 'abilities', label: 'Abilities' }, { value: 'notes', label: 'Notes' }]} value={tab} onChange={setTab} layoutId='strat-palette' className='w-full [&>button]:flex-1 [&>button]:justify-center' />
      </div>

      {tab === 'agents' && (
        <div className='flex-1 min-h-0 flex flex-col px-3.5 pb-3.5 gap-3 anim-fade' key='agents'>
          <div className='glass-inset flex gap-1 p-1 rounded-full'>
            {['ally', 'enemy'].map(t => (
              <button key={t} onClick={() => setTeam(t)}
                className={`flex-1 h-7 rounded-full text-[12px] font-semibold border transition-colors duration-200 ${team === t ? 'text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]' : 'border-transparent text-muted hover:text-text'}`}
                style={team === t ? { background: teamColor(t, side), borderColor: teamColor(t, side) } : undefined}>{t === 'ally' ? 'My team' : 'Enemy'}</button>
            ))}
          </div>
          <div className='relative'>
            <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm' />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search agents' className='pl-8 !h-9 rounded-full' />
          </div>
          <div className='flex-1 overflow-y-auto -mr-1 pr-1'>
            {!agents ? (
              <div className='grid grid-cols-4 gap-2'>{Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className='aspect-square rounded-xl' />)}</div>
            ) : !list.length ? <Empty title='No agents match' className='py-8' /> : (
              <div className='grid grid-cols-4 gap-2 stagger'>
                {list.map((a, i) => {
                  const payload = { type: 'agent', agentId: a.uuid, name: a.displayName, icon: a.displayIcon, team }
                  const n = placed[a.uuid + team] || 0
                  return (
                    <button key={a.uuid} type='button' onPointerDown={e => dnd.start(e, payload, () => onFocus(a.uuid))} onKeyDown={dnd.keys(payload, () => onFocus(a.uuid))} title={`${a.displayName} - drag onto the map or click`}
                      style={{ '--i': Math.min(i, 20) }}
                      className={`glass anim-rise relative aspect-square rounded-2xl overflow-hidden transition-[transform,border-color] duration-150 hover:scale-105 hover:border-accent/60 active:scale-95 ${focus === a.uuid ? '!border-accent' : ''}`}>
                      <img src={a.displayIcon} alt='' draggable={false} className='w-full h-full object-cover' />
                      {n > 0 && <span className='absolute bottom-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold grid place-items-center text-bg' style={{ background: teamColor(team, side) }}>{n}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
          {picked && (
            <div className='glass-inset rounded-2xl p-2.5 anim-fade' key={picked.uuid}>
              <p className='eyebrow mb-2 truncate'>{picked.displayName} utility</p>
              <div className='grid grid-cols-4 gap-1.5'>
                {(picked.abilities || []).filter(x => x.displayIcon).map(ab => {
                  const payload = abilityPayload(picked, ab)
                  return (
                    <button key={ab.slot} type='button' onPointerDown={e => dnd.start(e, payload)} onKeyDown={dnd.keys(payload)} title={`${ab.displayName} - drag onto the map or click`}
                      className='aspect-square rounded-xl bg-black/60 border border-white/15 grid place-items-center transition-[transform,border-color] duration-150 hover:border-accent/60 hover:-translate-y-0.5 active:scale-95'>
                      <img src={ab.displayIcon} alt={ab.displayName} draggable={false} className='h-6 w-6' />
                    </button>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {tab === 'abilities' && (
        <div className='flex-1 min-h-0 flex flex-col px-3.5 pb-3.5 gap-3 anim-fade' key='abilities'>
          <div className='flex flex-wrap gap-1.5'>
            {(agents || []).map(a => (
              <button key={a.uuid} onClick={() => setAbilityAgent(a.uuid)} title={a.displayName}
                className={`h-8 w-8 rounded-full overflow-hidden border bg-surface-2 transition duration-200 ${ag?.uuid === a.uuid ? 'border-accent ring-2 ring-accent/30 scale-110' : 'border-line opacity-60 hover:opacity-100'}`}>
                <img src={a.displayIcon} alt='' draggable={false} className='w-full h-full object-cover' />
              </button>
            ))}
          </div>
          {ag && <p className='eyebrow'>{ag.displayName} abilities</p>}
          <div className='grid grid-cols-2 gap-2 stagger' key={ag?.uuid}>
            {abilities.map((ab, i) => {
              const payload = abilityPayload(ag, ab)
              return (
                <button key={ab.slot} type='button' onPointerDown={e => dnd.start(e, payload)} onKeyDown={dnd.keys(payload)} style={{ '--i': i }}
                  className='glass anim-rise flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-[transform,border-color] duration-150 hover:border-accent/60 hover:-translate-y-0.5 active:scale-95'>
                  <span className='h-11 w-11 rounded-full bg-black/60 border border-white/20 grid place-items-center'><img src={ab.displayIcon} alt='' draggable={false} className='h-7 w-7' /></span>
                  <span className='text-[11px] font-medium text-muted leading-tight text-center'>{ab.displayName}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className='flex-1 min-h-0 flex flex-col px-3.5 pb-3.5 gap-2.5 anim-fade' key='notes'>
          <p className='eyebrow'>Strategy notes</p>
          <Textarea value={notes} onChange={e => onNotes(e.target.value)} placeholder='Calls, timings, utility order, fallbacks...' className='flex-1 leading-relaxed rounded-xl py-2.5' />
        </div>
      )}
      {dnd.layer}
    </div>
  )
}
