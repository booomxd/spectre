import { createEffect, createSignal, on, Show } from 'solid-js'
import { FiCheck } from 'solid-icons/fi'
import { Badge, Button, Card, ErrorState, Page, RequireRiot, Skeleton, Swap, withToast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import SkinPicker, { selectionImage } from './tools/SkinPicker'
import { CATEGORIES, catKey, lc, useOwned, useWeapons } from './tools/gear'
import { ListLabel, ListRow, Pane, SPLIT_BODY, SplitView } from './friends/Layout'

export default function Skins(props) {
  const riotA = useRiot()
  
    
    return (<Show when={!(!riotA().connected)} fallback={<Page title='Skin Changer'><RequireRiot /></Page>}><SkinsView active={props.active} /></Show>)
  
}

function SkinsView(props) {
  const weaponsA = useWeapons()
  const __owned = useOwned()
  const __invoke = useInvoke('loadout:get', [], { poll: () => (props.active ? 20000 : undefined) })
  const [widS, setWid] = createSignal(null)
  const [selS, setSel] = createSignal(null)
  const [busyS, setBusy] = createSignal(false)
  createEffect(on(() => [weapon()?.uuid], () => { setSel(null) }))
  
    const weapon = () => (weaponsA()?.find(w => lc(w.uuid) === lc(widS())) || weaponsA()?.find(w => catKey(w) === 'Rifle') || weaponsA()?.[0])
    const gun = () => (__invoke.data?.Guns.find(g => weapon() && lc(g.ID) === lc(weapon().uuid)))
    const current = () => (gun() && { skinId: gun().SkinID, levelId: gun().SkinLevelID, chromaId: gun().ChromaID })
    const value = () => (selS() || current())
    const dirty = () => (value() && current() && (lc(value().skinId) !== lc(current().skinId) || lc(value().levelId) !== lc(current().levelId) || lc(value().chromaId) !== lc(current().chromaId)))
    const equip = async () => {
    setBusy(true)
    const r = await withToast(invoke('loadout:equip', weapon().uuid, value().skinId, value().levelId, value().chromaId), `${weapon().displayName} skin equipped`)
    setBusy(false)
    if (r) { setSel(null); __invoke.reload(true) }
  }
    return (<Page title='Skin Changer' subtitle='Swap the skin on any weapon with the skins you own.' bodyClass={SPLIT_BODY}
      actions={weapon() && <Button variant='primary' icon={FiCheck} disabled={!dirty()} loading={busyS()} onClick={equip}>Equip</Button>}>
      {__invoke.error && !__invoke.data ? <ErrorState error={__invoke.error} onRetry={__invoke.reload} class='flex-1' /> : (
        <SplitView listWidth={260} list={
          <Pane title='Weapons' right={weaponsA() && <span class='text-[10.5px] font-semibold text-muted tabular-nums'>{weaponsA().length}</span>}>
            {!weaponsA() ? Array.from({ length: 8 }).map((_, i) => <Skeleton class='h-12 mb-2 rounded-2xl' />) : CATEGORIES.map(cat => {
              const list = weaponsA().filter(w => catKey(w) === cat.key)
              if (!list.length) return null
              return (
                <div>
                  <ListLabel count={list.length}>{cat.label}</ListLabel>
                  {list.map(w => {
                    const g = __invoke.data?.Guns.find(x => lc(x.ID) === lc(w.uuid))
                    const sk = w.skins.find(s => lc(s.uuid) === lc(g?.SkinID))
                    const on = weapon() && lc(w.uuid) === lc(weapon().uuid)
                    return (
                      <ListRow as='button' layoutId='skins-weapon' selected={on} onClick={() => setWid(w.uuid)}>
                        <img decoding='async' src={selectionImage(sk, g?.ChromaID) || w.displayIcon} alt='' class='relative w-12 h-8 object-contain shrink-0' loading='lazy' draggable={false} />
                        <span class='relative min-w-0'>
                          <span class='block text-[13px] font-semibold text-text'>{w.displayName}</span>
                          <span class='block text-[11px] text-muted truncate'>{sk?.displayName || '...'}</span>
                        </span>
                      </ListRow>
                    )
                  })}
                </div>
              )
            })}
          </Pane>
        }>
          <Card class='relative overflow-hidden rounded-3xl p-6 min-w-0'>
            <span class='halo -top-28 -right-24 w-96 h-96' />
            {!weapon() || !value() || !__owned.owned ? <div class='relative space-y-3'><Skeleton class='h-32 rounded-2xl' /><Skeleton class='h-40 rounded-2xl' /></div> : (
              <Swap id={weapon().uuid} class='relative'>
                <div class='flex items-end justify-between mb-5'>
                  <div>
                    <div class='eyebrow mb-1.5'>{CATEGORIES.find(c => c.key === catKey(weapon()))?.label}</div>
                    <h2 class='display text-[30px] text-text'>{weapon().displayName}</h2>
                  </div>
                  {dirty() ? <Badge tone='warn'>Not equipped yet</Badge> : <Badge tone='good'>Equipped</Badge>}
                </div>
                <SkinPicker weapon={weapon()} owned={__owned.owned} value={value()} onChange={setSel} maxHeight={340} />
              </Swap>
            )}
          </Card>
        </SplitView>
      )}
    </Page>)
  
}
