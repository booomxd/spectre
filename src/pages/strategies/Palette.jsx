import { For, createSignal, createMemo } from 'solid-js'
import { st } from '../../lib/st.js'
// right panel: agent tokens, ability icons and strategy notes
import { FiSearch } from 'solid-icons/fi'
import { Empty, Input, Skeleton, Tabs, Textarea } from '../../ui'
import { teamColor } from './model'

function drag(e, payload) {
  e.dataTransfer.setData('text/vd', JSON.stringify(payload))
  e.dataTransfer.effectAllowed = 'copy'
}

// the agent you last picked (here or on the board) keeps its abilities one drag away under the agent grid
export default function Palette(props) {
  const [tabS, setTab] = createSignal('agents')
  const [teamS, setTeam] = createSignal('ally')
  const [qS, setQ] = createSignal('')
  
    const abilityAgent = () => (props.focus), setAbilityAgent = () => (props.onFocus)
    const list = createMemo(() => (props.agents || []).filter(a => a.displayName.toLowerCase().includes(qS().toLowerCase())))
    const ag = () => ((props.agents || []).find(a => a.uuid === abilityAgent()) || props.agents?.[0])
    const picked = () => ((props.agents || []).find(a => a.uuid === props.focus))
    const abilities = () => ((ag()?.abilities || []).filter(a => a.displayIcon))
    const abilityPayload = (a, ab) => ({ type: 'ability', agentId: a.uuid, name: `${a.displayName}: ${ab.displayName}`, icon: ab.displayIcon })
    return (<div class='glass h-full flex flex-col rounded-[28px] overflow-hidden'>
      <div class='p-4 pb-3'>
        <Tabs tabs={[{ value: 'agents', label: 'Agents' }, { value: 'abilities', label: 'Abilities' }, { value: 'notes', label: 'Notes' }]} value={tabS()} onChange={setTab} layoutId='strat-palette' class='w-full [&>button]:flex-1 [&>button]:justify-center' />
      </div>

      {tabS() === 'agents' && (
        <div class='flex-1 min-h-0 flex flex-col px-3.5 pb-3.5 gap-3 anim-fade'>
          <div class='glass-inset flex gap-1 p-1 rounded-full'>
            <For each={['ally', 'enemy']}>{t => (
              <button onClick={() => setTeam(t)}
                class={`flex-1 h-7 rounded-full text-[12px] font-semibold border transition-colors duration-200 ${teamS() === t ? 'text-bg shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]' : 'border-transparent text-muted hover:text-text'}`}
                style={st(teamS() === t ? { background: teamColor(t, props.side), borderColor: teamColor(t, props.side) } : undefined)}>{t === 'ally' ? 'My team' : 'Enemy'}</button>
            )}</For>
          </div>
          <div class='relative'>
            <FiSearch class='absolute left-3 top-1/2 -translate-y-1/2 text-muted text-sm' />
            <Input value={qS()} onInput={e => setQ(e.target.value)} placeholder='Search agents' class='pl-8 !h-9 rounded-full' />
          </div>
          <div class='flex-1 overflow-y-auto -mr-1 pr-1'>
            {!props.agents ? (
              <div class='grid grid-cols-4 gap-2'><For each={Array.from({ length: 16 })}>{(_, i) => <Skeleton class='aspect-square rounded-xl' />}</For></div>
            ) : !list().length ? <Empty title='No agents match' class='py-8' /> : (
              <div class='grid grid-cols-4 gap-2 stagger'>
                <For each={list()}>{(a, i) => {
                  const payload = () => ({ type: 'agent', agentId: a.uuid, name: a.displayName, icon: a.displayIcon, team: teamS() })
                  const n = () => (props.placed[a.uuid + teamS()] || 0)
                  return (
                    <button draggable onDragStart={e => { drag(e, payload()); props.onFocus(a.uuid) }} onClick={() => { props.onPlace(payload()); props.onFocus(a.uuid) }} title={`${a.displayName} - drag onto the map or click`}
                      style={st({ '--i': Math.min(i(), 20) })}
                      class={`glass anim-rise relative aspect-square rounded-2xl overflow-hidden transition-[transform,border-color] duration-150 hover:scale-105 hover:border-accent/60 active:scale-95 ${props.focus === a.uuid ? '!border-accent' : ''}`}>
                      <img decoding='async' src={a.displayIcon} alt='' draggable={false} class='w-full h-full object-cover' />
                      {n() > 0 && <span class='absolute bottom-0.5 right-0.5 min-w-4 h-4 px-1 rounded-full text-[9px] font-bold grid place-items-center text-bg' style={st({ background: teamColor(teamS(), props.side) })}>{n()}</span>}
                    </button>
                  )
                }}</For>
              </div>
            )}
          </div>
          {picked() && (
            <div class='glass-inset rounded-2xl p-2.5 anim-fade'>
              <p class='eyebrow mb-2 truncate'>{picked().displayName} utility</p>
              <div class='grid grid-cols-4 gap-1.5'>
                <For each={(picked().abilities || []).filter(x => x.displayIcon)}>{ab => {
                  const payload = () => (abilityPayload(picked(), ab))
                  return (
                    <button draggable onDragStart={e => drag(e, payload())} onClick={() => props.onPlace(payload())} title={`${ab.displayName} - drag onto the map or click`}
                      class='aspect-square rounded-xl bg-black/60 border border-white/15 grid place-items-center transition-[transform,border-color] duration-150 hover:border-accent/60 hover:-translate-y-0.5 active:scale-95'>
                      <img decoding='async' src={ab.displayIcon} alt={ab.displayName} draggable={false} class='h-6 w-6' />
                    </button>
                  )
                }}</For>
              </div>
            </div>
          )}
        </div>
      )}

      {tabS() === 'abilities' && (
        <div class='flex-1 min-h-0 flex flex-col px-3.5 pb-3.5 gap-3 anim-fade'>
          <div class='flex flex-wrap gap-1.5'>
            <For each={props.agents || []}>{a => (
              <button onClick={() => setAbilityAgent()(a.uuid)} title={a.displayName}
                class={`h-8 w-8 rounded-full overflow-hidden border bg-surface-2 transition duration-200 ${ag()?.uuid === a.uuid ? 'border-accent ring-2 ring-accent/30 scale-110' : 'border-line opacity-60 hover:opacity-100'}`}>
                <img decoding='async' src={a.displayIcon} alt='' draggable={false} class='w-full h-full object-cover' />
              </button>
            )}</For>
          </div>
          {ag() && <p class='eyebrow'>{ag().displayName} abilities</p>}
          <div class='grid grid-cols-2 gap-2 stagger'>
            <For each={abilities()}>{(ab, i) => {
              const payload = () => (abilityPayload(ag(), ab))
              return (
                <button draggable onDragStart={e => drag(e, payload())} onClick={() => props.onPlace(payload())} style={st({ '--i': i() })}
                  class='glass anim-rise flex flex-col items-center gap-2 p-3.5 rounded-2xl transition-[transform,border-color] duration-150 hover:border-accent/60 hover:-translate-y-0.5 active:scale-95'>
                  <span class='h-11 w-11 rounded-full bg-black/60 border border-white/20 grid place-items-center'><img decoding='async' src={ab.displayIcon} alt='' draggable={false} class='h-7 w-7' /></span>
                  <span class='text-[11px] font-medium text-muted leading-tight text-center'>{ab.displayName}</span>
                </button>
              )
            }}</For>
          </div>
        </div>
      )}

      {tabS() === 'notes' && (
        <div class='flex-1 min-h-0 flex flex-col px-3.5 pb-3.5 gap-2.5 anim-fade'>
          <p class='eyebrow'>Strategy notes</p>
          <Textarea value={props.notes} onInput={e => props.onNotes(e.target.value)} placeholder='Calls, timings, utility order, fallbacks...' class='flex-1 leading-relaxed rounded-xl py-2.5' />
        </div>
      )}
    </div>)
  
}
