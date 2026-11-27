import { For, Show, createMemo, createSignal, createUniqueId } from 'solid-js'
import { useContent, useTiers } from '../../lib/content'

const PL = 46, PR = 20, PT = 18, PB = 28

// competitive ladder line chart
export default function RrChart(props) {
  const tiersA = useTiers()
  const mapsA = useContent('maps')
  const gid = 'rr' + createUniqueId().replace(/[^a-zA-Z0-9]/g, '')
  const [hover, setHover] = createSignal(null)

  const g = createMemo(() => {
    const rows = props.rows
    const W = props.width ?? 800, H = props.height ?? 260
    const vals = rows.map(r => r.ladder)
    let lo = Math.floor((Math.min(...vals) - 15) / 50) * 50, hi = Math.ceil((Math.max(...vals) + 15) / 50) * 50
    if (hi - lo < 100) hi = lo + 100
    const x = i => PL + (rows.length === 1 ? (W - PL - PR) / 2 : i * (W - PL - PR) / (rows.length - 1))
    const y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB)
    const pts = rows.map((r, i) => [x(i), y(r.ladder)])
    // smooth curve
    const line = pts.map((p, i) => {
      if (!i) return `M${p[0].toFixed(1)} ${p[1].toFixed(1)}`
      const q = pts[i - 1], mx = (q[0] + p[0]) / 2
      return `C${mx.toFixed(1)} ${q[1].toFixed(1)} ${mx.toFixed(1)} ${p[1].toFixed(1)} ${p[0].toFixed(1)} ${p[1].toFixed(1)}`
    }).join(' ')
    const area = `${line} L${pts[pts.length - 1][0]} ${H - PB} L${pts[0][0]} ${H - PB} Z`
    const grid = []
    for (let v = Math.ceil(lo / 100) * 100; v <= hi; v += 100) grid.push(v)
    return { rows, W, H, y, pts, line, area, grid, last: pts[pts.length - 1] }
  })
  const mapName = id => mapsA()?.find(m => m.mapUrl === id)?.displayName || ''
  const h = () => hover() != null ? g().rows[hover()] : null
  // entrance uses CSS keyframes (fill-mode both)
  const fade = (dur, delay = 0) => ({ animation: `fade ${dur}s ease ${delay}s both` })

  return (
    <div class='relative'>
      <svg viewBox={`0 0 ${g().W} ${g().H}`} class='w-full h-auto select-none overflow-visible'>
        <defs>
          <linearGradient id={gid + 'f'} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' style={{ 'stop-color': 'rgb(var(--accent))', 'stop-opacity': 0.34 }} />
            <stop offset='100%' style={{ 'stop-color': 'rgb(var(--accent))', 'stop-opacity': 0 }} />
          </linearGradient>
          <linearGradient id={gid + 'l'} x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' style={{ 'stop-color': 'rgb(var(--accent-2))' }} />
            <stop offset='100%' style={{ 'stop-color': 'rgb(var(--accent))' }} />
          </linearGradient>
        </defs>
        <For each={g().grid}>{v => (
          <g>
            <line x1={PL} x2={g().W - PR} y1={g().y(v)} y2={g().y(v)} class='stroke-line' stroke-dasharray='2 6' stroke-linecap='round' />
            <Show when={tiersA()?.[v / 100]}><image href={tiersA()[v / 100].smallIcon} x={8} y={g().y(v) - 12} width={24} height={24} /></Show>
          </g>
        )}</For>
        <path d={g().area} fill={`url(#${gid}f)`} style={fade(0.8, 0.1)} />
        <g style={fade(0.9, 0.2)}>
          <path d={g().line} fill='none' stroke-width={10} stroke-linejoin='round' stroke-linecap='round' stroke='rgb(var(--accent))' opacity={0.14} />
        </g>
        <path d={g().line} fill='none' stroke-width={3} stroke-linejoin='round' stroke-linecap='round' stroke={`url(#${gid}l)`} style={fade(0.6)} />
        <Show when={hover() != null}><line x1={g().pts[hover()][0]} x2={g().pts[hover()][0]} y1={PT} y2={g().H - PB} class='stroke-line' stroke-dasharray='3 4' /></Show>
        <For each={g().pts}>{(p, i) => {
          const r = () => g().rows[i()]
          return (
            <g onMouseEnter={() => setHover(i())} onMouseLeave={() => setHover(null)} class='cursor-pointer'>
              <circle cx={p[0]} cy={p[1]} r={14} fill='transparent' />
              <circle cx={p[0]} cy={p[1]} r={hover() === i() ? 6 : 4} class={r().change >= 0 ? 'fill-good' : 'fill-bad'}
                style={{ ...fade(0.3, 0.4 + Math.min(i(), 12) * 0.03), stroke: 'rgb(var(--panel))', 'stroke-width': '2' }} />
              <Show when={i() > 0 && i() < g().rows.length - 1 && r().tierAfter !== g().rows[i() - 1]?.tierAfter && tiersA()?.[r().tierAfter]}>
                <image href={tiersA()[r().tierAfter].smallIcon} x={p[0] - 11} y={p[1] - 32} width={22} height={22} />
              </Show>
            </g>
          )
        }}</For>
        <g style={fade(0.6, 0.8)}><circle cx={g().last[0]} cy={g().last[1]} r={11} class='fill-accent' opacity={0.2} /></g>
        <Show when={tiersA()?.[g().rows[g().rows.length - 1].tierAfter]}>{t => <image href={t().smallIcon} x={g().last[0] - 13} y={g().last[1] - 40} width={26} height={26} />}</Show>
      </svg>
      <Show when={h()}>{hh => (
        <div class='anim-pop absolute top-1 right-1 rounded-xl border border-line bg-panel/95 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)] px-3.5 py-2.5 text-xs pointer-events-none'>
          <div class='font-display text-[13px] font-bold tracking-tight text-text'>{mapName(hh().mapId) || 'Competitive'} <span class={hh().change >= 0 ? 'text-good tabular-nums' : 'text-bad tabular-nums'}>{hh().change >= 0 ? '+' : ''}{hh().change} RR</span></div>
          <div class='mt-0.5 text-muted tabular-nums'>{tiersA()?.[hh().tierAfter]?.tierName || ''} {hh().rrAfter} RR - {new Date(hh().time).toLocaleDateString()}</div>
        </div>
      )}</Show>
    </div>
  )
}
