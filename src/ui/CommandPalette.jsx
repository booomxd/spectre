// Ctrl+K command palette
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { FiCornerDownLeft, FiSearch } from 'react-icons/fi'
import { AnimatePresence, Pill, SPRING, m } from './motion'

const cx = (...c) => c.filter(Boolean).join(' ')

function score(item, q) {
  if (!q) return 1
  const hay = (item.label + ' ' + (item.group || '') + ' ' + (item.keywords || '')).toLowerCase()
  const label = item.label.toLowerCase()
  if (label.startsWith(q)) return 3
  if (label.includes(q)) return 2
  // every query word appears somewhere
  return q.split(/\s+/).every(w => hay.includes(w)) ? 1 : 0
}

function Panel({ items, onClose }) {
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const list = useRef(null)
  const query = q.trim().toLowerCase()
  const shown = useMemo(() => items.map(i => [i, score(i, query)]).filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]).map(([i]) => i).slice(0, 40), [items, query])
  // group in first-appearance order, keeping one flat index for keyboard selection
  const groups = useMemo(() => {
    const g = new Map()
    shown.forEach(i => { const k = query ? 'Results' : i.group || 'Go to'; if (!g.has(k)) g.set(k, []); g.get(k).push(i) })
    return [...g]
  }, [shown, query])
  const flat = groups.flatMap(([, l]) => l)
  useEffect(() => setSel(0), [query])
  useEffect(() => { list.current?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' }) }, [sel])

  const run = i => { onClose(); setTimeout(() => i.run(), 0) }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat.length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); flat[sel] && run(flat[sel]) }
    // stopPropagation: Escape closes only the palette, not a modal underneath it
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); onClose() }
  }
  let n = -1
  return (
    <m.div className='glass-strong w-[600px] max-w-[calc(100vw-48px)] rounded-3xl overflow-hidden flex flex-col max-h-[60vh]'
      onMouseDown={e => e.stopPropagation()}
      initial={{ opacity: 0, scale: 0.97, y: -8 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.98, y: -4, transition: { duration: 0.14 } }} transition={SPRING}>
      <div className='shrink-0 flex items-center gap-3 px-5 h-14 border-b border-line'>
        <FiSearch className='text-muted shrink-0' size={17} />
        <input autoFocus value={q} onChange={e => setQ(e.target.value)} onKeyDown={onKey} placeholder='Jump to a page or run an action...'
          className='flex-1 bg-transparent outline-none text-[15px] text-text placeholder:text-muted/60' />
        <span className='kbd'>Esc</span>
      </div>
      <div ref={list} className='flex-1 min-h-0 overflow-y-auto p-2'>
        {!flat.length && <div className='py-10 text-center text-[13px] text-muted'>Nothing matches "{q}"</div>}
        {groups.map(([g, l]) => (
          <div key={g} className='mb-1'>
            <div className='eyebrow px-3 pt-2.5 pb-1.5 !text-[10px]'>{g}</div>
            {l.map(i => {
              n++
              const idx = n, on = idx === sel
              const Icon = i.icon
              return (
                <button key={i.id} data-sel={on} onMouseMove={() => sel !== idx && setSel(idx)} onClick={() => run(i)}
                  className={cx('relative w-full h-11 px-3 rounded-xl flex items-center gap-3 text-left text-[13.5px] transition-colors', on ? 'text-text' : 'text-text/80')}>
                  {on && <Pill layoutId='palette-sel' className='accent-soft absolute inset-0 rounded-xl' />}
                  <span className={cx('relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 glass-inset', on ? 'text-accent' : 'text-muted')}>{Icon && <Icon size={14} />}</span>
                  <span className='relative flex-1 truncate font-medium'>{i.label}</span>
                  {i.hint && <span className='relative text-[11.5px] text-muted truncate'>{i.hint}</span>}
                  {on && <FiCornerDownLeft className='relative text-muted shrink-0' size={13} />}
                </button>
              )
            })}
          </div>
        ))}
      </div>
      <div className='shrink-0 flex items-center gap-4 px-5 h-11 border-t border-line text-[11px] text-muted'>
        <span className='flex items-center gap-1.5'><span className='kbd'>↑</span><span className='kbd'>↓</span>move</span>
        <span className='flex items-center gap-1.5'><span className='kbd'>Enter</span>open</span>
        <span className='ml-auto flex items-center gap-1.5'><span className='kbd'>Ctrl</span><span className='kbd'>K</span>toggle</span>
      </div>
    </m.div>
  )
}

export default function CommandPalette({ open, onClose, items }) {
  return createPortal(
    <AnimatePresence>
      {open && (
        <m.div key='palette' className='fixed inset-0 z-[55] flex justify-center items-start pt-[14vh] bg-[rgb(var(--scrim)/var(--scrim-a))]' onMouseDown={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.16 }}>
          <Panel items={items} onClose={onClose} />
        </m.div>
      )}
    </AnimatePresence>, document.body)
}
