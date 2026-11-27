import { For, createEffect, createSignal, on, onCleanup, onMount } from 'solid-js'
import { st } from '../../lib/st.js'
// SVG tactical board: map image, drawing tools, agent/ability tokens, zoom + pan, drop target
import { FiArrowUpRight, FiEdit3, FiGrid, FiMapPin, FiMaximize, FiMinus, FiMousePointer, FiPlus, FiRotateCw, FiSquare, FiType } from 'solid-icons/fi'
import { RiDesignEraserLine as RiEraserLine } from 'solid-icons/ri'
import { COLORS, SIZE, TOKEN_R, WIDTHS, arrowHead, bbox, clamp, isToken, moveItem, penPath, snapVal, teamColor, uid } from './model'
import { KIND_COLOR, ppmOf, utilGeom } from './utility'

// view rotation (degrees, around the board centre)
const turn = (x, y, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - SIZE / 2, dy = y - SIZE / 2; return [SIZE / 2 + dx * c - dy * s, SIZE / 2 + dx * s + dy * c] }
// callout positions: valorant-api maps game units to 0..1 minimap space
const calloutsOf = (map) => !map?.callouts || !map.xMultiplier ? [] : map.callouts.map(c => ({ name: c.regionName, x: (c.location.y * map.xMultiplier + map.xScalarToAdd) * SIZE, y: (c.location.x * map.yMultiplier + map.yScalarToAdd) * SIZE }))

const TOOLS = [
  { id: 'select', icon: FiMousePointer, label: 'Select / move (V)', key: 'v' },
  { id: 'pen', icon: FiEdit3, label: 'Pen (P)', key: 'p' },
  { id: 'line', icon: FiMinus, label: 'Line (L)', key: 'l' },
  { id: 'arrow', icon: FiArrowUpRight, label: 'Arrow (A)', key: 'a' },
  { id: 'rect', icon: FiSquare, label: 'Area (R)', key: 'r' },
  { id: 'text', icon: FiType, label: 'Text (T)', key: 't' },
  { id: 'eraser', icon: RiEraserLine, label: 'Eraser (E)', key: 'e' },
]
const CURSOR = { select: 'default', pen: 'crosshair', line: 'crosshair', arrow: 'crosshair', rect: 'crosshair', text: 'text', eraser: 'cell' }
const isTyping = (t) => t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
// React-style effect: no deps runs once on mount, deps re-run it; a returned function is its cleanup
const useFx = (fn, deps) => {
  const run = () => { const c = fn(); if (typeof c === 'function') onCleanup(c) }
  if (deps) createEffect(on(deps, run))
  else onMount(run)
}
const baseFit = (el) => Math.min(el?.clientWidth || 1, el?.clientHeight || 1) / SIZE * 0.94

