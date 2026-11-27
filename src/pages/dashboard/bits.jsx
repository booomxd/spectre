import { st } from '../../lib/st'
import { Show } from 'solid-js'
import { FiClock } from 'solid-icons/fi'
import { CUR, fmt, fmtDuration, useCountdown } from './catalog'

// currency amount with its icon. `cat` is the catalog value (not an accessor)
export function Price(props) {
  const icon = () => props.cat?.items.get(props.currencyId || CUR.vp)?.icon
  const size = () => props.size ?? 14
  return (
    <span class={'inline-flex items-center gap-1.5 font-display font-bold tracking-tight tabular-nums ' + (props.class || '')}>
      <Show when={icon()}><img decoding='async' src={icon()} alt='' style={st({ width: size(), height: size() })} class={(props.onArt ? '' : 'mono-icon ') + 'object-contain'} /></Show>
      {fmt(props.amount)}
    </span>
  )
}

export function Countdown(props) {
  const left = useCountdown(() => props.seconds)
  return (
    <Show when={left() != null}>
      <span class={'inline-flex items-center gap-1.5 font-medium tabular-nums ' + (props.class || '')}><FiClock class='text-[0.9em]' />{fmtDuration(left())}</span>
    </Show>
  )
}

// item art box: a faint wash of the content tier color from the bottom, a soft floor shadow under the item and a thin tier-colored edge
export function ItemArt(props) {
  const color = () => props.item?.tier?.highlightColor ? '#' + props.item.tier.highlightColor.slice(0, 6) : null
  return (
    <div class={'relative flex items-center justify-center overflow-hidden ' + (props.class || '')}
      style={color() ? { background: `linear-gradient(180deg, transparent 35%, ${color()}14)` } : undefined}>
      <span class='absolute bottom-2.5 left-1/2 -translate-x-1/2 w-3/5 h-3 rounded-[50%] bg-black/35 blur-md pointer-events-none' />
      <Show when={color()}><span class='absolute inset-x-6 bottom-0 h-px pointer-events-none' style={{ background: `linear-gradient(90deg, transparent, ${color()}aa, transparent)` }} /></Show>
      <Show when={props.item?.icon} fallback={<span class='text-[10px] text-muted'>{props.item?.name || '...'}</span>}>
        <img decoding='async' src={props.item.icon} alt={props.item.name} loading='lazy' class={'relative p-2.5 transition-transform duration-500 ease-out group-hover:scale-105 ' + (props.imgClass || 'max-h-full max-w-full object-contain')} />
      </Show>
    </div>
  )
}
