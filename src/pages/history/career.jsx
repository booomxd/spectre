// shared building blocks for the Career pages (Progression, Matches, Encounters, Leaderboard) so they read as one family: a toolbar row with SegmentedTabs + right-side meta, and a stat strip of big numbers under it
import { SegmentedTabs, Skeleton, cx } from '../../ui'

// toolbar under the page header: segmented filter on the left, meta / actions on the right
export function CareerBar({ tabs, value, onChange, layoutId, right, className }) {
  return (
    <div className={cx('flex flex-wrap items-center justify-between gap-3 mb-5', className)}>
      {tabs ? <SegmentedTabs tabs={tabs} value={value} onChange={onChange} layoutId={layoutId} /> : <span />}
      {right && <div className='flex items-center gap-2.5 text-[12px] text-muted tabular-nums'>{right}</div>}
    </div>
  )
}

// one big number. tone: 'good' | 'bad' | 'accent' | undefined
export function StatCell({ label, value, sub, tone, className, children }) {
  const color = tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'accent' ? 'text-accent' : 'text-text'
  return (
    <div className={cx('flex-1 min-w-[130px] px-5 py-4', className)}>
      <div className='eyebrow !text-[10px] truncate'>{label}</div>
      {children || <div className={cx('font-display text-[28px] font-750 tracking-tight leading-none tabular-nums mt-2.5 truncate', color)}>{value}</div>}
      {sub && <div className='text-[11.5px] text-muted mt-1.5 tabular-nums truncate'>{sub}</div>}
    </div>
  )
}

// row of StatCells inside one glass panel, split by hairlines
export function StatStrip({ children, loading, className }) {
  if (loading) return <Skeleton className={cx('h-[98px] rounded-2xl mb-5', className)} />
  return (
    <div className={cx('glass rounded-2xl mb-5 flex flex-wrap items-stretch divide-x divide-line anim-rise overflow-hidden', className)}>
      {children}
    </div>
  )
}

// last results as small pills, oldest -> newest. results: ['win' | 'loss' | 'draw']
export function FormPills({ results, className }) {
  return (
    <div className={cx('flex items-center gap-1', className)}>
      {results.map((r, i) => (
        <span key={i} title={r} className={cx('w-2 h-5 rounded-full', r === 'win' ? 'bg-good shadow-[0_0_10px_rgb(var(--good)/0.45)]' : r === 'loss' ? 'bg-bad/80' : 'bg-warn/80')} />
      ))}
    </div>
  )
}