function Shape(props) {
  return () => {
    const sw = props.it.width || 4
    const common = { stroke: props.it.color, 'stroke-width': sw, fill: 'none', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }
    const op = props.it._op ?? 1
    let body = null
    if (props.it.type === 'pen') {
    const d = penPath(props.it.points)
    body = <><path d={d} {...common} /><path d={d} stroke='transparent' stroke-width={Math.max(sw, 16)} fill='none' stroke-linecap='round' pointer-events={props.hit ? 'stroke' : 'none'} /></>
  } else if (props.it.type === 'line' || props.it.type === 'arrow') {
    const h = props.it.type === 'arrow' ? arrowHead(props.it.x1, props.it.y1, props.it.x2, props.it.y2, sw) : null
    body = <>
      <line x1={props.it.x1} y1={props.it.y1} x2={props.it.x2} y2={props.it.y2} {...common} />
      {h && <polygon points={h.map(p => p.join(',')).join(' ')} fill={props.it.color} stroke={props.it.color} stroke-width={1} stroke-linejoin='round' />}
      <line x1={props.it.x1} y1={props.it.y1} x2={props.it.x2} y2={props.it.y2} stroke='transparent' stroke-width={Math.max(sw, 16)} pointer-events={props.hit ? 'stroke' : 'none'} />
    </>
  } else if (props.it.type === 'rect') {
    const x = Math.min(props.it.x, props.it.x + props.it.w), y = Math.min(props.it.y, props.it.y + props.it.h)
    body = <rect x={x} y={y} width={Math.abs(props.it.w)} height={Math.abs(props.it.h)} rx={4} stroke={props.it.color} stroke-width={sw} fill={props.it.color} fill-opacity={0.18} pointer-events={props.hit ? 'all' : 'none'} />
  } else if (props.it.type === 'text') {
    body = <text x={props.it.x} y={props.it.y} transform={(props.vr ?? 0) ? `rotate(${-(props.vr ?? 0)} ${props.it.x} ${props.it.y})` : undefined} fill={props.it.color} font-size={props.it.size || 28} font-weight={700} stroke='rgba(0,0,0,.85)' stroke-width={6} paint-order='stroke' stroke-linejoin='round' pointer-events={props.hit ? 'all' : 'none'} style={st({ userSelect: 'none' })}>{props.it.text}</text>
  } else if (props.it.type === 'agent') {
    const ring = teamColor(props.it.team, props.side)
    body = <g transform={`translate(${props.it.x} ${props.it.y}) rotate(${-(props.vr ?? 0)})`} pointer-events={props.hit ? 'all' : 'none'}>
      <circle r={TOKEN_R + 5} fill='none' stroke={ring} stroke-opacity={0.25} stroke-width={2} />
      <circle r={TOKEN_R} fill='#111' stroke={ring} stroke-width={4} />
      <image href={props.it.icon} x={-24} y={-24} width={48} height={48} clip-path='url(#vd-clip)' preserveAspectRatio='xMidYMid slice' />
      <title>{props.it.name}{props.it.team === 'enemy' ? ' (enemy)' : ''}</title>
    </g>
  } else if (props.it.type === 'ability') {
    const g = utilGeom(props.it, (props.ppm ?? 7)), col = g && KIND_COLOR[g.kind]
    const r = g ? 12 : 24, ic = g ? 17 : 34
    body = <>
      {g?.shape === 'circle' && <circle cx={props.it.x} cy={props.it.y} r={g.r} fill={col} fill-opacity={g.kind === 'smoke' ? 0.42 : g.kind === 'reveal' ? 0.08 : 0.24}
        stroke={col} stroke-opacity={0.85} stroke-width={2} stroke-dasharray={g.kind === 'reveal' ? '8 6' : undefined} pointer-events='none' />}
      {g?.shape === 'beam' && <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={col} stroke-opacity={g.w > 12 ? 0.26 : 0.8} stroke-width={g.w} stroke-linecap={g.w > 12 ? 'butt' : 'round'} pointer-events='none' />}
      <g transform={`translate(${props.it.x} ${props.it.y}) rotate(${-(props.vr ?? 0)})`} pointer-events={props.hit ? 'all' : 'none'}>
        <circle r={r} fill='rgba(10,10,14,.82)' stroke={col || 'rgba(255,255,255,.5)'} stroke-width={2} />
        <image href={props.it.icon} x={-ic / 2} y={-ic / 2} width={ic} height={ic} />
        <title>{props.it.name}</title>
      </g>
    </>
  }
    return <g data-id={props.it.id} opacity={op} class={isToken(props.it) && props.hit ? 'transition-[filter] duration-150 hover:brightness-125' : undefined}>{body}</g>
  }
}

