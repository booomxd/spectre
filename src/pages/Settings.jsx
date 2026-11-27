import { For, createEffect, createSignal, on } from 'solid-js'
import { FiInfo, FiLink, FiMonitor, FiSliders, FiDroplet } from 'solid-icons/fi'
import { Page, ErrorState, SegmentedTabs, Skeleton, Swap } from '../ui'
import { useSettings } from './settings/useSettings'
import Appearance from './settings/Appearance'
import { About, Connection, Data, General, Overlay } from './settings/Sections'

export const SETTINGS_TABS = [
  { value: 'general', label: 'General', icon: FiSliders },
  { value: 'appearance', label: 'Appearance', icon: FiDroplet },
  { value: 'overlay', label: 'Overlay', icon: FiMonitor },
  { value: 'connection', label: 'Connection', icon: FiLink },
  { value: 'about', label: 'About', icon: FiInfo },
]

// params: { tab?: one of SETTINGS_TABS } (navigate('settings', {...}))
export default function Settings(props) {
  const __settings = useSettings()
  const [tabS, setTab] = createSignal('general')
  createEffect(on(() => [props.params], () => {
    if (props.params?.tab && SETTINGS_TABS.some(t => t.value === props.params.tab)) setTab(props.params.tab)
  }))
  
    const body = () => {
    switch (tabS()) {
      case 'appearance': return <Appearance />
      case 'overlay': return <Overlay settings={__settings.settings} save={__settings.save} />
      case 'connection': return <Connection />
      case 'about': return <div class='flex flex-col gap-9'><About /><Data /></div>
      default: return <General settings={__settings.settings} save={__settings.save} />
    }
  }
    return (<Page title='Settings' subtitle='Appearance, behavior, overlay and connection'>
      <SegmentedTabs class='mb-7' layoutId='settings-tabs' tabs={SETTINGS_TABS} value={tabS()} onChange={setTab} />
      {__settings.error ? <ErrorState error={__settings.error} /> : !__settings.settings ? (
        <div class='grid gap-5 max-w-4xl'><For each={[0, 1, 2]}>{i => <Skeleton class='h-32 rounded-2xl' />}</For></div>
      ) : (
        <Swap id={tabS()} class='max-w-4xl'>{body()}</Swap>
      )}
    </Page>)
  
}
