import { useEffect, useMemo, useRef } from 'react'
import { FiLock, FiCheck, FiRefreshCw } from 'react-icons/fi'
import { Page, Card, SectionTitle, Button, Badge, Skeleton, Empty, ErrorState, RequireRiot } from '../ui'
import { useInvoke } from '../lib/ipc'
import { useCatalog, pickPass, rewardItem, fmt } from './dashboard/catalog'
import RrChart from './dashboard/RrChart'

const bar = (v, max) => Math.min(100, Math.max(0, max ? v / max * 100 : 0))

function Progress({ value, className = '' }) {
  return (
    <div className={'h-2 rounded-full bg-surface-2 overflow-hidden ' + className}>
      <div className='h-full rounded-full bg-gradient-to-r from-accent to-accent-2 transition-all duration-1000 ease-out' style={{ width: value + '%' }} />
    </div>
  )
}

function RewardTile({ tier, reward, cat, unlocked, free, current }) {
  const item = rewardItem(cat, reward)
  const label = item?.name || reward?.type?.replace(/([a-z])([A-Z])/g, '$1 $2') || 'Reward'
  return (
    <div data-current={current ? 1 : undefined}
      className={'group relative shrink-0 w-[124px] rounded-xl p-2.5 transition-all duration-200 hover:-translate-y-1 ' +
        (current ? 'accent-soft border border-transparent ' : free ? 'border border-dashed border-line bg-surface-2/50 ' : 'glass ') + (unlocked ? '' : 'opacity-60 hover:opacity-100')}>
      <div className='flex items-center justify-between text-[11px] font-semibold tabular-nums text-muted'>
        <span>{tier != null ? `Tier ${tier}` : 'Free'}</span>
        {unlocked ? <FiCheck className='text-good' /> : <FiLock />}
      </div>
      <div className='h-[72px] flex items-center justify-center'>
        {item?.icon ? <img src={item.icon} alt='' loading='lazy' className='max-h-16 max-w-full object-contain transition-transform group-hover:scale-110' />
          : <span className='text-[10px] text-muted text-center px-1'>{item?.kind || reward?.type}</span>}
      </div>
      <div className='mt-0.5 truncate text-[11px] font-semibold text-text text-center' title={label}>{label}{reward?.amount > 1 ? ` x${fmt(reward.amount)}` : ''}</div>
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
    <Card className='p-5 anim-rise'>
      <div className='flex flex-wrap items-end justify-between gap-5 mb-5'>
        <div>
          <div className='text-[11px] font-semibold tracking-[0.14em] uppercase text-muted'>Active battle pass</div>
          <div className='mt-1 font-display text-[26px] font-bold tracking-tight text-text leading-tight'>{pass.name}</div>
        </div>
        <div className='flex items-center gap-6'>
          <div className='text-right'>
            <div className='text-[11px] font-semibold tracking-[0.14em] uppercase text-muted'>Tier</div>
            <div className='mt-1 font-display text-3xl font-bold tracking-tight tabular-nums text-accent leading-none'>{tier}<span className='text-base font-semibold text-muted'> / {flat.length}</span></div>
          </div>
          <div className='w-56'>
            <div className='flex justify-between text-[11px] font-medium text-muted mb-1.5'>
              <span>Next tier</span><span className='tabular-nums'>{nextXp ? `${fmt(pass.towardsNext)} / ${fmt(nextXp)} XP` : 'Max'}</span>
            </div>
            <Progress value={nextXp ? bar(pass.towardsNext, nextXp) : 100} />
          </div>
        </div>
      </div>
      <div ref={scroller} className='overflow-x-auto pt-1 pb-3 -mx-1 px-1'>
        <div className='flex gap-6 w-max'>
          {chapters.map((ch, ci) => (
            <div key={ci} className='shrink-0'>
              <div className='text-[12px] font-semibold text-muted mb-2.5'>{ch.isEpilogue ? 'Epilogue' : `Chapter ${ci + 1}`}</div>
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

function AgentContracts({ contracts, cat }) {
  if (!contracts.length) return <Empty title='No agent contracts yet' hint='Contracts show up here once you start progressing an agent.' />
  return (
    <div className='grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 stagger'>
      {contracts.map((c, i) => {
        const agent = c.agentId && cat?.items.get(c.agentId)
        const total = c.chapters.reduce((n, ch) => n + ch.levels.length, 0)
        const pct = bar(c.progressionLevel, total)
        return (
          <Card key={c.id} className='p-4 flex items-center gap-3.5 anim-rise' style={{ '--i': i, animationDelay: `${i * 40}ms` }}>
            <div className='w-12 h-12 rounded-xl bg-surface-2 border border-line overflow-hidden shrink-0 flex items-center justify-center'>
              {agent?.icon && <img src={agent.icon} alt='' className='w-full h-full object-cover' />}
            </div>
            <div className='min-w-0 flex-1'>
              <div className='flex items-center justify-between gap-2'>
                <span className='truncate text-[13px] font-semibold text-text'>{agent?.name || c.name}</span>
                <Badge tone={pct >= 100 ? 'good' : 'neutral'}>{c.progressionLevel}/{total}</Badge>
              </div>
              <Progress value={pct} className='mt-2.5' />
            </div>
          </Card>
        )
      })}
    </div>
  )
}

function ProgressionBody({ active }) {
  const cat = useCatalog()
  const contracts = useInvoke('progression:contracts', [], { skip: !active })
  const account = useInvoke('progression:account')
  const rr = useInvoke('progression:rrHistory', [20])

  const list = contracts.data?.contracts || []
  const pass = pickPass(list)
  const agents = list.filter(c => c.type === 'Agent')
  const others = list.filter(c => c.type !== 'Agent' && c !== pass)
  const reload = () => { contracts.reload(); account.reload(); rr.reload() }
  const a = account.data
  const maxXp = a ? Math.max(...a.history.map(h => h.xp), 1) : 1

  return (
    <Page title='Progression' subtitle='Battle pass, contracts, account level and ranked trend'
      actions={<Button icon={FiRefreshCw} onClick={reload}>Refresh</Button>}>
      <div className='space-y-8'>
        <section>
          {contracts.error && !contracts.data ? <ErrorState error={contracts.error} onRetry={contracts.reload} />
            : !contracts.data ? <Skeleton className='h-72' />
              : pass ? <BattlePass pass={pass} cat={cat} /> : <Empty title='No active battle pass' />}
        </section>

        <div className='grid grid-cols-1 xl:grid-cols-3 gap-5'>
          <Card className='p-5 anim-rise xl:col-span-1'>
            <SectionTitle>Account</SectionTitle>
            {account.error && !a ? <ErrorState error={account.error} onRetry={account.reload} /> : !a ? <Skeleton className='h-32' /> : (
              <>
                <div className='flex items-baseline gap-2'>
                  <span className='font-display text-5xl font-bold tracking-tight tabular-nums text-text leading-none'>{a.level}</span>
                  <span className='text-[13px] font-semibold text-muted'>Level</span>
                  <Badge className='ml-auto' tone='accent'>{fmt(a.xp)} XP</Badge>
                </div>
                <div className='mt-5 text-[12px] font-semibold text-muted'>Recent match XP</div>
                <div className='mt-3 flex items-end gap-1.5 h-20'>
                  {a.history.slice().reverse().map((h, i) => (
                    <div key={i} className='flex-1 rounded-t-md bg-gradient-to-t from-accent/70 to-accent-2/70 hover:from-accent hover:to-accent-2 transition-all duration-700 origin-bottom' title={`${fmt(h.xp)} XP`}
                      style={{ height: bar(h.xp, maxXp) + '%', animation: `rise .5s ${i * 40}ms both` }} />
                  ))}
                </div>
              </>
            )}
          </Card>

          <Card className='p-5 anim-rise xl:col-span-2'>
            <SectionTitle right={rr.data?.length ? <span className='text-[11px] text-muted'>last {rr.data.length} ranked games</span> : null}>Competitive trend</SectionTitle>
            {rr.error && !rr.data ? <ErrorState error={rr.error} onRetry={rr.reload} />
              : !rr.data ? <Skeleton className='h-56' />
                : rr.data.length < 2 ? <Empty title='Not enough ranked games' hint='Play a couple of competitive matches to see your RR trend.' />
                  : <RrChart rows={rr.data} />}
          </Card>
        </div>

        <section>
          <SectionTitle>Agent contracts</SectionTitle>
          {!contracts.data ? <Skeleton className='h-20' /> : <AgentContracts contracts={agents} cat={cat} />}
        </section>

        {others.length > 0 && (
          <section>
            <SectionTitle>Event contracts</SectionTitle>
            <AgentContracts contracts={others} cat={cat} />
          </section>
        )}
      </div>
    </Page>
  )
}

export default function Progression({ active }) {
  return <RequireRiot><ProgressionBody active={active !== false} /></RequireRiot>
}
