// Right panel: agent tokens, ability icons and strategy notes.
import { useMemo, useState } from 'react'
import { FiSearch } from 'react-icons/fi'
import { Empty, Input, Skeleton, Tabs, Textarea } from '../../ui'
import { teamColor } from './model'

function drag(e, payload) {
  e.dataTransfer.setData('text/vd', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

export default function Palette({ agents, side, placed, onPlace, notes, onNotes }) {
  const [tab, setTab] = useState('agents')
  const [team, setTeam] = useState('ally')
  const [q, setQ] = useState('')
  const [abilityAgent, setAbilityAgent] = useState(null)

  const list = useMemo(() => (agents || []).filter(a => a.displayName.toLowerCase().includes(q.toLowerCase())), [agents, q])
  const ag = (agents || []).find(a => a.uuid === abilityAgent) || agents?.[0]
  const abilities = (ag?.abilities || []).filter(a => a.displayIcon)

  return (
    <div className='h-full flex flex-col border-l border-line bg-surface/40'>
      <div className='p-3 pb-2'>
        <Tabs tabs={[{ value: 'agents', label: 'Agents' }, { value: 'abilities', label: 'Abilities' }, { value: 'notes', label: 'Notes' }]} value={tab} onChange={setTab} className='w-full [&>button]:flex-1' />
      </div>

      {tab === 'agents' && (
        <div className='flex-1 min-h-0 flex flex-col px-3 pb-3 gap-3 anim-fade' key='agents'>
          <div className='flex gap-2'>
            {['ally', 'enemy'].map(t => (
              <button key={t} onClick={() => setTeam(t)}
                className={`flex-1 h-8 rounded-lg text-[11px] font-bold uppercase tracking-wider border transition-all ${team === t ? 'text-bg' : 'text-muted border-line hover:text-text'}`}
                style={team === t ? { background: teamColor(t, side), borderColor: teamColor(t, side) } : undefined}>{t === 'ally' ? 'My team' : 'Enemy'}</button>
            ))}
          </div>
          <div className='relative'>
            <FiSearch className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm' />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search agents' className='pl-8' />
          </div>
          <div className='flex-1 overflow-y-auto -mr-1 pr-1'>
            {!agents ? (
              <div className='grid grid-cols-4 gap-2'>{Array.from({ length: 16 }).map((_, i) => <Skeleton key={i} className='aspect-square rounded-lg' />)}</div>
            ) : !list.length ? <Empty title='No agents match' className='py-8' /> : (
              <div className='grid grid-cols-4 gap-2 stagger'>
                {list.map((a, i) => {
                  const payload = { type: 'agent', agentId: a.uuid, name: a.displayName, icon: a.displayIcon, team }
                  const n = placed[a.uuid + team] || 0
                  return (
                    <button key={a.uuid} draggable onDragStart={e => drag(e, payload)} onClick={() => onPlace(payload)} title={`${a.displayName} - drag onto the map or click`}
                      style={{ '--i': Math.min(i, 20) }}
                      className='anim-rise relative aspect-square rounded-lg bg-surface-2 border border-line overflow-hidden transition-all duration-150 hover:scale-105 hover:border-accent/60 active:scale-95'>
                      <img src={a.displayIcon} alt='' draggable={false} className='w-full h-full object-cover' />
                      {n > 0 && <span className='absolute bottom-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold grid place-items-center text-bg' style={{ background: teamColor(team, side) }}>{n}</span>}
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'abilities' && (
        <div className='flex-1 min-h-0 flex flex-col px-3 pb-3 gap-3 anim-fade' key='abilities'>
          <div className='flex flex-wrap gap-1.5'>
            {(agents || []).map(a => (
              <button key={a.uuid} onClick={() => setAbilityAgent(a.uuid)} title={a.displayName}
                className={`h-8 w-8 rounded-lg overflow-hidden border transition-all ${ag?.uuid === a.uuid ? 'border-accent scale-110' : 'border-line opacity-60 hover:opacity-100'}`}>
                <img src={a.displayIcon} alt='' draggable={false} className='w-full h-full object-cover' />
              </button>
            ))}
          </div>
          {ag && <p className='text-[11px] font-semibold tracking-[0.18em] uppercase text-muted'>{ag.displayName} abilities</p>}
          <div className='grid grid-cols-2 gap-2 stagger' key={ag?.uuid}>
            {abilities.map((ab, i) => {
              const payload = { type: 'ability', agentId: ag.uuid, name: `${ag.displayName}: ${ab.displayName}`, icon: ab.displayIcon }
              return (
                <button key={ab.slot} draggable onDragStart={e => drag(e, payload)} onClick={() => onPlace(payload)} style={{ '--i': i }}
                  className='anim-rise flex flex-col items-center gap-1.5 p-3 rounded-lg bg-surface-2 border border-line transition-all duration-150 hover:border-accent/60 hover:-translate-y-0.5 active:scale-95'>
                  <span className='h-11 w-11 rounded-full bg-black/60 border border-white/20 grid place-items-center'><img src={ab.displayIcon} alt='' draggable={false} className='h-7 w-7' /></span>
                  <span className='text-[11px] text-muted leading-tight text-center'>{ab.displayName}</span>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {tab === 'notes' && (
        <div className='flex-1 min-h-0 flex flex-col px-3 pb-3 gap-2 anim-fade' key='notes'>
          <p className='text-[11px] font-semibold tracking-[0.18em] uppercase text-muted'>Strategy notes</p>
          <Textarea value={notes} onChange={e => onNotes(e.target.value)} placeholder='Calls, timings, utility order, fallbacks...' className='flex-1 leading-relaxed' />
        </div>
      )}
    </div>
  )
}
