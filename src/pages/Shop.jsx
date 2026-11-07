import { useState } from 'react'
import { FiRefreshCw, FiMoon, FiPackage, FiPlay } from 'react-icons/fi'
import { Page, Card, Heading, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, Modal, SegmentedTabs, Stagger, Item, Swap, cx } from '../ui'
import { useInvoke } from '../lib/ipc'
import { CUR, useCatalog, fmt, useCountdown } from './dashboard/catalog'
import { Price, ItemArt } from './dashboard/bits'

const pct = d => Math.round((d || 0) * 100)
const tierHex = item => item?.tier?.highlightColor ? '#' + item.tier.highlightColor.slice(0, 6) : null

// Segmented live countdown: 5d 06h 59m 12s. `onArt` = white text over imagery.
function BigCountdown({ seconds, label, onArt, className }) {
  const left = useCountdown(seconds)
  if (left == null) return null
  const s = Math.floor(left)
  const parts = [[Math.floor(s / 86400), 'd'], [Math.floor(s % 86400 / 3600), 'h'], [Math.floor(s % 3600 / 60), 'm'], [s % 60, 's']]
  const shown = parts[0][0] > 0 ? parts : parts.slice(1)
  return (
    <div className={cx('flex items-center gap-2', className)}>
      {label && <span className={cx('text-[11px] font-semibold tracking-[0.14em] uppercase mr-1', onArt ? 'text-white/70' : 'text-muted')}>{label}</span>}
      {shown.map(([v, u]) => (
        <span key={u} className={cx('inline-flex items-baseline gap-0.5 rounded-xl px-2.5 h-8 items-center', onArt ? 'bg-black/35 border border-white/15' : 'glass-inset')}>
          <span className={cx('font-display text-[16px] font-bold tabular-nums tracking-tight', onArt ? 'text-white' : 'text-text')}>{String(v).padStart(2, '0')}</span>
          <span className={cx('text-[10px] font-semibold', onArt ? 'text-white/60' : 'text-muted')}>{u}</span>
        </span>
      ))}
    </div>
  )
}

function Wallet({ wallet, cat }) {
  if (!wallet) return <Skeleton className='h-9 w-56 rounded-full' />
  return (
    <div className='glass flex items-center rounded-full px-4 h-9 gap-4'>
      <Price amount={wallet.vp} currencyId={CUR.vp} cat={cat} size={15} />
      <span className='w-px h-4 bg-line' />
      <Price amount={wallet.rad} currencyId={CUR.rad} cat={cat} size={15} />
      <span className='w-px h-4 bg-line' />
      <Price amount={wallet.kc} currencyId={CUR.kc} cat={cat} size={15} />
    </div>
  )
}

// Large skin card: tier-tinted art stage, name, tier and price.
function OfferCard({ item, price, base, discount, cat, onOpen, index, currencyId, size = 'lg', hidden }) {
  const color = tierHex(item)
  const clickable = !!item?.skin
  return (
    <Item index={index} className='h-full'>
      <Card hover={clickable} onClick={() => clickable && onOpen(item)} className='group relative overflow-hidden h-full flex flex-col'>
        <div className={cx('relative', size === 'lg' ? 'h-48' : 'h-32')}>
          {color && <div className='absolute inset-x-0 top-0 h-px' style={{ background: `linear-gradient(90deg, transparent, ${color}, transparent)` }} />}
          <ItemArt item={hidden ? null : item} className={cx('h-full', size === 'lg' ? 'px-5 pt-5 pb-2' : 'px-5 pt-5 pb-1')} />
          {discount > 0 && <span className='absolute top-3 left-3 inline-flex h-6 items-center px-2.5 rounded-full accent-fill text-bg text-[11px] font-bold tabular-nums'>-{pct(discount)}%</span>}
          {clickable && <span className='absolute top-3 right-3 w-8 h-8 rounded-full glass flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 transition-opacity'><FiPlay size={12} /></span>}
        </div>
        <div className='px-5 pb-5 pt-1 mt-auto flex items-end justify-between gap-3'>
          <div className='min-w-0'>
            <div className={cx('truncate font-semibold tracking-tight text-text', size === 'lg' ? 'text-[15px]' : 'text-[13px]')}>{hidden ? 'Not revealed yet' : item?.name || 'Loading...'}</div>
            <div className='mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted'>
              {color && <span className='w-1.5 h-1.5 rounded-full' style={{ background: color, boxShadow: `0 0 8px ${color}` }} />}
              <span className='capitalize'>{item?.tier?.devName || item?.kind || ''}</span>
            </div>
          </div>
          <div className='text-right shrink-0'>
            {base != null && base !== price && <div className='text-[11px] text-muted line-through tabular-nums'>{fmt(base)}</div>}
            <Price amount={price} cat={cat} currencyId={currencyId} className={size === 'lg' ? 'text-[17px]' : 'text-[14px]'} size={size === 'lg' ? 15 : 13} />
          </div>
        </div>
      </Card>
    </Item>
  )
}

