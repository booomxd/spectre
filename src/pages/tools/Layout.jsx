import { st } from '../../lib/st.js'
// compact frame shared by the tool-style pages
import { FadeIn, cx } from '../../ui'

export function ToolLayout(props) {
  return (
    <div class='grid grid-cols-[minmax(0,1fr)_280px] gap-4 items-start'>
      <div class='min-w-0 flex flex-col gap-4'>{props.children}</div>
      <aside class='sticky top-0'>{props.aside}</aside>
    </div>
  )
}

// A quiet glass panel with an eyebrow title
export function Panel(props) {
  return (
    <FadeIn delay={(props.delay ?? 0)} y={6} class={cx('glass rounded-2xl', props["class"])}>
      {(props.title || props.right) && (
        <div class='flex items-center justify-between gap-3 px-5 pt-4'>
          <div class='min-w-0'>
            {props.title && <h3 class='eyebrow'>{props.title}</h3>}
            {props.hint && <p class='text-[11.5px] text-muted mt-1'>{props.hint}</p>}
          </div>
          {props.right}
        </div>
      )}
      <div class={cx('p-5', (props.title || props.right) && 'pt-3.5', props.bodyClass)}>{props.children}</div>
    </FadeIn>
  )
}

// small selectable tile used by the pickers
export function Choice(props) {
  return (
    <button type='button' onClick={props.onClick} title={props.title} style={st(props.style)}
      class={cx('rounded-xl transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]',
        props.on ? 'accent-soft border border-transparent' : 'glass-inset hover:bg-surface-2', props["class"])}>
      {props.children}
    </button>
  )
}
