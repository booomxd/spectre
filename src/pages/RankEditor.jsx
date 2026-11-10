import { useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Button, Input, Page, RequireRiot, Skeleton, cx } from '../ui'
import { useRiot } from '../lib/riot'
import { useTiers } from '../lib/content'
import { PresencePanel, runTool, usePresence } from './tools/PresencePanel'
import { Choice, Panel, ToolLayout } from './tools/Layout'

export default function RankEditor({ active }) {
  const riot = useRiot()
  const presence = usePresence(active)
  const tiers = useTiers()
  const [pick, setPick] = useState(null)
  const [pos, setPos] = useState('')
  const [busy, setBusy] = useState(false)

  const pp = presence.data?.current?.playerPresenceData
  const tier = pick ?? pp?.competitiveTier ?? 0
  const lb = pos === '' ? (pp?.leaderboardPosition ?? 0) : parseInt(pos) || 0
  const list = tiers ? Object.values(tiers).filter(t => t.largeIcon && !/unused/i.test(t.tierName)).sort((a, b) => a.tier - b.tier) : null
  const chosen = list?.find(t => t.tier === tier)

  const apply = async () => {
    setBusy(true)
    await runTool('tools:rank', { tier, leaderboardPosition: lb })
    setBusy(false)
  }

  return (
    <Page title='Rank Editor' subtitle='Choose the rank your friends see next to your name.'
      actions={<Button variant='primary' size='sm' icon={FiCheck} loading={busy} onClick={apply} disabled={!riot.connected}>Apply</Button>}>
      <RequireRiot>
        <ToolLayout aside={<PresencePanel presence={presence} draft={{ tier, leaderboard: lb }} />}>
          <Panel title='Rank' right={chosen && <span className='text-[12px] font-semibold text-text'>{chosen.tierName}</span>}>
            {!list ? (
              <div className='grid grid-cols-6 gap-2'>{Array.from({ length: 18 }).map((_, i) => <Skeleton key={i} className='h-[76px] rounded-xl' />)}</div>
            ) : (
              <div className='grid grid-cols-6 gap-2'>
                {list.map(t => {
                  const on = t.tier === tier
                  const color = t.color ? '#' + t.color.slice(0, 6) : undefined
                  return (
                    <Choice key={t.tier} on={on} onClick={() => setPick(t.tier)} title={t.tierName} className='py-2.5 px-1 flex flex-col items-center gap-1.5'
                      style={on && color ? { boxShadow: `inset 0 0 0 1px ${color}88, 0 0 20px -6px ${color}` } : undefined}>
                      <img decoding='async' src={t.largeIcon} alt='' className={cx('w-9 h-9 object-contain transition-transform duration-300 ease-out', on && 'scale-110')} loading='lazy' draggable={false} />
                      <span className={cx('text-[10.5px] font-semibold tracking-tight text-center leading-tight capitalize', on ? 'text-text' : 'text-muted')}>{t.tierName.toLowerCase()}</span>
                    </Choice>
                  )
                })}
              </div>
            )}
          </Panel>
          <Panel title='Leaderboard position' hint='Shown next to Immortal and Radiant ranks. Use 0 to hide it.' delay={0.05}>
            <Input type='number' min='0' value={pos === '' ? (pp?.leaderboardPosition ?? 0) : pos} onChange={e => setPos(e.target.value)} className='max-w-[180px] tabular-nums' />
          </Panel>
        </ToolLayout>
      </RequireRiot>
    </Page>
  )
}
