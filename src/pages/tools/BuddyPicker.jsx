import { createSignal, createMemo } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiSearch, FiSlash } from 'solid-icons/fi'
import { Empty, Input, cx } from '../../ui'
import { useContent } from '../../lib/content'
import { lc } from './gear'

// owned buddies only. value = { charmId, levelId, instance } or null
export default function BuddyPicker(props) {
  const buddiesA = useContent('buddies')
  const [qS, setQ] = createSignal('')
  
    const items = createMemo(() => {
    if (!buddiesA() || !props.owned) return []
    const byLevel = {}
    for (const b of buddiesA()) for (const l of b.levels) byLevel[lc(l.uuid)] = { buddy: b, level: l }
    const groups = {}
    for (const e of props.owned.buddies) {
      const hit = byLevel[lc(e.id)]
      if (!hit) continue
      const g = groups[lc(e.id)] ||= { ...hit, instances: [] }
      g.instances.push(e.instance)
    }
    return Object.values(groups).sort((a, b) => a.buddy.displayName.localeCompare(b.buddy.displayName))
  })
    const shown = () => (items().filter(i => i.buddy.displayName.toLowerCase().includes(qS().toLowerCase())))
    const choose = g => {
    const inst = g.instances.find(x => lc(x) === lc(props.value?.instance)) || g.instances.find(x => !props.usedInstances.has(lc(x)))
    if (inst) props.onChange({ charmId: g.buddy.uuid, levelId: g.level.uuid, instance: inst })
  }
    return (<div>
      <div class='relative mb-3'>
        <FiSearch class='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted' />
        <Input value={qS()} onInput={e => setQ(e.target.value)} placeholder='Search your buddies' class='pl-10 rounded-full' />
      </div>
      {!buddiesA() ? <div class='skeleton h-24 rounded-xl' /> : shown().length === 0 && qS() ? <Empty title='No owned buddies match' class='py-6' /> : (
        <div class='grid grid-cols-6 gap-2.5 overflow-y-auto pr-1' style={st({ maxHeight: 190 })}>
          <button onClick={() => props.onChange(null)}
            class={cx('lift h-[72px] rounded-xl flex flex-col items-center justify-center gap-1 text-[11px] font-medium', !props.value ? 'accent-soft border border-transparent text-accent' : 'glass-inset text-muted hover:text-text')}>
            <FiSlash class='text-base' />None
          </button>
          {shown().map(g => {
            const on = lc(g.level.uuid) === lc(props.value?.levelId)
            const free = g.instances.some(x => lc(x) === lc(props.value?.instance) || !props.usedInstances.has(lc(x)))
            return (
              <button disabled={!free && !on} onClick={() => choose(g)} title={g.buddy.displayName}
                class={cx('lift relative h-[72px] rounded-xl p-1.5 flex flex-col items-center justify-between', on ? 'accent-soft border border-transparent' : 'glass-inset hover:bg-surface-2', !free && !on && 'opacity-[0.35]')}>
                <img decoding='async' src={g.level.displayIcon} class='h-10 object-contain' loading='lazy' />
                <span class='w-full truncate text-[9px] text-muted text-center'>{g.buddy.displayName}</span>
                {g.instances.length > 1 && <span class='absolute top-1 right-1.5 text-[9px] font-semibold tabular-nums text-muted'>x{g.instances.length}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>)
  
}
