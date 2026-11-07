// Compact frame shared by the Experimental tools (Rank Editor, Profile, Premier, Status).
// They render inside Settings > Experimental, so they stay quieter than the main pages: smaller panels,
// eyebrow titles, one accent action, and the live "how friends see you" preview pinned on the right.
import { FadeIn, cx } from '../../ui'

export function ToolLayout({ aside, children }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_280px] gap-4 items-start'>
      <div className='min-w-0 flex flex-col gap-4'>{children}</div>
      <aside className='sticky top-0'>{aside}</aside>
    </div>
  )
}

// A quiet glass panel with an eyebrow title. `delay` staggers the entrance (seconds).
export function Panel({ title, hint, right, delay = 0, className, bodyClassName, children }) {
  return (
    <FadeIn delay={delay} y={6} className={cx('glass rounded-2xl', className)}>
      {(title || right) && (
        <div className='flex items-center justify-between gap-3 px-5 pt-4'>
          <div className='min-w-0'>
            {title && <h3 className='eyebrow'>{title}</h3>}
            {hint && <p className='text-[11.5px] text-muted mt-1'>{hint}</p>}
          </div>
          {right}
        </div>
      )}
      <div className={cx('p-5', (title || right) && 'pt-3.5', bodyClassName)}>{children}</div>
    </FadeIn>
  )
}

// Small selectable tile used by the pickers (ranks, cards, borders, titles). `on` = selected.
export function Choice({ on, onClick, className, style, title, children }) {
  return (
    <button type='button' onClick={onClick} title={title} style={style}
      className={cx('rounded-xl transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]',
        on ? 'accent-soft border border-transparent' : 'glass-inset hover:bg-surface-2', className)}>
      {children}
    </button>
  )
}
