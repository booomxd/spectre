import { For, createSignal, Show } from 'solid-js'
import { st } from '../lib/st.js'
import { FiRefreshCw, FiMoon, FiPackage, FiPlay, FiHeart, FiX } from 'solid-icons/fi'
import { Page, Card, Heading, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, Modal, SegmentedTabs, Stagger, Item, Swap, cx } from '../ui'
import { useInvoke } from '../lib/ipc'
import { useWishlist } from '../lib/wishlist'
import { CUR, useCatalog, fmt, useCountdown } from './dashboard/catalog'
import { Price, ItemArt } from './dashboard/bits'

const pct = d => Math.round((d || 0) * 100)
const tierHex = item => item?.tier?.highlightColor ? '#' + item.tier.highlightColor.slice(0, 6) : null

// segmented live countdown: 5d 06h 59m 12s
function BigCountdown(props) {
  const leftA = useCountdown(() => props.seconds)
  
    
    const s = () => (Math.floor(leftA()))
    const parts = () => ([[Math.floor(s() / 86400), 'd'], [Math.floor(s() % 86400 / 3600), 'h'], [Math.floor(s() % 3600 / 60), 'm'], [s() % 60, 's']])
    const shown = () => (parts()[0][0] > 0 ? parts() : parts().slice(1))
    return (<Show when={!(leftA() == null)} fallback={null}><div class={cx('flex items-center gap-2', props["class"])}>
      {props.label && <span class={cx('text-[11px] font-semibold tracking-[0.14em] uppercase mr-1', props.onArt ? 'text-white/70' : 'text-muted')}>{props.label}</span>}
      <For each={shown()}>{([v, u]) => (
        <span class={cx('inline-flex items-baseline gap-0.5 rounded-xl px-2.5 h-8 items-center', props.onArt ? 'bg-black/35 border border-white/15' : 'glass-inset')}>
          <span class={cx('font-display text-[16px] font-bold tabular-nums tracking-tight', props.onArt ? 'text-white' : 'text-text')}>{String(v).padStart(2, '0')}</span>
          <span class={cx('text-[10px] font-semibold', props.onArt ? 'text-white/60' : 'text-muted')}>{u}</span>
        </span>
      )}</For>
    </div></Show>)
  
}

function Wallet(props) {
  
    
    return (<Show when={!(!props.wallet)} fallback={<Skeleton class='h-9 w-56 rounded-full' />}><div class='glass flex items-center rounded-full px-4 h-9 gap-4'>
      <Price amount={props.wallet.vp} currencyId={CUR.vp} cat={props.cat} size={15} />
      <span class='w-px h-4 bg-line' />
      <Price amount={props.wallet.rad} currencyId={CUR.rad} cat={props.cat} size={15} />
      <span class='w-px h-4 bg-line' />
      <Price amount={props.wallet.kc} currencyId={CUR.kc} cat={props.cat} size={15} />
    </div></Show>)
  
}

