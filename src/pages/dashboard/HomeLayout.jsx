// Home, top to bottom: a hero with your overview and what you're doing right now, then today's shop beside the friends who are online
import { FiArrowUpRight, FiClock, FiMessageSquare, FiUsers, FiWifi } from 'react-icons/fi'
import { Card, Badge, Skeleton, Empty, cx } from '../../ui'
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

function greeting() {
  const h = new Date().getHours()
  return h < 5 ? 'Late night' : h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening'
}
// long names (and wide CJK names) step down so they never push the hero wider
function nameSize(name = '') {
  const w = [...name].reduce((n, ch) => n + (/[⺀-￯]/.test(ch) ? 1.8 : 1), 0)
  return w <= 10 ? 50 : w <= 14 ? 42 : w <= 20 ? 34 : 28
}

const Arrow = () => (
  <span className='w-8 h-8 rounded-full glass-inset flex items-center justify-center text-muted shrink-0 transition-[transform,color] duration-300 ease-out group-hover:text-accent group-hover:-translate-y-0.5 group-hover:translate-x-0.5'>
    <FiArrowUpRight />
  </span>
)

// days until the current act ends, from the season list
function useActDaysLeft() {
  const seasons = useContent('seasons')
  const now = Date.now()
  const act = seasons?.find(s => /act/i.test(s.type || '') && Date.parse(s.startTime) <= now && Date.parse(s.endTime) > now)
  return act ? Math.max(0, Math.ceil((Date.parse(act.endTime) - now) / 864e5)) : null
}

