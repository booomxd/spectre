import { useEffect, useMemo, useRef, useState } from 'react'
import {
  FiBookOpen, FiCheck, FiChevronDown, FiCopy, FiCrosshair, FiExternalLink, FiFileText, FiFlag, FiLink, FiLoader,
  FiMap, FiMessageSquare, FiPlus, FiRotateCcw, FiSearch, FiStar, FiTrash2, FiUsers, FiZap,
} from 'react-icons/fi'
import { Button, Card, Empty, ErrorState, Input, Modal, Page, Skeleton, Tabs, Textarea, toast } from '../ui'
import { invoke, openExternal, useInvoke } from '../lib/ipc'
import { cx } from './history/shared'
import { MemoModal } from './history/MemoEditor'

// Notes: a notebook of sections, each with free notes, crosshair codes, links and chat snippets. Saved on this PC.
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
  { value: 'notes', label: <span className='inline-flex items-center gap-1.5'><FiFileText /> Notes</span> },
  { value: 'crosshairs', label: <span className='inline-flex items-center gap-1.5'><FiCrosshair /> Crosshairs</span> },
  { value: 'links', label: <span className='inline-flex items-center gap-1.5'><FiLink /> Links</span> },
  { value: 'snippets', label: <span className='inline-flex items-center gap-1.5'><FiMessageSquare /> Chat snippets</span> },
]
const uid = () => Math.random().toString(36).slice(2, 10)
const copy = (text, what) => navigator.clipboard.writeText(text).then(() => toast.success(`${what} copied`))

function SectionIcon({ s, size = 'w-9 h-9' }) {
  const Icon = ICONS[s.icon] || FiFileText
  return <span className={cx('shrink-0 rounded-xl flex items-center justify-center', size, (COLORS[s.color] || COLORS.accent).chip)}><Icon /></span>
}

