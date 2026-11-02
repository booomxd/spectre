import { useEffect, useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Button, Card, Input, Label, Page, RequireRiot, SectionTitle, Toggle } from '../ui'
import { useRiot } from '../lib/riot'
import { divisionLabel } from './tools/gear'
import { PresencePanel, runTool, usePresence } from './tools/PresencePanel'

const cx = (...c) => c.filter(Boolean).join(' ')
const GROUPS = [
  { name: 'Open', color: '#9aa4b2', start: 1 },
  { name: 'Intermediate', color: '#4ade80', start: 6 },
  { name: 'Advanced', color: '#38bdf8', start: 11 },
  { name: 'Elite', color: '#c084fc', start: 16 },
]
const SPECIAL = [{ d: 0, color: '#6b7280' }, { d: 21, color: '#f59e0b' }, { d: 22, color: '#ef4444' }]

export default function Premier({ active }) {
  const riot = useRiot()
  const presence = usePresence(active)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)

  // Seed the form from the live presence once.
  const cur = presence.data?.current?.premierPresenceData
  useEffect(() => {
    if (form || !presence.data) return
    setForm({
      rosterName: cur?.rosterName ?? '', rosterTag: cur?.rosterTag ?? '', division: cur?.division ?? 0, score: cur?.score ?? 0,
      showTag: cur?.showTag ?? true, showPlating: cur?.showPlating ?? true, showAura: cur?.showAura ?? true,
    })
  }, [presence.data])
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const apply = async () => {
    setBusy(true)
    await runTool('tools:premier', form)
    setBusy(false)
  }

  const Div = ({ d, color }) => (
    <button onClick={() => set('division', d)} title={divisionLabel(d)}
      className={cx('h-9 min-w-[40px] px-2.5 rounded-lg border text-xs font-bold transition-all hover:-translate-y-0.5', form.division === d ? 'text-bg' : 'border-line text-muted hover:text-text bg-surface-2')}
      style={form.division === d ? { background: color, borderColor: color, boxShadow: `0 0 14px ${color}55` } : undefined}>
      {d === 0 ? 'Unseeded' : d === 21 ? 'Contender' : d === 22 ? 'Invite' : ((d - 1) % 5) + 1}
    </button>
  )

  return (
    <Page title='Premier' subtitle='Show a Premier team beside your name in friends lists.'
      actions={<Button variant='primary' icon={FiCheck} loading={busy} disabled={!form || !riot.connected} onClick={apply}>Apply</Button>}>
      <RequireRiot>
        <div className='grid grid-cols-[1fr_320px] gap-5 items-start'>
          <div className='space-y-4 min-w-0'>
            {form && (
              <>
                <Card className='p-5 grid grid-cols-[1fr_140px_140px] gap-4 anim-rise'>
                  <div><Label>Team name</Label><Input value={form.rosterName} maxLength={24} onChange={e => set('rosterName', e.target.value)} placeholder='Team name' /></div>
                  <div><Label>Tag</Label><Input value={form.rosterTag} maxLength={5} onChange={e => set('rosterTag', e.target.value.toUpperCase())} placeholder='TAG' /></div>
                  <div><Label>Score</Label><Input type='number' min='0' value={form.score} onChange={e => set('score', e.target.value)} /></div>
                </Card>
                <Card className='p-5 anim-rise' style={{ animationDelay: '60ms' }}>
                  <SectionTitle right={<span className='text-xs font-semibold text-accent'>{divisionLabel(form.division)}</span>}>Division</SectionTitle>
                  <div className='space-y-3'>
                    <div className='flex gap-1.5'>{SPECIAL.slice(0, 1).map(s => <Div key={s.d} {...s} />)}</div>
                    {GROUPS.map(g => (
                      <div key={g.name} className='flex items-center gap-3'>
                        <span className='w-24 text-[11px] font-semibold uppercase tracking-wider' style={{ color: g.color }}>{g.name}</span>
                        <div className='flex gap-1.5'>{[0, 1, 2, 3, 4].map(i => <Div key={i} d={g.start + i} color={g.color} />)}</div>
                      </div>
                    ))}
                    <div className='flex gap-1.5'>{SPECIAL.slice(1).map(s => <Div key={s.d} {...s} />)}</div>
                  </div>
                </Card>
                <Card className='p-5 space-y-4 anim-rise' style={{ animationDelay: '120ms' }}>
                  <Toggle checked={form.showTag} onChange={v => set('showTag', v)} label='Show team tag' hint='Tag in front of your name' />
                  <Toggle checked={form.showPlating} onChange={v => set('showPlating', v)} label='Show plating' hint='Premier border on your player card' />
                  <Toggle checked={form.showAura} onChange={v => set('showAura', v)} label='Show aura' hint='Division glow around your card' />
                </Card>
              </>
            )}
            {!form && <div className='skeleton h-64 rounded-xl' />}
          </div>
          <PresencePanel presence={presence} draft={form ? { premier: { ...form, division: form.division } } : {}} />
        </div>
      </RequireRiot>
    </Page>
  )
}
