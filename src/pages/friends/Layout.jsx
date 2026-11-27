import { Dynamic } from 'solid-js/web'
import { splitProps } from 'solid-js'
import { st } from '../../lib/st.js'
// shared list/detail layout for the Squad pages
import { FiSearch } from 'solid-icons/fi'
import { Input, Pill, cx, pressable } from '../../ui'

// fills the page body
export const SPLIT_BODY = '!overflow-hidden flex min-h-0'

export function SplitView(props) {
  return (
    <div class={cx('flex-1 min-h-0 flex gap-5', props["class"])}>
      <aside class='shrink-0 min-h-0 flex flex-col' style={st({ width: (props.listWidth ?? 340) })}>{props.list}</aside>
      <section class='flex-1 min-w-0 min-h-0 overflow-y-auto -mr-3 pr-3 pb-1'>{props.children}</section>
    </div>
  )
}

// glass pane with a fixed header and a scrolling body
export function Pane(props) {
  return (
    <div class={cx('glass rounded-3xl flex flex-col min-h-0 h-full overflow-hidden', props["class"])}>
      {(props.title || props.right) && (
        <div class='flex items-center justify-between gap-3 px-5 pt-5 pb-3'>
          <span class='eyebrow'>{props.title}</span>
          {props.right}
        </div>
      )}
      {props.header && <div class='px-4 pb-3'>{props.header}</div>}
      <div class={cx('flex-1 min-h-0 overflow-y-auto px-3 pb-3', props.bodyClass)}>{props.children}</div>
      {props.footer && <div class='border-t border-line px-4 py-3'>{props.footer}</div>}
    </div>
  )
}

export function SearchField(props) {
  return (
    <div class={cx('relative', props["class"])}>
      <FiSearch class='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' size={14} />
      <Input class='!pl-9 !rounded-full' value={props.value} onInput={e => props.onChange(e.target.value)} placeholder={props.placeholder} autofocus={props.autofocus} />
    </div>
  )
}

// group label inside a list pane
export function ListLabel(props) {
  return (
    <div class='flex items-center justify-between px-2.5 pt-4 pb-1.5 first:pt-1'>
      <span class='text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted'>{props.children}</span>
      {props.count != null && <span class='text-[10.5px] font-semibold text-muted tabular-nums'>{props.count}</span>}
    </div>
  )
}

// A selectable row in a list pane
export function ListRow(props) {
  const [, rest] = splitProps(props, ["selected","onClick","layoutId","class","children","dim","as"])
  return (
    <Dynamic component={props.as ?? 'div'} {...((props.as ?? 'div') === 'div' ? pressable(props.onClick) : { onClick: props.onClick })} {...rest}
      class={cx('group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 cursor-pointer text-left w-full transition-[opacity,background-color] duration-200',
        !props.selected && 'hover:bg-surface-2/70', props.dim && !props.selected && 'opacity-55 hover:opacity-100', props["class"])}>
      {props.selected && <Pill layoutId={props.layoutId} class='accent-soft absolute inset-0 rounded-2xl' />}
      {props.children}
    </Dynamic>
  )
}

// big detail header: optional art backdrop, eyebrow, title, meta and actions
export function DetailHero(props) {
  return (
    <div class={cx('glass relative overflow-hidden rounded-3xl', props["class"])}>
      {props.art && <img decoding='async' src={props.art} alt='' draggable={false} class='absolute inset-0 w-full h-full object-cover' />}
      {props.art && <div class='absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/5' />}
      {!props.art && <span class='halo -top-28 -right-20 w-80 h-80' />}
      <div class='relative p-6 flex flex-col gap-4'>
        <div class='flex flex-wrap items-end justify-between gap-4'>
          <div class='min-w-0'>
            {props.eyebrow && <div class={cx('eyebrow mb-2', props.art && '!text-white/70')}>{props.eyebrow}</div>}
            <h2 class={cx('display text-[34px] truncate', props.art ? 'text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.45)]' : 'text-text')}>{props.title}</h2>
            {props.meta && <div class={cx('mt-2 text-[13px]', props.art ? 'text-white/75' : 'text-muted')}>{props.meta}</div>}
          </div>
          {props.actions && <div class='flex flex-wrap items-center gap-2'>{props.actions}</div>}
        </div>
        {props.children}
      </div>
    </div>
  )
}