// Color and icon picker for the current section.
function Appearance({ s, onChange }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  useEffect(() => {
    if (!open) return
    const close = e => !ref.current?.contains(e.target) && setOpen(false)
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [open])
  return (
    <div ref={ref} className='relative'>
      <Button size='sm' onClick={() => setOpen(o => !o)}>Appearance <FiChevronDown className={cx('transition-transform', open && 'rotate-180')} /></Button>
      {open && (
        <div className='glass-strong anim-pop absolute right-0 top-10 z-30 w-[244px] rounded-xl p-4'>
          <div className='text-[12px] font-semibold text-muted mb-2'>Color</div>
          <div className='flex flex-wrap gap-2'>
            {Object.entries(COLORS).map(([k, c]) => (
              <button key={k} title={k} onClick={() => onChange({ color: k })}
                className={cx('w-6 h-6 rounded-full transition-transform hover:scale-110', c.dot, s.color === k && 'ring-2 ring-text ring-offset-2 ring-offset-panel')} />
            ))}
          </div>
          <div className='text-[12px] font-semibold text-muted mt-4 mb-2'>Icon</div>
          <div className='grid grid-cols-4 gap-2'>
            {Object.entries(ICONS).map(([k, Icon]) => (
              <button key={k} title={k} onClick={() => onChange({ icon: k })}
                className={cx('h-9 rounded-lg flex items-center justify-center transition-colors', s.icon === k ? 'accent-soft text-accent' : 'text-muted hover:text-text hover:bg-surface-2')}><Icon /></button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// A list tab (crosshairs, links, snippets): add form on top, rows below.
function ItemList({ items, empty, icon, fields, onAdd, onRemove, row }) {
  const [form, setForm] = useState({})
  const ready = fields.every(f => f.optional || (form[f.key] || '').trim())
  const add = e => {
    e.preventDefault()
    if (!ready) return
    onAdd(Object.fromEntries(fields.map(f => [f.key, (form[f.key] || '').trim()])))
    setForm({})
  }
  return (
    <div className='flex flex-col gap-4 min-h-0'>
      <form onSubmit={add} className='flex gap-2'>
        {fields.map(f => (
          <Input key={f.key} value={form[f.key] || ''} maxLength={f.max} placeholder={f.placeholder} className={f.className}
            onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))} />
        ))}
        <Button type='submit' variant='primary' icon={FiPlus} disabled={!ready} className='shrink-0'>Add</Button>
      </form>
      {!items.length ? <Empty icon={icon} title={empty.title} hint={empty.hint} />
        : <div className='stagger flex flex-col gap-2'>
          {items.map((it, i) => (
            <div key={it.id} style={{ '--i': Math.min(i, 12) }} className='group flex items-center gap-3 rounded-xl border border-line bg-surface-2/60 px-4 py-3'>
              <div className='min-w-0 flex-1'>{row(it)}</div>
              <button title='Remove' onClick={() => onRemove(it.id)}
                className='w-8 h-8 shrink-0 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad/15 transition-all'><FiTrash2 size={14} /></button>
            </div>
          ))}
        </div>}
    </div>
  )
}

export default function Memo({ params }) {
  const nb = useInvoke('notebook:get')
  const [doc, setDoc] = useState(null)
  const [cur, setCur] = useState(null)
  const [tab, setTab] = useState('notes')
  const [q, setQ] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirm, setConfirm] = useState(null)
  const [renaming, setRenaming] = useState(false)
  const timer = useRef(null)

  // Player notes still open here from Live Match, Friends and scoreboards.
  const [target, setTarget] = useState(null)
  useEffect(() => { if (params?.puuid) setTarget({ puuid: params.puuid, name: params.name || '' }) }, [params?.puuid])
  const memos = useInvoke('memo:list', [], { skip: !target, deps: [target] })
  const memoMap = useMemo(() => Object.fromEntries((memos.data || []).map(m => [m.puuid, m])), [memos.data])
  const memoTags = useMemo(() => [...new Set((memos.data || []).flatMap(m => m.tags))], [memos.data])

  useEffect(() => {
    if (nb.data && !doc) { setDoc(nb.data); setCur(nb.data.sections[0]?.id) }
  }, [nb.data, doc])

  // Every edit updates the page right away and saves after a short pause.
  const commit = next => {
    setDoc(next)
    setSaving(true)
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      try { await invoke('notebook:save', next) } catch (e) { toast.error(e.message) }
      setSaving(false)
    }, 500)
  }
  useEffect(() => () => clearTimeout(timer.current), [])

  const sections = doc?.sections || []
  const s = sections.find(x => x.id === cur) || sections[0]
  const update = patch => commit({ ...doc, sections: sections.map(x => x.id === s.id ? { ...x, ...patch, updatedAt: Date.now() } : x) })
  const addSection = () => {
    const n = { id: uid(), name: `Section ${sections.length + 1}`, color: 'accent', icon: 'note', notes: '', crosshairs: [], links: [], snippets: [], updatedAt: Date.now() }
    commit({ ...doc, sections: [...sections, n] })
    setCur(n.id); setTab('notes'); setRenaming(true)
  }
  const removeSection = id => {
    const rest = sections.filter(x => x.id !== id)
    commit({ ...doc, sections: rest })
    if (cur === id) setCur(rest[0]?.id)
  }
  const reset = async () => {
    try { const d = await invoke('notebook:reset'); clearTimeout(timer.current); setDoc(d); setCur(d.sections[0]?.id); setSaving(false); toast.success('Notes reset') }
    catch (e) { toast.error(e.message) }
  }
  const shown = sections.filter(x => !q || `${x.name} ${x.notes}`.toLowerCase().includes(q.toLowerCase()))
  const count = sections.length

  return (
    <Page title='Notes' subtitle={doc ? `${count} ${count === 1 ? 'section' : 'sections'} · saved on this device` : 'Saved on this device'}
      actions={<Button variant='ghost' icon={FiRotateCcw} disabled={!doc} onClick={() => setConfirm({ kind: 'reset' })}>Reset notes</Button>}
      bodyClassName='flex flex-col'>
      {nb.error && !doc ? <ErrorState error={nb.error} onRetry={nb.reload} />
        : !doc || !s ? <Skeleton className='flex-1 rounded-2xl min-h-[420px]' />
          : (
            <Card className='flex-1 min-h-[460px] flex rounded-2xl overflow-hidden'>
              <aside className='w-[260px] shrink-0 flex flex-col border-r border-line'>
                <div className='flex items-center justify-between px-5 pt-5 pb-3'>
                  <span className='text-[11px] font-semibold tracking-[0.14em] uppercase text-muted'>Sections</span>
                  <Button size='sm' variant='primary' icon={FiPlus} onClick={addSection}>New</Button>
                </div>
                <div className='px-4 pb-3'>
                  <div className='relative'>
                    <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none z-10' />
                    <Input className='!pl-9 !rounded-full' value={q} onChange={e => setQ(e.target.value)} placeholder='Search sections' />
                  </div>
                </div>
                <div className='flex-1 overflow-y-auto px-3 pb-3 flex flex-col gap-1'>
                  {shown.map(x => (
                    <div key={x.id} onClick={() => { setCur(x.id); setRenaming(false) }}
                      className={cx('group flex items-center gap-3 h-12 px-2.5 rounded-xl cursor-pointer transition-colors', x.id === s.id ? 'accent-soft' : 'hover:bg-surface-2')}>
                      <SectionIcon s={x} size='w-8 h-8 text-[14px]' />
                      <span className={cx('flex-1 min-w-0 truncate text-[13px] font-semibold', x.id === s.id ? 'text-text' : 'text-muted group-hover:text-text')}>{x.name}</span>
                      {count > 1 && (
                        <button title='Delete section' onClick={e => { e.stopPropagation(); setConfirm({ kind: 'section', id: x.id, name: x.name }) }}
                          className='w-7 h-7 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad/15 transition-all'><FiTrash2 size={13} /></button>
                      )}
                    </div>
                  ))}
                  {!shown.length && <p className='px-3 py-6 text-center text-[12px] text-muted'>No sections match.</p>}
                </div>
              </aside>

              <section className='flex-1 min-w-0 flex flex-col'>
                <div className='flex items-start justify-between gap-4 px-6 pt-5'>
                  <div className='flex items-center gap-3.5 min-w-0'>
                    <SectionIcon s={s} size='w-11 h-11 text-[18px]' />
                    <div className='min-w-0'>
                      <div className='text-[11px] font-semibold tracking-[0.14em] uppercase text-muted'>Current section</div>
                      {renaming
                        ? <input autoFocus value={s.name} maxLength={40} onFocus={e => e.target.select()}
                          className='glass-field mt-1 h-9 w-[280px] rounded-lg px-3 font-display text-xl font-bold tracking-tight text-text outline-none'
                          onChange={e => update({ name: e.target.value })}
                          onBlur={() => { if (!s.name.trim()) update({ name: 'Untitled' }); setRenaming(false) }}
                          onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur() }} />
                        : <button title='Rename' onClick={() => setRenaming(true)}
                          className='block max-w-full truncate font-display text-[26px] font-bold tracking-tight text-text hover:text-accent transition-colors text-left'>{s.name}</button>}
                    </div>
                  </div>
                  <div className='flex items-center gap-2 shrink-0'>
                    <Appearance s={s} onChange={update} />
                    <Button size='sm' variant='ghost' title='Delete section' disabled={count < 2}
                      onClick={() => setConfirm({ kind: 'section', id: s.id, name: s.name })}><FiTrash2 /></Button>
                  </div>
                </div>
                <div className='px-6 pt-4 pb-4 border-b border-line'>
                  <Tabs tabs={TABS} value={tab} onChange={setTab} />
                </div>

                <div className='flex-1 min-h-0 overflow-y-auto p-6 flex flex-col'>
                  {tab === 'notes' && (
                    <div key={s.id} className='anim-fade flex-1 flex flex-col min-h-0'>
                      <Textarea className='flex-1 min-h-[280px] !p-4 text-[14px] leading-relaxed' maxLength={NOTES_MAX}
                        value={s.notes} onChange={e => update({ notes: e.target.value })}
                        placeholder='Write details, lineups, setups or strat notes here...' />
                      <div className='flex items-center justify-between mt-3 text-[12px]'>
                        <span className={cx('inline-flex items-center gap-1.5', saving ? 'text-muted' : 'text-good')}>
                          {saving ? <><FiLoader className='animate-spin' /> Saving...</> : <><FiCheck /> Autosaved locally</>}
                        </span>
                        <span className={cx('tabular-nums', s.notes.length >= NOTES_MAX ? 'text-warn' : 'text-muted')}>{s.notes.length} / {NOTES_MAX} characters</span>
                      </div>
                    </div>
                  )}
                  {tab === 'crosshairs' && (
                    <ItemList key={s.id} items={s.crosshairs} icon={FiCrosshair}
                      empty={{ title: 'No crosshairs yet', hint: 'Save crosshair profile codes here and copy them into VALORANT.' }}
                      fields={[{ key: 'name', placeholder: 'Name', max: 60, className: '!w-[180px] shrink-0' }, { key: 'code', placeholder: 'Crosshair code (0;P;c;5;...)', max: 400 }]}
                      onAdd={v => update({ crosshairs: [...s.crosshairs, { id: uid(), ...v }] })}
                      onRemove={id => update({ crosshairs: s.crosshairs.filter(x => x.id !== id) })}
                      row={c => (
                        <div className='flex items-center gap-3'>
                          <div className='min-w-0 flex-1'>
                            <div className='text-[13px] font-semibold text-text truncate'>{c.name}</div>
                            <div className='text-[12px] text-muted font-mono truncate'>{c.code}</div>
                          </div>
                          <Button size='sm' icon={FiCopy} onClick={() => copy(c.code, 'Crosshair code')}>Copy</Button>
                        </div>
                      )} />
                  )}
                  {tab === 'links' && (
                    <ItemList key={s.id} items={s.links} icon={FiLink}
                      empty={{ title: 'No links yet', hint: 'Keep lineup videos, guides and tracker pages one click away.' }}
                      fields={[{ key: 'title', placeholder: 'Title', max: 60, className: '!w-[200px] shrink-0' }, { key: 'url', placeholder: 'https://...', max: 500 }]}
                      onAdd={v => {
                        const url = /^https?:\/\//i.test(v.url) ? v.url : `https://${v.url}`
                        update({ links: [...s.links, { id: uid(), title: v.title, url }] })
                      }}
                      onRemove={id => update({ links: s.links.filter(x => x.id !== id) })}
                      row={l => (
                        <div className='flex items-center gap-3'>
                          <div className='min-w-0 flex-1'>
                            <div className='text-[13px] font-semibold text-text truncate'>{l.title}</div>
                            <div className='text-[12px] text-muted truncate'>{l.url}</div>
                          </div>
                          <Button size='sm' icon={FiExternalLink} onClick={() => openExternal(l.url)}>Open</Button>
                        </div>
                      )} />
                  )}
                  {tab === 'snippets' && (
                    <ItemList key={s.id} items={s.snippets} icon={FiMessageSquare}
                      empty={{ title: 'No chat snippets yet', hint: 'Save messages you send often, like callouts or a GG, and copy them in one click.' }}
                      fields={[{ key: 'text', placeholder: 'Message', max: 300 }]}
                      onAdd={v => update({ snippets: [...s.snippets, { id: uid(), ...v }] })}
                      onRemove={id => update({ snippets: s.snippets.filter(x => x.id !== id) })}
                      row={t => (
                        <div className='flex items-center gap-3'>
                          <p className='min-w-0 flex-1 text-[13px] text-text break-words'>{t.text}</p>
                          <Button size='sm' icon={FiCopy} onClick={() => copy(t.text, 'Snippet')}>Copy</Button>
                        </div>
                      )} />
                  )}
                </div>
              </section>
            </Card>
          )}

      <Modal open={!!confirm} onClose={() => setConfirm(null)} width={400}
        title={confirm?.kind === 'reset' ? 'Reset all notes?' : `Delete ${confirm?.name || 'section'}?`}
        footer={<>
          <Button variant='ghost' onClick={() => setConfirm(null)}>Cancel</Button>
          <Button variant='danger' icon={confirm?.kind === 'reset' ? FiRotateCcw : FiTrash2}
            onClick={() => { confirm.kind === 'reset' ? reset() : removeSection(confirm.id); setConfirm(null) }}>
            {confirm?.kind === 'reset' ? 'Reset' : 'Delete'}
          </Button>
        </>}>
        <p className='text-[13px] text-muted'>
          {confirm?.kind === 'reset'
            ? 'Every section, crosshair, link and snippet is removed and you start over with one empty section. Player notes are kept.'
            : 'Its notes, crosshairs, links and snippets are removed. This can\'t be undone.'}
        </p>
      </Modal>

      <MemoModal open={!!target} onClose={() => setTarget(null)} target={target} memos={memoMap} allTags={memoTags} onChanged={() => memos.reload(true)} />
    </Page>
  )
}
