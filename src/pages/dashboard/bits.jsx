import { FiClock } from 'react-icons/fi'
import { CUR, fmt, fmtDuration, useCountdown } from './catalog'

// Currency amount with its icon.
export function Price({ amount, currencyId = CUR.vp, cat, size = 14, className = '' }) {
  const icon = cat?.items.get(currencyId)?.icon
  return (
    <span className={'inline-flex items-center gap-1.5 font-display font-bold tracking-tight tabular-nums ' + className}>
      {icon && <img src={icon} alt='' style={{ width: size, height: size }} className='mono-icon object-contain' />}
      {fmt(amount)}
    </span>
  )
}

export function Countdown({ seconds, className = '' }) {
  const left = useCountdown(seconds)
  if (left == null) return null
  return <span className={'inline-flex items-center gap-1.5 font-medium tabular-nums ' + className}><FiClock className='text-[0.9em]' />{fmtDuration(left)}</span>
}

// Item art box tinted with the content tier color.
export function ItemArt({ item, className = '', imgClass = 'max-h-full max-w-full object-contain' }) {
  const color = item?.tier?.highlightColor ? '#' + item.tier.highlightColor.slice(0, 6) : null
  return (
    <div className={'relative flex items-center justify-center overflow-hidden ' + className}
      style={color ? { background: `radial-gradient(circle at 50% 60%, ${color}33, transparent 70%)` } : undefined}>
      {item?.icon ? <img src={item.icon} alt={item.name} loading='lazy' className={'p-2.5 drop-shadow-[0_6px_14px_rgb(0_0_0/0.25)] transition-transform duration-500 ease-out group-hover:scale-110 ' + imgClass} /> : <span className='text-[10px] text-muted'>{item?.name || '...'}</span>}
    </div>
  )
}
