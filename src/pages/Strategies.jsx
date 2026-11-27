import { Show, createEffect, createMemo, createSignal, on, onCleanup, onMount } from 'solid-js'
import { st } from '../lib/st.js'
// strategies: playbook library + tactical whiteboard with steps, animation, notes and PNG export
import { FiCheck, FiCopy, FiDownload, FiPause, FiPlay, FiPlus, FiRotateCcw, FiRotateCw, FiTrash2, FiCompass } from 'solid-icons/fi'
import { Badge, Button, Empty, ErrorState, Input, Modal, Select, Skeleton, Tabs, toast } from '../ui'
import { invoke } from '../lib/ipc'
import { getContent } from '../lib/content'
import { prefersReducedMotion } from '../lib/theme'
import Board from './strategies/Board'
import Library from './strategies/Library'
import Palette from './strategies/Palette'
import { blend, clamp, ease, newPlaybook, newStep, newStrategy, renderPng, uid } from './strategies/model'

const LS = 'vd-strategies-sel'
const readSel = () => { try { return JSON.parse(localStorage.getItem(LS)) } catch (e) { return null } }
const writeSel = (s) => { try { localStorage.setItem(LS, JSON.stringify(s)) } catch (e) { /* storage unavailable */ } }
const cloneStrategy = (s) => ({ ...JSON.parse(JSON.stringify(s)), id: uid(), name: s.name + ' (copy)', steps: JSON.parse(JSON.stringify(s.steps)).map(st => ({ ...st, id: uid() })), updatedAt: Date.now() })

