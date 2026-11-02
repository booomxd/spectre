import { useEffect, useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Badge, Button, Card, ErrorState, Page, RequireRiot, SectionTitle, Skeleton, withToast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import SkinPicker, { selectionImage } from './tools/SkinPicker'
import { CATEGORIES, catKey, lc, useOwned, useWeapons } from './tools/gear'

const cx = (...c) => c.filter(Boolean).join(' ')

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
    <Page title='Skin Changer' subtitle='Swap the skin on any weapon with the skins you own.'
      actions={weapon && <Button variant='primary' icon={FiCheck} disabled={!dirty} loading={busy} onClick={equip}>Equip</Button>}>
      {error && !loadout ? <ErrorState error={error} onRetry={reload} /> : (
        <div className='grid grid-cols-[230px_1fr] gap-5 items-start'>
          <div className='space-y-4'>
            {!weapons ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-12 mb-2 rounded-lg' />) : CATEGORIES.map(cat => {
              const list = weapons.filter(w => catKey(w) === cat.key)
              if (!list.length) return null
              return (
                <div key={cat.key}>
                  <SectionTitle>{cat.label}</SectionTitle>
                  <div className='space-y-1.5 stagger'>
                    {list.map((w, i) => {
                      const g = loadout?.Guns.find(x => lc(x.ID) === lc(w.uuid))
                      const sk = w.skins.find(s => lc(s.uuid) === lc(g?.SkinID))
                      const on = weapon && lc(w.uuid) === lc(weapon.uuid)
                      return (
                        <button key={w.uuid} style={{ '--i': i }} onClick={() => setWid(w.uuid)}
                          className={cx('anim-rise w-full flex items-center gap-2.5 rounded-lg border px-2.5 py-1.5 text-left transition-all', on ? 'border-accent bg-accent/10' : 'border-line bg-surface hover:border-accent/40')}>
                          <img src={selectionImage(sk, g?.ChromaID) || w.displayIcon} className='w-12 h-8 object-contain shrink-0' loading='lazy' />
                          <span className='min-w-0'>
                            <span className='block text-[12px] font-semibold uppercase tracking-wide'>{w.displayName}</span>
                            <span className='block text-[11px] text-muted truncate'>{sk?.displayName || '...'}</span>
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>

          <Card className='p-5 min-w-0' key={weapon?.uuid}>
            {!weapon || !value || !owned ? <div className='space-y-3'><Skeleton className='h-32 rounded-xl' /><Skeleton className='h-40 rounded-xl' /></div> : (
              <div className='anim-fade'>
                <div className='flex items-center justify-between mb-4'>
                  <h2 className='font-display text-xl font-bold uppercase'>{weapon.displayName}</h2>
                  {dirty ? <Badge tone='warn'>Not equipped yet</Badge> : <Badge tone='good'>Equipped</Badge>}
                </div>
                <SkinPicker weapon={weapon} owned={owned} value={value} onChange={setSel} maxHeight={340} />
              </div>
            )}
          </Card>
        </div>
      )}
    </Page>
  )
}
