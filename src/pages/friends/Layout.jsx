// Shared list/detail layout for the Squad pages (Friends, Feed, Notes, Lookup).
// Local to the Squad pages: a left list pane with its own scroller and a right detail area.
import { FiSearch } from 'react-icons/fi'
import { Input, Pill, cx, pressable } from '../../ui'

// Fills the page body. Use with <Page bodyClassName={SPLIT_BODY}>.
export const SPLIT_BODY = '!overflow-hidden flex min-h-0'

export function SplitView({ list, children, listWidth = 340, className }) {
  return (
    <div className={cx('flex-1 min-h-0 flex gap-5', className)}>
      <aside className='shrink-0 min-h-0 flex flex-col' style={{ width: listWidth }}>{list}</aside>
      <section className='flex-1 min-w-0 min-h-0 overflow-y-auto -mr-3 pr-3 pb-1'>{children}</section>
    </div>
  )
}

// Glass pane with a fixed header and a scrolling body.
export function Pane({ title, right, header, footer, children, className, bodyClassName }) {
  return (
    <div className={cx('glass rounded-3xl flex flex-col min-h-0 h-full overflow-hidden', className)}>
      {(title || right) && (
        <div className='flex items-center justify-between gap-3 px-5 pt-5 pb-3'>
          <span className='eyebrow'>{title}</span>
          {right}
        </div>
      )}
      {header && <div className='px-4 pb-3'>{header}</div>}
      <div className={cx('flex-1 min-h-0 overflow-y-auto px-3 pb-3', bodyClassName)}>{children}</div>
      {footer && <div className='border-t border-line px-4 py-3'>{footer}</div>}
    </div>
  )
}

export function SearchField({ value, onChange, placeholder, className, autoFocus }) {
  return (
    <div className={cx('relative', className)}>
      <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' size={14} />
      <Input className='!pl-9 !rounded-full' value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoFocus={autoFocus} />
    </div>
  )
}

// Group label inside a list pane.
export function ListLabel({ children, count }) {
  return (
    <div className='flex items-center justify-between px-2.5 pt-4 pb-1.5 first:pt-1'>
      <span className='text-[10.5px] font-semibold tracking-[0.14em] uppercase text-muted'>{children}</span>
      {count != null && <span className='text-[10.5px] font-semibold text-muted tabular-nums'>{count}</span>}
    </div>
  )
}

// A selectable row in a list pane. The selection pill slides between rows (shared layoutId per list).
export function ListRow({ selected, onClick, layoutId, className, children, dim, as: Tag = 'div', ...rest }) {
  return (
    <Tag {...(Tag === 'div' ? pressable(onClick) : { onClick })} {...rest}
      className={cx('group relative flex items-center gap-3 rounded-2xl px-2.5 py-2 cursor-pointer text-left w-full transition-[opacity,background-color] duration-200',
        !selected && 'hover:bg-surface-2/70', dim && !selected && 'opacity-55 hover:opacity-100', className)}>
      {selected && <Pill layoutId={layoutId} className='accent-soft absolute inset-0 rounded-2xl' />}
      {children}
    </Tag>
  )
}

// Big detail header: optional art backdrop, eyebrow, title, meta and actions.
export function DetailHero({ art, eyebrow, title, meta, actions, children, className }) {
  return (
    <div className={cx('glass relative overflow-hidden rounded-3xl', className)}>
      {art && <img decoding='async' src={art} alt='' draggable={false} className='absolute inset-0 w-full h-full object-cover' />}
      {art && <div className='absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/5' />}
      {!art && <span className='halo -top-28 -right-20 w-80 h-80' />}
      <div className='relative p-6 flex flex-col gap-4'>
        <div className='flex flex-wrap items-end justify-between gap-4'>
          <div className='min-w-0'>
            {eyebrow && <div className={cx('eyebrow mb-2', art && '!text-white/70')}>{eyebrow}</div>}
            <h2 className={cx('display text-[34px] truncate', art ? 'text-white drop-shadow-[0_2px_12px_rgb(0_0_0/0.45)]' : 'text-text')}>{title}</h2>
            {meta && <div className={cx('mt-2 text-[13px]', art ? 'text-white/75' : 'text-muted')}>{meta}</div>}
          </div>
          {actions && <div className='flex flex-wrap items-center gap-2'>{actions}</div>}
        </div>
        {children}
      </div>
    </div>
  )
}
