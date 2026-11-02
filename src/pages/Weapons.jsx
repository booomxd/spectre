import { useMemo, useState } from 'react'
import { FiLock, FiPlay, FiSearch } from 'react-icons/fi'
import { Badge, Card, Empty, Input, Modal, Page, SectionTitle, Select, Skeleton, Stat, Tabs } from '../ui'
import { useRiot } from '../lib/riot'
import { CATEGORIES, catKey, chromaOwned, isStandard, lc, levelItemLabel, levelOwned, skinImage, skinOwned, tierColor, useContentTiers, useOwned, useWeapons } from './tools/gear'

const cx = (...c) => c.filter(Boolean).join(' ')
const pen = p => (p || '').split('::').pop() || '-'
const num = (v, d = 2) => v == null ? '-' : String(Math.round(v * 10 ** d) / 10 ** d)

export default function Weapons() {
  const riot = useRiot()
  const weapons = useWeapons()
  const { owned } = useOwned(!riot.connected)
  const tiers = useContentTiers()
  const [cat, setCat] = useState('Rifle')
  const [wid, setWid] = useState(null)
  const [filter, setFilter] = useState('all')
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
    <Page title='Weapons' subtitle='Stats, damage falloff and every skin for each weapon.'
      actions={<Tabs tabs={CATEGORIES.map(c => ({ value: c.key, label: c.label }))} value={cat} onChange={c => { setCat(c); setWid(null); setTier(''); setQ('') }} />}>
      {!weapons ? (
        <div className='grid grid-cols-[320px_1fr] gap-5'><Skeleton className='h-96 rounded-xl' /><Skeleton className='h-96 rounded-xl' /></div>
      ) : (
        <div className='space-y-5'>
          <div className='flex gap-2 stagger'>
            {inCat.map((w, i) => (
              <button key={w.uuid} style={{ '--i': i }} onClick={() => { setWid(w.uuid); setTier(''); setQ('') }}
                className={cx('anim-rise lift flex-1 min-w-0 max-w-[170px] rounded-xl border px-3 py-2.5 text-center', weapon && lc(w.uuid) === lc(weapon.uuid) ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
                <img src={w.displayIcon} className='h-9 mx-auto object-contain' />
                <div className='mt-1 text-[11px] font-semibold uppercase tracking-wide truncate'>{w.displayName}</div>
              </button>
            ))}
          </div>

          {weapon && (
            <div className='grid grid-cols-[320px_1fr] gap-5 items-start' key={weapon.uuid}>
              <Card className='p-4 anim-rise space-y-4'>
                <div className='flex items-center justify-between'>
                  <h2 className='font-display text-xl font-bold uppercase'>{weapon.displayName}</h2>
                  {weapon.shopData && <Badge tone='accent'>{weapon.shopData.cost > 0 ? `${weapon.shopData.cost} cr` : 'Free'}</Badge>}
                </div>
                {stats ? (
                  <>
                    <div className='grid grid-cols-2 gap-x-4 gap-y-3'>
                      <Stat label='Fire rate' value={num(stats.fireRate, 1)} sub='rounds / sec' />
                      <Stat label='Magazine' value={stats.magazineSize} sub='rounds' />
                      <Stat label='Reload' value={num(stats.reloadTimeSeconds)} sub='seconds' />
                      <Stat label='Equip' value={num(stats.equipTimeSeconds)} sub='seconds' />
                      <Stat label='Run speed' value={num(stats.runSpeedMultiplier)} sub='multiplier' />
                      <Stat label='Wall pen' value={pen(stats.wallPenetration)} />
                    </div>
                    <div>
                      <SectionTitle>Damage by range</SectionTitle>
                      <table className='w-full text-[12px]'>
                        <thead><tr className='text-muted text-[10px] uppercase tracking-wider'><th className='text-left font-semibold pb-1.5'>Range</th><th className='pb-1.5'>Head</th><th className='pb-1.5'>Body</th><th className='pb-1.5'>Leg</th></tr></thead>
                        <tbody>
                          {stats.damageRanges.map((r, i) => (
                            <tr key={i} className='border-t border-line text-center'>
                              <td className='py-1.5 text-left text-muted'>{r.rangeStartMeters}-{r.rangeEndMeters} m</td>
                              <td className='font-semibold text-accent'>{num(r.headDamage, 1)}</td>
                              <td>{num(r.bodyDamage, 1)}</td>
                              <td className='text-muted'>{num(r.legDamage, 1)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {stats.shotgunPelletCount > 1 && <p className='text-[11px] text-muted mt-2'>Damage is per pellet, {stats.shotgunPelletCount} pellets per shot.</p>}
                    </div>
                    {stats.adsStats && <p className='text-[11px] text-muted'>Aim down sights: {num(stats.adsStats.zoomMultiplier)}x zoom, {num(stats.adsStats.fireRate, 1)} rounds/sec.</p>}
                  </>
                ) : <p className='text-[13px] text-muted'>The melee weapon has no ballistic stats.</p>}
              </Card>

              <div className='min-w-0 anim-rise' style={{ animationDelay: '60ms' }}>
                <div className='flex items-center gap-2 mb-3 flex-wrap'>
                  <div className='relative flex-1 min-w-[160px]'>
                    <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
                    <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${weapon.displayName} skins`} className='pl-9' />
                  </div>
                  <Select value={tier} onChange={e => setTier(e.target.value)} className='!w-40' options={[{ value: '', label: 'All tiers' }, ...tierOptions]} />
                  {riot.connected && <Tabs tabs={[{ value: 'all', label: 'All' }, { value: 'owned', label: 'Owned' }]} value={filter} onChange={setFilter} />}
                </div>
                {skins.length === 0 ? <Empty title='No skins found' hint='Try another tier or clear the search.' /> : (
                  <div className='grid grid-cols-3 gap-3 stagger'>
                    {skins.map((s, i) => {
                      const t = tiers[lc(s.contentTierUuid)]
                      const own = riot.connected && skinOwned(weapon, s, owned)
                      return (
                        <Card key={s.uuid} hover style={{ '--i': Math.min(i, 14) }} onClick={() => setSkin(s)} className='anim-rise p-3'>
                          <div className='h-20 flex items-center justify-center'>
                            <img src={skinImage(s)} className='max-h-full max-w-full object-contain' loading='lazy' />
                          </div>
                          <div className='mt-2 flex items-center gap-1.5'>
                            {t && <img src={t.displayIcon} className='w-3.5 h-3.5' title={t.displayName} />}
                            <span className='text-[12px] font-semibold truncate' style={{ color: tierColor(t) }}>{s.displayName}</span>
                          </div>
                          <div className='mt-1.5 flex items-center gap-1.5 flex-wrap'>
                            {own && <Badge tone='good'>Owned</Badge>}
                            {s.levels.length > 1 && <Badge>{s.levels.length} levels</Badge>}
                            {s.chromas.length > 1 && <Badge>{s.chromas.length} variants</Badge>}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
      <SkinModal skin={skin} weapon={weapon} owned={riot.connected ? owned : null} showOwned={riot.connected} tiers={tiers} onClose={() => setSkin(null)} />
    </Page>
  )
}

// Skin detail: video preview (or render) with level and variant pickers.
function SkinModal({ skin, weapon, owned, showOwned, tiers, onClose }) {
  const [li, setLi] = useState(0)
  const [ci, setCi] = useState(0)
  const [lastSkin, setLastSkin] = useState(null)
  if (skin !== lastSkin) { setLastSkin(skin); setLi(0); setCi(0) }
  if (!skin) return <Modal open={false} />
  const level = skin.levels[li], chroma = skin.chromas[ci]
  // A picked variant wins; otherwise the level's video.
  const video = ci > 0 ? chroma.streamedVideo || null : level.streamedVideo || skin.chromas[0]?.streamedVideo || null
  const image = (ci > 0 && chroma.fullRender) || skinImage(skin)
  const t = tiers[lc(skin.contentTierUuid)]
  const own = skinOwned(weapon, skin, owned)

  return (
    <Modal open onClose={onClose} width={720} title={skin.displayName}>
      <div className='space-y-4'>
        <div className='rounded-xl bg-black/40 border border-line overflow-hidden aspect-video flex items-center justify-center'>
          {video
            ? <video key={video} src={video} className='w-full h-full' controls autoPlay loop muted playsInline poster={image || undefined} />
            : <img key={image} src={image} className='anim-pop max-h-full max-w-full object-contain p-6' />}
        </div>
        <div className='flex items-center gap-2 flex-wrap'>
          {t && <Badge className='gap-1.5'><img src={t.displayIcon} className='w-3 h-3' />{t.displayName}</Badge>}
          <Badge>{weapon.displayName}</Badge>
          {showOwned && (own ? <Badge tone='good'>Owned</Badge> : <Badge><FiLock /> Not owned</Badge>)}
          {!video && <span className='text-[11px] text-muted ml-auto'>No video available for this selection</span>}
          {video && <span className='text-[11px] text-muted ml-auto inline-flex items-center gap-1'><FiPlay /> Preview</span>}
        </div>
        {skin.levels.length > 1 && (
          <div>
            <SectionTitle>Levels</SectionTitle>
            <div className='flex flex-wrap gap-1.5'>
              {skin.levels.map((l, i) => (
                <button key={l.uuid} onClick={() => { setLi(i); setCi(0) }}
                  className={cx('h-8 px-3 rounded-lg border text-xs font-semibold transition-all inline-flex items-center gap-1.5', i === li && ci === 0 ? 'border-accent bg-accent/15 text-accent' : 'border-line text-muted hover:text-text')}>
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
                  className={cx('relative w-11 h-11 rounded-lg border bg-surface-2 flex items-center justify-center transition-all hover:-translate-y-0.5', i === ci ? 'border-accent ring-1 ring-accent/50' : 'border-line')}>
                  {(c.swatch || c.fullRender) ? <img src={c.swatch || c.fullRender} className='w-7 h-7 object-contain' /> : <span className='text-[10px] text-muted'>{i + 1}</span>}
                  {showOwned && owned && !chromaOwned(skin, c, owned) && <FiLock className='absolute -top-1 -right-1 text-[10px] text-muted bg-surface rounded-full p-0.5 w-4 h-4' />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </Modal>
  )
}
