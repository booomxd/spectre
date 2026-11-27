import { For } from 'solid-js'
import { st } from '../../lib/st.js'
// Home, top to bottom: a hero with your overview and what you're doing right now, then today's shop beside the friends who are online
import { FiArrowUpRight, FiClock, FiMessageSquare, FiUsers, FiWifi } from 'solid-icons/fi'
import { Card, Badge, Skeleton, Empty, cx, useNow } from '../../ui'
import { contentPath, useContent, useTiers } from '../../lib/content'
import { navigate } from '../../nav'
import { cardIcon, queueName } from '../live/util'
import { useCountdown, fmtDuration } from './catalog'
import { Price, Countdown, ItemArt } from './bits'
import { formOf, sessionOf } from './Cards'

const go = (id, params) => () => navigate(id, params)
const title = s => (s || '').toLowerCase().replace(/(^|\s)\S/g, c => c.toUpperCase())
const signed = n => (n > 0 ? '+' : '') + n
const tierColor = t => (t?.color ? '#' + t.color.slice(0, 6) : null)

function greeting(now = Date.now()) {
  const h = new Date(now).getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
// long names (and wide CJK names) step down so they never push the hero wider
function nameSize(name = '') {
  const w = [...name].reduce((n, ch) => n + (/[⺀-￯]/.test(ch) ? 1.8 : 1), 0)
  return w <= 10 ? 50 : w <= 14 ? 42 : w <= 20 ? 34 : 28
}

const Arrow = () => (
  <span class='w-8 h-8 rounded-full glass-inset flex items-center justify-center text-muted shrink-0 transition-[transform,color] duration-300 ease-out group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5'>
    <FiArrowUpRight />
  </span>
)

// days until the current act ends, from the season list
function useActDaysLeft(nowA) {
  const seasons = useContent('seasons')
  return () => {
    const now = nowA()
    const act = seasons()?.find(s => /act/i.test(s.type || '') && Date.parse(s.startTime) <= now && Date.parse(s.endTime) > now)
    return act ? Math.max(0, Math.ceil((Date.parse(act.endTime) - now) / 864e5)) : null
  }
}

function Stat(props) {
  return (
    <div class='px-5 py-4 min-w-0'>
      <div class='eyebrow !text-[10px] truncate'>{props.label}</div>
      {props.loading ? <Skeleton class='h-7 w-24 mt-2.5' /> : <div class='mt-2.5 flex items-center gap-2.5 min-w-0'>{props.children}</div>}
    </div>
  )
}

// what the party is doing, in the game's own words
function sessionOfParty(riot, party) {
  if (!riot.connected) return { label: 'Riot Client closed', tone: 'bg-muted' }
  const p = party.data
  if (!p) return { label: party.loading ? 'Checking...' : 'Game closed', tone: 'bg-muted' }
  const mode = p.queueId ? queueName(p.queueId) : null
  if (p.state === 'MATCHMAKING') return { label: 'In queue', sub: mode, tone: 'bg-warn' }
  if (p.state === 'DEFAULT') return { label: 'In lobby', sub: mode, tone: 'bg-good' }
  if (/CUSTOM/.test(p.state || '')) return { label: 'Custom game', tone: 'bg-good' }
  return { label: 'In match', sub: mode, tone: 'bg-good' }
}

export function HomeHero(props) {
  const cardA = useContent(() => contentPath('playercards', props.identity?.cardId))
  const tiersA = useTiers()
  // ticks once a minute so the greeting, date and act countdown roll over while the app stays open
  const nowA = useNow(60000)
  const daysA = useActDaysLeft(nowA)
  
    const t = () => (props.rank && tiersA()?.[props.rank.tier])
    const peak = () => (props.rank && tiersA()?.[props.rank.peak])
    const s = () => (sessionOfParty(props.riot, props.party))
    const run = () => (formOf(sessionOf(props.rr.data)))
    return (<Card class='relative overflow-hidden !rounded-3xl p-6'>
      {cardA()?.wideArt && (
        <img decoding='async' src={cardA().wideArt} alt='' draggable={false} class='absolute right-0 top-0 h-full w-[55%] object-cover opacity-25 pointer-events-none'
          style={st({ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 70%)', maskImage: 'linear-gradient(90deg, transparent, #000 70%)' })} />
      )}
      <span class='halo -top-28 -left-20 w-80 h-80' />
      <div class='relative flex flex-wrap lg:flex-nowrap items-stretch gap-6'>
        <div class='w-[132px] h-[176px] shrink-0 rounded-2xl overflow-hidden glass-inset'>
          {cardA()?.largeArt ? <img decoding='async' src={cardA().largeArt} alt='' draggable={false} class='w-full h-full object-cover object-top' /> : <Skeleton class='w-full h-full' />}
        </div>

        <div class='min-w-0 flex-1 basis-[420px] flex flex-col'>
          <div class='eyebrow flex items-center gap-2'>{greeting(nowA())}<span class='w-1 h-1 rounded-full bg-muted/60' />{new Date(nowA()).toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <h2 class='display mt-2.5 text-text truncate pb-1' style={st({ fontSize: nameSize(props.riot.gameName) })} title={props.riot.gameName} translate='no'>
            {props.riot.gameName || 'Agent'}<span class='text-accent'>{props.riot.tagLine ? `#${props.riot.tagLine}` : ''}</span>
          </h2>
          <div class='mt-2 flex items-center gap-2'>
            <span class='eyebrow !text-[10px]'>Your overview</span>
            {props.riot.region && <Badge>{props.riot.region}</Badge>}
          </div>
          <div class='mt-auto pt-4'>
            <div class='rounded-2xl glass-inset grid grid-cols-2 xl:grid-cols-4 divide-line max-xl:[&>*:nth-child(odd)]:border-r max-xl:[&>*:nth-child(-n+2)]:border-b xl:divide-x [&>*]:border-line'>
              <Stat label='Current rank' loading={!props.rank}>
                {t()?.smallIcon && <img decoding='async' src={t().largeIcon || t().smallIcon} alt='' class='w-9 h-9 object-contain shrink-0' />}
                <span class='min-w-0'>
                  <span class='tier-text block truncate font-display text-[17px] font-bold tracking-tight' style={st(tierColor(t()) ? { '--tier': tierColor(t()) } : undefined)}>{props.rank?.tier ? title(t()?.tierName) : 'Unranked'}</span>
                  {props.rank?.tier > 0 && <span class='block text-[11px] text-muted tabular-nums'>{props.rank.rr} RR</span>}
                </span>
              </Stat>
              <Stat label='Career peak' loading={!props.rank}>
                {peak()?.smallIcon && <img decoding='async' src={peak().largeIcon || peak().smallIcon} alt='' class='w-9 h-9 object-contain shrink-0' />}
                <span class='truncate font-display text-[17px] font-bold tracking-tight text-text'>{props.rank?.peak ? title(peak()?.tierName) : 'Unranked'}</span>
              </Stat>
              <Stat label='Account level' loading={!props.account}>
                <span class='font-display text-[26px] font-750 tracking-tight leading-none tabular-nums text-text'>{props.account?.level}</span>
              </Stat>
              <Stat label='Act ends in'>
                <span class='font-display text-[26px] font-750 tracking-tight leading-none tabular-nums text-text'>{daysA() != null ? `${daysA()}d` : '-'}</span>
              </Stat>
            </div>
          </div>
        </div>

        <div class='w-full lg:w-[210px] shrink-0 lg:pl-6 lg:border-l border-line flex lg:flex-col gap-x-8 gap-y-3 flex-wrap lg:flex-nowrap'>
          <div>
            <div class='eyebrow !text-[10px]'>Your session</div>
            <div class='mt-2.5 flex items-center gap-2'>
              <span class={cx('w-2 h-2 rounded-full shrink-0', s().tone)} />
              <span class='font-display text-[17px] font-bold tracking-tight text-text'>{s().label}</span>
            </div>
            {s().sub && <div class='mt-0.5 pl-4 text-[12.5px] text-muted'>{s().sub}</div>}
          </div>
          {run().games > 0 && (
            <div>
              <div class='eyebrow !text-[10px]'>This session</div>
              <div class='mt-1.5 text-[13px] text-text tabular-nums'>
                <span class={cx('font-display text-[17px] font-bold', run().net >= 0 ? 'text-good' : 'text-bad')}>{signed(run().net)} RR</span>
                <span class='text-muted'> · {run().wins}W {run().games - run().wins}L</span>
              </div>
            </div>
          )}
          <div class={cx('lg:mt-auto flex items-center gap-2 text-[12px]', props.riot.connected ? 'text-good' : 'text-muted')}>
            <FiWifi />{props.riot.connected ? 'Live data connected' : 'Waiting for the Riot Client'}
          </div>
        </div>
      </div>
    </Card>)
  
}

function BundleBanner(props) {
  
    const meta = () => (props.cat?.bundles[props.b.id])
    const art = () => (meta()?.displayIcon2 || meta()?.displayIcon)
    const items = () => (props.b.items.map(i => props.cat?.items.get(i.id)).filter(i => i?.icon))
    return (<div class='group/b relative overflow-hidden rounded-2xl glass-inset'>
      <div class='relative h-[150px]'>
        {art() && <img decoding='async' src={art()} alt='' loading='lazy' class='absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover/b:scale-[1.03]' />}
        <div class='absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent' />
        <span class='absolute top-3 right-3 h-6 px-2.5 rounded-full bg-black/55 border border-white/15 text-[11px] font-semibold text-white inline-flex items-center'>
          <Countdown seconds={props.b.secondsLeft} /><span class='ml-1'>left</span>
        </span>
        <div class='absolute left-4 bottom-3 right-4'>
          <div class='text-[10px] font-bold uppercase tracking-[0.14em] text-white/75'>Featured bundle</div>
          <div class='display text-[24px] text-white truncate'>{meta()?.displayName || 'Bundle'}</div>
        </div>
      </div>
      <div class='flex items-center justify-between gap-3 px-4 py-3'>
        <div class='flex items-center gap-1.5 min-w-0'>
          <For each={items().slice(0, 5)}>{(it, i) => (
            <span title={it.name} class='w-11 h-8 rounded-lg glass flex items-center justify-center p-1 shrink-0'><img decoding='async' src={it.icon} alt='' loading='lazy' class='max-w-full max-h-full object-contain' /></span>
          )}</For>
          {items().length > 5 && <span class='h-8 px-2 rounded-lg glass text-[11px] font-semibold text-muted inline-flex items-center'>+{items().length - 5}</span>}
        </div>
        <div class='flex items-center gap-2 shrink-0'>
          {props.b.discountPercent > 0 && <Badge tone='good'>-{Math.round(props.b.discountPercent * 100)}%</Badge>}
          <Price amount={props.b.totalDiscounted ?? props.b.totalBase} cat={props.cat} size={15} class='text-[20px] text-text' />
        </div>
      </div>
    </div>)
  
}

export function ShopCard(props) {
  const leftA = useCountdown(() => props.store?.dailySecondsLeft)
  return (
    <Card hover onClick={go('shop')} class='group h-full p-6'>
      <div class='flex items-start justify-between gap-3 mb-5'>
        <div>
          <div class='eyebrow !text-[10px]'>Your rotation</div>
          <h3 class='display text-[26px] text-text mt-1.5'>Today's shop</h3>
        </div>
        <Arrow />
      </div>
      {!props.store ? <div class='space-y-4'><Skeleton class='h-[200px] rounded-2xl' /><Skeleton class='h-[200px] rounded-2xl' /></div> : (
        <div class='space-y-4'>
          <For each={props.store.bundles.slice(0, 2)}>{b => <BundleBanner b={b} cat={props.cat} />}</For>
          <div>
            <div class='flex items-center justify-between mb-3 mt-1'>
              <span class='eyebrow !text-accent'>Your offers</span>
              {leftA() != null && <span class='inline-flex items-center gap-1.5 text-[12px] text-muted tabular-nums'><FiClock />{fmtDuration(leftA())} left</span>}
            </div>
            {props.store.daily.length ? (
              <div class='grid grid-cols-2 gap-3'>
                <For each={props.store.daily.slice(0, 4)}>{o => {
                  const item = () => (props.cat?.items.get(o.itemId))
                  return (
                    <div class='rounded-2xl glass-inset overflow-hidden transition-[border-color,transform] duration-300 ease-out hover:border-accent/40 hover:-translate-y-0.5'>
                      <ItemArt item={item()} class='h-[112px] px-6 pt-3' />
                      <div class='px-4 pb-3.5 pt-1 flex items-center justify-between gap-3'>
                        <span class='truncate text-[13px] font-semibold text-text'>{item()?.name || '...'}</span>
                        <Price amount={o.price} cat={props.cat} size={12} class='text-[12.5px] text-muted shrink-0' />
                      </div>
                    </div>
                  )
                }}</For>
              </div>
            ) : <div class='text-[13px] text-muted py-6 text-center'>No daily offers</div>}
          </div>
        </div>
      )}
    </Card>
  )
}

const STATE = { menus: 'In menus', queue: 'In queue', pregame: 'Agent select', ingame: 'In match', away: 'Away' }

// "5m ago", "3h ago", "4d ago", "2mo ago" from a ms timestamp
const ago = (ts) => {
  const t = Number(ts); if (!t) return null
  const m = Math.max(1, Math.round((Date.now() - t) / 60000))
  return m < 60 ? `${m}m ago` : m < 1440 ? `${Math.round(m / 60)}h ago` : m < 43200 ? `${Math.round(m / 1440)}d ago` : `${Math.round(m / 43200)}mo ago`
}
const OFFLINE_CAP = 60

export function FriendsPanel(props) {
  
    const all = () => (props.friends.data || [])
    const isOn = f => f.online && f.product === 'valorant'
    const online = () => (all().filter(isOn))
    const offline = () => (all().filter(f => !isOn(f)).sort((a, b) => (Number(b.lastOnline) || 0) - (Number(a.lastOnline) || 0)))
    return (<Card class='h-full p-6 flex flex-col lg:absolute lg:inset-0'>
      <div class='flex items-start justify-between gap-3 mb-5'>
        <div>
          <div class='eyebrow !text-[10px]'>Your people</div>
          <h3 class='display text-[26px] text-text mt-1.5'>Friends</h3>
        </div>
        <div class='flex items-center gap-2'>
          {props.friends.data && <Badge tone='good'>{online().length} online</Badge>}
          <button type='button' aria-label='Open Friends' title='Open Friends' onClick={go('friends')} class='group'><Arrow /></button>
        </div>
      </div>
      {props.friends.loading && !props.friends.data ? <div class='space-y-2'><For each={[0, 1, 2, 3, 4]}>{i => <Skeleton class='h-14 rounded-2xl' />}</For></div>
        : props.friends.error || !all().length ? <Empty icon={FiUsers} title={props.friends.error ? 'Friends unavailable' : 'No friends yet'} hint={props.friends.error ? 'Open the Friends page to retry.' : 'Friends you add in VALORANT show up here.'} class='py-8' />
          : (
            <div class='flex-1 min-h-0 overflow-y-auto -mr-2 pr-2' translate='no'>
              <div class='eyebrow !text-[10px] mb-2' translate='yes'>Online <span class='text-muted/70'>· {online().length}</span></div>
              {!online().length && <div class='text-[12.5px] text-muted px-2 pb-2' translate='yes'>Nobody is in VALORANT right now.</div>}
              <div class='space-y-0.5'>
                <For each={online()}>{f => {
                  const s = () => (f.status || {})
                  const playing = () => (s().state === 'ingame' || s().state === 'pregame')
                  const where = () => (playing() ? [s().map, s().queueId ? queueName(s().queueId) : null].filter(Boolean).join(' · ') : null)
                  return (
                    <div class='flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2 transition-colors'>
                      <span class='relative shrink-0'>
                        {s().card ? <img decoding='async' src={cardIcon(s().card)} alt='' loading='lazy' class='w-10 h-10 rounded-full object-cover border border-line' />
                          : <span class='w-10 h-10 rounded-full glass-inset grid place-items-center text-[13px] font-bold text-muted'>{(f.gameName || '?')[0]}</span>}
                        <span class={cx('absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-panel', s().state === 'away' ? 'bg-warn' : playing() ? 'bg-bad' : 'bg-good')} />
                      </span>
                      <span class='min-w-0 flex-1'>
                        <span class='flex items-center gap-2'>
                          <span class='truncate text-[13.5px] font-semibold text-text'>{f.gameName}</span>
                          {s().partySize > 1 && <span class='inline-flex items-center gap-1 text-[11px] text-muted shrink-0'><FiUsers size={11} />{s().partySize}</span>}
                        </span>
                        <span class='flex items-center gap-2 mt-0.5'>
                          <span class={cx('truncate text-[11.5px]', playing() ? 'text-accent font-medium' : 'text-muted')} translate='yes'>{where() || STATE[s().state] || 'Online'}</span>
                          {Array.isArray(s().score) && s().score[0] != null && <span class='shrink-0 h-[18px] px-1.5 rounded-md glass-inset text-[10.5px] font-bold text-text tabular-nums inline-flex items-center'>{s().score[0]} - {s().score[1]}</span>}
                        </span>
                      </span>
                      <button type='button' aria-label={`Message ${f.gameName}`} title='Message' onClick={() => go('friends', { puuid: f.puuid })()}
                        class='w-9 h-9 rounded-xl glass-inset grid place-items-center text-muted hover:text-accent hover:border-accent/40 transition-colors shrink-0'><FiMessageSquare size={14} /></button>
                    </div>
                  )
                }}</For>
              </div>
              {offline().length > 0 && (
                <>
                  <div class='eyebrow !text-[10px] mt-5 mb-2' translate='yes'>Offline <span class='text-muted/70'>· {offline().length}</span></div>
                  <div class='space-y-0.5'>
                    <For each={offline().slice(0, OFFLINE_CAP)}>{f => (
                      <button type='button' onClick={() => go('friends', { puuid: f.puuid })()} title={`Open ${f.gameName}`}
                        class='w-full flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-surface-2 transition-colors group/off'>
                        <span class='w-8 h-8 rounded-full glass-inset grid place-items-center text-[12px] font-bold text-muted/80 shrink-0'>{(f.gameName || '?')[0].toUpperCase()}</span>
                        <span class='min-w-0 flex-1 truncate text-[13px] font-medium text-muted group-hover/off:text-text transition-colors'>
                          {f.gameName}{f.tagLine && <span class='text-muted/50'> #{f.tagLine}</span>}
                        </span>
                        {ago(f.lastOnline) && <span class='shrink-0 text-[11px] text-muted/60 tabular-nums'>{ago(f.lastOnline)}</span>}
                      </button>
                    )}</For>
                    {offline().length > OFFLINE_CAP && (
                      <button type='button' onClick={go('friends')} class='w-full text-[12px] font-semibold text-muted hover:text-accent py-2 transition-colors' translate='yes'>
                        View all {offline().length} offline friends
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
    </Card>)
  
}
