import { useMemo, useState } from 'react'
import { FiCheck, FiPlus, FiRotateCcw, FiTrash2 } from 'react-icons/fi'
import { Badge, Button, Card, Empty, ErrorState, Heading, Input, Item, Modal, Page, RequireRiot, SectionTitle, SegmentedTabs, Skeleton, Stagger, Swap, cx, toast, withToast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent } from '../lib/content'
import SkinPicker, { selectionImage } from './tools/SkinPicker'
import BuddyPicker from './tools/BuddyPicker'
import { CATEGORIES, NO_TITLE, catKey, isStandard, lc, skinImage, useContentTiers, tierColor, useOwned, useWeapons } from './tools/gear'


export default function Loadout({ active }) {
  const riot = useRiot()
  if (!riot.connected) return <Page title='Loadout'><RequireRiot /></Page>
  return <LoadoutView active={active} />
}

// A gun with a pending edit applied. edit = { skinId, levelId, chromaId, buddy: {charmId, levelId, instance} | null }
function withEdit(g, e) {
  if (!e) return g
  const n = { ...g, SkinID: e.skinId, SkinLevelID: e.levelId, ChromaID: e.chromaId }
  if (e.buddy) { n.CharmID = e.buddy.charmId; n.CharmLevelID = e.buddy.levelId; n.CharmInstanceID = e.buddy.instance }
  else { delete n.CharmID; delete n.CharmLevelID; delete n.CharmInstanceID }
  return n
}
const gunToEdit = g => ({ skinId: g.SkinID, levelId: g.SkinLevelID, chromaId: g.ChromaID, buddy: g.CharmLevelID ? { charmId: g.CharmID, levelId: g.CharmLevelID, instance: g.CharmInstanceID } : null })

