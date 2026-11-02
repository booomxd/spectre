import { useEffect, useState } from 'react'
import { FiClock, FiSearch, FiUser, FiX } from 'react-icons/fi'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent, useTiers } from '../lib/content'
import { Badge, Button, Card, Empty, ErrorState, Input, Page, RequireRiot, SectionTitle, Skeleton, toast } from '../ui'
import HistoryPanel from './history/HistoryPanel'
import { MemoForm } from './history/MemoEditor'
import { TierIcon, cx, kd, seasonName, useSeasons } from './history/shared'

function RankBlock({ label, tier, rr, sub }) {
  return (
    <div className='flex items-center gap-3 rounded-xl bg-bg/60 backdrop-blur border border-line px-4 py-2.5 min-w-[170px]'>
      <TierIcon tier={tier} size={44} />
      <div>
        <div className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>{label}</div>
        <div className='font-display text-lg font-bold leading-tight'><TierName tier={tier} />{rr != null && tier ? <span className='text-muted text-sm font-semibold'> {rr} RR</span> : null}</div>
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
    <div className='min-w-[84px]'>
      <div className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>{label}</div>
      <div className='font-display text-2xl font-bold leading-tight'>{value}</div>
      {sub && <div className='text-[11px] text-muted'>{sub}</div>}
    </div>
  )
  if (scout.loading && !scout.data) return <Skeleton className='h-[74px] rounded-xl' />
  if (!r) return null
  return (
    <Card className='anim-rise p-4 flex flex-wrap items-center gap-x-8 gap-y-3'>
      {stat('Headshot %', r.hs != null ? `${r.hs}%` : '-', `last ${r.matches} competitive`)}
      {stat('K/D', kd(r.kills, r.deaths), `${r.kills} / ${r.deaths}`)}
      {r.team > 0 && stat('Recent win rate', `${Math.round(r.wins / r.team * 100)}%`, `${r.wins}W ${r.team - r.wins}L`)}
    </Card>
  )
}

