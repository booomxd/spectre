import { For } from 'solid-js'
import { st } from '../../lib/st.js'
import { Badge, ErrorState, Heading, Item, Skeleton, Stagger } from '../../ui'
import { useInvoke } from '../../lib/ipc'
import { PanelHeader } from './Drawer'

const CARD_MASK = { WebkitMaskImage: 'linear-gradient(90deg, #000 30%, transparent)', maskImage: 'linear-gradient(90deg, #000 30%, transparent)' }

// A player's in-match loadout: card and title (named players only), sprays, and every weapon's skin and buddy
export default function SkinsPanel(props) {
  const __invoke = useInvoke('live:loadout', () => [props.player.ref])
  
    const sub = () => (['Loadout', props.player.agent?.name, __invoke.data && `${__invoke.data.weapons.length} weapons`].filter(Boolean).join(' · '))
    return (<>
      <PanelHeader player={props.player} sub={sub()} onClose={props.onClose} />
      <div class='flex-1 overflow-y-auto px-7 py-6'>
        {__invoke.loading && !__invoke.data ? (
          <div class='grid gap-3 grid-cols-2 xl:grid-cols-3'>{Array.from({ length: 9 }, (_, i) => <Skeleton class='h-[176px] rounded-[22px]' />)}</div>
        ) : __invoke.error && !__invoke.data ? <ErrorState error={__invoke.error} onRetry={__invoke.reload} /> : (
          <div class='flex flex-col gap-8'>
            {(__invoke.data.card || __invoke.data.sprays.length > 0) && (
              <div class='grid gap-3 lg:grid-cols-[1fr_auto] items-stretch'>
                {__invoke.data.card && (
                  <div class='glass anim-rise relative min-h-[96px] rounded-[22px] overflow-hidden'>
                    <img decoding='async' src={__invoke.data.card.art} alt='' class='absolute inset-0 w-full h-full object-cover opacity-80' style={st(CARD_MASK)} draggable={false} />
                    <div class='relative h-full flex flex-col justify-end px-5 py-4'>
                      <span class='eyebrow'>Player card</span>
                      <span class='display text-[22px] mt-1 text-text'>{__invoke.data.card.name}</span>
                      {__invoke.data.title && <span class='text-[12px] font-semibold text-accent mt-0.5'>{__invoke.data.title}</span>}
                    </div>
                  </div>
                )}
                {__invoke.data.sprays.length > 0 && (
                  <div class='glass anim-rise rounded-[22px] px-4 py-3.5 flex flex-col'>
                    <span class='eyebrow mb-2.5'>Sprays</span>
                    <div class='flex flex-wrap gap-2'>
                      <For each={__invoke.data.sprays}>{s => (
                        <div title={s.name} class='glass-inset w-14 h-14 rounded-2xl grid place-items-center'>
                          <img decoding='async' src={s.icon} alt={s.name} class='w-10 h-10 object-contain' draggable={false} loading='lazy' />
                        </div>
                      )}</For>
                    </div>
                  </div>
                )}
              </div>
            )}
            <section>
              <Heading right={<Badge>{__invoke.data.weapons.length}</Badge>}>Weapons</Heading>
              <Stagger class='grid gap-3 grid-cols-2 xl:grid-cols-3' step={0.025}>
                <For each={__invoke.data.weapons}>{(w, i) => (
                  <Item index={i()}><div class='glass lift spot group h-full flex flex-col rounded-[22px] p-4'>
                    <div class='flex items-center justify-between'>
                      <span class='eyebrow'>{w.weapon}</span>
                      {w.buddy && <img decoding='async' src={w.buddy.icon} alt={w.buddy.name} title={w.buddy.name} class='w-6 h-6 object-contain' draggable={false} loading='lazy' />}
                    </div>
                    <div class='relative h-[88px] my-3 flex items-center justify-center'>
                      <span class='halo inset-x-6 inset-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
                      <img decoding='async' src={w.image} alt={w.skin} class='relative max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)]' draggable={false} loading='lazy' />
                    </div>
                    <div class='text-[13px] font-semibold tracking-tight leading-tight text-text'>{w.skin}</div>
                    {w.buddy && <div class='mt-1 text-[11px] text-muted truncate'>{w.buddy.name}</div>}
                  </div></Item>
                )}</For>
              </Stagger>
            </section>
          </div>
        )}
      </div>
    </>)
  
}
