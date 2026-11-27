import { For, createSignal, createMemo } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiCheck, FiSearch } from 'solid-icons/fi'
import { Badge, Empty, Input, Label, cx } from '../../ui'
import { chromaOwned, isStandard, levelItemLabel, levelOwned, skinImage, skinOwned, tierColor, useContentTiers, lc } from './gear'

// image for the current selection: a chroma's render when a variant is picked, else the skin icon
export function selectionImage(skin, chromaId) {
  const c = skin?.chromas.find(x => lc(x.uuid) === lc(chromaId))
  return (c && c !== skin.chromas[0] && c.fullRender) || skinImage(skin)
}

// Owned-only skin picker for one weapon: skins grid + level and variant pickers. value = { skinId, levelId, chromaId }
export default function SkinPicker(props) {
  const [qS, setQ] = createSignal('')
  const tiersA = useContentTiers()
  
    const skins = createMemo(() => {
    const list = props.weapon.skins.filter(s => skinOwned(props.weapon, s, props.owned))
    return list.sort((a, b) => (isStandard(props.weapon, b) - isStandard(props.weapon, a)) || a.displayName.localeCompare(b.displayName))
  })
    const shown = () => (skins().filter(s => s.displayName.toLowerCase().includes(qS().toLowerCase())))
    const skin = () => (props.weapon.skins.find(s => lc(s.uuid) === lc(props.value.skinId)))
    const best = s => [...s.levels].reverse().find(l => levelOwned(s, l, props.owned)) || s.levels[0]
    const pick = s => props.onChange({ skinId: s.uuid, levelId: best(s).uuid, chromaId: s.chromas[0].uuid })
    return (<div class='flex flex-col gap-4'>
      {skin() && (
        <div class='glass-inset flex gap-5 rounded-2xl p-4 anim-fade'>
          <div class='w-56 h-28 shrink-0 flex items-center justify-center rounded-xl bg-[radial-gradient(closest-side,rgb(var(--accent)/0.16),transparent)]'>
            <img decoding='async' src={selectionImage(skin(), props.value.chromaId)} class='anim-pop max-h-full max-w-full object-contain p-2' />
          </div>
          <div class='min-w-0 flex-1 space-y-3'>
            <div class='display text-[22px] text-text truncate'>{skin().displayName}</div>
            {skin().levels.length > 1 && (
              <div>
                <Label>Level</Label>
                <div class='flex flex-wrap gap-1.5'>
                  <For each={skin().levels}>{(l, i) => {
                    const ok = () => (levelOwned(skin(), l, props.owned))
                    const on = () => (lc(l.uuid) === lc(props.value.levelId))
                    return (
                      <button disabled={!ok()} onClick={() => props.onChange({ ...props.value, levelId: l.uuid })}
                        title={levelItemLabel(l) || `Level ${i() + 1}`}
                        class={cx('h-7 px-3 rounded-full border text-[11px] font-semibold transition-[transform,opacity,background-color,border-color,color] duration-200', on() ? 'accent-soft border-transparent text-accent' : 'glass text-muted hover:text-text', !ok() && 'opacity-30 cursor-not-allowed')}>
                        {i() + 1}{levelItemLabel(l) && <span class='ml-1 font-normal opacity-70'>{levelItemLabel(l)}</span>}
                      </button>
                    )
                  }}</For>
                </div>
              </div>
            )}
            {skin().chromas.length > 1 && (
              <div>
                <Label>Variant</Label>
                <div class='flex flex-wrap gap-1.5'>
                  {skin().chromas.map((c, i) => {
                    const ok = chromaOwned(skin(), c, props.owned)
                    if (!ok) return null
                    const on = lc(c.uuid) === lc(props.value.chromaId)
                    return (
                      <button onClick={() => props.onChange({ ...props.value, chromaId: c.uuid, levelId: best(skin()).uuid })} title={c.displayName}
                        class={cx('w-9 h-9 rounded-xl border flex items-center justify-center transition-[transform,opacity,background-color,border-color,color] duration-200 hover:-translate-y-0.5', on ? 'accent-soft border-transparent' : 'glass')}>
                        {(c.swatch || c.fullRender) ? <img decoding='async' src={c.swatch || c.fullRender} class='w-6 h-6 object-contain' /> : <span class='text-[10px] text-muted'>{i + 1}</span>}
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
        <div class='relative mb-3'>
          <FiSearch class='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted' />
          <Input value={qS()} onInput={e => setQ(e.target.value)} placeholder={`Search your ${props.weapon.displayName} skins`} class='pl-10 rounded-full' />
        </div>
        {shown().length === 0 ? <Empty title='No owned skins match' hint='Only skins you own can be equipped.' class='py-8' /> : (
          <div class='grid grid-cols-3 gap-3 overflow-y-auto pr-1 stagger' style={st({ maxHeight: (props.maxHeight ?? 260) })}>
            <For each={shown()}>{(s, i) => {
              const on = () => (lc(s.uuid) === lc(props.value.skinId))
              const tier = () => (tiersA()[lc(s.contentTierUuid)])
              return (
                <button style={st({ '--i': Math.min(i(), 12) })} onClick={() => pick(s)}
                  class={cx('lift relative rounded-xl p-2.5 text-left', i() < 12 && 'anim-rise', on() ? 'accent-soft border border-transparent' : 'glass-inset hover:bg-surface-2')}>
                  {on() && <span class='accent-fill absolute top-2 right-2 w-4 h-4 rounded-full text-bg flex items-center justify-center text-[10px]'><FiCheck /></span>}
                  <div class='h-14 flex items-center justify-center'>
                    <img decoding='async' src={skinImage(s)} class='max-h-full max-w-full object-contain' loading='lazy' />
                  </div>
                  <div class='mt-1.5 flex items-center gap-1.5'>
                    {tier() && <img decoding='async' src={tier().displayIcon} class='w-3.5 h-3.5' title={tier().displayName} />}
                    <span class='tier-text text-[11px] font-semibold truncate' style={st(tierColor(tier()) ? { '--tier': tierColor(tier()) } : undefined)}>{s.displayName}</span>
                  </div>
                  {isStandard(props.weapon, s) && <Badge class='mt-1'>Standard</Badge>}
                </button>
              )
            }}</For>
          </div>
        )}
      </div>
    </div>)
  
}
