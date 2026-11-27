import { For, createEffect, createSignal, on, Show } from 'solid-js'
import { FiArrowRight, FiClock, FiSearch, FiUser, FiX } from 'solid-icons/fi'
import { invoke, useInvoke } from '../lib/ipc'
import { contentPath, useContent, useTiers } from '../lib/content'
import { Badge, Button, Card, Empty, ErrorState, FadeIn, Heading, Item, Page, RequireRiot, Skeleton, Stagger, toast } from '../ui'
import { ListLabel, ListRow, Pane, SPLIT_BODY, SplitView } from './friends/Layout'
import HistoryPanel from './history/HistoryPanel'
import { MemoForm } from './history/MemoEditor'
import { TierIcon, cx, kd, seasonName, useSeasons } from './history/shared'

function RankBlock(props) {
  return (
    <div class='glass glass-blur flex items-center gap-3.5 rounded-2xl px-4 py-3 min-w-[190px]'>
      <TierIcon tier={props.tier} size={44} />
      <div>
        <div class='text-[12px] font-medium text-muted'>{props.label}</div>
        <div class='font-display text-lg font-bold tracking-tight leading-tight'><TierName tier={props.tier} />{props.rr != null && props.tier ? <span class='text-muted text-sm font-semibold tabular-nums'> {props.rr} RR</span> : null}</div>
        {props.sub && <div class='text-[11px] text-muted'>{props.sub}</div>}
      </div>
    </div>
  )
}
function TierName({ tier }) {
  const tiers = useTiers()
  return tier && tiers?.[tier] ? tiers[tier].tierName : 'Unranked'
}

function ScoutStats(props) {
  
    const r = () => (props.scout.data?.recent)
    const stat = (label, value, sub) => (
    <div class='flex-1 min-w-[120px] px-5 py-4 first:pl-6'>
      <div class='eyebrow'>{label}</div>
      <div class='font-display text-[30px] font-bold tracking-tight leading-tight tabular-nums mt-1.5'>{value}</div>
      {sub && <div class='text-[11px] text-muted tabular-nums'>{sub}</div>}
    </div>
  )
    
    
    return (<Show when={!(props.scout.loading && !props.scout.data)} fallback={<Skeleton class='h-[104px] rounded-3xl' />}><Show when={!(!r())} fallback={null}><Card class='rounded-3xl flex flex-wrap divide-x divide-line'>
      {stat('Headshot %', r().hs != null ? `${r().hs}%` : '-', `last ${r().matches} competitive`)}
      {stat('K/D', kd(r().kills, r().deaths), `${r().kills} / ${r().deaths}`)}
      {r().team > 0 && stat('Recent win rate', `${Math.round(r().wins / r().team * 100)}%`, `${r().wins}W ${r().team - r().wins}L`)}
    </Card></Show></Show>)
  
}

function ActHistory(props) {
  const tiersA = useTiers()
  
    
    
    const start = id => Date.parse(props.seasons[id]?.startTime) || 0
    const acts = () => ([...(props.scout.data?.acts || [])].sort((a, b) => start(b.seasonId) - start(a.seasonId)))
    
    const best = () => (Math.max(...acts().map(a => a.peak)))
    const peakAct = () => ([...acts()].reverse().find(a => a.peak === best())?.seasonId)
    return (<Show when={!(props.scout.loading && !props.scout.data)} fallback={<div class='grid gap-2'>{Array.from({ length: 4 }, (_, i) => <Skeleton class='h-[60px] rounded-2xl' />)}</div>}><Show when={!(props.scout.error && !props.scout.data)} fallback={<ErrorState error={props.scout.error} onRetry={props.scout.reload} />}><Show when={!(!acts().length)} fallback={<Empty icon={FiClock} title='No competitive acts' hint='No ranked act data is available for this player.' class='py-8' />}><Stagger class='grid gap-2'>
      {acts().map((a, i) => {
        const wr = Math.round(a.wins / a.games * 100)
        const isPeak = a.seasonId === peakAct()
        return (
          <Item index={i}
            class={cx('flex items-center gap-4 rounded-2xl px-4 py-2.5 min-w-0 overflow-hidden', isPeak ? 'accent-soft' : 'glass')}>
            <div class='w-[64px] shrink-0 font-display text-[13px] font-bold tracking-tight'>{seasonName(props.seasons, a.seasonId) || 'Act'}</div>
            <div class='flex items-center gap-2 w-[150px] shrink-0' title='Final rank'>
              <TierIcon tier={a.tier} size={30} />
              <div class='leading-tight'>
                <div class='text-[12px] font-semibold'>{a.tier ? tiersA()?.[a.tier]?.tierName : 'Unranked'}</div>
                <div class='text-[11px] text-muted'>Final</div>
              </div>
            </div>
            <div class={cx('shrink-0 whitespace-nowrap flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1 border', a.peak ? 'border-accent/30 bg-accent/10' : 'border-line bg-surface-2/60')} title='Act peak'>
              <TierIcon tier={a.peak} size={26} />
              <div class='leading-tight'>
                <div class='text-[12px] font-semibold'>{a.peak ? tiersA()?.[a.peak]?.tierName : '-'}</div>
                <div class='text-[11px] font-medium text-accent'>Act peak</div>
              </div>
            </div>
            {/* the highlighted row already marks the peak act */}
            {isPeak && a.peak > 0 && <Badge tone='accent' class='max-[1200px]:hidden'>All-time peak</Badge>}
            <div class='ml-auto shrink-0 whitespace-nowrap text-right leading-tight'>
              <div class='text-[13px] font-semibold tabular-nums'>{wr}% <span class='text-muted font-normal text-[11px]'>win rate</span></div>
              <div class='text-[11px] text-muted tabular-nums'>{a.wins}W of {a.games} games</div>
            </div>
          </Item>
        )
      })}
    </Stagger></Show></Show></Show>)
  
}

