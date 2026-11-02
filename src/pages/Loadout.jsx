import { useMemo, useState } from 'react'
import { FiCheck, FiPlus, FiRotateCcw, FiTrash2, FiUser } from 'react-icons/fi'
import { Badge, Button, Card, Empty, ErrorState, Input, Modal, Page, RequireRiot, SectionTitle, Skeleton, toast, withToast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent } from '../lib/content'
import { navigate } from '../nav'
import SkinPicker, { selectionImage } from './tools/SkinPicker'
import BuddyPicker from './tools/BuddyPicker'
import { CATEGORIES, NO_TITLE, catKey, isStandard, lc, skinImage, useContentTiers, tierColor, useOwned, useWeapons } from './tools/gear'

const cx = (...c) => c.filter(Boolean).join(' ')

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
const sameEdit = (a, b) => ['skinId', 'levelId', 'chromaId'].every(k => lc(a[k]) === lc(b[k])) && lc(a.buddy?.instance) === lc(b.buddy?.instance) && lc(a.buddy?.levelId) === lc(b.buddy?.levelId)

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
  const stage = () => {
    const g = guns.find(x => lc(x.ID) === lc(editing.uuid))
    const key = lc(editing.uuid)
    setEdits(e => {
      const next = { ...e }
      if (sameEdit(tmp, gunToEdit(g))) delete next[key]
      else next[key] = tmp
      return next
    })
    setEditing(null)
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

  return (
    <Page title='Loadout' subtitle='Your equipped weapons, buddies and identity. Changes stay pending until you apply them.'
      actions={pendingCount > 0 && <>
        <Badge tone='warn'>{pendingCount} pending</Badge>
        <Button size='sm' variant='ghost' icon={FiRotateCcw} onClick={() => setEdits({})}>Discard</Button>
        <Button size='sm' variant='primary' icon={FiCheck} loading={saving} onClick={apply}>Apply changes</Button>
      </>}>
      {error && !loadout ? <ErrorState error={error} onRetry={reload} /> : (
        <div className='grid grid-cols-[1fr_320px] gap-5 items-start'>
          <div className='space-y-6 min-w-0'>
            {!ready || loading && !loadout ? (
              <div className='grid grid-cols-3 gap-3'>{Array.from({ length: 9 }).map((_, i) => <Skeleton key={i} className='h-40 rounded-xl' />)}</div>
            ) : CATEGORIES.map(cat => {
              const list = guns.map(g => ({ g, w: weaponById[lc(g.ID)] })).filter(x => x.w && catKey(x.w) === cat.key)
              if (!list.length) return null
              return (
                <section key={cat.key}>
                  <SectionTitle>{cat.label}</SectionTitle>
                  <div className='grid grid-cols-3 gap-3 stagger'>
                    {list.map(({ g, w }, i) => {
                      const x = eff(g)
                      const skin = w.skins.find(s => lc(s.uuid) === lc(x.SkinID))
                      const li = skin ? skin.levels.findIndex(l => lc(l.uuid) === lc(x.SkinLevelID)) : 0
                      const ci = skin ? skin.chromas.findIndex(c => lc(c.uuid) === lc(x.ChromaID)) : 0
                      const chroma = skin?.chromas[ci]
                      const tier = tiers[lc(skin?.contentTierUuid)]
                      const pending = !!edits[lc(g.ID)]
                      return (
                        <Card key={g.ID} hover style={{ '--i': i }} onClick={() => open(w)}
                          className={cx('anim-rise relative p-3 overflow-hidden', pending && 'border-warn/60')}>
                          <div className='flex items-center justify-between'>
                            <span className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>{w.displayName}</span>
                            {pending && <Badge tone='warn'>Pending</Badge>}
                          </div>
                          <div className='h-20 my-1.5 flex items-center justify-center'>
                            <img src={selectionImage(skin, x.ChromaID) || w.displayIcon} className='max-h-full max-w-full object-contain drop-shadow-lg transition-transform duration-300' loading='lazy' />
                          </div>
                          <div className='flex items-end justify-between gap-2'>
                            <div className='min-w-0'>
                              <div className='flex items-center gap-1.5'>
                                {tier && <img src={tier.displayIcon} className='w-3.5 h-3.5' />}
                                <span className='text-[13px] font-semibold truncate' style={{ color: tierColor(tier) }}>{skin?.displayName || 'Standard'}</span>
                              </div>
                              <div className='flex items-center gap-1.5 mt-1 flex-wrap'>
                                {skin && skin.levels.length > 1 && <Badge>Lv {li + 1}/{skin.levels.length}</Badge>}
                                {ci > 0 && chroma && <Badge tone='accent'>Variant {ci + 1}</Badge>}
                                {skin && isStandard(w, skin) && <Badge>Standard</Badge>}
                              </div>
                            </div>
                            {x.CharmLevelID && buddyIcon[lc(x.CharmLevelID)] && <img src={buddyIcon[lc(x.CharmLevelID)]} className='w-9 h-9 object-contain shrink-0' title='Buddy' />}
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                </section>
              )
            })}
          </div>

          <div className='space-y-4 sticky top-0'>
            <Card className='overflow-hidden anim-rise'>
              <div className='h-24 bg-surface-2 relative'>
                {card?.wideArt && <img src={card.wideArt} className='w-full h-full object-cover' />}
                <div className='absolute inset-0 bg-gradient-to-t from-surface to-transparent' />
              </div>
              <div className='px-4 pb-4 -mt-5 relative'>
                <SectionTitle right={<Button size='sm' variant='ghost' icon={FiUser} onClick={() => navigate('customize')}>Edit</Button>}>Identity</SectionTitle>
                {!identity ? <Skeleton className='h-10' /> : (
                  <div className='space-y-1.5 text-[13px]'>
                    <div><span className='text-muted'>Card </span>{card?.displayName || 'Default'}</div>
                    <div><span className='text-muted'>Title </span>{lc(identity.PlayerTitleID) === NO_TITLE ? 'No title' : (title?.titleText || title?.displayName || 'Unknown')}</div>
                    <div><span className='text-muted'>Level </span>{identity.HideAccountLevel ? 'Hidden' : 'Visible'}</div>
                  </div>
                )}
              </div>
            </Card>

            <Card className='p-4 anim-rise' style={{ animationDelay: '60ms' }}>
              <SectionTitle>Sprays and expressions</SectionTitle>
              {!loadout ? <Skeleton className='h-14' /> : (
                <div className='grid grid-cols-4 gap-2'>
                  {loadout.ActiveExpressions.map((e, i) => {
                    const sp = sprays?.find(s => lc(s.uuid) === lc(e.AssetID))
                    return (
                      <div key={i} className='aspect-square rounded-lg bg-surface-2 border border-line flex items-center justify-center p-1.5' title={sp?.displayName || 'Expression'}>
                        {sp ? <img src={sp.fullTransparentIcon || sp.displayIcon} className='max-h-full max-w-full object-contain' /> : <span className='text-[10px] text-muted'>Flex</span>}
                      </div>
                    )
                  })}
                </div>
              )}
            </Card>

            <Card className='p-4 anim-rise' style={{ animationDelay: '120ms' }}>
              <SectionTitle>Presets</SectionTitle>
              <div className='flex gap-2 mb-3'>
                <Input value={presetName} onChange={e => setPresetName(e.target.value)} placeholder='Name this loadout' onKeyDown={e => e.key === 'Enter' && savePreset()} />
                <Button size='md' icon={FiPlus} onClick={savePreset} disabled={!loadout} title='Save the applied loadout as a preset' />
              </div>
              {presets.loading && !presets.data ? <Skeleton className='h-12' /> : !presets.data?.length ? (
                <Empty title='No presets yet' hint='Save your applied loadout to switch back to it in one click.' className='py-5' />
              ) : (
                <div className='space-y-2 stagger'>
                  {presets.data.map((p, i) => (
                    <div key={p.id} style={{ '--i': i }} className='anim-rise rounded-lg border border-line bg-bg/50 p-2.5'>
                      <div className='flex items-center justify-between gap-2'>
                        <span className='text-[13px] font-semibold truncate'>{p.name}</span>
                        <div className='flex items-center gap-1 shrink-0'>
                          <Button size='sm' variant='subtle' onClick={() => setConfirmPreset(p)}>Apply</Button>
                          <Button size='sm' variant='ghost' icon={FiTrash2} onClick={() => delPreset(p)} />
                        </div>
                      </div>
                      <PresetThumbs preset={p} weaponById={weaponById} />
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      <Modal open={!!editing} onClose={() => setEditing(null)} width={760} title={editing ? `${editing.displayName} skin` : ''}
        footer={<><Button variant='ghost' onClick={() => setEditing(null)}>Cancel</Button><Button variant='primary' onClick={stage}>Add to pending</Button></>}>
        {editing && tmp && (
          <div className='space-y-5'>
            <SkinPicker weapon={editing} owned={owned} value={tmp} onChange={v => setTmp(t => ({ ...t, ...v }))} />
            {catKey(editing) !== 'Melee' && (
              <div>
                <SectionTitle>Buddy</SectionTitle>
                <BuddyPicker owned={owned} value={tmp.buddy} usedInstances={usedElsewhere} onChange={b => setTmp(t => ({ ...t, buddy: b }))} />
              </div>
            )}
            <p className='text-[11px] text-muted'>Only items you own are listed. Nothing changes in game until you press Apply changes.</p>
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
  return <div className='flex gap-1.5 mt-2'>{items.map((src, i) => <img key={i} src={src} className='h-6 flex-1 min-w-0 object-contain opacity-80' />)}</div>
}