const Board = function Board(props) {
  const wrap = { current: null }
  const svg = { current: null }
  const [view, setView] = createSignal({ x: 0, y: 0, k: 0.6 })
  const [tool, setTool] = createSignal('pen')
  const [color, setColor] = createSignal(COLORS[1])
  const [width, setWidth] = createSignal(WIDTHS[1])
  const [snap, setSnap] = createSignal(true)
  const [sel, setSel] = createSignal(null)
  const [draft, setDraft] = createSignal(null)
  const [edit, setEdit] = createSignal(null) // text editor {id, bx, by, value}
  const [panning, setPanning] = createSignal(false)
  const [vr, setVr] = createSignal(0) // view rotation
  const [callouts, setCallouts] = createSignal(true)
  const [narrow, setNarrow] = createSignal(false) // board narrower than the full style pill + hint: compact chrome
  const S = { current: { touched: false, space: false, pan: null, drag: null, erased: null, drawing: false, draft: null } }
  const P = { get current() { return { items: props.items, side: props.side, view: view(), tool: tool(), color: color(), width: width(), snap: snap(), locked: props.locked, vr: vr() } } }; 
  const ppm = () => (ppmOf(props.map))
  const calls = () => (callouts() ? calloutsOf(props.map) : [])

  const fit = () => {
    const el = wrap.current; if (!el) return
    const w = el.clientWidth, h = el.clientHeight
    if (!w || !h) return
    const k = baseFit(el)
    setView({ k, x: (w - SIZE * k) / 2, y: (h - SIZE * k) / 2 })
    S.current.touched = false
  }

  useFx(() => { fit() }, () => [props.map?.uuid, fit])
  useFx(() => {
    const ro = new ResizeObserver(() => {
      const w = wrap.current?.clientWidth
      if (w) setNarrow(w < 640)
      if (!S.current.touched) fit()
    })
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, () => [fit])

  const toBoard = (e) => {
    const r = svg.current.getBoundingClientRect(), v = P.current.view
    return turn((e.clientX - r.left - v.x) / v.k, (e.clientY - r.top - v.y) / v.k, -P.current.vr)
  }

  // wheel zoom around the cursor
  useFx(() => {
    const el = svg.current
    const onWheel = (e) => {
      e.preventDefault()
      S.current.touched = true
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
      setView(v => {
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.0015), 0.25, 6)
        return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  })

  const zoomBy = (f) => {
    const el = wrap.current, mx = el.clientWidth / 2, my = el.clientHeight / 2
    S.current.touched = true
    setView(v => { const k = clamp(v.k * f, 0.25, 6); return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) } })
  }

  const api = (() => ({
    // adds a palette item at the center of the visible area
    addItem(payload, at) {
      const { view: v, items: its, snap: sn } = P.current
      const el = wrap.current
      let [x, y] = at || turn((el.clientWidth / 2 - v.x) / v.k, (el.clientHeight / 2 - v.y) / v.k, -P.current.vr)
      if (!at) { const n = its.filter(isToken).length; x += (n % 5) * 30 - 60; y += Math.floor(n / 5) % 3 * 34 }
      x = clamp(x, 20, SIZE - 20); y = clamp(y, 20, SIZE - 20)
      if (sn) { x = snapVal(x); y = snapVal(y) }
      const it = { id: uid(), x, y, ...payload }
      props.onCommit([...its, it]); setSel(it.id)
    },
  }))(); props.ref?.(api)

  // keyboard: tools, delete, undo/redo, space-to-pan
  useFx(() => {
    if (!props.active) return
    const down = (e) => {
      if (isTyping(e.target)) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? props.onRedo() : props.onUndo(); return }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); props.onRedo(); return }
      if ((e.ctrlKey || e.metaKey) && k === 'd' && sel() && !P.current.locked) {
        e.preventDefault()
        const o = P.current.items.find(i => i.id === sel()); if (!o) return
        const c = { ...moveItem(o, 24, 24, false), id: uid() }
        props.onCommit([...P.current.items, c]); setSel(c.id); return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const nud = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k]
      if (nud && sel() && !P.current.locked) {
        e.preventDefault()
        const step = e.shiftKey ? 20 : 4
        const [dx, dy] = turn(SIZE / 2 + nud[0] * step, SIZE / 2 + nud[1] * step, -P.current.vr).map(v => v - SIZE / 2)
        props.onCommit(P.current.items.map(i => i.id === sel() ? moveItem(i, dx, dy, false) : i)); return
      }
      if (e.code === 'Space') { e.preventDefault(); S.current.space = true; return }
      if (k === 'escape') { setSel(null); setDraft(null); setEdit(null); return }
      if ((k === 'delete' || k === 'backspace') && sel() && !P.current.locked) { e.preventDefault(); props.onCommit(P.current.items.filter(i => i.id !== sel())); setSel(null); return }
      const t = TOOLS.find(t => t.key === k)
      if (t) setTool(t.id)
    }
    const up = (e) => { if (e.code === 'Space') S.current.space = false }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, () => [props.active, sel(), props.onUndo, props.onRedo, props.onCommit])

  useFx(() => { setSel(null); setEdit(null) }, () => [props.map?.uuid, props.locked])
  // selecting an agent (or one of its abilities) on the board shows that agent's abilities in the side panel
  useFx(() => { const it = props.items.find(i => i.id === sel()); if (it?.agentId) props.onPickAgent?.(it.agentId) }, () => [sel()]) // eslint-disable-line react-hooks/exhaustive-deps

  const erase = (e) => {
    const s = S.current
    const id = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-id]')?.getAttribute('data-id')
    if (!id || s.erased.has(id)) return
    s.erased.add(id)
    props.onLive(P.current.items.filter(i => !s.erased.has(i.id)))
  }

  const onPointerDown = (e) => {
    const s = S.current
    if (P.current.locked || edit()) return
    if (e.target.closest?.('[data-del]')) { props.onCommit(P.current.items.filter(i => i.id !== sel())); setSel(null); return }
    if (e.button === 1 || s.space) {
      e.preventDefault(); svg.current.setPointerCapture(e.pointerId)
      s.touched = true
      s.pan = { sx: e.clientX, sy: e.clientY, vx: P.current.view.x, vy: P.current.view.y }; setPanning(true); return
    }
    if (e.button !== 0) return
    const [x, y] = toBoard(e), { tool: t, color: c, width: w } = P.current
    if (t === 'select' && e.target.closest?.('[data-rot]')) {
      svg.current.setPointerCapture(e.pointerId)
      s.rot = { id: sel(), moved: false }; return
    }
    if (t === 'select') {
      const id = e.target.closest?.('[data-id]')?.getAttribute('data-id')
      setSel(id || null)
      if (id) {
        svg.current.setPointerCapture(e.pointerId)
        s.drag = { id, sx: x, sy: y, orig: P.current.items.find(i => i.id === id), moved: false }
      }
    } else if (t === 'eraser') {
      s.erased = new Set(); erase(e)
    } else if (t === 'text') {
      e.preventDefault()
      setEdit({ id: null, bx: x, by: y, value: '' })
    } else {
      svg.current.setPointerCapture(e.pointerId)
      s.drawing = true
      const d = t === 'pen' ? { type: 'pen', points: [[x, y]] }
        : t === 'rect' ? { type: 'rect', x, y, w: 0, h: 0 }
          : { type: t, x1: x, y1: y, x2: x, y2: y }
      s.draft = { id: uid(), color: c, width: w, ...d }
      setDraft(s.draft)
    }
  }

  const onPointerMove = (e) => {
    const s = S.current
    if (s.pan) { setView(v => ({ ...v, x: s.pan.vx + e.clientX - s.pan.sx, y: s.pan.vy + e.clientY - s.pan.sy })); return }
    if (s.erased && e.buttons & 1) { erase(e); return }
    if (s.rot) {
      const [x, y] = toBoard(e), o = P.current.items.find(i => i.id === s.rot.id); if (!o) return
      let a = Math.atan2(y - o.y, x - o.x)
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12)
      s.rot.moved = true
      props.onLive(P.current.items.map(i => i.id === o.id ? { ...i, rot: a } : i)); return
    }
    if (s.drag) {
      const [x, y] = toBoard(e), d = s.drag
      const dx = x - d.sx, dy = y - d.sy
      if (!d.moved && Math.hypot(dx, dy) * P.current.view.k < 3) return
      d.moved = true
      const o = d.orig
      let moved = moveItem(o, dx, dy, P.current.snap)
      if (isToken(o)) moved = { ...moved, x: clamp(moved.x, 10, SIZE - 10), y: clamp(moved.y, 10, SIZE - 10) }
      props.onLive(P.current.items.map(i => i.id === d.id ? moved : i))
      return
    }
    if (s.drawing && s.draft) {
      const [x, y] = toBoard(e), d = s.draft
      if (d.type === 'pen') {
        const l = d.points[d.points.length - 1]
        if (Math.hypot(x - l[0], y - l[1]) * P.current.view.k < 3) return
        s.draft = { ...d, points: [...d.points, [x, y]] }
      } else if (d.type === 'rect') s.draft = { ...d, w: x - d.x, h: y - d.y }
      else {
        let ex = x, ey = y
        if (e.shiftKey) { // 45 degree steps
          const a = Math.round(Math.atan2(y - d.y1, x - d.x1) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(x - d.x1, y - d.y1)
          ex = d.x1 + Math.cos(a) * len; ey = d.y1 + Math.sin(a) * len
        }
        s.draft = { ...d, x2: ex, y2: ey }
      }
      setDraft(s.draft)
    }
  }

  const onPointerUp = (e) => {
    const s = S.current
    try { svg.current.releasePointerCapture(e.pointerId) } catch (err) { /* not captured */ }
    if (s.pan) { s.pan = null; setPanning(false); return }
    if (s.rot) { const m = s.rot.moved; s.rot = null; if (m) props.onEnd(); return }
    if (s.erased) { const had = s.erased.size; s.erased = null; if (had) props.onEnd(); return }
    if (s.drag) { const m = s.drag.moved; s.drag = null; if (m) props.onEnd(); return }
    if (s.drawing) {
      s.drawing = false
      const d = s.draft; s.draft = null; setDraft(null)
      if (!d) return
      const ok = d.type === 'pen' ? true
        : d.type === 'rect' ? Math.abs(d.w) > 6 && Math.abs(d.h) > 6
          : Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 8
      if (ok) props.onCommit([...P.current.items, d])
    }
  }

  const finishEdit = (commit) => {
    const ed = edit(); setEdit(null)
    if (!ed || !commit) return
    const text = ed.value.trim()
    const its = P.current.items
    if (ed.id) props.onCommit(text ? its.map(i => i.id === ed.id ? { ...i, text } : i) : its.filter(i => i.id !== ed.id))
    else if (text) props.onCommit([...its, { id: uid(), type: 'text', x: ed.bx, y: ed.by, text, color: color(), size: 18 + width() * 3 }])
  }

  const onDoubleClick = (e) => {
    if (tool() !== 'select' || props.locked) return
    const id = e.target.closest?.('[data-id]')?.getAttribute('data-id')
    const it = props.items.find(i => i.id === id)
    if (it?.type === 'text') setEdit({ id, bx: it.x, by: it.y, value: it.text })
  }

  const onDrop = (e) => {
    e.preventDefault()
    let p; try { p = JSON.parse(e.dataTransfer.getData('text/vd')) } catch (err) { return }
    if (!p || props.locked) return
    api?.addItem(p, toBoard(e))
  }

  const selItem = () => (props.items.find(i => i.id === sel()))
  const sb = () => (selItem() && bbox(selItem()))
  const cursor = () => (panning() ? 'grabbing' : props.locked ? 'default' : CURSOR[tool()])
  const zoomPct = () => (Math.round(view().k / baseFit(wrap.current) * 100))
  const hit = () => (!props.locked && (tool() === 'select' || tool() === 'eraser'))

  return (
    <div ref={el => (wrap.current = el)} class='relative h-full w-full overflow-hidden select-none'
      style={st({ background: 'radial-gradient(circle at 50% 40%, rgb(var(--surface-2) / var(--surface-2-a)) 0%, transparent 75%)' })}
      onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <svg ref={el => (svg.current = el)} class='absolute inset-0 w-full h-full touch-none' style={st({ cursor: cursor() })}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick}
        onAuxClick={e => e.preventDefault()}>
        <defs><clipPath id='vd-clip'><circle r={TOKEN_R - 4} /></clipPath></defs>
        <g transform={`translate(${view().x} ${view().y}) scale(${view().k}) rotate(${vr()} ${SIZE / 2} ${SIZE / 2})`}>
          <rect width={SIZE} height={SIZE} rx={14} fill='#0e0e13' />
          {props.map?.displayIcon && <image href={props.map.displayIcon} width={SIZE} height={SIZE} />}
          <rect width={SIZE} height={SIZE} rx={14} fill='none' stroke='rgba(255,255,255,.12)' stroke-width={2} />
          <For each={calls()}>{(c, i) => (
            <text x={c.x} y={c.y} transform={vr() ? `rotate(${-vr()} ${c.x} ${c.y})` : undefined} text-anchor='middle' dominant-baseline='middle'
              font-size={13} font-weight={700} fill='rgba(255,255,255,.78)' stroke='rgba(0,0,0,.8)' stroke-width={3.5} paint-order='stroke' pointer-events='none' style={st({ userSelect: 'none' })}>{c.name}</text>
          )}</For>
          <For each={props.items}>{it => <Shape it={it} side={props.side} ppm={ppm()} vr={vr()} hit={hit() || (tool() === 'select' && !props.locked)} />}</For>
          {draft() && <Shape it={draft()} side={props.side} ppm={ppm()} vr={vr()} />}
          {sb() && !props.locked && tool() === 'select' && (
            <g>
              <rect x={sb()[0] - 8} y={sb()[1] - 8} width={sb()[2] - sb()[0] + 16} height={sb()[3] - sb()[1] + 16} rx={8} fill='none' stroke='rgb(var(--accent))' stroke-width={2 / view().k} stroke-dasharray={`${6 / view().k} ${4 / view().k}`} pointer-events='none' />
              <g data-del transform={`translate(${sb()[2] + 8} ${sb()[1] - 8}) scale(${1 / view().k})`} style={st({ cursor: 'pointer' })}>
                <circle r={10} fill='#ff4655' /><path d='M-4 -4L4 4M4 -4L-4 4' stroke='#fff' stroke-width={2} stroke-linecap='round' />
              </g>
              {(() => {
                const g = utilGeom(selItem(), ppm())
                return g?.shape === 'beam' && (
                  <g data-rot transform={`translate(${g.x2} ${g.y2}) scale(${1 / view().k})`} style={st({ cursor: 'grab' })}>
                    <title>Drag to aim (Shift snaps)</title>
                    <circle r={9} fill='rgb(var(--accent))' stroke='#fff' stroke-width={2} />
                  </g>
                )
              })()}
            </g>
          )}
        </g>
      </svg>

      {edit() && (
        <input autofocus value={edit().value} onInput={e => setEdit({ ...edit(), value: e.target.value })}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') finishEdit(true); if (e.key === 'Escape') finishEdit(false) }}
          onBlur={() => finishEdit(true)} placeholder='Label'
          class='glass-strong absolute z-20 !border-accent/60 rounded-lg px-2 outline-none text-text font-bold'
          style={st({ left: view().x + turn(edit().bx, edit().by, vr())[0] * view().k, top: view().y + turn(edit().bx, edit().by, vr())[1] * view().k - (18 + width() * 3) * view().k, fontSize: Math.max(13, (18 + width() * 3) * view().k), minWidth: 90 })} />
      )}

      {/* tool rail */}
      <div class='glass-strong absolute left-4 top-4 z-10 flex flex-col gap-1 p-1.5 rounded-2xl anim-fade'>
        <For each={TOOLS}>{t => (
          <button title={t.label} onClick={() => setTool(t.id)} disabled={props.locked}
            class={`h-9 w-9 rounded-xl grid place-items-center text-[17px] transition duration-150 active:scale-90 disabled:opacity-40 ${tool() === t.id ? 'accent-fill text-bg' : 'text-muted hover:text-text hover:bg-surface-2'}`}>
            <t.icon />
          </button>
        )}</For>
      </div>

      {/* style pill */}
      <div class={`glass-strong absolute top-4 z-10 flex items-center h-11 rounded-full anim-fade ${narrow() ? 'left-[68px] gap-2 pl-3 pr-1' : 'left-1/2 -translate-x-1/2 gap-3 pl-4 pr-1.5'}`}>
        <div class={`flex items-center ${narrow() ? 'gap-1' : 'gap-1.5'}`}>
          <For each={COLORS}>{c => (
            <button onClick={() => setColor(c)} title={c}
              class={`h-5 w-5 rounded-full transition-transform duration-150 hover:scale-110 ${color() === c ? 'ring-2 ring-offset-2 ring-offset-panel ring-text/80 scale-110' : 'shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]'}`} style={st({ background: c })} />
          )}</For>
        </div>
        <span class='w-px h-5 bg-line/60' />
        <div class='flex items-center gap-0.5'>
          <For each={WIDTHS}>{w => (
            <button onClick={() => setWidth(w)} title={`Stroke ${w}`}
              class={`h-8 w-8 rounded-full grid place-items-center transition-colors ${width() === w ? 'accent-soft' : 'hover:bg-surface-2'}`}>
              <span class='rounded-full bg-text' style={st({ width: w + 3, height: w + 3 })} />
            </button>
          )}</For>
        </div>
        <span class='w-px h-5 bg-line/60' />
        <button onClick={() => setSnap(s => !s)} title='Snap tokens to grid' aria-pressed={snap()} aria-label='Snap tokens to grid'
          class={`h-8 rounded-full flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${narrow() ? 'w-8 justify-center' : 'px-3'} ${snap() ? 'accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2'}`}><FiGrid />{!narrow() && 'Snap'}</button>
      </div>

      {/* zoom */}
      <div class='glass-strong absolute right-4 bottom-4 z-10 flex items-center gap-0.5 p-1 rounded-full'>
        <button class='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => zoomBy(1 / 1.25)} title='Zoom out'><FiMinus /></button>
        <span class='w-11 text-center text-[11px] tabular-nums text-muted'>{zoomPct()}%</span>
        <button class='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => zoomBy(1.25)} title='Zoom in'><FiPlus /></button>
        <button class='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={fit} title='Fit to view'><FiMaximize /></button>
        <span class='w-px h-5 bg-line/60 mx-0.5' />
        <button class='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => setVr(r => (r + 90) % 360)} title='Rotate map 90°'><FiRotateCw /></button>
        <button class={`h-8 w-8 grid place-items-center rounded-full transition-colors ${callouts() ? 'accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2'}`} onClick={() => setCallouts(v => !v)} aria-pressed={callouts()} title='Callout labels'><FiMapPin /></button>
      </div>
      {!narrow() && <div class='absolute left-4 bottom-4 z-10 text-[11px] text-muted/80 pointer-events-none'>Wheel zoom · Space-drag to pan · Ctrl+D duplicate · Arrows nudge · Drag the dot to aim walls</div>}
    </div>
  )
}

export default Board
