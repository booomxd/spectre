import { useMemo, useState } from 'react'
import { FiClock, FiCopy, FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiUserMinus, FiUserPlus, FiUsers } from 'react-icons/fi'
import { Button, Card, Empty, ErrorState, Input, Modal, Page, RequireRiot, Skeleton, Tabs, toast, withToast } from '../ui'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { cx, timeAgo } from './history/shared'

// Friend activity: who joined, left or renamed on your friends list. Spectre checks every couple of minutes.
const KIND = {
  removed: { label: 'Friend removed', icon: FiUserMinus, tone: 'text-bad', chip: 'bg-bad/15 text-bad border-bad/30', dot: 'bg-bad' },
  added: { label: 'Friend added', icon: FiUserPlus, tone: 'text-good', chip: 'bg-good/15 text-good border-good/30', dot: 'bg-good' },
  renamed: { label: 'Name changed', icon: FiEdit2, tone: 'text-sky-500', chip: 'bg-sky-500/15 text-sky-500 border-sky-500/30', dot: 'bg-sky-500' },
}

function EventRow({ e, i }) {
  const k = KIND[e.type]
  return (
    <div style={{ '--i': Math.min(i, 14) }} className='relative pl-8'>
      <span className={cx('absolute left-[7px] top-1/2 -translate-y-1/2 w-[9px] h-[9px] rounded-full shadow-[0_0_10px_currentColor]', k.dot, k.tone)} />
      <div className='glass flex items-center gap-4 rounded-xl px-4 py-3.5'>
        <span className={cx('w-10 h-10 shrink-0 rounded-xl flex items-center justify-center bg-surface-2 border border-line', k.tone)}><k.icon /></span>
        <div className='min-w-0 flex-1'>
          <div className='flex items-center gap-2 mb-1'>
            <span className={cx('inline-flex items-center h-5 px-2 rounded-full border text-[10px] font-semibold tracking-wide uppercase', k.chip)}>{k.label}</span>
            <span className='inline-flex items-center gap-1 text-[11px] text-muted'><FiClock size={11} />{timeAgo(e.at)}</span>
          </div>
          <p className='text-[14px] text-text/80 truncate'>
            {e.type === 'renamed'
              ? <><span className='font-semibold text-text'>{e.from}</span> is now <span className={cx('font-semibold', k.tone)}>{e.name}</span>.</>
              : <><span className={cx('font-semibold', k.tone)}>{e.name}</span> {e.type === 'added' ? 'was added to your friends list.' : 'is no longer on your friends list.'}</>}
          </p>
        </div>
        <Button size='sm' variant='ghost' icon={FiCopy} title='Copy Riot ID'
          onClick={() => navigator.clipboard.writeText(e.name).then(() => toast.success(`Copied ${e.name}`))}>Copy ID</Button>
      </div>
    </div>
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
  const tabs = [
    { value: 'all', label: <>All <span className='ml-1 text-muted tabular-nums'>{events.length}</span></> },
    { value: 'removed', label: <>Removals <span className='ml-1 text-bad tabular-nums'>{counts.removed || 0}</span></> },
    { value: 'added', label: <>Added <span className='ml-1 text-good tabular-nums'>{counts.added || 0}</span></> },
    { value: 'renamed', label: <>Name changes <span className='ml-1 text-sky-500 tabular-nums'>{counts.renamed || 0}</span></> },
  ]

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
    if (await withToast(invoke('friendlog:clear'), 'Activity cleared')) log.reload(true)
  }

  const title = 'Friend activity', subtitle = 'New friends, removals and name changes, all in one place'
  if (!riot.connected) return <Page title={title} subtitle={subtitle}><RequireRiot hint='Open the Riot Client to see changes to your friends list.' /></Page>

  return (
    <Page title={title} subtitle={subtitle}
      actions={<>
        <Button icon={FiRefreshCw} loading={scanning} onClick={scan}>Scan changes</Button>
        <Button variant='ghost' icon={FiTrash2} disabled={!events.length} onClick={() => setConfirm(true)}>Clear</Button>
      </>}>
      <Card className='p-3 mb-5 flex items-center justify-between gap-3 rounded-2xl'>
        <Tabs tabs={tabs} value={filter} onChange={setFilter} />
        <div className='relative w-[260px] shrink-0'>
          <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' />
          <Input className='!pl-9 !rounded-full' value={q} onChange={e => setQ(e.target.value)} placeholder='Search by name' />
        </div>
      </Card>

      {log.error && !log.data ? <ErrorState error={log.error} onRetry={log.reload} />
        : log.loading && !log.data ? <div className='flex flex-col gap-2.5'>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className='h-[76px] rounded-xl' />)}</div>
          : !events.length ? (
            <Empty icon={FiUsers}
              title={log.data?.tracking ? 'No changes yet' : 'Tracking starts on the first scan'}
              hint={log.data?.tracking
                ? `Watching ${log.data.friends} friends. Adds, removals and name changes show up here as they happen.`
                : 'Spectre saves your current friends list, then records every change after that.'}
              action={!log.data?.tracking && <Button variant='primary' icon={FiRefreshCw} loading={scanning} onClick={scan}>Start tracking</Button>} />
          ) : !shown.length ? <Empty icon={FiSearch} title='Nothing matches' hint='Try another filter or search.' />
            : (
              <div className='relative'>
                <span className='absolute left-[11px] top-2 bottom-2 w-px bg-line' />
                <div className='stagger flex flex-col gap-2.5'>{shown.map((e, i) => <EventRow key={e.id} e={e} i={i} />)}</div>
              </div>
            )}
      {log.data?.lastScan && <p className='mt-5 text-center text-[12px] text-muted'>Last checked {timeAgo(log.data.lastScan)} · {log.data.friends} friends</p>}

      <Modal open={confirm} onClose={() => setConfirm(false)} width={400} title='Clear friend activity?'
        footer={<><Button variant='ghost' onClick={() => setConfirm(false)}>Cancel</Button><Button variant='danger' icon={FiTrash2} onClick={clear}>Clear</Button></>}>
        <p className='text-[13px] text-muted'>The timeline is emptied. Spectre keeps watching your friends list and records new changes from now on.</p>
      </Modal>
    </Page>
  )
}
