// compact frame shared by the tool-style pages
import { FadeIn, cx } from '../../ui'

export function ToolLayout({ aside, children }) {
  return (
    <div className='grid grid-cols-[minmax(0,1fr)_280px] gap-4 items-start'>
      <div className='min-w-0 flex flex-col gap-4'>{children}</div>
      <aside className='sticky top-0'>{aside}</aside>
    </div>
  )
}

// A quiet glass panel with an eyebrow title
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

// small selectable tile used by the pickers
export function Choice({ on, onClick, className, style, title, children }) {
  return (
    <button type='button' onClick={onClick} title={title} style={style}
      className={cx('rounded-xl transition-[transform,background-color,border-color,box-shadow] duration-200 ease-out hover:-translate-y-0.5 active:scale-[0.98]',
        on ? 'accent-soft border border-transparent' : 'glass-inset hover:bg-surface-2', className)}>
      {children}
    </button>
  )
}
