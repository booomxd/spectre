import { useEffect, useState } from 'react'
import { FiCpu, FiInfo, FiLink, FiMonitor, FiSliders, FiDroplet } from 'react-icons/fi'
import { Page, ErrorState, SegmentedTabs, Skeleton, Swap } from '../ui'
import { useSettings } from './settings/useSettings'
import Appearance from './settings/Appearance'
import Experimental from './settings/Experimental'
import { About, Connection, Data, General, Overlay } from './settings/Sections'

export const SETTINGS_TABS = [
  { value: 'general', label: 'General', icon: FiSliders },
  { value: 'appearance', label: 'Appearance', icon: FiDroplet },
  { value: 'overlay', label: 'Overlay', icon: FiMonitor },
  { value: 'connection', label: 'Connection', icon: FiLink },
  { value: 'about', label: 'About', icon: FiInfo },
  { value: 'experimental', label: 'Experimental', icon: FiCpu },
]

// params: { tab?: one of SETTINGS_TABS, tool?: 'rank' | 'customize' | 'premier' | 'status' } (navigate('settings', {...})).
export default function Settings({ active, params }) {
  const { settings, error, save } = useSettings()
  const [tab, setTab] = useState('general')
  const [tool, setTool] = useState('rank')
  useEffect(() => {
    if (params?.tab && SETTINGS_TABS.some(t => t.value === params.tab)) setTab(params.tab)
    if (params?.tool) setTool(params.tool)
  }, [params])

  const body = () => {
    switch (tab) {
      case 'appearance': return <Appearance />
      case 'overlay': return <Overlay settings={settings} save={save} />
      case 'connection': return <Connection />
      case 'about': return <div className='flex flex-col gap-9'><About /><Data /></div>
      case 'experimental': return <Experimental settings={settings} save={save} active={active !== false && tab === 'experimental'} tool={tool} setTool={setTool} />
      default: return <General settings={settings} save={save} />
    }
  }
  return (
    <Page title='Settings' subtitle='Appearance, behavior, overlay and connection'>
      <SegmentedTabs className='mb-7' layoutId='settings-tabs' tabs={SETTINGS_TABS} value={tab} onChange={setTab} />
      {error ? <ErrorState error={error} /> : !settings ? (
        <div className='grid gap-5 max-w-4xl'>{[0, 1, 2].map(i => <Skeleton key={i} className='h-32 rounded-2xl' />)}</div>
      ) : (
        <Swap id={tab} className={tab === 'experimental' ? 'max-w-6xl' : 'max-w-4xl'}>{body()}</Swap>
      )}
    </Page>
  )
}
