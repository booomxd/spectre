import { useMemo, useState } from 'react'
import { FiCheck, FiSearch } from 'react-icons/fi'
import { Badge, Button, Card, Empty, Input, Label, Page, RequireRiot, Skeleton, Tabs, Toggle, toast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent } from '../lib/content'
import { NO_TITLE, lc } from './tools/gear'
import { PresencePanel, usePresence } from './tools/PresencePanel'

const cx = (...c) => c.filter(Boolean).join(' ')
const TABS = [{ value: 'profile', label: 'Profile' }, { value: 'cards', label: 'Cards' }, { value: 'borders', label: 'Borders' }, { value: 'titles', label: 'Titles' }]

export default function Customize({ active }) {
  const riot = useRiot()
  const presence = usePresence(active)
  const loadout = useInvoke('loadout:get', [], { skip: !riot.connected })
  const cards = useContent('playercards')
  const borders = useContent('levelborders')
  const titles = useContent('playertitles')
  const [tab, setTab] = useState('profile')
  const [q, setQ] = useState('')
  const [level, setLevel] = useState('')
  const [idle, setIdle] = useState(null)
  const [cardId, setCardId] = useState(null)
  const [titleId, setTitleId] = useState(undefined)
  const [borderId, setBorderId] = useState(null)
  const [busy, setBusy] = useState(false)

  const pp = presence.data?.current?.playerPresenceData
  const id = loadout.data?.Identity
  const curCard = cardId ?? pp?.playerCardId ?? id?.PlayerCardID
  const curTitle = titleId !== undefined ? titleId : (pp?.playerTitleId ?? (id && lc(id.PlayerTitleID) !== NO_TITLE ? id.PlayerTitleID : null))
  const curBorder = borderId ?? id?.PreferredLevelBorderID
  const curLevel = level === '' ? (pp?.accountLevel ?? 1) : parseInt(level) || 1
  const curIdle = idle ?? presence.data?.current?.isIdle ?? false

  // Cards and titles are presence-only (shown to friends, never equipped), so every one can be picked.
  const allCards = useMemo(() => cards?.filter(c => c.displayIcon), [cards])
  const allTitles = useMemo(() => titles?.filter(t => t.titleText), [titles])
  const shownCards = allCards?.filter(c => c.displayName.toLowerCase().includes(q.toLowerCase()))
  const shownTitles = allTitles?.filter(t => (t.titleText + t.displayName).toLowerCase().includes(q.toLowerCase()))
  const dirty = level !== '' || idle !== null || cardId || titleId !== undefined || borderId

  const save = async () => {
    setBusy(true)
    try {
      await invoke('tools:profile', { accountLevel: curLevel, isIdle: curIdle, playerCardId: cardId || undefined, playerTitleId: titleId })
      if (borderId) await invoke('loadout:identity', { borderId })
      toast.success(borderId ? 'Saved. The border may need a game restart to show in your own client' : 'Saved')
      setLevel(''); setIdle(null); setCardId(null); setTitleId(undefined); setBorderId(null)
      loadout.reload(true)
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  const search = (
    <div className='relative mb-4'>
      <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none' />
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search' className='pl-10 rounded-full' />
    </div>
  )

  return (
    <Page title='Customize' subtitle='Level, card, title and border. Any card or title can be shown to friends.'
      actions={<Button variant='primary' icon={FiCheck} loading={busy} disabled={!dirty || !riot.connected} onClick={save}>Save changes</Button>}>
      <RequireRiot>
        <div className='grid grid-cols-[1fr_320px] gap-5 items-start'>
          <div className='min-w-0'>
            <Tabs tabs={TABS} value={tab} onChange={t => { setTab(t); setQ('') }} className='mb-5' />
            {tab === 'profile' && (
              <div className='space-y-4 anim-fade'>
                <Card className='p-5'>
                  <Label hint='Shown in the lobby and friends list'>Account level</Label>
                  <Input type='number' min='1' max='2000' value={level === '' ? curLevel : level} onChange={e => setLevel(e.target.value)} className='max-w-[160px]' />
                </Card>
                <Card className='p-5'><Toggle checked={curIdle} onChange={setIdle} label='Idle status' hint='Appear as away in the friends list' /></Card>
              </div>
            )}
            {tab === 'cards' && (
              <div className='anim-fade'>
                {search}
                {!shownCards ? <div className='grid grid-cols-4 gap-3'>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='h-40 rounded-2xl' />)}</div>
                  : !shownCards.length ? <Empty title='No cards found' /> : (
                    <div className='grid grid-cols-4 gap-3 stagger'>
                      {shownCards.map((c, i) => (
                        <button key={c.uuid} style={{ '--i': Math.min(i, 14) }} onClick={() => setCardId(c.uuid)}
                          className={cx('lift anim-rise rounded-2xl p-2 text-left', lc(curCard) === lc(c.uuid) ? 'accent-soft border border-accent/50' : 'glass hover:bg-surface-2')}>
                          <img src={c.displayIcon} className='w-full rounded-xl' loading='lazy' />
                          <div className='text-[11px] font-medium text-muted truncate mt-1.5 px-1 text-center'>{c.displayName}</div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
            {tab === 'borders' && (
              <div className='grid grid-cols-3 gap-3 stagger anim-fade'>
                {!borders ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-28 rounded-2xl' />) : borders.filter(b => b.levelNumberAppearance).map((b, i) => (
                  <button key={b.uuid} style={{ '--i': Math.min(i, 14) }} onClick={() => setBorderId(b.uuid)}
                    className={cx('lift anim-rise rounded-2xl p-4', lc(curBorder) === lc(b.uuid) ? 'accent-soft border border-accent/50' : 'glass hover:bg-surface-2')}>
                    <img src={b.levelNumberAppearance} className='w-full h-14 object-contain' loading='lazy' />
                    <div className='text-[11px] font-medium text-muted text-center mt-2 tabular-nums'>From level {b.startingLevel}</div>
                  </button>
                ))}
              </div>
            )}
            {tab === 'titles' && (
              <div className='anim-fade'>
                {search}
                {!shownTitles ? <Skeleton className='h-40 rounded-2xl' /> : (
                  <div className='space-y-2 stagger'>
                    <TitleRow on={!curTitle} onClick={() => setTitleId('')} title='No title' sub='Remove title' />
                    {shownTitles.map((t, i) => <TitleRow key={t.uuid} i={i} on={lc(curTitle) === lc(t.uuid)} onClick={() => setTitleId(t.uuid)} title={t.titleText} sub={t.displayName} />)}
                  </div>
                )}
              </div>
            )}
            {dirty && <div className='mt-5'><Badge tone='warn'>Unsaved changes</Badge></div>}
          </div>
          <PresencePanel presence={presence} draft={{ level: curLevel, cardId: curCard, titleId: curTitle || null }} />
        </div>
      </RequireRiot>
    </Page>
  )
}

function TitleRow({ on, onClick, title, sub, i = 0 }) {
  return (
    <button onClick={onClick} style={{ '--i': Math.min(i, 14) }}
      className={cx('lift anim-rise w-full text-left rounded-xl px-4 py-3', on ? 'accent-soft border border-accent/50' : 'glass hover:bg-surface-2')}>
      <div className='text-[13px] font-semibold text-text tracking-tight'>{title}</div>
      <div className='text-[11px] text-muted mt-0.5'>{sub}</div>
    </button>
  )
}
