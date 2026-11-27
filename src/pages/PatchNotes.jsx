import { For, createSignal, Show } from 'solid-js'
import { FiArrowUpRight, FiChevronDown, FiExternalLink } from 'solid-icons/fi'
import { Badge, Button, Card, Empty, ErrorState, FadeIn, Item, Page, SegmentedTabs, Skeleton, Stagger, Swap, cx } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'
import logo from '../assets/spectre-logo.svg'

const fmt = d => d ? new Date(d).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' }) : ''

// latest VALORANT patch: full-bleed art with the title over it
function Featured(props) {
  return (
    <Card hover class='group overflow-hidden relative rounded-3xl' onClick={() => openExternal(props.n.url)}>
      <div class='aspect-[21/9] overflow-hidden glass-inset'>
        {props.n.image && <img decoding='async' src={props.n.image} alt='' class='w-full h-full object-cover transition-transform duration-700 ease-out group-hover:scale-[1.03]' draggable={false} />}
      </div>
      <div class='absolute inset-0 bg-gradient-to-t from-black/85 via-black/35 to-transparent' />
      <div class='absolute inset-x-0 bottom-0 p-7 flex items-end justify-between gap-5'>
        <div class='min-w-0'>
          <span class='inline-flex items-center h-6 px-2.5 rounded-full bg-white/12 border border-white/15 text-[11px] font-semibold text-white/85'>Latest · {fmt(props.n.date)}</span>
          <h2 class='display text-[32px] text-white mt-3 drop-shadow-[0_4px_20px_rgb(0_0_0/0.5)]'>{props.n.title}</h2>
          {props.n.description && <p class='text-[13px] text-white/70 mt-1.5 max-w-lg leading-relaxed line-clamp-2'>{props.n.description}</p>}
        </div>
        <span class='w-11 h-11 rounded-full bg-white/12 border border-white/20 text-white flex items-center justify-center shrink-0 transition-transform duration-300 group-hover:translate-x-0.5'><FiArrowUpRight size={18} /></span>
      </div>
    </Card>
  )
}

