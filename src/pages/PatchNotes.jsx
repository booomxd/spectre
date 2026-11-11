import { useState } from 'react'
import { FiArrowUpRight, FiChevronDown, FiExternalLink } from 'react-icons/fi'
import { Badge, Button, Card, Empty, ErrorState, FadeIn, Item, Page, SegmentedTabs, Skeleton, Stagger, Swap, cx } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'
import logo from '../assets/spectre-logo.svg'

const fmt = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

// latest VALORANT patch: full-bleed art with the title over it
function Featured({ n }) {
  return (
    <Card hover className='group overflow-hidden relative rounded-3xl' onClick={() => openExternal(n.url)}>
      <div className='aspect-[21/9] overflow-hidden glass-inset'>
        {n.image && <img decoding='async' src={n.image} alt='' className='w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]' draggable={false} />}
      </div>
      <div className='absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent' />
      <div className='absolute inset-x-0 bottom-0 p-7 flex items-end justify-between gap-5'>
        <div className='min-w-0'>
          <span className='inline-flex items-center h-6 px-2.5 rounded-full bg-white/12 border border-white/15 text-[11px] font-semibold text-white/85'>Latest · {fmt(n.date)}</span>
          <h2 className='display text-[32px] text-white mt-3 drop-shadow-[0_4px_20px_rgb(0_0_0/0.5)]'>{n.title}</h2>
          {n.description && <p className='text-[13px] text-white/70 mt-1.5 max-w-lg leading-relaxed line-clamp-2'>{n.description}</p>}
        </div>
        <span className='w-11 h-11 rounded-full bg-white/12 border border-white/20 text-white flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-0.5'><FiArrowUpRight size={18} /></span>
      </div>
    </Card>
  )
}

function NoteRow({ n, index }) {
  return (
    <Item index={index}>
      <Card hover className='group overflow-hidden flex items-stretch rounded-2xl' onClick={() => openExternal(n.url)}>
        <div className='w-44 min-h-[92px] shrink-0 overflow-hidden bg-surface-2'>
          {n.image && <img decoding='async' src={n.image} alt='' loading='lazy' className='w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105' draggable={false} />}
        </div>
        <div className='px-5 py-4 flex-1 min-w-0 flex flex-col justify-center gap-1'>
          <span className='text-[11.5px] font-medium text-muted tabular-nums'>{fmt(n.date)}</span>
          <h3 className='font-display text-[16px] font-bold tracking-tight leading-snug text-text truncate'>{n.title}</h3>
          {n.description && <p className='text-[12px] text-muted line-clamp-1 leading-relaxed'>{n.description}</p>}
        </div>
        <span className='self-center mr-5 w-8 h-8 rounded-full glass flex items-center justify-center text-muted group-hover:text-accent transition-colors shrink-0'><FiArrowUpRight /></span>
      </Card>
    </Item>
  )
}

