import { useState } from 'react'
import { FiRefreshCw, FiMoon, FiPackage } from 'react-icons/fi'
import { Page, Card, SectionTitle, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, Modal } from '../ui'
import { useInvoke } from '../lib/ipc'
import { CUR, useCatalog, fmt } from './dashboard/catalog'
import { Price, Countdown, ItemArt } from './dashboard/bits'

const pct = d => Math.round((d || 0) * 100)

function Wallet({ wallet, cat }) {
  if (!wallet) return <Skeleton className='h-9 w-56' />
  return (
    <div className='glass flex items-center rounded-full px-4 h-9 gap-4'>
      <Price amount={wallet.vp} currencyId={CUR.vp} cat={cat} size={16} />
      <Price amount={wallet.rad} currencyId={CUR.rad} cat={cat} size={16} />
      <Price amount={wallet.kc} currencyId={CUR.kc} cat={cat} size={16} />
    </div>
  )
}

function OfferCard({ item, price, base, discount, cat, onOpen, i, currencyId }) {
  const tierColor = item?.tier?.highlightColor ? '#' + item.tier.highlightColor.slice(0, 6) : null
  return (
    <Card hover={!!item?.skin} onClick={() => item?.skin && onOpen(item)} className='group overflow-hidden anim-rise' style={{ animationDelay: `${i * 50}ms` }}>
      <ItemArt item={item} className='h-32' />
      <div className='px-4 pb-4 pt-1.5 flex items-end justify-between gap-3'>
        <div className='min-w-0'>
          <div className='truncate text-[13px] font-semibold text-text'>{item?.name || 'Loading...'}</div>
          <div className='mt-0.5 text-[11px] font-medium text-muted' style={tierColor ? { color: tierColor } : undefined}>{item?.tier?.devName || item?.kind || ''}</div>
        </div>
        <div className='text-right shrink-0'>
          {base != null && base !== price && <div className='text-[11px] text-muted line-through tabular-nums'>{fmt(base)}</div>}
          <Price amount={price} cat={cat} currencyId={currencyId} className='text-[15px]' />
          {discount > 0 && <div className='mt-0.5 ml-auto flex w-fit h-5 items-center px-2 rounded-full border border-good/30 bg-good/15 text-[10px] font-bold text-good tabular-nums'>-{pct(discount)}%</div>}
        </div>
      </div>
      {tierColor && <div className='h-[3px] opacity-80' style={{ background: `linear-gradient(90deg, transparent, ${tierColor}, transparent)` }} />}
    </Card>
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
    <Modal open={!!item} onClose={close} title={item?.name} width={640}>
      {item && (
        <div className='space-y-4'>
          <ItemArt item={{ ...item, icon: active?.fullRender || item.icon }} className='glass h-56 rounded-xl' />
          {chromas.length > 1 && (
            <div>
              <SectionTitle>Chromas</SectionTitle>
              <div className='flex flex-wrap gap-2'>
                {chromas.map((c, idx) => (
                  <button key={c.uuid} onClick={() => setChroma(c.uuid)} title={c.displayName}
                    className={'w-16 h-12 rounded-xl border flex items-center justify-center transition-all hover:-translate-y-0.5 ' + (c.uuid === chroma || (!chroma && idx === 0) ? 'accent-soft border-transparent' : 'glass hover:border-accent/40')}>
                    {(c.swatch || c.fullRender) && <img src={c.swatch || c.fullRender} alt='' className='max-h-9 max-w-14 object-contain' />}
                  </button>
                ))}
              </div>
            </div>
          )}
          {video ? <video key={video} src={video} controls muted loop className='w-full rounded-xl border border-line bg-black' />
            : <p className='text-xs text-muted'>No video preview available for this skin.</p>}
        </div>
      )}
    </Modal>
  )
}

