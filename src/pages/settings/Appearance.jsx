import { createSignal } from 'solid-js'
import { st } from '../../lib/st.js'
import { FiCheck } from 'solid-icons/fi'
import { Card, SectionTitle, Select, Toggle } from '../../ui'
import { LANGS, useLang } from '../../lib/i18n'
import { THEMES, getReduceMotion, getTheme, setReduceMotion, setTheme } from '../../lib/theme'

// mini glass app mock drawn with the theme's own tokens (data-theme scopes the CSS variables): an opaque base with two soft color fields in the theme's colors, a floating glass dock, glass cards and an accent pill
function Preview(props) {
  return (
    <div data-theme={props.t.id} class='relative isolate flex h-[104px] rounded-xl overflow-hidden border border-line bg-bg'>
      <span class='absolute -left-10 -top-12 w-36 h-36 opacity-[0.55] -z-10' style={st({ background: `radial-gradient(closest-side, ${props.t.swatch}, transparent)` })} />
      <span class='absolute -right-10 -bottom-14 w-36 h-36 opacity-[0.4] -z-10' style={st({ background: `radial-gradient(closest-side, ${props.t.glow}, transparent)` })} />
      <div class='glass h-4 mx-auto mt-1.5 px-1.5 rounded-full flex items-center gap-1 absolute left-1/2 -translate-x-1/2'>
        <span class='accent-fill w-4 h-1.5 rounded-full' />
        <span class='w-4 h-1.5 rounded-full bg-muted/40' />
        <span class='w-4 h-1.5 rounded-full bg-muted/40' />
      </div>
      <div class='flex-1 p-2 pt-7 flex flex-col gap-1.5'>
        <span class='h-2 w-14 rounded-full bg-text/80' />
        <div class='flex gap-1.5 flex-1'>
          <span class='glass flex-1 rounded-lg' />
          <span class='glass flex-1 rounded-lg flex items-end p-1'>
            <span class='h-1.5 w-full rounded-full bg-surface-2 overflow-hidden'><span class='block h-full w-2/3 rounded-full bg-gradient-to-r from-accent to-accent-2' /></span>
          </span>
        </div>
        <span class='accent-fill h-3 w-10 rounded-full' />
      </div>
    </div>
  )
}

export default function Appearance() {
  const [themeS, setCurrent] = createSignal(getTheme())
  const [reduceS, setReduce] = createSignal(getReduceMotion)
  const [langS, setLang] = useLang()
  
    const pick = id => { setTheme(id); setCurrent(id) }
    return (<section class='flex flex-col gap-8'>
      <div>
      <SectionTitle>Language</SectionTitle>
      <Card class='p-6 flex items-center justify-between gap-4'>
        <span class='min-w-0'><span class='block text-[13px] font-medium text-text'>Display language</span><span class='block text-[11.5px] text-muted mt-0.5'>Menus, titles and buttons. Longer descriptions and game content stay in English for now.</span></span>
        <span translate='no'><Select aria-label='Display language' value={langS()} onChange={e => setLang(e.target.value)} options={LANGS.map(([value, label]) => ({ value, label }))} /></span>
      </Card>
      </div>
      <div>
      <SectionTitle>Motion</SectionTitle>
      <Card class='p-6'>
        <Toggle checked={reduceS()} onChange={v => { setReduceMotion(v); setReduce(v) }} label='Reduce motion'
          hint='Turns off page transitions, sliding indicators and the drifting backdrop. Your Windows animation setting is honored too.' />
      </Card>
      </div>
      <div>
      <SectionTitle>Theme</SectionTitle>
      <div class='grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-4 stagger'>
        {THEMES.map((t, i) => {
          const on = themeS() === t.id
          return (
            <Card hover onClick={() => pick(t.id)} style={st({ '--i': i })}
              class={'anim-rise p-2.5 rounded-2xl transition duration-200 ' + (on ? 'accent-soft' : '')}>
              <Preview t={t} />
              <div class='flex items-center justify-between mt-3 mb-0.5 px-1'>
                <div class='flex items-center gap-2 min-w-0'>
                  <span class='w-3 h-3 rounded-full shrink-0 ring-1 ring-line' style={st({ background: `linear-gradient(135deg, ${t.swatch}, ${t.glow})` })} />
                  <span class='text-[13px] font-semibold text-text truncate'>{t.name}</span>
                </div>
                <span class={'accent-fill w-5 h-5 rounded-full text-bg flex items-center justify-center text-[11px] shrink-0 transition duration-200 ' + (on ? 'scale-100 opacity-100' : 'scale-50 opacity-0')}><FiCheck /></span>
              </div>
            </Card>
          )
        })}
      </div>
      </div>
    </section>)
  
}
