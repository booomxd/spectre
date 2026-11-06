import { useEffect, useMemo, useState } from 'react'
import { FiAward, FiSearch } from 'react-icons/fi'
import { invoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { Badge, Button, Card, Empty, ErrorState, Input, Item, Page, RequireRiot, Skeleton, Stagger } from '../ui'
import { TierIcon, cx, useCards, openPlayer } from './history/shared'
import { CareerBar, StatCell, StatStrip } from './history/career'

const COLS = 'grid-cols-[64px_minmax(0,1fr)_170px_80px_72px]'
const SIZE = 100
const TABS = [{ value: 'all', label: 'Everyone' }, { value: 'known', label: 'Friends & party' }]

const isSecret = p => p.anonymous || !p.gameName

function Name({ p }) {
  if (isSecret(p)) return <span className='text-muted italic'>Secret Agent</span>
  return <>{p.prefix && <span className='text-muted'>{p.prefix} </span>}{p.gameName}<span className='text-muted'>#{p.tagLine}</span></>
}

function Entry({ p, cards, me, sticky, index }) {
  const art = cards[p.cardId]?.smallArt || cards[p.cardId]?.displayIcon
  const secret = isSecret(p)
  const link = !secret && p.puuid
  return (
    <div style={{ '--i': index }} onClick={() => link && openPlayer(p)}
      className={cx('grid items-center gap-3 px-6 h-[56px] text-[13px] transition-colors', COLS,
        sticky ? 'bg-panel/95 border-t border-accent/40 shadow-[0_-12px_30px_-16px_rgb(var(--accent)/0.5)]' : 'border-b border-line last:border-b-0',
        link && 'cursor-pointer', link && p.puuid !== me && 'hover:bg-surface-2', p.puuid === me && !sticky && 'accent-soft')}>
      <span className={cx('font-display text-[18px] font-bold tracking-tight tabular-nums', p.rank === 1 ? 'text-warn' : p.rank <= 3 ? 'text-text' : 'text-muted')}>#{p.rank}</span>
      <div className='flex items-center gap-3 min-w-0'>
        <div className='w-10 h-10 rounded-xl glass-inset overflow-hidden shrink-0'>
          {art && <img src={art} alt='' loading='lazy' className='w-full h-full object-cover' draggable={false} />}
        </div>
        <span className='truncate font-semibold'><Name p={p} /></span>
        {p.puuid === me && <Badge tone='accent'>You</Badge>}
        {p.known && p.puuid !== me && <Badge>{p.friend ? 'Friend' : 'Party'}</Badge>}
        {p.banned && <Badge tone='bad'>Banned</Badge>}
      </div>
      <TierIcon tier={p.tier} size={26} showName />
      <span className='font-display text-[15px] font-bold tracking-tight tabular-nums'>{p.rr}</span>
      <span className='text-muted tabular-nums'>{p.wins}</span>
    </div>
  )
}

// Top three as tall cards; first place in the middle with the accent glow.
function Podium({ top, cards, me }) {
  const order = [top[1], top[0], top[2]].filter(Boolean)
  return (
    <Stagger className='grid grid-cols-3 gap-4 mb-5 items-end'>
      {order.map((p, i) => {
        const first = p.rank === 1
        const art = cards[p.cardId]?.wideArt || cards[p.cardId]?.largeArt
        const link = !isSecret(p) && p.puuid
        return (
          <Item key={p.rank} index={i}>
            <Card hover={!!link} glow={first} onClick={() => link && openPlayer(p)} className={cx('relative overflow-hidden', first ? 'h-[190px] !rounded-3xl' : 'h-[160px]')}>
              {art && <img src={art} alt='' loading='lazy' draggable={false} className='absolute inset-0 w-full h-full object-cover opacity-45' />}
              <div className='absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20' />
              {first && <span className='halo w-72 h-72 -top-36 left-1/2 -translate-x-1/2' />}
              <div className='relative h-full p-5 flex flex-col justify-between'>
                <div className='flex items-center justify-between'>
                  <span className={cx('display tabular-nums', first ? 'text-[44px] text-warn' : 'text-[34px] text-text')}>#{p.rank}</span>
                  <TierIcon tier={p.tier} size={first ? 40 : 32} />
                </div>
                <div className='min-w-0'>
                  <div className='truncate text-[15px] font-semibold tracking-tight text-text'><Name p={p} /></div>
                  <div className='mt-1 flex items-center gap-2 text-[12px] text-muted tabular-nums'>
                    <span className='font-display font-bold text-text'>{p.rr} RR</span><span>{p.wins} wins</span>
                    {p.puuid === me && <Badge tone='accent'>You</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          </Item>
        )
      })}
    </Stagger>
  )
}

function Content() {
  const riot = useRiot()
  const cards = useCards()
  const [data, setData] = useState(null)
  const [players, setPlayers] = useState([])
  const [error, setError] = useState(null)
  const [more, setMore] = useState(false)
  const [q, setQ] = useState('')
  const [tab, setTab] = useState('all')

  const load = (start = 0) => {
    setMore(start > 0); setError(null)
    return invoke('leaderboard:get', { start, size: SIZE })
      .then(res => {
        setData(d => ({ ...res, you: res.you || d?.you || null }))
        setPlayers(list => (start ? [...list, ...res.players] : res.players))
      })
      .catch(e => setError(e.message))
      .finally(() => setMore(false))
  }
  useEffect(() => { if (riot.connected) load(0) }, [riot.connected])

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase()
    let list = tab === 'known' ? players.filter(p => p.known || p.puuid === riot.puuid) : players
    if (t) list = list.filter(p => !p.anonymous && `${p.gameName}#${p.tagLine}`.toLowerCase().includes(t))
    return list
  }, [players, q, tab, riot.puuid])
  const mine = players.find(p => p.puuid === riot.puuid)
  const you = mine || (data?.you && { ...data.you, puuid: riot.puuid, cardId: null, gameName: riot.gameName, tagLine: riot.tagLine, anonymous: false })
  const podium = !q.trim() && tab === 'all' && players.length >= 3

  if (error && !data) return <ErrorState error={error} onRetry={() => load(0)} />
  if (!data) return <div className='flex flex-col gap-2'><Skeleton className='h-[98px] rounded-2xl mb-3' />{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className='h-[56px] rounded-xl' />)}</div>

  return (
    <>
      <CareerBar tabs={TABS} value={tab} onChange={setTab} layoutId='career-leaderboard'
        right={(
          <div className='relative w-64'>
            <FiSearch className='absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' />
            <Input className='pl-10 !rounded-full' value={q} onChange={e => setQ(e.target.value)} placeholder='Search loaded players' />
          </div>
        )} />

      <StatStrip>
        <StatCell label='Your position' value={you ? `#${you.rank.toLocaleString()}` : '-'} sub={you ? 'this act' : 'not on the board yet'} tone={you ? 'accent' : undefined} />
        <StatCell label='Your RR' value={you ? you.rr : '-'} sub={you ? `${you.wins} wins` : ''} />
        <StatCell label='Top RR' value={players[0]?.rr ?? '-'} sub='rank #1' />
        <StatCell label='Ranked players' value={data.total.toLocaleString()} sub={`${players.length} loaded`} />
        <StatCell label='Season' sub={data.shard.toUpperCase()}>
          <div className='mt-2.5'><Badge tone='accent'>{data.season.name}</Badge></div>
        </StatCell>
      </StatStrip>

      {podium && <Podium top={players.slice(0, 3)} cards={cards} me={riot.puuid} />}

      <Card className='overflow-hidden anim-rise'>
        <div className={cx('grid gap-3 px-6 h-11 items-center border-b border-line eyebrow !text-[10px]', COLS)}>
          <span>Rank</span><span>Player</span><span>Tier</span><span>RR</span><span>Wins</span>
        </div>
        <div className='stagger'>
          {filtered.length ? filtered.map((p, i) => <Entry key={p.rank} p={p} cards={cards} me={riot.puuid} index={Math.min(i, 12)} />)
            : <Empty icon={FiAward} title='No players match' hint={tab === 'known' ? 'No friends or party members in the loaded range. Load more to widen it.' : 'Search only covers the players loaded so far. Load more to widen it.'} />}
        </div>
        {you && (
          <div className='sticky bottom-0 z-10'>
            <Entry p={you} cards={cards} me={riot.puuid} sticky />
          </div>
        )}
      </Card>

      {!you && <p className='mt-4 text-[12px] text-muted text-center'>You are not on this act&apos;s leaderboard yet.</p>}
      {players.length < data.total && (
        <div className='flex justify-center mt-6'>
          <Button loading={more} onClick={() => load(players.length)}>Load more</Button>
        </div>
      )}
      {error && <p className='mt-4 text-[12px] text-bad text-center'>{error}</p>}
    </>
  )
}

export default function Leaderboard() {
  return (
    <Page title='Leaderboard' subtitle='Top competitive players in your region this act'>
      <RequireRiot><Content /></RequireRiot>
    </Page>
  )
}
