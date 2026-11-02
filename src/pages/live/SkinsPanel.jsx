import React from 'react'
import { ErrorState, SectionTitle, Skeleton } from '../../ui'
import { useInvoke } from '../../lib/ipc'
import { PanelHeader } from './Drawer'

// A player's in-match loadout: card and title (named players only), sprays, and every weapon's skin and buddy.
export default function SkinsPanel({ player, onClose }) {
  const { data, error, loading, reload } = useInvoke('live:loadout', [player.ref])
  const sub = ['Player loadout', player.agent?.name, data && `${data.weapons.length} weapons`].filter(Boolean).join(' · ')
  return (
    <>
      <PanelHeader player={player} sub={sub} onClose={onClose} />
      <div className='flex-1 overflow-y-auto px-6 py-5'>
        {loading && !data ? (
          <div className='grid gap-3 grid-cols-2 xl:grid-cols-3'>{Array.from({ length: 9 }, (_, i) => <Skeleton key={i} className='h-[168px] rounded-xl' />)}</div>
        ) : error && !data ? <ErrorState error={error} onRetry={reload} /> : (
          <div className='flex flex-col gap-7'>
            {data.card && (
              <section>
                <SectionTitle>Player card</SectionTitle>
                <div className='glass anim-rise relative h-[92px] rounded-2xl overflow-hidden'>
                  <img src={data.card.art} alt='' className='absolute inset-0 w-full h-full object-cover' draggable={false} />
                  <div className='absolute inset-0 bg-gradient-to-r from-bg/90 via-bg/40 to-bg/80' />
                  <div className='relative h-full flex items-center justify-between px-5 gap-4'>
                    <span className='font-display text-xl font-bold tracking-tight text-text'>{data.card.name}</span>
                    {data.title && <span className='text-sm font-semibold text-muted'>{data.title}</span>}
                  </div>
                </div>
              </section>
            )}
            {data.sprays.length > 0 && (
              <section>
                <SectionTitle>Sprays</SectionTitle>
                <div className='flex flex-wrap gap-2.5'>
                  {data.sprays.map(s => (
                    <div key={s.name} className='glass anim-rise flex items-center gap-2.5 rounded-full pl-2 pr-4 py-1.5'>
                      <img src={s.icon} alt='' className='w-10 h-10 object-contain' draggable={false} loading='lazy' />
                      <span className='text-[12px] font-semibold text-text'>{s.name}</span>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <section>
              <SectionTitle right={<span className='inline-flex items-center h-5 px-2 rounded-full border border-line bg-surface-2 text-[11px] font-semibold text-muted tabular-nums'>{data.weapons.length}</span>}>Weapons</SectionTitle>
              <div className='grid gap-3 grid-cols-2 xl:grid-cols-3 stagger'>
                {data.weapons.map((w, i) => (
                  <div key={w.weapon} className='glass anim-rise flex flex-col rounded-xl p-4 hover:border-accent/30 transition-colors' style={{ '--i': Math.min(i, 12) }}>
                    <div className='text-[11px] font-semibold text-muted'>{w.weapon}</div>
                    <div className='h-[84px] my-3 flex items-center justify-center'>
                      <img src={w.image} alt={w.skin} className='max-h-full max-w-full object-contain' draggable={false} loading='lazy' />
                    </div>
                    <div className='text-[13px] font-semibold tracking-tight leading-tight text-text'>{w.skin}</div>
                    {w.buddy && (
                      <div className='mt-2.5 pt-2.5 border-t border-line flex items-center gap-1.5 text-[11px] text-muted min-w-0'>
                        <img src={w.buddy.icon} alt='' className='w-5 h-5 object-contain shrink-0' draggable={false} loading='lazy' />
                        <span className='truncate'>{w.buddy.name}</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>
        )}
      </div>
    </>
  )
}