// large skin card: tier-tinted art stage, name, tier and price
function OfferCard(props) {
  
    const color = () => (tierHex(props.item))
    const clickable = () => (!!props.item?.skin)
    return (<Item index={props.index} class='h-full'>
      <Card hover={clickable()} onClick={() => clickable() && props.onOpen(props.item)} class='group relative overflow-hidden h-full flex flex-col'>
        <div class={cx('relative', (props.size ?? 'lg') === 'lg' ? 'h-48' : 'h-32')}>
          {color() && <div class='absolute inset-x-0 top-0 h-px' style={st({ background: `linear-gradient(90deg, transparent, ${color()}, transparent)` })} />}
          <ItemArt item={props.hidden ? null : props.item} class={cx('h-full', (props.size ?? 'lg') === 'lg' ? 'px-6 pt-6 pb-2' : 'px-5 pt-5 pb-1')} />
          {props.discount > 0 && <span class='absolute top-3 left-3 inline-flex h-6 items-center px-2.5 rounded-full accent-fill text-bg text-[11px] font-bold tabular-nums'>-{pct(props.discount)}%</span>}
          {clickable() && <span class='absolute top-3 right-3 w-8 h-8 rounded-full glass flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 transition-opacity'><FiPlay size={12} /></span>}
        </div>
        <div class='px-5 pb-5 pt-1 mt-auto flex items-end justify-between gap-3'>
          <div class='min-w-0'>
            <div class={cx('truncate font-semibold tracking-tight text-text', (props.size ?? 'lg') === 'lg' ? 'text-[15px]' : 'text-[13px]')}>{props.hidden ? 'Not revealed yet' : props.item?.name || 'Loading...'}</div>
            <div class='mt-1 flex items-center gap-1.5 text-[11px] font-medium text-muted'>
              {color() && <span class='w-1.5 h-1.5 rounded-full' style={st({ background: color(), boxShadow: `0 0 8px ${color()}` })} />}
              <span class='capitalize'>{props.item?.tier?.devName || props.item?.kind || ''}</span>
            </div>
          </div>
          <div class='text-right shrink-0'>
            {props.base != null && props.base !== props.price && <div class='text-[11px] text-muted line-through tabular-nums'>{fmt(props.base)}</div>}
            <Price amount={props.price} cat={props.cat} currencyId={props.currencyId} class={(props.size ?? 'lg') === 'lg' ? 'text-[17px]' : 'text-[14px]'} size={(props.size ?? 'lg') === 'lg' ? 15 : 13} />
          </div>
        </div>
      </Card>
    </Item>)
  
}

function SkinModal(props) {
  const [chromaS, setChroma] = createSignal(null)
  
    const skin = () => (props.item?.skin)
    const chromas = () => (skin()?.chromas || [])
    const active = () => (chromaS() ? chromas().find(c => c.uuid === chromaS()) : null)
    const video = () => (active()?.streamedVideo || [...(skin()?.levels || [])].reverse().find(l => l.streamedVideo)?.streamedVideo || skin()?.streamedVideo)
    const close = () => { props.onClose(); setChroma(null) }
    return (<Modal open={!!props.item} onClose={close} title={props.item?.name} width={680}>
      {props.item && (
        <div class='space-y-5'>
          <ItemArt item={{ ...props.item, icon: active()?.fullRender || props.item.icon }} class='glass-inset h-60 rounded-2xl' />
          {chromas().length > 1 && (
            <div>
              <div class='eyebrow mb-2.5'>Variants</div>
              <div class='flex flex-wrap gap-2'>
                <For each={chromas()}>{(c, idx) => (
                  <button onClick={() => setChroma(c.uuid)} title={c.displayName}
                    class={cx('w-16 h-12 rounded-xl flex items-center justify-center transition-transform hover:-translate-y-0.5', c.uuid === chromaS() || (!chromaS() && idx() === 0) ? 'accent-soft' : 'glass')}>
                    {(c.swatch || c.fullRender) && <img decoding='async' src={c.swatch || c.fullRender} alt='' class='max-h-9 max-w-14 object-contain' />}
                  </button>
                )}</For>
              </div>
            </div>
          )}
          {video() ? <video src={video()} controls muted loop class='w-full rounded-2xl border border-line bg-black' />
            : <p class='text-xs text-muted'>No video preview available for this skin.</p>}
        </div>
      )}
    </Modal>)
  
}

