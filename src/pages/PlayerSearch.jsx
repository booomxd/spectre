import { useEffect, useState } from 'react'
import { FiArrowRight, FiClock, FiSearch, FiUser, FiX } from 'react-icons/fi'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent, useTiers } from '../lib/content'
import { Badge, Button, Card, Empty, ErrorState, FadeIn, Heading, Item, Page, RequireRiot, Skeleton, Stagger, toast } from '../ui'
import { ListLabel, ListRow, Pane, SPLIT_BODY, SplitView } from './friends/Layout'
import HistoryPanel from './history/HistoryPanel'
import { MemoForm } from './history/MemoEditor'
import { TierIcon, cx, kd, seasonName, useSeasons } from './history/shared'

function RankBlock({ label, tier, rr, sub }) {
  return (
    <div className='glass glass-blur flex items-center gap-3.5 rounded-2xl px-4 py-3 min-w-[190px]'>
      <TierIcon tier={tier} size={44} />
      <div>
        <div className='text-[12px] font-medium text-muted'>{label}</div>
        <div className='font-display text-lg font-bold tracking-tight leading-tight'><TierName tier={tier} />{rr != null && tier ? <span className='text-muted text-sm font-semibold tabular-nums'> {rr} RR</span> : null}</div>
        {sub && <div className='text-[11px] text-muted'>{sub}</div>}
      </div>
    </div>
  )
}
function TierName({ tier }) {
  const tiers = useTiers()
  return tier && tiers?.[tier] ? tiers[tier].tierName : 'Unranked'
}

function ScoutStats({ scout }) {
  const r = scout.data?.recent
  const stat = (label, value, sub) => (
    <div className='flex-1 min-w-[120px] px-5 py-4 first:pl-6'>
      <div className='eyebrow'>{label}</div>
      <div className='font-display text-[30px] font-bold tracking-tight leading-tight tabular-nums mt-1.5'>{value}</div>
      {sub && <div className='text-[11px] text-muted tabular-nums'>{sub}</div>}
    </div>
  )
  if (scout.loading && !scout.data) return <Skeleton className='h-[104px] rounded-3xl' />
  if (!r) return null
  return (
    <Card className='rounded-3xl flex flex-wrap divide-x divide-line'>
      {stat('Headshot %', r.hs != null ? `${r.hs}%` : '-', `last ${r.matches} competitive`)}
      {stat('K/D', kd(r.kills, r.deaths), `${r.kills} / ${r.deaths}`)}
      {r.team > 0 && stat('Recent win rate', `${Math.round(r.wins / r.team * 100)}%`, `${r.wins}W ${r.team - r.wins}L`)}
    </Card>
  )
}

function ActHistory({ scout, seasons }) {
  const tiers = useTiers()
  if (scout.loading && !scout.data) return <div className='grid gap-2'>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className='h-[60px] rounded-2xl' />)}</div>
  if (scout.error && !scout.data) return <ErrorState error={scout.error} onRetry={scout.reload} />
  const start = id => Date.parse(seasons[id]?.startTime) || 0
  const acts = [...(scout.data?.acts || [])].sort((a, b) => start(b.seasonId) - start(a.seasonId))
  if (!acts.length) return <Empty icon={FiClock} title='No competitive acts' hint='No ranked act data is available for this player.' className='py-8' />
  // All-time peak act: highest peak, earliest act to reach it.
  const best = Math.max(...acts.map(a => a.peak))
  const peakAct = [...acts].reverse().find(a => a.peak === best)?.seasonId
  return (
    <Stagger className='grid gap-2'>
      {acts.map((a, i) => {
        const wr = Math.round(a.wins / a.games * 100)
        const isPeak = a.seasonId === peakAct
        return (
          <Item key={a.seasonId} index={i}
            className={cx('flex items-center gap-4 rounded-2xl px-4 py-2.5', isPeak ? 'accent-soft' : 'glass')}>
            <div className='w-[64px] shrink-0 font-display text-[13px] font-bold tracking-tight'>{seasonName(seasons, a.seasonId) || 'Act'}</div>
            <div className='flex items-center gap-2 w-[150px] shrink-0' title='Final rank'>
              <TierIcon tier={a.tier} size={30} />
              <div className='leading-tight'>
                <div className='text-[12px] font-semibold'>{a.tier ? tiers?.[a.tier]?.tierName : 'Unranked'}</div>
                <div className='text-[11px] text-muted'>Final</div>
              </div>
            </div>
            <div className={cx('flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1 border', a.peak ? 'border-accent/30 bg-accent/10' : 'border-line bg-surface-2/60')} title='Act peak'>
              <TierIcon tier={a.peak} size={26} />
              <div className='leading-tight'>
                <div className='text-[12px] font-semibold'>{a.peak ? tiers?.[a.peak]?.tierName : '-'}</div>
                <div className='text-[11px] font-medium text-accent'>Act peak</div>
              </div>
            </div>
            {isPeak && a.peak > 0 && <Badge tone='accent'>All-time peak</Badge>}
            <div className='ml-auto text-right leading-tight'>
              <div className='text-[13px] font-semibold tabular-nums'>{wr}% <span className='text-muted font-normal text-[11px]'>win rate</span></div>
              <div className='text-[11px] text-muted tabular-nums'>{a.wins}W of {a.games} games</div>
            </div>
          </Item>
        )
      })}
    </Stagger>
  )
}

