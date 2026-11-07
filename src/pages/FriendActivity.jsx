import { useMemo, useState } from 'react'
import { FiActivity, FiClock, FiCopy, FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiUserMinus, FiUserPlus, FiUsers } from 'react-icons/fi'
import { Button, Empty, ErrorState, Modal, Page, RequireRiot, Skeleton, Stagger, Item, toast, withToast } from '../ui'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { cx, timeAgo } from './history/shared'
import { ListLabel, ListRow, Pane, SearchField, SPLIT_BODY, SplitView } from './friends/Layout'

// Feed: who joined, left or renamed on your friends list. Spectre checks every couple of minutes.
const KIND = {
  removed: { label: 'Removed', long: 'Friend removed', icon: FiUserMinus, tone: 'text-bad', soft: 'bg-bad/12 border-bad/30' },
  added: { label: 'Added', long: 'Friend added', icon: FiUserPlus, tone: 'text-good', soft: 'bg-good/12 border-good/30' },
  renamed: { label: 'Name changes', long: 'Name changed', icon: FiEdit2, tone: 'text-accent-2', soft: 'bg-accent-2/12 border-accent-2/30' },
}

// Day bucket for the timeline headers.
function dayLabel(ms) {
  const d = new Date(ms), now = new Date()
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'long', day: 'numeric' })
}

function EventRow({ e, index }) {
  const k = KIND[e.type]
  return (
    <Item index={index} className='group glass relative min-w-0 flex items-center gap-4 rounded-2xl pl-4 pr-3 py-3.5 2xl:last:odd:col-span-2'>
      <span className={cx('w-10 h-10 shrink-0 rounded-2xl border flex items-center justify-center', k.soft, k.tone)}><k.icon size={16} /></span>
      <div className='min-w-0 flex-1'>
        <p className='text-[14px] text-text/80 truncate'>
          {e.type === 'renamed'
            ? <><span className='font-semibold text-text'>{e.from}</span> is now <span className={cx('font-semibold', k.tone)}>{e.name}</span></>
            : <><span className='font-semibold text-text'>{e.name}</span> {e.type === 'added' ? 'joined your friends list' : 'left your friends list'}</>}
        </p>
        <div className='flex items-center gap-2 mt-1 text-[11.5px] text-muted'>
          <span className={cx('font-semibold', k.tone)}>{k.long}</span>
          <span className='w-1 h-1 rounded-full bg-muted/50' />
          <span className='inline-flex items-center gap-1'><FiClock size={11} />{timeAgo(e.at)}</span>
        </div>
      </div>
      <Button size='sm' variant='ghost' icon={FiCopy} title='Copy Riot ID' className='opacity-60 group-hover:opacity-100'
        onClick={() => navigator.clipboard.writeText(e.name).then(() => toast.success(`Copied ${e.name}`))}>Copy ID</Button>
    </Item>
  )
}

