import { useEffect, useState } from 'react'
import { FiUsers, FiShoppingBag, FiClock, FiArrowUpRight, FiActivity } from 'react-icons/fi'
import { Card, Heading, Badge, Skeleton, Empty, cx, useNow } from '../../ui'
import { contentPath, useContent, useTiers } from '../../lib/content'
import { navigate } from '../../nav'
import { CUR, rewardItem, fmt, fmtDuration, useCountdown } from './catalog'
import { Price, Countdown, ItemArt } from './bits'
import RrChart from './RrChart'

const go = id => () => navigate(id)
const tierColor = t => (t?.color ? '#' + t.color.slice(0, 6) : null)
const signed = n => (n > 0 ? '+' : '') + n

// Small "open" affordance in a tile corner (the tile needs the `group` class).
const Arrow = () => (
  <span className='w-8 h-8 rounded-full glass-inset flex items-center justify-center text-muted transition-[transform,color] duration-300 ease-out group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5'>
    <FiArrowUpRight />
  </span>
)

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// Derived numbers from the ranked history rows (oldest first).
export function formOf(rows) {
  const list = rows || []
  const wins = list.filter(r => r.change > 0).length
  const net = list.reduce((a, r) => a + (r.change || 0), 0)
  let streak = 0
  for (let i = list.length - 1; i >= 0; i--) {
    const w = list[i].change > 0
    if (!streak) streak = w ? 1 : -1
    else if (w === streak > 0) streak += w ? 1 : -1
    else break
  }
  return { games: list.length, wins, net, streak, rate: list.length ? Math.round(wins / list.length * 100) : null }
}

// Hero: name over the player card art, quick stats in a recessed strip.
// Long names (or wide CJK names) step down so the hero never crowds the card art.
function nameSize(name = '') {
  const w = [...name].reduce((n, ch) => n + (/[⺀-￯]/.test(ch) ? 1.8 : 1), 0)
  return w <= 10 ? 64 : w <= 14 ? 52 : w <= 20 ? 42 : 34
}