// featured bundle: full-bleed art hero with a live countdown, items in a strip below
function Bundle(props) {
  
    const meta = () => (props.cat?.bundles[props.b.id])
    const art = () => (meta()?.displayIcon2 || meta()?.displayIcon)
    return (<div class='flex flex-col gap-4'>
      <Card class='relative overflow-hidden rounded-3xl h-[300px]'>
        {art() ? <img decoding='async' src={art()} alt='' class='absolute inset-0 w-full h-full object-cover' draggable={false} /> : <span class='halo -top-24 -left-20 w-96 h-96' />}
        <div class='absolute inset-0 bg-gradient-to-r from-black/85 via-black/45 to-transparent' />
        <div class='absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent' />
        <div class='relative h-full flex flex-col justify-end p-8 gap-5'>
          <div>
            <div class='flex items-center gap-2 mb-3'>
              <span class='text-[11px] font-semibold tracking-[0.14em] uppercase text-white/70'>Featured bundle</span>
              {props.b.discountPercent > 0 && <span class='inline-flex h-5 items-center px-2 rounded-full bg-good/90 text-[10px] font-bold text-black tabular-nums'>-{pct(props.b.discountPercent)}%</span>}
              {props.b.wholesaleOnly && <span class='inline-flex h-5 items-center px-2 rounded-full bg-white/15 text-[10px] font-semibold text-white'>Full bundle only</span>}
            </div>
            <h2 class='display text-[52px] text-white drop-shadow-[0_4px_20px_rgb(0_0_0/0.5)]'>{meta()?.displayName || 'Bundle'}</h2>
          </div>
          <div class='flex flex-wrap items-center justify-between gap-4'>
            <BigCountdown seconds={props.b.secondsLeft} label='Leaves in' onArt />
            <div class='flex items-baseline gap-2.5 rounded-full bg-black/40 border border-white/15 px-5 h-11 items-center text-white'>
              {props.b.totalBase != null && props.b.totalBase !== props.b.totalDiscounted && <span class='text-[12px] text-white/60 line-through tabular-nums'>{fmt(props.b.totalBase)}</span>}
              <Price amount={props.b.totalDiscounted ?? props.b.totalBase} cat={props.cat} size={17} onArt class='text-[20px]' />
            </div>
          </div>
        </div>
      </Card>
      <Stagger class='grid grid-cols-2 md:grid-cols-4 xl:grid-cols-4 gap-3'>
        {props.b.items.map((it, i) => {
          const item = props.cat?.items.get(it.id)
          const clickable = !!item?.skin
          return (
            <Item index={i}>
              <Card hover={clickable} onClick={() => clickable && props.onOpen(item)} class='group overflow-hidden rounded-2xl flex items-center gap-3 pr-4'>
                <ItemArt item={item} class='w-24 h-16 shrink-0' />
                <div class='min-w-0 flex-1'>
                  <div class='truncate text-[12.5px] font-semibold text-text'>{item?.name || '...'}{it.amount > 1 ? ` x${it.amount}` : ''}</div>
                  <div class='mt-0.5 flex items-center justify-between gap-2 text-[11px]'>
                    <span class='text-muted capitalize'>{item?.kind}</span>
                    {it.price === 0 ? <span class='text-good font-bold'>Included</span> : <Price amount={it.price} cat={props.cat} size={11} />}
                  </div>
                </div>
              </Card>
            </Item>
          )
        })}
      </Stagger>
    </div>)
  
}

function Section(props) {
  return (
    <section>
      <Heading hint={props.hint} right={props.seconds != null && <BigCountdown seconds={props.seconds} label={(props.countdownLabel ?? 'Resets in')} />}>{props.title}</Heading>
      {props.children}
    </section>
  )
}

const WHERE = { daily: 'In your daily offers', night: 'In your Night Market', bundle: 'In a featured bundle' }

// skins you are waiting for
function Wishlist(props) {
  const __wishlist = useWishlist()
  const check = useInvoke('wishlist:check', [], { deps: () => ([__wishlist.items.length]) })
  
    const hits = () => (new Map((check.data?.hits || []).map(h => [h.id, h])))
    return (<section>
      <Heading hint='You get a Windows notification when one of these reaches your store'>Wishlist</Heading>
      {__wishlist.items.length === 0
        ? <Card class='rounded-2xl'><Empty icon={FiHeart} title='Nothing on your wishlist yet' hint='Open Weapons and press the heart on any skin you want.' /></Card>
        : (
          <div class='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3'>
            {__wishlist.items.map(i => {
              const item = props.cat?.items.get(i.id)
              const hit = hits().get(i.id)
              const name = item?.name || i.name
              return (
                <Card class={cx('relative flex items-center gap-3 p-3 pr-10 rounded-2xl min-w-0', hit && 'accent-glow')}>
                  <div class='w-20 h-12 shrink-0 flex items-center justify-center'>{item?.icon && <img decoding='async' src={item.icon} alt='' class='max-w-full max-h-full object-contain' loading='lazy' />}</div>
                  <div class='min-w-0'>
                    <div class='truncate text-[13px] font-semibold text-text'>{name}</div>
                    <div class={cx('mt-0.5 text-[11px] truncate', hit ? 'text-good font-semibold' : 'text-muted')}>{hit ? WHERE[hit.where] : 'Not in your store'}</div>
                  </div>
                  <button type='button' aria-label={`Remove ${name} from wishlist`} title='Remove from wishlist' onClick={() => __wishlist.toggle(i.id, name)}
                    class='absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors'><FiX size={12} /></button>
                </Card>
              )
            })}
          </div>
        )}
    </section>)
  
}

