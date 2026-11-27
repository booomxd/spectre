import { Dynamic } from 'solid-js/web'
import { For, createEffect, createSignal, on, onCleanup, onMount, createMemo } from 'solid-js'
import {
  FiBookOpen, FiCheck, FiChevronDown, FiCopy, FiCrosshair, FiExternalLink, FiFileText, FiFlag, FiLink, FiLoader,
  FiMap, FiMessageSquare, FiPlus, FiRotateCcw, FiSearch, FiStar, FiTrash2, FiUsers, FiZap,
} from 'solid-icons/fi'
import { Button, Card, Empty, ErrorState, Input, Item, Modal, Page, SegmentedTabs, Skeleton, Stagger, Swap, Textarea, toast } from '../ui'
import { ListRow, Pane, SearchField, SPLIT_BODY, SplitView } from './friends/Layout'
import { invoke, openExternal, useInvoke } from '../lib/ipc'
import { cx } from './history/shared'
import { MemoModal } from './history/MemoEditor'

// notes: a notebook of sections, each with free notes, crosshair codes, links and chat snippets
const NOTES_MAX = 3000
const ICONS = { note: FiFileText, target: FiCrosshair, map: FiMap, star: FiStar, flag: FiFlag, book: FiBookOpen, zap: FiZap, users: FiUsers }
const COLORS = {
  accent: { dot: 'bg-accent', chip: 'text-accent bg-accent/15' },
  red: { dot: 'bg-red-500', chip: 'text-red-500 bg-red-500/15' },
  orange: { dot: 'bg-orange-500', chip: 'text-orange-500 bg-orange-500/15' },
  yellow: { dot: 'bg-yellow-500', chip: 'text-yellow-500 bg-yellow-500/15' },
  green: { dot: 'bg-emerald-500', chip: 'text-emerald-500 bg-emerald-500/15' },
  teal: { dot: 'bg-teal-500', chip: 'text-teal-500 bg-teal-500/15' },
  blue: { dot: 'bg-blue-500', chip: 'text-blue-500 bg-blue-500/15' },
  purple: { dot: 'bg-violet-500', chip: 'text-violet-500 bg-violet-500/15' },
  pink: { dot: 'bg-pink-500', chip: 'text-pink-500 bg-pink-500/15' },
}
const TABS = [
  { value: 'notes', label: 'Notes', icon: FiFileText },
  { value: 'crosshairs', label: 'Crosshairs', icon: FiCrosshair },
  { value: 'links', label: 'Links', icon: FiLink },
  { value: 'snippets', label: 'Chat snippets', icon: FiMessageSquare },
]
// One-line summary under a section name
const summary = x => {
  const n = (k, word) => x[k].length && `${x[k].length} ${word}${x[k].length > 1 ? 's' : ''}`
  const parts = [n('crosshairs', 'crosshair'), n('links', 'link'), n('snippets', 'snippet')].filter(Boolean)
  return parts.length ? parts.join(' · ') : x.notes ? x.notes.slice(0, 60) : 'Empty'
}
const uid = () => Math.random().toString(36).slice(2, 10)
const copy = (text, what) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`))

function SectionIcon(props) {
  
    const Icon = () => (ICONS[props.s.icon] || FiFileText)
    return (<span class={cx('shrink-0 rounded-xl flex items-center justify-center', (props.size ?? 'w-9 h-9'), (COLORS[props.s.color] || COLORS.accent).chip)}><Dynamic component={Icon()} /></span>)
  
}

// color and icon picker for the current section
function Appearance(props) {
  const [openS, setOpen] = createSignal(false)
  const ref = { current: null }
  createEffect(on(() => [openS()], () => {
    if (!openS()) return
    const close = e => !ref.current?.contains(e.target) && setOpen(false)
    window.addEventListener('mousedown', close)
    { onCleanup(() => window.removeEventListener('mousedown', close)); return }
  }))
  return (
    <div ref={el => (ref.current = el)} class='relative'>
      <Button size='sm' variant='ghost' onClick={() => setOpen(o => !o)}>Style <FiChevronDown class={cx('transition-transform', openS() && 'rotate-180')} /></Button>
      {openS() && (
        <div class='glass-strong anim-pop absolute right-0 top-11 z-30 w-[256px] rounded-2xl p-4'>
          <div class='text-[12px] font-semibold text-muted mb-2'>Color</div>
          <div class='flex flex-wrap gap-2'>
            <For each={Object.entries(COLORS)}>{([k, c]) => (
              <button title={k} onClick={() => props.onChange({ color: k })}
                class={cx('w-6 h-6 rounded-full transition-transform hover:scale-110', c.dot, props.s.color === k && 'ring-2 ring-text ring-offset-2 ring-offset-panel')} />
            )}</For>
          </div>
          <div class='text-[12px] font-semibold text-muted mt-4 mb-2'>Icon</div>
          <div class='grid grid-cols-4 gap-2'>
            <For each={Object.entries(ICONS)}>{([k, Icon]) => (
              <button title={k} onClick={() => props.onChange({ icon: k })}
                class={cx('h-9 rounded-lg flex items-center justify-center transition-colors', props.s.icon === k ? 'accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2')}><Icon /></button>
            )}</For>
          </div>
        </div>
      )}
    </div>
  )
}

// A list tab (crosshairs, links, snippets): add form on top, rows below
function ItemList(props) {
  const [formS, setForm] = createSignal({})
  
    const ready = () => (props.fields.every(f => f.optional || (formS()[f.key] || '').trim()))
    const add = e => {
    e.preventDefault()
    if (!ready()) return
    props.onAdd(Object.fromEntries(props.fields.map(f => [f.key, (formS()[f.key] || '').trim()])))
    setForm({})
  }
    return (<div class='flex flex-col gap-4 min-h-0'>
      <form onSubmit={add} class='flex gap-2'>
        <For each={props.fields}>{f => (
          <Input value={formS()[f.key] || ''} maxLength={f.max} placeholder={f.placeholder} class={'!rounded-full ' + (f.className || '')}
            onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
        )}</For>
        <Button type='submit' variant='primary' icon={FiPlus} disabled={!ready()} class='shrink-0'>Add</Button>
      </form>
      {!props.items.length ? <Empty icon={props.icon} title={props.empty.title} hint={props.empty.hint} />
        : <Stagger class='flex flex-col gap-2'>
          <For each={props.items}>{(it, i) => (
            <Item index={i()} class='group glass-inset flex items-center gap-3 rounded-2xl px-4 py-3'>
              <div class='min-w-0 flex-1'>{props.row(it)}</div>
              <button title='Remove' onClick={() => props.onRemove(it.id)}
                class='w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad/15 transition-[transform,opacity,background-color,border-color,color] duration-200'><FiTrash2 size={14} /></button>
            </Item>
          )}</For>
        </Stagger>}
    </div>)
  
}

export default function Memo(props) {
  const nb = useInvoke('notebook:get')
  const [docS, setDoc] = createSignal(null)
  const [curS, setCur] = createSignal(null)
  const [tabS, setTab] = createSignal('notes')
  const [qS, setQ] = createSignal('')
  const [savingS, setSaving] = createSignal(false)
  const [confirmS, setConfirm] = createSignal(null)
  const [renamingS, setRenaming] = createSignal(false)
  const timer = { current: null }
  const [targetS, setTarget] = createSignal(null)
  createEffect(on(() => [props.params], () => { if (props.params?.puuid) setTarget({ puuid: props.params.puuid, name: props.params.name || '' }) }))
  const memos = useInvoke('memo:list', [], { skip: () => (!targetS()), deps: () => ([targetS()]) })
  createEffect(on(() => [nb.data, docS()], () => {
    if (nb.data && !docS()) { setDoc(nb.data); setCur(nb.data.sections[0]?.id) }
  }))
  const pending = { current: null }
  onMount(() => () => {
    clearTimeout(timer.current)
    if (pending.current) invoke('notebook:save', pending.current).catch(e => toast.error(e.message))
  })
  
    const memoMap = createMemo(() => Object.fromEntries((memos.data || []).map(m => [m.puuid, m])))
    const memoTags = createMemo(() => [...new Set((memos.data || []).flatMap(m => m.tags))])
    const commit = next => {
    setDoc(next)
    setSaving(true)
    clearTimeout(timer.current)
    pending.current = next
    timer.current = setTimeout(async () => {
      pending.current = null
      try { await invoke('notebook:save', next) } catch (e) { toast.error(e.message) }
      setSaving(false)
    }, 500)
  }
    const sections = () => (docS()?.sections || [])
    const s = () => (sections().find(x => x.id === curS()) || sections()[0])
    const update = patch => commit({ ...docS(), sections: sections().map(x => x.id === s().id ? { ...x, ...patch, updatedAt: Date.now() } : x) })
    const addSection = () => {
    const n = { id: uid(), name: `Section ${sections().length + 1}`, color: 'accent', icon: 'note', notes: '', crosshairs: [], links: [], snippets: [], updatedAt: Date.now() }
    commit({ ...docS(), sections: [...sections(), n] })
    setCur(n.id); setTab('notes'); setRenaming(true)
  }
    const removeSection = id => {
    const rest = sections().filter(x => x.id !== id)
    commit({ ...docS(), sections: rest })
    if (curS() === id) setCur(rest[0]?.id)
  }
    const reset = async () => {
    try { const d = await invoke('notebook:reset'); clearTimeout(timer.current); setDoc(d); setCur(d.sections[0]?.id); setSaving(false); toast.success('Notes reset') }
    catch (e) { toast.error(e.message) }
  }
    const shown = () => (sections().filter(x => !qS() || `${x.name} ${x.notes}`.toLowerCase().includes(qS().toLowerCase())))
    const count = () => (sections().length)
    const list = (
    () => (<Pane title='Sections' right={<Button size='sm' variant='glow' icon={FiPlus} disabled={!docS()} onClick={addSection}>New</Button>}
      header={<SearchField value={qS()} onChange={setQ} placeholder='Search sections' />}
      footer={<Button size='sm' variant='ghost' icon={FiRotateCcw} class='w-full' disabled={!docS()} onClick={() => setConfirm({ kind: 'reset' })}>Reset notes</Button>}>
      {!docS() ? <div class='flex flex-col gap-1.5 p-1'><For each={[0, 1, 2, 3]}>{i => <Skeleton class='h-12 rounded-2xl' />}</For></div> : (
        <Stagger class='flex flex-col gap-0.5'>
          <For each={shown()}>{(x, i) => (
            <Item index={i()}>
              <ListRow selected={s() && x.id === s().id} layoutId='squad-notes' onClick={() => { setCur(x.id); setRenaming(false) }}>
                <SectionIcon s={x} size='relative w-9 h-9 text-[14px]' />
                <span class='relative flex-1 min-w-0'>
                  <span class='block truncate text-[13.5px] font-semibold text-text'>{x.name}</span>
                  <span class='block truncate text-[11px] text-muted mt-0.5'>{summary(x)}</span>
                </span>
                {count() > 1 && (
                  <button title='Delete section' onClick={e => { e.stopPropagation(); setConfirm({ kind: 'section', id: x.id, name: x.name }) }}
                    class='relative w-7 h-7 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad/15 transition-[transform,opacity,background-color,border-color,color] duration-200'><FiTrash2 size={13} /></button>
                )}
              </ListRow>
            </Item>
          )}</For>
          {!shown().length && <p class='px-3 py-6 text-center text-[12px] text-muted'>No sections match.</p>}
        </Stagger>
      )}
    </Pane>)
  )
    return (<Page title='Notes' subtitle={docS() ? `${count()} ${count() === 1 ? 'section' : 'sections'} · saved on this device` : 'Saved on this device'}
      bodyClass={SPLIT_BODY}>
      <SplitView list={list()} listWidth={300}>
        {nb.error && !docS() ? <ErrorState error={nb.error} onRetry={nb.reload} />
          : !docS() || !s() ? <Skeleton class='h-full rounded-3xl min-h-[420px]' />
            : (
              <Card class='relative h-full min-h-[460px] flex flex-col rounded-3xl overflow-hidden'>
                <span class={cx('halo -top-32 -right-24 w-96 h-96 opacity-50')} />
                <div class='relative flex items-start justify-between gap-4 px-7 pt-6'>
                  <div class='flex items-center gap-4 min-w-0'>
                    <SectionIcon s={s()} size='w-12 h-12 text-[20px] rounded-2xl' />
                    <div class='min-w-0'>
                      <div class='eyebrow'>Section</div>
                      {renamingS()
                        ? <input autofocus value={s().name} maxLength={40} onFocus={e => e.target.select()}
                          class='glass-field mt-1 h-10 w-[300px] rounded-xl px-3 display text-[24px] text-text outline-none'
                          onChange={e => update({ name: e.target.value })}
                          onBlur={() => { if (!s().name.trim()) update({ name: 'Untitled' }); setRenaming(false) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }} />
                        : <button title='Rename' onClick={() => setRenaming(true)}
                          class='block max-w-full truncate display text-[28px] text-text hover:text-accent transition-colors text-left mt-1'>{s().name}</button>}
                    </div>
                  </div>
                  <div class='flex items-center gap-1.5 shrink-0'>
                    <Appearance s={s()} onChange={update} />
                    <Button size='icon' variant='ghost' title='Delete section' disabled={count() < 2}
                      onClick={() => setConfirm({ kind: 'section', id: s().id, name: s().name })}><FiTrash2 /></Button>
                  </div>
                </div>
                <div class='relative px-7 pt-5 pb-4'>
                  <SegmentedTabs tabs={TABS.map(t => ({ ...t, count: t.value === 'notes' ? undefined : s()[t.value]?.length || undefined }))} value={tabS()} onChange={setTab} layoutId='notes-tabs' />
                </div>
                <div class='hairline' />

                <div class='relative flex-1 min-h-0 overflow-y-auto px-7 py-6 flex flex-col'>
                  <Swap id={s().id + tabS()} class='flex-1 flex flex-col min-h-0'>
                    {tabS() === 'notes' && (
                      <div class='flex-1 flex flex-col min-h-0'>
                        <Textarea class='flex-1 min-h-[280px] !p-5 !rounded-2xl text-[14px] leading-relaxed' maxLength={NOTES_MAX}
                          value={s().notes} onChange={e => update({ notes: e.target.value })}
                          placeholder='Write details, lineups, setups or strat notes here...' />
                        <div class='flex items-center justify-between mt-3 text-[12px]'>
                          <span class={cx('inline-flex items-center gap-1.5', savingS() ? 'text-muted' : 'text-good')}>
                            {savingS() ? <><FiLoader class='animate-spin' /> Saving...</> : <><FiCheck /> Autosaved locally</>}
                          </span>
                          <span class={cx('tabular-nums', s().notes.length >= NOTES_MAX ? 'text-warn' : 'text-muted')}>{s().notes.length} / {NOTES_MAX}</span>
                        </div>
                      </div>
                    )}
                    {tabS() === 'crosshairs' && (
                      <ItemList items={s().crosshairs} icon={FiCrosshair}
                        empty={{ title: 'No crosshairs yet', hint: 'Save crosshair profile codes here and copy them into VALORANT.' }}
                        fields={[{ key: 'name', placeholder: 'Name', max: 60, className: '!w-[180px] shrink-0' }, { key: 'code', placeholder: 'Crosshair code (0;P;c;5;...)', max: 400 }]}
                        onAdd={v => update({ crosshairs: [...s().crosshairs, { id: uid(), ...v }] })}
                        onRemove={id => update({ crosshairs: s().crosshairs.filter(x => x.id !== id) })}
                        row={c => (
                          <div class='flex items-center gap-3'>
                            <div class='min-w-0 flex-1'>
                              <div class='text-[13px] font-semibold text-text truncate'>{c.name}</div>
                              <div class='text-[11.5px] text-muted tabular-nums tracking-tight truncate mt-0.5'>{c.code}</div>
                            </div>
                            <Button size='sm' icon={FiCopy} onClick={() => copy(c.code, 'Crosshair code')}>Copy</Button>
                          </div>
                        )} />
                    )}
                    {tabS() === 'links' && (
                      <ItemList items={s().links} icon={FiLink}
                        empty={{ title: 'No links yet', hint: 'Keep lineup videos, guides and tracker pages one click away.' }}
                        fields={[{ key: 'title', placeholder: 'Title', max: 60, className: '!w-[200px] shrink-0' }, { key: 'url', placeholder: 'https://...', max: 500 }]}
                        onAdd={v => {
                          const url = /^https?:\/\//i.test(v.url) ? v.url : `https://${v.url}`
                          update({ links: [...s().links, { id: uid(), title: v.title, url }] })
                        }}
                        onRemove={id => update({ links: s().links.filter(x => x.id !== id) })}
                        row={l => (
                          <div class='flex items-center gap-3'>
                            <div class='min-w-0 flex-1'>
                              <div class='text-[13px] font-semibold text-text truncate'>{l.title}</div>
                              <div class='text-[11.5px] text-muted truncate mt-0.5'>{l.url}</div>
                            </div>
                            <Button size='sm' icon={FiExternalLink} onClick={() => openExternal(l.url)}>Open</Button>
                          </div>
                        )} />
                    )}
                    {tabS() === 'snippets' && (
                      <ItemList items={s().snippets} icon={FiMessageSquare}
                        empty={{ title: 'No chat snippets yet', hint: 'Save messages you send often, like callouts or a GG, and copy them in one click.' }}
                        fields={[{ key: 'text', placeholder: 'Message', max: 300 }]}
                        onAdd={v => update({ snippets: [...s().snippets, { id: uid(), ...v }] })}
                        onRemove={id => update({ snippets: s().snippets.filter(x => x.id !== id) })}
                        row={t => (
                          <div class='flex items-center gap-3'>
                            <p class='min-w-0 flex-1 text-[13px] text-text break-words'>{t.text}</p>
                            <Button size='sm' icon={FiCopy} onClick={() => copy(t.text, 'Snippet')}>Copy</Button>
                          </div>
                        )} />
                    )}
                  </Swap>
                </div>
              </Card>
            )}
      </SplitView>

      <Modal open={!!confirmS()} onClose={() => setConfirm(null)} width={400}
        title={confirmS()?.kind === 'reset' ? 'Reset all notes?' : `Delete ${confirmS()?.name || 'section'}?`}
        footer={<>
          <Button variant='ghost' onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant='danger' icon={confirmS()?.kind === 'reset' ? FiRotateCcw : FiTrash2}
            onClick={() => { confirmS().kind === 'reset' ? reset() : removeSection(confirmS().id); setConfirm(null) }}>
            {confirmS()?.kind === 'reset' ? 'Reset' : 'Delete'}
          </Button>
        </>}>
        <p class='text-[13px] text-muted'>
          {confirmS()?.kind === 'reset'
            ? 'Every section, crosshair, link and snippet is removed and you start over with one empty section. Player notes are kept.'
            : 'Its notes, crosshairs, links and snippets are removed. This can\'t be undone.'}
        </p>
      </Modal>

      <MemoModal open={!!targetS()} onClose={() => setTarget(null)} target={targetS()} memos={memoMap()} allTags={memoTags()} onChanged={() => memos.reload(true)} />
    </Page>)
  
}
