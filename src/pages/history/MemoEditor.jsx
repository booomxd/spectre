import { useEffect, useState } from 'react'
import { FiThumbsDown, FiThumbsUp, FiMinus, FiPlus, FiTrash2, FiEdit3 } from 'react-icons/fi'
import { invoke } from '../../lib/ipc'
import { Button, Input, Label, Modal, Textarea, toast } from '../../ui'
import { cx } from './shared'

export const PRESET_TAGS = ['Good teammate', 'Toxic', 'Smurf', 'Thrower', 'Shotcaller', 'Duo-able']

const RATINGS = [
  { value: -1, icon: FiThumbsDown, active: 'border-bad/50 bg-bad/15 text-bad' },
  { value: 0, icon: FiMinus, active: 'accent-soft border-transparent text-text' },
  { value: 1, icon: FiThumbsUp, active: 'border-good/50 bg-good/15 text-good' },
]

export function RatingIcon({ rating, className }) {
  if (rating > 0) return <FiThumbsUp className={cx('text-good', className)} />
  if (rating < 0) return <FiThumbsDown className={cx('text-bad', className)} />
  return null
}

// Small badge shown next to a player who has a memo.
export function MemoBadge({ memo, onClick }) {
  if (!memo) return null
  return (
    <button onClick={onClick} title={memo.text || memo.tags.join(', ') || 'Note'}
      className='inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-accent/30 bg-accent/[0.12] text-accent text-[11px] font-semibold hover:bg-accent/20 transition-colors'>
      <FiEdit3 className='text-[10px]' />{memo.tags[0] || 'Note'}<RatingIcon rating={memo.rating} className='text-[10px]' />
    </button>
  )
}

export function TagChip({ label, active, onClick }) {
  return (
    <button onClick={onClick}
      className={cx('h-8 px-3.5 rounded-full border text-xs font-semibold transition duration-200 active:scale-95',
        active ? 'accent-soft border-transparent text-accent' : 'glass text-muted hover:text-text hover:border-accent/30 hover:bg-surface-2')}>
      {label}
    </button>
  )
}

// Edit form shared by the Memo modal and the inline editor on the profile page.
// target = { puuid?, name? }. Without a puuid the user enters a Riot ID which is looked up on save.
export function MemoForm({ target, memo, onSaved, onDeleted, onCancel, allTags = [] }) {
  const [riotId, setRiotId] = useState('')
  const [tags, setTags] = useState(memo?.tags || [])
  const [rating, setRating] = useState(memo?.rating || 0)
  const [text, setText] = useState(memo?.text || '')
  const [custom, setCustom] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    setTags(memo?.tags || []); setRating(memo?.rating || 0); setText(memo?.text || ''); setRiotId('')
  }, [memo?.puuid, memo?.updatedAt, target?.puuid])

  const options = [...new Set([...PRESET_TAGS, ...allTags, ...tags])]
  const toggle = t => setTags(list => (list.includes(t) ? list.filter(x => x !== t) : [...list, t]))
  const addCustom = () => {
    const t = custom.trim()
    if (t) { setTags(list => (list.includes(t) ? list : [...list, t])); setCustom('') }
  }

  const save = async () => {
    setSaving(true)
    try {
      let puuid = target?.puuid, name = target?.name || memo?.name || ''
      if (!puuid) {
        const found = await invoke('search:lookup', riotId)
        puuid = found.puuid; name = `${found.gameName}#${found.tagLine}`
      }
      const saved = await invoke('memo:save', { puuid, name, tags, rating, text })
      toast.success('Note saved')
      onSaved?.(saved)
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }

  const remove = async () => {
    try { await invoke('memo:delete', memo.puuid); toast.success('Note deleted'); onDeleted?.(memo.puuid) }
    catch (e) { toast.error(e.message) }
  }

  const needsId = !target?.puuid
  return (
    <div className='flex flex-col gap-4'>
      {needsId && (
        <div>
          <Label hint='Looked up when you save'>Riot ID</Label>
          <Input value={riotId} onChange={e => setRiotId(e.target.value)} placeholder='Name#Tag' />
        </div>
      )}
      <div>
        <Label>Rating</Label>
        <div className='flex gap-2'>
          {RATINGS.map(r => (
            <button key={r.value} onClick={() => setRating(r.value)}
              className={cx('h-9 w-14 rounded-full border flex items-center justify-center transition duration-200 active:scale-95',
                rating === r.value ? r.active : 'glass text-muted hover:text-text hover:bg-surface-2')}>
              <r.icon />
            </button>
          ))}
        </div>
      </div>
      <div>
        <Label>Tags</Label>
        <div className='flex flex-wrap gap-2'>
          {options.map(t => <TagChip key={t} label={t} active={tags.includes(t)} onClick={() => toggle(t)} />)}
        </div>
        <div className='flex gap-2 mt-3'>
          <Input value={custom} onChange={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} placeholder='Custom tag' />
          <Button icon={FiPlus} onClick={addCustom} disabled={!custom.trim()}>Add</Button>
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea rows={4} value={text} onChange={e => setText(e.target.value)} placeholder='Plays entry well, calls mid-round...' />
      </div>
      <div className='flex items-center justify-between pt-1'>
        <div>{memo && <Button variant='danger' icon={FiTrash2} onClick={remove}>Delete</Button>}</div>
        <div className='flex gap-2'>
          {onCancel && <Button variant='ghost' onClick={onCancel}>Cancel</Button>}
          <Button variant='primary' loading={saving} disabled={needsId && !riotId.includes('#')} onClick={save}>Save note</Button>
        </div>
      </div>
    </div>
  )
}

// Modal wrapper. `memos` is the { puuid: memo } map used to prefill.
export function MemoModal({ open, onClose, target, memos = {}, allTags, onChanged }) {
  const memo = target?.puuid ? memos[target.puuid] : null
  return (
    <Modal open={open} onClose={onClose} width={520} title={memo ? `Note: ${memo.name || target?.name || 'Player'}` : target?.name ? `Memo: ${target.name}` : 'New note'}>
      <MemoForm target={target} memo={memo} allTags={allTags}
        onCancel={onClose}
        onSaved={m => { onChanged?.(m); onClose() }}
        onDeleted={p => { onChanged?.(null, p); onClose() }} />
    </Modal>
  )
}
