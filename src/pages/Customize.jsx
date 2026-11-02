import { useMemo, useState } from 'react'
import { FiCheck, FiSearch } from 'react-icons/fi'
import { Badge, Button, Card, Empty, Input, Label, Page, RequireRiot, Skeleton, Tabs, Toggle, toast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent } from '../lib/content'
import { NO_TITLE, lc, useOwned } from './tools/gear'
import { PresencePanel, usePresence } from './tools/PresencePanel'

const cx = (...c) => c.filter(Boolean).join(' ')
const TABS = [{ value: 'profile', label: 'Profile' }, { value: 'cards', label: 'Cards' }, { value: 'borders', label: 'Borders' }, { value: 'titles', label: 'Titles' }]

export default function Customize({ active }) {
  const riot = useRiot()
  const presence = usePresence(active)
  const { owned } = useOwned(!riot.connected)
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

  const ownedCards = useMemo(() => owned && cards?.filter(c => c.displayIcon && owned.cards.has(lc(c.uuid))), [cards, owned])
  const ownedTitles = useMemo(() => owned && titles?.filter(t => t.titleText && owned.titles.has(lc(t.uuid))), [titles, owned])
  const shownCards = ownedCards?.filter(c => c.displayName.toLowerCase().includes(q.toLowerCase()))
  const shownTitles = ownedTitles?.filter(t => (t.titleText + t.displayName).toLowerCase().includes(q.toLowerCase()))
  const dirty = level !== '' || idle !== null || cardId || titleId !== undefined || borderId

  const save = async () => {
    setBusy(true)
    try {
      await invoke('tools:profile', { accountLevel: curLevel, isIdle: curIdle, playerCardId: cardId || undefined, playerTitleId: titleId })
      if (cardId || titleId !== undefined || borderId) await invoke('loadout:identity', { cardId: cardId || undefined, titleId, borderId: borderId || undefined })
      toast.success('Saved. Card, title and border may need a game restart to show in your own client')
      setLevel(''); setIdle(null); setCardId(null); setTitleId(undefined); setBorderId(null)
      loadout.reload(true)
    } catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  const search = (
    <div className='relative mb-3'>
      <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search' className='pl-9' />
    </div>
  )

  return (
    <Page title='Customize' subtitle='Level, card, title and border. Cards and titles are limited to the ones you own.'
      actions={<Button variant='primary' icon={FiCheck} loading={busy} disabled={!dirty || !riot.connected} onClick={save}>Save changes</Button>}>
      <RequireRiot>
        <div className='grid grid-cols-[1fr_320px] gap-5 items-start'>
          <div className='min-w-0'>
            <Tabs tabs={TABS} value={tab} onChange={t => { setTab(t); setQ('') }} className='mb-4' />
            {tab === 'profile' && (
              <div className='space-y-3 anim-fade'>
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
                {!shownCards ? <div className='grid grid-cols-4 gap-2.5'>{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='h-40 rounded-xl' />)}</div>
                  : !shownCards.length ? <Empty title='No cards found' /> : (
                    <div className='grid grid-cols-4 gap-2.5 stagger'>
                      {shownCards.map((c, i) => (
                        <button key={c.uuid} style={{ '--i': Math.min(i, 14) }} onClick={() => setCardId(c.uuid)}
                          className={cx('lift anim-rise rounded-xl border p-1.5 text-left', lc(curCard) === lc(c.uuid) ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
                          <img src={c.displayIcon} className='w-full rounded-lg' loading='lazy' />
                          <div className='text-[10px] text-muted truncate mt-1 text-center'>{c.displayName}</div>
                        </button>
                      ))}
                    </div>
                  )}
              </div>
            )}
            {tab === 'borders' && (
              <div className='grid grid-cols-3 gap-2.5 stagger anim-fade'>
                {!borders ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className='h-24 rounded-xl' />) : borders.filter(b => b.levelNumberAppearance).map((b, i) => (
                  <button key={b.uuid} style={{ '--i': Math.min(i, 14) }} onClick={() => setBorderId(b.uuid)}
                    className={cx('lift anim-rise rounded-xl border p-3', lc(curBorder) === lc(b.uuid) ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
                    <img src={b.levelNumberAppearance} className='w-full h-14 object-contain' loading='lazy' />
                    <div className='text-[11px] text-muted text-center mt-1.5'>From level {b.startingLevel}</div>
                  </button>
                ))}
              </div>
            )}
            {tab === 'titles' && (
              <div className='anim-fade'>
                {search}
                {!shownTitles ? <Skeleton className='h-40 rounded-xl' /> : (
                  <div className='space-y-1.5 stagger'>
                    <TitleRow on={!curTitle} onClick={() => setTitleId('')} title='No title' sub='Remove title' />
                    {shownTitles.map((t, i) => <TitleRow key={t.uuid} i={i} on={lc(curTitle) === lc(t.uuid)} onClick={() => setTitleId(t.uuid)} title={t.titleText} sub={t.displayName} />)}
                  </div>
                )}
              </div>
            )}
            {dirty && <div className='mt-4'><Badge tone='warn'>Unsaved changes</Badge></div>}
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
      className={cx('lift anim-rise w-full text-left rounded-xl border px-4 py-2.5', on ? 'border-accent bg-accent/10' : 'border-line bg-surface')}>
      <div className='text-[13px] font-semibold'>{title}</div>
      <div className='text-[11px] text-muted'>{sub}</div>
    </button>
  )
}