function Profile(props) {
  const scout = useInvoke('search:scout', () => [props.puuid])
  const __invoke = useInvoke('search:profile', () => [props.puuid])
  const memoQ = useInvoke('memo:get', () => [props.puuid])
  const cardA = useContent(() => contentPath('playercards', __invoke.data?.cardId))
  const titleA = useContent(() => contentPath('playertitles', __invoke.data?.titleId))
  const seasonsA = useSeasons()
  
    
    
    const name = () => (__invoke.data.gameName ? `${__invoke.data.gameName}#${__invoke.data.tagLine}` : '')
    const wr = () => (__invoke.data.current?.games ? Math.round(__invoke.data.current.wins / __invoke.data.current.games * 100) : null)
    return (<Show when={!(__invoke.error && !__invoke.data)} fallback={<ErrorState error={__invoke.error} onRetry={__invoke.reload} />}><Show when={!(__invoke.loading && !__invoke.data)} fallback={<Skeleton class='h-[250px] rounded-3xl' />}><FadeIn class='flex flex-col gap-5'>
      <Card class='relative overflow-hidden rounded-3xl min-h-[250px]'>
        {__invoke.data.cardId && cardA()?.wideArt && <img decoding='async' src={cardA().wideArt} alt='' class='absolute inset-0 w-full h-full object-cover' draggable={false} />}
        {/* dark scrim over the card art: the name stays white and legible on every theme */}
        {__invoke.data.cardId && cardA()?.wideArt && <div class='absolute inset-0 bg-gradient-to-t from-black/75 via-black/35 to-black/5' />}
        {!(__invoke.data.cardId && cardA()?.wideArt) && <span class='halo -top-32 -right-24 w-96 h-96' />}
        <div class='relative h-full min-h-[250px] flex flex-col justify-end p-7 gap-4'>
          <div class='flex flex-wrap items-end justify-between gap-4'>
            <div class='min-w-0'>
              <div class='flex items-center gap-2 mb-2.5'>
                {__invoke.data.self && <Badge tone='accent'>You</Badge>}
                {__invoke.data.level != null && <Badge>Level {__invoke.data.level}</Badge>}
                {__invoke.data.leaderboardRank && <Badge tone='warn'>Leaderboard #{__invoke.data.leaderboardRank}</Badge>}
              </div>
              <h2 class={cx('display text-[44px] truncate', __invoke.data.cardId && cardA()?.wideArt ? 'text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.45)]' : 'text-text')}>{name() || 'Hidden player'}</h2>
              {titleA()?.titleText && <div class={cx('text-sm mt-2', __invoke.data.cardId && cardA()?.wideArt ? 'text-white/75' : 'text-muted')}>{titleA().titleText}</div>}
            </div>
            <div class='flex flex-wrap gap-3'>
              <RankBlock label='Current' tier={__invoke.data.current?.tier} rr={__invoke.data.current?.rr}
                sub={__invoke.data.current?.games ? `${__invoke.data.current.wins}W of ${__invoke.data.current.games} games${wr() != null ? ` (${wr()}%)` : ''}` : null} />
              <RankBlock label='Peak' tier={__invoke.data.peak?.tier} sub={seasonName(seasonsA(), __invoke.data.peak?.seasonId)} />
            </div>
          </div>
        </div>
      </Card>

      {__invoke.data.notes.length > 0 && <div class='text-[12px] text-warn'>{__invoke.data.notes.join('. ')}</div>}

      <ScoutStats scout={scout} />

      <div class='grid grid-cols-1 2xl:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start'>
        <div class='flex flex-col gap-6'>
          <div>
            <Heading hint='Final rank and peak for every competitive act'>Act history</Heading>
            <ActHistory scout={scout} seasons={seasonsA()} />
          </div>
          <div>
            <Heading>Recent matches</Heading>
            <HistoryPanel puuid={props.puuid} step={10} />
          </div>
        </div>
        <Card class='p-5 rounded-3xl 2xl:sticky 2xl:top-0'>
          <Heading hint='Only you can see this'>Your note</Heading>
          <MemoForm target={{ puuid: props.puuid, name: name() }} memo={memoQ.data} onSaved={memoQ.reload} onDeleted={memoQ.reload} />
        </Card>
      </div>
    </FadeIn></Show></Show>)
  
}

export default function PlayerSearch(props) {
  const [textS, setText] = createSignal('')
  const [puuidS, setPuuid] = createSignal(props.params?.puuid || null)
  const [busyS, setBusy] = createSignal(false)
  const [searchErrorS, setSearchError] = createSignal(null)
  const __invoke = useInvoke('search:recent')
  createEffect(on(() => [props.params], () => { if (props.params?.puuid) { setPuuid(props.params.puuid); setSearchError(null) } }))
  
    const find = async (value) => {
    if (!value.includes('#')) { setSearchError('Enter a Riot ID like Name#Tag'); return }
    setBusy(true); setSearchError(null)
    try {
      const hit = await invoke('search:lookup', value)
      await invoke('search:pushRecent', { puuid: hit.puuid, gameName: hit.gameName, tagLine: hit.tagLine })
      __invoke.reload(true)
      setPuuid(hit.puuid)
    } catch (e) { setSearchError(e.message) }
    setBusy(false)
  }
    const open = r => { setText(`${r.gameName}#${r.tagLine}`); setPuuid(r.puuid); setSearchError(null); invoke('search:pushRecent', r).then(() => __invoke.reload(true)).catch(() => { }) }
    const clear = async () => { await invoke('search:clearRecent'); __invoke.reload(true); toast('Recent searches cleared') }
    const list = (
    () => (<Pane title='Find a player'
      header={<>
        <form class='flex flex-col gap-2' onSubmit={e => { e.preventDefault(); find(textS().trim()) }}>
          <div class='glass-field flex items-center gap-2 rounded-full pl-4 pr-1 h-11'>
            <FiSearch class='text-muted shrink-0' size={14} />
            <input class='flex-1 min-w-0 bg-transparent outline-none text-[13px] text-text placeholder:text-muted/60' value={textS()} onInput={e => setText(e.target.value)} placeholder='Name#Tag' autofocus />
            <Button type='submit' variant='primary' size='icon' class='!w-9 !h-9 shrink-0' title='Search' loading={busyS()} disabled={!textS().trim()}><FiArrowRight /></Button>
          </div>
        </form>
        {searchErrorS() && <div class='anim-fade mt-2 px-3 text-[12px] text-bad'>{searchErrorS()}</div>}
      </>}>
      {__invoke.data?.length > 0 ? (
        <>
          <ListLabel>Recent</ListLabel>
          <Stagger class='flex flex-col gap-0.5'>
            <For each={__invoke.data}>{(r, i) => (
              <Item index={i()}>
                <ListRow as='button' selected={puuidS() === r.puuid} layoutId='squad-lookup' onClick={() => open(r)}>
                  <span class='relative w-9 h-9 shrink-0 rounded-xl glass-inset flex items-center justify-center text-muted'><FiClock size={14} /></span>
                  <span class='relative min-w-0 flex-1 truncate text-[13.5px] font-semibold text-text'>{r.gameName}<span class='text-[11px] font-normal text-muted'> #{r.tagLine}</span></span>
                </ListRow>
              </Item>
            )}</For>
          </Stagger>
          <button onClick={clear} class='mt-2 mx-2.5 inline-flex items-center gap-1.5 text-[11.5px] font-medium text-muted hover:text-bad transition-colors'><FiX size={12} /> Clear recent searches</button>
        </>
      ) : <p class='px-3 py-6 text-center text-[12px] text-muted leading-relaxed'>Players you look up show up here for one click access.</p>}
    </Pane>)
  )
    return (<Page title='Lookup' subtitle='Any player by Riot ID: rank, peak, level and recent matches' bodyClass={SPLIT_BODY}>
      <RequireRiot>
        <SplitView list={list()} listWidth={300}>
          {puuidS() ? <Profile puuid={puuidS()} />
            : <Empty icon={FiUser} class='h-full' title='Look up a player' hint="Type any Riot ID to see their rank, peak, act history and recent matches." />}
        </SplitView>
      </RequireRiot>
    </Page>)
  
}
