import { useMemo, useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Button, Input, Label, Page, RequireRiot, Select, SegmentedTabs, Toggle, cx } from '../ui'
import { useRiot } from '../lib/riot'
import { useContent } from '../lib/content'
import { GAME_STATES, QUEUES } from './tools/gear'
import { PresencePanel, runTool, usePresence } from './tools/PresencePanel'
import { Panel, ToolLayout } from './tools/Layout'

export default function Status({ active }) {
  const riot = useRiot()
  const presence = usePresence(active)
  const allMaps = useContent('maps')
  const [state, setState] = useState('INGAME')
  const [queue, setQueue] = useState('competitive')
  const [map, setMap] = useState('')
  const [ally, setAlly] = useState(13)
  const [enemy, setEnemy] = useState(0)
  const [partySize, setPartySize] = useState(1)
  const [maxPartySize, setMaxPartySize] = useState(5)
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const maps = useMemo(() => allMaps?.filter(m => m.mapUrl).sort((a, b) => a.displayName.localeCompare(b.displayName)) || [], [allMaps])
  const mapUrl = map || maps.find(m => m.displayName === 'Ascent')?.mapUrl || maps[0]?.mapUrl || ''
  const picked = maps.find(m => m.mapUrl === mapUrl)
  const showMap = state === 'PREGAME' || state === 'INGAME'

  const status = { state, queue, map: mapUrl, ally: parseInt(ally) || 0, enemy: parseInt(enemy) || 0, partySize, maxPartySize, open }
  const apply = async () => {
    setBusy(true)
    await runTool('tools:status', status)
    setBusy(false)
  }

  return (
    <Page title='Status' subtitle='Choose what your friends see you doing.'
      actions={<Button variant='primary' size='sm' icon={FiCheck} loading={busy} disabled={!riot.connected} onClick={apply}>Apply</Button>}>
      <RequireRiot>
        <ToolLayout aside={<PresencePanel presence={presence} draft={{ status }} />}>
          <Panel title='Activity'>
            <SegmentedTabs size='sm' layoutId='status-state' value={state} onChange={setState} tabs={GAME_STATES} className='mb-4' />
            <div className='max-w-xs'><Label>Mode</Label><Select value={queue} onChange={e => setQueue(e.target.value)} options={QUEUES} /></div>
          </Panel>

          <Panel title='Map' hint='Shown during Agent Select and In Game' delay={0.04} className={cx('overflow-hidden relative transition-opacity duration-300', !showMap && 'opacity-50')}>
            <div className='absolute inset-y-0 right-0 w-1/2 [mask-image:linear-gradient(to_right,transparent,black_60%)] pointer-events-none'>
              {picked?.splash && <img key={picked.uuid} src={picked.splash} alt='' className='anim-fade absolute inset-0 w-full h-full object-cover' draggable={false} />}
            </div>
            <div className='relative max-w-xs'>
              <Select value={mapUrl} onChange={e => setMap(e.target.value)} options={maps.map(m => ({ value: m.mapUrl, label: m.displayName }))} />
            </div>
          </Panel>

          <div className='grid grid-cols-2 gap-4'>
            <Panel title='Score' hint='Your team vs enemy' delay={0.08}>
              <div className='flex items-center gap-2.5'>
                <Input type='number' min='0' value={ally} onChange={e => setAlly(e.target.value)} className='text-center tabular-nums font-semibold' />
                <span className='text-[15px] font-bold text-muted'>-</span>
                <Input type='number' min='0' value={enemy} onChange={e => setEnemy(e.target.value)} className='text-center tabular-nums font-semibold' />
              </div>
            </Panel>
            <Panel title='Party' hint='Size and max size' delay={0.1}>
              <div className='flex items-center gap-2.5'>
                <Input type='number' min='1' max='10' value={partySize} onChange={e => setPartySize(e.target.value)} className='text-center tabular-nums font-semibold' />
                <span className='text-[13px] font-semibold text-muted'>of</span>
                <Input type='number' min='1' max='10' value={maxPartySize} onChange={e => setMaxPartySize(e.target.value)} className='text-center tabular-nums font-semibold' />
              </div>
            </Panel>
          </div>
          <Panel delay={0.12}>
            <Toggle checked={open} onChange={setOpen} label='Open party' hint='Friends can join without an invite' />
          </Panel>
        </ToolLayout>
      </RequireRiot>
    </Page>
  )
}
