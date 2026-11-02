import { useEffect, useMemo, useState } from 'react'
import { FiAward, FiSearch } from 'react-icons/fi'
import { invoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { navigate } from '../nav'
import { Badge, Button, Card, Empty, ErrorState, Input, Page, RequireRiot, Skeleton } from '../ui'
import { TierIcon, cx, useCards, openPlayer } from './history/shared'

const COLS = 'grid-cols-[56px_minmax(0,1fr)_150px_72px_72px]'
const SIZE = 100

function Entry({ p, cards, me, sticky, index }) {
  const art = cards[p.cardId]?.smallArt || cards[p.cardId]?.displayIcon
  const secret = p.anonymous || !p.gameName
  const link = !secret && p.puuid
  return (
    <div style={{ '--i': index }} onClick={() => link && openPlayer(p)}
      className={cx('grid items-center gap-3 px-4 h-12 border-b border-line/60 text-[13px] transition-colors', COLS,
        link && 'cursor-pointer hover:bg-surface-2', p.puuid === me && 'bg-accent/10', sticky && 'bg-surface border-t border-accent/40 shadow-[0_-8px_24px_-12px_rgba(0,0,0,0.6)]')}>
      <span className={cx('font-display text-lg font-bold', p.rank === 1 ? 'text-warn' : p.rank <= 3 ? 'text-text' : 'text-muted')}>#{p.rank}</span>
      <div className='flex items-center gap-3 min-w-0'>
        <div className='w-8 h-8 rounded-md bg-surface-2 border border-line overflow-hidden shrink-0'>
          {art && <img src={art} alt='' loading='lazy' className='w-full h-full object-cover' draggable={false} />}
        </div>
        <span className={cx('truncate font-semibold', secret && 'text-muted italic')}>
          {secret ? 'Secret Agent' : <>{p.prefix && <span className='text-muted'>{p.prefix} </span>}{p.gameName}<span className='text-muted'>#{p.tagLine}</span></>}
        </span>
        {p.puuid === me && <Badge tone='accent'>You</Badge>}
        {p.known && p.puuid !== me && <Badge>{p.friend ? 'Friend' : 'Party'}</Badge>}
        {p.banned && <Badge tone='bad'>Banned</Badge>}
      </div>
      <TierIcon tier={p.tier} size={26} showName />
      <span className='font-display font-bold'>{p.rr}</span>
      <span className='text-muted'>{p.wins}</span>
    </div>
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
    return t ? players.filter(p => !p.anonymous && `${p.gameName}#${p.tagLine}`.toLowerCase().includes(t)) : players
  }, [players, q])
  const mine = players.find(p => p.puuid === riot.puuid)
  const you = mine || (data?.you && { ...data.you, puuid: riot.puuid, cardId: null, gameName: riot.gameName, tagLine: riot.tagLine, anonymous: false })

  if (error && !data) return <ErrorState error={error} onRetry={() => load(0)} />
  if (!data) return <div className='flex flex-col gap-1.5'>{Array.from({ length: 12 }, (_, i) => <Skeleton key={i} className='h-12 rounded-lg' />)}</div>

  return (
    <>
      <div className='flex flex-wrap items-center justify-between gap-3 mb-4'>
        <div className='relative w-72'>
          <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
          <Input className='pl-9' value={q} onChange={e => setQ(e.target.value)} placeholder='Search loaded players' />
        </div>
        <div className='flex items-center gap-2 text-xs text-muted'>
          <Badge tone='accent'>{data.season.name}</Badge>
          <span>{data.shard.toUpperCase()} - {players.length} of {data.total.toLocaleString()} loaded</span>
        </div>
      </div>

      <Card className='overflow-hidden anim-rise'>
        <div className={cx('grid gap-3 px-4 h-9 items-center bg-surface-2 text-[10px] font-semibold uppercase tracking-wider text-muted', COLS)}>
          <span>Rank</span><span>Player</span><span>Tier</span><span>RR</span><span>Wins</span>
        </div>
        {filtered.length ? filtered.map((p, i) => <Entry key={p.rank} p={p} cards={cards} me={riot.puuid} index={Math.min(i, 12)} />)
          : <Empty icon={FiAward} title='No players match' hint='Search only covers the players loaded so far. Load more to widen it.' />}
        {you && (
          <div className='sticky bottom-0 z-10'>
            <Entry p={you} cards={cards} me={riot.puuid} sticky />
          </div>
        )}
      </Card>

      {!you && <p className='mt-3 text-xs text-muted text-center'>You are not on this act's leaderboard yet.</p>}
      {players.length < data.total && (
        <div className='flex justify-center mt-4'>
          <Button loading={more} onClick={() => load(players.length)}>Load more</Button>
        </div>
      )}
      {error && <p className='mt-3 text-xs text-bad text-center'>{error}</p>}
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
