import { useMemo, useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Button, Card, Input, Label, Page, RequireRiot, Select, Toggle } from '../ui'
import { useRiot } from '../lib/riot'
import { useContent } from '../lib/content'
import { GAME_STATES, QUEUES } from './tools/gear'
import { PresencePanel, runTool, usePresence } from './tools/PresencePanel'

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
      actions={<Button variant='primary' icon={FiCheck} loading={busy} disabled={!riot.connected} onClick={apply}>Apply</Button>}>
      <RequireRiot>
        <div className='grid grid-cols-[1fr_320px] gap-5 items-start'>
          <div className='space-y-4 min-w-0'>
            <Card className='p-5 grid grid-cols-2 gap-4 anim-rise'>
              <div><Label>Game state</Label><Select value={state} onChange={e => setState(e.target.value)} options={GAME_STATES} /></div>
              <div><Label>Mode</Label><Select value={queue} onChange={e => setQueue(e.target.value)} options={QUEUES} /></div>
            </Card>

            <Card className='overflow-hidden anim-rise' style={{ animationDelay: '60ms' }}>
              <div className='grid grid-cols-[1fr_220px]'>
                <div className='p-5'>
                  <Label hint='Shown during Agent Select and In Game'>Map</Label>
                  <Select value={mapUrl} onChange={e => setMap(e.target.value)} options={maps.map(m => ({ value: m.mapUrl, label: m.displayName }))} />
                </div>
                <div className={`relative h-28 bg-surface-2 transition-opacity ${showMap ? '' : 'opacity-30'}`}>
                  {picked?.splash && <img key={picked.uuid} src={picked.splash} className='anim-fade absolute inset-0 w-full h-full object-cover' />}
                  <div className='absolute inset-0 bg-gradient-to-r from-surface to-transparent' />
                </div>
              </div>
            </Card>

            <Card className='p-5 anim-rise' style={{ animationDelay: '120ms' }}>
              <Label>Score (your team vs enemy)</Label>
              <div className='flex items-center gap-3 max-w-xs'>
                <Input type='number' min='0' value={ally} onChange={e => setAlly(e.target.value)} />
                <span className='text-muted'>-</span>
                <Input type='number' min='0' value={enemy} onChange={e => setEnemy(e.target.value)} />
              </div>
            </Card>

            <Card className='p-5 anim-rise' style={{ animationDelay: '180ms' }}>
              <div className='grid grid-cols-2 gap-4 max-w-sm mb-4'>
                <div><Label>Party size</Label><Input type='number' min='1' max='10' value={partySize} onChange={e => setPartySize(e.target.value)} /></div>
                <div><Label>Max party size</Label><Input type='number' min='1' max='10' value={maxPartySize} onChange={e => setMaxPartySize(e.target.value)} /></div>
              </div>
              <Toggle checked={open} onChange={setOpen} label='Open party' hint='Friends can join without an invite' />
            </Card>
          </div>
          <PresencePanel presence={presence} draft={{ status }} />
        </div>
      </RequireRiot>
    </Page>
  )
}
