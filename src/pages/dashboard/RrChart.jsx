import { useEffect, useState } from 'react'
import { useContent, useTiers } from '../../lib/content'

const W = 800, H = 260, PL = 46, PR = 20, PT = 18, PB = 28

// Animated competitive ladder line chart. `rows` = [{ ladder, change, tierAfter, mapId, time }] oldest first.
export default function RrChart({ rows }) {
  const tiers = useTiers()
  const maps = useContent('maps')
  const [on, setOn] = useState(false)
  const [hover, setHover] = useState(null)
  useEffect(() => { const t = setTimeout(() => setOn(true), 60); return () => clearTimeout(t) }, [])

  const vals = rows.map(r => r.ladder)
  let lo = Math.floor((Math.min(...vals) - 15) / 50) * 50, hi = Math.ceil((Math.max(...vals) + 15) / 50) * 50
  if (hi - lo < 100) hi = lo + 100
  const x = i => PL + (rows.length === 1 ? (W - PL - PR) / 2 : i * (W - PL - PR) / (rows.length - 1))
  const y = v => PT + (1 - (v - lo) / (hi - lo)) * (H - PT - PB)
  const pts = rows.map((r, i) => [x(i), y(r.ladder)])
  const line = pts.map((p, i) => (i ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ')
  const area = `${line} L${pts[pts.length - 1][0]} ${H - PB} L${pts[0][0]} ${H - PB} Z`
  const grid = []
  for (let v = Math.ceil(lo / 100) * 100; v <= hi; v += 100) grid.push(v)
  const mapName = id => maps?.find(m => m.mapUrl === id)?.displayName || ''
  const h = hover != null ? rows[hover] : null

  return (
    <div className='relative'>
      <svg viewBox={`0 0 ${W} ${H}`} className='w-full h-auto select-none'>
        <defs>
          <linearGradient id='rrFill' x1='0' y1='0' x2='0' y2='1'>
            <stop offset='0%' style={{ stopColor: 'rgb(var(--accent))', stopOpacity: 0.32 }} />
            <stop offset='100%' style={{ stopColor: 'rgb(var(--accent))', stopOpacity: 0 }} />
          </linearGradient>
        </defs>
        {grid.map(v => (
          <g key={v}>
            <line x1={PL} x2={W - PR} y1={y(v)} y2={y(v)} className='stroke-line' strokeDasharray='2 6' strokeLinecap='round' />
            {tiers?.[v / 100] && <image href={tiers[v / 100].smallIcon} x={8} y={y(v) - 12} width={24} height={24} />}
          </g>
        ))}
        <path d={area} fill='url(#rrFill)' className='transition-opacity duration-1000' style={{ opacity: on ? 1 : 0 }} />
        <path d={line} pathLength={1} fill='none' strokeWidth={3} strokeLinejoin='round' strokeLinecap='round' className='stroke-accent'
          style={{ strokeDasharray: 1, strokeDashoffset: on ? 0 : 1, transition: 'stroke-dashoffset 1.3s cubic-bezier(.3,.7,.2,1)' }} />
        {pts.map((p, i) => (
          <g key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} className='cursor-pointer'>
            <circle cx={p[0]} cy={p[1]} r={14} fill='transparent' />
            <circle cx={p[0]} cy={p[1]} r={hover === i ? 6 : 4} className={rows[i].change >= 0 ? 'fill-good' : 'fill-bad'}
              style={{ opacity: on ? 1 : 0, stroke: 'rgb(var(--bg))', strokeWidth: 2, transition: `opacity .3s ${0.9 + i * 0.03}s, r .15s` }} />
            {rows[i].tierAfter !== rows[i - 1]?.tierAfter && tiers?.[rows[i].tierAfter] && i > 0 &&
              <image href={tiers[rows[i].tierAfter].smallIcon} x={p[0] - 11} y={p[1] - 32} width={22} height={22} />}
          </g>
        ))}
        {tiers?.[rows[rows.length - 1].tierAfter] && <image href={tiers[rows[rows.length - 1].tierAfter].smallIcon} x={pts[pts.length - 1][0] - 13} y={pts[pts.length - 1][1] - 38} width={26} height={26} />}
      </svg>
      {h && (
        <div className='glass-strong anim-pop absolute top-1 right-1 rounded-xl px-3.5 py-2.5 text-xs pointer-events-none'>
          <div className='font-display text-[13px] font-bold tracking-tight text-text'>{mapName(h.mapId) || 'Competitive'} <span className={h.change >= 0 ? 'text-good tabular-nums' : 'text-bad tabular-nums'}>{h.change >= 0 ? '+' : ''}{h.change} RR</span></div>
          <div className='mt-0.5 text-muted tabular-nums'>{tiers?.[h.tierAfter]?.tierName || ''} {h.rrAfter} RR - {new Date(h.time).toLocaleDateString()}</div>
        </div>
      )}
    </div>
  )
}
