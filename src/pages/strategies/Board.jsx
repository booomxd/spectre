// SVG tactical board: map image, drawing tools, agent/ability tokens, zoom + pan, drop target.
import { forwardRef, useCallback, useEffect, useImperativeHandle, useLayoutEffect, useRef, useState } from 'react'
import { FiArrowUpRight, FiEdit3, FiGrid, FiMapPin, FiMaximize, FiMinus, FiMousePointer, FiPlus, FiRotateCw, FiSquare, FiType } from 'react-icons/fi'
import { RiEraserLine } from 'react-icons/ri'
import { COLORS, SIZE, TOKEN_R, WIDTHS, arrowHead, bbox, clamp, isToken, moveItem, penPath, pivot, snapVal, teamColor, uid, xform } from './model'
import { KIND_COLOR, ppmOf, utilGeom } from './utility'

// View rotation (degrees, around the board centre). Items keep board coordinates; only the view turns.
const turn = (x, y, deg) => { const a = deg * Math.PI / 180, c = Math.cos(a), s = Math.sin(a), dx = x - SIZE / 2, dy = y - SIZE / 2; return [SIZE / 2 + dx * c - dy * s, SIZE / 2 + dx * s + dy * c] }
// Callout positions: valorant-api maps game units to 0..1 minimap space (x from game Y, y from game X).
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
const baseFit = (el) => Math.min(el?.clientWidth || 1, el?.clientHeight || 1) / SIZE * 0.94

function Shape({ it, side, hit, ppm = 7, vr = 0 }) {
  const sw = it.width || 4
  const common = { stroke: it.color, strokeWidth: sw, fill: 'none', strokeLinecap: 'round', strokeLinejoin: 'round' }
  const op = it._op ?? 1
  let body = null
  if (it.type === 'pen') {
    const d = penPath(it.points)
    body = <><path d={d} {...common} /><path d={d} stroke='transparent' strokeWidth={Math.max(sw, 16)} fill='none' strokeLinecap='round' pointerEvents={hit ? 'stroke' : 'none'} /></>
  } else if (it.type === 'line' || it.type === 'arrow') {
    const h = it.type === 'arrow' ? arrowHead(it.x1, it.y1, it.x2, it.y2, sw) : null
    body = <>
      <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} {...common} />
      {h && <polygon points={h.map(p => p.join(',')).join(' ')} fill={it.color} stroke={it.color} strokeWidth={1} strokeLinejoin='round' />}
      <line x1={it.x1} y1={it.y1} x2={it.x2} y2={it.y2} stroke='transparent' strokeWidth={Math.max(sw, 16)} pointerEvents={hit ? 'stroke' : 'none'} />
    </>
  } else if (it.type === 'rect') {
    const x = Math.min(it.x, it.x + it.w), y = Math.min(it.y, it.y + it.h)
    body = <rect x={x} y={y} width={Math.abs(it.w)} height={Math.abs(it.h)} rx={4} stroke={it.color} strokeWidth={sw} fill={it.color} fillOpacity={0.18} pointerEvents={hit ? 'all' : 'none'} />
  } else if (it.type === 'text') {
    body = <text x={it.x} y={it.y} transform={vr ? `rotate(${-vr} ${it.x} ${it.y})` : undefined} fill={it.color} fontSize={it.size || 28} fontWeight={700} stroke='rgba(0,0,0,.85)' strokeWidth={6} paintOrder='stroke' strokeLinejoin='round' pointerEvents={hit ? 'all' : 'none'} style={{ userSelect: 'none' }}>{it.text}</text>
  } else if (it.type === 'agent') {
    const ring = teamColor(it.team, side)
    body = <g transform={`translate(${it.x} ${it.y}) rotate(${-vr})`} pointerEvents={hit ? 'all' : 'none'}>
      <circle r={TOKEN_R + 5} fill='none' stroke={ring} strokeOpacity={0.25} strokeWidth={2} />
      <circle r={TOKEN_R} fill='#111' stroke={ring} strokeWidth={4} />
      <image href={it.icon} x={-24} y={-24} width={48} height={48} clipPath='url(#vd-clip)' preserveAspectRatio='xMidYMid slice' />
      <title>{it.name}{it.team === 'enemy' ? ' (enemy)' : ''}</title>
    </g>
  } else if (it.type === 'ability') {
    const g = utilGeom(it, ppm), col = g && KIND_COLOR[g.kind]
    const r = g ? 12 : 24, ic = g ? 17 : 34
    body = <>
      {g?.shape === 'circle' && <circle cx={it.x} cy={it.y} r={g.r} fill={col} fillOpacity={g.kind === 'smoke' ? 0.42 : g.kind === 'reveal' ? 0.08 : 0.24}
        stroke={col} strokeOpacity={0.85} strokeWidth={2} strokeDasharray={g.kind === 'reveal' ? '8 6' : undefined} pointerEvents='none' />}
      {g?.shape === 'beam' && <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke={col} strokeOpacity={g.w > 12 ? 0.26 : 0.8} strokeWidth={g.w} strokeLinecap={g.w > 12 ? 'butt' : 'round'} pointerEvents='none' />}
      <g transform={`translate(${it.x} ${it.y}) rotate(${-vr}) scale(${g ? it.sc ?? 1 : 1})`} pointerEvents={hit ? 'all' : 'none'}>
        <circle r={r} fill='rgba(10,10,14,.82)' stroke={col || 'rgba(255,255,255,.5)'} strokeWidth={2} />
        <image href={it.icon} x={-ic / 2} y={-ic / 2} width={ic} height={ic} />
        <title>{it.name}</title>
      </g>
    </>
  }
  // Scaled utility keeps its to-scale area; only its icon grows (handled above). Everything else turns and scales as a whole.
  const tf = it.type === 'ability' && utilGeom(it, ppm) ? undefined : xform(it)
  return <g data-id={it.id} opacity={op} transform={tf} className={isToken(it) && hit ? 'transition-[filter] duration-150 hover:brightness-125' : undefined}>{body}</g>
}