function ShopBody() {
  const catA = useCatalog()
  const store = useInvoke('store:storefront')
  const wallet = useInvoke('store:wallet')
  const [openS, setOpen] = createSignal(null)
  const [biS, setBi] = createSignal(0)
  
    const s = () => (store.data)
    const bundle = () => (s()?.bundles[Math.min(biS(), (s()?.bundles.length || 1) - 1)])
    return (<Page title='Store' subtitle='Featured bundles, your daily offers and the accessory store'
      actions={<><Wallet wallet={wallet.data} cat={catA()} /><Button size='icon' icon={FiRefreshCw} title='Refresh' loading={store.loading && !!s()} onClick={() => { store.reload(); wallet.reload() }} /></>}>
      {store.error && !s() ? <ErrorState error={store.error} onRetry={store.reload} /> : !s() ? (
        <div class='space-y-6'><Skeleton class='h-[300px] rounded-3xl' /><div class='grid grid-cols-4 gap-4'><For each={[0, 1, 2, 3]}>{i => <Skeleton class='h-64 rounded-2xl' />}</For></div></div>
      ) : (
        <div class='space-y-12'>
          <section>
            {s().bundles.length > 1 && (
              <SegmentedTabs class='mb-4' layoutId='store-bundles' value={Math.min(biS(), s().bundles.length - 1)} onChange={setBi}
                tabs={s().bundles.map((b, i) => ({ value: i, label: catA()?.bundles[b.id]?.displayName || `Bundle ${i + 1}` }))} />
            )}
            {bundle() ? <Swap id={bundle().id}><Bundle b={bundle()} cat={catA()} onOpen={setOpen} /></Swap>
              : <Card class='rounded-3xl'><Empty icon={FiPackage} title='No featured bundles right now' /></Card>}
          </section>

          <Section title='Daily offers' hint='Four skins, picked for you' seconds={s().dailySecondsLeft}>
            {s().daily.length ? <Stagger class='grid grid-cols-2 xl:grid-cols-4 gap-4'>
              <For each={s().daily}>{(o, i) => <OfferCard index={i()} item={catA()?.items.get(o.itemId)} price={o.price} cat={catA()} onOpen={setOpen} />}</For>
            </Stagger> : <Empty title='No daily offers' />}
          </Section>

          <Wishlist cat={catA()} />

          {s().night && (
            <Section title='Night market' hint={!s().night.offers.some(o => o.revealed) ? 'Offers have not been revealed in-game yet' : 'Your personal discounts'} seconds={s().night.secondsLeft} countdownLabel='Ends in'>
              <Stagger class='grid grid-cols-2 xl:grid-cols-3 gap-4'>
                <For each={s().night.offers}>{(o, i) => <OfferCard index={i()} item={catA()?.items.get(o.itemId)} price={o.price} base={o.base} discount={o.discount / 100} cat={catA()} onOpen={setOpen} />}</For>
              </Stagger>
              {!s().night.offers.some(o => o.revealed) && <p class='mt-3 text-xs text-muted flex items-center gap-1.5'><FiMoon /> Reveal them in VALORANT to lock in the discounts.</p>}
            </Section>
          )}

          {s().accessories && (
            <Section title='Accessories' hint='Buddies, cards, sprays and titles for Kingdom Credits' seconds={s().accessories.secondsLeft}>
              <Stagger class='grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4'>
                <For each={s().accessories.offers}>{(o, i) => <OfferCard index={i()} size='sm' item={catA()?.items.get(o.itemId)} price={o.price} currencyId={o.currencyId} cat={catA()} onOpen={setOpen} />}</For>
              </Stagger>
            </Section>
          )}
        </div>
      )}
      <SkinModal item={openS()} onClose={() => setOpen(null)} />
    </Page>)
  
}

export default function Shop() {
  return <RequireRiot><ShopBody /></RequireRiot>
}
