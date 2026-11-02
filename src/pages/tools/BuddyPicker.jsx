import { useMemo, useState } from 'react'
import { FiSearch, FiSlash } from 'react-icons/fi'
import { Empty, Input } from '../../ui'
import { useContent } from '../../lib/content'
import { lc } from './gear'

const cx = (...c) => c.filter(Boolean).join(' ')

// Owned buddies only. value = { charmId, levelId, instance } or null.
// `usedInstances` = buddy instances already on other weapons in the pending loadout.
export default function BuddyPicker({ owned, value, usedInstances, onChange }) {
  const buddies = useContent('buddies')
  const [q, setQ] = useState('')
  const items = useMemo(() => {
    if (!buddies || !owned) return []
    const byLevel = {}
    for (const b of buddies) for (const l of b.levels) byLevel[lc(l.uuid)] = { buddy: b, level: l }
    const groups = {}
    for (const e of owned.buddies) {
      const hit = byLevel[lc(e.id)]
      if (!hit) continue
      const g = groups[lc(e.id)] ||= { ...hit, instances: [] }
      g.instances.push(e.instance)
    }
    return Object.values(groups).sort((a, b) => a.buddy.displayName.localeCompare(b.buddy.displayName))
  }, [buddies, owned])

  const shown = items.filter(i => i.buddy.displayName.toLowerCase().includes(q.toLowerCase()))
  const choose = g => {
    const inst = g.instances.find(x => lc(x) === lc(value?.instance)) || g.instances.find(x => !usedInstances.has(lc(x)))
    if (inst) onChange({ charmId: g.buddy.uuid, levelId: g.level.uuid, instance: inst })
  }

  return (
    <div>
      <div className='relative mb-3'>
        <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
        <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search your buddies' className='pl-9' />
      </div>
      {!buddies ? <div className='skeleton h-24 rounded-xl' /> : shown.length === 0 && q ? <Empty title='No owned buddies match' className='py-6' /> : (
        <div className='grid grid-cols-6 gap-2 overflow-y-auto pr-1' style={{ maxHeight: 190 }}>
          <button onClick={() => onChange(null)}
            className={cx('lift h-[72px] rounded-xl border flex flex-col items-center justify-center gap-1 text-[10px] text-muted', !value ? 'border-accent bg-accent/10 text-accent' : 'border-line bg-surface')}>
            <FiSlash className='text-base' />None
          </button>
          {shown.map(g => {
            const on = lc(g.level.uuid) === lc(value?.levelId)
            const free = g.instances.some(x => lc(x) === lc(value?.instance) || !usedInstances.has(lc(x)))
            return (
              <button key={g.level.uuid} disabled={!free && !on} onClick={() => choose(g)} title={g.buddy.displayName}
                className={cx('lift relative h-[72px] rounded-xl border p-1.5 flex flex-col items-center justify-between', on ? 'border-accent bg-accent/10' : 'border-line bg-surface', !free && !on && 'opacity-35')}>
                <img src={g.level.displayIcon} className='h-10 object-contain' loading='lazy' />
                <span className='w-full truncate text-[9px] text-muted text-center'>{g.buddy.displayName}</span>
                {g.instances.length > 1 && <span className='absolute top-1 right-1 text-[9px] font-bold text-muted'>x{g.instances.length}</span>}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
