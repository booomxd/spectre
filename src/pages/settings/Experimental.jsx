// Settings > Experimental: the profile tools (Rank Editor, Profile, Premier, Status) behind a warning and an opt-in switch.
// The switch is stored as `experimental` in the settings store (top-level keys merge in settings:set). Off by default.
import { FiAlertTriangle } from 'react-icons/fi'
import { Card, PageContext, SegmentedTabs, Swap, Toggle } from '../../ui'
import { EXPERIMENTAL } from './tools'
import RankEditor from '../RankEditor'
import Customize from '../Customize'
import Premier from '../Premier'
import Status from '../Status'

const TOOLS = { rank: RankEditor, customize: Customize, premier: Premier, status: Status }
const EMBED = { section: null, embedded: true }

export default function Experimental({ settings, save, active, tool, setTool }) {
  const on = settings.experimental === true
  const current = TOOLS[tool] ? tool : 'rank'
  const Tool = TOOLS[current]
  const wanted = EXPERIMENTAL.find(t => t.id === tool)
  return (
    <section className='flex flex-col gap-5'>
      <Card className='relative overflow-hidden p-5 rounded-3xl border-warn/30'>
        <span className='halo -top-24 -left-16 w-72 h-72 opacity-60' style={{ background: 'radial-gradient(closest-side, rgb(var(--warn) / 0.22), transparent)' }} />
        <div className='relative flex items-start gap-4'>
          <div className='w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center text-warn bg-warn/12 border border-warn/30'><FiAlertTriangle size={18} /></div>
          <div className='min-w-0 flex-1'>
            <div className='font-display text-[17px] font-bold tracking-tight'>Experimental features</div>
            <p className='text-[12.5px] text-muted mt-1.5 leading-relaxed max-w-2xl'>
              These tools change what your friends see in their friends list (rank, card, Premier tag and status). They only touch
              your Riot presence, never your account or match data, but they are unofficial and may stop working after a game update.
              Use them at your own risk.
            </p>
            <div className='hairline my-5' />
            <Toggle checked={on} onChange={v => save({ experimental: v })} label='Enable experimental features'
              hint={!on && wanted ? `Turn this on to open ${wanted.label}.` : 'Shows the tools below. You can turn this off again at any time.'} />
          </div>
        </div>
      </Card>
      {on && (
        <div className='flex flex-col gap-4'>
          <SegmentedTabs className='self-start' size='lg' layoutId='exp-tools' value={current} onChange={setTool}
            tabs={EXPERIMENTAL.map(t => ({ value: t.id, label: t.label, icon: t.icon }))} />
          <PageContext.Provider value={EMBED}>
            <Swap id={current}><Tool active={active} /></Swap>
          </PageContext.Provider>
        </div>
      )}
    </section>
  )
}
