import { useEffect, useState } from 'react'
import { FiUsers, FiShoppingBag, FiTrendingUp, FiClock } from 'react-icons/fi'
import { Card, SectionTitle, Badge, Skeleton, Empty } from '../../ui'
import { useContent, useTiers } from '../../lib/content'
import { navigate } from '../../nav'
import { CUR, rewardItem, fmt, fmtDuration, useCountdown } from './catalog'
import { Price, Countdown, ItemArt } from './bits'

const go = id => () => navigate(id)

export function Hero({ riot, identity, account, rank }) {
  const tiers = useTiers()
  const card = useContent(identity ? `playercards/${identity.cardId}` : 'playercards/00000000-0000-0000-0000-000000000000')
  const t = rank && tiers?.[rank.tier]
  const peak = rank && tiers?.[rank.peak]
  const color = t?.color ? '#' + t.color.slice(0, 6) : null
  return (
    <Card className='relative overflow-hidden anim-rise min-h-[200px] rounded-2xl'>
      {card?.wideArt && <img src={card.wideArt} alt='' className='absolute inset-0 w-full h-full object-cover opacity-60 scale-[1.02]' />}
      {/* Theme-tinted scrim keeps token-colored text legible over the card art on dark and Pearl themes. */}
      <div className='absolute inset-0 bg-gradient-to-r from-bg via-bg/80 to-bg/5' />
      <div className='absolute inset-0 bg-gradient-to-t from-bg/40 to-transparent' />
      <div className='absolute -top-24 -left-16 w-72 h-72 rounded-full bg-accent/[0.12] blur-3xl pointer-events-none' />
      <div className='relative p-7 flex flex-wrap items-center gap-7'>
        <div className='flex-1 min-w-[240px]'>
          <div className='text-[11px] font-semibold tracking-[0.14em] uppercase text-muted'>Welcome back</div>
          <h1 className='mt-1.5 font-display text-[40px] font-bold tracking-tight text-text leading-tight truncate'>
            {riot.gameName || 'Agent'}<span className='text-muted text-xl font-semibold'>{riot.tagLine ? ` #${riot.tagLine}` : ''}</span>
          </h1>
          <div className='mt-4 flex flex-wrap items-center gap-2'>
            {account && <Badge tone='accent'>Level {account.level}</Badge>}
            {riot.region && <Badge>{riot.region}</Badge>}
          </div>
        </div>
        <div onClick={go('progression')} className='glass-strong lift flex items-center gap-5 rounded-2xl pl-4 pr-6 py-4 cursor-pointer group'>
          {!rank ? <Skeleton className='w-20 h-20 rounded-2xl' /> : (
            <>
              {t && <img src={t.largeIcon} alt='' className='w-20 h-20 object-contain drop-shadow-[0_6px_18px_rgb(0_0_0/0.3)] transition-transform duration-300 group-hover:scale-110' />}
              <div>
                <div className='font-display text-2xl font-bold tracking-tight leading-none' style={color ? { color } : undefined}>{rank.tier ? t?.tierName : 'Unranked'}</div>
                {rank.tier > 0 && <div className='mt-1.5 text-sm font-medium text-text tabular-nums'>{rank.rr} RR <span className={rank.lastChange >= 0 ? 'text-good' : 'text-bad'}>({rank.lastChange >= 0 ? '+' : ''}{rank.lastChange})</span></div>}
                {rank.tier > 0 && rank.tier < 27 && <div className='mt-2.5 h-1.5 w-40 rounded-full bg-surface-2 overflow-hidden'><div className='h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-1000' style={{ width: rank.rr + '%' }} /></div>}
                {peak && <div className='mt-2.5 flex items-center gap-1.5 text-[11px] text-muted'><img src={peak.smallIcon} alt='' className='w-4 h-4' />Peak {peak.tierName}</div>}
              </div>
            </>
          )}
        </div>
      </div>
    </Card>
  )
}