function SkinModal({ item, onClose }) {
  const [chroma, setChroma] = useState(null)
  const skin = item?.skin
  const chromas = skin?.chromas || []
  const active = chroma ? chromas.find(c => c.uuid === chroma) : null
  const video = active?.streamedVideo || [...(skin?.levels || [])].reverse().find(l => l.streamedVideo)?.streamedVideo || skin?.streamedVideo
  const close = () => { onClose(); setChroma(null) }
  return (
    <Modal open={!!item} onClose={close} title={item?.name} width={680}>
      {item && (
        <div className='space-y-4'>
          <ItemArt item={{ ...item, icon: active?.fullRender || item.icon }} className='glass-inset h-60 rounded-2xl' />
          {chromas.length > 1 && (
            <div>
              <div className='eyebrow mb-2.5'>Variants</div>
              <div className='flex flex-wrap gap-2'>
                {chromas.map((c, idx) => (
                  <button key={c.uuid} onClick={() => setChroma(c.uuid)} title={c.displayName}
                    className={cx('w-16 h-12 rounded-xl flex items-center justify-center transition-transform hover:-translate-y-0.5', c.uuid === chroma || (!chroma && idx === 0) ? 'accent-soft' : 'glass')}>
                    {(c.swatch || c.fullRender) && <img src={c.swatch || c.fullRender} alt='' className='max-h-9 max-w-14 object-contain' />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {video ? <video key={video} src={video} controls muted loop className='w-full rounded-2xl border border-line bg-black' />
            : <p className='text-xs text-muted'>No video preview available for this skin.</p>}
        </div>
      )}
    </Modal>
  )
}

// Featured bundle: full-bleed art hero with a live countdown, items in a strip below.
function Bundle({ b, cat, onOpen }) {
  const meta = cat?.bundles[b.id]
  const art = meta?.displayIcon2 || meta?.displayIcon
  return (
    <div className='flex flex-col gap-4'>
      <Card className='relative overflow-hidden rounded-3xl h-[300px]'>
        {art ? <img src={art} alt='' className='absolute inset-0 w-full h-full object-cover' draggable={false} /> : <span className='halo -top-24 -left-20 w-96 h-96' />}
        <div className='absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent' />
        <div className='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' />
        <div className='relative h-full flex flex-col justify-end p-6 gap-4'>
          <div>
            <div className='flex items-center gap-2 mb-3'>
              <span className='text-[11px] font-semibold tracking-[0.14em] uppercase text-white/70'>Featured bundle</span>
              {b.discountPercent > 0 && <span className='inline-flex h-5 items-center px-2 rounded-full bg-good/90 text-[10px] font-bold text-black tabular-nums'>-{pct(b.discountPercent)}%</span>}
              {b.wholesaleOnly && <span className='inline-flex h-5 items-center px-2 rounded-full bg-white/15 text-[10px] font-semibold text-white'>Full bundle only</span>}
            </div>
            <h2 className='display text-[42px] text-white drop-shadow-[0_4px_20px_rgb(0_0_0/0.5)]'>{meta?.displayName || 'Bundle'}</h2>
          </div>
          <div className='flex flex-wrap items-center justify-between gap-4'>
            <BigCountdown seconds={b.secondsLeft} label='Leaves in' onArt />
            <div className='flex items-baseline gap-2.5 rounded-full bg-black/40 border border-white/15 px-5 h-11 items-center text-white'>
              {b.totalBase != null && b.totalBase !== b.totalDiscounted && <span className='text-[12px] text-white/60 line-through tabular-nums'>{fmt(b.totalBase)}</span>}
              <Price amount={b.totalDiscounted ?? b.totalBase} cat={cat} size={17} onArt className='text-[20px]' />
            </div>
          </div>
        </div>
      </Card>
      <Stagger className='grid grid-cols-2 md:grid-cols-4 gap-3'>
        {b.items.map((it, i) => {
          const item = cat?.items.get(it.id)
          const clickable = !!item?.skin
          return (
            <Item key={it.id} index={i}>
              <Card hover={clickable} onClick={() => clickable && onOpen(item)} className='group overflow-hidden rounded-2xl flex items-center gap-3 pr-4'>
                <ItemArt item={item} className='w-24 h-16 shrink-0' />
                <div className='min-w-0 flex-1'>
                  <div className='truncate text-[12.5px] font-semibold text-text'>{item?.name || '...'}{it.amount > 1 ? ` x${it.amount}` : ''}</div>
                  <div className='mt-0.5 flex items-center justify-between gap-2 text-[11px]'>
                    <span className='text-muted capitalize'>{item?.kind}</span>
                    {it.price === 0 ? <span className='text-good font-bold'>Included</span> : <Price amount={it.price} cat={cat} size={11} />}
                  </div>
                </div>
              </Card>
            </Item>
          )
        })}
      </Stagger>
    </div>
  )
}

function Section({ title, hint, seconds, countdownLabel = 'Resets in', children }) {
  return (
    <section>
      <Heading hint={hint} right={seconds != null && <BigCountdown seconds={seconds} label={countdownLabel} />}>{title}</Heading>
      {children}
    </section>
  )
}

function ShopBody() {
  const cat = useCatalog()
  const store = useInvoke('store:storefront')
  const wallet = useInvoke('store:wallet')
  const [open, setOpen] = useState(null)
  const [bi, setBi] = useState(0)
  const s = store.data
  const bundle = s?.bundles[Math.min(bi, (s?.bundles.length || 1) - 1)]

  return (
    <Page title='Store' subtitle='Featured bundles, your daily offers and the accessory store'
      actions={<><Wallet wallet={wallet.data} cat={cat} /><Button size='icon' icon={FiRefreshCw} title='Refresh' loading={store.loading && !!s} onClick={() => { store.reload(); wallet.reload() }} /></>}>
      {store.error && !s ? <ErrorState error={store.error} onRetry={store.reload} /> : !s ? (
        <div className='space-y-5'><Skeleton className='h-[300px] rounded-3xl' /><div className='grid grid-cols-4 gap-4'>{[0, 1, 2, 3].map(i => <Skeleton key={i} className='h-64 rounded-2xl' />)}</div></div>
      ) : (
        <div className='space-y-12'>
          <section>
            {s.bundles.length > 1 && (
              <SegmentedTabs className='mb-4' layoutId='store-bundles' value={Math.min(bi, s.bundles.length - 1)} onChange={setBi}
                tabs={s.bundles.map((b, i) => ({ value: i, label: cat?.bundles[b.id]?.displayName || `Bundle ${i + 1}` }))} />
            )}
            {bundle ? <Swap id={bundle.id}><Bundle b={bundle} cat={cat} onOpen={setOpen} /></Swap>
              : <Card className='rounded-3xl'><Empty icon={FiPackage} title='No featured bundles right now' /></Card>}
          </section>

          <Section title='Daily offers' hint='Four skins, picked for you' seconds={s.dailySecondsLeft}>
            {s.daily.length ? <Stagger className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
              {s.daily.map((o, i) => <OfferCard key={o.id} index={i} item={cat?.items.get(o.itemId)} price={o.price} cat={cat} onOpen={setOpen} />)}
            </Stagger> : <Empty title='No daily offers' />}
          </Section>

          {s.night && (
            <Section title='Night market' hint={!s.night.offers.some(o => o.revealed) ? 'Offers have not been revealed in-game yet' : 'Your personal discounts'} seconds={s.night.secondsLeft} countdownLabel='Ends in'>
              <Stagger className='grid grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6 gap-4'>
                {s.night.offers.map((o, i) => <OfferCard key={o.id} index={i} item={cat?.items.get(o.itemId)} price={o.price} base={o.base} discount={o.discount / 100} cat={cat} onOpen={setOpen} />)}
              </Stagger>
              {!s.night.offers.some(o => o.revealed) && <p className='mt-3 text-xs text-muted flex items-center gap-1.5'><FiMoon /> Reveal them in VALORANT to lock in the discounts.</p>}
            </Section>
          )}

          {s.accessories && (
            <Section title='Accessories' hint='Buddies, cards, sprays and titles for Kingdom Credits' seconds={s.accessories.secondsLeft}>
              <Stagger className='grid grid-cols-2 md:grid-cols-4 gap-4'>
                {s.accessories.offers.map((o, i) => <OfferCard key={o.id} index={i} size='sm' item={cat?.items.get(o.itemId)} price={o.price} currencyId={o.currencyId} cat={cat} onOpen={setOpen} />)}
              </Stagger>
            </Section>
          )}
        </div>
      )}
      <SkinModal item={open} onClose={() => setOpen(null)} />
    </Page>
  )
}

export default function Shop() {
  return <RequireRiot><ShopBody /></RequireRiot>
}
