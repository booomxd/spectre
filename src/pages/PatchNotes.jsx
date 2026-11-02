import { FiExternalLink } from 'react-icons/fi'
import { Button, Card, Empty, ErrorState, Page, Skeleton } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'

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

export default function PatchNotes() {
  const { data, error, loading, reload } = useInvoke('patchnotes:list')
  const [first, ...rest] = data || []
  return (
    <Page title='Patch Notes' subtitle='Recent VALORANT updates from the official site'
      actions={<Button size='sm' onClick={() => reload()}>Refresh</Button>}>
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
    </Page>
  )
}
