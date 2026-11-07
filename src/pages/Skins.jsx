import { useEffect, useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Badge, Button, Card, ErrorState, Page, RequireRiot, Skeleton, Swap, withToast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import SkinPicker, { selectionImage } from './tools/SkinPicker'
import { CATEGORIES, catKey, lc, useOwned, useWeapons } from './tools/gear'
import { ListLabel, ListRow, Pane, SPLIT_BODY, SplitView } from './friends/Layout'

export default function Skins({ active }) {
  const riot = useRiot()
  if (!riot.connected) return <Page title='Skin Changer'><RequireRiot /></Page>
  return <SkinsView active={active} />
}

function SkinsView({ active }) {
  const weapons = useWeapons()
  const { owned } = useOwned()
  const { data: loadout, error, reload } = useInvoke('loadout:get', [], { poll: active ? 20000 : undefined })
  const [wid, setWid] = useState(null)
  const [sel, setSel] = useState(null)
  const [busy, setBusy] = useState(false)

  const weapon = weapons?.find(w => lc(w.uuid) === lc(wid)) || weapons?.find(w => catKey(w) === 'Rifle') || weapons?.[0]
  const gun = loadout?.Guns.find(g => weapon && lc(g.ID) === lc(weapon.uuid))
  const current = gun && { skinId: gun.SkinID, levelId: gun.SkinLevelID, chromaId: gun.ChromaID }

  // Start from what is equipped whenever the weapon changes.
  useEffect(() => { setSel(null) }, [weapon?.uuid])
  const value = sel || current
  const dirty = value && current && (lc(value.skinId) !== lc(current.skinId) || lc(value.levelId) !== lc(current.levelId) || lc(value.chromaId) !== lc(current.chromaId))

  const equip = async () => {
    setBusy(true)
    const r = await withToast(invoke('loadout:equip', weapon.uuid, value.skinId, value.levelId, value.chromaId), `${weapon.displayName} skin equipped`)
    setBusy(false)
    if (r) { setSel(null); reload(true) }
  }

  return (
    <Page title='Skin Changer' subtitle='Swap the skin on any weapon with the skins you own.' bodyClassName={SPLIT_BODY}
      actions={weapon && <Button variant='primary' icon={FiCheck} disabled={!dirty} loading={busy} onClick={equip}>Equip</Button>}>
      {error && !loadout ? <ErrorState error={error} onRetry={reload} className='flex-1' /> : (
        <SplitView listWidth={260} list={
          <Pane title='Weapons' right={weapons && <span className='text-[10.5px] font-semibold text-muted tabular-nums'>{weapons.length}</span>}>
            {!weapons ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='h-12 mb-2 rounded-2xl' />) : CATEGORIES.map(cat => {
              const list = weapons.filter(w => catKey(w) === cat.key)
              if (!list.length) return null
              return (
                <div key={cat.key}>
                  <ListLabel count={list.length}>{cat.label}</ListLabel>
                  {list.map(w => {
                    const g = loadout?.Guns.find(x => lc(x.ID) === lc(w.uuid))
                    const sk = w.skins.find(s => lc(s.uuid) === lc(g?.SkinID))
                    const on = weapon && lc(w.uuid) === lc(weapon.uuid)
                    return (
                      <ListRow key={w.uuid} as='button' layoutId='skins-weapon' selected={on} onClick={() => setWid(w.uuid)}>
                        <img src={selectionImage(sk, g?.ChromaID) || w.displayIcon} alt='' className='relative w-12 h-8 object-contain shrink-0' loading='lazy' draggable={false} />
                        <span className='relative min-w-0'>
                          <span className='block text-[13px] font-semibold text-text'>{w.displayName}</span>
                          <span className='block text-[11px] text-muted truncate'>{sk?.displayName || '...'}</span>
                        </span>
                      </ListRow>
                    )
                  })}
                </div>
              )
            })}
          </Pane>
        }>
          <Card className='relative overflow-hidden rounded-3xl p-6 min-w-0'>
            <span className='halo -top-28 -right-24 w-96 h-96' />
            {!weapon || !value || !owned ? <div className='relative space-y-3'><Skeleton className='h-32 rounded-2xl' /><Skeleton className='h-40 rounded-2xl' /></div> : (
              <Swap id={weapon.uuid} className='relative'>
                <div className='flex items-end justify-between mb-5'>
                  <div>
                    <div className='eyebrow mb-1.5'>{CATEGORIES.find(c => c.key === catKey(weapon))?.label}</div>
                    <h2 className='display text-[30px] text-text'>{weapon.displayName}</h2>
                  </div>
                  {dirty ? <Badge tone='warn'>Not equipped yet</Badge> : <Badge tone='good'>Equipped</Badge>}
                </div>
                <SkinPicker weapon={weapon} owned={owned} value={value} onChange={setSel} maxHeight={340} />
              </Swap>
            )}
          </Card>
        </SplitView>
      )}
    </Page>
  )
}
