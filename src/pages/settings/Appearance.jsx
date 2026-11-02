import { useState } from 'react'
import { FiCheck } from 'react-icons/fi'
import { Card, SectionTitle } from '../../ui'
import { THEMES, getTheme, setTheme } from '../../lib/theme'

// Mini app mock drawn with the theme's own tokens (data-theme scopes the CSS variables).
function Preview({ id }) {
  return (
    <div data-theme={id} className='flex h-[92px] rounded-lg overflow-hidden border border-line bg-bg'>
      <div className='w-9 bg-surface border-r border-line flex flex-col items-center gap-1.5 pt-2'>
        <span className='w-4 h-1.5 rounded-full bg-accent' />
        <span className='w-4 h-1.5 rounded-full bg-line' />
        <span className='w-4 h-1.5 rounded-full bg-line' />
      </div>
      <div className='flex-1 p-2 flex flex-col gap-1.5'>
        <span className='h-2 w-14 rounded-full bg-text/80' />
        <div className='flex gap-1.5 flex-1'>
          <span className='flex-1 rounded-md bg-surface border border-line' />
          <span className='flex-1 rounded-md bg-surface-2 border border-line flex items-end p-1'><span className='h-1.5 w-full rounded-full bg-accent' /></span>
        </div>
        <span className='h-3 w-10 rounded-md bg-accent' />
      </div>
    </div>
  )
}

export default function Appearance() {
  const [theme, setCurrent] = useState(getTheme())
  const pick = id => { setTheme(id); setCurrent(id) }
  return (
    <section>
      <SectionTitle>Appearance</SectionTitle>
      <div className='grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-3 stagger'>
        {THEMES.map((t, i) => {
          const on = theme === t.id
          return (
            <Card key={t.id} hover onClick={() => pick(t.id)} style={{ '--i': i }}
              className={'anim-rise p-2.5 transition-all duration-200 ' + (on ? 'border-accent ring-1 ring-accent/50' : '')}>
              <Preview id={t.id} />
              <div className='flex items-center justify-between mt-2.5 px-0.5'>
                <div className='flex items-center gap-2'>
                  <span className='w-2.5 h-2.5 rounded-full' style={{ background: t.swatch }} />
                  <span className='text-[13px] font-semibold'>{t.name}</span>
                </div>
                <span className={'w-4 h-4 rounded-full bg-accent text-bg flex items-center justify-center text-[10px] transition-all duration-200 ' + (on ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}><FiCheck /></span>
              </div>
            </Card>
          )
        })}
      </div>
    </section>
  )
}