function NoteRow(props) {
  return (
    <Item index={props.index}>
      <Card hover class='group overflow-hidden flex items-stretch rounded-2xl' onClick={() => openExternal(props.n.url)}>
        <div class='w-44 min-h-[92px] shrink-0 overflow-hidden bg-surface-2'>
          {props.n.image && <img decoding='async' src={props.n.image} alt='' loading='lazy' class='w-full h-full object-cover transition-transform duration-500 ease-out group-hover:scale-105' draggable={false} />}
        </div>
        <div class='px-5 py-4 flex-1 min-w-0 flex flex-col justify-center gap-1'>
          <span class='text-[11.5px] font-medium text-muted tabular-nums'>{fmt(props.n.date)}</span>
          <h3 class='font-display text-[16px] font-bold tracking-tight leading-snug text-text truncate'>{props.n.title}</h3>
          {props.n.description && <p class='text-[12px] text-muted line-clamp-1 leading-relaxed'>{props.n.description}</p>}
        </div>
        <span class='self-center mr-5 w-8 h-8 rounded-full glass flex items-center justify-center text-muted group-hover:text-accent transition-colors shrink-0'><FiArrowUpRight /></span>
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
    if (t.startsWith('**')) out.push(<b class='text-text'>{t.slice(2, -2)}</b>)
    else if (t.startsWith('`')) out.push(<code class='px-1.5 py-px rounded-md glass-inset text-text text-[0.9em]'>{t.slice(1, -1)}</code>)
    else if (t.startsWith('[')) {
      const [, label, url] = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(t)
      out.push(<button class='text-accent hover:underline' onClick={() => openExternal(url)}>{label}</button>)
    } else out.push(<i>{t.slice(1, -1)}</i>)
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
function Markdown(props) {
  return () => {
    const blocks = []
    let list = null
    const flush = () => { if (list) { blocks.push(<ul class='list-disc pl-5 space-y-1.5 marker:text-accent'>{list}</ul>); list = null } }
    for (const raw of props.text.replace(/\r/g, '').split('\n')) {
    const line = raw.trimEnd()
    const item = /^\s*[-*]\s+(.*)$/.exec(line)
    const head = /^(#{1,4})\s+(.*)$/.exec(line)
    if (item) { (list = list || []).push(<li>{inline(item[1])}</li>); continue }
    flush()
    if (head) blocks.push(<div class={head[1].length <= 2 ? 'font-display text-lg font-bold tracking-tight text-text mt-3' : 'text-[13px] font-semibold text-text mt-2'}>{inline(head[2])}</div>)
    else if (line.trim()) blocks.push(<p>{inline(line)}</p>)
  }
    flush()
    return <div class='flex flex-col gap-2.5 text-[13px] text-muted leading-relaxed'>{blocks}</div>
  }
}

// Spectre's own releases from GitHub, newest first, on a timeline
function SpectreNotes() {
  const __invoke = useInvoke('spectre:releases')
  const status = useInvoke('update:status')
  const [openS, setOpen] = createSignal(null)
  
    
    
    
    const current = () => (status.data?.current)
    return (<Show when={!(__invoke.loading && !__invoke.data)} fallback={<div class='grid gap-4'><For each={[0, 1, 2]}>{i => <Skeleton class='h-24 rounded-2xl' />}</For></div>}><Show when={!(__invoke.error && !__invoke.data)} fallback={<ErrorState error={__invoke.error} onRetry={__invoke.reload} />}><Show when={!(!__invoke.data?.length)} fallback={<Empty title='No Spectre releases yet' />}><Stagger class='relative flex flex-col gap-4'>
      <span class='absolute left-[21px] top-8 bottom-8 w-px bg-gradient-to-b from-accent/60 via-line to-transparent' />
      <For each={__invoke.data}>{(r, i) => {
        const expanded = () => (openS() === null ? i() === 0 : openS() === r.version)
        return (
          <Item index={i()} class='relative flex gap-5'>
            <span class={cx('relative z-[1] mt-4 w-11 h-11 rounded-2xl shrink-0 flex items-center justify-center', i() === 0 ? 'accent-soft' : 'glass')}>
              <img decoding='async' src={logo} alt='' class='w-6 h-6' draggable={false} />
            </span>
            <Card class='flex-1 min-w-0 rounded-2xl'>
              <button class='w-full flex items-center gap-4 text-left px-6 py-[18px]' onClick={() => setOpen(expanded() ? '' : r.version)}>
                <div class='min-w-0 flex-1'>
                  <div class='flex items-center gap-2 flex-wrap'>
                    <span class='font-display text-[19px] font-bold tracking-tight text-text'>{r.name}</span>
                    {i() === 0 && <Badge tone='accent'>Latest</Badge>}
                    {r.version === current() && <Badge tone='good'>Installed</Badge>}
                  </div>
                  <div class='text-[12px] text-muted mt-0.5 tabular-nums'>{fmt(r.date)}</div>
                </div>
                <span class='w-8 h-8 rounded-full glass-inset flex items-center justify-center shrink-0'><FiChevronDown class={cx('text-muted transition-transform duration-300 ease-out', expanded() && 'rotate-180')} /></span>
              </button>
              {expanded() && (
                <FadeIn y={4} class='px-6 pb-6'>
                  <div class='hairline mb-5' />
                  <Markdown text={r.notes} />
                  <Button size='sm' variant='ghost' icon={FiExternalLink} class='mt-4 -ml-3' onClick={() => openExternal(r.url)}>View on GitHub</Button>
                </FadeIn>
              )}
            </Card>
          </Item>
        )
      }}</For>
    </Stagger></Show></Show></Show>)
  
}

export default function PatchNotes() {
  const [tabS, setTab] = createSignal('spectre')
  return (
    <Page title="What's new" subtitle={tabS() === 'spectre' ? 'Every Spectre release, newest first' : 'Recent VALORANT updates from the official site'}
      actions={<SegmentedTabs layoutId='whatsnew-tab' value={tabS()} onChange={setTab} tabs={[{ value: 'spectre', label: 'Spectre' }, { value: 'valorant', label: 'VALORANT' }]} />}>
      <div class='max-w-3xl pb-4'>
        <Swap id={tabS()}>{tabS() === 'spectre' ? <SpectreNotes /> : <ValorantNotes />}</Swap>
      </div>
    </Page>
  )
}

function ValorantNotes() {
  const __invoke = useInvoke('patchnotes:list')
  
    const first = () => ((__invoke.data || [])[0])
    const rest = () => ((__invoke.data || []).slice(1))
    
    
    
    return (<Show when={!(__invoke.loading && !__invoke.data)} fallback={<div class='grid gap-4'><Skeleton class='aspect-[21/9] rounded-3xl' /><For each={[0, 1, 2]}>{i => <Skeleton class='h-24 rounded-2xl' />}</For></div>}><Show when={!(__invoke.error && !__invoke.data)} fallback={<ErrorState error={__invoke.error} onRetry={__invoke.reload} />}><Show when={!(!first())} fallback={<Empty title='No patch notes found' hint='Try again in a moment.' />}><div class='flex flex-col gap-6'>
      <FadeIn><Featured n={first()} /></FadeIn>
      {rest().length > 0 && <div class='eyebrow px-1 -mb-2'>Earlier</div>}
      <Stagger class='flex flex-col gap-3'>
        <For each={rest()}>{(n, i) => <NoteRow n={n} index={i()} />}</For>
      </Stagger>
    </div></Show></Show></Show>)
  
}
