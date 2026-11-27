import { For } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiUsers, FiShoppingBag, FiClock, FiArrowUpRight, FiActivity } from 'solid-icons/fi'
import { Card, Heading, Badge, Skeleton, Empty, cx, useNow } from '../../ui'
import { contentPath, useContent, useTiers } from '../../lib/content'
import { navigate } from '../../nav'
import { CUR, rewardItem, fmt, fmtDuration, useCountdown } from './catalog'
import { Price, Countdown, ItemArt } from './bits'
import RrChart from './RrChart'

const go = id => () => navigate(id)
const tierColor = t => (t?.color ? '#' + t.color.slice(0, 6) : null)
const signed = n => (n > 0 ? '+' : '') + n

// small "open" affordance in a tile corner
const Arrow = () => (
  <span class='w-8 h-8 rounded-full glass-inset flex items-center justify-center text-muted transition-[transform,color] duration-300 ease-out group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5'>
    <FiArrowUpRight />
  </span>
)

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}

// derived numbers from the ranked history rows
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

// the latest run of ranked games: newest within 12 hours, with no gap over 3 hours between games
export function sessionOf(rows) {
  const list = (rows || []).filter(r => r.time)
  const out = []
  for (let i = list.length - 1; i >= 0; i--) {
    const next = out[0]
    if (!next ? Date.now() - list[i].time > 12 * 3600e3 : next.time - list[i].time > 3 * 3600e3) break
    out.unshift(list[i])
  }
  return out
}

// ranked results of the current session: net RR, wins and losses, and the streak
export function SessionTile(props) {
  
    const rows = () => (sessionOf(props.rr.data))
    const f = () => (formOf(rows()))
    const losses = () => (rows().filter(r => r.change < 0).length)
    const streak = () => (Math.abs(f().streak) >= 2 ? `${Math.abs(f().streak)} ${f().streak > 0 ? 'wins' : 'losses'} in a row` : null)
    return (<Card hover onClick={go('history')} class='group h-full p-6 flex flex-col'>
      <Heading hint='Ranked games in one sitting' right={<Arrow />}>This session</Heading>
      {!props.rr.data ? <Skeleton class='flex-1 min-h-[120px] rounded-2xl' /> : !rows().length ? <Empty icon={FiActivity} title='No ranked games yet' hint='Play a competitive match and it shows up here.' class='py-6' /> : (
        <div class='flex-1 flex flex-col justify-end'>
          <div class={cx('font-display text-[44px] leading-none font-750 tracking-tight tabular-nums', f().net >= 0 ? 'text-good' : 'text-bad')}>{signed(f().net)}<span class='ml-1.5 text-[15px] font-semibold text-muted'>RR</span></div>
          <div class='mt-4 grid grid-cols-2 gap-2'>
            <div class='glass-inset rounded-xl px-3.5 py-2.5'><div class='text-[11px] text-muted'>Wins</div><div class='text-[17px] font-semibold text-good tabular-nums'>{f().wins}</div></div>
            <div class='glass-inset rounded-xl px-3.5 py-2.5'><div class='text-[11px] text-muted'>Losses</div><div class='text-[17px] font-semibold text-bad tabular-nums'>{losses()}</div></div>
          </div>
          <div class='mt-3 text-[12px] text-muted'>{streak() || `${f().games} ${f().games === 1 ? 'game' : 'games'} played`}</div>
        </div>
      )}
    </Card>)
  
}

// hero: name over the player card art, quick stats in a recessed strip
function nameSize(name = '') {
  const w = [...name].reduce((n, ch) => n + (/[⺀-￯]/.test(ch) ? 1.8 : 1), 0)
  return w <= 10 ? 64 : w <= 14 ? 52 : w <= 20 ? 42 : 34
}

