import { For, createEffect, createSignal, on, Show, createMemo } from 'solid-js'
import { st } from '../lib/st.js'
import { FiLock, FiPlay, FiSearch } from 'solid-icons/fi'
import { Badge, Card, Empty, Heading, Input, Item, Modal, Page, SectionTitle, SegmentedTabs, Select, Skeleton, Stagger, Stat, Swap, cx, Pill } from '../ui'
import { useRiot } from '../lib/riot'
import { WishButton, useWishlist } from '../lib/wishlist'
import { useStored } from '../lib/stored'
import { CATEGORIES, catKey, chromaOwned, isStandard, lc, levelItemLabel, levelOwned, skinImage, skinOwned, tierColor, useContentTiers, useOwned, useWeapons } from './tools/gear'

const pen = p => (p || '').split('::').pop() || '-'
const num = (v, d = 2) => v == null ? '-' : String(Math.round(v * 10 ** d) / 10 ** d)

export default function Weapons() {
  const wish = useWishlist()
  const riotA = useRiot()
  const weaponsA = useWeapons()
  const __owned = useOwned(() => !riotA().connected)
  const tiersA = useContentTiers()
  const [catS, setCat] = useStored('weapons-cat', 'Rifle')
  const [widS, setWid] = useStored('weapons-wid', null)
  const [filterS, setFilter] = useStored('weapons-filter', 'all', ['all', 'owned'])
  const [tierS, setTier] = createSignal('')
  const [qS, setQ] = createSignal('')
  const [skinS, setSkin] = createSignal(null)
  
    const inCat = () => (weaponsA()?.filter(w => catKey(w) === catS()) || [])
    const weapon = () => (inCat().find(w => lc(w.uuid) === lc(widS())) || inCat()[0])
    const stats = () => (weapon()?.weaponStats)
    const tierOptions = createMemo(() => {
    if (!weapon()) return []
    const ids = [...new Set(weapon().skins.map(s => lc(s.contentTierUuid)).filter(Boolean))]
    return ids.map(id => ({ value: id, label: tiersA()[id]?.displayName || 'Tier' }))
  })
    const skins = createMemo(() => {
    if (!weapon()) return []
    return weapon().skins
      .filter(s => (filterS() !== 'owned' || skinOwned(weapon(), s, __owned.owned)) && (!tierS() || lc(s.contentTierUuid) === tierS()) && s.displayName.toLowerCase().includes(qS().toLowerCase()))
      .sort((a, b) => (isStandard(weapon(), b) - isStandard(weapon(), a)) || a.displayName.localeCompare(b.displayName))
  })
    return (<Page title='Weapons' subtitle='Stats, damage falloff and every skin for each weapon'
      actions={<SegmentedTabs layoutId='weapons-cat' tabs={CATEGORIES.map(c => ({ value: c.key, label: c.label }))} value={catS()} onChange={c => { setCat(c); setWid(null); setTier(''); setQ('') }} />}>
      {!weaponsA() ? (
        <div class='space-y-5'><Skeleton class='h-16 rounded-2xl' /><Skeleton class='h-72 rounded-3xl' /></div>
      ) : (
        <div class='space-y-8'>
          <div class='glass rounded-full p-1.5 flex gap-1 w-fit max-w-full overflow-x-auto'>
            {inCat().map(w => {
              const on = weapon() && lc(w.uuid) === lc(weapon().uuid)
              return (
                <button onClick={() => { setWid(w.uuid); setTier(''); setQ('') }}
                  class={cx('relative h-11 pl-3 pr-4 rounded-full flex items-center gap-2.5 shrink-0 transition-colors', on ? 'text-text' : 'text-muted hover:text-text')}>
                  {on && <Pill layoutId='weapons-pick' />}
                  <img decoding='async' src={w.displayIcon} class='relative h-6 w-14 object-contain' />
                  <span class='relative text-[12.5px] font-semibold tracking-tight'>{w.displayName}</span>
                </button>
              )
            })}
          </div>

          {weapon() && (
            <Swap id={weapon().uuid} class='space-y-8'>
              <div class='bento'>
                <Card class='col-span-12 xl:col-span-7 relative overflow-hidden rounded-3xl p-7 flex flex-col min-h-[300px]'>
                  <span class='halo -top-28 -right-16 w-[420px] h-[420px] opacity-80' />
                  <div class='relative flex items-start justify-between gap-3'>
                    <div>
                      <div class='eyebrow mb-2'>{CATEGORIES.find(c => c.key === catS())?.label}</div>
                      <h2 class='display text-[44px] text-text'>{weapon().displayName}</h2>
                    </div>
                    {weapon().shopData && <Badge tone='accent' class='!h-7 !px-3 !text-[11px]'>{weapon().shopData.cost > 0 ? `${weapon().shopData.cost} credits` : 'Free'}</Badge>}
                  </div>
                  <div class='relative flex-1 flex items-center justify-center py-4'>
                    <img decoding='async' src={weapon().displayIcon} class='max-h-[120px] max-w-[85%] object-contain drop-shadow-[0_18px_30px_rgb(0_0_0/0.4)]' />
                  </div>
                  {stats() ? (
                    <div class='relative glass-inset rounded-2xl grid grid-cols-3 lg:grid-cols-6 divide-x divide-line'>
                      <For each={[['Fire rate', num(stats().fireRate, 1), 'per sec'], ['Magazine', stats().magazineSize, 'rounds'], ['Reload', num(stats().reloadTimeSeconds), 'sec'], ['Equip', num(stats().equipTimeSeconds), 'sec'], ['Run speed', num(stats().runSpeedMultiplier), 'x'], ['Wall pen', pen(stats().wallPenetration), '']]}>{([l, v, sub]) => (
                        <Stat label={l} value={v} sub={sub} class={'px-4 py-3 min-w-0' + (l === 'Wall pen' ? ' [&>div:nth-child(2)]:text-[17px] [&>div:nth-child(2)]:leading-8' : '')} />
                      )}</For>
                    </div>
                  ) : <p class='relative text-[13px] text-muted'>The melee weapon has no ballistic stats.</p>}
                </Card>

                <Card class='col-span-12 xl:col-span-5 rounded-3xl p-6'>
                  <Heading hint={stats()?.shotgunPelletCount > 1 ? `Per pellet, ${stats().shotgunPelletCount} pellets per shot` : 'Damage per bullet'}>Damage by range</Heading>
                  {stats() ? (
                    <>
                      <div class='flex flex-col gap-2'>
                        <div class='grid grid-cols-4 px-4 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted'><span>Range</span><span class='text-center'>Head</span><span class='text-center'>Body</span><span class='text-center'>Leg</span></div>
                        <For each={stats().damageRanges}>{(r, i) => (
                          <div class='glass-inset rounded-2xl grid grid-cols-4 items-center px-4 h-12 tabular-nums'>
                            <span class='text-[12px] text-muted'>{r.rangeStartMeters}-{r.rangeEndMeters} m</span>
                            <span class='text-center font-display text-[18px] font-bold text-accent'>{num(r.headDamage, 1)}</span>
                            <span class='text-center font-display text-[16px] font-bold text-text'>{num(r.bodyDamage, 1)}</span>
                            <span class='text-center font-display text-[15px] font-semibold text-muted'>{num(r.legDamage, 1)}</span>
                          </div>
                        )}</For>
                      </div>
                      {stats().adsStats && <p class='text-[11.5px] text-muted mt-4'>Aim down sights: {num(stats().adsStats.zoomMultiplier)}x zoom, {num(stats().adsStats.fireRate, 1)} rounds/sec.</p>}
                      {stats().damageRanges[0] && !(stats().shotgunPelletCount > 1) && (
                        <div class='mt-5 pt-5 border-t border-line grid grid-cols-2 gap-4'>
                          <For each={[['Headshots', stats().damageRanges[0].headDamage], ['Body shots', stats().damageRanges[0].bodyDamage]]}>{([l, d]) => (
                            <div>
                              <div class='eyebrow'>{l} to kill</div>
                              <div class='font-display text-[30px] font-bold tracking-tight tabular-nums mt-1'>{d > 0 ? Math.ceil(150 / d) : '-'}</div>
                              <div class='text-[11px] text-muted'>150 HP, close range</div>
                            </div>
                          )}</For>
                        </div>
                      )}
                    </>
                  ) : <p class='text-[13px] text-muted'>Melee only.</p>}
                </Card>
              </div>

              <section>
                <div class='flex items-end justify-between gap-4 mb-5 flex-wrap'>
                  <div>
                    <h3 class='font-display text-[22px] font-bold tracking-tight text-text'>Skins</h3>
                    <p class='text-[12px] text-muted mt-1'>{skins().length} {skins().length === 1 ? 'skin' : 'skins'} for the {weapon().displayName}</p>
                  </div>
                  <div class='flex items-center gap-2.5 flex-wrap'>
                    <div class='relative w-[240px]'>
                      <FiSearch class='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted z-10' size={14} />
                      <Input value={qS()} onInput={e => setQ(e.target.value)} placeholder={`Search ${weapon().displayName} skins`} class='!pl-9 !rounded-full' />
                    </div>
                    <Select value={tierS()} onChange={e => setTier(e.target.value)} class='!w-40 !rounded-full' options={[{ value: '', label: 'All tiers' }, ...tierOptions()]} />
                    {riotA().connected && <SegmentedTabs layoutId='weapons-owned' tabs={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }]} value={filterS()} onChange={setFilter} />}
                  </div>
                </div>
                {skins().length === 0 ? <Empty title='No skins found' hint='Try another tier or clear the search.' /> : (
                  <Stagger class='cv-list grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' style={st({ '--cv-h': '240px' })}>
                    {skins().map((s, i) => {
                      const t = tiersA()[lc(s.contentTierUuid)]
                      const color = tierColor(t)
                      const own = riotA().connected && skinOwned(weapon(), s, __owned.owned)
                      const wishId = !own && s.contentTierUuid && s.levels[0]?.uuid
                      return (
                        <Item index={i}>
                          <Card hover onClick={() => setSkin(s)} class='group relative overflow-hidden h-full flex flex-col'>
                            <div class='relative h-28 flex items-center justify-center px-6 pt-4' style={st(color ? { background: `linear-gradient(180deg, transparent 35%, ${color}14)` } : undefined)}>
                              <span class='absolute bottom-3 left-1/2 -translate-x-1/2 w-3/5 h-3 rounded-[50%] bg-black/35 blur-md pointer-events-none' />
                              {color && <span class='absolute inset-x-8 bottom-0 h-px pointer-events-none' style={st({ background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` })} />}
                              <img decoding='async' src={skinImage(s)} class='relative max-h-full max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]' loading='lazy' />
                              {wishId && <WishButton id={wishId} name={s.displayName} class={cx('absolute top-2.5 right-2.5 z-10', !wish.has(wishId) && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} />}
                            </div>
                            <div class='px-4 pb-4 pt-2'>
                              <div class='flex items-center gap-1.5'>
                                {t && <img decoding='async' src={t.displayIcon} class='w-3.5 h-3.5' title={t.displayName} />}
                                <span class='text-[13px] font-semibold tracking-tight text-text truncate'>{s.displayName}</span>
                              </div>
                              <div class='mt-2 flex items-center gap-1.5 flex-wrap'>
                                {own && <Badge tone='good'>Owned</Badge>}
                                {s.levels.length > 1 && <Badge>{s.levels.length} levels</Badge>}
                                {s.chromas.length > 1 && <Badge>{s.chromas.length} variants</Badge>}
                              </div>
                            </div>
                          </Card>
                        </Item>
                      )
                    })}
                  </Stagger>
                )}
              </section>
            </Swap>
          )}
        </div>
      )}
      <SkinModal skin={skinS()} weapon={weapon()} owned={riotA().connected ? __owned.owned : null} showOwned={riotA().connected} tiers={tiersA()} onClose={() => setSkin(null)} />
    </Page>)
  
}

// skin detail: video preview (or render) with level and variant pickers
function SkinModal(props) {
  const [liS, setLi] = createSignal(0)
  const [ciS, setCi] = createSignal(0)
  createEffect(on(() => props.skin, () => { setLi(0); setCi(0) }))
  
    
    const level = () => (props.skin.levels[liS()]), chroma = () => (props.skin.chromas[ciS()])
    const video = () => (ciS() > 0 ? chroma().streamedVideo || null : level().streamedVideo || props.skin.chromas[0]?.streamedVideo || null)
    const image = () => ((ciS() > 0 && chroma().fullRender) || skinImage(props.skin))
    const t = () => (props.tiers[lc(props.skin.contentTierUuid)])
    const own = () => (skinOwned(props.weapon, props.skin, props.owned))
    return (<Show when={!(!props.skin)} fallback={<Modal open={false} />}><Modal open onClose={props.onClose} width={720} title={props.skin.displayName}>
      <div class='space-y-5'>
        <div class='glass-inset rounded-2xl overflow-hidden aspect-video flex items-center justify-center'>
          {video()
            ? <video src={video()} class='w-full h-full' controls autoPlay loop muted playsInline poster={image() || undefined} />
            : <img decoding='async' src={image()} class='anim-pop max-h-full max-w-full object-contain p-6' />}
        </div>
        <div class='flex items-center gap-2 flex-wrap'>
          {t() && <Badge class='gap-1.5'><img decoding='async' src={t().displayIcon} class='w-3 h-3' />{t().displayName}</Badge>}
          <Badge>{props.weapon.displayName}</Badge>
          {props.showOwned && (own() ? <Badge tone='good'>Owned</Badge> : <Badge><FiLock /> Not owned</Badge>)}
          {!video() && <span class='text-[11px] text-muted ml-auto'>No video available for this selection</span>}
          {video() && <span class='text-[11px] text-muted ml-auto inline-flex items-center gap-1'><FiPlay /> Preview</span>}
        </div>
        {props.skin.levels.length > 1 && (
          <div>
            <SectionTitle>Levels</SectionTitle>
            <div class='flex flex-wrap gap-2'>
              <For each={props.skin.levels}>{(l, i) => (
                <button onClick={() => { setLi(i()); setCi(0) }}
                  class={cx('h-8 px-3.5 rounded-full border text-xs font-semibold transition-[transform,opacity,background-color,border-color,color] duration-200 inline-flex items-center gap-1.5', i() === liS() && ciS() === 0 ? 'accent-soft border-transparent text-text' : 'glass text-muted hover:text-text hover:border-accent/40')}>
                  Level {i() + 1}{levelItemLabel(l) && <span class='font-normal opacity-70'>{levelItemLabel(l)}</span>}
                  {props.showOwned && props.owned && !levelOwned(props.skin, l, props.owned) && <FiLock class='opacity-60' />}
                </button>
              )}</For>
            </div>
          </div>
        )}
        {props.skin.chromas.length > 1 && (
          <div>
            <SectionTitle>Variants</SectionTitle>
            <div class='flex flex-wrap gap-2'>
              <For each={props.skin.chromas}>{(c, i) => (
                <button onClick={() => setCi(i())} title={c.displayName}
                  class={cx('relative w-12 h-12 rounded-xl border flex items-center justify-center transition-[transform,opacity,background-color,border-color,color] duration-200 hover:-translate-y-0.5', i() === ciS() ? 'accent-soft border-transparent' : 'glass hover:border-accent/40')}>
                  {(c.swatch || c.fullRender) ? <img decoding='async' src={c.swatch || c.fullRender} class='w-7 h-7 object-contain' /> : <span class='text-[10px] text-muted'>{i() + 1}</span>}
                  {props.showOwned && props.owned && !chromaOwned(props.skin, c, props.owned) && <FiLock class='absolute -top-1 -right-1 text-[10px] text-muted bg-panel border border-line rounded-full p-0.5 w-4 h-4' />}
                </button>
              )}</For>
            </div>
          </div>
        )}
      </div>
    </Modal></Show>)
  
}