function Bundle({ b, cat, onOpen, i }) {
  const meta = cat?.bundles[b.id]
  const art = meta?.displayIcon2 || meta?.displayIcon
  return (
    <Card className='overflow-hidden anim-rise' style={{ animationDelay: `${i * 70}ms` }}>
      <div className='flex flex-col lg:flex-row'>
        <div className='relative lg:w-72 shrink-0 h-44 lg:h-auto bg-surface-2 overflow-hidden'>
          {art && <img src={art} alt='' className='absolute inset-0 w-full h-full object-cover' />}
          <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent' />
          <div className='absolute bottom-4 left-5 right-5'>
            <div className='font-display text-2xl font-bold tracking-tight text-white leading-tight drop-shadow-[0_2px_8px_rgb(0_0_0/0.5)]'>{meta?.displayName || 'Bundle'}</div>
            <Countdown seconds={b.secondsLeft} className='text-xs font-medium text-white/80 mt-1.5' />
          </div>
        </div>
        <div className='flex-1 p-5 min-w-0'>
          <div className='flex items-center justify-between mb-4 gap-3'>
            <div className='flex items-center gap-2'>
              {b.discountPercent > 0 && <Badge tone='good'>-{pct(b.discountPercent)}%</Badge>}
              {b.wholesaleOnly && <Badge>Full bundle only</Badge>}
            </div>
            <div className='flex items-baseline gap-2'>
              {b.totalBase != null && b.totalBase !== b.totalDiscounted && <span className='text-xs text-muted line-through tabular-nums'>{fmt(b.totalBase)}</span>}
              <Price amount={b.totalDiscounted ?? b.totalBase} cat={cat} size={18} className='text-xl text-accent' />
            </div>
          </div>
          <div className='grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3'>
            {b.items.map(it => {
              const item = cat?.items.get(it.id)
              const clickable = !!item?.skin
              return (
                <div key={it.id} onClick={() => clickable && onOpen(item)}
                  className={'group glass rounded-xl overflow-hidden transition-all ' + (clickable ? 'lift cursor-pointer' : '')}>
                  <ItemArt item={item} className='h-20' />
                  <div className='px-3 pb-3'>
                    <div className='truncate text-[12px] font-semibold text-text'>{item?.name || '...'}{it.amount > 1 ? ` x${it.amount}` : ''}</div>
                    <div className='mt-0.5 flex items-center justify-between text-[11px]'>
                      <span className='text-muted capitalize'>{item?.kind}</span>
                      {it.price === 0 ? <span className='text-good font-bold'>Included</span> : <Price amount={it.price} cat={cat} size={11} />}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </Card>
  )
}

function ShopBody() {
  const cat = useCatalog()
  const store = useInvoke('store:storefront')
  const wallet = useInvoke('store:wallet')
  const [open, setOpen] = useState(null)
  const s = store.data

  return (
    <Page title='Shop' subtitle='Your rotating store: bundles, daily offers and accessories'
      actions={<><Wallet wallet={wallet.data} cat={cat} /><Button icon={FiRefreshCw} loading={store.loading && !!s} onClick={() => { store.reload(); wallet.reload() }}>Refresh</Button></>}>
      {store.error && !s ? <ErrorState error={store.error} onRetry={store.reload} /> : !s ? (
        <div className='space-y-5'><Skeleton className='h-56 rounded-xl' /><div className='grid grid-cols-4 gap-4'>{[0, 1, 2, 3].map(i => <Skeleton key={i} className='h-44 rounded-xl' />)}</div></div>
      ) : (
        <div className='space-y-10'>
          <section>
            <SectionTitle>Featured bundles</SectionTitle>
            {s.bundles.length ? <div className='space-y-5'>{s.bundles.map((b, i) => <Bundle key={b.id} b={b} cat={cat} onOpen={setOpen} i={i} />)}</div>
              : <Empty icon={FiPackage} title='No featured bundles right now' />}
          </section>

          <section>
            <SectionTitle right={<Countdown seconds={s.dailySecondsLeft} className='text-xs text-muted' />}>Daily offers</SectionTitle>
            {s.daily.length ? <div className='grid grid-cols-2 xl:grid-cols-4 gap-4'>
              {s.daily.map((o, i) => <OfferCard key={o.id} i={i} item={cat?.items.get(o.itemId)} price={o.price} cat={cat} onOpen={setOpen} />)}
            </div> : <Empty title='No daily offers' />}
          </section>

          {s.night && (
            <section>
              <SectionTitle right={<Countdown seconds={s.night.secondsLeft} className='text-xs text-muted' />}>Night market</SectionTitle>
              <div className='grid grid-cols-2 xl:grid-cols-3 gap-4'>
                {s.night.offers.map((o, i) => <OfferCard key={o.id} i={i} item={cat?.items.get(o.itemId)} price={o.price} base={o.base} discount={o.discount / 100} cat={cat} onOpen={setOpen} />)}
              </div>
              {!s.night.offers.some(o => o.revealed) && <p className='mt-3 text-xs text-muted flex items-center gap-1.5'><FiMoon /> Offers have not been revealed in-game yet.</p>}
            </section>
          )}

          {s.accessories && (
            <section>
              <SectionTitle right={<Countdown seconds={s.accessories.secondsLeft} className='text-xs text-muted' />}>Accessory store</SectionTitle>
              <div className='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'>
                {s.accessories.offers.map((o, i) => <OfferCard key={o.id} i={i} item={cat?.items.get(o.itemId)} price={o.price} currencyId={o.currencyId} cat={cat} onOpen={setOpen} />)}
              </div>
            </section>
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
