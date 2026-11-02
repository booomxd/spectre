// Left panel: playbooks (folders) containing strategies, with search and hover actions.
import { useMemo, useState } from 'react'
import { FiChevronRight, FiCopy, FiEdit2, FiFolder, FiPlus, FiSearch, FiTrash2 } from 'react-icons/fi'
import { Badge, Button, Empty, Input, Skeleton } from '../../ui'

function Act({ icon: Icon, title, onClick, danger }) {
  return (
    <button title={title} onClick={e => { e.stopPropagation(); onClick() }}
      className={`h-6 w-6 grid place-items-center rounded-md text-[13px] text-muted transition-colors ${danger ? 'hover:text-bad hover:bg-bad/15' : 'hover:text-text hover:bg-surface-2'}`}><Icon /></button>
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
    <div className='h-full flex flex-col border-r border-line bg-surface/40'>
      <div className='p-3 flex flex-col gap-2.5'>
        <div className='flex items-center justify-between'>
          <h2 className='font-display text-base font-bold uppercase tracking-wide'>Playbooks</h2>
          <Button size='sm' variant='primary' icon={FiPlus} onClick={onNewPlaybook}>New</Button>
        </div>
        <div className='relative'>
          <FiSearch className='absolute left-2.5 top-1/2 -translate-y-1/2 text-muted text-sm' />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search strategies' className='pl-8' />
        </div>
      </div>
      <div className='flex-1 overflow-y-auto px-2 pb-3'>
        {loading ? (
          <div className='flex flex-col gap-2 px-1'>{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className='h-9 rounded-lg' />)}</div>
        ) : !rows.length ? (
          <Empty title={needle ? 'Nothing found' : 'No playbooks yet'} hint={needle ? 'Try another search.' : 'A playbook is a folder of strategies for a team or map pool.'}
            action={!needle && <Button size='sm' variant='primary' icon={FiPlus} onClick={onNewPlaybook}>New playbook</Button>} />
        ) : (
          <div className='flex flex-col gap-1 stagger'>
            {rows.map(({ pb, strategies }, i) => {
              const open = needle ? true : !closed[pb.id]
              return (
                <div key={pb.id} className='anim-rise' style={{ '--i': i }}>
                  <div className='group flex items-center gap-1.5 h-9 pl-1.5 pr-1 rounded-lg cursor-pointer text-muted hover:text-text hover:bg-surface-2 transition-colors'
                    onClick={() => setClosed(c => ({ ...c, [pb.id]: open }))}>
                    <FiChevronRight className={`text-xs transition-transform duration-200 ${open ? 'rotate-90' : ''}`} />
                    <FiFolder className='text-accent/80' />
                    <span className='flex-1 truncate text-[13px] font-semibold text-text'>{pb.name}</span>
                    <span className='text-[11px] tabular-nums group-hover:hidden'>{pb.strategies.length}</span>
                    <span className='hidden group-hover:flex items-center'>
                      <Act icon={FiPlus} title='New strategy' onClick={() => onNewStrategy(pb.id)} />
                      <Act icon={FiEdit2} title='Rename' onClick={() => onRename(pb.id)} />
                      <Act icon={FiCopy} title='Duplicate' onClick={() => onDuplicate(pb.id)} />
                      <Act icon={FiTrash2} title='Delete' danger onClick={() => onDelete(pb.id)} />
                    </span>
                  </div>
                  {open && (
                    <div className='ml-4 pl-2 border-l border-line flex flex-col gap-0.5 py-0.5 anim-fade'>
                      {strategies.map(s => {
                        const m = mapById[s.mapId]
                        const on = sel?.sid === s.id
                        return (
                          <div key={s.id} onClick={() => onSelect(pb.id, s.id)}
                            className={`group flex items-center gap-2 h-10 px-1.5 rounded-lg cursor-pointer transition-all duration-150 ${on ? 'bg-accent/12 ring-1 ring-accent/40' : 'hover:bg-surface-2'}`}>
                            <div className='h-7 w-7 rounded-md overflow-hidden bg-bg border border-line shrink-0'>{m?.displayIcon && <img src={m.displayIcon} alt='' className='h-full w-full object-cover' />}</div>
                            <div className='flex-1 min-w-0'>
                              <p className={`truncate text-[12.5px] font-semibold leading-tight ${on ? 'text-text' : 'text-text/90'}`}>{s.name}</p>
                              <p className='truncate text-[10.5px] text-muted leading-tight'>{m?.displayName || 'Unknown map'} · {s.steps.length} step{s.steps.length === 1 ? '' : 's'}</p>
                            </div>
                            <span className='group-hover:hidden'><Badge tone={s.side === 'attack' ? 'bad' : 'accent'}>{s.side === 'attack' ? 'ATK' : 'DEF'}</Badge></span>
                            <span className='hidden group-hover:flex items-center'>
                              <Act icon={FiEdit2} title='Rename' onClick={() => onRename(pb.id, s.id)} />
                              <Act icon={FiCopy} title='Duplicate' onClick={() => onDuplicate(pb.id, s.id)} />
                              <Act icon={FiTrash2} title='Delete' danger onClick={() => onDelete(pb.id, s.id)} />
                            </span>
                          </div>
                        )
                      })}
                      {!strategies.length && <p className='text-[11px] text-muted px-2 py-2'>Empty playbook. <button className='text-accent hover:underline' onClick={() => onNewStrategy(pb.id)}>Add a strategy</button></p>}
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
