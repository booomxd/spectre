import { For, createEffect, createSignal, on, Show, createMemo } from 'solid-js'
import { st } from '../lib/st.js'
import { FiAward, FiSearch } from 'solid-icons/fi'
import { invoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { Badge, Button, Card, Empty, ErrorState, Input, Item, Page, RequireRiot, Skeleton, Stagger, pressable } from '../ui'
import { TierIcon, cx, useCards, openPlayer } from './history/shared'
import { CareerBar, StatCell, StatStrip } from './history/career'

const COLS = 'grid-cols-[64px_minmax(0,1fr)_170px_80px_72px]'
const SIZE = 100
const TABS = [{ value: 'all', label: 'Everyone' }, { value: 'known', label: 'Friends & party' }]

const isSecret = p => p.anonymous || !p.gameName

function Name(props) {
  
    
    return (<Show when={!(isSecret(props.p))} fallback={<span class='text-muted italic'>Secret Agent</span>}><>{props.p.prefix && <span class='text-muted'>{props.p.prefix} </span>}{props.p.gameName}<span class='text-muted'>#{props.p.tagLine}</span></></Show>)
  
}

function Entry(props) {
  
    const art = () => (props.cards[props.p.cardId]?.smallArt || props.cards[props.p.cardId]?.displayIcon)
    const secret = () => (isSecret(props.p))
    const link = () => (!secret() && props.p.puuid)
    return (<div style={st({ '--i': props.index })} {...pressable(link() ? () => openPlayer(props.p) : null)}
      class={cx('grid items-center gap-3 px-6 h-[56px] text-[13px] transition-colors', COLS,
        props.sticky ? 'bg-panel/95 border-t border-accent/40 shadow-[0_-12px_30px_-16px_rgb(var(--accent)/0.5)]' : 'border-b border-line last:border-b-0',
        link() && 'cursor-pointer', link() && props.p.puuid !== props.me && 'hover:bg-surface-2', props.p.puuid === props.me && !props.sticky && 'accent-soft')}>
      <span class={cx('font-display text-[18px] font-bold tracking-tight tabular-nums', props.p.rank === 1 ? 'text-warn' : props.p.rank <= 3 ? 'text-text' : 'text-muted')}>#{props.p.rank}</span>
      <div class='flex items-center gap-3 min-w-0'>
        <div class='w-10 h-10 rounded-xl glass-inset overflow-hidden shrink-0'>
          {art() && <img decoding='async' src={art()} alt='' loading='lazy' class='w-full h-full object-cover' draggable={false} />}
        </div>
        <span class='truncate font-semibold'><Name p={props.p} /></span>
        {props.p.puuid === props.me && <Badge tone='accent'>You</Badge>}
        {props.p.known && props.p.puuid !== props.me && <Badge>{props.p.friend ? 'Friend' : 'Party'}</Badge>}
        {props.p.banned && <Badge tone='bad'>Banned</Badge>}
      </div>
      <TierIcon tier={props.p.tier} size={26} showName />
      <span class='font-display text-[15px] font-bold tracking-tight tabular-nums'>{props.p.rr}</span>
      <span class='text-muted tabular-nums'>{props.p.wins}</span>
    </div>)
  
}

// top three as tall cards
function Podium(props) {
  
    const order = () => ([props.top[1], props.top[0], props.top[2]].filter(Boolean))
    return (<Stagger class='grid grid-cols-3 gap-4 mb-5 items-end'>
      <For each={order()}>{(p, i) => {
        const first = () => (p.rank === 1)
        const art = () => (props.cards[p.cardId]?.wideArt || props.cards[p.cardId]?.largeArt)
        const link = () => (!isSecret(p) && p.puuid)
        return (
          <Item index={i()}>
            <Card hover={!!link()} glow={first()} onClick={() => link() && openPlayer(p)} class={cx('relative overflow-hidden', first() ? 'h-[190px] !rounded-3xl' : 'h-[160px]')}>
              {art() && <img decoding='async' src={art()} alt='' loading='lazy' draggable={false} class='absolute inset-0 w-full h-full object-cover opacity-45' />}
              <div class='absolute inset-0 bg-gradient-to-t from-bg via-bg/70 to-bg/20' />
              {first() && <span class='halo w-72 h-72 -top-36 left-1/2 -translate-x-1/2' />}
              <div class='relative h-full p-5 flex flex-col justify-between'>
                <div class='flex items-center justify-between'>
                  <span class={cx('display tabular-nums', first() ? 'text-[44px] text-warn' : 'text-[34px] text-text')}>#{p.rank}</span>
                  <TierIcon tier={p.tier} size={first() ? 40 : 32} />
                </div>
                <div class='min-w-0'>
                  <div class='truncate text-[15px] font-semibold tracking-tight text-text'><Name p={p} /></div>
                  <div class='mt-1 flex items-center gap-2 text-[12px] text-muted tabular-nums'>
                    <span class='font-display font-bold text-text'>{p.rr} RR</span><span>{p.wins} wins</span>
                    {p.puuid === props.me && <Badge tone='accent'>You</Badge>}
                  </div>
                </div>
              </div>
            </Card>
          </Item>
        )
      }}</For>
    </Stagger>)
  
}

function Content() {
  const riotA = useRiot()
  const cardsA = useCards()
  const [dataS, setData] = createSignal(null)
  const [playersS, setPlayers] = createSignal([])
  const [errorS, setError] = createSignal(null)
  const [moreS, setMore] = createSignal(false)
  const [qS, setQ] = createSignal('')
  const [tabS, setTab] = createSignal('all')
  createEffect(on(() => [riotA().connected], () => { if (riotA().connected) load(0) }))
  
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
    const filtered = createMemo(() => {
    const t = qS().trim().toLowerCase()
    let list = tabS() === 'known' ? playersS().filter(p => p.known || p.puuid === riotA().puuid) : playersS()
    if (t) list = list.filter(p => !p.anonymous && `${p.gameName}#${p.tagLine}`.toLowerCase().includes(t))
    return list
  })
    const mine = () => (playersS().find(p => p.puuid === riotA().puuid))
    const you = () => (mine() || (dataS()?.you && { ...dataS().you, puuid: riotA().puuid, cardId: null, gameName: riotA().gameName, tagLine: riotA().tagLine, anonymous: false }))
    const podium = () => (!qS().trim() && tabS() === 'all' && playersS().length >= 3)
    
    
    return (<Show when={!(errorS() && !dataS())} fallback={<ErrorState error={errorS()} onRetry={() => load(0)} />}><Show when={!(!dataS())} fallback={<div class='flex flex-col gap-2'><Skeleton class='h-[98px] rounded-2xl mb-3' />{Array.from({ length: 10 }, (_, i) => <Skeleton class='h-[56px] rounded-xl' />)}</div>}><>
      <CareerBar tabs={TABS} value={tabS()} onChange={setTab} layoutId='career-leaderboard'
        right={(
          <div class='relative w-64'>
            <FiSearch class='absolute left-4 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' />
            <Input class='pl-10 !rounded-full' value={qS()} onInput={e => setQ(e.target.value)} placeholder='Search loaded players' />
          </div>
        )} />

      <StatStrip>
        <StatCell label='Your position' value={you() ? `#${you().rank.toLocaleString()}` : '-'} sub={you() ? 'this act' : 'not on the board yet'} tone={you() ? 'accent' : undefined} />
        <StatCell label='Your RR' value={you() ? you().rr : '-'} sub={you() ? `${you().wins} wins` : ''} />
        <StatCell label='Top RR' value={playersS()[0]?.rr ?? '-'} sub='rank #1' />
        <StatCell label='Ranked players' value={dataS().total.toLocaleString()} sub={`${playersS().length} loaded`} />
        <StatCell label='Season' sub={dataS().shard.toUpperCase()}>
          <div class='mt-2.5'><Badge tone='accent'>{dataS().season.name}</Badge></div>
        </StatCell>
      </StatStrip>

      {podium() && <Podium top={playersS().slice(0, 3)} cards={cardsA()} me={riotA().puuid} />}

      <Card class='overflow-hidden anim-rise'>
        <div class={cx('grid gap-3 px-6 h-11 items-center border-b border-line eyebrow !text-[10px]', COLS)}>
          <span>Rank</span><span>Player</span><span>Tier</span><span>RR</span><span>Wins</span>
        </div>
        <div class='stagger'>
          {filtered().length ? filtered().map((p, i) => <Entry p={p} cards={cardsA()} me={riotA().puuid} index={Math.min(i, 12)} />)
            : <Empty icon={FiAward} title='No players match' hint={tabS() === 'known' ? 'No friends or party members in the loaded range. Load more to widen it.' : 'Search only covers the players loaded so far. Load more to widen it.'} />}
        </div>
        {you() && (
          <div class='sticky bottom-0 z-10'>
            <Entry p={you()} cards={cardsA()} me={riotA().puuid} sticky />
          </div>
        )}
      </Card>

      {!you() && <p class='mt-4 text-[12px] text-muted text-center'>You are not on this act&apos;s leaderboard yet.</p>}
      {playersS().length < dataS().total && (
        <div class='flex justify-center mt-6'>
          <Button loading={moreS()} onClick={() => load(playersS().length)}>Load more</Button>
        </div>
      )}
      {errorS() && <p class='mt-4 text-[12px] text-bad text-center'>{errorS()}</p>}
    </></Show></Show>)
  
}

export default function Leaderboard() {
  return (
    <Page title='Leaderboard' subtitle='Top competitive players in your region this act'>
      <RequireRiot><Content /></RequireRiot>
    </Page>
  )
}