function LoadoutView({ active }) {
  const weapons = useWeapons()
  const { owned } = useOwned()
  const { data: loadout, error, loading, reload } = useInvoke('loadout:get', [], { poll: active ? 20000 : undefined })
  const presets = useInvoke('loadout:presets')
  const buddies = useContent('buddies')
  const sprays = useContent('sprays')
  const cards = useContent('playercards')
  const titles = useContent('playertitles')
  const tiers = useContentTiers()

  const [edits, setEdits] = useState({})
  const [editing, setEditing] = useState(null)   // weapon being edited
  const [tmp, setTmp] = useState(null)
  const [saving, setSaving] = useState(false)
  const [presetName, setPresetName] = useState('')
  const [confirmPreset, setConfirmPreset] = useState(null)
  const [applyingPreset, setApplyingPreset] = useState(false)
  const [filter, setFilter] = useState('all')

  const buddyIcon = useMemo(() => {
    const m = {}
    buddies?.forEach(b => b.levels.forEach(l => { m[lc(l.uuid)] = l.displayIcon }))
    return m
  }, [buddies])
  const weaponById = useMemo(() => weapons ? Object.fromEntries(weapons.map(w => [lc(w.uuid), w])) : {}, [weapons])

  const guns = loadout?.Guns || []
  const eff = g => withEdit(g, edits[lc(g.ID)])
  const pendingCount = Object.keys(edits).length

  const open = w => {
    const g = guns.find(x => lc(x.ID) === lc(w.uuid))
    setTmp(gunToEdit(eff(g)))
    setEditing(w)
  }
  // equips the edited gun in game right away
  const applyGun = async () => {
    const all = { ...edits, [lc(editing.uuid)]: tmp }
    setSaving(true)
    const r = await withToast(invoke('loadout:save', { Guns: guns.map(g => withEdit(g, all[lc(g.ID)])) }), `${editing.displayName} skin applied`)
    setSaving(false)
    if (r) { setEdits({}); setEditing(null); reload(true) }
  }
  const usedElsewhere = useMemo(() => {
    const s = new Set()
    if (editing) guns.forEach(g => { const x = eff(g); if (lc(g.ID) !== lc(editing.uuid) && x.CharmInstanceID) s.add(lc(x.CharmInstanceID)) })
    return s
  }, [editing, guns, edits])

  const apply = async () => {
    setSaving(true)
    const r = await withToast(invoke('loadout:save', { Guns: guns.map(eff) }), 'Loadout applied')
    setSaving(false)
    if (r) { setEdits({}); reload(true) }
  }

  const applyPreset = async () => {
    setApplyingPreset(true)
    const r = await withToast(invoke('loadout:presetApply', confirmPreset.id))
    setApplyingPreset(false)
    if (!r) return
    setConfirmPreset(null); setEdits({}); reload(true)
    toastSkipped(r.skipped, confirmPreset.name)
  }
  const savePreset = async () => {
    const r = await withToast(invoke('loadout:presetSave', presetName), 'Preset saved')
    if (r) { setPresetName(''); presets.reload(true) }
  }
  const delPreset = async p => {
    const r = await withToast(invoke('loadout:presetDelete', p.id))
    if (r) presets.reload(true)
  }

  const ready = loadout && weapons
  const identity = loadout?.Identity
  const card = cards?.find(c => lc(c.uuid) === lc(identity?.PlayerCardID))
  const title = titles?.find(t => lc(t.uuid) === lc(identity?.PlayerTitleID))
  const riot = useRiot()

  const tile = (g, w, index) => {
    const x = eff(g)
    const skin = w.skins.find(s => lc(s.uuid) === lc(x.SkinID))
    const li = skin ? skin.levels.findIndex(l => lc(l.uuid) === lc(x.SkinLevelID)) : 0
    const ci = skin ? skin.chromas.findIndex(c => lc(c.uuid) === lc(x.ChromaID)) : 0
    const chroma = skin?.chromas[ci]
    const tier = tiers[lc(skin?.contentTierUuid)]
    const color = tierColor(tier)
    const pending = !!edits[lc(g.ID)]
    return (
      <Item key={g.ID} index={index}>
        <Card hover onClick={() => open(w)} className={cx('group relative overflow-hidden h-[208px] flex flex-col', pending && '!border-warn/60')}>
          <div className='absolute inset-0 pointer-events-none' style={color ? { background: `radial-gradient(70% 60% at 50% 42%, ${color}2e, transparent 70%)` } : undefined} />
          {color && <div className='absolute inset-x-6 top-0 h-px' style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />}
          <div className='relative flex items-center justify-between h-7 mt-4 px-5'>
            <span className='eyebrow'>{w.displayName}</span>
            {pending ? <Badge tone='warn'>Pending</Badge> : x.CharmLevelID && buddyIcon[lc(x.CharmLevelID)] && <img decoding='async' src={buddyIcon[lc(x.CharmLevelID)]} className='w-7 h-7 object-contain' title='Buddy' />}
          </div>
          <div className='relative flex-1 min-h-0 flex items-center justify-center px-6'>
            <img decoding='async' src={selectionImage(skin, x.ChromaID) || w.displayIcon} className='max-h-[92px] max-w-full object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-out group-hover:scale-[1.06]' loading='lazy' />
          </div>
          <div className='relative px-5 pb-4'>
            <div className='flex items-center gap-1.5'>
              {tier && <img decoding='async' src={tier.displayIcon} className='w-3.5 h-3.5' />}
              <span className='text-[14px] font-semibold tracking-tight truncate text-text'>{skin?.displayName || 'Standard'}</span>
            </div>
            <div className='flex items-center gap-1.5 mt-1.5 flex-wrap min-h-[20px]'>
              {skin && skin.levels.length > 1 && <Badge>Lv {li + 1}/{skin.levels.length}</Badge>}
              {ci > 0 && chroma && <Badge tone='accent'>Variant {ci + 1}</Badge>}
              {skin && isStandard(w, skin) && <Badge>Standard</Badge>}
              {pending && x.CharmLevelID && buddyIcon[lc(x.CharmLevelID)] && <img decoding='async' src={buddyIcon[lc(x.CharmLevelID)]} className='w-5 h-5 object-contain' title='Buddy' />}
            </div>
          </div>
        </Card>
      </Item>
    )
  }
  const cats = CATEGORIES.map(cat => ({ ...cat, list: guns.map(g => ({ g, w: weaponById[lc(g.ID)] })).filter(x => x.w && catKey(x.w) === cat.key) })).filter(c => c.list.length)
  const shownCats = filter === 'all' ? cats : cats.filter(c => c.key === filter)

  return (
    <Page title='Loadout' subtitle='Your equipped arsenal. Pick any weapon to change its skin, variant and buddy.'
      actions={pendingCount > 0 && <>
        <Badge tone='warn'>{pendingCount} pending</Badge>
        <Button size='sm' variant='ghost' icon={FiRotateCcw} onClick={() => setEdits({})}>Discard</Button>
        <Button size='sm' variant='primary' icon={FiCheck} loading={saving} onClick={apply}>Apply changes</Button>
      </>}>
      {error && !loadout ? <ErrorState error={error} onRetry={reload} /> : (
        <div className='flex flex-col gap-8'>
          <div className='bento'>
            <Card className='col-span-12 xl:col-span-5 relative overflow-hidden rounded-3xl min-h-[210px]'>
              {card?.wideArt && <img decoding='async' src={card.wideArt} className='absolute inset-0 w-full h-full object-cover' draggable={false} />}
              {card?.wideArt ? <div className='absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5' /> : <span className='halo -top-24 -left-20 w-80 h-80' />}
              <div className='relative h-full p-6 flex flex-col justify-end'>
                <div className={cx('eyebrow mb-2', card?.wideArt && '!text-white/70')}>Identity</div>
                {!identity ? <Skeleton className='h-14 rounded-xl' /> : (
                  <>
                    <div className={cx('display text-[30px] truncate', card?.wideArt ? 'text-white' : 'text-text')}>{riot.gameName || 'Player'}</div>
                    <div className={cx('mt-1.5 text-[12.5px] truncate', card?.wideArt ? 'text-white/75' : 'text-muted')}>
                      {lc(identity.PlayerTitleID) === NO_TITLE ? 'No title' : (title?.titleText || title?.displayName || 'Unknown title')} · {card?.displayName || 'Default card'} · Level {identity.HideAccountLevel ? 'hidden' : 'visible'}
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card className='col-span-12 md:col-span-5 xl:col-span-3 p-5 rounded-3xl'>
              <Heading hint='Your spray wheel'>Sprays</Heading>
              {!loadout ? <Skeleton className='h-24 rounded-2xl' /> : (
                <div className='grid grid-cols-2 gap-2'>
                  {loadout.ActiveExpressions.slice(0, 4).map((e, i) => {
                    const sp = sprays?.find(s => lc(s.uuid) === lc(e.AssetID))
                    return (
                      <div key={i} className='glass-inset h-[58px] rounded-2xl flex items-center justify-center p-2' title={sp?.displayName || 'Expression'}>
                        {sp ? <img decoding='async' src={sp.fullTransparentIcon || sp.displayIcon} className='max-h-full max-w-full object-contain' /> : <span className='text-[10px] text-muted'>Flex</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              {loadout?.ActiveExpressions.length > 4 && (
                <div className='flex gap-2 mt-2'>
                  {loadout.ActiveExpressions.slice(4).map((e, i) => {
                    const sp = sprays?.find(s => lc(s.uuid) === lc(e.AssetID))
                    return <div key={i} className='glass-inset flex-1 h-10 rounded-xl flex items-center justify-center p-1.5' title={sp?.displayName || 'Expression'}>{sp ? <img decoding='async' src={sp.fullTransparentIcon || sp.displayIcon} className='max-h-full max-w-full object-contain' /> : <span className='text-[10px] text-muted'>Flex</span>}</div>
                  })}
                </div>
              )}
            </Card>

            <Card className='col-span-12 md:col-span-7 xl:col-span-4 p-5 rounded-3xl flex flex-col'>
              <Heading hint='Save and switch whole loadouts'>Presets</Heading>
              <div className='flex gap-2 mb-3'>
                <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder='Name this loadout' className='!rounded-full' onKeyDown={e => e.key === 'Enter' && savePreset()} />
                <Button size='icon' variant='glow' className='!w-10 !h-10 shrink-0' icon={FiPlus} onClick={savePreset} disabled={!loadout} title='Save the applied loadout as a preset' />
              </div>
              {presets.loading && !presets.data ? <Skeleton className='h-12 rounded-2xl' /> : !presets.data?.length ? (
                <p className='text-[12px] text-muted leading-relaxed py-2'>No presets yet. Save your applied loadout to switch back to it in one click.</p>
              ) : (
                <div className='flex flex-col gap-1.5 max-h-[118px] overflow-y-auto -mr-2 pr-2'>
                  {presets.data.map(p => (
                    <div key={p.id} className='group glass-inset rounded-2xl pl-3.5 pr-1.5 py-1.5 flex items-center gap-2'>
                      <div className='min-w-0 flex-1'>
                        <div className='text-[13px] font-semibold truncate'>{p.name}</div>
                        <PresetThumbs preset={p} weaponById={weaponById} />
                      </div>
                      <Button size='sm' variant='ghost' icon={FiTrash2} className='!px-2 opacity-0 group-hover:opacity-100' title='Delete preset' onClick={() => delPreset(p)} />
                      <Button size='sm' variant='subtle' onClick={() => setConfirmPreset(p)}>Apply</Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <section>
            <div className='flex items-center justify-between gap-4 mb-5'>
              <SegmentedTabs layoutId='loadout-filter' value={filter} onChange={setFilter}
                tabs={[{ value: 'all', label: 'All', count: guns.length || undefined }, ...cats.map(c => ({ value: c.key, label: c.label, count: c.list.length }))]} />
              <span className='text-[12px] text-muted'>Changes are applied in game when you press Apply</span>
            </div>
            {!ready || loading && !loadout ? (
              <div className='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='h-[208px] rounded-2xl' />)}</div>
            ) : (
              <Swap id={filter} className='flex flex-col gap-8'>
                {shownCats.map(cat => (
                  <div key={cat.key}>
                    {filter === 'all' && <SectionTitle right={<span className='text-[11px] text-muted tabular-nums'>{cat.list.length}</span>}>{cat.label}</SectionTitle>}
                    <Stagger className='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                      {cat.list.map(({ g, w }, i) => tile(g, w, i))}
                    </Stagger>
                  </div>
                ))}
              </Swap>
            )}
          </section>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} width={760} title={editing ? `${editing.displayName} skin` : ''}
        footer={<><Button variant='ghost' onClick={() => setEditing(null)}>Cancel</Button><Button variant='primary' loading={saving} onClick={applyGun}>Apply</Button></>}>
        {editing && tmp && (
          <div className='space-y-5'>
            <SkinPicker weapon={editing} owned={owned} value={tmp} onChange={v => setTmp(t => ({ ...t, ...v }))} />
            {catKey(editing) !== 'Melee' && (
              <div>
                <SectionTitle>Buddy</SectionTitle>
                <BuddyPicker owned={owned} value={tmp.buddy} usedInstances={usedElsewhere} onChange={b => setTmp(t => ({ ...t, buddy: b }))} />
              </div>
            )}
            <p className='text-[11.5px] text-muted'>Only items you own are listed. Apply equips it in game right away.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmPreset} onClose={() => setConfirmPreset(null)} title='Apply preset' width={420}
        footer={<><Button variant='ghost' onClick={() => setConfirmPreset(null)}>Cancel</Button><Button variant='primary' loading={applyingPreset} onClick={applyPreset}>Apply preset</Button></>}>
        <p className='text-[13px]'>Apply <b>{confirmPreset?.name}</b> to your loadout? Items you no longer own are skipped and keep their current setting. Any pending edits here are discarded.</p>
      </Modal>
    </Page>
  )
}

function toastSkipped(skipped, name) {
  if (skipped.length) toast(`${name} applied. Skipped (not owned): ${skipped.join(', ')}`)
}

function PresetThumbs({ preset, weaponById }) {
  const items = preset.loadout.Guns.map(g => {
    const w = weaponById[lc(g.ID)]
    const s = w?.skins.find(x => lc(x.uuid) === lc(g.SkinID))
    return w && s && !isStandard(w, s) ? skinImage(s) : null
  }).filter(Boolean).slice(0, 5)
  if (!items.length) return null
  return <div className='flex gap-1.5 mt-1'>{items.map((src, i) => <img decoding='async' key={i} src={src} className='h-4 flex-1 min-w-0 object-contain opacity-70' />)}</div>
}
