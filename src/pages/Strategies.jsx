// Strategies: playbook library + tactical whiteboard with steps, animation, notes and PNG export.
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { FiCheck, FiCopy, FiDownload, FiPause, FiPlay, FiPlus, FiRotateCcw, FiRotateCw, FiTrash2, FiCompass } from 'react-icons/fi'
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

export default function Strategies({ active }) {
  const [playbooks, setPlaybooks] = useState(null)
  const [loadErr, setLoadErr] = useState(null)
  const [maps, setMaps] = useState(null)
  const [agents, setAgents] = useState(null)
  const [contentErr, setContentErr] = useState(null)
  const [sel, setSel] = useState(null) // {pid, sid}
  const [stepIdx, setStepIdx] = useState(0)
  const [saveState, setSaveState] = useState('saved')
  const [modal, setModal] = useState(null) // {kind:'prompt'|'confirm', ...}
  const [stepEdit, setStepEdit] = useState(null)
  const [anim, setAnim] = useState(null)
  const [playing, setPlaying] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [focusAgent, setFocusAgent] = useState(null) // last picked agent: its abilities sit under the agent grid
  const [, bump] = useState(0)

  const pbsRef = useRef(null)
  const boardRef = useRef(null)
  const hist = useRef({ past: [], future: [], base: null })
  const timers = useRef({})
  const raf = useRef(0)

  // ---- loading
  const loadContent = useCallback(() => {
    setContentErr(null)
    Promise.all([getContent('maps'), getContent('agents?isPlayableCharacter=true')]).then(([m, a]) => {
      setMaps(m.filter(x => x.displayIcon).sort((x, y) => x.displayName.localeCompare(y.displayName)))
      setAgents(a.filter(x => x.isPlayableCharacter !== false).sort((x, y) => x.displayName.localeCompare(y.displayName)))
    }).catch(e => setContentErr(e.message || 'Could not load map data'))
  }, [])
  const loadPlaybooks = useCallback(() => {
    setLoadErr(null)
    invoke('playbooks:list').then(list => {
      pbsRef.current = list; setPlaybooks(list)
      const s = readSel()
      const pb = list.find(p => p.id === s?.pid)
      if (pb?.strategies.some(x => x.id === s.sid)) setSel(s)
      else if (list[0]?.strategies[0]) setSel({ pid: list[0].id, sid: list[0].strategies[0].id })
    }).catch(e => setLoadErr(e.message))
  }, [])
  useEffect(() => { loadContent(); loadPlaybooks() }, [loadContent, loadPlaybooks])
  useEffect(() => { if (sel) writeSel(sel) }, [sel])

  // ---- persistence (debounced autosave, flushed on unmount)
  const persist = useCallback((pid) => {
    const pb = pbsRef.current?.find(p => p.id === pid)
    if (!pb) return Promise.resolve()
    setSaveState('saving')
    return invoke('playbooks:save', pb).then(() => setSaveState('saved')).catch(e => { setSaveState('error'); toast.error('Save failed: ' + e.message) })
  }, [])
  const schedule = useCallback((pid, now) => {
    clearTimeout(timers.current[pid])
    setSaveState('saving')
    timers.current[pid] = setTimeout(() => { delete timers.current[pid]; persist(pid) }, now ? 0 : 700)
  }, [persist])
  useEffect(() => () => {
    cancelAnimationFrame(raf.current); clearTimeout(raf.current)
    Object.keys(timers.current).forEach(pid => { clearTimeout(timers.current[pid]); persist(pid) })
  }, [persist])

  // mutate the playbook list synchronously from the ref so rapid edits never race
  const mutate = useCallback((fn, pids, now) => {
    const next = fn(pbsRef.current || [])
    pbsRef.current = next; setPlaybooks(next)
    ;[].concat(pids).forEach(pid => pid && schedule(pid, now))
  }, [schedule])

  // ---- current selection
  const pb = playbooks?.find(p => p.id === sel?.pid)
  const strat = pb?.strategies.find(s => s.id === sel?.sid)
  const map = maps?.find(m => m.uuid === strat?.mapId)
  const idx = strat ? clamp(stepIdx, 0, strat.steps.length - 1) : 0
  const step = strat?.steps[idx]

  const updateStrat = useCallback((fn, now) => {
    if (!sel) return
    mutate(pbs => pbs.map(p => p.id !== sel.pid ? p : { ...p, strategies: p.strategies.map(s => s.id !== sel.sid ? s : { ...fn(s), updatedAt: Date.now() }) }), sel.pid, now)
  }, [sel, mutate])

  const stopPlay = useCallback(() => { cancelAnimationFrame(raf.current); clearTimeout(raf.current); setPlaying(false); setAnim(null) }, [])
  const resetHist = () => { hist.current = { past: [], future: [], base: null } }
  // Playback stops when you leave the page (it would otherwise keep animating off screen).
  useEffect(() => { if (active === false) stopPlay() }, [active, stopPlay])
  const selectStrategy = (pid, sid) => { stopPlay(); resetHist(); setStepIdx(0); setStepEdit(null); setSel({ pid, sid }) }

  // ---- history-aware edits (snapshots are a strategy's steps)
  const commitSteps = (steps) => {
    const h = hist.current
    h.past.push(strat.steps); if (h.past.length > 100) h.past.shift()
    h.future = []; h.base = null
    updateStrat(s => ({ ...s, steps })); bump(n => n + 1)
  }
  const withItems = (items) => strat.steps.map((st, i) => i === idx ? { ...st, items } : st)
  const H = useRef(); H.current = {
    live: (items) => { const h = hist.current; if (!h.base) h.base = strat.steps; updateStrat(s => ({ ...s, steps: withItems(items) })) },
    end: () => { const h = hist.current; if (h.base) { h.past.push(h.base); h.future = []; h.base = null; bump(n => n + 1) } },
    commit: (items) => commitSteps(withItems(items)),
    undo: () => {
      const h = hist.current; if (!h.past.length || !strat) return
      h.future.push(strat.steps); const steps = h.past.pop()
      updateStrat(s => ({ ...s, steps })); bump(n => n + 1)
    },
    redo: () => {
      const h = hist.current; if (!h.future.length || !strat) return
      h.past.push(strat.steps); const steps = h.future.pop()
      updateStrat(s => ({ ...s, steps })); bump(n => n + 1)
    },
  }
  const onLive = useCallback(i => H.current.live(i), [])
  const onEnd = useCallback(() => H.current.end(), [])
  const onCommit = useCallback(i => H.current.commit(i), [])
  const onUndo = useCallback(() => H.current.undo(), [])
  const onRedo = useCallback(() => H.current.redo(), [])

  // ---- steps
  const addStep = (copy) => {
    const st = { id: uid(), name: copy ? step.name + ' 2' : `Step ${strat.steps.length + 1}`, items: copy ? JSON.parse(JSON.stringify(step.items)) : [] }
    const steps = [...strat.steps]; steps.splice(idx + 1, 0, st)
    commitSteps(steps); setStepIdx(idx + 1)
  }
  const deleteStep = () => {
    if (strat.steps.length < 2) return
    commitSteps(strat.steps.filter((_, i) => i !== idx)); setStepIdx(Math.max(0, idx - 1))
  }
  const renameStep = () => {
    if (!stepEdit) return
    const name = stepEdit.value.trim()
    if (name) updateStrat(s => ({ ...s, steps: s.steps.map((st, i) => i === stepEdit.i ? { ...st, name } : st) }))
    setStepEdit(null)
  }

  // ---- play: tokens glide between consecutive steps
  const play = () => {
    if (playing) { stopPlay(); return }
    const steps = strat.steps
    if (steps.length < 2) { toast('Add a second step to animate between positions'); return }
    let i = idx >= steps.length - 1 ? 0 : idx
    setPlaying(true); setStepIdx(i); setAnim(null)
    // Reduced motion: no glide, each step just holds a little longer before the next one appears.
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

  const shown = !step ? [] : anim ? blend(strat.steps[anim.from].items, strat.steps[anim.to].items, anim.t) : step.items
  const placed = useMemo(() => {
    const c = {}
    ;(step?.items || []).forEach(i => { if (i.type === 'agent') c[i.agentId + i.team] = (c[i.agentId + i.team] || 0) + 1 })
    return c
  }, [step])

  const doExport = async () => {
    setExporting(true)
    try {
      const png = await renderPng({ map, strat, step })
      const res = await invoke('playbooks:exportPng', { dataUrl: png, name: `${strat.name} - ${step.name}` })
      if (res.saved) toast.success('Image saved')
    } catch (e) { toast.error('Export failed: ' + e.message) }
    setExporting(false)
  }

  // ---- library actions
  const defaultMap = () => (maps?.find(m => m.displayName === 'Ascent') || maps?.[0])?.uuid
  const askName = (title, value, onSubmit) => setModal({ kind: 'prompt', title, value, onSubmit })

  const newPlaybookAction = () => askName('New playbook', 'My playbook', name => {
    const p = newPlaybook(name)
    mutate(pbs => [...pbs, p], p.id, true)
  })
  const newStrategyAction = (pid) => {
    if (!maps) { toast('Map data is still loading'); return }
    askName('New strategy', 'New strategy', name => {
      const s = newStrategy(defaultMap(), name)
      mutate(pbs => pbs.map(p => p.id === pid ? { ...p, strategies: [...p.strategies, s] } : p), pid, true)
      selectStrategy(pid, s.id)
    })
  }
  const renameAction = (pid, sid) => {
    const p = playbooks.find(x => x.id === pid), s = sid && p.strategies.find(x => x.id === sid)
    askName(sid ? 'Rename strategy' : 'Rename playbook', (s || p).name, name => {
      mutate(pbs => pbs.map(x => x.id !== pid ? x : sid ? { ...x, strategies: x.strategies.map(y => y.id === sid ? { ...y, name } : y) } : { ...x, name }), pid, true)
    })
  }
  const duplicateAction = (pid, sid) => {
    if (!sid) {
      const p = playbooks.find(x => x.id === pid)
      const copy = { ...p, id: uid(), name: p.name + ' (copy)', strategies: p.strategies.map(cloneStrategy) }
      mutate(pbs => [...pbs, copy], copy.id, true)
    } else {
      const s = cloneStrategy(playbooks.find(x => x.id === pid).strategies.find(y => y.id === sid))
      mutate(pbs => pbs.map(x => x.id === pid ? { ...x, strategies: [...x.strategies, s] } : x), pid, true)
      selectStrategy(pid, s.id)
    }
    toast.success('Duplicated')
  }
  const deleteAction = (pid, sid) => {
    const p = playbooks.find(x => x.id === pid)
    const name = sid ? p.strategies.find(s => s.id === sid).name : p.name
    setModal({
      kind: 'confirm', title: sid ? 'Delete strategy' : 'Delete playbook',
      text: sid ? `"${name}" will be permanently deleted.` : `"${name}" and its ${p.strategies.length} strateg${p.strategies.length === 1 ? 'y' : 'ies'} will be permanently deleted.`,
      onSubmit: async () => {
        if (sel && sel.pid === pid && (!sid || sel.sid === sid)) { stopPlay(); resetHist(); setSel(null) }
        if (sid) mutate(pbs => pbs.map(x => x.id === pid ? { ...x, strategies: x.strategies.filter(s => s.id !== sid) } : x), pid, true)
        else {
          clearTimeout(timers.current[pid]); delete timers.current[pid]
          mutate(pbs => pbs.filter(x => x.id !== pid), null)
          invoke('playbooks:delete', pid).catch(e => toast.error('Delete failed: ' + e.message))
        }
      },
    })
  }

  // ---- render
  const hasPast = hist.current.past.length > 0, hasFuture = hist.current.future.length > 0
  const mapOptions = (maps || []).map(m => ({ value: m.uuid, label: m.displayName }))

  return (
    <div className='h-full flex min-h-0 gap-4 px-5 pb-5 pt-1'>
      <div className='w-[236px] max-[1200px]:w-[204px] shrink-0 min-h-0'>
        {loadErr ? <ErrorState error={loadErr} onRetry={loadPlaybooks} /> : (
          <Library playbooks={playbooks} loading={!playbooks} maps={maps} sel={sel} onSelect={selectStrategy}
            onNewPlaybook={newPlaybookAction} onNewStrategy={newStrategyAction} onRename={renameAction} onDuplicate={duplicateAction} onDelete={deleteAction} />
        )}
      </div>

      <div className='glass flex-1 min-w-0 flex flex-col rounded-[28px] overflow-hidden'>
        {contentErr ? <ErrorState error={contentErr} onRetry={loadContent} /> : !strat ? (
          <div className='flex-1 grid place-items-center'>
            {!playbooks || !maps ? <Skeleton className='h-64 w-64 rounded-2xl' /> : (
              <Empty icon={FiCompass} title={playbooks.length ? 'Pick a strategy' : 'Plan your next round'}
                hint={playbooks.length ? 'Choose a strategy from the library, or start a new one.' : 'Create a playbook, then add strategies to draw on the map board.'}
                action={playbooks.length
                  ? <Button variant='primary' icon={FiPlus} onClick={() => newStrategyAction((pb || playbooks[0]).id)}>New strategy</Button>
                  : <Button variant='primary' icon={FiPlus} onClick={newPlaybookAction}>New playbook</Button>} />
            )}
          </div>
        ) : (
          <>
            <div className='relative flex flex-wrap items-center gap-x-2 gap-y-2 pl-5 pr-3 py-3'>
              <div className='min-w-[110px] flex-1 basis-0'>
                <div className='eyebrow mb-0.5 truncate'>{pb?.name || 'Playbook'}</div>
                <input value={strat.name} onChange={e => updateStrat(s => ({ ...s, name: e.target.value }))} spellCheck={false} aria-label='Strategy name'
                  className='w-full bg-transparent outline-none display text-[24px] leading-tight text-text placeholder:text-muted rounded-lg focus:bg-surface-2/60 -ml-1.5 px-1.5 transition-colors' />
              </div>
              <Select value={strat.mapId} options={mapOptions} onChange={e => updateStrat(s => ({ ...s, mapId: e.target.value }))} className='!w-32 !h-9 rounded-full pl-4' />
              <Tabs tabs={[{ value: 'attack', label: 'Attack' }, { value: 'defense', label: 'Defense' }]} value={strat.side} onChange={side => updateStrat(s => ({ ...s, side }))} layoutId='strat-side' size='sm' />
              <span className={`flex items-center gap-1.5 px-1 text-[12px] font-medium transition-colors ${saveState === 'error' ? 'text-bad' : 'text-muted'}`}>
                {saveState === 'saved' ? <><FiCheck className='text-good' /><span className='hidden min-[1440px]:inline'>Saved</span></> : saveState === 'saving' ? 'Saving...' : 'Not saved'}
              </span>
              <Button variant='ghost' size='sm' icon={FiRotateCcw} onClick={onUndo} disabled={!hasPast || playing} title='Undo (Ctrl+Z)' />
              <Button variant='ghost' size='sm' icon={FiRotateCw} onClick={onRedo} disabled={!hasFuture || playing} title='Redo (Ctrl+Y)' />
              <Button variant='ghost' size='sm' icon={FiTrash2} onClick={() => step.items.length && onCommit([])} disabled={!step.items.length || playing} title='Clear this step'><span className='hidden min-[1440px]:inline'>Clear</span></Button>
              <Button size='sm' icon={FiDownload} loading={exporting} onClick={doExport} disabled={playing} title='Export this step as a PNG image'>PNG</Button>
              <div className='hairline absolute inset-x-5 bottom-0' />
            </div>

            <div className='flex-1 min-h-0 relative'>
              <Board ref={boardRef} items={shown} map={map} side={strat.side} active={active !== false} locked={playing}
                onLive={onLive} onEnd={onEnd} onCommit={onCommit} onUndo={onUndo} onRedo={onRedo} onPickAgent={setFocusAgent} />
              <div className='absolute right-4 top-4 z-10 pointer-events-none max-[1440px]:hidden'><Badge tone={strat.side === 'attack' ? 'bad' : 'accent'}>{map?.displayName || 'Map'} · {strat.side}</Badge></div>
            </div>

            <div className='relative flex items-center gap-2.5 px-4 py-3 overflow-x-auto'>
              <div className='hairline absolute inset-x-5 top-0' />
              <Button size='sm' variant={playing ? 'danger' : 'primary'} icon={playing ? FiPause : FiPlay} onClick={play}>{playing ? 'Stop' : 'Play'}</Button>
              <span className='w-px h-6 bg-line/60 mx-1 shrink-0' />
              <div className='relative flex items-center gap-1.5 stagger'>
                {strat.steps.map((st, i) => (
                  stepEdit?.i === i ? (
                    <Input key={st.id} autoFocus value={stepEdit.value} onChange={e => setStepEdit({ i, value: e.target.value })} onBlur={renameStep}
                      onKeyDown={e => { if (e.key === 'Enter') renameStep(); if (e.key === 'Escape') setStepEdit(null) }} className='w-32 h-8 rounded-full px-3.5' />
                  ) : (
                    <button key={st.id} onClick={() => !playing && setStepIdx(i)} onDoubleClick={() => !playing && setStepEdit({ i, value: st.name })} style={{ '--i': i }}
                      title='Double-click to rename'
                      className={`anim-rise relative h-8 pl-1 pr-3.5 rounded-full flex items-center gap-2 text-xs font-semibold whitespace-nowrap transition-colors duration-200 ${i === idx ? 'accent-soft text-text' : 'glass text-muted hover:text-text hover:bg-surface-2'}`}>
                      <span className={`h-6 w-6 rounded-full grid place-items-center text-[10px] font-bold tabular-nums ${i === idx ? 'accent-fill text-bg' : 'bg-surface-2 border border-line'}`}>{i + 1}</span>{st.name}
                    </button>
                  )
                ))}
              </div>
              <span className='w-px h-6 bg-line/60 mx-1 shrink-0' />
              <Button size='sm' variant='ghost' icon={FiPlus} onClick={() => addStep(false)} disabled={playing} title='Add blank step'><span className='max-[1200px]:hidden'>Step</span></Button>
              <Button size='sm' variant='ghost' icon={FiCopy} onClick={() => addStep(true)} disabled={playing} title='Duplicate this step (tokens keep identity so they animate)'><span className='max-[1200px]:hidden'>Duplicate</span></Button>
              <Button size='sm' variant='ghost' icon={FiTrash2} onClick={deleteStep} disabled={playing || strat.steps.length < 2} title='Delete step' />
            </div>
          </>
        )}
      </div>

      <div className='w-[260px] max-[1200px]:w-[224px] shrink-0 min-h-0'>
        <Palette agents={agents} side={strat?.side || 'attack'} placed={placed} notes={strat?.notes || ''} focus={focusAgent} onFocus={setFocusAgent}
          onNotes={notes => strat && updateStrat(s => ({ ...s, notes }))}
          onPlace={payload => strat && !playing && boardRef.current?.addItem(payload)} />
      </div>

      <PromptModal modal={modal} onClose={() => setModal(null)} />
    </div>
  )
}

function PromptModal({ modal: current, onClose }) {
  const [value, setValue] = useState('')
  useEffect(() => { if (current?.kind === 'prompt') setValue(current.value) }, [current])
  // Keep the last dialog's content while it animates out (the Modal stays mounted with open=false).
  const last = useRef(null)
  if (current) last.current = current
  const modal = current || last.current
  if (!modal) return null
  const submit = () => {
    if (!current) return
    if (modal.kind === 'prompt') { const v = value.trim(); if (!v) return; modal.onSubmit(v) } else modal.onSubmit()
    onClose()
  }
  return (
    <Modal open={!!current} title={modal.title} onClose={onClose} width={400}
      footer={<><Button variant='ghost' onClick={onClose}>Cancel</Button><Button variant={modal.kind === 'confirm' ? 'danger' : 'primary'} onClick={submit}>{modal.kind === 'confirm' ? 'Delete' : 'Save'}</Button></>}>
      {modal.kind === 'prompt'
        ? <Input autoFocus value={value} onChange={e => setValue(e.target.value)} onFocus={e => e.target.select()} onKeyDown={e => e.key === 'Enter' && submit()} />
        : <p className='text-[13px] leading-relaxed text-muted'>{modal.text}</p>}
    </Modal>
  )
}
