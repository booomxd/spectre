import { useState } from 'react'
import { FiChevronDown, FiExternalLink } from 'react-icons/fi'
import { Badge, Button, Card, Empty, ErrorState, Page, Skeleton, Tabs } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'
import logo from '../assets/spectre-logo.svg'

const fmt = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

function Featured({ n }) {
  return (
    <Card className='anim-rise overflow-hidden relative group'>
      <div className='aspect-[21/8] overflow-hidden bg-surface-2'>
        {n.image && <img src={n.image} alt='' className='w-full h-full object-cover transition-transform duration-700 group-hover:scale-105' />}
      </div>
      <div className='absolute inset-0 bg-gradient-to-t from-bg via-bg/60 to-transparent' />
      <div className='absolute inset-x-0 bottom-0 p-6 flex items-end justify-between gap-4'>
        <div className='min-w-0'>
          <span className='text-[10px] font-bold tracking-[0.2em] uppercase text-accent'>Latest · {fmt(n.date)}</span>
          <h2 className='font-display text-3xl font-bold uppercase leading-tight mt-1'>{n.title}</h2>
          {n.description && <p className='text-[13px] text-muted mt-1 max-w-xl'>{n.description}</p>}
        </div>
        <Button variant='primary' icon={FiExternalLink} onClick={() => openExternal(n.url)}>Read</Button>
      </div>
    </Card>
  )
}

function NoteCard({ n, i }) {
  return (
    <Card hover className='anim-rise overflow-hidden flex flex-col' style={{ '--i': i }} onClick={() => openExternal(n.url)}>
      <div className='aspect-video bg-surface-2 overflow-hidden'>
        {n.image && <img src={n.image} alt='' loading='lazy' className='w-full h-full object-cover' />}
      </div>
      <div className='p-4 flex flex-col gap-1 flex-1'>
        <span className='text-[10px] font-semibold tracking-[0.16em] uppercase text-muted'>{fmt(n.date)}</span>
        <h3 className='font-display text-lg font-bold uppercase leading-tight'>{n.title}</h3>
        {n.description && <p className='text-xs text-muted line-clamp-2'>{n.description}</p>}
        <span className='mt-auto pt-2 text-xs font-semibold text-accent inline-flex items-center gap-1.5'>Read <FiExternalLink /></span>
      </div>
    </Card>
  )
}

// Minimal Markdown for GitHub release notes: headings, bullet lists, paragraphs, **bold**, _italic_, `code`, [links](url).
function inline(text) {
  const out = []
  const re = /(\*\*[^*]+\*\*|_[^_]+_|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m
  while ((m = re.exec(text))) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0], k = out.length
    if (t.startsWith('**')) out.push(<b key={k} className='text-text'>{t.slice(2, -2)}</b>)
    else if (t.startsWith('`')) out.push(<code key={k} className='px-1 rounded bg-surface-2 text-[0.9em]'>{t.slice(1, -1)}</code>)
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
  const flush = () => { if (list) { blocks.push(<ul key={blocks.length} className='list-disc pl-5 space-y-1'>{list}</ul>); list = null } }
  for (const raw of text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const item = /^\s*[-*]\s+(.*)$/.exec(line)
    const head = /^(#{1,4})\s+(.*)$/.exec(line)
    if (item) { (list = list || []).push(<li key={list?.length || 0}>{inline(item[1])}</li>); continue }
    flush()
    if (head) blocks.push(<div key={blocks.length} className={head[1].length <= 2 ? 'font-display text-lg font-bold mt-2' : 'text-[13px] font-bold text-text mt-2'}>{inline(head[2])}</div>)
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>)
  }
  flush()
  return <div className='flex flex-col gap-2 text-[13px] text-muted leading-relaxed'>{blocks}</div>
}

// Spectre's own releases from GitHub, newest first; the newest is expanded.
function SpectreNotes() {
  const { data, error, loading, reload } = useInvoke('spectre:releases')
  const status = useInvoke('update:status')
  const [open, setOpen] = useState(null)
  if (loading && !data) return <div className='grid gap-3'>{[0, 1, 2].map(i => <Skeleton key={i} className='h-28 rounded-xl' />)}</div>
  if (error && !data) return <ErrorState error={error} onRetry={reload} />
  if (!data?.length) return <Empty title='No Spectre releases yet' />
  const current = status.data?.current
  return (
    <div className='grid gap-3 max-w-4xl stagger'>
      {data.map((r, i) => {
        const expanded = open === null ? i === 0 : open === r.version
        return (
          <Card key={r.version} className='anim-rise p-5' style={{ '--i': i }}>
            <button className='w-full flex items-center gap-3 text-left' onClick={() => setOpen(expanded ? '' : r.version)}>
              <img src={logo} alt='' className='w-9 h-9 shrink-0' draggable={false} />
              <div className='min-w-0 flex-1'>
                <div className='flex items-center gap-2'>
                  <span className='font-display text-xl font-bold'>{r.name}</span>
                  {i === 0 && <Badge tone='accent'>Latest</Badge>}
                  {r.version === current && <Badge tone='good'>Installed</Badge>}
                </div>
                <div className='text-[11px] text-muted'>{fmt(r.date)}</div>
              </div>
              <FiChevronDown className={'text-muted transition-transform ' + (expanded ? 'rotate-180' : '')} />
            </button>
            {expanded && (
              <div className='anim-fade mt-4 pt-4 border-t border-line'>
                <Markdown text={r.notes} />
                <Button size='sm' variant='ghost' icon={FiExternalLink} className='mt-4' onClick={() => openExternal(r.url)}>View on GitHub</Button>
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

export default function PatchNotes() {
  const [tab, setTab] = useState('spectre')
  return (
    <Page title='Patch Notes' subtitle={tab === 'spectre' ? "What's new in Spectre" : 'Recent VALORANT updates from the official site'}>
      <Tabs className='mb-5' value={tab} onChange={setTab} tabs={[{ value: 'spectre', label: 'Spectre' }, { value: 'valorant', label: 'VALORANT' }]} />
      {tab === 'spectre' ? <SpectreNotes /> : <ValorantNotes />}
    </Page>
  )
}

function ValorantNotes() {
  const { data, error, loading, reload } = useInvoke('patchnotes:list')
  const [first, ...rest] = data || []
  return (
    <>
      {loading && !data ? (
        <div className='grid gap-4'>
          <Skeleton className='h-64 rounded-xl' />
          <div className='grid grid-cols-3 gap-4'>{[0, 1, 2].map(i => <Skeleton key={i} className='h-60 rounded-xl' />)}</div>
        </div>
      ) : error && !data ? <ErrorState error={error} onRetry={reload} />
        : !first ? <Empty title='No patch notes found' hint='Try again in a moment.' />
          : (
            <div className='flex flex-col gap-5'>
              <Featured n={first} />
              <div className='grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4 stagger'>
                {rest.map((n, i) => <NoteCard key={n.url} n={n} i={i} />)}
              </div>
            </div>
          )}
    </>
  )
}
