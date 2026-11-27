// Ctrl+K command palette
import { For, Show, createEffect, createMemo, createSignal, on } from 'solid-js'
import { Dynamic, Portal } from 'solid-js/web'
import { FiCornerDownLeft, FiSearch } from 'solid-icons/fi'

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

function Panel(props) {
  const [q, setQ] = createSignal('')
  const [sel, setSel] = createSignal(0)
  let list
  const query = () => q().trim().toLowerCase()
  const shown = createMemo(() => props.items.map(i => [i, score(i, query())]).filter(([, s]) => s > 0)
    .sort((a, b) => b[1] - a[1]).map(([i]) => i).slice(0, 40))
  // group in first-appearance order, keeping one flat index for keyboard selection
  const groups = createMemo(() => {
    const g = new Map()
    let n = 0
    shown().forEach(i => { const k = query() ? 'Results' : i.group || 'Go to'; if (!g.has(k)) g.set(k, []); g.get(k).push([i, n++]) })
    return [...g]
  })
  const flat = () => shown()
  createEffect(on(query, () => setSel(0), { defer: true }))
  createEffect(on(sel, () => list?.querySelector('[data-sel="true"]')?.scrollIntoView({ block: 'nearest' }), { defer: true }))

  const run = i => { props.onClose(); setTimeout(() => i.run(), 0) }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSel(s => Math.min(flat().length - 1, s + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSel(s => Math.max(0, s - 1)) }
    else if (e.key === 'Enter') { e.preventDefault(); flat()[sel()] && run(flat()[sel()]) }
    // stopPropagation: Escape closes only the palette, not a modal underneath it
    else if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); props.onClose() }
  }
  return (
    <div class='anim-dialog glass-strong w-[600px] max-w-[calc(100vw-48px)] rounded-3xl overflow-hidden flex flex-col max-h-[60vh]' onMouseDown={e => e.stopPropagation()}>
      <div class='shrink-0 flex items-center gap-3 px-5 h-14 border-b border-line'>
        <FiSearch class='text-muted shrink-0' size={17} />
        <input ref={el => queueMicrotask(() => el.focus())} value={q()} onInput={e => setQ(e.currentTarget.value)} onKeyDown={onKey} placeholder='Jump to a page or run an action...'
          class='flex-1 bg-transparent outline-none text-[15px] text-text placeholder:text-muted/60' />
        <span class='kbd'>Esc</span>
      </div>
      <div ref={list} class='flex-1 min-h-0 overflow-y-auto p-2'>
        <Show when={!flat().length}><div class='py-10 text-center text-[13px] text-muted'>Nothing matches "{q()}"</div></Show>
        <For each={groups()}>{([g, l]) => (
          <div class='mb-1'>
            <div class='eyebrow px-3 pt-2.5 pb-1.5 !text-[10px]'>{g}</div>
            <For each={l}>{([i, idx]) => {
              const on_ = () => idx === sel()
              return (
                <button data-sel={on_() ? 'true' : 'false'} onMouseMove={() => sel() !== idx && setSel(idx)} onClick={() => run(i)}
                  class={cx('relative w-full h-11 px-3 rounded-xl flex items-center gap-3 text-left text-[13.5px]', on_() ? 'text-text' : 'text-text/80')}>
                  <Show when={on_()}><span class='accent-soft absolute inset-0 rounded-xl' /></Show>
                  <span class={cx('relative w-7 h-7 rounded-lg flex items-center justify-center shrink-0 glass-inset', on_() ? 'text-accent' : 'text-muted')}><Show when={i.icon}><Dynamic component={i.icon} size={14} /></Show></span>
                  <span class='relative flex-1 truncate font-medium'>{i.label}</span>
                  <Show when={i.hint}><span class='relative text-[11.5px] text-muted truncate'>{i.hint}</span></Show>
                  <Show when={on_()}><FiCornerDownLeft class='relative text-muted shrink-0' size={13} /></Show>
                </button>
              )
            }}</For>
          </div>
        )}</For>
      </div>
      <div class='shrink-0 flex items-center gap-4 px-5 h-11 border-t border-line text-[11px] text-muted'>
        <span class='flex items-center gap-1.5'><span class='kbd'>↑</span><span class='kbd'>↓</span>move</span>
        <span class='flex items-center gap-1.5'><span class='kbd'>Enter</span>open</span>
        <span class='ml-auto flex items-center gap-1.5'><span class='kbd'>Ctrl</span><span class='kbd'>K</span>toggle</span>
      </div>
    </div>
  )
}

export default function CommandPalette(props) {
  return (
    <Show when={props.open}>
      <Portal>
        <div class='anim-scrim fixed inset-0 z-[55] flex justify-center items-start pt-[14vh] bg-[rgb(var(--scrim)/var(--scrim-a))]' onMouseDown={() => props.onClose()}>
          <Panel items={props.items} onClose={props.onClose} />
        </div>
      </Portal>
    </Show>
  )
}