// minimal Markdown for GitHub release notes: headings, bullet lists, paragraphs, **bold**, _italic_, `code`, [links]
function inline(text) {
  const out = []
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0], k = out.length
    if (t.startsWith('**')) out.push(<b key={k} className='text-text'>{t.slice(2, -2)}</b>)
    else if (t.startsWith('`')) out.push(<code key={k} className='px-1.5 py-px rounded-md glass-inset text-text text-[0.9em]'>{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) {
      const [, label, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)
      out.push(<button key={k} className='text-accent hover:underline' onClick={() => openExternal(url)}>{label}</button>)
    } else out.push(<i key={k}>{t.slice(1, -1)}</i>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
function Markdown({ text }) {
  const blocks = []
  let list = null
  const flush = () => { if (list) { blocks.push(<ul key={blocks.length} className='list-disc pl-5 space-y-1.5 marker:text-accent'>{list}</ul>); list = null } }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const item = /^\s*[-*]\s+(.*)$/.exec(line)
    const head = /^(#{1,4})\s+(.*)$/.exec(line)
    if (item) { (list = list || []).push(<li key={list?.length || 0}>{inline(item[1])}</li>); continue }
    flush()
    if (head) blocks.push(<div key={blocks.length} className={head[1].length <= 2 ? 'font-display text-lg font-bold tracking-tight text-text mt-3' : 'text-[13px] font-semibold text-text mt-2'}>{inline(head[2])}</div>)
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <div className='flex flex-col gap-2.5 text-[13px] text-muted leading-relaxed'>{blocks}</div>
}

// Spectre's own releases from GitHub, newest first, on a timeline
function SpectreNotes() {
  const { data, error, loading, reload } = useInvoke('spectre:releases')
  const status = useInvoke('update:status')
  const [open, setOpen] = useState(null)
  if (loading && !data) return <div className='grid gap-4'>{[0, 1, 2].map(i => <Skeleton key={i} className='h-24 rounded-2xl' />)}</div>
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data?.length) return <Empty title='No Spectre releases yet' />
  const current = status.data?.current
  return (
    <Stagger className='relative flex flex-col gap-4'>
      <span className='absolute left-[21px] top-8 bottom-8 w-px bg-gradient-to-b from-accent/60 via-line to-transparent' />
      {data.map((r, i) => {
        const expanded = open === null ? i === 0 : open === r.version
        return (
          <Item key={r.version} index={i} className='relative flex gap-5'>
            <span className={cx('relative z-[1] mt-4 w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center', i === 0 ? 'accent-soft' : 'glass')}>
              <img decoding='async' src={logo} alt='' className='w-6 h-6' draggable={false} />
            </span>
            <Card className='flex-1 min-w-0 rounded-2xl'>
              <button className='w-full flex items-center gap-4 text-left px-6 py-[18px]' onClick={() => setOpen(expanded ? '' : r.version)}>
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-2 flex-wrap'>
                    <span className='font-display text-[19px] font-bold tracking-tight text-text'>{r.name}</span>
                    {i === 0 && <Badge tone='accent'>Latest</Badge>}
                    {r.version === current && <Badge tone='good'>Installed</Badge>}
                  </div>
                  <div className='text-[12px] text-muted mt-0.5 tabular-nums'>{fmt(r.date)}</div>
                </div>
                <span className='w-8 h-8 rounded-full glass-inset flex items-center justify-center shrink-0'><FiChevronDown className={cx('text-muted transition-transform duration-300 ease-out', expanded && 'rotate-180')} /></span>
              </button>
              {expanded && (
                <FadeIn y={4} className='px-6 pb-6'>
                  <div className='hairline mb-5' />
                  <Markdown text={r.notes} />
                  <Button size='sm' variant='ghost' icon={FiExternalLink} className='mt-4 -ml-3' onClick={() => openExternal(r.url)}>View on GitHub</Button>
                </FadeIn>
              )}
            </Card>
          </Item>
        )
      })}
    </Stagger>
  )
}

export default function PatchNotes() {
  const [tab, setTab] = useState('spectre')
  return (
    <Page title="What's new" subtitle={tab === 'spectre' ? 'Every Spectre release, newest first' : 'Recent VALORANT updates from the official site'}
      actions={<SegmentedTabs layoutId='whatsnew-tab' value={tab} onChange={setTab} tabs={[{ value: 'spectre', label: 'Spectre' }, { value: 'valorant', label: 'VALORANT' }]} />}>
      <div className='max-w-3xl pb-4'>
        <Swap id={tab}>{tab === 'spectre' ? <SpectreNotes /> : <ValorantNotes />}</Swap>
      </div>
    </Page>
  )
}

function ValorantNotes() {
  const { data, error, loading, reload } = useInvoke('patchnotes:list')
  const [first, ...rest] = data || []
  if (loading && !data) return <div className='grid gap-4'><Skeleton className='aspect-[21/9] rounded-3xl' />{[0, 1, 2].map(i => <Skeleton key={i} className='h-24 rounded-2xl' />)}</div>
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!first) return <Empty title='No patch notes found' hint='Try again in a moment.' />
  return (
    <div className='flex flex-col gap-6'>
      <FadeIn><Featured n={first} /></FadeIn>
      {rest.length > 0 && <div className='eyebrow px-1 -mb-2'>Earlier</div>}
      <Stagger className='flex flex-col gap-3'>
        {rest.map((n, i) => <NoteRow key={n.url} n={n} index={i} />)}
      </Stagger>
    </div>
  )
}
