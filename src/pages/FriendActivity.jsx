import { Dynamic } from 'solid-js/web'
import { For, createSignal, Show, createMemo } from 'solid-js'
import { FiActivity, FiClock, FiCopy, FiEdit2, FiRefreshCw, FiSearch, FiTrash2, FiUserMinus, FiUserPlus, FiUsers } from 'solid-icons/fi'
import { Button, Empty, ErrorState, Modal, Page, RequireRiot, Skeleton, Stagger, Item, toast, withToast } from '../ui'
import { invoke, useEvent, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { cx, timeAgo } from './history/shared'
import { ListLabel, ListRow, Pane, SearchField, SPLIT_BODY, SplitView } from './friends/Layout'

// Feed: who joined, left or renamed on your friends list
const KIND = {
  removed: { label: 'Removed', long: 'Friend removed', icon: FiUserMinus, tone: 'text-bad', soft: 'bg-bad/12 border-bad/30' },
  added: { label: 'Added', long: 'Friend added', icon: FiUserPlus, tone: 'text-good', soft: 'bg-good/12 border-good/30' },
  renamed: { label: 'Name changes', long: 'Name changed', icon: FiEdit2, tone: 'text-accent-2', soft: 'bg-accent-2/12 border-accent-2/30' },
}

// day bucket for the timeline headers
function dayLabel(ms) {
  const d = new Date(ms), now = new Date()
  const days = Math.round((new Date(now.toDateString()) - new Date(d.toDateString())) / 86400000)
  if (days === 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return d.toLocaleDateString([], { weekday: 'long' })
  return d.toLocaleDateString([], { month: 'long', day: 'numeric' })
}

function EventRow(props) {
  
    const k = () => (KIND[props.e.type])
    return (<Item index={props.index} class='group glass relative flex items-center gap-4 rounded-2xl pl-4 pr-3 py-3.5'>
      <span class={cx('w-10 h-10 shrink-0 rounded-2xl border flex items-center justify-center', k().soft, k().tone)}><Dynamic component={k().icon} size={16} /></span>
      <div class='min-w-0 flex-1'>
        <p class='text-[14px] text-text/80 truncate'>
          {props.e.type === 'renamed'
            ? <><span class='font-semibold text-text'>{props.e.from}</span> is now <span class={cx('font-semibold', k().tone)}>{props.e.name}</span></>
            : <><span class='font-semibold text-text'>{props.e.name}</span> {props.e.type === 'added' ? 'joined your friends list' : 'left your friends list'}</>}
        </p>
        <div class='flex items-center gap-2 mt-1 text-[11.5px] text-muted'>
          <span class={cx('font-semibold', k().tone)}>{k().long}</span>
          <span class='w-1 h-1 rounded-full bg-muted/50' />
          <span class='inline-flex items-center gap-1'><FiClock size={11} />{timeAgo(props.e.at)}</span>
        </div>
      </div>
      <Button size='sm' variant='ghost' icon={FiCopy} title='Copy Riot ID' class='opacity-60 group-hover:opacity-100'
        onClick={() => navigator.clipboard.writeText(props.e.name).then(() => toast.success(`Copied ${props.e.name}`))}>Copy ID</Button>
    </Item>)
  
}

export default function FriendActivity() {
  const riotA = useRiot()
  const log = useInvoke('friendlog:list', [], { deps: () => ([riotA().puuid]) })
  useEvent('friendlog:changed', () => log.reload(true))
  const [filterS, setFilter] = createSignal('all')
  const [qS, setQ] = createSignal('')
  const [scanningS, setScanning] = createSignal(false)
  const [confirmS, setConfirm] = createSignal(false)
  
    const events = () => (log.data?.events || [])
    const counts = createMemo(() => events().reduce((c, e) => ({ ...c, [e.type]: (c[e.type] || 0) + 1 }), {}))
    const shown = () => (events().filter(e => (filterS() === 'all' || e.type === filterS())
    && (!qS() || `${e.name} ${e.from || ''}`.toLowerCase().includes(qS().toLowerCase()))))
    const days = createMemo(() => {
    const out = []
    for (const e of shown()) {
      const label = dayLabel(e.at)
      if (out[out.length - 1]?.label !== label) out.push({ label, items: [] })
      out[out.length - 1].items.push(e)
    }
    return out
  })
    const scan = async () => {
    setScanning(true)
    const before = events().length
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
    const title = () => ('Feed'), subtitle = () => ('New friends, removals and name changes, as they happen')
    
    const filters = () => ([
    { value: 'all', label: 'Everything', icon: FiActivity, tone: 'text-accent', soft: 'bg-accent/12 border-accent/30', count: events().length },
    ...Object.entries(KIND).map(([value, k]) => ({ value, label: k.label, icon: k.icon, tone: k.tone, soft: k.soft, count: counts()[value] || 0 })),
  ])
    const list = (
    () => (<Pane title='Filter' header={<SearchField value={qS()} onChange={setQ} placeholder='Search by name' />}
      footer={<div class='flex items-center gap-2'>
        <Button class='flex-1' icon={FiRefreshCw} loading={scanningS()} onClick={scan}>Scan now</Button>
        <Button variant='ghost' size='icon' icon={FiTrash2} title='Clear feed' disabled={!events().length} onClick={() => setConfirm(true)} />
      </div>}>
      <div class='flex flex-col gap-0.5'>
        <For each={filters()}>{f => (
          <ListRow as='button' selected={filterS() === f.value} layoutId='squad-feed' onClick={() => setFilter(f.value)}>
            <span class={cx('relative w-9 h-9 shrink-0 rounded-xl border flex items-center justify-center', f.soft, f.tone)}><f.icon size={15} /></span>
            <span class='relative flex-1 text-[13.5px] font-semibold text-text'>{f.label}</span>
            <span class='relative font-display text-[17px] font-bold tabular-nums text-text'>{f.count}</span>
          </ListRow>
        )}</For>
      </div>
      {log.data && (
        <>
          <ListLabel>Watching</ListLabel>
          <div class='glass-inset rounded-2xl mx-1 px-4 py-3 flex items-center gap-3'>
            <span class='font-display text-[24px] font-bold tracking-tight tabular-nums leading-none'>{log.data.friends ?? 0}</span>
            <span class='text-[11.5px] text-muted leading-snug'>friends<br />{log.data.lastScan ? `checked ${timeAgo(log.data.lastScan)}` : log.data.tracking ? 'tracking on' : 'not tracking yet'}</span>
          </div>
        </>
      )}
    </Pane>)
  )
    return (<Show when={!(!riotA().connected)} fallback={<Page title={title()} subtitle={subtitle()}><RequireRiot hint='Open the Riot Client to see changes to your friends list.' /></Page>}><Page title={title()} subtitle={subtitle()} bodyClass={SPLIT_BODY}>
      <SplitView list={list()} listWidth={300}>
        {log.error && !log.data ? <ErrorState error={log.error} onRetry={log.reload} />
          : log.loading && !log.data ? <div class='flex flex-col gap-2.5'>{Array.from({ length: 6 }, (_, i) => <Skeleton class='h-[72px] rounded-2xl' />)}</div>
            : !events().length ? (
              <Empty icon={FiUsers} class='h-full'
                title={log.data?.tracking ? 'No changes yet' : 'Tracking starts on the first scan'}
                hint={log.data?.tracking
                  ? `Watching ${log.data.friends} friends. Adds, removals and name changes show up here as they happen.`
                  : 'Spectre saves your current friends list, then records every change after that.'}
                action={!log.data?.tracking && <Button variant='primary' icon={FiRefreshCw} loading={scanningS()} onClick={scan}>Start tracking</Button>} />
            ) : !shown().length ? <Empty icon={FiSearch} title='Nothing matches' hint='Try another filter or search.' class='h-full' />
              : (
                <Stagger class='flex flex-col gap-2'>
                  {(() => {
                    let n = 0
                    return days().map(d => (
                      <div class='flex flex-col gap-2'>
                        <div class='eyebrow px-1 pt-3 first:pt-0'>{d.label}</div>
                        <For each={d.items}>{e => <EventRow e={e} index={n++} />}</For>
                      </div>
                    ))
                  })()}
                </Stagger>
              )}
      </SplitView>

      <Modal open={confirmS()} onClose={() => setConfirm(false)} width={400} title='Clear the feed?'
        footer={<><Button variant='ghost' onClick={() => setConfirm(false)}>Cancel</Button><Button variant='danger' icon={FiTrash2} onClick={clear}>Clear</Button></>}>
        <p class='text-[13px] text-muted'>The timeline is emptied. Spectre keeps watching your friends list and records new changes from now on.</p>
      </Modal>
    </Page></Show>)
  
}