export function WalletCard({ wallet, cat }) {
  const rows = [['VP', CUR.vp, wallet?.vp], ['Radianite', CUR.rad, wallet?.rad], ['Kingdom Credits', CUR.kc, wallet?.kc]]
  return (
    <Card className='p-5 anim-rise'>
      <SectionTitle>Wallet</SectionTitle>
      <div className='space-y-1'>
        {rows.map(([label, id, v]) => (
          <div key={id} className='flex items-center justify-between rounded-xl px-3 py-2.5 bg-surface-2/50'>
            <span className='text-[13px] text-muted'>{label}</span>
            {wallet ? <Price amount={v} currencyId={id} cat={cat} size={18} className='text-lg' /> : <Skeleton className='h-5 w-16' />}
          </div>
        ))}
      </div>
    </Card>
  )
}

export function BundleCard({ bundles, cat }) {
  const b = bundles?.[0]
  const meta = b && cat?.bundles[b.id]
  const art = meta?.displayIcon2 || meta?.displayIcon
  return (
    <Card hover onClick={go('shop')} className='group relative overflow-hidden anim-rise min-h-[160px]'>
      {art && <img src={art} alt='' className='absolute inset-0 w-full h-full object-cover opacity-75 transition-transform duration-700 ease-out group-hover:scale-105' />}
      <div className='absolute inset-0 bg-gradient-to-t from-bg via-bg/55 to-bg/5' />
      <div className='relative p-5 h-full flex flex-col justify-between min-h-[160px]'>
        <div className='flex items-center justify-between'>
          <span className='text-[11px] font-semibold tracking-[0.14em] uppercase text-muted'>Featured bundle</span>
          {bundles?.length > 1 && <Badge>+{bundles.length - 1} more</Badge>}
        </div>
        {!bundles ? <Skeleton className='h-10' /> : !b ? <span className='text-sm text-muted'>No bundles right now</span> : (
          <div className='flex items-end justify-between gap-2'>
            <div className='min-w-0'>
              <div className='truncate font-display text-xl font-bold tracking-tight text-text'>{meta?.displayName || 'Bundle'}</div>
              <Countdown seconds={b.secondsLeft} className='mt-0.5 text-xs text-muted' />
            </div>
            <div className='text-right shrink-0 space-y-1'>
              {b.discountPercent > 0 && <Badge tone='good'>-{Math.round(b.discountPercent * 100)}%</Badge>}
              <div><Price amount={b.totalDiscounted ?? b.totalBase} cat={cat} size={16} className='text-xl text-accent' /></div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function DailyCard({ store, cat }) {
  return (
    <Card hover onClick={go('shop')} className='p-5 anim-rise'>
      <SectionTitle right={store && <Countdown seconds={store.dailySecondsLeft} className='text-[11px] text-muted' />}>Daily offers</SectionTitle>
      <div className='grid grid-cols-4 gap-3'>
        {!store ? [0, 1, 2, 3].map(i => <Skeleton key={i} className='h-28 rounded-xl' />) : store.daily.length ? store.daily.slice(0, 4).map(o => {
          const item = cat?.items.get(o.itemId)
          return (
            <div key={o.id} className='group rounded-xl border border-line bg-surface-2/60 overflow-hidden transition-colors hover:border-accent/40'>
              <ItemArt item={item} className='h-[72px]' />
              <div className='px-2.5 pb-2.5'>
                <div className='truncate text-[11px] font-semibold text-text'>{item?.name || '...'}</div>
                <Price amount={o.price} cat={cat} size={11} className='mt-0.5 text-[11px] text-muted' />
              </div>
            </div>
          )
        }) : <div className='col-span-4 text-[13px] text-muted py-6 text-center'>No daily offers</div>}
      </div>
    </Card>
  )
}

export function PassCard({ pass, cat, loading }) {
  const flat = pass?.chapters.flatMap(c => c.levels) || []
  const next = flat[pass?.progressionLevel]
  const nextReward = rewardItem(cat, next?.reward)
  return (
    <Card hover onClick={go('progression')} className='p-5 anim-rise'>
      <SectionTitle right={<span className='accent-soft w-7 h-7 rounded-full flex items-center justify-center text-accent text-[13px]'><FiTrendingUp /></span>}>Battle pass</SectionTitle>
      {loading ? <Skeleton className='h-16 rounded-xl' /> : !pass ? <div className='text-[13px] text-muted py-3'>No active battle pass</div> : (
        <>
          <div className='flex items-baseline justify-between gap-3'>
            <span className='truncate text-[13px] font-semibold text-text'>{pass.name}</span>
            <span className='font-display text-3xl font-bold tracking-tight text-accent tabular-nums'>{pass.progressionLevel}<span className='text-xs font-semibold text-muted'>/{flat.length}</span></span>
          </div>
          <div className='mt-3 h-2 rounded-full bg-surface-2 overflow-hidden'>
            <div className='h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-1000' style={{ width: Math.min(100, next?.xp ? pass.towardsNext / next.xp * 100 : 100) + '%' }} />
          </div>
          <div className='mt-3 flex items-center gap-2.5 text-[11px] text-muted'>
            {nextReward?.icon && <img src={nextReward.icon} alt='' className='w-9 h-9 p-1 rounded-lg bg-surface-2 border border-line object-contain shrink-0' />}
            <span className='truncate'>{next ? `Next: ${nextReward?.name || 'reward'} (${fmt(pass.towardsNext)} / ${fmt(next.xp)} XP)` : 'Pass complete'}</span>
          </div>
        </>
      )}
    </Card>
  )
}

export function FriendsCard({ friends }) {
  const tiers = useTiers()
  const online = (friends.data || []).filter(f => f.online)
  return (
    <Card hover onClick={go('friends')} className='p-5 anim-rise h-full'>
      <SectionTitle right={friends.data && <Badge tone='good'>{online.length} online</Badge>}>Friends</SectionTitle>
      {friends.loading && !friends.data ? <div className='space-y-2'>{[0, 1, 2, 3].map(i => <Skeleton key={i} className='h-10 rounded-xl' />)}</div>
        : friends.error || !online.length ? <Empty icon={FiUsers} title={friends.error ? 'Friends unavailable' : 'Nobody online'} hint={friends.error ? 'Open the Friends page to retry.' : 'Online friends will appear here.'} className='py-6' />
          : (
            <div className='space-y-1 stagger'>
              {online.slice(0, 7).map((f, i) => {
                const s = f.status || {}
                const rankIcon = typeof s.rank === 'number' ? tiers?.[s.rank]?.smallIcon : null
                return (
                  <div key={f.puuid} style={{ '--i': i }} className='anim-rise flex items-center gap-2.5 rounded-xl px-2.5 py-2 -mx-1 hover:bg-surface-2 transition-colors'>
                    <span className='w-2 h-2 rounded-full bg-good anim-pulse shadow-[0_0_8px_rgb(var(--good)/0.6)] shrink-0' />
                    <span className='truncate text-[13px] text-text flex-1'>{f.gameName}<span className='text-muted'> #{f.tagLine}</span></span>
                    <span className='text-[11px] text-muted capitalize truncate max-w-[110px]'>{[s.state, s.map].filter(Boolean).join(' - ')}</span>
                    {rankIcon && <img src={rankIcon} alt='' className='w-5 h-5' />}
                  </div>
                )
              })}
            </div>
          )}
    </Card>
  )
}

export function ClockCard({ store }) {
  const [now, setNow] = useState(new Date())
  useEffect(() => { const i = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(i) }, [])
  const left = useCountdown(store?.dailySecondsLeft)
  return (
    <Card className='p-5 anim-rise'>
      <SectionTitle right={<FiClock className='text-muted' />}>Local time</SectionTitle>
      <div className='font-display text-[44px] font-bold tracking-tight text-text tabular-nums leading-none'>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<span className='ml-1 text-base font-semibold text-muted'>{String(now.getSeconds()).padStart(2, '0')}</span></div>
      <div className='mt-2 text-[13px] text-muted'>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      {left != null && <div className='mt-4 inline-flex items-center gap-1.5 rounded-full border border-line bg-surface-2 px-3 py-1.5 text-[11px] text-muted'><FiShoppingBag /> Store refreshes in <span className='font-semibold text-text tabular-nums'>{fmtDuration(left)}</span></div>}
    </Card>
  )
}
