import { useEffect, useMemo, useRef, useState } from 'react'
import { FiLock, FiCheck, FiRefreshCw } from 'react-icons/fi'
import { Page, Card, Heading, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot, Swap, Stagger, Item, cx } from '../ui'
import { useInvoke } from '../lib/ipc'
import { useTiers } from '../lib/content'
import { useCatalog, pickPass, rewardItem, fmt } from './dashboard/catalog'
import { formOf } from './dashboard/Cards'
import RrChart from './dashboard/RrChart'
import { CareerBar, StatCell, StatStrip } from './history/career'

const bar = (v, max) => Math.min(100, Math.max(0, max ? v / max * 100 : 0))
const signed = n => (n > 0 ? '+' : '') + n

// Progress bar that fills by transform (scaleX), not width.
function Progress({ value, className = '' }) {
  return (
    <div className={'h-2 rounded-full glass-inset overflow-hidden ' + className}>
      <div className='h-full w-full rounded-full bg-gradient-to-r from-accent-2 to-accent origin-left transition-transform duration-1000 ease-out' style={{ transform: `scaleX(${value / 100})` }} />
    </div>
  )
}

function RewardTile({ tier, reward, cat, unlocked, free, current }) {
  const item = rewardItem(cat, reward)
  const label = item?.name || reward?.type?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Reward'
  return (
    <div data-current={current ? 1 : undefined}
      className={cx('group relative shrink-0 w-[128px] rounded-2xl p-3 transition-[transform,opacity,border-color] duration-300 ease-out hover:-translate-y-1',
        current ? 'accent-soft accent-glow' : free ? 'border border-dashed border-line' : 'glass-inset', !unlocked && 'opacity-55 hover:opacity-100')}>
      <div className='flex items-center justify-between text-[10.5px] font-semibold tabular-nums text-muted'>
        <span className={cx(current && 'text-accent')}>{tier != null ? `Tier ${tier}` : 'Free'}</span>
        {unlocked ? <FiCheck className='text-good' /> : <FiLock />}
      </div>
      <div className='h-[76px] flex items-center justify-center'>
        {item?.icon ? <img src={item.icon} alt='' loading='lazy' className={cx('max-h-16 max-w-full object-contain transition-transform duration-300 ease-out group-hover:scale-110', item.kind === 'currency' && 'mono-icon')} />
          : <span className='rounded-full glass-inset px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted'>{item?.kind || reward?.type || 'reward'}</span>}
      </div>
      <div className='mt-1 truncate text-[11px] font-semibold text-text text-center' title={label}>{label}{reward?.amount > 1 ? ` x${fmt(reward.amount)}` : ''}</div>
    </div>
  )
}