export function Hero(props) {
  const cardA = useContent(() => contentPath('playercards', props.identity?.cardId))
  
    const f = () => (formOf(props.rr))
    const stats = () => ([
    ['Account level', props.account ? props.account.level : null, props.account ? `${fmt(props.account.xp)} XP` : ''],
    ['Win rate', f().rate != null ? f().rate + '%' : '-', f().games ? `last ${f().games} ranked` : 'no ranked games'],
    ['Net RR', f().games ? signed(f().net) : '-', f().games ? `${f().wins}W ${f().games - f().wins}L` : '', f().net > 0 ? 'text-good' : f().net < 0 ? 'text-bad' : ''],
    ['Streak', f().streak ? `${Math.abs(f().streak)}${f().streak > 0 ? 'W' : 'L'}` : '-', f().streak > 0 ? 'Keep it going' : f().streak < 0 ? 'Reset and requeue' : '', f().streak > 0 ? 'text-good' : f().streak < 0 ? 'text-bad' : ''],
  ])
    return (<Card class='relative overflow-hidden h-full min-h-[280px] !rounded-3xl flex flex-col'>
      {cardA()?.wideArt && (
        <img decoding='async' src={cardA().wideArt} alt='' draggable={false} class='hero-art absolute right-0 top-0 h-full w-[72%] object-cover opacity-60 pointer-events-none'
          style={st({ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 60%)', maskImage: 'linear-gradient(90deg, transparent, #000 60%)' })} />
      )}
      <div class='absolute inset-0 bg-gradient-to-t from-bg/80 via-bg/10 to-transparent pointer-events-none' />
      <span class='halo -top-28 -left-20 w-80 h-80' />
      <LiveClock class='hero-strip absolute top-6 right-6' />
      <div class='relative px-8 pt-7 flex-1'>
        <div class='eyebrow flex items-center gap-2'>{greeting()}<span class='w-1 h-1 rounded-full bg-muted/60' />{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        <h2 class='display mt-3 text-text truncate pb-1' style={st({ fontSize: nameSize(props.riot.gameName) })} title={props.riot.gameName}>
          {props.riot.gameName || 'Agent'}<span class='text-muted/70 text-[26px] font-semibold tracking-tight ml-2'>{props.riot.tagLine ? `#${props.riot.tagLine}` : ''}</span>
        </h2>
        <div class='mt-3 flex flex-wrap items-center gap-2'>
          {props.account && <Badge tone='accent'>Level {props.account.level}</Badge>}
          {props.riot.region && <Badge>{props.riot.region}</Badge>}
        </div>
      </div>
      <div class='hero-strip relative m-3 mt-6 rounded-2xl glass-inset grid grid-cols-4 divide-x divide-line'>
        <For each={stats()}>{([label, v, sub, tone]) => (
          <div class='px-5 py-3.5 min-w-0'>
            <div class='eyebrow !text-[10px] truncate'>{label}</div>
            {v == null ? <Skeleton class='h-7 w-14 mt-2' /> : <div class={cx('font-display text-[26px] font-750 tracking-tight leading-none tabular-nums mt-2', tone || 'text-text')}>{v}</div>}
            <div class='text-[11px] text-muted mt-1.5 truncate'>{sub}</div>
          </div>
        )}</For>
      </div>
    </Card>)
  
}

// local time pill (ticks every second)
function LiveClock(props) {
  const nowA = useNow()
  
    const now = () => (new Date(nowA()))
    return (<div class={cx('glass-inset rounded-full pl-3 pr-3.5 h-8 inline-flex items-center gap-2 text-[12px] text-muted', props["class"])} title='Local time'>
      <FiClock /><span class='font-display font-bold text-text tabular-nums'>{now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
      <span class='tabular-nums text-muted/80'>{String(now().getSeconds()).padStart(2, '0')}</span>
    </div>)
  
}

// current rank with a tier-tinted glow, RR bar and peak
export function RankTile(props) {
  const tiersA = useTiers()
  
    const t = () => (props.rank && tiersA()?.[props.rank.tier])
    const peak = () => (props.rank && tiersA()?.[props.rank.peak])
    const color = () => (tierColor(t()))
    return (<Card hover onClick={go('progression')} class='group relative overflow-hidden h-full !rounded-3xl p-6 flex flex-col'>
      <span class='halo w-80 h-80 -right-20 -top-20' style={st(color() ? { background: `radial-gradient(closest-side, ${color()}45, transparent)` } : undefined)} />
      <div class='relative flex items-center justify-between'>
        <span class='eyebrow'>Current rank</span>
        <Arrow />
      </div>
      {!props.rank ? <Skeleton class='mt-6 h-36 rounded-2xl' /> : (
        <div class='relative flex-1 flex flex-col justify-end'>
          <div class='flex items-center gap-4 mt-3'>
            {t() ? <img decoding='async' src={t().largeIcon} alt='' class='w-[96px] h-[96px] object-contain drop-shadow-[0_10px_24px_rgb(0_0_0/0.35)] transition-transform duration-500 ease-out group-hover:scale-105 group-hover:-rotate-3' />
              : <Skeleton class='w-[96px] h-[96px] rounded-2xl' />}
            <div class='min-w-0'>
              <div class='tier-text display text-[30px] truncate' style={st(color() ? { '--tier': color() } : undefined)}>{props.rank.tier ? t()?.tierName : 'Unranked'}</div>
              {props.rank.tier > 0 && <div class='mt-2 text-[13px] font-semibold text-text tabular-nums'>{props.rank.rr} RR <span class={cx('font-medium', props.rank.lastChange >= 0 ? 'text-good' : 'text-bad')}>{signed(props.rank.lastChange)} last game</span></div>}
            </div>
          </div>
          {props.rank.tier > 0 && props.rank.tier < 27 && (
            <div class='mt-5'>
              <div class='flex justify-between text-[11px] text-muted mb-1.5 tabular-nums'><span>Next rank</span><span>{100 - props.rank.rr} RR to go</span></div>
              <div class='h-2 rounded-full glass-inset overflow-hidden'>
                <div class='h-full w-full rounded-full bg-gradient-to-r from-accent-2 to-accent origin-left transition-transform duration-1000 ease-out' style={st({ transform: `scaleX(${props.rank.rr / 100})` })} />
              </div>
            </div>
          )}
          {peak() && <div class='mt-4 flex items-center gap-2 text-[12px] text-muted'><img decoding='async' src={peak().smallIcon} alt='' class='w-5 h-5' />Peak <span class='font-semibold text-text'>{peak().tierName}</span></div>}
        </div>
      )}
    </Card>)
  
}

// ranked trend chart tile
export function TrendTile(props) {
  
    const f = () => (formOf(props.rr.data))
    return (<Card hover onClick={go('progression')} class='group h-full p-6 flex flex-col'>
      <Heading hint={props.rr.data?.length ? `Last ${props.rr.data.length} competitive games` : 'Competitive games'}
        right={<div class='flex items-center gap-3'>{f().games > 0 && <span class={cx('font-display text-[20px] font-750 tracking-tight tabular-nums', f().net >= 0 ? 'text-good' : 'text-bad')}>{signed(f().net)} RR</span>}<Arrow /></div>}>
        Ranked trend
      </Heading>
      <div class='flex-1 flex items-end'>
        {props.rr.error && !props.rr.data ? <p class='text-[13px] text-muted py-8 w-full text-center'>Ranked history unavailable</p>
          : !props.rr.data ? <Skeleton class='h-44 w-full rounded-2xl' />
            : props.rr.data.length < 2 ? <Empty icon={FiActivity} title='Not enough ranked games' hint='Play a couple of competitive matches to see your trend.' class='py-8 w-full' />
              : <div class='w-full'><RrChart rows={props.rr.data} height={210} /></div>}
      </div>
    </Card>)
  
}

// last ranked games as signed RR bars around a baseline, plus the latest three
export function FormTile(props) {
  const mapsA = useContent('maps')
  
    const rows = () => ((props.rr.data || []).slice(-10))
    const f = () => (formOf(rows()))
    const max = () => (Math.max(10, ...rows().map(r => Math.abs(r.change))))
    const mapName = id => mapsA()?.find(m => m.mapUrl === id)?.displayName || 'Competitive'
    return (<Card hover onClick={go('history')} class='group h-full p-6 flex flex-col'>
      <Heading hint={f().games ? `${f().wins} wins in the last ${f().games}` : 'Ranked results'} right={<Arrow />}>Recent form</Heading>
      {!props.rr.data ? <Skeleton class='flex-1 min-h-[160px] rounded-2xl' /> : !rows().length ? <Empty icon={FiActivity} title='No ranked games yet' class='py-8' /> : (
        <div class='flex-1 flex flex-col mt-1'>
          <div class='relative flex-1 min-h-[96px] rounded-2xl glass-inset px-3 flex items-center gap-1.5'>
            <span class='absolute left-3 right-3 top-1/2 h-px bg-line' />
            <For each={rows()}>{(r, i) => (
              <div class='relative flex-1 h-full' title={`${signed(r.change)} RR`}>
                <span class={cx('absolute inset-x-0 mx-auto w-full max-w-[14px] rounded-full', r.change >= 0 ? 'bottom-1/2 bg-gradient-to-t from-good/40 to-good' : 'top-1/2 bg-gradient-to-b from-bad/40 to-bad')}
                  style={st({ height: Math.max(6, Math.abs(r.change) / max() * 44) + '%' })} />
              </div>
            )}</For>
          </div>
          <div class='mt-3'>
            <For each={rows().slice(-3).reverse()}>{(r, i) => (
              <div class='flex items-center gap-3 px-1 py-1.5 text-[12.5px]'>
                <span class={cx('w-1.5 h-1.5 rounded-full', r.change >= 0 ? 'bg-good' : 'bg-bad')} />
                <span class='text-text font-medium truncate flex-1'>{mapName(r.mapId)}</span>
                <span class={cx('font-display font-bold tabular-nums', r.change >= 0 ? 'text-good' : 'text-bad')}>{signed(r.change)}</span>
              </div>
            )}</For>
          </div>
        </div>
      )}
    </Card>)
  
}

export function WalletCard(props) {
  
    const rows = () => ([['Valorant Points', CUR.vp, props.wallet?.vp], ['Radianite', CUR.rad, props.wallet?.rad], ['Kingdom Credits', CUR.kc, props.wallet?.kc]])
    return (<Card class='h-full p-6'>
      <Heading>Wallet</Heading>
      <div class='space-y-2'>
        <For each={rows()}>{([label, id, v], i) => (
          <div class={cx('flex items-center justify-between gap-2 rounded-xl px-3.5 py-2.5', i() === 0 ? 'accent-soft' : 'glass-inset')}>
            <span class='text-[12px] text-muted truncate'>{label}</span>
            {props.wallet ? <Price amount={v} currencyId={id} cat={props.cat} size={15} class='text-[17px] text-text' /> : <Skeleton class='h-5 w-16' />}
          </div>
        )}</For>
      </div>
    </Card>)
  
}

export function BundleCard(props) {
  
    const b = () => (props.bundles?.[0])
    const meta = () => (b() && props.cat?.bundles[b().id])
    const art = () => (meta()?.displayIcon2 || meta()?.displayIcon)
    return (<Card hover onClick={go('shop')} class='group relative overflow-hidden h-full min-h-[210px]'>
      {art() && <img decoding='async' src={art()} alt='' class='absolute inset-0 w-full h-full object-cover opacity-80 transition-transform duration-700 ease-out group-hover:scale-105' />}
      <div class='absolute inset-0 bg-gradient-to-t from-bg via-bg/45 to-transparent' />
      <div class='absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-bg/70 to-transparent' />
      <div class='relative p-6 h-full flex flex-col justify-between'>
        <div class='flex items-center justify-between'>
          <span class='eyebrow'>Featured bundle</span>
          <div class='flex items-center gap-2'>{props.bundles?.length > 1 && <Badge>+{props.bundles.length - 1} more</Badge>}<Arrow /></div>
        </div>
        {!props.bundles ? <Skeleton class='h-10' /> : !b() ? <span class='text-sm text-muted'>No bundles right now</span> : (
          <div class='flex items-end justify-between gap-3'>
            <div class='min-w-0'>
              <div class='display truncate text-[30px] text-text pb-0.5'>{meta()?.displayName || 'Bundle'}</div>
              <Countdown seconds={b().secondsLeft} class='mt-1.5 text-xs text-muted' />
            </div>
            <div class='text-right shrink-0 space-y-1.5'>
              {b().discountPercent > 0 && <Badge tone='good'>-{Math.round(b().discountPercent * 100)}%</Badge>}
              <div><Price amount={b().totalDiscounted ?? b().totalBase} cat={props.cat} size={16} class='text-[22px] text-text' /></div>
            </div>
          </div>
        )}
      </div>
    </Card>)
  
}

export function DailyCard(props) {
  return (
    <Card hover onClick={go('shop')} class='group h-full p-6'>
      <Heading hint='Your rotating store' right={<div class='flex items-center gap-3'>{props.store && <Countdown seconds={props.store.dailySecondsLeft} class='text-[12px] text-muted' />}<Arrow /></div>}>Daily offers</Heading>
      <div class='grid grid-cols-4 gap-3'>
        {!props.store ? [0, 1, 2, 3].map(i => <Skeleton class='h-32 rounded-2xl' />) : props.store.daily.length ? <For each={props.store.daily.slice(0, 4)}>{o => {
          const item = () => props.cat?.items.get(o.itemId)
          return (
            <div class='rounded-2xl glass-inset overflow-hidden transition-[border-color,transform] duration-300 ease-out hover:border-accent/40 hover:-translate-y-0.5'>
              <ItemArt item={item()} class='h-[84px]' />
              <div class='px-3 pb-3'>
                <div class='truncate text-[12px] font-semibold text-text'>{item()?.name || '...'}</div>
                <Price amount={o.price} cat={props.cat} size={11} class='mt-1 text-[11.5px] text-muted' />
              </div>
            </div>
          )
        }}</For> : <div class='col-span-4 text-[13px] text-muted py-6 text-center'>No daily offers</div>}
      </div>
    </Card>
  )
}

export function PassCard(props) {
  
    const flat = () => (props.pass?.chapters.flatMap(c => c.levels) || [])
    const next = () => (flat()[props.pass?.progressionLevel])
    const nextReward = () => (rewardItem(props.cat, next()?.reward))
    const pct = () => (Math.min(100, next()?.xp ? props.pass.towardsNext / next().xp * 100 : 100))
    return (<Card hover onClick={go('progression')} class='group h-full p-6 flex flex-col'>
      <Heading right={<Arrow />}>Battle pass</Heading>
      {props.loading ? <Skeleton class='h-24 rounded-2xl' /> : !props.pass ? <div class='text-[13px] text-muted py-3'>No active battle pass</div> : (
        <div class='flex-1 flex flex-col justify-end'>
          <div class='flex items-end justify-between gap-3'>
            <span class='display text-[52px] text-text tabular-nums'>{props.pass.progressionLevel}<span class='text-[16px] font-semibold tracking-normal text-muted'> / {flat().length}</span></span>
            {nextReward()?.icon && <span class='w-12 h-12 p-2 rounded-xl glass-inset shrink-0 grid place-items-center'><img decoding='async' src={nextReward().icon} alt='' class={'max-w-full max-h-full object-contain' + (nextReward().kind === 'currency' ? ' mono-icon' : '')} /></span>}
          </div>
          <div class='mt-1 truncate text-[12px] text-muted'>{props.pass.name}</div>
          <div class='mt-3 h-2 rounded-full glass-inset overflow-hidden'>
            <div class='h-full w-full rounded-full bg-gradient-to-r from-accent-2 to-accent origin-left transition-transform duration-1000 ease-out' style={st({ transform: `scaleX(${pct() / 100})` })} />
          </div>
          <div class='mt-2.5 truncate text-[11.5px] text-muted'>{next() ? `Next: ${nextReward()?.name || 'reward'} (${fmt(props.pass.towardsNext)} / ${fmt(next().xp)} XP)` : 'Pass complete'}</div>
        </div>
      )}
    </Card>)
  
}

export function FriendsCard(props) {
  const tiersA = useTiers()
  
    const online = () => ((props.friends.data || []).filter(f => f.online))
    return (<Card hover onClick={go('friends')} class='group h-full p-6'>
      <Heading right={<div class='flex items-center gap-2'>{props.friends.data && <Badge tone='good'>{online().length} online</Badge>}<Arrow /></div>}>Friends</Heading>
      {props.friends.loading && !props.friends.data ? <div class='space-y-2'><For each={[0, 1, 2, 3]}>{i => <Skeleton class='h-10 rounded-xl' />}</For></div>
        : props.friends.error || !online().length ? <Empty icon={FiUsers} title={props.friends.error ? 'Friends unavailable' : 'Nobody online'} hint={props.friends.error ? 'Open the Friends page to retry.' : 'Online friends will appear here.'} class='py-6' />
          : (
            <div class='stagger'>
              <For each={online().slice(0, 5)}>{(f, i) => {
                const s = () => (f.status || {})
                const rankIcon = () => (typeof s().rank === 'number' ? tiersA()?.[s().rank]?.smallIcon : null)
                return (
                  <div style={st({ '--i': i() })} class='flex items-center gap-3 rounded-xl px-2.5 py-2 -mx-1 hover:bg-surface-2 transition-colors'>
                    <span class='w-2 h-2 rounded-full bg-good anim-pulse shadow-[0_0_8px_rgb(var(--good)/0.6)] shrink-0' />
                    <span class='truncate text-[13px] font-medium text-text flex-1'>{f.gameName}<span class='text-muted font-normal'> #{f.tagLine}</span></span>
                    <span class='text-[11px] text-muted capitalize truncate max-w-[110px]'>{[s().state, s().map].filter(Boolean).join(' - ')}</span>
                    {rankIcon() && <img decoding='async' src={rankIcon()} alt='' class='w-5 h-5' />}
                  </div>
                )
              }}</For>
            </div>
          )}
    </Card>)
  
}

export function ClockCard(props) {
  const leftA = useCountdown(() => props.store?.dailySecondsLeft)
  const nowA = useNow()
  
    const now = () => (new Date(nowA()))
    return (<Card class='h-full p-6 flex flex-col'>
      <div class='flex items-center justify-between'>
        <span class='eyebrow'>Local time</span>
        <FiClock class='text-muted' />
      </div>
      <div class='flex-1 flex flex-col justify-end'>
        <div class='mt-3 display text-[52px] text-text tabular-nums'>{now().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}<span class='ml-1.5 text-[16px] font-semibold tracking-normal text-muted'>{String(now().getSeconds()).padStart(2, '0')}</span></div>
        <div class='mt-2 text-[12.5px] text-muted'>{now().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' })}</div>
        {leftA() != null && <div class='mt-4 self-start inline-flex items-center gap-1.5 rounded-full glass-inset px-3 py-1.5 text-[11px] text-muted'><FiShoppingBag /> Store refreshes in <span class='font-semibold text-text tabular-nums'>{fmtDuration(leftA())}</span></div>}
      </div>
    </Card>)
  
}
