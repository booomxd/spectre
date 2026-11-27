import { For, Show } from 'solid-js'
// shared building blocks for the Career pages (Progression, Matches, Encounters, Leaderboard) so they read as one family: a toolbar row with SegmentedTabs + right-side meta, and a stat strip of big numbers under it
import { SegmentedTabs, Skeleton, cx } from '../../ui'

// toolbar under the page header: segmented filter on the left, meta / actions on the right
export function CareerBar(props) {
  return (
    <div class={cx('flex flex-wrap items-center justify-between gap-3 mb-5', props["class"])}>
      {props.tabs ? <SegmentedTabs tabs={props.tabs} value={props.value} onChange={props.onChange} layoutId={props.layoutId} /> : <span />}
      {props.right && <div class='flex items-center gap-2.5 text-[12px] text-muted tabular-nums'>{props.right}</div>}
    </div>
  )
}

// one big number. tone: 'good' | 'bad' | 'accent' | undefined
export function StatCell(props) {
  
    const color = () => (props.tone === 'good' ? 'text-good' : props.tone === 'bad' ? 'text-bad' : props.tone === 'accent' ? 'text-accent' : 'text-text')
    return (<div class={cx('flex-1 min-w-[130px] px-5 py-4', props["class"])}>
      <div class='eyebrow !text-[10px] truncate'>{props.label}</div>
      {props.children || <div class={cx('font-display text-[28px] font-750 tracking-tight leading-none tabular-nums mt-2.5 truncate', color())}>{props.value}</div>}
      {props.sub && <div class='text-[11.5px] text-muted mt-1.5 tabular-nums truncate'>{props.sub}</div>}
    </div>)
  
}

// row of StatCells inside one glass panel, split by hairlines
export function StatStrip(props) {
  
    
    return (<Show when={!(props.loading)} fallback={<Skeleton class={cx('h-[98px] rounded-2xl mb-5', props["class"])} />}><div class={cx('glass rounded-2xl mb-5 flex flex-wrap items-stretch divide-x divide-line anim-rise overflow-hidden', props["class"])}>
      {props.children}
    </div></Show>)
  
}

// last results as small pills, oldest -> newest. results: ['win' | 'loss' | 'draw']
export function FormPills(props) {
  return (
    <div class={cx('flex items-center gap-1', props["class"])}>
      <For each={props.results}>{(r, i) => (
        <span title={r} class={cx('w-2 h-5 rounded-full', r === 'win' ? 'bg-good shadow-[0_0_10px_rgb(var(--good)/0.45)]' : r === 'loss' ? 'bg-bad/80' : 'bg-warn/80')} />
      )}</For>
    </div>
  )
}
