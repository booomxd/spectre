import { useMemo, useState } from 'react'
import { FiCheck, FiSearch } from 'react-icons/fi'
import { Badge, Empty, Input, Label, cx } from '../../ui'
import { chromaOwned, isStandard, levelItemLabel, levelOwned, skinImage, skinOwned, tierColor, useContentTiers, lc } from './gear'

// Image for the current selection: a chroma's render when a variant is picked, else the skin icon.
export function selectionImage(skin, chromaId) {
  const c = skin?.chromas.find(x => lc(x.uuid) === lc(chromaId))
  return (c && c !== skin.chromas[0] && c.fullRender) || skinImage(skin)
}

// Owned-only skin picker for one weapon: skins grid + level and variant pickers.
// value = { skinId, levelId, chromaId }; onChange gets the same shape.
export default function SkinPicker({ weapon, owned, value, onChange, maxHeight = 260 }) {
  const [q, setQ] = useState('')
  const tiers = useContentTiers()
  const skins = useMemo(() => {
    const list = weapon.skins.filter(s => skinOwned(weapon, s, owned))
    return list.sort((a, b) => (isStandard(weapon, b) - isStandard(weapon, a)) || a.displayName.localeCompare(b.displayName))
  }, [weapon, owned])
  const shown = skins.filter(s => s.displayName.toLowerCase().includes(q.toLowerCase()))
  const skin = weapon.skins.find(s => lc(s.uuid) === lc(value.skinId))

  const pick = s => onChange({ skinId: s.uuid, levelId: s.levels[0].uuid, chromaId: s.chromas[0].uuid })

  return (
    <div className='flex flex-col gap-4'>
      {skin && (
        <div className='glass-inset flex gap-5 rounded-2xl p-4 anim-fade'>
          <div className='w-56 h-28 shrink-0 flex items-center justify-center rounded-xl bg-[radial-gradient(closest-side,rgb(var(--accent)/0.16),transparent)]'>
            <img key={selectionImage(skin, value.chromaId)} src={selectionImage(skin, value.chromaId)} className='anim-pop max-h-full max-w-full object-contain p-2' />
          </div>
          <div className='min-w-0 flex-1 space-y-3'>
            <div className='display text-[22px] text-text truncate'>{skin.displayName}</div>
            {skin.levels.length > 1 && (
              <div>
                <Label>Level</Label>
                <div className='flex flex-wrap gap-1.5'>
                  {skin.levels.map((l, i) => {
                    const ok = levelOwned(skin, l, owned)
                    const on = lc(l.uuid) === lc(value.levelId)
                    return (
                      <button key={l.uuid} disabled={!ok} onClick={() => onChange({ ...value, levelId: l.uuid })}
                        title={levelItemLabel(l) || `Level ${i + 1}`}
                        className={cx('h-7 px-3 rounded-full border text-[11px] font-semibold transition-[transform,opacity,background-color,border-color,color] duration-200', on ? 'accent-soft border-transparent text-accent' : 'glass text-muted hover:text-text', !ok && 'opacity-30 cursor-not-allowed')}>
                        {i + 1}{levelItemLabel(l) && <span className='ml-1 font-normal opacity-70'>{levelItemLabel(l)}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
            {skin.chromas.length > 1 && (
              <div>
                <Label>Variant</Label>
                <div className='flex flex-wrap gap-1.5'>
                  {skin.chromas.map((c, i) => {
                    const ok = chromaOwned(skin, c, owned)
                    if (!ok) return null
                    const on = lc(c.uuid) === lc(value.chromaId)
                    return (
                      <button key={c.uuid} onClick={() => onChange({ ...value, chromaId: c.uuid })} title={c.displayName}
                        className={cx('w-9 h-9 rounded-xl border flex items-center justify-center transition-[transform,opacity,background-color,border-color,color] duration-200 hover:-translate-y-0.5', on ? 'accent-soft border-transparent' : 'glass')}>
                        {(c.swatch || c.fullRender) ? <img src={c.swatch || c.fullRender} className='w-6 h-6 object-contain' /> : <span className='text-[10px] text-muted'>{i + 1}</span>}
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <div>
        <div className='relative mb-3'>
          <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted' />
          <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search your ${weapon.displayName} skins`} className='pl-10 rounded-full' />
        </div>
        {shown.length === 0 ? <Empty title='No owned skins match' hint='Only skins you own can be equipped.' className='py-8' /> : (
          <div className='grid grid-cols-3 gap-3 overflow-y-auto pr-1 stagger' style={{ maxHeight }}>
            {shown.map((s, i) => {
              const on = lc(s.uuid) === lc(value.skinId)
              const tier = tiers[lc(s.contentTierUuid)]
              return (
                <button key={s.uuid} style={{ '--i': Math.min(i, 12) }} onClick={() => pick(s)}
                  className={cx('lift relative rounded-xl p-2.5 text-left', i < 12 && 'anim-rise', on ? 'accent-soft border border-transparent' : 'glass-inset hover:bg-surface-2')}>
                  {on && <span className='accent-fill absolute top-2 right-2 w-4 h-4 rounded-full text-bg flex items-center justify-center text-[10px]'><FiCheck /></span>}
                  <div className='h-14 flex items-center justify-center'>
                    <img src={skinImage(s)} className='max-h-full max-w-full object-contain' loading='lazy' />
                  </div>
                  <div className='mt-1.5 flex items-center gap-1.5'>
                    {tier && <img src={tier.displayIcon} className='w-3.5 h-3.5' title={tier.displayName} />}
                    <span className='text-[11px] font-semibold truncate' style={{ color: tierColor(tier) }}>{s.displayName}</span>
                  </div>
                  {isStandard(weapon, s) && <Badge className='mt-1'>Standard</Badge>}
                </button>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
