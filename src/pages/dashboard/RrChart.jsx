import { useId, useState } from 'react'
import { useContent, useTiers } from '../../lib/content'

const PL = 46, PR = 20, PT = 18, PB = 28

// competitive ladder line chart
export default function RrChart({ rows, height = 260, width = 800 }) {
  const W = width, H = height
  const tiers = useTiers()
  const maps = useContent('maps')
  const gid = 'rr' + useId().replace(/[^a-zA-Z0-9]/g, '')
  const [hover, setHover] = useState(null)

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
  const mapName = id => maps?.find(m => m.mapUrl === id)?.displayName || ''
  const h = hover != null ? rows[hover] : null
  const last = pts[pts.length - 1]
  // entrance uses CSS keyframes (fill-mode both)
  const fade = (dur, delay = 0) => ({ animation: `fade ${dur}s ease ${delay}s both` })

  return (
    <div className='relative'>
      <svg viewBox={`0 0 ${W} ${H}`} className='w-full h-auto select-none overflow-visible'>
        <defs>
          <linearGradient id={gid + 'f'} x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' style={{ stopColor: 'rgb(var(--accent))', stopOpacity: 0.34 }} />
            <stop offset='100%' style={{ stopColor: 'rgb(var(--accent))', stopOpacity: 0 }} />
          </linearGradient>
          <linearGradient id={gid + 'l'} x1='0' y1='0' x2='1' y2='0'>
            <stop offset='0%' style={{ stopColor: 'rgb(var(--accent-2))' }} />
            <stop offset='100%' style={{ stopColor: 'rgb(var(--accent))' }} />
          </linearGradient>
        </defs>
        {grid.map(v => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className='stroke-line' strokeDasharray='2 6' strokeLinecap='round' />
            {tiers?.[v / 100] && <image href={tiers[v / 100].smallIcon} x={8} y={y(v) - 12} width={24} height={24} />}
          </g>
        ))}
        <path d={area} fill={`url(#${gid}f)`} style={fade(0.8, 0.1)} />
        <g style={fade(0.9, 0.2)}>
          <path d={line} fill='none' strokeWidth={10} strokeLinejoin='round' strokeLinecap='round' stroke='rgb(var(--accent))' opacity={0.14} />
        </g>
        <path d={line} fill='none' strokeWidth={3} strokeLinejoin='round' strokeLinecap='round' stroke={`url(#${gid}l)`}
          style={fade(0.6)} />
        {hover != null && <line x1={pts[hover][0]} x2={pts[hover][0]} y1={PT} y2={H - PB} className='stroke-line' strokeDasharray='3 4' />}
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className='cursor-pointer'>
            <circle cx={p[0]} cy={p[1]} r={14} fill='transparent' />
            <circle cx={p[0]} cy={p[1]} r={hover === i ? 6 : 4} className={rows[i].change >= 0 ? 'fill-good' : 'fill-bad'}
              style={{ ...fade(0.3, 0.4 + Math.min(i, 12) * 0.03), stroke: 'rgb(var(--panel))', strokeWidth: 2 }} />
            {rows[i].tierAfter !== rows[i - 1]?.tierAfter && tiers?.[rows[i].tierAfter] && i > 0 && i < rows.length - 1 &&
              <image href={tiers[rows[i].tierAfter].smallIcon} x={p[0] - 11} y={p[1] - 32} width={22} height={22} />}
          </g>
        ))}
        <g style={fade(0.6, 0.8)}><circle cx={last[0]} cy={last[1]} r={11} className='fill-accent' opacity={0.2} /></g>
        {tiers?.[rows[rows.length - 1].tierAfter] && <image href={tiers[rows[rows.length - 1].tierAfter].smallIcon} x={last[0] - 13} y={last[1] - 40} width={26} height={26} />}
      </svg>
      {h && (
        <div className='anim-pop absolute top-1 right-1 rounded-xl border border-line bg-panel/95 shadow-[0_12px_32px_-12px_rgb(0_0_0/0.5)] px-3.5 py-2.5 text-xs pointer-events-none'>
          <div className='font-display text-[13px] font-bold tracking-tight text-text'>{mapName(h.mapId) || 'Competitive'} <span className={h.change >= 0 ? 'text-good tabular-nums' : 'text-bad tabular-nums'}>{h.change >= 0 ? '+' : ''}{h.change} RR</span></div>
          <div className='mt-0.5 text-muted tabular-nums'>{tiers?.[h.tierAfter]?.tierName || ''} {h.rrAfter} RR - {new Date(h.time).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  )
}