function BattlePass({ pass, cat }) {
  const scroller = useRef(null)
  const { chapters, flat, nextXp } = useMemo(() => {
    let n = 0
    const chapters = pass.chapters.map(ch => ({ ...ch, levels: ch.levels.map(l => ({ ...l, tier: ++n })) }))
    const flat = chapters.flatMap(c => c.levels)
    return { chapters, flat, nextXp: flat[pass.progressionLevel]?.xp }
  }, [pass])
  const tier = pass.progressionLevel

  useEffect(() => {
    const el = scroller.current?.querySelector('[data-current]')
    if (el && scroller.current) scroller.current.scrollTo({ left: el.offsetLeft - 160, behavior: 'smooth' })
  }, [cat])

  return (
    <Card className='relative overflow-hidden !rounded-3xl p-7'>
      <span className='halo w-96 h-96 -left-24 -top-40' />
      <div className='relative flex flex-wrap items-end justify-between gap-6 mb-6'>
        <div className='min-w-0'>
          <div className='eyebrow'>Active battle pass</div>
          <div className='display mt-2.5 text-[34px] text-text truncate'>{pass.name}</div>
        </div>
        <div className='flex items-end gap-8'>
          <div>
            <div className='eyebrow !text-[10px]'>Tier</div>
            <div className='display mt-2 text-[44px] tabular-nums text-text'>{tier}<span className='text-[16px] font-semibold tracking-normal text-muted'> / {flat.length}</span></div>
          </div>
          <div className='w-60 pb-1'>
            <div className='flex justify-between text-[11px] font-medium text-muted mb-1.5'>
              <span>Next tier</span><span className='tabular-nums'>{nextXp ? `${fmt(pass.towardsNext)} / ${fmt(nextXp)} XP` : 'Max'}</span>
            </div>
            <Progress value={nextXp ? bar(pass.towardsNext, nextXp) : 100} />
          </div>
        </div>
      </div>
      <div ref={scroller} className='relative overflow-x-auto pt-1 pb-3 -mx-1 px-1'>
        <div className='flex gap-7 w-max'>
          {chapters.map((ch, ci) => (
            <div key={ci} className='shrink-0'>
              <div className='eyebrow !text-[10px] mb-3'>{ch.isEpilogue ? 'Epilogue' : `Chapter ${ci + 1}`}</div>
              <div className='flex gap-2.5'>
                {ch.levels.map(l => <RewardTile key={l.tier} tier={l.tier} reward={l.reward} cat={cat} unlocked={l.tier <= tier} current={l.tier === tier} />)}
                {ch.freeRewards.length > 0 && <div className='w-px bg-line mx-1.5 my-2' />}
                {ch.freeRewards.map((r, i) => <RewardTile key={i} reward={r} cat={cat} free unlocked={ch.levels[ch.levels.length - 1].tier <= tier} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  )
}

function Contracts({ contracts, cat, empty }) {
  if (!contracts.length) return <Empty title={empty} hint='Contracts show up here once you start progressing them.' />
  return (
    <Stagger className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4'>
      {contracts.map((c, i) => {
        const agent = c.agentId && cat?.items.get(c.agentId)
        const total = c.chapters.reduce((n, ch) => n + ch.levels.length, 0)
        const pct = bar(c.progressionLevel, total)
        return (
          <Item key={c.id} index={i}>
            <Card className={cx('relative overflow-hidden p-5 flex items-center gap-4', pct >= 100 && 'accent-glow')}>
              <div className='w-14 h-14 rounded-2xl glass-inset overflow-hidden shrink-0 flex items-center justify-center'>
                {agent?.icon && <img src={agent.icon} alt='' className='w-full h-full object-cover' />}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='truncate text-[14px] font-semibold tracking-tight text-text'>{agent?.name || c.name}</span>
                  <Badge tone={pct >= 100 ? 'good' : 'neutral'}>{c.progressionLevel}/{total}</Badge>
                </div>
                <Progress value={pct} className='mt-3' />
                <div className='mt-1.5 text-[11px] text-muted tabular-nums'>{pct >= 100 ? 'Complete' : `${Math.round(pct)}% unlocked`}</div>
              </div>
            </Card>
          </Item>
        )
      })}
    </Stagger>
  )
}

function Account({ account }) {
  const a = account.data
  if (account.error && !a) return <Card className='p-6 h-full'><ErrorState error={account.error} onRetry={account.reload} /></Card>
  if (!a) return <Skeleton className='h-full min-h-[300px] rounded-2xl' />
  const maxXp = Math.max(...a.history.map(h => h.xp), 1)
  return (
    <Card className='p-6 h-full flex flex-col'>
      <Heading hint='XP earned per match' right={<Badge tone='accent'>{fmt(a.xp)} XP</Badge>}>Account</Heading>
      <div className='flex items-baseline gap-2'>
        <span className='display text-[64px] tabular-nums text-text'>{a.level}</span>
        <span className='text-[13px] font-semibold text-muted'>Level</span>
      </div>
      <div className='mt-auto pt-6 flex items-end gap-1.5 h-28'>
        {a.history.slice().reverse().map((h, i) => (
          <div key={i} className='flex-1 h-full flex items-end' title={`${fmt(h.xp)} XP`}>
            <div className='w-full rounded-md bg-gradient-to-t from-accent/40 to-accent-2 opacity-80 hover:opacity-100 transition-opacity origin-bottom anim-rise'
              style={{ height: Math.max(6, bar(h.xp, maxXp)) + '%', animationDelay: `${Math.min(i, 12) * 30}ms` }} />
          </div>
        ))}
      </div>
    </Card>
  )
}

const TABS = [{ value: 'overview', label: 'Overview' }, { value: 'pass', label: 'Battle pass' }, { value: 'contracts', label: 'Contracts' }]

function ProgressionBody({ active }) {
  const cat = useCatalog()
  const tiers = useTiers()
  const contracts = useInvoke('progression:contracts', [], { skip: !active })
  const account = useInvoke('progression:account')
  const rr = useInvoke('progression:rrHistory', [20])
  const [tab, setTab] = useState('overview')

  const list = contracts.data?.contracts || []
  const pass = pickPass(list)
  const agents = list.filter(c => c.type === 'Agent')
  const others = list.filter(c => c.type !== 'Agent' && c !== pass)
  const reload = () => { contracts.reload(); account.reload(); rr.reload() }
  const f = formOf(rr.data)
  const last = rr.data?.[rr.data.length - 1]
  const best = rr.data?.length ? rr.data.reduce((a, r) => (r.ladder > a.ladder ? r : a)) : null
  const flatLen = pass ? pass.chapters.reduce((n, c) => n + c.levels.length, 0) : 0

  const passBlock = contracts.error && !contracts.data ? <ErrorState error={contracts.error} onRetry={contracts.reload} />
    : !contracts.data ? <Skeleton className='h-72 rounded-3xl' />
      : pass ? <BattlePass pass={pass} cat={cat} /> : <Empty title='No active battle pass' />

  return (
    <Page title='Progression' subtitle='Battle pass, contracts, account level and ranked trend'
      actions={<Button icon={FiRefreshCw} onClick={reload}>Refresh</Button>}>
      <CareerBar tabs={TABS} value={tab} onChange={setTab} layoutId='career-progression'
        right={pass && <><Badge tone='accent'>Tier {pass.progressionLevel}</Badge><span>{agents.length} agent contracts</span></>} />

      <StatStrip loading={!rr.data && !account.data}>
        <StatCell label='Current rank' className='min-w-[200px]' sub={last ? `${last.rrAfter} RR` : 'no ranked games'}>
          <div className='flex items-center gap-2.5 mt-2'>
            {last && tiers?.[last.tierAfter] && <img src={tiers[last.tierAfter].smallIcon} alt='' className='w-8 h-8' />}
            <span className='font-display text-[20px] font-750 tracking-tight leading-none truncate'>{last ? tiers?.[last.tierAfter]?.tierName || '-' : '-'}</span>
          </div>
        </StatCell>
        <StatCell label='Net RR' value={f.games ? signed(f.net) : '-'} sub={f.games ? `last ${f.games} ranked` : ''} tone={f.net > 0 ? 'good' : f.net < 0 ? 'bad' : undefined} />
        <StatCell label='Win rate' value={f.rate != null ? f.rate + '%' : '-'} sub={f.games ? `${f.wins}W ${f.games - f.wins}L` : ''} />
        <StatCell label='Best ladder' value={best ? `${best.rrAfter} RR` : '-'} sub={best ? tiers?.[best.tierAfter]?.tierName : ''} />
        <StatCell label='Account level' value={account.data?.level ?? '-'} sub={account.data ? `${fmt(account.data.xp)} XP` : ''} />
        <StatCell label='Battle pass' value={pass ? pass.progressionLevel : '-'} sub={pass ? `of ${flatLen} tiers` : 'none active'} tone='accent' />
      </StatStrip>

      <Swap id={tab}>
        {tab === 'overview' && (
          <div className='space-y-5'>
            <div className='grid grid-cols-1 xl:grid-cols-3 gap-5'>
              <Card className='p-6 xl:col-span-2'>
                <Heading hint={rr.data?.length ? `Last ${rr.data.length} ranked games` : 'Ranked games'}>Competitive trend</Heading>
                {rr.error && !rr.data ? <ErrorState error={rr.error} onRetry={rr.reload} />
                  : !rr.data ? <Skeleton className='h-56 rounded-2xl' />
                    : rr.data.length < 2 ? <Empty title='Not enough ranked games' hint='Play a couple of competitive matches to see your RR trend.' />
                      : <RrChart rows={rr.data} />}
              </Card>
              <Account account={account} />
            </div>
            {passBlock}
          </div>
        )}
        {tab === 'pass' && passBlock}
        {tab === 'contracts' && (
          <div className='space-y-8'>
            <section>
              <Heading hint='Agent recruitment and contract progress'>Agent contracts</Heading>
              {!contracts.data ? <Skeleton className='h-24 rounded-2xl' /> : <Contracts contracts={agents} cat={cat} empty='No agent contracts yet' />}
            </section>
            {others.length > 0 && (
              <section>
                <Heading>Event contracts</Heading>
                <Contracts contracts={others} cat={cat} empty='No event contracts' />
              </section>
            )}
          </div>
        )}
      </Swap>
    </Page>
  )
}

export default function Progression({ active }) {
  return <RequireRiot><ProgressionBody active={active !== false} /></RequireRiot>
}
