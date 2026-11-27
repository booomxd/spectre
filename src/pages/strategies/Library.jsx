import { For, createSignal, createMemo } from 'solid-js'
import { st } from '../../lib/st.js'
// left panel: playbooks (folders) containing strategies, with search and hover actions
import { FiChevronRight, FiCopy, FiEdit2, FiFolder, FiPlus, FiSearch, FiTrash2 } from 'solid-icons/fi'
import { Badge, Button, Empty, Input, Skeleton, pressable } from '../../ui'

function Act(props) {
  return (
    <button title={props.title} onClick={e => { e.stopPropagation(); props.onClick() }}
      class={`h-7 w-7 grid place-items-center rounded-full text-[13px] text-muted transition-colors ${props.danger ? 'hover:text-bad hover:bg-bad/15' : 'hover:text-text hover:bg-surface-2'}`}><props.icon /></button>
  )
}

export default function Library(props) {
  const [qS, setQ] = createSignal('')
  const [closedS, setClosed] = createSignal({})
  
    const mapById = createMemo(() => Object.fromEntries((props.maps || []).map(m => [m.uuid, m])))
    const needle = () => (qS().trim().toLowerCase())
    const rows = () => ((props.playbooks || []).map(pb => {
    const nameHit = pb.name.toLowerCase().includes(needle())
    const strategies = pb.strategies.filter(s => !needle() || nameHit || s.name.toLowerCase().includes(needle()) || (mapById()[s.mapId]?.displayName || '').toLowerCase().includes(needle()))
    return { pb, strategies, show: !needle() || nameHit || strategies.length > 0 }
  }).filter(r => r.show))
    return (<div class='glass h-full flex flex-col rounded-[28px] overflow-hidden'>
      <div class='p-5 pb-3 flex flex-col gap-3.5'>
        <div class='flex items-end justify-between'>
          <div>
            <div class='eyebrow mb-1'>Library</div>
            <h2 class='display text-[22px] text-text'>Playbooks</h2>
          </div>
          <Button size='sm' variant='glow' icon={FiPlus} onClick={props.onNewPlaybook}>New</Button>
        </div>
        <div class='relative'>
          <FiSearch class='absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm' />
          <Input value={qS()} onInput={e => setQ(e.target.value)} placeholder='Search strategies' class='pl-8 !h-9 rounded-full' />
        </div>
      </div>
      <div class='hairline mx-5 mb-2' />
      <div class='flex-1 overflow-y-auto px-2.5 pb-3'>
        {props.loading ? (
          <div class='flex flex-col gap-2 px-1'><For each={Array.from({ length: 5 })}>{(_, i) => <Skeleton class='h-9 rounded-xl' />}</For></div>
        ) : !rows().length ? (
          <Empty title={needle() ? 'Nothing found' : 'No playbooks yet'} hint={needle() ? 'Try another search.' : 'A playbook is a folder of strategies for a team or map pool.'}
            action={!needle() && <Button size='sm' variant='primary' icon={FiPlus} onClick={props.onNewPlaybook}>New playbook</Button>} />
        ) : (
          <div class='flex flex-col gap-1 stagger'>
            <For each={rows()}>{({ pb, strategies }, i) => {
              const open = () => (needle() ? true : !closedS()[pb.id])
              return (
                <div class='anim-rise' style={st({ '--i': i() })}>
                  <div class='group flex items-center gap-2 h-9 pl-2 pr-1 rounded-xl cursor-pointer text-muted hover:text-text hover:bg-surface-2 transition-colors'
                    aria-expanded={open()} {...pressable(() => setClosed(c => ({ ...c, [pb.id]: open() })))}>
                    <FiChevronRight class={`text-xs transition-transform duration-200 ${open() ? 'rotate-90' : ''}`} />
                    <FiFolder class='text-accent/80' />
                    <span class='flex-1 truncate text-[13px] font-semibold text-text'>{pb.name}</span>
                    <span class='text-[11px] tabular-nums group-hover:hidden group-focus-within:hidden'>{pb.strategies.length}</span>
                    <span class='hidden group-hover:flex group-focus-within:flex items-center'>
                      <Act icon={FiPlus} title='New strategy' onClick={() => props.onNewStrategy(pb.id)} />
                      <Act icon={FiEdit2} title='Rename' onClick={() => props.onRename(pb.id)} />
                      <Act icon={FiCopy} title='Duplicate' onClick={() => props.onDuplicate(pb.id)} />
                      <Act icon={FiTrash2} title='Delete' danger onClick={() => props.onDelete(pb.id)} />
                    </span>
                  </div>
                  {open() && (
                    <div class='ml-4 pl-2 border-l border-line flex flex-col gap-1 py-1 anim-fade'>
                      <For each={strategies}>{s => {
                        const m = () => (mapById()[s.mapId])
                        const on = () => (props.sel?.sid === s.id)
                        return (
                          <div {...pressable(() => props.onSelect(pb.id, s.id))}
                            class={`group flex items-center gap-2.5 h-12 px-1.5 rounded-2xl cursor-pointer transition-colors duration-150 ${on() ? 'accent-soft' : 'hover:bg-surface-2'}`}>
                            <div class='h-9 w-9 rounded-xl overflow-hidden glass-inset shrink-0'>{m()?.displayIcon && <img decoding='async' src={m().displayIcon} alt='' class='h-full w-full object-cover' />}</div>
                            <div class='flex-1 min-w-0'>
                              <p class={`truncate text-[12.5px] font-semibold leading-tight ${on() ? 'text-text' : 'text-text/90'}`}>{s.name}</p>
                              <p class='truncate text-[11px] text-muted leading-tight mt-0.5'>{m()?.displayName || 'Unknown map'} · {s.steps.length} step{s.steps.length === 1 ? '' : 's'}</p>
                            </div>
                            <span class='group-hover:hidden group-focus-within:hidden'><Badge tone={s.side === 'attack' ? 'bad' : 'accent'}>{s.side === 'attack' ? 'ATK' : 'DEF'}</Badge></span>
                            <span class='hidden group-hover:flex group-focus-within:flex items-center'>
                              <Act icon={FiEdit2} title='Rename' onClick={() => props.onRename(pb.id, s.id)} />
                              <Act icon={FiCopy} title='Duplicate' onClick={() => props.onDuplicate(pb.id, s.id)} />
                              <Act icon={FiTrash2} title='Delete' danger onClick={() => props.onDelete(pb.id, s.id)} />
                            </span>
                          </div>
                        )
                      }}</For>
                      {!strategies.length && <p class='text-[12px] text-muted px-2 py-2.5'>Empty playbook. <button class='text-accent hover:underline' onClick={() => props.onNewStrategy(pb.id)}>Add a strategy</button></p>}
                    </div>
                  )}
                </div>
              )
            }}</For>
          </div>
        )}
      </div>
    </div>)
  
}
