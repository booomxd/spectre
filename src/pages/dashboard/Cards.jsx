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
    <Card className='relative overflow-hidden anim-rise min-h-[190px]'>
      {card?.wideArt && <img src={card.wideArt} alt='' className='absolute inset-0 w-full h-full object-cover opacity-50' />}
      <div className='absolute inset-0 bg-gradient-to-r from-bg via-bg/85 to-bg/10' />
      <div className='relative p-6 flex flex-wrap items-center gap-6'>
        <div className='flex-1 min-w-[240px]'>
          <div className='text-[10px] font-semibold tracking-[0.2em] uppercase text-muted'>Welcome back</div>
          <h1 className='font-display text-4xl font-bold uppercase text-text leading-tight truncate'>
            {riot.gameName || 'Agent'}<span className='text-muted text-xl'>{riot.tagLine ? ` #${riot.tagLine}` : ''}</span>
          </h1>
          <div className='mt-3 flex flex-wrap items-center gap-2'>
            {account && <Badge tone='accent'>Level {account.level}</Badge>}
            {riot.region && <Badge>{riot.region}</Badge>}
          </div>
        </div>
        <div onClick={go('progression')} className='flex items-center gap-4 cursor-pointer group'>
          {!rank ? <Skeleton className='w-20 h-20 rounded-xl' /> : (
            <>
              {t && <img src={t.largeIcon} alt='' className='w-20 h-20 object-contain drop-shadow-[0_0_18px_rgba(255,255,255,0.15)] transition-transform group-hover:scale-110' />}
              <div>
                <div className='font-display text-2xl font-bold uppercase leading-none' style={color ? { color } : undefined}>{rank.tier ? t?.tierName : 'Unranked'}</div>
                {rank.tier > 0 && <div className='mt-1 text-sm text-text tabular-nums'>{rank.rr} RR <span className={rank.lastChange >= 0 ? 'text-good' : 'text-bad'}>({rank.lastChange >= 0 ? '+' : ''}{rank.lastChange})</span></div>}
                {rank.tier > 0 && rank.tier < 27 && <div className='mt-2 h-1.5 w-40 rounded-full bg-surface-2 overflow-hidden'><div className='h-full bg-accent transition-all duration-1000' style={{ width: rank.rr + '%' }} /></div>}
                {peak && <div className='mt-2 flex items-center gap-1 text-[11px] text-muted'><img src={peak.smallIcon} alt='' className='w-4 h-4' />Peak {peak.tierName}</div>}
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
    <Card className='p-4 anim-rise'>
      <SectionTitle>Wallet</SectionTitle>
      <div className='space-y-2.5'>
        {rows.map(([label, id, v]) => (
          <div key={id} className='flex items-center justify-between'>
            <span className='text-xs text-muted'>{label}</span>
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
    <Card hover onClick={go('shop')} className='relative overflow-hidden anim-rise min-h-[150px]'>
      {art && <img src={art} alt='' className='absolute inset-0 w-full h-full object-cover opacity-70' />}
      <div className='absolute inset-0 bg-gradient-to-t from-bg via-bg/50 to-transparent' />
      <div className='relative p-4 h-full flex flex-col justify-between min-h-[150px]'>
        <div className='flex items-center justify-between'>
          <span className='text-[11px] font-semibold tracking-[0.18em] uppercase text-muted'>Featured bundle</span>
          {bundles?.length > 1 && <Badge>+{bundles.length - 1} more</Badge>}
        </div>
        {!bundles ? <Skeleton className='h-10' /> : !b ? <span className='text-sm text-muted'>No bundles right now</span> : (
          <div className='flex items-end justify-between gap-2'>
            <div className='min-w-0'>
              <div className='truncate font-display text-lg font-bold uppercase text-text'>{meta?.displayName || 'Bundle'}</div>
              <Countdown seconds={b.secondsLeft} className='text-xs text-muted' />
            </div>
            <div className='text-right shrink-0'>
              {b.discountPercent > 0 && <Badge tone='good'>-{Math.round(b.discountPercent * 100)}%</Badge>}
              <div><Price amount={b.totalDiscounted ?? b.totalBase} cat={cat} className='text-lg text-accent' /></div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function DailyCard({ store, cat }) {
  return (
    <Card hover onClick={go('shop')} className='p-4 anim-rise'>
      <SectionTitle right={store && <Countdown seconds={store.dailySecondsLeft} className='text-[11px] text-muted' />}>Daily offers</SectionTitle>
      <div className='grid grid-cols-4 gap-2'>
        {!store ? [0, 1, 2, 3].map(i => <Skeleton key={i} className='h-24' />) : store.daily.length ? store.daily.slice(0, 4).map(o => {
          const item = cat?.items.get(o.itemId)
          return (
            <div key={o.id} className='group rounded-lg border border-line bg-surface-2/50 overflow-hidden'>
              <ItemArt item={item} className='h-16' />
              <div className='px-1.5 pb-1.5'>
                <div className='truncate text-[10px] font-semibold text-text'>{item?.name || '...'}</div>
                <Price amount={o.price} cat={cat} size={10} className='text-[10px]' />
              </div>
            </div>
          )
        }) : <div className='col-span-4 text-xs text-muted py-4 text-center'>No daily offers</div>}
      </div>
    </Card>
  )
}

export function PassCard({ pass, cat, loading }) {
  const flat = pass?.chapters.flatMap(c => c.levels) || []
  const next = flat[pass?.progressionLevel]
  const nextReward = rewardItem(cat, next?.reward)
  return (
    <Card hover onClick={go('progression')} className='p-4 anim-rise'>
      <SectionTitle right={<FiTrendingUp className='text-muted' />}>Battle pass</SectionTitle>
      {loading ? <Skeleton className='h-16' /> : !pass ? <div className='text-xs text-muted py-3'>No active battle pass</div> : (
        <>
          <div className='flex items-baseline justify-between'>
            <span className='truncate text-[13px] font-semibold text-text'>{pass.name}</span>
            <span className='font-display text-2xl font-bold text-accent'>{pass.progressionLevel}<span className='text-xs text-muted'>/{flat.length}</span></span>
          </div>
          <div className='mt-2 h-1.5 rounded-full bg-surface-2 overflow-hidden'>
            <div className='h-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-1000' style={{ width: Math.min(100, next?.xp ? pass.towardsNext / next.xp * 100 : 100) + '%' }} />
          </div>
          <div className='mt-2 flex items-center gap-2 text-[11px] text-muted'>
            {nextReward?.icon && <img src={nextReward.icon} alt='' className='w-8 h-8 object-contain' />}
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
    <Card hover onClick={go('friends')} className='p-4 anim-rise h-full'>
      <SectionTitle right={friends.data && <Badge tone='good'>{online.length} online</Badge>}>Friends</SectionTitle>
      {friends.loading && !friends.data ? <div className='space-y-2'>{[0, 1, 2, 3].map(i => <Skeleton key={i} className='h-9' />)}</div>
        : friends.error || !online.length ? <Empty icon={FiUsers} title={friends.error ? 'Friends unavailable' : 'Nobody online'} hint={friends.error ? 'Open the Friends page to retry.' : 'Online friends will appear here.'} className='py-6' />
          : (
            <div className='space-y-1 stagger'>
              {online.slice(0, 7).map((f, i) => {
                const s = f.status || {}
                const rankIcon = typeof s.rank === 'number' ? tiers?.[s.rank]?.smallIcon : null
                return (
                  <div key={f.puuid} style={{ '--i': i }} className='anim-rise flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-surface-2 transition-colors'>
                    <span className='w-2 h-2 rounded-full bg-good anim-pulse shrink-0' />
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
    <Card className='p-4 anim-rise'>
      <SectionTitle right={<FiClock className='text-muted' />}>Local time</SectionTitle>
      <div className='font-display text-4xl font-bold text-text tabular-nums leading-none'>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<span className='text-base text-muted'>{String(now.getSeconds()).padStart(2, '0')}</span></div>
      <div className='mt-1 text-xs text-muted'>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
      {left != null && <div className='mt-3 text-[11px] text-muted flex items-center gap-1'><FiShoppingBag /> Store refreshes in <span className='text-text tabular-nums'>{fmtDuration(left)}</span></div>}
    </Card>
  )
}