function Stat({ label, children, loading }) {
  return (
    <div className='px-5 py-4 min-w-0'>
      <div className='eyebrow !text-[10px] truncate'>{label}</div>
      {loading ? <Skeleton className='h-7 w-24 mt-2.5' /> : <div className='mt-2.5 flex items-center gap-2.5 min-w-0'>{children}</div>}
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

export function HomeHero({ riot, identity, account, rank, rr, party }) {
  const card = useContent(contentPath('playercards', identity?.cardId))
  const tiers = useTiers()
  const t = rank && tiers?.[rank.tier]
  const peak = rank && tiers?.[rank.peak]
  const days = useActDaysLeft()
  const s = sessionOfParty(riot, party)
  const run = formOf(sessionOf(rr.data))
  return (
    <Card className='relative overflow-hidden !rounded-3xl p-6'>
      {card?.wideArt && (
        <img decoding='async' src={card.wideArt} alt='' draggable={false} className='absolute right-0 top-0 h-full w-[55%] object-cover opacity-25 pointer-events-none'
          style={{ WebkitMaskImage: 'linear-gradient(90deg, transparent, #000 70%)', maskImage: 'linear-gradient(90deg, transparent, #000 70%)' }} />
      )}
      <span className='halo -top-28 -left-20 w-80 h-80' />
      <div className='relative flex flex-wrap lg:flex-nowrap items-stretch gap-6'>
        <div className='w-[132px] h-[176px] shrink-0 rounded-2xl overflow-hidden glass-inset'>
          {card?.largeArt ? <img decoding='async' src={card.largeArt} alt='' draggable={false} className='w-full h-full object-cover object-top' /> : <Skeleton className='w-full h-full' />}
        </div>

        <div className='min-w-0 flex-1 basis-[420px] flex flex-col'>
          <div className='eyebrow flex items-center gap-2'>{greeting()}<span className='w-1 h-1 rounded-full bg-muted/60' />{new Date().toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'short' })}</div>
          <h2 className='display mt-2.5 text-text truncate pb-1' style={{ fontSize: nameSize(riot.gameName) }} title={riot.gameName} translate='no'>
            {riot.gameName || 'Agent'}<span className='text-accent'>{riot.tagLine ? `#${riot.tagLine}` : ''}</span>
          </h2>
          <div className='mt-2 flex items-center gap-2'>
            <span className='eyebrow !text-[10px]'>Your overview</span>
            {riot.region && <Badge>{riot.region}</Badge>}
          </div>
          <div className='mt-auto pt-4'>
            <div className='rounded-2xl glass-inset grid grid-cols-2 xl:grid-cols-4 divide-line max-xl:[&>*:nth-child(odd)]:border-r max-xl:[&>*:nth-child(-n+2)]:border-b xl:divide-x [&>*]:border-line'>
              <Stat label='Current rank' loading={!rank}>
                {t?.smallIcon && <img decoding='async' src={t.largeIcon || t.smallIcon} alt='' className='w-9 h-9 object-contain shrink-0' />}
                <span className='min-w-0'>
                  <span className='tier-text block truncate font-display text-[17px] font-bold tracking-tight' style={tierColor(t) ? { '--tier': tierColor(t) } : undefined}>{rank?.tier ? title(t?.tierName) : 'Unranked'}</span>
                  {rank?.tier > 0 && <span className='block text-[11px] text-muted tabular-nums'>{rank.rr} RR</span>}
                </span>
              </Stat>
              <Stat label='Career peak' loading={!rank}>
                {peak?.smallIcon && <img decoding='async' src={peak.largeIcon || peak.smallIcon} alt='' className='w-9 h-9 object-contain shrink-0' />}
                <span className='truncate font-display text-[17px] font-bold tracking-tight text-text'>{rank?.peak ? title(peak?.tierName) : 'Unranked'}</span>
              </Stat>
              <Stat label='Account level' loading={!account}>
                <span className='font-display text-[26px] font-750 tracking-tight leading-none tabular-nums text-text'>{account?.level}</span>
              </Stat>
              <Stat label='Act ends in'>
                <span className='font-display text-[26px] font-750 tracking-tight leading-none tabular-nums text-text'>{days != null ? `${days}d` : '-'}</span>
              </Stat>
            </div>
          </div>
        </div>

        <div className='w-full lg:w-[210px] shrink-0 lg:pl-6 lg:border-l border-line flex lg:flex-col gap-x-8 gap-y-3 flex-wrap lg:flex-nowrap'>
          <div>
            <div className='eyebrow !text-[10px]'>Your session</div>
            <div className='mt-2.5 flex items-center gap-2'>
              <span className={cx('w-2 h-2 rounded-full shrink-0', s.tone)} />
              <span className='font-display text-[17px] font-bold tracking-tight text-text'>{s.label}</span>
            </div>
            {s.sub && <div className='mt-0.5 pl-4 text-[12.5px] text-muted'>{s.sub}</div>}
          </div>
          {run.games > 0 && (
            <div>
              <div className='eyebrow !text-[10px]'>This session</div>
              <div className='mt-1.5 text-[13px] text-text tabular-nums'>
                <span className={cx('font-display text-[17px] font-bold', run.net >= 0 ? 'text-good' : 'text-bad')}>{signed(run.net)} RR</span>
                <span className='text-muted'> · {run.wins}W {run.games - run.wins}L</span>
              </div>
            </div>
          )}
          <div className={cx('lg:mt-auto flex items-center gap-2 text-[12px]', riot.connected ? 'text-good' : 'text-muted')}>
            <FiWifi />{riot.connected ? 'Live data connected' : 'Waiting for the Riot Client'}
          </div>
        </div>
      </div>
    </Card>
  )
}

function BundleBanner({ b, cat }) {
  const meta = cat?.bundles[b.id]
  const art = meta?.displayIcon2 || meta?.displayIcon
  const items = b.items.map(i => cat?.items.get(i.id)).filter(i => i?.icon)
  return (
    <div className='group/b relative overflow-hidden rounded-2xl glass-inset'>
      <div className='relative h-[150px]'>
        {art && <img decoding='async' src={art} alt='' loading='lazy' className='absolute inset-0 w-full h-full object-cover transition-transform duration-700 ease-out group-hover/b:scale-[1.03]' />}
        <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/25 to-transparent' />
        <span className='absolute top-3 right-3 h-6 px-2.5 rounded-full bg-black/55 border border-white/15 text-[11px] font-semibold text-white inline-flex items-center'>
          <Countdown seconds={b.secondsLeft} /><span className='ml-1'>left</span>
        </span>
        <div className='absolute left-4 bottom-3 right-4'>
          <div className='text-[10px] font-bold uppercase tracking-[0.14em] text-white/75'>Featured bundle</div>
          <div className='display text-[24px] text-white truncate'>{meta?.displayName || 'Bundle'}</div>
        </div>
      </div>
      <div className='flex items-center justify-between gap-3 px-4 py-3'>
        <div className='flex items-center gap-1.5 min-w-0'>
          {items.slice(0, 5).map((it, i) => (
            <span key={i} title={it.name} className='w-11 h-8 rounded-lg glass flex items-center justify-center p-1 shrink-0'><img decoding='async' src={it.icon} alt='' loading='lazy' className='max-w-full max-h-full object-contain' /></span>
          ))}
          {items.length > 5 && <span className='h-8 px-2 rounded-lg glass text-[11px] font-semibold text-muted inline-flex items-center'>+{items.length - 5}</span>}
        </div>
        <div className='flex items-center gap-2 shrink-0'>
          {b.discountPercent > 0 && <Badge tone='good'>-{Math.round(b.discountPercent * 100)}%</Badge>}
          <Price amount={b.totalDiscounted ?? b.totalBase} cat={cat} size={15} className='text-[20px] text-text' />
        </div>
      </div>
    </div>
  )
}