function Profile({ puuid }) {
  const scout = useInvoke('search:scout', [puuid])
  const { data, error, loading, reload } = useInvoke('search:profile', [puuid])
  const { data: memo, reload: reloadMemo } = useInvoke('memo:get', [puuid])
  const card = useContent(data?.cardId ? `playercards/${data.cardId}` : 'playercards/00000000-0000-0000-0000-000000000000')
  const title = useContent(data?.titleId ? `playertitles/${data.titleId}` : 'playertitles/00000000-0000-0000-0000-000000000000')
  const seasons = useSeasons()

  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (loading && !data) return <Skeleton className='h-[250px] rounded-3xl' />
  const name = data.gameName ? `${data.gameName}#${data.tagLine}` : ''
  const wr = data.current?.games ? Math.round(data.current.wins / data.current.games * 100) : null

  return (
    <FadeIn className='flex flex-col gap-5'>
      <Card className='relative overflow-hidden rounded-3xl min-h-[250px]'>
        {data.cardId && card?.wideArt && <img src={card.wideArt} alt='' className='absolute inset-0 w-full h-full object-cover' draggable={false} />}
        {/* Dark scrim over the card art: the name stays white and legible on every theme. Without art the plain glass shows through. */}
        {data.cardId && card?.wideArt && <div className='absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/5' />}
        {!(data.cardId && card?.wideArt) && <span className='halo -top-32 -right-24 w-96 h-96' />}
        <div className='relative h-full min-h-[250px] flex flex-col justify-end p-7 gap-4'>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2 mb-2.5'>
                {data.self && <Badge tone='accent'>You</Badge>}
                {data.level != null && <Badge>Level {data.level}</Badge>}
                {data.leaderboardRank && <Badge tone='warn'>Leaderboard #{data.leaderboardRank}</Badge>}
              </div>
              <h2 className={cx('display text-[44px] truncate', data.cardId && card?.wideArt ? 'text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.45)]' : 'text-text')}>{name || 'Hidden player'}</h2>
              {title?.titleText && <div className={cx('text-sm mt-2', data.cardId && card?.wideArt ? 'text-white/75' : 'text-muted')}>{title.titleText}</div>}
            </div>
            <div className='flex flex-wrap gap-3'>
              <RankBlock label='Current' tier={data.current?.tier} rr={data.current?.rr}
                sub={data.current?.games ? `${data.current.wins}W of ${data.current.games} games${wr != null ? ` (${wr}%)` : ''}` : null} />
              <RankBlock label='Peak' tier={data.peak?.tier} sub={seasonName(seasons, data.peak?.seasonId)} />
            </div>
          </div>
        </div>
      </Card>

      {data.notes.length > 0 && <div className='text-[12px] text-warn'>{data.notes.join('. ')}</div>}

      <ScoutStats scout={scout} />

      <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start'>
        <div className='flex flex-col gap-6'>
          <div>
            <Heading hint='Final rank and peak for every competitive act'>Act history</Heading>
            <ActHistory scout={scout} seasons={seasons} />
          </div>
          <div>
            <Heading>Recent matches</Heading>
            <HistoryPanel puuid={puuid} step={10} />
          </div>
        </div>
        <Card className='p-5 rounded-3xl xl:sticky xl:top-0'>
          <Heading hint='Only you can see this'>Your note</Heading>
          <MemoForm target={{ puuid, name }} memo={memo} onSaved={reloadMemo} onDeleted={reloadMemo} />
        </Card>
      </div>
    </FadeIn>
  )
}

export default function PlayerSearch({ params }) {
  const [text, setText] = useState('')
  const [puuid, setPuuid] = useState(params?.puuid || null)
  const [busy, setBusy] = useState(false)
  const [searchError, setSearchError] = useState(null)
  const { data: recent, reload: reloadRecent } = useInvoke('search:recent')

  useEffect(() => { if (params?.puuid) { setPuuid(params.puuid); setSearchError(null) } }, [params?.puuid])

  const find = async (value) => {
    if (!value.includes('#')) { setSearchError('Enter a Riot ID like Name#Tag'); return }
    setBusy(true); setSearchError(null)
    try {
      const hit = await invoke('search:lookup', value)
      await invoke('search:pushRecent', { puuid: hit.puuid, gameName: hit.gameName, tagLine: hit.tagLine })
      reloadRecent(true)
      setPuuid(hit.puuid)
    } catch (e) { setSearchError(e.message) }
    setBusy(false)
  }

  const open = r => { setText(`${r.gameName}#${r.tagLine}`); setPuuid(r.puuid); setSearchError(null); invoke('search:pushRecent', r).then(() => reloadRecent(true)).catch(() => { }) }
  const clear = async () => { await invoke('search:clearRecent'); reloadRecent(true); toast('Recent searches cleared') }

  const list = (
    <Pane title='Find a player'
      header={<>
        <form className='flex flex-col gap-2' onSubmit={e => { e.preventDefault(); find(text.trim()) }}>
          <div className='glass-field flex items-center gap-2 rounded-full pl-4 pr-1 h-11'>
            <FiSearch className='text-muted shrink-0' size={14} />
            <input className='flex-1 min-w-0 bg-transparent outline-none text-[13px] text-text placeholder:text-muted/60' value={text} onChange={e => setText(e.target.value)} placeholder='Name#Tag' autoFocus />
            <Button type='submit' variant='primary' size='icon' className='!w-9 !h-9 shrink-0' title='Search' loading={busy} disabled={!text.trim()}><FiArrowRight /></Button>
          </div>
        </form>
        {searchError && <div className='anim-fade mt-2 px-3 text-[12px] text-bad'>{searchError}</div>}
      </>}>
      {recent?.length > 0 ? (
        <>
          <ListLabel>Recent</ListLabel>
          <Stagger className='flex flex-col gap-0.5'>
            {recent.map((r, i) => (
              <Item key={r.puuid} index={i}>
                <ListRow as='button' selected={puuid === r.puuid} layoutId='squad-lookup' onClick={() => open(r)}>
                  <span className='relative w-9 h-9 shrink-0 rounded-xl glass-inset flex items-center justify-center text-muted'><FiClock size={14} /></span>
                  <span className='relative min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text'>{r.gameName}<span className='text-[11px] font-normal text-muted'> #{r.tagLine}</span></span>
                </ListRow>
              </Item>
            ))}
          </Stagger>
          <button onClick={clear} className='mt-2 mx-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-bad transition-colors'><FiX size={12} /> Clear recent searches</button>
        </>
      ) : <p className='px-3 py-6 text-center text-[12px] text-muted leading-relaxed'>Players you look up show up here for one click access.</p>}
    </Pane>
  )

  return (
    <Page title='Lookup' subtitle='Any player by Riot ID: rank, peak, level and recent matches' bodyClassName={SPLIT_BODY}>
      <RequireRiot>
        <SplitView list={list} listWidth={300}>
          {puuid ? <Profile key={puuid} puuid={puuid} />
            : <Empty icon={FiUser} className='h-full' title='Look up a player' hint="Type any Riot ID to see their rank, peak, act history and recent matches." />}
        </SplitView>
      </RequireRiot>
    </Page>
  )
}
