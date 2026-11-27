import { For, createEffect, createSignal, on, Show } from 'solid-js'
import { FiThumbsDown, FiThumbsUp, FiMinus, FiPlus, FiTrash2, FiEdit3 } from 'solid-icons/fi'
import { invoke } from '../../lib/ipc'
import { Button, Input, Label, Modal, Textarea, toast } from '../../ui'
import { cx } from './shared'

export const PRESET_TAGS = ['Good teammate', 'Toxic', 'Smurf', 'Thrower', 'Shotcaller', 'Duo-able']

const RATINGS = [
  { value: -1, label: 'Bad', icon: FiThumbsDown, active: 'border-bad/50 bg-bad/15 text-bad' },
  { value: 0, label: 'Neutral', icon: FiMinus, active: 'accent-soft border-transparent text-text' },
  { value: 1, label: 'Good', icon: FiThumbsUp, active: 'border-good/50 bg-good/15 text-good' },
]

export function RatingIcon(props) {
  
    
    
    return (<Show when={!(props.rating > 0)} fallback={<FiThumbsUp class={cx('text-good', props["class"])} />}><Show when={!(props.rating < 0)} fallback={<FiThumbsDown class={cx('text-bad', props["class"])} />}>{null}</Show></Show>)
  
}

// small badge shown next to a player who has a memo
export function MemoBadge(props) {
  
    
    return (<Show when={!(!props.memo)} fallback={null}><button onClick={props.onClick} title={props.memo.text || props.memo.tags.join(', ') || 'Note'}
      class='inline-flex items-center gap-1 h-6 px-2.5 rounded-full border border-accent/30 bg-accent/[0.12] text-accent text-[11px] font-semibold hover:bg-accent/20 transition-colors'>
      <FiEdit3 class='text-[10px]' />{props.memo.tags[0] || 'Note'}<RatingIcon rating={props.memo.rating} class='text-[10px]' />
    </button></Show>)
  
}

export function TagChip(props) {
  return (
    <button onClick={props.onClick}
      class={cx('h-8 px-3.5 rounded-full border text-xs font-semibold transition duration-200 active:scale-95',
        props.active ? 'accent-soft border-transparent text-accent' : 'glass text-muted hover:text-text hover:border-accent/30 hover:bg-surface-2')}>
      {props.label}
    </button>
  )
}

// edit form shared by the Memo modal and the inline editor on the profile page. target = { puuid?, name? }
export function MemoForm(props) {
  const [riotIdS, setRiotId] = createSignal('')
  const [tagsS, setTags] = createSignal(props.memo?.tags || [])
  const [ratingS, setRating] = createSignal(props.memo?.rating || 0)
  const [textS, setText] = createSignal(props.memo?.text || '')
  const [customS, setCustom] = createSignal('')
  const [savingS, setSaving] = createSignal(false)
  createEffect(on(() => [props.memo?.puuid, props.memo?.updatedAt, props.target?.puuid], () => {
    setTags(props.memo?.tags || []); setRating(props.memo?.rating || 0); setText(props.memo?.text || ''); setRiotId('')
  }))
  
    const options = () => ([...new Set([...PRESET_TAGS, ...(props.allTags ?? []), ...tagsS()])])
    const toggle = t => setTags(list => (list.includes(t) ? list.filter(x => x !== t) : [...list, t]))
    const addCustom = () => {
    const t = customS().trim()
    if (t) { setTags(list => (list.includes(t) ? list : [...list, t])); setCustom('') }
  }
    const save = async () => {
    setSaving(true)
    try {
      let puuid = props.target?.puuid, name = props.target?.name || props.memo?.name || ''
      // snapshot the draft now: the controls stay editable while the Riot ID lookup runs
      const draft = { tags: tagsS(), rating: ratingS(), text: textS() }
      if (!puuid) {
        const found = await invoke('search:lookup', riotIdS())
        puuid = found.puuid; name = `${found.gameName}#${found.tagLine}`
      }
      const saved = await invoke('memo:save', { puuid, name, ...draft })
      toast.success('Note saved')
      props.onSaved?.(saved)
    } catch (e) { toast.error(e.message) }
    setSaving(false)
  }
    const remove = async () => {
    const puuid = props.memo.puuid // the modal may close (memo -> null) while the delete is pending
    try { await invoke('memo:delete', puuid); toast.success('Note deleted'); props.onDeleted?.(puuid) }
    catch (e) { toast.error(e.message) }
  }
    const needsId = () => (!props.target?.puuid)
    return (<div class='flex flex-col gap-5'>
      {needsId() && (
        <div>
          <Label hint='Looked up when you save'>Riot ID</Label>
          <Input value={riotIdS()} onInput={e => setRiotId(e.target.value)} placeholder='Name#Tag' />
        </div>
      )}
      <div>
        <Label>Rating</Label>
        <div class='flex gap-2'>
          <For each={RATINGS}>{r => (
            <button onClick={() => setRating(r.value)} aria-label={r.label} title={r.label} aria-pressed={ratingS() === r.value}
              class={cx('h-9 w-14 rounded-full border flex items-center justify-center transition duration-200 active:scale-95',
                ratingS() === r.value ? r.active : 'glass text-muted hover:text-text hover:bg-surface-2')}>
              <r.icon />
            </button>
          )}</For>
        </div>
      </div>
      <div>
        <Label>Tags</Label>
        <div class='flex flex-wrap gap-2'>
          <For each={options()}>{t => <TagChip label={t} active={tagsS().includes(t)} onClick={() => toggle(t)} />}</For>
        </div>
        <div class='flex gap-2 mt-3'>
          <Input value={customS()} onInput={e => setCustom(e.target.value)} onKeyDown={e => e.key === 'Enter' && addCustom()} placeholder='Custom tag' />
          <Button icon={FiPlus} onClick={addCustom} disabled={!customS().trim()}>Add</Button>
        </div>
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea rows={4} value={textS()} onInput={e => setText(e.target.value)} placeholder='Plays entry well, calls mid-round...' />
      </div>
      <div class='flex items-center justify-between pt-1'>
        <div>{props.memo && <Button variant='danger' icon={FiTrash2} onClick={remove}>Delete</Button>}</div>
        <div class='flex gap-2'>
          {props.onCancel && <Button variant='ghost' onClick={props.onCancel}>Cancel</Button>}
          <Button variant='primary' loading={savingS()} disabled={needsId() && !riotIdS().includes('#')} onClick={save}>Save note</Button>
        </div>
      </div>
    </div>)
  
}

// modal wrapper
export function MemoModal(props) {
  
    const memo = () => (props.target?.puuid ? (props.memos ?? {})[props.target.puuid] : null)
    return (<Modal open={props.open} onClose={props.onClose} width={520} title={memo() ? `Note: ${memo().name || props.target?.name || 'Player'}` : props.target?.name ? `Memo: ${props.target.name}` : 'New note'}>
      <MemoForm target={props.target} memo={memo()} allTags={props.allTags}
        onCancel={props.onClose}
        onSaved={m => { props.onChanged?.(m); props.onClose() }}
        onDeleted={p => { props.onChanged?.(null, p); props.onClose() }} />
    </Modal>)
  
}