function ActHistory({ scout, seasons }) {
  const tiers = useTiers()
  if (scout.loading && !scout.data) return <div className='grid gap-2'>{Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className='h-14 rounded-xl' />)}</div>
  if (scout.error && !scout.data) return <ErrorState error={scout.error} onRetry={scout.reload} />
  const start = id => Date.parse(seasons[id]?.startTime) || 0
  const acts = [...(scout.data?.acts || [])].sort((a, b) => start(b.seasonId) - start(a.seasonId))
  if (!acts.length) return <Empty icon={FiClock} title='No competitive acts' hint='No ranked act data is available for this player.' className='py-8' />
  // All-time peak act: highest peak, earliest act to reach it.
  const best = Math.max(...acts.map(a => a.peak))
  const peakAct = [...acts].reverse().find(a => a.peak === best)?.seasonId
  return (
    <div className='grid gap-2 stagger'>
      {acts.map((a, i) => {
        const wr = Math.round(a.wins / a.games * 100)
        const isPeak = a.seasonId === peakAct
        return (
          <div key={a.seasonId} style={{ '--i': Math.min(i, 12) }}
            className={cx('anim-rise flex items-center gap-3 rounded-xl border bg-surface px-3 py-2', isPeak ? 'border-accent/50' : 'border-line')}>
            <div className='w-[64px] shrink-0 text-[12px] font-semibold'>{seasonName(seasons, a.seasonId) || 'Act'}</div>
            <div className='flex items-center gap-1.5 w-[150px] shrink-0' title='Final rank'>
              <TierIcon tier={a.tier} size={30} />
              <div className='leading-tight'>
                <div className='text-[12px] font-semibold'>{a.tier ? tiers?.[a.tier]?.tierName : 'Unranked'}</div>
                <div className='text-[10px] uppercase tracking-wider text-muted'>Final</div>
              </div>
            </div>
            <div className={cx('flex items-center gap-1.5 rounded-lg px-2 py-1 border', a.peak ? 'border-accent/40 bg-accent/10' : 'border-line')} title='Act peak'>
              <TierIcon tier={a.peak} size={26} />
              <div className='leading-tight'>
                <div className='text-[12px] font-semibold'>{a.peak ? tiers?.[a.peak]?.tierName : '-'}</div>
                <div className='text-[10px] uppercase tracking-wider text-accent'>Act peak</div>
              </div>
            </div>
            {isPeak && a.peak > 0 && <Badge tone='accent'>All-time peak</Badge>}
            <div className='ml-auto text-right leading-tight'>
              <div className='text-[13px] font-semibold'>{wr}% <span className='text-muted font-normal text-[11px]'>win rate</span></div>
              <div className='text-[11px] text-muted'>{a.wins}W of {a.games} games</div>
            </div>
          </div>
        )
      })}
    </div>
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
  if (loading && !data) return <Skeleton className='h-52 rounded-2xl' />
  const name = data.gameName ? `${data.gameName}#${data.tagLine}` : ''
  const wr = data.current?.games ? Math.round(data.current.wins / data.current.games * 100) : null

  return (
    <div className='flex flex-col gap-5'>
      <Card className='anim-rise relative overflow-hidden min-h-[210px]'>
        {data.cardId && card?.wideArt && <img src={card.wideArt} alt='' className='absolute inset-0 w-full h-full object-cover' draggable={false} />}
        <div className='absolute inset-0 bg-gradient-to-t from-surface via-surface/60 to-surface/10' />
        <div className='relative h-full min-h-[210px] flex flex-col justify-end p-5 gap-4'>
          <div className='flex flex-wrap items-end justify-between gap-4'>
            <div className='min-w-0'>
              <div className='flex items-center gap-2 mb-1.5'>
                {data.self && <Badge tone='accent'>You</Badge>}
                {data.level != null && <Badge>Level {data.level}</Badge>}
                {data.leaderboardRank && <Badge tone='warn'>Leaderboard #{data.leaderboardRank}</Badge>}
              </div>
              <h2 className='font-display text-4xl font-bold uppercase leading-none truncate'>{name || 'Hidden player'}</h2>
              {title?.titleText && <div className='text-sm text-muted mt-1.5'>{title.titleText}</div>}
            </div>
            <div className='flex flex-wrap gap-3'>
              <RankBlock label='Current' tier={data.current?.tier} rr={data.current?.rr}
                sub={data.current?.games ? `${data.current.wins}W of ${data.current.games} games${wr != null ? ` (${wr}%)` : ''}` : null} />
              <RankBlock label='Peak' tier={data.peak?.tier} sub={seasonName(seasons, data.peak?.seasonId)} />
            </div>
          </div>
        </div>
      </Card>

      {data.notes.length > 0 && <div className='text-xs text-warn'>{data.notes.join('. ')}</div>}

      <ScoutStats scout={scout} />

      <div className='grid grid-cols-1 xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start'>
        <div className='flex flex-col gap-6'>
          <div>
            <SectionTitle>Act history</SectionTitle>
            <ActHistory scout={scout} seasons={seasons} />
          </div>
          <div>
          <SectionTitle>Recent matches</SectionTitle>
          <HistoryPanel puuid={puuid} step={10} />
          </div>
        </div>
        <Card className='p-4 xl:sticky xl:top-0'>
          <SectionTitle>Note</SectionTitle>
          <MemoForm target={{ puuid, name }} memo={memo} onSaved={reloadMemo} onDeleted={reloadMemo} />
        </Card>
      </div>
    </div>
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

  return (
    <Page title='Player Search' subtitle='Look up any player by Riot ID: rank, peak, level and recent matches'>
      <RequireRiot>
        <form className='flex gap-2 max-w-xl' onSubmit={e => { e.preventDefault(); find(text.trim()) }}>
          <div className='relative flex-1'>
            <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
            <Input className='pl-9' value={text} onChange={e => setText(e.target.value)} placeholder='Name#Tag' autoFocus />
          </div>
          <Button type='submit' variant='primary' loading={busy} disabled={!text.trim()}>Search</Button>
        </form>
        {searchError && <div className='anim-fade mt-2 text-xs text-bad'>{searchError}</div>}

        {recent?.length > 0 && (
          <div className='flex flex-wrap items-center gap-1.5 mt-3'>
            <FiClock className='text-muted text-xs mr-1' />
            {recent.map(r => (
              <button key={r.puuid} onClick={() => open(r)}
                className={cx('h-7 px-3 rounded-full border text-xs font-semibold transition-all active:scale-95',
                  puuid === r.puuid ? 'border-accent/50 bg-accent/15 text-accent' : 'border-line bg-surface-2 text-muted hover:text-text hover:border-accent/30')}>
                {r.gameName}<span className='opacity-60'>#{r.tagLine}</span>
              </button>
            ))}
            <button title='Clear recent searches' onClick={clear} className='w-7 h-7 rounded-full text-muted hover:text-bad transition-colors flex items-center justify-center'><FiX /></button>
          </div>
        )}

        <div className='mt-6'>
          {puuid ? <Profile key={puuid} puuid={puuid} />
            : <Empty icon={FiUser} title='Search for a player' hint="Type any Riot ID above to see their rank, peak and recent matches." />}
        </div>
      </RequireRiot>
    </Page>
  )
}
