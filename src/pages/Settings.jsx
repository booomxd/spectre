import { Page, ErrorState, Skeleton } from '../ui'
import { useSettings } from './settings/useSettings'
import Appearance from './settings/Appearance'
import { About, Connection, Data, General, Overlay } from './settings/Sections'

export default function Settings() {
  const { settings, error, save } = useSettings()
  return (
    <Page title='Settings' subtitle='Appearance, behavior and connection'>
      {error ? <ErrorState error={error} /> : !settings ? (
        <div className='grid gap-4 max-w-4xl'>{[0, 1, 2].map(i => <Skeleton key={i} className='h-32 rounded-xl' />)}</div>
      ) : (
        <div className='max-w-4xl flex flex-col gap-7 stagger'>
          {[<Appearance />, <General settings={settings} save={save} />, <Overlay settings={settings} save={save} />, <Connection />, <Data />, <About />]
            .map((s, i) => <div key={i} className='anim-rise' style={{ '--i': i }}>{s}</div>)}
        </div>
      )}
    </Page>
  )
}
