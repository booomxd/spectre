import { useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Card, SectionTitle, Toggle } from '../../ui'
import { THEMES, getReduceMotion, getTheme, setReduceMotion, setTheme } from '../../lib/theme'

// Mini glass app mock drawn with the theme's own tokens (data-theme scopes the CSS variables):
// an opaque base with two soft color fields in the theme's colors, a floating glass dock, glass cards and an accent pill.
function Preview({ t }) {
  return (
    <div data-theme={t.id} className='relative isolate flex h-[104px] rounded-xl overflow-hidden border border-line bg-bg'>
      <span className='absolute -left-10 -top-12 w-36 h-36 opacity-[0.55] -z-10' style={{ background: `radial-gradient(closest-side, ${t.swatch}, transparent)` }} />
      <span className='absolute -right-10 -bottom-14 w-36 h-36 opacity-[0.4] -z-10' style={{ background: `radial-gradient(closest-side, ${t.glow}, transparent)` }} />
      <div className='glass h-4 mx-auto mt-1.5 px-1.5 rounded-full flex items-center gap-1 absolute left-1/2 -translate-x-1/2'>
        <span className='accent-fill w-4 h-1.5 rounded-full' />
        <span className='w-4 h-1.5 rounded-full bg-muted/40' />
        <span className='w-4 h-1.5 rounded-full bg-muted/40' />
      </div>
      <div className='flex-1 p-2 pt-7 flex flex-col gap-1.5'>
        <span className='h-2 w-14 rounded-full bg-text/80' />
        <div className='flex gap-1.5 flex-1'>
          <span className='glass flex-1 rounded-lg' />
          <span className='glass flex-1 rounded-lg flex items-end p-1'>
            <span className='h-1.5 w-full rounded-full bg-surface-2 overflow-hidden'><span className='block h-full w-2/3 rounded-full bg-gradient-to-r from-accent to-accent-2' /></span>
          </span>
        </div>
        <span className='accent-fill h-3 w-10 rounded-full' />
      </div>
    </div>
  )
}

export default function Appearance() {
  const [theme, setCurrent] = useState(getTheme())
  const pick = id => { setTheme(id); setCurrent(id) }
  const [reduce, setReduce] = useState(getReduceMotion)
  return (
    <section className='flex flex-col gap-8'>
      <div>
      <SectionTitle>Motion</SectionTitle>
      <Card className='p-6'>
        <Toggle checked={reduce} onChange={v => { setReduceMotion(v); setReduce(v) }} label='Reduce motion'
          hint='Turns off page transitions, sliding indicators and the drifting backdrop. Your Windows animation setting is honored too.' />
      </Card>
      </div>
      <div>
      <SectionTitle>Theme</SectionTitle>
      <div className='grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 stagger'>
        {THEMES.map((t, i) => {
          const on = theme === t.id
          return (
            <Card key={t.id} hover onClick={() => pick(t.id)} style={{ '--i': i }}
              className={'anim-rise p-2.5 rounded-2xl transition duration-200 ' + (on ? 'accent-soft' : '')}>
              <Preview t={t} />
              <div className='flex items-center justify-between mt-3 mb-0.5 px-1'>
                <div className='flex items-center gap-2 min-w-0'>
                  <span className='w-3 h-3 rounded-full shrink-0 ring-1 ring-line' style={{ background: `linear-gradient(135deg, ${t.swatch}, ${t.glow})` }} />
                  <span className='text-[13px] font-semibold text-text truncate'>{t.name}</span>
                </div>
                <span className={'accent-fill w-5 h-5 rounded-full text-bg flex items-center justify-center text-[11px] shrink-0 transition duration-200 ' + (on ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}><FiCheck /></span>
              </div>
            </Card>
          )
        })}
      </div>
      </div>
    </section>
  )
}