const Board = forwardRef(function Board({ items, map, side, active, locked, onLive, onEnd, onCommit, onUndo, onRedo, onPickAgent }, ref) {
  const wrap = useRef(null)
  const svg = useRef(null)
  const [view, setView] = useState({ x: 0, y: 0, k: 0.6 })
  const [tool, setTool] = useState('select')
  const [color, setColor] = useState(COLORS[1])
  const [width, setWidth] = useState(WIDTHS[1])
  const [snap, setSnap] = useState(true)
  const [sel, setSel] = useState(null)
  const [draft, setDraft] = useState(null)
  const [edit, setEdit] = useState(null) // text editor {id, bx, by, value}
  const [panning, setPanning] = useState(false)
  const [vr, setVr] = useState(0) // view rotation
  const [callouts, setCallouts] = useState(true)
  const [narrow, setNarrow] = useState(false) // board narrower than the full style pill + hint: compact chrome
  const st = useRef({ touched: false, space: false, pan: null, drag: null, erased: null, drawing: false, draft: null })
  const P = useRef(); P.current = { items, side, view, tool, color, width, snap, locked, vr }
  const ppm = ppmOf(map)
  const calls = callouts ? calloutsOf(map) : []

  const fit = useCallback(() => {
    const el = wrap.current; if (!el) return
    const w = el.clientWidth, h = el.clientHeight
    if (!w || !h) return
    const k = baseFit(el)
    setView({ k, x: (w - SIZE * k) / 2, y: (h - SIZE * k) / 2 })
    st.current.touched = false
  }, [])

  useLayoutEffect(() => { fit() }, [map?.uuid, fit])
  useEffect(() => {
    const ro = new ResizeObserver(() => {
      const w = wrap.current?.clientWidth
      if (w) setNarrow(w < 640)
      if (!st.current.touched) fit()
    })
    ro.observe(wrap.current)
    return () => ro.disconnect()
  }, [fit])

  const toBoard = (e) => {
    const r = svg.current.getBoundingClientRect(), v = P.current.view
    return turn((e.clientX - r.left - v.x) / v.k, (e.clientY - r.top - v.y) / v.k, -P.current.vr)
  }

  // wheel zoom around the cursor (non-passive so the page never scrolls)
  useEffect(() => {
    const el = svg.current
    const onWheel = (e) => {
      e.preventDefault()
      st.current.touched = true
      const r = el.getBoundingClientRect(), mx = e.clientX - r.left, my = e.clientY - r.top
      setView(v => {
        const k = clamp(v.k * Math.exp(-e.deltaY * 0.0015), 0.25, 6)
        return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) }
      })
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
  }, [])

  const zoomBy = (f) => {
    const el = wrap.current, mx = el.clientWidth / 2, my = el.clientHeight / 2
    st.current.touched = true
    setView(v => { const k = clamp(v.k * f, 0.25, 6); return { k, x: mx - (mx - v.x) * (k / v.k), y: my - (my - v.y) * (k / v.k) } })
  }

  useImperativeHandle(ref, () => ({
    // Adds a palette item at the center of the visible area (or at a board point).
    addItem(payload, at) {
      const { view: v, items: its, snap: sn } = P.current
      const el = wrap.current
      let [x, y] = at || turn((el.clientWidth / 2 - v.x) / v.k, (el.clientHeight / 2 - v.y) / v.k, -P.current.vr)
      if (!at) { const n = its.filter(isToken).length; x += (n % 5) * 30 - 60; y += Math.floor(n / 5) % 3 * 34 }
      x = clamp(x, 20, SIZE - 20); y = clamp(y, 20, SIZE - 20)
      if (sn) { x = snapVal(x); y = snapVal(y) }
      const it = { id: uid(), x, y, ...payload }
      onCommit([...its, it]); setSel(it.id)
      // Placing something switches to Select so it can be moved, resized or turned right away.
      setTool('select')
    },
    // Drop from the side panel (pointer-based drag; native drag and drop is swallowed by the app window).
    dropAt(payload, cx, cy) {
      const r = svg.current?.getBoundingClientRect()
      if (!r || P.current.locked || cx < r.left || cx > r.right || cy < r.top || cy > r.bottom) return false
      this.addItem(payload, toBoard({ clientX: cx, clientY: cy }))
      return true
    },
  }))

  // keyboard: tools, delete, undo/redo, space-to-pan
  useEffect(() => {
    if (!active) return
    const down = (e) => {
      if (isTyping(e.target)) return
      const k = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && k === 'z') { e.preventDefault(); e.shiftKey ? onRedo() : onUndo(); return }
      if ((e.ctrlKey || e.metaKey) && k === 'y') { e.preventDefault(); onRedo(); return }
      if ((e.ctrlKey || e.metaKey) && k === 'd' && sel && !P.current.locked) {
        e.preventDefault()
        const o = P.current.items.find(i => i.id === sel); if (!o) return
        const c = { ...moveItem(o, 24, 24, false), id: uid() }
        onCommit([...P.current.items, c]); setSel(c.id); return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const nud = { arrowleft: [-1, 0], arrowright: [1, 0], arrowup: [0, -1], arrowdown: [0, 1] }[k]
      if (nud && sel && !P.current.locked) {
        e.preventDefault()
        const step = e.shiftKey ? 20 : 4
        const [dx, dy] = turn(SIZE / 2 + nud[0] * step, SIZE / 2 + nud[1] * step, -P.current.vr).map(v => v - SIZE / 2)
        onCommit(P.current.items.map(i => i.id === sel ? moveItem(i, dx, dy, false) : i)); return
      }
      if (e.code === 'Space') { e.preventDefault(); st.current.space = true; return }
      if (k === 'escape') { setSel(null); setDraft(null); setEdit(null); return }
      if ((k === 'delete' || k === 'backspace') && sel && !P.current.locked) { e.preventDefault(); onCommit(P.current.items.filter(i => i.id !== sel)); setSel(null); return }
      const t = TOOLS.find(t => t.key === k)
      if (t) setTool(t.id)
    }
    const up = (e) => { if (e.code === 'Space') st.current.space = false }
    window.addEventListener('keydown', down); window.addEventListener('keyup', up)
    return () => { window.removeEventListener('keydown', down); window.removeEventListener('keyup', up) }
  }, [active, sel, onUndo, onRedo, onCommit])

  useEffect(() => { setSel(null); setEdit(null) }, [map?.uuid, locked])
  // Selecting an agent (or one of its abilities) on the board shows that agent's abilities in the side panel.
  useEffect(() => { const it = items.find(i => i.id === sel); if (it?.agentId) onPickAgent?.(it.agentId) }, [sel]) // eslint-disable-line react-hooks/exhaustive-deps

  const erase = (e) => {
    const s = st.current
    const id = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('[data-id]')?.getAttribute('data-id')
    if (!id || s.erased.has(id)) return
    s.erased.add(id)
    onLive(P.current.items.filter(i => !s.erased.has(i.id)))
  }

  const onPointerDown = (e) => {
    const s = st.current
    if (P.current.locked || edit) return
    if (e.target.closest?.('[data-del]')) { onCommit(P.current.items.filter(i => i.id !== sel)); setSel(null); return }
    if (e.button === 1 || s.space) {
      e.preventDefault(); svg.current.setPointerCapture(e.pointerId)
      s.touched = true
      s.pan = { sx: e.clientX, sy: e.clientY, vx: P.current.view.x, vy: P.current.view.y }; setPanning(true); return
    }
    if (e.button !== 0) return
    const [x, y] = toBoard(e), { tool: t, color: c, width: w } = P.current
    if (e.target.closest?.('[data-rot]')) {
      svg.current.setPointerCapture(e.pointerId)
      s.rot = { id: sel, moved: false }; return
    }
    // resize / rotate handles on the selection box
    const handle = e.target.closest?.('[data-scale]') ? 'scale' : e.target.closest?.('[data-turn]') ? 'turn' : null
    if (handle && sel) {
      const o = P.current.items.find(i => i.id === sel); if (!o) return
      svg.current.setPointerCapture(e.pointerId)
      const [px, py] = pivot(o)
      s.xf = { id: sel, kind: handle, px, py, d0: Math.max(Math.hypot(x - px, y - py), 1), a0: Math.atan2(y - py, x - px), sc0: o.sc ?? 1, ang0: o.ang ?? 0, moved: false }
      return
    }
    // Tokens can be grabbed and moved with any tool, so you never have to switch back to Select first.
    const hitId = e.target.closest?.('[data-id]')?.getAttribute('data-id')
    const hitTok = t !== 'select' && t !== 'eraser' && hitId && P.current.items.find(i => i.id === hitId)
    if (t === 'select' || (hitTok && isToken(hitTok))) {
      const id = hitId
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
    const s = st.current
    if (s.pan) { setView(v => ({ ...v, x: s.pan.vx + e.clientX - s.pan.sx, y: s.pan.vy + e.clientY - s.pan.sy })); return }
    if (s.erased && e.buttons & 1) { erase(e); return }
    if (s.xf) {
      const [x, y] = toBoard(e), f = s.xf
      f.moved = true
      let patch
      if (f.kind === 'scale') patch = { sc: Math.round(clamp(f.sc0 * Math.hypot(x - f.px, y - f.py) / f.d0, 0.3, 4) * 100) / 100 }
      else {
        let ang = f.ang0 + (Math.atan2(y - f.py, x - f.px) - f.a0) * 180 / Math.PI
        if (e.shiftKey) ang = Math.round(ang / 15) * 15
        patch = { ang: Math.round(((ang % 360) + 360) % 360) }
      }
      onLive(P.current.items.map(i => i.id === f.id ? { ...i, ...patch } : i)); return
    }
    if (s.rot) {
      const [x, y] = toBoard(e), o = P.current.items.find(i => i.id === s.rot.id); if (!o) return
      let a = Math.atan2(y - o.y, x - o.x)
      if (e.shiftKey) a = Math.round(a / (Math.PI / 12)) * (Math.PI / 12)
      s.rot.moved = true
      onLive(P.current.items.map(i => i.id === o.id ? { ...i, rot: a } : i)); return
    }
    if (s.drag) {
      const [x, y] = toBoard(e), d = s.drag
      const dx = x - d.sx, dy = y - d.sy
      if (!d.moved && Math.hypot(dx, dy) * P.current.view.k < 3) return
      d.moved = true
      const o = d.orig
      let moved = moveItem(o, dx, dy, P.current.snap)
      if (isToken(o)) moved = { ...moved, x: clamp(moved.x, 10, SIZE - 10), y: clamp(moved.y, 10, SIZE - 10) }
      onLive(P.current.items.map(i => i.id === d.id ? moved : i))
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
    const s = st.current
    try { svg.current.releasePointerCapture(e.pointerId) } catch (err) { /* not captured */ }
    if (s.pan) { s.pan = null; setPanning(false); return }
    if (s.rot) { const m = s.rot.moved; s.rot = null; if (m) onEnd(); return }
    if (s.xf) { const m = s.xf.moved; s.xf = null; if (m) onEnd(); return }
    if (s.erased) { const had = s.erased.size; s.erased = null; if (had) onEnd(); return }
    if (s.drag) { const m = s.drag.moved; s.drag = null; if (m) onEnd(); return }
    if (s.drawing) {
      s.drawing = false
      const d = s.draft; s.draft = null; setDraft(null)
      if (!d) return
      const ok = d.type === 'pen' ? true
        : d.type === 'rect' ? Math.abs(d.w) > 6 && Math.abs(d.h) > 6
          : Math.hypot(d.x2 - d.x1, d.y2 - d.y1) > 8
      if (ok) onCommit([...P.current.items, d])
    }
  }

  const finishEdit = (commit) => {
    const ed = edit; setEdit(null)
    if (!ed || !commit) return
    const text = ed.value.trim()
    const its = P.current.items
    if (ed.id) onCommit(text ? its.map(i => i.id === ed.id ? { ...i, text } : i) : its.filter(i => i.id !== ed.id))
    else if (text) onCommit([...its, { id: uid(), type: 'text', x: ed.bx, y: ed.by, text, color, size: 18 + width * 3 }])
  }

  const onDoubleClick = (e) => {
    if (tool !== 'select' || locked) return
    const id = e.target.closest?.('[data-id]')?.getAttribute('data-id')
    const it = items.find(i => i.id === id)
    if (it?.type === 'text') setEdit({ id, bx: it.x, by: it.y, value: it.text })
  }

  const onDrop = (e) => {
    e.preventDefault()
    let p; try { p = JSON.parse(e.dataTransfer.getData('text/vd')) } catch (err) { return }
    if (!p || locked) return
    ref.current?.addItem(p, toBoard(e))
  }

  const selItem = items.find(i => i.id === sel)
  const sb = selItem && bbox(selItem)
  const cursor = panning ? 'grabbing' : locked ? 'default' : CURSOR[tool]
  const zoomPct = Math.round(view.k / baseFit(wrap.current) * 100)
  const hit = !locked && (tool === 'select' || tool === 'eraser')

  return (
    <div ref={wrap} className='relative h-full w-full overflow-hidden select-none'
      style={{ background: 'radial-gradient(circle at 50% 40%, rgb(var(--surface-2) / var(--surface-2-a)) 0%, transparent 75%)' }}
      onDragOver={e => e.preventDefault()} onDrop={onDrop}>
      <svg ref={svg} className='absolute inset-0 w-full h-full touch-none' style={{ cursor }}
        onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onDoubleClick={onDoubleClick}
        onAuxClick={e => e.preventDefault()}>
        <defs><clipPath id='vd-clip'><circle r={TOKEN_R - 4} /></clipPath></defs>
        <g transform={`translate(${view.x} ${view.y}) scale(${view.k}) rotate(${vr} ${SIZE / 2} ${SIZE / 2})`}>
          <rect width={SIZE} height={SIZE} rx={14} fill='#0e0e13' />
          {map?.displayIcon && <image href={map.displayIcon} width={SIZE} height={SIZE} />}
          <rect width={SIZE} height={SIZE} rx={14} fill='none' stroke='rgba(255,255,255,.12)' strokeWidth={2} />
          {calls.map((c, i) => (
            <text key={i} x={c.x} y={c.y} transform={vr ? `rotate(${-vr} ${c.x} ${c.y})` : undefined} textAnchor='middle' dominantBaseline='middle'
              fontSize={13} fontWeight={700} fill='rgba(255,255,255,.78)' stroke='rgba(0,0,0,.8)' strokeWidth={3.5} paintOrder='stroke' pointerEvents='none' style={{ userSelect: 'none' }}>{c.name}</text>
          ))}
          {items.map(it => <Shape key={it.id} it={it} side={side} ppm={ppm} vr={vr} hit={hit || (!locked && isToken(it))} />)}
          {draft && <Shape it={draft} side={side} ppm={ppm} vr={vr} />}
          {sb && !locked && tool === 'select' && (() => {
            // The selection box lives in the item's own transform, so it turns and scales with it.
            const geo = selItem.type === 'ability' && utilGeom(selItem, ppm)
            const sc = selItem.sc ?? 1, u = 1 / (view.k * sc) // handle size stays constant on screen
            const pad = 8 * u, cx = (sb[0] + sb[2]) / 2
            const H = 'rgb(var(--accent))'
            return (
              <g transform={geo ? xform(selItem, false) : xform(selItem)}>
                <rect x={sb[0] - pad} y={sb[1] - pad} width={sb[2] - sb[0] + pad * 2} height={sb[3] - sb[1] + pad * 2} rx={8 * u} fill='none' stroke={H} strokeWidth={2 * u} strokeDasharray={`${6 * u} ${4 * u}`} pointerEvents='none' />
                <g data-del transform={`translate(${sb[2] + pad} ${sb[1] - pad}) scale(${u})`} style={{ cursor: 'pointer' }}>
                  <title>Delete (Del)</title>
                  <circle r={10} fill='#ff4655' /><path d='M-4 -4L4 4M4 -4L-4 4' stroke='#fff' strokeWidth={2} strokeLinecap='round' />
                </g>
                <g data-scale transform={`translate(${sb[2] + pad} ${sb[3] + pad}) scale(${u})`} style={{ cursor: 'nwse-resize' }}>
                  <title>Drag to resize</title>
                  <rect x={-7} y={-7} width={14} height={14} rx={4} fill='#fff' stroke={H} strokeWidth={2.5} />
                </g>
                {!geo && (
                  <g transform={`translate(${cx} ${sb[1] - pad}) scale(${u})`}>
                    <line y1={0} y2={-22} stroke={H} strokeWidth={2} pointerEvents='none' />
                    <g data-turn transform='translate(0 -28)' style={{ cursor: 'grab' }}>
                      <title>Drag to rotate (Shift snaps to 15°)</title>
                      <circle r={8} fill='#fff' stroke={H} strokeWidth={2.5} />
                    </g>
                  </g>
                )}
              </g>
            )
          })()}
          {sb && !locked && tool === 'select' && (
            <g>
              {(() => {
                const g = utilGeom(selItem, ppm)
                return g?.shape === 'beam' && (
                  <g data-rot transform={`translate(${g.x2} ${g.y2}) scale(${1 / view.k})`} style={{ cursor: 'grab' }}>
                    <title>Drag to aim (Shift snaps)</title>
                    <circle r={9} fill='rgb(var(--accent))' stroke='#fff' strokeWidth={2} />
                  </g>
                )
              })()}
            </g>
          )}
        </g>
      </svg>

      {edit && (
        <input autoFocus value={edit.value} onChange={e => setEdit({ ...edit, value: e.target.value })}
          onKeyDown={e => { e.stopPropagation(); if (e.key === 'Enter') finishEdit(true); if (e.key === 'Escape') finishEdit(false) }}
          onBlur={() => finishEdit(true)} placeholder='Label'
          className='glass-strong absolute z-20 !border-accent/60 rounded-lg px-2 outline-none text-text font-bold'
          style={{ left: view.x + turn(edit.bx, edit.by, vr)[0] * view.k, top: view.y + turn(edit.bx, edit.by, vr)[1] * view.k - (18 + width * 3) * view.k, fontSize: Math.max(13, (18 + width * 3) * view.k), minWidth: 90 }} />
      )}

      {/* tool rail */}
      <div className='glass-strong absolute left-4 top-4 z-10 flex flex-col gap-1 p-1.5 rounded-2xl anim-fade'>
        {TOOLS.map(t => (
          <button key={t.id} title={t.label} onClick={() => setTool(t.id)} disabled={locked}
            className={`h-9 w-9 rounded-xl grid place-items-center text-[17px] transition duration-150 active:scale-90 disabled:opacity-40 ${tool === t.id ? 'accent-fill text-bg' : 'text-muted hover:text-text hover:bg-surface-2'}`}>
            <t.icon />
          </button>
        ))}
      </div>

      {/* style pill */}
      <div className={`glass-strong absolute top-4 z-10 flex items-center h-11 rounded-full anim-fade ${narrow ? 'left-[68px] gap-2 pl-3 pr-1' : 'left-1/2 -translate-x-1/2 gap-3 pl-4 pr-1.5'}`}>
        <div className={`flex items-center ${narrow ? 'gap-1' : 'gap-1.5'}`}>
          {COLORS.map(c => (
            <button key={c} onClick={() => setColor(c)} title={c}
              className={`h-5 w-5 rounded-full transition-transform duration-150 hover:scale-110 ${color === c ? 'ring-2 ring-offset-2 ring-offset-panel ring-text/80 scale-110' : 'shadow-[inset_0_0_0_1px_rgb(0_0_0/0.15)]'}`} style={{ background: c }} />
          ))}
        </div>
        <span className='w-px h-5 bg-line/60' />
        <div className='flex items-center gap-0.5'>
          {WIDTHS.map(w => (
            <button key={w} onClick={() => setWidth(w)} title={`Stroke ${w}`}
              className={`h-8 w-8 rounded-full grid place-items-center transition-colors ${width === w ? 'accent-soft' : 'hover:bg-surface-2'}`}>
              <span className='rounded-full bg-text' style={{ width: w + 3, height: w + 3 }} />
            </button>
          ))}
        </div>
        <span className='w-px h-5 bg-line/60' />
        <button onClick={() => setSnap(s => !s)} title='Snap tokens to grid' aria-pressed={snap} aria-label='Snap tokens to grid'
          className={`h-8 rounded-full flex items-center gap-1.5 text-[12px] font-semibold transition-colors ${narrow ? 'w-8 justify-center' : 'px-3'} ${snap ? 'accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2'}`}><FiGrid />{!narrow && 'Snap'}</button>
      </div>

      {/* zoom */}
      <div className='glass-strong absolute right-4 bottom-4 z-10 flex items-center gap-0.5 p-1 rounded-full'>
        <button className='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => zoomBy(1 / 1.25)} title='Zoom out'><FiMinus /></button>
        <span className='w-11 text-center text-[11px] tabular-nums text-muted'>{zoomPct}%</span>
        <button className='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => zoomBy(1.25)} title='Zoom in'><FiPlus /></button>
        <button className='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={fit} title='Fit to view'><FiMaximize /></button>
        <span className='w-px h-5 bg-line/60 mx-0.5' />
        <button className='h-8 w-8 grid place-items-center rounded-full text-muted hover:text-text hover:bg-surface-2 transition-colors' onClick={() => setVr(r => (r + 90) % 360)} title='Rotate map 90°'><FiRotateCw /></button>
        <button className={`h-8 w-8 grid place-items-center rounded-full transition-colors ${callouts ? 'accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2'}`} onClick={() => setCallouts(v => !v)} aria-pressed={callouts} title='Callout labels'><FiMapPin /></button>
      </div>
      {!narrow && <div className='absolute left-4 bottom-4 z-10 text-[11px] text-muted/80 pointer-events-none'>Wheel zoom · Space-drag to pan · Ctrl+D duplicate · Arrows nudge · Drag the dot to aim walls</div>}
    </div>
  )
})

export default Board
