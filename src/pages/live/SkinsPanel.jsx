import React from 'react'
import { Badge, ErrorState, Heading, Item, Skeleton, Stagger } from '../../ui'
import { useInvoke } from '../../lib/ipc'
import { PanelHeader } from './Drawer'

const CARD_MASK = { WebkitMaskImage: 'linear-gradient(90deg, #000 30%, transparent)', maskImage: 'linear-gradient(90deg, #000 30%, transparent)' }

// A player's in-match loadout: card and title (named players only), sprays, and every weapon's skin and buddy.
export default function SkinsPanel({ player, onClose }) {
  const { data, error, loading, reload } = useInvoke('live:loadout', [player.ref])
  const sub = ['Loadout', player.agent?.name, data && `${data.weapons.length} weapons`].filter(Boolean).join(' · ')
  return (
    <>
      <PanelHeader player={player} sub={sub} onClose={onClose} />
      <div className='flex-1 overflow-y-auto px-7 py-6'>
        {loading && !data ? (
          <div className='grid gap-3 grid-cols-2 xl:grid-cols-3'>{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className='h-[176px] rounded-[22px]' />)}</div>
        ) : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
          <div className='flex flex-col gap-8'>
            {(data.card || data.sprays.length > 0) && (
              <div className='grid gap-3 lg:grid-cols-[1fr_auto] items-stretch'>
                {data.card && (
                  <div className='glass anim-rise relative min-h-[96px] rounded-[22px] overflow-hidden'>
                    <img src={data.card.art} alt='' className='absolute inset-0 w-full h-full object-cover opacity-80' style={CARD_MASK} draggable={false} />
                    <div className='relative h-full flex flex-col justify-end px-5 py-4'>
                      <span className='eyebrow'>Player card</span>
                      <span className='display text-[22px] mt-1 text-text'>{data.card.name}</span>
                      {data.title && <span className='text-[12px] font-semibold text-accent mt-0.5'>{data.title}</span>}
                    </div>
                  </div>
                )}
                {data.sprays.length > 0 && (
                  <div className='glass anim-rise rounded-[22px] px-4 py-3.5 flex flex-col'>
                    <span className='eyebrow mb-2.5'>Sprays</span>
                    <div className='flex flex-wrap gap-2'>
                      {data.sprays.map(s => (
                        <div key={s.name} title={s.name} className='glass-inset w-14 h-14 rounded-2xl grid place-items-center'>
                          <img src={s.icon} alt={s.name} className='w-10 h-10 object-contain' draggable={false} loading='lazy' />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <section>
              <Heading right={<Badge>{data.weapons.length}</Badge>}>Weapons</Heading>
              <Stagger className='grid gap-3 grid-cols-2 xl:grid-cols-3' step={0.025}>
                {data.weapons.map((w, i) => (
                  <Item key={w.weapon} index={i}><div className='glass lift spot group h-full flex flex-col rounded-[22px] p-4'>
                    <div className='flex items-center justify-between'>
                      <span className='eyebrow'>{w.weapon}</span>
                      {w.buddy && <img src={w.buddy.icon} alt={w.buddy.name} title={w.buddy.name} className='w-6 h-6 object-contain' draggable={false} loading='lazy' />}
                    </div>
                    <div className='relative h-[88px] my-3 flex items-center justify-center'>
                      <span className='halo inset-x-6 inset-y-2 opacity-0 group-hover:opacity-100 transition-opacity duration-300' />
                      <img src={w.image} alt={w.skin} className='relative max-h-full max-w-full object-contain drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)]' draggable={false} loading='lazy' />
                    </div>
                    <div className='text-[13px] font-semibold tracking-tight leading-tight text-text'>{w.skin}</div>
                    {w.buddy && <div className='mt-1 text-[11px] text-muted truncate'>{w.buddy.name}</div>}
                  </div></Item>
                ))}
              </Stagger>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
