import { useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Button, Card, Input, Label, Page, RequireRiot, SectionTitle, Skeleton } from '../ui'
import { useRiot } from '../lib/riot'
import { useTiers } from '../lib/content'
import { PresencePanel, runTool, usePresence } from './tools/PresencePanel'

const cx = (...c) => c.filter(Boolean).join(' ')

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

  const apply = async () => {
    setBusy(true)
    await runTool('tools:rank', { tier, leaderboardPosition: lb })
    setBusy(false)
  }

  return (
    <Page title='Rank Editor' subtitle='Choose the rank your friends see next to your name.'
      actions={<Button variant='primary' icon={FiCheck} loading={busy} onClick={apply} disabled={!riot.connected}>Apply</Button>}>
      <RequireRiot>
        <div className='grid grid-cols-[1fr_320px] gap-5 items-start'>
          <div className='space-y-5 min-w-0'>
            <Card className='p-5'>
              <SectionTitle>Rank</SectionTitle>
              {!list ? (
                <div className='grid grid-cols-5 gap-3'>{Array.from({ length: 15 }).map((_, i) => <Skeleton key={i} className='h-[108px] rounded-2xl' />)}</div>
              ) : (
                <div className='grid grid-cols-5 gap-3 stagger'>
                  {list.map((t, i) => {
                    const on = t.tier === tier
                    const color = t.color ? '#' + t.color.slice(0, 6) : undefined
                    return (
                      <button key={t.tier} style={{ '--i': i, ...(on && color ? { borderColor: color, boxShadow: `0 0 18px ${color}33` } : {}) }} onClick={() => setPick(t.tier)}
                        className={cx('lift anim-rise rounded-2xl p-3 flex flex-col items-center gap-2', on ? 'accent-soft border border-accent/50' : 'glass hover:bg-surface-2')}>
                        <img src={t.largeIcon} className={cx('w-12 h-12 object-contain transition-transform duration-300', on && 'scale-110')} loading='lazy' />
                        <span className='text-[12px] font-semibold tracking-tight text-center leading-tight text-text' style={on ? { color } : undefined}>{t.tierName}</span>
                      </button>
                    )
                  })}
                </div>
              )}
            </Card>
            <Card className='p-5 max-w-sm anim-rise'>
              <Label hint='Shown next to Immortal and Radiant ranks. Use 0 to hide it.'>Leaderboard position</Label>
              <Input type='number' min='0' value={pos === '' ? (pp?.leaderboardPosition ?? 0) : pos} onChange={e => setPos(e.target.value)} />
            </Card>
          </div>
          <PresencePanel presence={presence} draft={{ tier, leaderboard: lb }} />
        </div>
      </RequireRiot>
    </Page>
  )
}
