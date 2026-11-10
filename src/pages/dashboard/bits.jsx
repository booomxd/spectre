import { FiClock } from 'react-icons/fi'
import { CUR, fmt, fmtDuration, useCountdown } from './catalog'

// Currency amount with its icon.
export function Price({ amount, currencyId = CUR.vp, cat, size = 14, className = '', onArt = false }) {
  const icon = cat?.items.get(currencyId)?.icon
  return (
    <span className={'inline-flex items-center gap-1.5 font-display font-bold tracking-tight tabular-nums ' + className}>
      {icon && <img decoding='async' src={icon} alt='' style={{ width: size, height: size }} className={(onArt ? '' : 'mono-icon ') + 'object-contain'} />}
      {fmt(amount)}
    </span>
  )
}

export function Countdown({ seconds, className = '' }) {
  const left = useCountdown(seconds)
  if (left == null) return null
  return <span className={'inline-flex items-center gap-1.5 font-medium tabular-nums ' + className}><FiClock className='text-[0.9em]' />{fmtDuration(left)}</span>
}

// Item art box: a faint wash of the content tier color from the bottom, a soft floor shadow under the item and a thin
// tier-colored edge. No blob glow.
export function ItemArt({ item, className = '', imgClass = 'max-h-full max-w-full object-contain' }) {
  const color = item?.tier?.highlightColor ? '#' + item.tier.highlightColor.slice(0, 6) : null
  return (
    <div className={'relative flex items-center justify-center overflow-hidden ' + className}
      style={color ? { background: `linear-gradient(180deg, transparent 35%, ${color}14)` } : undefined}>
      <span className='absolute bottom-2.5 left-1/2 -translate-x-1/2 w-3/5 h-3 rounded-[50%] bg-black/35 blur-md pointer-events-none' />
      {color && <span className='absolute inset-x-6 bottom-0 h-px pointer-events-none' style={{ background: `linear-gradient(90deg, transparent, ${color}aa, transparent)` }} />}
      {item?.icon ? <img decoding='async' src={item.icon} alt={item.name} loading='lazy' className={'relative p-2.5 transition-transform duration-500 ease-out group-hover:scale-105 ' + imgClass} /> : <span className='text-[10px] text-muted'>{item?.name || '...'}</span>}
    </div>
  )
}