export default function Strategies(props) {
  const [playbooksS, setPlaybooks] = createSignal(null)
  const [loadErrS, setLoadErr] = createSignal(null)
  const [mapsS, setMaps] = createSignal(null)
  const [agentsS, setAgents] = createSignal(null)
  const [contentErrS, setContentErr] = createSignal(null)
  const [selS, setSel] = createSignal(null)
  const [stepIdxS, setStepIdx] = createSignal(0)
  const [saveStateS, setSaveState] = createSignal('saved')
  const [modalS, setModal] = createSignal(null)
  const [stepEditS, setStepEdit] = createSignal(null)
  const [animS, setAnim] = createSignal(null)
  const [playingS, setPlaying] = createSignal(false)
  const [exportingS, setExporting] = createSignal(false)
  const [focusAgentS, setFocusAgent] = createSignal(null)
  const [_vS, bump] = createSignal(0)
  const pbsRef = { current: null }
  const boardRef = { current: null }
  const hist = { current: { past: [], future: [], base: null } }
  const timers = { current: {} }
  const raf = { current: 0 }
  onMount(() => { loadContent(); loadPlaybooks() })
  createEffect(on(() => [selS()], () => { if (selS()) writeSel(selS()) }))
  onCleanup(() => {
    cancelAnimationFrame(raf.current); clearTimeout(raf.current)
    Object.keys(timers.current).forEach(pid => { clearTimeout(timers.current[pid]); persist(pid) })
  })
  createEffect(on(() => props.active, a => { if (a === false) stopPlay() }))
  
    const loadContent = () => {
    setContentErr(null)
    Promise.all([getContent('maps'), getContent('agents?isPlayableCharacter=true')]).then(([m, a]) => {
      setMaps(m.filter(x => x.displayIcon).sort((x, y) => x.displayName.localeCompare(y.displayName)))
      setAgents(a.filter(x => x.isPlayableCharacter !== false).sort((x, y) => x.displayName.localeCompare(y.displayName)))
    }).catch(e => setContentErr(e.message || 'Could not load map data'))
  }
    const loadPlaybooks = () => {
    setLoadErr(null)
    invoke('playbooks:list').then(list => {
      pbsRef.current = list; setPlaybooks(list)
      const s = readSel()
      const pb = list.find(p => p.id === s?.pid)
      if (pb?.strategies.some(x => x.id === s.sid)) setSel(s)
      else if (list[0]?.strategies[0]) setSel({ pid: list[0].id, sid: list[0].strategies[0].id })
    }).catch(e => setLoadErr(e.message))
  }
    const persist = (pid) => {
    const pb = pbsRef.current?.find(p => p.id === pid)
    if (!pb) return Promise.resolve()
    setSaveState('saving')
    return invoke('playbooks:save', pb).then(() => setSaveState('saved')).catch(e => { setSaveState('error'); toast.error('Save failed: ' + e.message) })
  }
    const schedule = (pid, now) => {
    clearTimeout(timers.current[pid])
    setSaveState('saving')
    timers.current[pid] = setTimeout(() => { delete timers.current[pid]; persist(pid) }, now ? 0 : 700)
  }
    const mutate = (fn, pids, now) => {
    const next = fn(pbsRef.current || [])
    pbsRef.current = next; setPlaybooks(next)
    ;[].concat(pids).forEach(pid => pid && schedule(pid, now))
  }
    const pb = () => (playbooksS()?.find(p => p.id === selS()?.pid))
    const strat = () => (pb()?.strategies.find(s => s.id === selS()?.sid))
    const map = () => (mapsS()?.find(m => m.uuid === strat()?.mapId))
    const idx = () => (strat() ? clamp(stepIdxS(), 0, strat().steps.length - 1) : 0)
    const step = () => (strat()?.steps[idx()])
    const updateStrat = (fn, now) => {
    if (!selS()) return
    mutate(pbs => pbs.map(p => p.id !== selS().pid ? p : { ...p, strategies: p.strategies.map(s => s.id !== selS().sid ? s : { ...fn(s), updatedAt: Date.now() }) }), selS().pid, now)
  }
    const stopPlay = () => { cancelAnimationFrame(raf.current); clearTimeout(raf.current); setPlaying(false); setAnim(null) }
    const resetHist = () => { hist.current = { past: [], future: [], base: null } }
    const selectStrategy = (pid, sid) => { stopPlay(); resetHist(); setStepIdx(0); setStepEdit(null); setSel({ pid, sid }) }
    const commitSteps = (steps) => {
    const h = hist.current
    h.past.push(strat().steps); if (h.past.length > 100) h.past.shift()
    h.future = []; h.base = null
    updateStrat(s => ({ ...s, steps })); bump(n => n + 1)
  }
    const withItems = (items) => strat().steps.map((st, i) => i === idx() ? { ...st, items } : st)
    const hist_ = () => ({
    live: (items) => { const h = hist.current; if (!h.base) h.base = strat().steps; updateStrat(s => ({ ...s, steps: withItems(items) })) },
    end: () => { const h = hist.current; if (h.base) { h.past.push(h.base); h.future = []; h.base = null; bump(n => n + 1) } },
    commit: (items) => commitSteps(withItems(items)),
    undo: () => {
      const h = hist.current; if (!h.past.length || !strat()) return
      h.future.push(strat().steps); const steps = h.past.pop()
      updateStrat(s => ({ ...s, steps })); bump(n => n + 1)
    },
    redo: () => {
      const h = hist.current; if (!h.future.length || !strat()) return
      h.past.push(strat().steps); const steps = h.future.pop()
      updateStrat(s => ({ ...s, steps })); bump(n => n + 1)
    },
  })
    const onLive = i => hist_().live(i)
    const onEnd = () => hist_().end()
    const onCommit = i => hist_().commit(i)
    const onUndo = () => hist_().undo()
    const onRedo = () => hist_().redo()
    const addStep = (copy) => {
    const st = { id: uid(), name: copy ? step().name + ' 2' : `Step ${strat().steps.length + 1}`, items: copy ? JSON.parse(JSON.stringify(step().items)) : [] }
    const steps = [...strat().steps]; steps.splice(idx() + 1, 0, st)
    commitSteps(steps); setStepIdx(idx() + 1)
  }
    const deleteStep = () => {
    if (strat().steps.length < 2) return
    commitSteps(strat().steps.filter((_, i) => i !== idx())); setStepIdx(Math.max(0, idx() - 1))
  }
    const renameStep = () => {
    if (!stepEditS()) return
    const name = stepEditS().value.trim()
    if (name) updateStrat(s => ({ ...s, steps: s.steps.map((st, i) => i === stepEditS().i ? { ...st, name } : st) }))
    setStepEdit(null)
  }
    const play = () => {
    if (playingS()) { stopPlay(); return }
    const steps = strat().steps
    if (steps.length < 2) { toast('Add a second step to animate between positions'); return }
    let i = idx() >= steps.length - 1 ? 0 : idx()
    setPlaying(true); setStepIdx(i); setAnim(null)
    // reduced motion: no glide, each step just holds a little longer before the next one appears
    const reduce = prefersReducedMotion()
    const HOLD = reduce ? 1100 : 600, MOVE = reduce ? 0 : 1100
    const run = () => {
      const t0 = performance.now()
      const tick = (now) => {
        const dt = now - t0
        if (dt < HOLD) setAnim(null)
        else if (dt < HOLD + MOVE) setAnim({ from: i, to: i + 1, t: ease((dt - HOLD) / MOVE) })
        else {
          i++; setStepIdx(i); setAnim(null)
          if (i >= steps.length - 1) { raf.current = setTimeout(() => setPlaying(false), 700); return }
          run(); return
        }
        raf.current = requestAnimationFrame(tick)
      }
      raf.current = requestAnimationFrame(tick)
    }
    run()
  }
    const shown = () => (!step() ? [] : animS() ? blend(strat().steps[animS().from].items, strat().steps[animS().to].items, animS().t) : step().items)
    const placed = createMemo(() => {
    const c = {}
    ;(step()?.items || []).forEach(i => { if (i.type === 'agent') c[i.agentId + i.team] = (c[i.agentId + i.team] || 0) + 1 })
    return c
  })
    const doExport = async () => {
    setExporting(true)
    try {
      const png = await renderPng({ map: map(), strat: strat(), step: step() })
      const res = await invoke('playbooks:exportPng', { dataUrl: png, name: `${strat().name} - ${step().name}` })
      if (res.saved) toast.success('Image saved')
    } catch (e) { toast.error('Export failed: ' + e.message) }
    setExporting(false)
  }
    const defaultMap = () => (mapsS()?.find(m => m.displayName === 'Ascent') || mapsS()?.[0])?.uuid
    const askName = (title, value, onSubmit) => setModal({ kind: 'prompt', title, value, onSubmit })
    const newPlaybookAction = () => askName('New playbook', 'My playbook', name => {
    const p = newPlaybook(name)
    mutate(pbs => [...pbs, p], p.id, true)
  })
    const newStrategyAction = (pid) => {
    if (!mapsS()) { toast('Map data is still loading'); return }
    askName('New strategy', 'New strategy', name => {
      const s = newStrategy(defaultMap(), name)
      mutate(pbs => pbs.map(p => p.id === pid ? { ...p, strategies: [...p.strategies, s] } : p), pid, true)
      selectStrategy(pid, s.id)
    })
  }
    const renameAction = (pid, sid) => {
    const p = playbooksS().find(x => x.id === pid), s = sid && p.strategies.find(x => x.id === sid)
    askName(sid ? 'Rename strategy' : 'Rename playbook', (s || p).name, name => {
      mutate(pbs => pbs.map(x => x.id !== pid ? x : sid ? { ...x, strategies: x.strategies.map(y => y.id === sid ? { ...y, name } : y) } : { ...x, name }), pid, true)
    })
  }
    const duplicateAction = (pid, sid) => {
    if (!sid) {
      const p = playbooksS().find(x => x.id === pid)
      const copy = { ...p, id: uid(), name: p.name + ' (copy)', strategies: p.strategies.map(cloneStrategy) }
      mutate(pbs => [...pbs, copy], copy.id, true)
    } else {
      const s = cloneStrategy(playbooksS().find(x => x.id === pid).strategies.find(y => y.id === sid))
      mutate(pbs => pbs.map(x => x.id === pid ? { ...x, strategies: [...x.strategies, s] } : x), pid, true)
      selectStrategy(pid, s.id)
    }
    toast.success('Duplicated')
  }
    const deleteAction = (pid, sid) => {
    const p = playbooksS().find(x => x.id === pid)
    const name = sid ? p.strategies.find(s => s.id === sid).name : p.name
    setModal({
      kind: 'confirm', title: sid ? 'Delete strategy' : 'Delete playbook',
      text: sid ? `"${name}" will be permanently deleted.` : `"${name}" and its ${p.strategies.length} strateg${p.strategies.length === 1 ? 'y' : 'ies'} will be permanently deleted.`,
      onSubmit: async () => {
        if (selS() && selS().pid === pid && (!sid || selS().sid === sid)) { stopPlay(); resetHist(); setSel(null) }
        if (sid) mutate(pbs => pbs.map(x => x.id === pid ? { ...x, strategies: x.strategies.filter(s => s.id !== sid) } : x), pid, true)
        else {
          clearTimeout(timers.current[pid]); delete timers.current[pid]
          mutate(pbs => pbs.filter(x => x.id !== pid), null)
          invoke('playbooks:delete', pid).catch(e => toast.error('Delete failed: ' + e.message))
        }
      },
    })
  }
    const hasPast = (() => (_vS(), hist.current.past.length > 0)), hasFuture = (() => (_vS(), hist.current.future.length > 0))
    const mapOptions = () => ((mapsS() || []).map(m => ({ value: m.uuid, label: m.displayName })))
    return (<div class='h-full flex min-h-0 gap-4 px-5 pb-5 pt-1'>
      <div class='w-[236px] max-[1200px]:w-[204px] shrink-0 min-h-0'>
        {loadErrS() ? <ErrorState error={loadErrS()} onRetry={loadPlaybooks} /> : (
          <Library playbooks={playbooksS()} loading={!playbooksS()} maps={mapsS()} sel={selS()} onSelect={selectStrategy}
            onNewPlaybook={newPlaybookAction} onNewStrategy={newStrategyAction} onRename={renameAction} onDuplicate={duplicateAction} onDelete={deleteAction} />
        )}
      </div>

      <div class='glass flex-1 min-w-0 flex flex-col rounded-[28px] overflow-hidden'>
        {contentErrS() ? <ErrorState error={contentErrS()} onRetry={loadContent} /> : !strat() ? (
          <div class='flex-1 grid place-items-center'>
            {!playbooksS() || !mapsS() ? <Skeleton class='h-64 w-64 rounded-2xl' /> : (
              <Empty icon={FiCompass} title={playbooksS().length ? 'Pick a strategy' : 'Plan your next round'}
                hint={playbooksS().length ? 'Choose a strategy from the library, or start a new one.' : 'Create a playbook, then add strategies to draw on the map board.'}
                action={playbooksS().length
                  ? <Button variant='primary' icon={FiPlus} onClick={() => newStrategyAction((pb() || playbooksS()[0]).id)}>New strategy</Button>
                  : <Button variant='primary' icon={FiPlus} onClick={newPlaybookAction}>New playbook</Button>} />
            )}
          </div>
        ) : (
          <>
            <div class='relative flex flex-wrap items-center gap-x-2 gap-y-2 pl-5 pr-3 py-3'>
              <div class='min-w-[110px] flex-1 basis-0'>
                <div class='eyebrow mb-0.5 truncate'>{pb()?.name || 'Playbook'}</div>
                <input value={strat().name} onInput={e => updateStrat(s => ({ ...s, name: e.target.value }))} spellCheck={false} aria-label='Strategy name'
                  class='w-full bg-transparent outline-none display text-[24px] leading-tight text-text placeholder:text-muted rounded-lg focus:bg-surface-2/60 -ml-1.5 px-1.5 transition-colors' />
              </div>
              <Select value={strat().mapId} options={mapOptions()} onChange={e => updateStrat(s => ({ ...s, mapId: e.target.value }))} class='!w-32 !h-9 rounded-full pl-4' />
              <Tabs tabs={[{ value: 'attack', label: 'Attack' }, { value: 'defense', label: 'Defense' }]} value={strat().side} onChange={side => updateStrat(s => ({ ...s, side }))} layoutId='strat-side' size='sm' />
              <span class={`flex items-center gap-1.5 px-1 text-[12px] font-medium transition-colors ${saveStateS() === 'error' ? 'text-bad' : 'text-muted'}`}>
                {saveStateS() === 'saved' ? <><FiCheck class='text-good' /><span class='hidden min-[1440px]:inline'>Saved</span></> : saveStateS() === 'saving' ? 'Saving...' : 'Not saved'}
              </span>
              <Button variant='ghost' size='sm' icon={FiRotateCcw} onClick={onUndo} disabled={!hasPast() || playingS()} title='Undo (Ctrl+Z)' />
              <Button variant='ghost' size='sm' icon={FiRotateCw} onClick={onRedo} disabled={!hasFuture() || playingS()} title='Redo (Ctrl+Y)' />
              <Button variant='ghost' size='sm' icon={FiTrash2} onClick={() => step().items.length && onCommit([])} disabled={!step().items.length || playingS()} title='Clear this step'><span class='hidden min-[1440px]:inline'>Clear</span></Button>
              <Button size='sm' icon={FiDownload} loading={exportingS()} onClick={doExport} disabled={playingS()} title='Export this step as a PNG image'>PNG</Button>
              <div class='hairline absolute inset-x-5 bottom-0' />
            </div>

            <div class='flex-1 min-h-0 relative'>
              <Board ref={el => (boardRef.current = el)} items={shown()} map={map()} side={strat().side} active={props.active !== false} locked={playingS()}
                onLive={onLive} onEnd={onEnd} onCommit={onCommit} onUndo={onUndo} onRedo={onRedo} onPickAgent={setFocusAgent} />
              <div class='absolute right-4 top-4 z-10 pointer-events-none max-[1440px]:hidden'><Badge tone={strat().side === 'attack' ? 'bad' : 'accent'}>{map()?.displayName || 'Map'} · {strat().side}</Badge></div>
            </div>

            <div class='relative flex items-center gap-2.5 px-4 py-3 overflow-x-auto'>
              <div class='hairline absolute inset-x-5 top-0' />
              <Button size='sm' variant={playingS() ? 'danger' : 'primary'} icon={playingS() ? FiPause : FiPlay} onClick={play}>{playingS() ? 'Stop' : 'Play'}</Button>
              <span class='w-px h-6 bg-line/60 mx-1 shrink-0' />
              <div class='relative flex items-center gap-1.5 stagger'>
                {strat().steps.map((stp, i) => (
                  stepEditS()?.i === i ? (
                    <Input autofocus value={stepEditS().value} onInput={e => setStepEdit({ i, value: e.target.value })} onBlur={renameStep}
                      onKeyDown={e => { if (e.key === 'Enter') renameStep(); if (e.key === 'Escape') setStepEdit(null) }} class='w-32 h-8 rounded-full px-3.5' />
                  ) : (
                    <button onClick={() => !playingS() && setStepIdx(i)} onDoubleClick={() => !playingS() && setStepEdit({ i, value: stp.name })} style={st({ '--i': i })}
                      title='Double-click to rename'
                      class={`anim-rise relative h-8 pl-1 pr-3.5 rounded-full flex items-center gap-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${i === idx() ? 'accent-soft text-text' : 'glass text-muted hover:text-text hover:bg-surface-2'}`}>
                      <span class={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold tabular-nums ${i === idx() ? 'accent-fill text-bg' : 'bg-surface-2 border border-line'}`}>{i + 1}</span>{stp.name}
                    </button>
                  )
                ))}
              </div>
              <span class='w-px h-6 bg-line/60 mx-1 shrink-0' />
              <Button size='sm' variant='ghost' icon={FiPlus} onClick={() => addStep(false)} disabled={playingS()} title='Add blank step'><span class='max-[1200px]:hidden'>Step</span></Button>
              <Button size='sm' variant='ghost' icon={FiCopy} onClick={() => addStep(true)} disabled={playingS()} title='Duplicate this step (tokens keep identity so they animate)'><span class='max-[1200px]:hidden'>Duplicate</span></Button>
              <Button size='sm' variant='ghost' icon={FiTrash2} onClick={deleteStep} disabled={playingS() || strat().steps.length < 2} title='Delete step' />
            </div>
          </>
        )}
      </div>

      <div class='w-[260px] max-[1200px]:w-[224px] shrink-0 min-h-0'>
        <Palette agents={agentsS()} side={strat()?.side || 'attack'} placed={placed()} notes={strat()?.notes || ''} focus={focusAgentS()} onFocus={setFocusAgent}
          onNotes={notes => strat() && updateStrat(s => ({ ...s, notes }))}
          onPlace={payload => strat() && !playingS() && boardRef.current?.addItem(payload)} />
      </div>

      <PromptModal modal={modalS()} onClose={() => setModal(null)} />
    </div>)
  
}

function PromptModal(props) {
  const [valueS, setValue] = createSignal('')
  createEffect(on(() => props.modal, m => { if (m?.kind === 'prompt') setValue(m.value) }))
  // keep the last modal's content while it closes
  let last = null
  const modal = createMemo(() => (last = props.modal || last))
  const submit = () => {
    const m = modal()
    if (!props.modal) return
    if (m.kind === 'prompt') { const v = valueS().trim(); if (!v) return; m.onSubmit(v) } else m.onSubmit()
    props.onClose()
  }
  return (
    <Show when={modal()}>
      <Modal open={!!props.modal} title={modal().title} onClose={props.onClose} width={400}
        footer={<><Button variant='ghost' onClick={props.onClose}>Cancel</Button><Button variant={modal().kind === 'confirm' ? 'danger' : 'primary'} onClick={submit}>{modal().kind === 'confirm' ? 'Delete' : 'Save'}</Button></>}>
        {modal().kind === 'prompt'
          ? <Input autofocus value={valueS()} onInput={e => setValue(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => e.key === 'Enter' && submit()} />
          : <p class='text-[13px] leading-relaxed text-muted'>{modal().text}</p>}
      </Modal>
    </Show>
  )
}
