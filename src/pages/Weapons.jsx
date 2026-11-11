import { useMemo, useState } from 'react'
import { FiLock, FiPlay, FiSearch } from 'react-icons/fi'
import { Badge, Card, Empty, Heading, Input, Item, Modal, Page, SectionTitle, SegmentedTabs, Select, Skeleton, Stagger, Stat, Swap, cx, Pill } from '../ui'
import { useRiot } from '../lib/riot'
import { WishButton, useWishlist } from '../lib/wishlist'
import { useStored } from '../lib/stored'
import { CATEGORIES, catKey, chromaOwned, isStandard, lc, levelItemLabel, levelOwned, skinImage, skinOwned, tierColor, useContentTiers, useOwned, useWeapons } from './tools/gear'

const pen = p => (p || '').split('::').pop() || '-'
const num = (v, d = 2) => v == null ? '-' : String(Math.round(v * 10 ** d) / 10 ** d)

export default function Weapons() {
  const wish = useWishlist()
  const riot = useRiot()
  const weapons = useWeapons()
  const { owned } = useOwned(!riot.connected)
  const tiers = useContentTiers()
  // the category, weapon and All / Owned choice are remembered between launches
  const [cat, setCat] = useStored('weapons-cat', 'Rifle')
  const [wid, setWid] = useStored('weapons-wid', null)
  const [filter, setFilter] = useStored('weapons-filter', 'all', ['all', 'owned'])
  const [tier, setTier] = useState('')
  const [q, setQ] = useState('')
  const [skin, setSkin] = useState(null)

  const inCat = weapons?.filter(w => catKey(w) === cat) || []
  const weapon = inCat.find(w => lc(w.uuid) === lc(wid)) || inCat[0]
  const stats = weapon?.weaponStats

  const tierOptions = useMemo(() => {
    if (!weapon) return []
    const ids = [...new Set(weapon.skins.map(s => lc(s.contentTierUuid)).filter(Boolean))]
    return ids.map(id => ({ value: id, label: tiers[id]?.displayName || 'Tier' }))
  }, [weapon, tiers])

  const skins = useMemo(() => {
    if (!weapon) return []
    return weapon.skins
      .filter(s => (filter !== 'owned' || skinOwned(weapon, s, owned)) && (!tier || lc(s.contentTierUuid) === tier) && s.displayName.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => (isStandard(weapon, b) - isStandard(weapon, a)) || a.displayName.localeCompare(b.displayName))
  }, [weapon, filter, tier, q, owned])

  return (
    <Page title='Weapons' subtitle='Stats, damage falloff and every skin for each weapon'
      actions={<SegmentedTabs layoutId='weapons-cat' tabs={CATEGORIES.map(c => ({ value: c.key, label: c.label }))} value={cat} onChange={c => { setCat(c); setWid(null); setTier(''); setQ('') }} />}>
      {!weapons ? (
        <div className='space-y-5'><Skeleton className='h-16 rounded-2xl' /><Skeleton className='h-72 rounded-3xl' /></div>
      ) : (
        <div className='space-y-8'>
          <div className='glass rounded-full p-1.5 flex gap-1 w-fit max-w-full overflow-x-auto'>
            {inCat.map(w => {
              const on = weapon && lc(w.uuid) === lc(weapon.uuid)
              return (
                <button key={w.uuid} onClick={() => { setWid(w.uuid); setTier(''); setQ('') }}
                  className={cx('relative h-11 pl-3 pr-4 rounded-full flex items-center gap-2.5 shrink-0 transition-colors', on ? 'text-text' : 'text-muted hover:text-text')}>
                  {on && <Pill layoutId='weapons-pick' />}
                  <img decoding='async' src={w.displayIcon} className='relative h-6 w-14 object-contain' />
                  <span className='relative text-[12.5px] font-semibold tracking-tight'>{w.displayName}</span>
                </button>
              )
            })}
          </div>

          {weapon && (
            <Swap id={weapon.uuid} className='space-y-8'>
              <div className='bento'>
                <Card className='col-span-12 xl:col-span-7 relative overflow-hidden rounded-3xl p-7 flex flex-col min-h-[300px]'>
                  <span className='halo -top-28 -right-16 w-[420px] h-[420px] opacity-80' />
                  <div className='relative flex items-start justify-between gap-3'>
                    <div>
                      <div className='eyebrow mb-2'>{CATEGORIES.find(c => c.key === cat)?.label}</div>
                      <h2 className='display text-[44px] text-text'>{weapon.displayName}</h2>
                    </div>
                    {weapon.shopData && <Badge tone='accent' className='!h-7 !px-3 !text-[11px]'>{weapon.shopData.cost > 0 ? `${weapon.shopData.cost} credits` : 'Free'}</Badge>}
                  </div>
                  <div className='relative flex-1 flex items-center justify-center py-4'>
                    <img decoding='async' src={weapon.displayIcon} className='max-h-[120px] max-w-[85%] object-contain drop-shadow-[0_18px_30px_rgb(0_0_0/0.4)]' />
                  </div>
                  {stats ? (
                    <div className='relative glass-inset rounded-2xl grid grid-cols-3 lg:grid-cols-6 divide-x divide-line'>
                      {[['Fire rate', num(stats.fireRate, 1), 'per sec'], ['Magazine', stats.magazineSize, 'rounds'], ['Reload', num(stats.reloadTimeSeconds), 'sec'], ['Equip', num(stats.equipTimeSeconds), 'sec'], ['Run speed', num(stats.runSpeedMultiplier), 'x'], ['Wall pen', pen(stats.wallPenetration), '']].map(([l, v, sub]) => (
                        <Stat key={l} label={l} value={v} sub={sub} className={'px-4 py-3 min-w-0' + (l === 'Wall pen' ? ' [&>div:nth-child(2)]:text-[17px] [&>div:nth-child(2)]:leading-8' : '')} />
                      ))}
                    </div>
                  ) : <p className='relative text-[13px] text-muted'>The melee weapon has no ballistic stats.</p>}
                </Card>

                <Card className='col-span-12 xl:col-span-5 rounded-3xl p-6'>
                  <Heading hint={stats?.shotgunPelletCount > 1 ? `Per pellet, ${stats.shotgunPelletCount} pellets per shot` : 'Damage per bullet'}>Damage by range</Heading>
                  {stats ? (
                    <>
                      <div className='flex flex-col gap-2'>
                        <div className='grid grid-cols-4 px-4 text-[10.5px] font-semibold tracking-[0.12em] uppercase text-muted'><span>Range</span><span className='text-center'>Head</span><span className='text-center'>Body</span><span className='text-center'>Leg</span></div>
                        {stats.damageRanges.map((r, i) => (
                          <div key={i} className='glass-inset rounded-2xl grid grid-cols-4 items-center px-4 h-12 tabular-nums'>
                            <span className='text-[12px] text-muted'>{r.rangeStartMeters}-{r.rangeEndMeters} m</span>
                            <span className='text-center font-display text-[18px] font-bold text-accent'>{num(r.headDamage, 1)}</span>
                            <span className='text-center font-display text-[16px] font-bold text-text'>{num(r.bodyDamage, 1)}</span>
                            <span className='text-center font-display text-[15px] font-semibold text-muted'>{num(r.legDamage, 1)}</span>
                          </div>
                        ))}
                      </div>
                      {stats.adsStats && <p className='text-[11.5px] text-muted mt-4'>Aim down sights: {num(stats.adsStats.zoomMultiplier)}x zoom, {num(stats.adsStats.fireRate, 1)} rounds/sec.</p>}
                      {stats.damageRanges[0] && !(stats.shotgunPelletCount > 1) && (
                        <div className='mt-5 pt-5 border-t border-line grid grid-cols-2 gap-4'>
                          {[['Headshots', stats.damageRanges[0].headDamage], ['Body shots', stats.damageRanges[0].bodyDamage]].map(([l, d]) => (
                            <div key={l}>
                              <div className='eyebrow'>{l} to kill</div>
                              <div className='font-display text-[30px] font-bold tracking-tight tabular-nums mt-1'>{d > 0 ? Math.ceil(150 / d) : '-'}</div>
                              <div className='text-[11px] text-muted'>150 HP, close range</div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  ) : <p className='text-[13px] text-muted'>Melee only.</p>}
                </Card>
              </div>

              <section>
                <div className='flex items-end justify-between gap-4 mb-5 flex-wrap'>
                  <div>
                    <h3 className='font-display text-[22px] font-bold tracking-tight text-text'>Skins</h3>
                    <p className='text-[12px] text-muted mt-1'>{skins.length} {skins.length === 1 ? 'skin' : 'skins'} for the {weapon.displayName}</p>
                  </div>
                  <div className='flex items-center gap-2.5 flex-wrap'>
                    <div className='relative w-[240px]'>
                      <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted z-10' size={14} />
                      <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${weapon.displayName} skins`} className='!pl-9 !rounded-full' />
                    </div>
                    <Select value={tier} onChange={e => setTier(e.target.value)} className='!w-40 !rounded-full' options={[{ value: '', label: 'All tiers' }, ...tierOptions]} />
                    {riot.connected && <SegmentedTabs layoutId='weapons-owned' tabs={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }]} value={filter} onChange={setFilter} />}
                  </div>
                </div>
                {skins.length === 0 ? <Empty title='No skins found' hint='Try another tier or clear the search.' /> : (
                  <Stagger key={filter + tier + q} className='cv-list grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4' style={{ '--cv-h': '240px' }}>
                    {skins.map((s, i) => {
                      const t = tiers[lc(s.contentTierUuid)]
                      const color = tierColor(t)
                      const own = riot.connected && skinOwned(weapon, s, owned)
                      const wishId = !own && s.contentTierUuid && s.levels[0]?.uuid
                      return (
                        <Item key={s.uuid} index={i}>
                          <Card hover onClick={() => setSkin(s)} className='group relative overflow-hidden h-full flex flex-col'>
                            <div className='relative h-28 flex items-center justify-center px-6 pt-4' style={color ? { background: `linear-gradient(180deg, transparent 35%, ${color}14)` } : undefined}>
                              <span className='absolute bottom-3 left-1/2 -translate-x-1/2 w-3/5 h-3 rounded-[50%] bg-black/35 blur-md pointer-events-none' />
                              {color && <span className='absolute inset-x-8 bottom-0 h-px pointer-events-none' style={{ background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />}
                              <img decoding='async' src={skinImage(s)} className='relative max-h-full max-w-full object-contain transition-transform duration-500 ease-out group-hover:scale-[1.04]' loading='lazy' />
                              {wishId && <WishButton id={wishId} name={s.displayName} className={cx('absolute top-2.5 right-2.5 z-10', !wish.has(wishId) && 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100')} />}
                            </div>
                            <div className='px-4 pb-4 pt-2'>
                              <div className='flex items-center gap-1.5'>
                                {t && <img decoding='async' src={t.displayIcon} className='w-3.5 h-3.5' title={t.displayName} />}
                                <span className='text-[13px] font-semibold tracking-tight text-text truncate'>{s.displayName}</span>
                              </div>
                              <div className='mt-2 flex items-center gap-1.5 flex-wrap'>
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
      <SkinModal skin={skin} weapon={weapon} owned={riot.connected ? owned : null} showOwned={riot.connected} tiers={tiers} onClose={() => setSkin(null)} />
    </Page>
  )
}

// skin detail: video preview (or render) with level and variant pickers
function SkinModal({ skin, weapon, owned, showOwned, tiers, onClose }) {
  const [li, setLi] = useState(0)
  const [ci, setCi] = useState(0)
  const [lastSkin, setLastSkin] = useState(null)
  if (skin !== lastSkin) { setLastSkin(skin); setLi(0); setCi(0) }
  if (!skin) return <Modal open={false} />
  const level = skin.levels[li], chroma = skin.chromas[ci]
  // A picked variant wins
  const video = ci > 0 ? chroma.streamedVideo || null : level.streamedVideo || skin.chromas[0]?.streamedVideo || null
  const image = (ci > 0 && chroma.fullRender) || skinImage(skin)
  const t = tiers[lc(skin.contentTierUuid)]
  const own = skinOwned(weapon, skin, owned)

  return (
    <Modal open onClose={onClose} width={720} title={skin.displayName}>
      <div className='space-y-5'>
        <div className='glass-inset rounded-2xl overflow-hidden aspect-video flex items-center justify-center'>
          {video
            ? <video key={video} src={video} className='w-full h-full' controls autoPlay loop muted playsInline poster={image || undefined} />
            : <img decoding='async' key={image} src={image} className='anim-pop max-h-full max-w-full object-contain p-6' />}
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          {t && <Badge className='gap-1.5'><img decoding='async' src={t.displayIcon} className='w-3 h-3' />{t.displayName}</Badge>}
          <Badge>{weapon.displayName}</Badge>
          {showOwned && (own ? <Badge tone='good'>Owned</Badge> : <Badge><FiLock /> Not owned</Badge>)}
          {!video && <span className='text-[11px] text-muted ml-auto'>No video available for this selection</span>}
          {video && <span className='text-[11px] text-muted ml-auto inline-flex items-center gap-1'><FiPlay /> Preview</span>}
        </div>
        {skin.levels.length > 1 && (
          <div>
            <SectionTitle>Levels</SectionTitle>
            <div className='flex flex-wrap gap-2'>
              {skin.levels.map((l, i) => (
                <button key={l.uuid} onClick={() => { setLi(i); setCi(0) }}
                  className={cx('h-8 px-3.5 rounded-full border text-xs font-semibold transition-[transform,opacity,background-color,border-color,color] duration-200 inline-flex items-center gap-1.5', i === li && ci === 0 ? 'accent-soft border-transparent text-text' : 'glass text-muted hover:text-text hover:border-accent/40')}>
                  Level {i + 1}{levelItemLabel(l) && <span className='font-normal opacity-70'>{levelItemLabel(l)}</span>}
                  {showOwned && owned && !levelOwned(skin, l, owned) && <FiLock className='opacity-60' />}
                </button>
              ))}
            </div>
          </div>
        )}
        {skin.chromas.length > 1 && (
          <div>
            <SectionTitle>Variants</SectionTitle>
            <div className='flex flex-wrap gap-2'>
              {skin.chromas.map((c, i) => (
                <button key={c.uuid} onClick={() => setCi(i)} title={c.displayName}
                  className={cx('relative w-12 h-12 rounded-xl border flex items-center justify-center transition-[transform,opacity,background-color,border-color,color] duration-200 hover:-translate-y-0.5', i === ci ? 'accent-soft border-transparent' : 'glass hover:border-accent/40')}>
                  {(c.swatch || c.fullRender) ? <img decoding='async' src={c.swatch || c.fullRender} className='w-7 h-7 object-contain' /> : <span className='text-[10px] text-muted'>{i + 1}</span>}
                  {showOwned && owned && !chromaOwned(skin, c, owned) && <FiLock className='absolute -top-1 -right-1 text-[10px] text-muted bg-panel border border-line rounded-full p-0.5 w-4 h-4' />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
