import { For, createSignal, Show, createMemo } from 'solid-js'
import { st } from '../lib/st.js'
import { FiCheck, FiPlus, FiRotateCcw, FiTrash2 } from 'solid-icons/fi'
import { Badge, Button, Card, Empty, ErrorState, Heading, Input, Item, Modal, Page, RequireRiot, SectionTitle, SegmentedTabs, Skeleton, Stagger, Swap, cx, toast, withToast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent } from '../lib/content'
import SkinPicker, { selectionImage } from './tools/SkinPicker'
import BuddyPicker from './tools/BuddyPicker'
import { CATEGORIES, NO_TITLE, catKey, isStandard, lc, skinImage, useContentTiers, tierColor, useOwned, useWeapons } from './tools/gear'


export default function Loadout(props) {
  const riotA = useRiot()
  
    
    return (<Show when={!(!riotA().connected)} fallback={<Page title='Loadout'><RequireRiot /></Page>}><LoadoutView active={props.active} /></Show>)
  
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

function LoadoutView(props) {
  const weaponsA = useWeapons()
  const __owned = useOwned()
  const __invoke = useInvoke('loadout:get', [], { poll: () => (props.active ? 20000 : undefined) })
  const presets = useInvoke('loadout:presets')
  const buddiesA = useContent('buddies')
  const spraysA = useContent('sprays')
  const cardsA = useContent('playercards')
  const titlesA = useContent('playertitles')
  const tiersA = useContentTiers()
  const [editsS, setEdits] = createSignal({})
  const [editingS, setEditing] = createSignal(null)
  const [tmpS, setTmp] = createSignal(null)
  const [savingS, setSaving] = createSignal(false)
  const [presetNameS, setPresetName] = createSignal('')
  const [confirmPresetS, setConfirmPreset] = createSignal(null)
  const [applyingPresetS, setApplyingPreset] = createSignal(false)
  const [filterS, setFilter] = createSignal('all')
  const riotA = useRiot()
  
    const buddyIcon = createMemo(() => {
    const m = {}
    buddiesA()?.forEach(b => b.levels.forEach(l => { m[lc(l.uuid)] = l.displayIcon }))
    return m
  })
    const weaponById = createMemo(() => weaponsA() ? Object.fromEntries(weaponsA().map(w => [lc(w.uuid), w])) : {})
    const guns = () => (__invoke.data?.Guns || [])
    const eff = g => withEdit(g, editsS()[lc(g.ID)])
    const pendingCount = () => (Object.keys(editsS()).length)
    const open = w => {
    const g = guns().find(x => lc(x.ID) === lc(w.uuid))
    setTmp(gunToEdit(eff(g)))
    setEditing(w)
  }
    const applyGun = async () => {
    const all = { ...editsS(), [lc(editingS().uuid)]: tmpS() }
    setSaving(true)
    const r = await withToast(invoke('loadout:save', { Guns: guns().map(g => withEdit(g, all[lc(g.ID)])) }), `${editingS().displayName} skin applied`)
    setSaving(false)
    if (r) { setEdits({}); setEditing(null); __invoke.reload(true) }
  }
    const usedElsewhere = createMemo(() => {
    const s = new Set()
    if (editingS()) guns().forEach(g => { const x = eff(g); if (lc(g.ID) !== lc(editingS().uuid) && x.CharmInstanceID) s.add(lc(x.CharmInstanceID)) })
    return s
  })
    const apply = async () => {
    setSaving(true)
    const r = await withToast(invoke('loadout:save', { Guns: guns().map(eff) }), 'Loadout applied')
    setSaving(false)
    if (r) { setEdits({}); __invoke.reload(true) }
  }
    const applyPreset = async () => {
    setApplyingPreset(true)
    const r = await withToast(invoke('loadout:presetApply', confirmPresetS().id))
    setApplyingPreset(false)
    if (!r) return
    setConfirmPreset(null); setEdits({}); __invoke.reload(true)
    toastSkipped(r.skipped, confirmPresetS().name)
  }
    const savePreset = async () => {
    const r = await withToast(invoke('loadout:presetSave', presetNameS()), 'Preset saved')
    if (r) { setPresetName(''); presets.reload(true) }
  }
    const delPreset = async p => {
    const r = await withToast(invoke('loadout:presetDelete', p.id))
    if (r) presets.reload(true)
  }
    const ready = () => (__invoke.data && weaponsA())
    const identity = () => (__invoke.data?.Identity)
    const card = () => (cardsA()?.find(c => lc(c.uuid) === lc(identity()?.PlayerCardID)))
    const title = () => (titlesA()?.find(t => lc(t.uuid) === lc(identity()?.PlayerTitleID)))
    const tile = (g, w, index) => {
    const x = eff(g)
    const skin = w.skins.find(s => lc(s.uuid) === lc(x.SkinID))
    const li = skin ? skin.levels.findIndex(l => lc(l.uuid) === lc(x.SkinLevelID)) : 0
    const ci = skin ? skin.chromas.findIndex(c => lc(c.uuid) === lc(x.ChromaID)) : 0
    const chroma = skin?.chromas[ci]
    const tier = tiersA()[lc(skin?.contentTierUuid)]
    const color = tierColor(tier)
    const pending = !!editsS()[lc(g.ID)]
    return (
      <Item index={index}>
        <Card hover onClick={() => open(w)} class={cx('group relative overflow-hidden h-[208px] flex flex-col', pending && '!border-warn/60')}>
          <div class='absolute inset-0 pointer-events-none' style={st(color ? { background: `radial-gradient(70% 60% at 50% 42%, ${color}2e, transparent 70%)` } : undefined)} />
          {color && <div class='absolute inset-x-6 top-0 h-px' style={st({ background: `linear-gradient(90deg, transparent, ${color}, transparent)` })} />}
          <div class='relative flex items-center justify-between h-7 mt-4 px-5'>
            <span class='eyebrow'>{w.displayName}</span>
            {pending ? <Badge tone='warn'>Pending</Badge> : x.CharmLevelID && buddyIcon()[lc(x.CharmLevelID)] && <img decoding='async' src={buddyIcon()[lc(x.CharmLevelID)]} class='w-7 h-7 object-contain' title='Buddy' />}
          </div>
          <div class='relative flex-1 min-h-0 flex items-center justify-center px-6'>
            <img decoding='async' src={selectionImage(skin, x.ChromaID) || w.displayIcon} class='max-h-[92px] max-w-full object-contain drop-shadow-[0_10px_18px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-out group-hover:scale-[1.06]' loading='lazy' />
          </div>
          <div class='relative px-5 pb-4'>
            <div class='flex items-center gap-1.5'>
              {tier && <img decoding='async' src={tier.displayIcon} class='w-3.5 h-3.5' />}
              <span class='text-[14px] font-semibold tracking-tight truncate text-text'>{skin?.displayName || 'Standard'}</span>
            </div>
            <div class='flex items-center gap-1.5 mt-1.5 flex-wrap min-h-[20px]'>
              {skin && skin.levels.length > 1 && <Badge>Lv {li + 1}/{skin.levels.length}</Badge>}
              {ci > 0 && chroma && <Badge tone='accent'>Variant {ci + 1}</Badge>}
              {skin && isStandard(w, skin) && <Badge>Standard</Badge>}
              {pending && x.CharmLevelID && buddyIcon()[lc(x.CharmLevelID)] && <img decoding='async' src={buddyIcon()[lc(x.CharmLevelID)]} class='w-5 h-5 object-contain' title='Buddy' />}
            </div>
          </div>
        </Card>
      </Item>
    )
  }
    const cats = () => (CATEGORIES.map(cat => ({ ...cat, list: guns().map(g => ({ g, w: weaponById()[lc(g.ID)] })).filter(x => x.w && catKey(x.w) === cat.key) })).filter(c => c.list.length))
    const shownCats = () => (filterS() === 'all' ? cats() : cats().filter(c => c.key === filterS()))
    return (<Page title='Loadout' subtitle='Your equipped arsenal. Pick any weapon to change its skin, variant and buddy.'
      actions={pendingCount() > 0 && <>
        <Badge tone='warn'>{pendingCount()} pending</Badge>
        <Button size='sm' variant='ghost' icon={FiRotateCcw} onClick={() => setEdits({})}>Discard</Button>
        <Button size='sm' variant='primary' icon={FiCheck} loading={savingS()} onClick={apply}>Apply changes</Button>
      </>}>
      {__invoke.error && !__invoke.data ? <ErrorState error={__invoke.error} onRetry={__invoke.reload} /> : (
        <div class='flex flex-col gap-8'>
          <div class='bento'>
            <Card class='col-span-12 xl:col-span-5 relative overflow-hidden rounded-3xl min-h-[210px]'>
              {card()?.wideArt && <img decoding='async' src={card().wideArt} class='absolute inset-0 w-full h-full object-cover' draggable={false} />}
              {card()?.wideArt ? <div class='absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-black/5' /> : <span class='halo -top-24 -left-20 w-80 h-80' />}
              <div class='relative h-full p-6 flex flex-col justify-end'>
                <div class={cx('eyebrow mb-2', card()?.wideArt && '!text-white/70')}>Identity</div>
                {!identity() ? <Skeleton class='h-14 rounded-xl' /> : (
                  <>
                    <div class={cx('display text-[30px] truncate', card()?.wideArt ? 'text-white' : 'text-text')}>{riotA().gameName || 'Player'}</div>
                    <div class={cx('mt-1.5 text-[12.5px] truncate', card()?.wideArt ? 'text-white/75' : 'text-muted')}>
                      {lc(identity().PlayerTitleID) === NO_TITLE ? 'No title' : (title()?.titleText || title()?.displayName || 'Unknown title')} · {card()?.displayName || 'Default card'} · Level {identity().HideAccountLevel ? 'hidden' : 'visible'}
                    </div>
                  </>
                )}
              </div>
            </Card>

            <Card class='col-span-12 md:col-span-5 xl:col-span-3 p-5 rounded-3xl'>
              <Heading hint='Your spray wheel'>Sprays</Heading>
              {!__invoke.data ? <Skeleton class='h-24 rounded-2xl' /> : (
                <div class='grid grid-cols-2 gap-2'>
                  {__invoke.data.ActiveExpressions.slice(0, 4).map((e, i) => {
                    const sp = spraysA()?.find(s => lc(s.uuid) === lc(e.AssetID))
                    return (
                      <div class='glass-inset h-[58px] rounded-2xl flex items-center justify-center p-2' title={sp?.displayName || 'Expression'}>
                        {sp ? <img decoding='async' src={sp.fullTransparentIcon || sp.displayIcon} class='max-h-full max-w-full object-contain' /> : <span class='text-[10px] text-muted'>Flex</span>}
                      </div>
                    )
                  })}
                </div>
              )}
              {__invoke.data?.ActiveExpressions.length > 4 && (
                <div class='flex gap-2 mt-2'>
                  {__invoke.data.ActiveExpressions.slice(4).map((e, i) => {
                    const sp = spraysA()?.find(s => lc(s.uuid) === lc(e.AssetID))
                    return <div class='glass-inset flex-1 h-10 rounded-xl flex items-center justify-center p-1.5' title={sp?.displayName || 'Expression'}>{sp ? <img decoding='async' src={sp.fullTransparentIcon || sp.displayIcon} class='max-h-full max-w-full object-contain' /> : <span class='text-[10px] text-muted'>Flex</span>}</div>
                  })}
                </div>
              )}
            </Card>

            <Card class='col-span-12 md:col-span-7 xl:col-span-4 p-5 rounded-3xl flex flex-col'>
              <Heading hint='Save and switch whole loadouts'>Presets</Heading>
              <div class='flex gap-2 mb-3'>
                <Input value={presetNameS()} onInput={e => setPresetName(e.target.value)} placeholder='Name this loadout' class='!rounded-full' onKeyDown={e => e.key === 'Enter' && savePreset()} />
                <Button size='icon' variant='glow' class='!w-10 !h-10 shrink-0' icon={FiPlus} onClick={savePreset} disabled={!__invoke.data} title='Save the applied loadout as a preset' />
              </div>
              {presets.loading && !presets.data ? <Skeleton class='h-12 rounded-2xl' /> : !presets.data?.length ? (
                <p class='text-[12px] text-muted leading-relaxed py-2'>No presets yet. Save your applied loadout to switch back to it in one click.</p>
              ) : (
                <div class='flex flex-col gap-1.5 max-h-[118px] overflow-y-auto -mr-2 pr-2'>
                  <For each={presets.data}>{p => (
                    <div class='group glass-inset rounded-2xl pl-3.5 pr-1.5 py-1.5 flex items-center gap-2'>
                      <div class='min-w-0 flex-1'>
                        <div class='text-[13px] font-semibold truncate'>{p.name}</div>
                        <PresetThumbs preset={p} weaponById={weaponById()} />
                      </div>
                      <Button size='sm' variant='ghost' icon={FiTrash2} class='!px-2 opacity-0 group-hover:opacity-100' title='Delete preset' onClick={() => delPreset(p)} />
                      <Button size='sm' variant='subtle' onClick={() => setConfirmPreset(p)}>Apply</Button>
                    </div>
                  )}</For>
                </div>
              )}
            </Card>
          </div>

          <section>
            <div class='flex items-center justify-between gap-4 mb-5'>
              <SegmentedTabs layoutId='loadout-filter' value={filterS()} onChange={setFilter}
                tabs={[{ value: 'all', label: 'All', count: guns().length || undefined }, ...cats().map(c => ({ value: c.key, label: c.label, count: c.list.length }))]} />
              <span class='text-[12px] text-muted'>Changes are applied in game when you press Apply</span>
            </div>
            {!ready() || __invoke.loading && !__invoke.data ? (
              <div class='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'><For each={Array.from({ length: 8 })}>{(_, i) => <Skeleton class='h-[208px] rounded-2xl' />}</For></div>
            ) : (
              <Swap id={filterS()} class='flex flex-col gap-8'>
                <For each={shownCats()}>{cat => (
                  <div>
                    {filterS() === 'all' && <SectionTitle right={<span class='text-[11px] text-muted tabular-nums'>{cat.list.length}</span>}>{cat.label}</SectionTitle>}
                    <Stagger class='grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4'>
                      {cat.list.map(({ g, w }, i) => tile(g, w, i))}
                    </Stagger>
                  </div>
                )}</For>
              </Swap>
            )}
          </section>
        </div>
      )}

      <Modal open={!!editingS()} onClose={() => setEditing(null)} width={760} title={editingS() ? `${editingS().displayName} skin` : ''}
        footer={<><Button variant='ghost' onClick={() => setEditing(null)}>Cancel</Button><Button variant='primary' loading={savingS()} onClick={applyGun}>Apply</Button></>}>
        {editingS() && tmpS() && (
          <div class='space-y-5'>
            <SkinPicker weapon={editingS()} owned={__owned.owned} value={tmpS()} onChange={v => setTmp(t => ({ ...t, ...v }))} />
            {catKey(editingS()) !== 'Melee' && (
              <div>
                <SectionTitle>Buddy</SectionTitle>
                <BuddyPicker owned={__owned.owned} value={tmpS().buddy} usedInstances={usedElsewhere()} onChange={b => setTmp(t => ({ ...t, buddy: b }))} />
              </div>
            )}
            <p class='text-[11.5px] text-muted'>Only items you own are listed. Apply equips it in game right away.</p>
          </div>
        )}
      </Modal>

      <Modal open={!!confirmPresetS()} onClose={() => setConfirmPreset(null)} title='Apply preset' width={420}
        footer={<><Button variant='ghost' onClick={() => setConfirmPreset(null)}>Cancel</Button><Button variant='primary' loading={applyingPresetS()} onClick={applyPreset}>Apply preset</Button></>}>
        <p class='text-[13px]'>Apply <b>{confirmPresetS()?.name}</b> to your loadout? Items you no longer own are skipped and keep their current setting. Any pending edits here are discarded.</p>
      </Modal>
    </Page>)
  
}

function toastSkipped(skipped, name) {
  if (skipped.length) toast(`${name} applied. Skipped (not owned): ${skipped.join(', ')}`)
}

function PresetThumbs(props) {
  
    const items = () => (props.preset.loadout.Guns.map(g => {
    const w = props.weaponById[lc(g.ID)]
    const s = w?.skins.find(x => lc(x.uuid) === lc(g.SkinID))
    return w && s && !isStandard(w, s) ? skinImage(s) : null
  }).filter(Boolean).slice(0, 5))
    
    return (<Show when={!(!items().length)} fallback={null}><div class='flex gap-1.5 mt-1'><For each={items()}>{(src, i) => <img decoding='async' src={src} class='h-4 flex-1 min-w-0 object-contain opacity-70' />}</For></div></Show>)
  
}
