import { For, createEffect, createSignal, on, Show, createMemo } from 'solid-js'
import { st } from '../lib/st.js'
import { FiLock, FiCheck, FiRefreshCw } from 'solid-icons/fi'
import { Page, Card, Heading, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, Swap, Stagger, Item, cx } from '../ui'
import { useInvoke } from '../lib/ipc'
import { useTiers } from '../lib/content'
import { prefersReducedMotion } from '../lib/theme'
import { useCatalog, pickPass, rewardItem, fmt } from './dashboard/catalog'
import { formOf } from './dashboard/Cards'
import RrChart from './dashboard/RrChart'
import { CareerBar, StatCell, StatStrip } from './history/career'

const bar = (v, max) => Math.min(100, Math.max(0, max ? v / max * 100 : 0))
const signed = n => (n > 0 ? '+' : '') + n

// progress bar that fills by transform (scaleX), not width
function Progress(props) {
  return (
    <div class={'h-2 rounded-full glass-inset overflow-hidden ' + (props["class"] ?? '')}>
      <div class='h-full w-full rounded-full bg-gradient-to-r from-accent-2 to-accent origin-left transition-transform duration-1000 ease-out' style={st({ transform: `scaleX(${props.value / 100})` })} />
    </div>
  )
}

function RewardTile(props) {
  
    const item = () => (rewardItem(props.cat, props.reward))
    const label = () => (item()?.name || props.reward?.type?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Reward')
    return (<div data-current={props.current ? 1 : undefined}
      class={cx('group relative shrink-0 w-[128px] rounded-2xl p-3 transition-[transform,opacity,border-color] duration-300 ease-out hover:-translate-y-1',
        props.current ? 'accent-soft accent-glow' : props.free ? 'border border-dashed border-line' : 'glass-inset', !props.unlocked && 'opacity-55 hover:opacity-100')}>
      <div class='flex items-center justify-between text-[10.5px] font-semibold tabular-nums text-muted'>
        <span class={cx(props.current && 'text-accent')}>{props.tier != null ? `Tier ${props.tier}` : 'Free'}</span>
        {props.unlocked ? <FiCheck class='text-good' /> : <FiLock />}
      </div>
      <div class='h-[76px] flex items-center justify-center'>
        {item()?.icon ? <img decoding='async' src={item().icon} alt='' loading='lazy' class={cx('max-h-16 max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-110', item().kind === 'currency' && 'mono-icon')} />
          : <span class='rounded-full glass-inset px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted'>{item()?.kind || props.reward?.type || 'reward'}</span>}
      </div>
      <div class='mt-1 truncate text-[11px] font-semibold text-text text-center' title={label()}>{label()}{props.reward?.amount > 1 ? ` x${fmt(props.reward.amount)}` : ''}</div>
    </div>)
  
}

function BattlePass(props) {
  const scroller = { current: null }
  createEffect(on(() => [props.cat], () => {
    const el = scroller.current?.querySelector('[data-current]')
    if (el && scroller.current) scroller.current.scrollTo({ left: el.offsetLeft - 160, behavior: prefersReducedMotion() ? 'auto' : 'smooth' })
  }))
  
    const __d0 = createMemo(() => {
    let n = 0
    const chapters = props.pass.chapters.map(ch => ({ ...ch, levels: ch.levels.map(l => ({ ...l, tier: ++n })) }))
    const flat = chapters.flatMap(c => c.levels)
    return { chapters, flat, nextXp: flat[props.pass.progressionLevel]?.xp }
  }), chapters = () => __d0()?.chapters, flat = () => __d0()?.flat, nextXp = () => __d0()?.nextXp
    const tier = () => (props.pass.progressionLevel)
    return (<Card class='relative overflow-hidden !rounded-3xl p-7'>
      <span class='halo w-96 h-96 -left-24 -top-40' />
      <div class='relative flex flex-wrap items-end justify-between gap-6 mb-6'>
        <div class='min-w-0'>
          <div class='eyebrow'>Active battle pass</div>
          <div class='display mt-2.5 text-[34px] text-text truncate'>{props.pass.name}</div>
        </div>
        <div class='flex items-end gap-8'>
          <div>
            <div class='eyebrow !text-[10px]'>Tier</div>
            <div class='display mt-2 text-[44px] tabular-nums text-text'>{tier()}<span class='text-[16px] font-semibold tracking-normal text-muted'> / {flat().length}</span></div>
          </div>
          <div class='w-60 pb-1'>
            <div class='flex justify-between text-[11px] font-medium text-muted mb-1.5'>
              <span>Next tier</span><span class='tabular-nums'>{nextXp() ? `${fmt(props.pass.towardsNext)} / ${fmt(nextXp())} XP` : 'Max'}</span>
            </div>
            <Progress value={nextXp() ? bar(props.pass.towardsNext, nextXp()) : 100} />
          </div>
        </div>
      </div>
      <div ref={el => (scroller.current = el)} class='relative overflow-x-auto pt-1 pb-3 -mx-1 px-1'>
        <div class='flex gap-7 w-max'>
          <For each={chapters()}>{(ch, ci) => (
            <div class='shrink-0'>
              <div class='eyebrow !text-[10px] mb-3'>{ch.isEpilogue ? 'Epilogue' : `Chapter ${ci() + 1}`}</div>
              <div class='flex gap-2.5'>
                <For each={ch.levels}>{l => <RewardTile tier={l.tier} reward={l.reward} cat={props.cat} unlocked={l.tier <= tier()} current={l.tier === tier()} />}</For>
                {ch.freeRewards.length > 0 && <div class='w-px bg-line mx-1.5 my-2' />}
                <For each={ch.freeRewards}>{(r, i) => <RewardTile reward={r} cat={props.cat} free unlocked={ch.levels[ch.levels.length - 1].tier <= tier()} />}</For>
              </div>
            </div>
          )}</For>
        </div>
      </div>
    </Card>)
  
}

function Contracts(props) {
  
    
    return (<Show when={!(!props.contracts.length)} fallback={<Empty title={props.empty} hint='Contracts show up here once you start progressing them.' />}><Stagger class='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
      {props.contracts.map((c, i) => {
        const agent = c.agentId && props.cat?.items.get(c.agentId)
        const total = c.chapters.reduce((n, ch) => n + ch.levels.length, 0)
        const pct = bar(c.progressionLevel, total)
        return (
          <Item index={i}>
            <Card class={cx('relative overflow-hidden p-5 flex items-center gap-4', pct >= 100 && 'accent-glow')}>
              <div class='w-14 h-14 rounded-2xl glass-inset overflow-hidden shrink-0 flex items-center justify-center'>
                {agent?.icon && <img decoding='async' src={agent.icon} alt='' class='w-full h-full object-cover' />}
              </div>
              <div class='min-w-0 flex-1'>
                <div class='flex items-center justify-between gap-2'>
                  <span class='truncate text-[14px] font-semibold tracking-tight text-text'>{agent?.name || c.name}</span>
                  <Badge tone={pct >= 100 ? 'good' : 'neutral'}>{c.progressionLevel}/{total}</Badge>
                </div>
                <Progress value={pct} class='mt-3' />
                <div class='mt-1.5 text-[11px] text-muted tabular-nums'>{pct >= 100 ? 'Complete' : `${Math.round(pct)}% unlocked`}</div>
              </div>
            </Card>
          </Item>
        )
      })}
    </Stagger></Show>)
  
}

function Account(props) {
  
    const a = () => (props.account.data)
    
    
    const maxXp = () => (Math.max(...a().history.map(h => h.xp), 1))
    return (<Show when={!(props.account.error && !a())} fallback={<Card class='p-6 h-full'><ErrorState error={props.account.error} onRetry={props.account.reload} /></Card>}><Show when={!(!a())} fallback={<Skeleton class='h-full min-h-[300px] rounded-2xl' />}><Card class='p-6 h-full flex flex-col'>
      <Heading hint='XP earned per match' right={<Badge tone='accent'>{fmt(a().xp)} XP</Badge>}>Account</Heading>
      <div class='flex items-baseline gap-2'>
        <span class='display text-[64px] tabular-nums text-text'>{a().level}</span>
        <span class='text-[13px] font-semibold text-muted'>Level</span>
      </div>
      <div class='mt-auto pt-6 flex items-end gap-1.5 h-28'>
        <For each={a().history.slice().reverse()}>{(h, i) => (
          <div class='flex-1 h-full flex items-end' title={`${fmt(h.xp)} XP`}>
            <div class='w-full rounded-md bg-gradient-to-t from-accent/40 to-accent-2 opacity-80 hover:opacity-100 transition-opacity origin-bottom anim-rise'
              style={st({ height: Math.max(6, bar(h.xp, maxXp())) + '%', animationDelay: `${Math.min(i(), 12) * 30}ms` })} />
          </div>
        )}</For>
      </div>
    </Card></Show></Show>)
  
}

const TABS = [{ value: 'overview', label: 'Overview' }, { value: 'pass', label: 'Battle pass' }, { value: 'contracts', label: 'Contracts' }]

function ProgressionBody(props) {
  const catA = useCatalog()
  const tiersA = useTiers()
  const contracts = useInvoke('progression:contracts', [])
  const account = useInvoke('progression:account')
  const rr = useInvoke('progression:rrHistory', [20])
  const [tabS, setTab] = createSignal('overview')
  
    const list = () => (contracts.data?.contracts || [])
    const pass = () => (pickPass(list()))
    const agents = () => (list().filter(c => c.type === 'Agent'))
    const others = () => (list().filter(c => c.type !== 'Agent' && c !== pass()))
    const reload = () => { contracts.reload(); account.reload(); rr.reload() }
    const f = () => (formOf(rr.data))
    const last = () => (rr.data?.[rr.data.length - 1])
    const best = () => (rr.data?.length ? rr.data.reduce((a, r) => (r.ladder > a.ladder ? r : a)) : null)
    const flatLen = () => (pass() ? pass().chapters.reduce((n, c) => n + c.levels.length, 0) : 0)
    const passBlock = () => (contracts.error && !contracts.data ? <ErrorState error={contracts.error} onRetry={contracts.reload} />
    : !contracts.data ? <Skeleton class='h-72 rounded-3xl' />
      : pass() ? <BattlePass pass={pass()} cat={catA()} /> : <Empty title='No active battle pass' />)
    return (<Page title='Progression' subtitle='Battle pass, contracts, account level and ranked trend'
      actions={<Button icon={FiRefreshCw} onClick={reload}>Refresh</Button>}>
      <CareerBar tabs={TABS} value={tabS()} onChange={setTab} layoutId='career-progression'
        right={pass() && <><Badge tone='accent'>Tier {pass().progressionLevel}</Badge><span>{agents().length} agent contracts</span></>} />

      <StatStrip loading={!rr.data && !account.data}>
        <StatCell label='Current rank' class='min-w-[200px]' sub={last() ? `${last().rrAfter} RR` : 'no ranked games'}>
          <div class='flex items-center gap-2.5 mt-2'>
            {last() && tiersA()?.[last().tierAfter] && <img decoding='async' src={tiersA()[last().tierAfter].smallIcon} alt='' class='w-8 h-8' />}
            <span class='font-display text-[20px] font-750 tracking-tight leading-none truncate'>{last() ? tiersA()?.[last().tierAfter]?.tierName || '-' : '-'}</span>
          </div>
        </StatCell>
        <StatCell label='Net RR' value={f().games ? signed(f().net) : '-'} sub={f().games ? `last ${f().games} ranked` : ''} tone={f().net > 0 ? 'good' : f().net < 0 ? 'bad' : undefined} />
        <StatCell label='Win rate' value={f().rate != null ? f().rate + '%' : '-'} sub={f().games ? `${f().wins}W ${f().games - f().wins}L` : ''} />
        <StatCell label='Best ladder' value={best() ? `${best().rrAfter} RR` : '-'} sub={best() ? tiersA()?.[best().tierAfter]?.tierName : ''} />
        <StatCell label='Account level' value={account.data?.level ?? '-'} sub={account.data ? `${fmt(account.data.xp)} XP` : ''} />
        <StatCell label='Battle pass' value={pass() ? pass().progressionLevel : '-'} sub={pass() ? `of ${flatLen()} tiers` : 'none active'} tone='accent' />
      </StatStrip>

      <Swap id={tabS()}>
        {tabS() === 'overview' && (
          <div class='space-y-5'>
            <div class='grid grid-cols-1 xl:grid-cols-3 gap-5'>
              <Card class='p-6 xl:col-span-2'>
                <Heading hint={rr.data?.length ? `Last ${rr.data.length} ranked games` : 'Ranked games'}>Competitive trend</Heading>
                {rr.error && !rr.data ? <ErrorState error={rr.error} onRetry={rr.reload} />
                  : !rr.data ? <Skeleton class='h-56 rounded-2xl' />
                    : rr.data.length < 2 ? <Empty title='Not enough ranked games' hint='Play a couple of competitive matches to see your RR trend.' />
                      : <RrChart rows={rr.data} />}
              </Card>
              <Account account={account} />
            </div>
            {passBlock()}
          </div>
        )}
        {tabS() === 'pass' && passBlock()}
        {tabS() === 'contracts' && (
          <div class='space-y-8'>
            <section>
              <Heading hint='Agent recruitment and contract progress'>Agent contracts</Heading>
              {!contracts.data ? <Skeleton class='h-24 rounded-2xl' /> : <Contracts contracts={agents()} cat={catA()} empty='No agent contracts yet' />}
            </section>
            {others().length > 0 && (
              <section>
                <Heading>Event contracts</Heading>
                <Contracts contracts={others()} cat={catA()} empty='No event contracts' />
              </section>
            )}
          </div>
        )}
      </Swap>
    </Page>)
  
}

export default function Progression(props) {
  return <RequireRiot><ProgressionBody active={props.active !== false} /></RequireRiot>
}
