import { useEffect, useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Button, Input, Label, Page, RequireRiot, Skeleton, Toggle, cx } from '../ui'
import { useRiot } from '../lib/riot'
import { divisionLabel } from './tools/gear'
import { PresencePanel, runTool, usePresence } from './tools/PresencePanel'
import { Panel, ToolLayout } from './tools/Layout'

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

  const Div = ({ d, color }) => {
    const on = form.division === d
    return (
      <button type='button' onClick={() => set('division', d)} title={divisionLabel(d)}
        className={cx('h-8 min-w-[38px] px-2.5 rounded-full text-[11.5px] font-semibold tabular-nums transition-[transform,background-color,color] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.97]',
          on ? 'text-[#0b0f17]' : 'glass-inset text-muted hover:text-text')}
        style={on ? { background: `linear-gradient(135deg, ${color}, ${color}cc)`, boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.35), 0 6px 18px -6px ${color}aa` } : undefined}>
        {d === 0 ? 'Unseeded' : d === 21 ? 'Contender' : d === 22 ? 'Invite' : ((d - 1) % 5) + 1}
      </button>
    )
  }

  return (
    <Page title='Premier' subtitle='Show a Premier team beside your name in friends lists.'
      actions={<Button variant='primary' size='sm' icon={FiCheck} loading={busy} disabled={!form || !riot.connected} onClick={apply}>Apply</Button>}>
      <RequireRiot>
        <ToolLayout aside={<PresencePanel presence={presence} draft={form ? { premier: { ...form, division: form.division } } : {}} />}>
          {!form ? <Skeleton className='h-64 rounded-2xl' /> : (
            <>
              <Panel title='Team' bodyClassName='grid grid-cols-[1fr_120px_120px] gap-4'>
                <div><Label>Team name</Label><Input value={form.rosterName} maxLength={24} onChange={e => set('rosterName', e.target.value)} placeholder='Team name' /></div>
                <div><Label>Tag</Label><Input value={form.rosterTag} maxLength={5} onChange={e => set('rosterTag', e.target.value.toUpperCase())} placeholder='TAG' /></div>
                <div><Label>Score</Label><Input type='number' min='0' value={form.score} onChange={e => set('score', e.target.value)} className='tabular-nums' /></div>
              </Panel>
              <Panel title='Division' delay={0.04} right={<span className='accent-soft inline-flex items-center h-6 px-2.5 rounded-full text-[11px] font-semibold text-accent'>{divisionLabel(form.division)}</span>}>
                <div className='space-y-2.5'>
                  {GROUPS.map(g => (
                    <div key={g.name} className='flex items-center gap-4'>
                      <span className='w-28 flex items-center gap-2 text-[12px] font-semibold tracking-tight text-text'><span className='w-1.5 h-1.5 rounded-full shrink-0' style={{ background: g.color, boxShadow: `0 0 8px ${g.color}` }} />{g.name}</span>
                      <div className='flex gap-1.5'>{[0, 1, 2, 3, 4].map(i => <Div key={i} d={g.start + i} color={g.color} />)}</div>
                    </div>
                  ))}
                  <div className='hairline !my-3.5' />
                  <div className='flex items-center gap-4'>
                    <span className='w-28 text-[12px] font-semibold tracking-tight text-muted'>Other</span>
                    <div className='flex gap-1.5'>{SPECIAL.map(s => <Div key={s.d} {...s} />)}</div>
                  </div>
                </div>
              </Panel>
              <Panel title='Look' delay={0.08} bodyClassName='space-y-4'>
                <Toggle checked={form.showTag} onChange={v => set('showTag', v)} label='Show team tag' hint='Tag in front of your name' />
                <Toggle checked={form.showPlating} onChange={v => set('showPlating', v)} label='Show plating' hint='Premier border on your player card' />
                <Toggle checked={form.showAura} onChange={v => set('showAura', v)} label='Show aura' hint='Division glow around your card' />
              </Panel>
            </>
          )}
        </ToolLayout>
      </RequireRiot>
    </Page>
  )
}