export function Hero({ riot, identity, account, rr }) {
  const card = useContent(contentPath('playercards', identity?.cardId))
  const f = formOf(rr)
  const stats = [
    ['Account level', account ? account.level : null, account ? `${fmt(account.xp)} XP` : ''],
    ['Win rate', f.rate != null ? f.rate + '%' : '-', f.games ? `last ${f.games} ranked` : 'no ranked games'],
    ['Net RR', f.games ? signed(f.net) : '-', f.games ? `${f.wins}W ${f.games - f.wins}L` : '', f.net > 0 ? 'text-good' : f.net < 0 ? 'text-bad' : ''],
    ['Streak', f.streak ? `${Math.abs(f.streak)}${f.streak > 0 ? 'W' : 'L'}` : '-', f.streak > 0 ? 'Keep it going' : f.streak < 0 ? 'Reset and requeue' : '', f.streak > 0 ? 'text-good' : f.streak < 0 ? 'text-bad' : ''],
  ]
  return (
    <Card className='relative overflow-hidden h-full min-h-[280px] !rounded-3xl flex flex-col'>
      {card?.wideArt && (
        <img src={card.wideArt} alt='' draggable={false} className='hero-art absolute right-0 top-0 h-full w-[72%] object-cover opacity-60 pointer-events-none'
          style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 60%)', maskImage: 'linear-gradient(90deg, transparent, #000 60%)' }} />
      )}
      <div className='absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/10 to-transparent pointer-events-none' />
      <span className='halo -top-28 -left-20 w-80 h-80' />
      <LiveClock className='hero-strip absolute top-6 right-6' />
      <div className='relative px-6 pt-6 flex-1'>
        <div className='eyebrow flex items-center gap-2'>{greeting()}<span className='w-1 h-1 rounded-full bg-muted/60' />{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h2 className='display mt-3 text-text truncate pb-1' style={{ fontSize: nameSize(riot.gameName) }} title={riot.gameName}>
          {riot.gameName || 'Agent'}<span className='text-muted/70 text-[22px] font-semibold tracking-tight ml-2'>{riot.tagLine ? `#${riot.tagLine}` : ''}</span>
        </h2>
        <div className='mt-3 flex flex-wrap items-center gap-2'>
          {account && <Badge tone='accent'>Level {account.level}</Badge>}
          {riot.region && <Badge>{riot.region}</Badge>}
        </div>
      </div>
      <div className='hero-strip relative m-3 mt-6 rounded-2xl glass-inset grid grid-cols-4 divide-x divide-line'>
        {stats.map(([label, v, sub, tone]) => (
          <div key={label} className='px-5 py-3.5 min-w-0'>
            <div className='eyebrow !text-[10px] truncate'>{label}</div>
            {v == null ? <Skeleton className='h-7 w-14 mt-2' /> : <div className={cx('font-display text-[22px] font-750 tracking-tight leading-none tabular-nums mt-2', tone || 'text-text')}>{v}</div>}
            <div className='text-[11px] text-muted mt-1.5 truncate'>{sub}</div>
          </div>
        ))}
      </div>
    </Card>
  )
}

// Local time pill (ticks every second).
function LiveClock({ className }) {
  const now = new Date(useNow())
  return (
    <div className={cx('glass-inset rounded-full pl-3 pr-3.5 h-8 inline-flex items-center gap-2 text-[12px] text-muted', className)} title='Local time'>
      <FiClock /><span className='font-display font-bold text-text tabular-nums'>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span className='tabular-nums text-muted/80'>{String(now.getSeconds()).padStart(2, '0')}</span>
    </div>
  )
}

// Current rank with a tier-tinted glow, RR bar and peak.
export function RankTile({ rank }) {
  const tiers = useTiers()
  const t = rank && tiers?.[rank.tier]
  const peak = rank && tiers?.[rank.peak]
  const color = tierColor(t)
  return (
    <Card hover onClick={go('progression')} className='group relative overflow-hidden h-full !rounded-3xl p-5 flex flex-col'>
      <span className='halo w-80 h-80 -right-20 -top-20' style={color ? { background: `radial-gradient(closest-side, ${color}45, transparent)` } : undefined} />
      <div className='relative flex items-center justify-between'>
        <span className='eyebrow'>Current rank</span>
        <Arrow />
      </div>
      {!rank ? <Skeleton className='mt-6 h-36 rounded-2xl' /> : (
        <div className='relative flex-1 flex flex-col justify-end'>
          <div className='flex items-center gap-4 mt-3'>
            {t ? <img src={t.largeIcon} alt='' className='w-[96px] h-[96px] object-contain drop-shadow-[0_10px_24px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-3' />
              : <Skeleton className='w-[96px] h-[96px] rounded-2xl' />}
            <div className='min-w-0'>
              <div className='tier-text display text-[26px] truncate' style={color ? { '--tier': color } : undefined}>{rank.tier ? t?.tierName : 'Unranked'}</div>
              {rank.tier > 0 && <div className='mt-2 text-[13px] font-semibold text-text tabular-nums'>{rank.rr} RR <span className={cx('font-medium', rank.lastChange >= 0 ? 'text-good' : 'text-bad')}>{signed(rank.lastChange)} last game</span></div>}
            </div>
          </div>
          {rank.tier > 0 && rank.tier < 27 && (
            <div className='mt-5'>
              <div className='flex justify-between text-[11px] text-muted mb-1.5 tabular-nums'><span>Next rank</span><span>{100 - rank.rr} RR to go</span></div>
              <div className='h-2 rounded-full glass-inset overflow-hidden'>
                <div className='h-full w-full rounded-full bg-gradient-to-r from-accent-2 to-accent origin-left transition-transform duration-1000 ease-out' style={{ transform: `scaleX(${rank.rr / 100})` }} />
              </div>
            </div>
          )}
          {peak && <div className='mt-4 flex items-center gap-2 text-[12px] text-muted'><img src={peak.smallIcon} alt='' className='w-5 h-5' />Peak <span className='font-semibold text-text'>{peak.tierName}</span></div>}
        </div>
      )}
    </Card>
  )
}

// Width of an element, tracked with a ResizeObserver (0 until measured).
// Uses a callback ref because the measured box only mounts once the data arrives.
function useWidth() {
  const [el, setEl] = useState(null)
  const [w, setW] = useState(0)
  useEffect(() => {
    if (!el) return
    if (typeof ResizeObserver === 'undefined') { setW(el.clientWidth); return }
    const ro = new ResizeObserver(([e]) => setW(Math.round(e.contentRect.width)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [el])
  return [setEl, w]
}

// Ranked trend chart tile. The chart's viewBox follows the tile width so it keeps a steady height on wide windows
// instead of scaling up into a giant sparse chart.
export function TrendTile({ rr }) {
  const f = formOf(rr.data)
  const [box, boxW] = useWidth()
  return (
    <Card hover onClick={go('progression')} className='group h-full p-5 flex flex-col'>
      <Heading hint={rr.data?.length ? `Last ${rr.data.length} competitive games` : 'Competitive games'}
        right={<div className='flex items-center gap-3'>{f.games > 0 && <span className={cx('font-display text-[20px] font-750 tracking-tight tabular-nums', f.net >= 0 ? 'text-good' : 'text-bad')}>{signed(f.net)} RR</span>}<Arrow /></div>}>
        Ranked trend
      </Heading>
      <div className='flex-1 flex items-end'>
        {rr.error && !rr.data ? <p className='text-[13px] text-muted py-6 w-full text-center'>Ranked history unavailable</p>
          : !rr.data ? <Skeleton className='h-44 w-full rounded-2xl' />
            : rr.data.length < 2 ? <Empty icon={FiActivity} title='Not enough ranked games' hint='Play a couple of competitive matches to see your trend.' className='py-6 w-full' />
              : <div ref={box} className='w-full'>{boxW > 0 && <RrChart rows={rr.data} height={230} width={Math.max(480, boxW)} />}</div>}
      </div>
    </Card>
  )
}

// Last ranked games as signed RR bars around a baseline, plus the latest three.
export function FormTile({ rr }) {
  const maps = useContent('maps')
  const rows = (rr.data || []).slice(-10)
  const f = formOf(rows)
  const max = Math.max(10, ...rows.map(r => Math.abs(r.change)))
  const mapName = id => maps?.find(m => m.mapUrl === id)?.displayName || 'Competitive'
  return (
    <Card hover onClick={go('history')} className='group h-full p-5 flex flex-col'>
      <Heading hint={f.games ? `${f.wins} wins in the last ${f.games}` : 'Ranked results'} right={<Arrow />}>Recent form</Heading>
      {!rr.data ? <Skeleton className='flex-1 min-h-[160px] rounded-2xl' /> : !rows.length ? <Empty icon={FiActivity} title='No ranked games yet' className='py-6' /> : (
        <div className='flex-1 flex flex-col mt-1'>
          <div className='relative flex-1 min-h-[96px] rounded-2xl glass-inset px-3 flex items-center gap-1.5'>
            <span className='absolute left-3 right-3 top-1/2 h-px bg-line' />
            {rows.map((r, i) => (
              <div key={r.id || i} className='relative flex-1 h-full' title={`${signed(r.change)} RR`}>
                <span className={cx('absolute inset-x-0 mx-auto w-full max-w-[14px] rounded-full', r.change >= 0 ? 'bottom-1/2 bg-gradient-to-t from-good/40 to-good' : 'top-1/2 bg-gradient-to-b from-bad/40 to-bad')}
                  style={{ height: Math.max(6, Math.abs(r.change) / max * 44) + '%' }} />
              </div>
            ))}
          </div>
          <div className='mt-3'>
            {rows.slice(-3).reverse().map((r, i) => (
              <div key={r.id || i} className='flex items-center gap-3 px-1 py-1.5 text-[12.5px]'>
                <span className={cx('w-1.5 h-1.5 rounded-full', r.change >= 0 ? 'bg-good' : 'bg-bad')} />
                <span className='text-text font-medium truncate flex-1'>{mapName(r.mapId)}</span>
                <span className={cx('font-display font-bold tabular-nums', r.change >= 0 ? 'text-good' : 'text-bad')}>{signed(r.change)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Card>
  )
}

export function WalletCard({ wallet, cat }) {
  const rows = [['Valorant Points', CUR.vp, wallet?.vp], ['Radianite', CUR.rad, wallet?.rad], ['Kingdom Credits', CUR.kc, wallet?.kc]]
  return (
    <Card className='h-full p-5 flex flex-col'>
      <Heading>Wallet</Heading>
      <div className='flex-1 flex flex-col gap-2'>
        {rows.map(([label, id, v], i) => (
          <div key={id} className={cx('flex-1 flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5 min-w-0', i === 0 ? 'accent-soft' : 'glass-inset')}>
            <span className='text-[12px] text-muted truncate'>{label}</span>
            {wallet ? <Price amount={v} currencyId={id} cat={cat} size={15} className='text-[17px] text-text' /> : <Skeleton className='h-5 w-16' />}
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
    <Card hover onClick={go('shop')} className='group relative overflow-hidden h-full min-h-[210px]'>
      {art && <img src={art} alt='' className='absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-700 ease-out group-hover:scale-105' />}
      <div className='absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-transparent' />
      <div className='absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg/70 to-transparent' />
      <div className='relative p-5 h-full flex flex-col justify-between'>
        <div className='flex items-center justify-between'>
          <span className='eyebrow'>Featured bundle</span>
          <div className='flex items-center gap-2'>{bundles?.length > 1 && <Badge>+{bundles.length - 1} more</Badge>}<Arrow /></div>
        </div>
        {!bundles ? <Skeleton className='h-10' /> : !b ? <span className='text-sm text-muted'>No bundles right now</span> : (
          <div className='flex items-end justify-between gap-3'>
            <div className='min-w-0'>
              <div className='display truncate text-[26px] text-text pb-0.5'>{meta?.displayName || 'Bundle'}</div>
              <Countdown seconds={b.secondsLeft} className='mt-1.5 text-xs text-muted' />
            </div>
            <div className='text-right shrink-0 space-y-1.5'>
              {b.discountPercent > 0 && <Badge tone='good'>-{Math.round(b.discountPercent * 100)}%</Badge>}
              <div><Price amount={b.totalDiscounted ?? b.totalBase} cat={cat} size={16} className='text-[22px] text-text' /></div>
            </div>
          </div>
        )}
      </div>
    </Card>
  )
}

export function DailyCard({ store, cat }) {
  return (
    <Card hover onClick={go('shop')} className='group h-full p-5 flex flex-col'>
      <Heading hint='Your rotating store' right={<div className='flex items-center gap-3'>{store && <Countdown seconds={store.dailySecondsLeft} className='text-[12px] text-muted' />}<Arrow /></div>}>Daily offers</Heading>
      <div className='flex-1 grid grid-cols-4 gap-3'>
        {!store ? [0, 1, 2, 3].map(i => <Skeleton key={i} className='h-32 rounded-2xl' />) : store.daily.length ? store.daily.slice(0, 4).map(o => {
          const item = cat?.items.get(o.itemId)
          return (
            <div key={o.id} className='min-w-0 flex flex-col rounded-2xl glass-inset overflow-hidden transition-[border-color,transform] duration-300 ease-out hover:border-accent/40 hover:-translate-y-0.5'>
              <ItemArt item={item} className='flex-1 min-h-[84px] xl:min-h-[100px]' />
              <div className='px-3 pb-3'>
                <div className='truncate text-[12px] font-semibold text-text'>{item?.name || '...'}</div>
                <div className='mt-1 flex items-center justify-between gap-2'>
                  <Price amount={o.price} cat={cat} size={11} className='text-[11.5px] text-muted' />
                  {item?.tier?.displayIcon && <img src={item.tier.displayIcon} alt='' title={item.tier.devName || ''} className='w-4 h-4 object-contain shrink-0' />}
                </div>
              </div>
            </div>
          )
        }) : <div className='col-span-4 text-[13px] text-muted py-5 text-center'>No daily offers</div>}
      </div>
    </Card>
  )
}

export function PassCard({ pass, cat, loading }) {
  const flat = pass?.chapters.flatMap(c => c.levels) || []
  const next = flat[pass?.progressionLevel]
  const nextReward = rewardItem(cat, next?.reward)
  const pct = Math.min(100, next?.xp ? pass.towardsNext / next.xp * 100 : 100)
  const after = flat.slice((pass?.progressionLevel ?? 0) + 1, (pass?.progressionLevel ?? 0) + 6).map(l => rewardItem(cat, l.reward)).filter(r => r?.icon)
  return (
    <Card hover onClick={go('progression')} className='group h-full p-5 flex flex-col'>
      <Heading right={<Arrow />}>Battle pass</Heading>
      {loading ? <Skeleton className='h-24 rounded-2xl' /> : !pass ? <div className='text-[13px] text-muted py-3'>No active battle pass</div> : (
        <div className='flex-1 flex flex-col justify-end'>
          <div className='flex items-end justify-between gap-3'>
            <span className='display text-[42px] text-text tabular-nums'>{pass.progressionLevel}<span className='text-[16px] font-semibold tracking-normal text-muted'> / {flat.length}</span></span>
            {nextReward?.icon && <span className='w-12 h-12 p-2 rounded-xl glass-inset shrink-0 grid place-items-center'><img src={nextReward.icon} alt='' className={'max-w-full max-h-full object-contain' + (nextReward.kind === 'currency' ? ' mono-icon' : '')} /></span>}
          </div>
          <div className='mt-1 truncate text-[12px] text-muted'>{pass.name}</div>
          <div className='mt-3 h-2 rounded-full glass-inset overflow-hidden'>
            <div className='h-full w-full rounded-full bg-gradient-to-r from-accent-2 to-accent origin-left transition-transform duration-1000 ease-out' style={{ transform: `scaleX(${pct / 100})` }} />
          </div>
          <div className='mt-2.5 truncate text-[11.5px] text-muted'>{next ? `Next: ${nextReward?.name || 'reward'} (${fmt(pass.towardsNext)} / ${fmt(next.xp)} XP)` : 'Pass complete'}</div>
          {after.length > 0 && (
            <div className='mt-3 flex items-center gap-2 min-w-0 overflow-hidden'>
              <span className='eyebrow !text-[10px] shrink-0'>Then</span>
              {after.map((r, i) => (
                <span key={i} title={r.name} className='w-9 h-9 p-1.5 rounded-lg glass-inset shrink-0 grid place-items-center'>
                  <img src={r.icon} alt='' className={'max-w-full max-h-full object-contain' + (r.kind === 'currency' ? ' mono-icon' : '')} />
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}

export function FriendsCard({ friends }) {
  const tiers = useTiers()
  const online = (friends.data || []).filter(f => f.online)
  return (
    <Card hover onClick={go('friends')} className='group h-full p-5'>
      <Heading right={<div className='flex items-center gap-2'>{friends.data && <Badge tone='good'>{online.length} online</Badge>}<Arrow /></div>}>Friends</Heading>
      {friends.loading && !friends.data ? <div className='space-y-2'>{[0, 1, 2, 3].map(i => <Skeleton key={i} className='h-10 rounded-xl' />)}</div>
        : friends.error || !online.length ? <Empty icon={FiUsers} title={friends.error ? 'Friends unavailable' : 'Nobody online'} hint={friends.error ? 'Open the Friends page to retry.' : 'Online friends will appear here.'} className='py-5' />
          : (
            <div className='stagger'>
              {online.slice(0, 5).map((f, i) => {
                const s = f.status || {}
                const rankIcon = typeof s.rank === 'number' ? tiers?.[s.rank]?.smallIcon : null
                return (
                  <div key={f.puuid} style={{ '--i': i }} className='flex items-center gap-3 rounded-xl px-2.5 py-2 -mx-1 hover:bg-surface-2 transition-colors'>
                    <span className='w-2 h-2 rounded-full bg-good anim-pulse shadow-[0_0_8px_rgb(var(--good)/0.6)] shrink-0' />
                    <span className='truncate text-[13px] font-medium text-text flex-1'>{f.gameName}<span className='text-muted font-normal'> #{f.tagLine}</span></span>
                    <span className='text-[11px] text-muted capitalize truncate max-w-[110px]'>{[s.state, s.map].filter(Boolean).join(' - ')}</span>
                    {rankIcon && <img src={rankIcon} alt='' className='w-5 h-5' />}
                  </div>
                )
              })}
              {online.length > 5 && <div className='px-1.5 pt-1.5 text-[11.5px] text-muted'>+{online.length - 5} more online</div>}
            </div>
          )}
    </Card>
  )
}

export function ClockCard({ store }) {
  const now = new Date(useNow())
  const left = useCountdown(store?.dailySecondsLeft)
  return (
    <Card className='h-full p-5 flex flex-col'>
      <div className='flex items-center justify-between'>
        <span className='eyebrow'>Local time</span>
        <FiClock className='text-muted' />
      </div>
      <div className='flex-1 flex flex-col justify-end'>
        <div className='mt-3 display text-[42px] text-text tabular-nums'>{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<span className='ml-1.5 text-[16px] font-semibold tracking-normal text-muted'>{String(now.getSeconds()).padStart(2, '0')}</span></div>
        <div className='mt-2 text-[12.5px] text-muted'>{now.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {left != null && <div className='mt-4 self-start inline-flex items-center gap-1.5 rounded-full glass-inset px-3 py-1.5 text-[11px] text-muted'><FiShoppingBag /> Store refreshes in <span className='font-semibold text-text tabular-nums'>{fmtDuration(left)}</span></div>}
      </div>
    </Card>
  )
}
