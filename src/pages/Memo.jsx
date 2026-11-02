import { useEffect, useMemo, useState } from 'react'
import { FiEdit3, FiPlus, FiSearch } from 'react-icons/fi'
import { navigate } from '../nav'
import { Button, Card, Empty, ErrorState, Input, Page, Skeleton } from '../ui'
import { useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { cx, timeAgo } from './history/shared'
import { MemoModal, PRESET_TAGS, RatingIcon, TagChip } from './history/MemoEditor'

export default function Memo({ params }) {
  const { data, error, loading, reload } = useInvoke('memo:list')
  const [q, setQ] = useState('')
  const [tag, setTag] = useState(null)
  const [target, setTarget] = useState(null)

  // Opened from another page: { puuid, name } edits that player's memo.
  useEffect(() => { if (params?.puuid) setTarget({ puuid: params.puuid, name: params.name || '' }) }, [params?.puuid])

  const memos = data || []
  // "View profile" only for you and friends (Player Search refuses anyone else).
  const riot = useRiot()
  const friends = useInvoke('social:friends', [], { skip: !riot.connected, deps: [riot.connected] })
  const friendSet = useMemo(() => new Set([riot.puuid, ...(friends.data || []).map(f => f.puuid)]), [riot.puuid, friends.data])
  const map = useMemo(() => Object.fromEntries(memos.map(m => [m.puuid, m])), [memos])
  const allTags = useMemo(() => [...new Set(memos.flatMap(m => m.tags))], [memos])
  const chips = [...new Set([...PRESET_TAGS, ...allTags])]
  const shown = memos.filter(m => (!tag || m.tags.includes(tag)) && (!q || `${m.name} ${m.text} ${m.tags.join(' ')}`.toLowerCase().includes(q.toLowerCase())))

  return (
    <Page title='Notes' subtitle='Notes and tags on players you meet'
      actions={<Button variant='primary' icon={FiPlus} onClick={() => setTarget({})}>New note</Button>}>
      <div className='flex flex-col gap-4 mb-6'>
        <div className='relative max-w-sm'>
          <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' />
          <Input className='!pl-10 !h-10 !rounded-full' value={q} onChange={e => setQ(e.target.value)} placeholder='Search name, notes or tags' />
        </div>
        <div className='flex flex-wrap gap-2'>
          {chips.map(t => <TagChip key={t} label={t} active={tag === t} onClick={() => setTag(tag === t ? null : t)} />)}
        </div>
      </div>

      {error && !data ? <ErrorState error={error} onRetry={reload} />
        : loading && !data ? <div className='grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4'>{Array.from({ length: 6 }, (_, i) => <Skeleton key={i} className='h-36 rounded-xl' />)}</div>
          : !shown.length ? (
            <Empty icon={FiEdit3} title={memos.length ? 'No notes match' : 'No notes yet'}
              hint={memos.length ? 'Try clearing the search or tag filter.' : 'Add a note on a player from a match scoreboard, their profile, or here.'}
              action={!memos.length && <Button icon={FiPlus} onClick={() => setTarget({})}>New note</Button>} />
          ) : (
            <div className='stagger grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-4'>
              {shown.map((m, i) => (
                <Card key={m.puuid} hover style={{ '--i': Math.min(i, 12) }} className='p-5 flex flex-col gap-3' onClick={() => setTarget({ puuid: m.puuid, name: m.name })}>
                  <div className='flex items-center gap-2'>
                    <span className='font-display text-[17px] font-bold tracking-tight text-text truncate flex-1'>{m.name || 'Unknown player'}</span>
                    <RatingIcon rating={m.rating} />
                  </div>
                  {m.tags.length > 0 && (
                    <div className='flex flex-wrap gap-1.5'>{m.tags.map(t => <span key={t} className='h-6 px-2.5 rounded-full border border-accent/30 bg-accent/[0.12] text-accent text-[11px] font-semibold inline-flex items-center'>{t}</span>)}</div>
                  )}
                  <p className={cx('text-[13px] leading-relaxed line-clamp-3 flex-1', m.text ? 'text-text/80' : 'text-muted italic')}>{m.text || 'No notes'}</p>
                  <div className='flex items-center justify-between pt-3 border-t border-line text-[11px] text-muted'>
                    <span>Updated {timeAgo(m.updatedAt)}</span>
                    {friendSet.has(m.puuid) && <button className='font-semibold text-accent hover:underline' onClick={e => { e.stopPropagation(); navigate('search', { puuid: m.puuid }) }}>View profile</button>}
                  </div>
                </Card>
              ))}
            </div>
          )}

      <MemoModal open={!!target} onClose={() => setTarget(null)} target={target} memos={map} allTags={allTags} onChanged={() => reload(true)} />
    </Page>
  )
}