export function ShopCard({ store, cat }) {
  const left = useCountdown(store?.dailySecondsLeft)
  return (
    <Card hover onClick={go('shop')} className='group h-full p-6'>
      <div className='flex items-start justify-between gap-3 mb-5'>
        <div>
          <div className='eyebrow !text-[10px]'>Your rotation</div>
          <h3 className='display text-[26px] text-text mt-1.5'>Today's shop</h3>
        </div>
        <Arrow />
      </div>
      {!store ? <div className='space-y-4'><Skeleton className='h-[200px] rounded-2xl' /><Skeleton className='h-[200px] rounded-2xl' /></div> : (
        <div className='space-y-4'>
          {store.bundles.slice(0, 2).map(b => <BundleBanner key={b.id} b={b} cat={cat} />)}
          <div>
            <div className='flex items-center justify-between mb-3 mt-1'>
              <span className='eyebrow !text-accent'>Your offers</span>
              {left != null && <span className='inline-flex items-center gap-1.5 text-[12px] text-muted tabular-nums'><FiClock />{fmtDuration(left)} left</span>}
            </div>
            {store.daily.length ? (
              <div className='grid grid-cols-2 gap-3'>
                {store.daily.slice(0, 4).map(o => {
                  const item = cat?.items.get(o.itemId)
                  return (
                    <div key={o.id} className='rounded-2xl glass-inset overflow-hidden transition-[border-color,transform] duration-300 ease-out hover:border-accent/40 hover:-translate-y-0.5'>
                      <ItemArt item={item} className='h-[112px] px-6 pt-3' />
                      <div className='px-4 pb-3.5 pt-1 flex items-center justify-between gap-3'>
                        <span className='truncate text-[13px] font-semibold text-text'>{item?.name || '...'}</span>
                        <Price amount={o.price} cat={cat} size={12} className='text-[12.5px] text-muted shrink-0' />
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : <div className='text-[13px] text-muted py-6 text-center'>No daily offers</div>}
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

export function FriendsPanel({ friends }) {
  const all = friends.data || []
  const isOn = f => f.online && f.product === 'valorant'
  const online = all.filter(isOn)
  // everyone else, most recently seen first
  const offline = all.filter(f => !isOn(f)).sort((a, b) => (Number(b.lastOnline) || 0) - (Number(a.lastOnline) || 0))
  return (
    <Card className='h-full p-6 flex flex-col lg:absolute lg:inset-0'>
      <div className='flex items-start justify-between gap-3 mb-5'>
        <div>
          <div className='eyebrow !text-[10px]'>Your people</div>
          <h3 className='display text-[26px] text-text mt-1.5'>Friends</h3>
        </div>
        <div className='flex items-center gap-2'>
          {friends.data && <Badge tone='good'>{online.length} online</Badge>}
          <button type='button' aria-label='Open Friends' title='Open Friends' onClick={go('friends')} className='group'><Arrow /></button>
        </div>
      </div>
      {friends.loading && !friends.data ? <div className='space-y-2'>{[0, 1, 2, 3, 4].map(i => <Skeleton key={i} className='h-14 rounded-2xl' />)}</div>
        : friends.error || !all.length ? <Empty icon={FiUsers} title={friends.error ? 'Friends unavailable' : 'No friends yet'} hint={friends.error ? 'Open the Friends page to retry.' : 'Friends you add in VALORANT show up here.'} className='py-8' />
          : (
            <div className='flex-1 min-h-0 overflow-y-auto -mr-2 pr-2' translate='no'>
              <div className='eyebrow !text-[10px] mb-2' translate='yes'>Online <span className='text-muted/70'>· {online.length}</span></div>
              {!online.length && <div className='text-[12.5px] text-muted px-2 pb-2' translate='yes'>Nobody is in VALORANT right now.</div>}
              <div className='space-y-0.5'>
                {online.map(f => {
                  const s = f.status || {}
                  const playing = s.state === 'ingame' || s.state === 'pregame'
                  const where = playing ? [s.map, s.queueId ? queueName(s.queueId) : null].filter(Boolean).join(' · ') : null
                  return (
                    <div key={f.puuid} className='flex items-center gap-3 rounded-2xl px-2 py-2 hover:bg-surface-2 transition-colors'>
                      <span className='relative shrink-0'>
                        {s.card ? <img decoding='async' src={cardIcon(s.card)} alt='' loading='lazy' className='w-10 h-10 rounded-full object-cover border border-line' />
                          : <span className='w-10 h-10 rounded-full glass-inset grid place-items-center text-[13px] font-bold text-muted'>{(f.gameName || '?')[0]}</span>}
                        <span className={cx('absolute -right-0.5 -bottom-0.5 w-3 h-3 rounded-full border-2 border-panel', s.state === 'away' ? 'bg-warn' : playing ? 'bg-bad' : 'bg-good')} />
                      </span>
                      <span className='min-w-0 flex-1'>
                        <span className='flex items-center gap-2'>
                          <span className='truncate text-[13.5px] font-semibold text-text'>{f.gameName}</span>
                          {s.partySize > 1 && <span className='inline-flex items-center gap-1 text-[11px] text-muted shrink-0'><FiUsers size={11} />{s.partySize}</span>}
                        </span>
                        <span className='flex items-center gap-2 mt-0.5'>
                          <span className={cx('truncate text-[11.5px]', playing ? 'text-accent font-medium' : 'text-muted')} translate='yes'>{where || STATE[s.state] || 'Online'}</span>
                          {Array.isArray(s.score) && s.score[0] != null && <span className='shrink-0 h-[18px] px-1.5 rounded-md glass-inset text-[10.5px] font-bold text-text tabular-nums inline-flex items-center'>{s.score[0]} - {s.score[1]}</span>}
                        </span>
                      </span>
                      <button type='button' aria-label={`Message ${f.gameName}`} title='Message' onClick={go('friends', { puuid: f.puuid })}
                        className='w-9 h-9 rounded-xl glass-inset grid place-items-center text-muted hover:text-accent hover:border-accent/40 transition-colors shrink-0'><FiMessageSquare size={14} /></button>
                    </div>
                  )
                })}
              </div>
              {offline.length > 0 && (
                <>
                  <div className='eyebrow !text-[10px] mt-5 mb-2' translate='yes'>Offline <span className='text-muted/70'>· {offline.length}</span></div>
                  <div className='space-y-0.5'>
                    {offline.slice(0, OFFLINE_CAP).map(f => (
                      <button key={f.puuid} type='button' onClick={go('friends', { puuid: f.puuid })} title={`Open ${f.gameName}`}
                        className='w-full flex items-center gap-3 rounded-2xl px-2 py-1.5 text-left hover:bg-surface-2 transition-colors group/off'>
                        <span className='w-8 h-8 rounded-full glass-inset grid place-items-center text-[12px] font-bold text-muted/80 shrink-0'>{(f.gameName || '?')[0].toUpperCase()}</span>
                        <span className='min-w-0 flex-1 truncate text-[13px] font-medium text-muted group-hover/off:text-text transition-colors'>
                          {f.gameName}{f.tagLine && <span className='text-muted/50'> #{f.tagLine}</span>}
                        </span>
                        {ago(f.lastOnline) && <span className='shrink-0 text-[11px] text-muted/60 tabular-nums'>{ago(f.lastOnline)}</span>}
                      </button>
                    ))}
                    {offline.length > OFFLINE_CAP && (
                      <button type='button' onClick={go('friends')} className='w-full text-[12px] font-semibold text-muted hover:text-accent py-2 transition-colors' translate='yes'>
                        View all {offline.length} offline friends
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>
          )}
    </Card>
  )
}