export default function FriendActivity() {
  const riot = useRiot()
  const log = useInvoke('friendlog:list', [], { deps: [riot.puuid] })
  useEvent('friendlog:changed', () => log.reload(true))
  const [filter, setFilter] = useState('all')
  const [q, setQ] = useState('')
  const [scanning, setScanning] = useState(false)
  const [confirm, setConfirm] = useState(false)

  const events = log.data?.events || []
  const counts = useMemo(() => events.reduce((c, e) => ({ ...c, [e.type]: (c[e.type] || 0) + 1 }), {}), [events])
  const shown = events.filter(e => (filter === 'all' || e.type === filter)
    && (!q || `${e.name} ${e.from || ''}`.toLowerCase().includes(q.toLowerCase())))
  const days = useMemo(() => {
    const out = []
    for (const e of shown) {
      const label = dayLabel(e.at)
      if (out[out.length - 1]?.label !== label) out.push({ label, items: [] })
      out[out.length - 1].items.push(e)
    }
    return out
  }, [shown])

  const scan = async () => {
    setScanning(true)
    const before = events.length
    const r = await withToast(invoke('friendlog:scan'))
    setScanning(false)
    if (!r) return
    log.reload(true)
    const found = r.events.length - before
    toast(found > 0 ? `${found} new ${found === 1 ? 'change' : 'changes'}` : 'No changes since the last check')
  }
  const clear = async () => {
    setConfirm(false)
    if (await withToast(invoke('friendlog:clear'), 'Feed cleared')) log.reload(true)
  }

  const title = 'Feed', subtitle = 'New friends, removals and name changes, as they happen'
  if (!riot.connected) return <Page title={title} subtitle={subtitle}><RequireRiot hint='Open the Riot Client to see changes to your friends list.' /></Page>

  const filters = [
    { value: 'all', label: 'Everything', icon: FiActivity, tone: 'text-accent', soft: 'bg-accent/12 border-accent/30', count: events.length },
    ...Object.entries(KIND).map(([value, k]) => ({ value, label: k.label, icon: k.icon, tone: k.tone, soft: k.soft, count: counts[value] || 0 })),
  ]
  const list = (
    <Pane title='Filter' header={<SearchField value={q} onChange={setQ} placeholder='Search by name' />}
      footer={<div className='flex items-center gap-2'>
        <Button className='flex-1' icon={FiRefreshCw} loading={scanning} onClick={scan}>Scan now</Button>
        <Button variant='ghost' size='icon' icon={FiTrash2} title='Clear feed' disabled={!events.length} onClick={() => setConfirm(true)} />
      </div>}>
      <div className='flex flex-col gap-0.5'>
        {filters.map(f => (
          <ListRow as='button' key={f.value} selected={filter === f.value} layoutId='squad-feed' onClick={() => setFilter(f.value)}>
            <span className={cx('relative w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center', f.soft, f.tone)}><f.icon size={15} /></span>
            <span className='relative flex-1 text-[13.5px] font-semibold text-text'>{f.label}</span>
            <span className='relative font-display text-[17px] font-bold tabular-nums text-text'>{f.count}</span>
          </ListRow>
        ))}
      </div>
      {log.data && (
        <>
          <ListLabel>Watching</ListLabel>
          <div className='glass-inset rounded-2xl mx-1 px-4 py-3 flex items-center gap-3'>
            <span className='font-display text-[24px] font-bold tracking-tight tabular-nums leading-none'>{log.data.friends ?? 0}</span>
            <span className='text-[11.5px] text-muted leading-snug'>friends<br />{log.data.lastScan ? `checked ${timeAgo(log.data.lastScan)}` : log.data.tracking ? 'tracking on' : 'not tracking yet'}</span>
          </div>
        </>
      )}
    </Pane>
  )

  return (
    <Page title={title} subtitle={subtitle} bodyClassName={SPLIT_BODY}>
      <SplitView list={list} listWidth={300}>
        {log.error && !log.data ? <ErrorState error={log.error} onRetry={log.reload} />
          : log.loading && !log.data ? <div className='flex flex-col gap-2.5'>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className='h-[72px] rounded-2xl' />)}</div>
            : !events.length ? (
              <Empty icon={FiUsers} className='h-full'
                title={log.data?.tracking ? 'No changes yet' : 'Tracking starts on the first scan'}
                hint={log.data?.tracking
                  ? `Watching ${log.data.friends} friends. Adds, removals and name changes show up here as they happen.`
                  : 'Spectre saves your current friends list, then records every change after that.'}
                action={!log.data?.tracking && <Button variant='primary' icon={FiRefreshCw} loading={scanning} onClick={scan}>Start tracking</Button>} />
            ) : !shown.length ? <Empty icon={FiSearch} title='Nothing matches' hint='Try another filter or search.' className='h-full' />
              : (
                <Stagger key={filter + q} className='flex flex-col gap-2'>
                  {(() => {
                    let n = 0
                    return days.map(d => (
                      <div key={d.label} className='flex flex-col gap-2'>
                        <div className='eyebrow px-1 pt-3 first:pt-0'>{d.label}</div>
                        <div className='grid grid-cols-1 2xl:grid-cols-2 gap-2'>
                          {d.items.map(e => <EventRow key={e.id} e={e} index={n++} />)}
                        </div>
                      </div>
                    ))
                  })()}
                </Stagger>
              )}
      </SplitView>

      <Modal open={confirm} onClose={() => setConfirm(false)} width={400} title='Clear the feed?'
        footer={<><Button variant='ghost' onClick={() => setConfirm(false)}>Cancel</Button><Button variant='danger' icon={FiTrash2} onClick={clear}>Clear</Button></>}>
        <p className='text-[13px] text-muted'>The timeline is emptied. Spectre keeps watching your friends list and records new changes from now on.</p>
      </Modal>
    </Page>
  )
}
