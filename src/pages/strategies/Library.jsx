// Left panel: playbooks (folders) containing strategies, with search and hover actions.
import { useMemo, useState } from 'react'
import { FiChevronRight, FiCopy, FiEdit2, FiFolder, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import { Badge, Button, Empty, Input, Skeleton, pressable } from '../../ui'

function Act({ icon: Icon, title, onClick, danger }) {
  return (
    <button title={title} onClick={e => { e.stopPropagation(); onClick() }}
      className={`h-7 w-7 grid place-items-center rounded-full text-[13px] text-muted transition-colors ${danger ? 'hover:text-bad hover:bg-bad/15' : 'hover:text-text hover:bg-surface-2'}`}><Icon /></button>
  )
}

export default function Library({ playbooks, loading, maps, sel, onSelect, onNewPlaybook, onNewStrategy, onRename, onDuplicate, onDelete }) {
  const [q, setQ] = useState('')
  const [closed, setClosed] = useState({})
  const mapById = useMemo(() => Object.fromEntries((maps || []).map(m => [m.uuid, m])), [maps])
  const needle = q.trim().toLowerCase()

  const rows = (playbooks || []).map(pb => {
    const nameHit = pb.name.toLowerCase().includes(needle)
    const strategies = pb.strategies.filter(s => !needle || nameHit || s.name.toLowerCase().includes(needle) || (mapById[s.mapId]?.displayName || '').toLowerCase().includes(needle))
    return { pb, strategies, show: !needle || nameHit || strategies.length > 0 }
  }).filter(r => r.show)

  return (
    <div className='glass h-full flex flex-col rounded-[28px] overflow-hidden'>
      <div className='p-5 pb-3 flex flex-col gap-3.5'>
        <div className='flex items-end justify-between'>
          <div>
            <div className='eyebrow mb-1'>Library</div>
            <h2 className='display text-[22px] text-text'>Playbooks</h2>
          </div>
          <Button size='sm' variant='glow' icon={FiPlus} onClick={onNewPlaybook}>New</Button>
        </div>
        <div className='relative'>
          <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm' />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search strategies' className='pl-8 !h-9 rounded-full' />
        </div>
      </div>
      <div className='hairline mx-5 mb-2' />
      <div className='flex-1 overflow-y-auto px-2.5 pb-3'>
        {loading ? (
          <div className='flex flex-col gap-2 px-1'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-9 rounded-xl' />)}</div>
        ) : !rows.length ? (
          <Empty title={needle ? 'Nothing found' : 'No playbooks yet'} hint={needle ? 'Try another search.' : 'A playbook is a folder of strategies for a team or map pool.'}
            action={!needle && <Button size='sm' variant='primary' icon={FiPlus} onClick={onNewPlaybook}>New playbook</Button>} />
        ) : (
          <div className='flex flex-col gap-1 stagger'>
            {rows.map(({ pb, strategies }, i) => {
              const open = needle ? true : !closed[pb.id]
              return (
                <div key={pb.id} className='anim-rise' style={{ '--i': i }}>
                  <div className='group flex items-center gap-2 h-9 pl-2 pr-1 rounded-xl cursor-pointer text-muted hover:text-text hover:bg-surface-2 transition-colors'
                    aria-expanded={open} {...pressable(() => setClosed(c => ({ ...c, [pb.id]: open })))}>
                    <FiChevronRight className={`text-xs transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                    <FiFolder className='text-accent/80' />
                    <span className='flex-1 truncate text-[13px] font-semibold text-text'>{pb.name}</span>
                    <span className='text-[11px] tabular-nums group-hover:hidden group-focus-within:hidden'>{pb.strategies.length}</span>
                    <span className='hidden group-hover:flex group-focus-within:flex items-center'>
                      <Act icon={FiPlus} title='New strategy' onClick={() => onNewStrategy(pb.id)} />
                      <Act icon={FiEdit2} title='Rename' onClick={() => onRename(pb.id)} />
                      <Act icon={FiCopy} title='Duplicate' onClick={() => onDuplicate(pb.id)} />
                      <Act icon={FiTrash2} title='Delete' danger onClick={() => onDelete(pb.id)} />
                    </span>
                  </div>
                  {open && (
                    <div className='ml-4 pl-2 border-l border-line flex flex-col gap-1 py-1 anim-fade'>
                      {strategies.map(s => {
                        const m = mapById[s.mapId]
                        const on = sel?.sid === s.id
                        return (
                          <div key={s.id} {...pressable(() => onSelect(pb.id, s.id))}
                            className={`group flex items-center gap-2.5 h-12 px-1.5 rounded-2xl cursor-pointer transition-colors duration-150 ${on ? 'accent-soft' : 'hover:bg-surface-2'}`}>
                            <div className='h-9 w-9 rounded-xl overflow-hidden glass-inset shrink-0'>{m?.displayIcon && <img decoding='async' src={m.displayIcon} alt='' className='h-full w-full object-cover' />}</div>
                            <div className='flex-1 min-w-0'>
                              <p className={`truncate text-[12.5px] font-semibold leading-tight ${on ? 'text-text' : 'text-text/90'}`}>{s.name}</p>
                              <p className='truncate text-[11px] text-muted leading-tight mt-0.5'>{m?.displayName || 'Unknown map'} · {s.steps.length} step{s.steps.length === 1 ? '' : 's'}</p>
                            </div>
                            <span className='group-hover:hidden group-focus-within:hidden'><Badge tone={s.side === 'attack' ? 'bad' : 'accent'}>{s.side === 'attack' ? 'ATK' : 'DEF'}</Badge></span>
                            <span className='hidden group-hover:flex group-focus-within:flex items-center'>
                              <Act icon={FiEdit2} title='Rename' onClick={() => onRename(pb.id, s.id)} />
                              <Act icon={FiCopy} title='Duplicate' onClick={() => onDuplicate(pb.id, s.id)} />
                              <Act icon={FiTrash2} title='Delete' danger onClick={() => onDelete(pb.id, s.id)} />
                            </span>
                          </div>
                        )
                      })}
                      {!strategies.length && <p className='text-[12px] text-muted px-2 py-2.5'>Empty playbook. <button className='text-accent hover:underline' onClick={() => onNewStrategy(pb.id)}>Add a strategy</button></p>}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
