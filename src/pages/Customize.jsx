import { useMemo, useState } from 'react'
import { FiCheck, FiSearch } from 'react-icons/fi'
import { Badge, Button, Empty, Input, Label, Page, RequireRiot, SegmentedTabs, Skeleton, Swap, Toggle, toast } from '../ui'
import { useRiot } from '../lib/riot'
import { invoke, useInvoke } from '../lib/ipc'
import { useContent } from '../lib/content'
import { NO_TITLE, lc } from './tools/gear'
import { PresencePanel, usePresence } from './tools/PresencePanel'
import { Choice, Panel, ToolLayout } from './tools/Layout'

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
    <div className='relative mb-3.5'>
      <FiSearch className='absolute left-3.5 top-1/2 -translate-y-1/2 text-muted pointer-events-none' />
      <Input value={q} onChange={e => setQ(e.target.value)} placeholder={`Search ${tab}`} className='pl-10 rounded-full' />
    </div>
  )

  return (
    <Page title='Profile' subtitle='Level, card, title and border. Any card or title can be shown to friends.'
      actions={<>
        {dirty && <Badge tone='warn'>Unsaved</Badge>}
        <Button variant='primary' size='sm' icon={FiCheck} loading={busy} disabled={!dirty || !riot.connected} onClick={save}>Save changes</Button>
      </>}>
      <RequireRiot>
        <ToolLayout aside={<PresencePanel presence={presence} draft={{ level: curLevel, cardId: curCard, titleId: curTitle || null }} />}>
          <SegmentedTabs size='sm' layoutId='profile-tool-tab' className='self-start' tabs={TABS} value={tab} onChange={t => { setTab(t); setQ('') }} />
          <Swap id={tab}>
            {tab === 'profile' && (
              <Panel title='Identity'>
                <div className='flex items-center justify-between gap-6'>
                  <Label hint='Shown in the lobby and friends list'>Account level</Label>
                  <Input type='number' min='1' max='2000' value={level === '' ? curLevel : level} onChange={e => setLevel(e.target.value)} className='w-[140px] text-right tabular-nums font-semibold' />
                </div>
                <div className='hairline my-4' />
                <Toggle checked={curIdle} onChange={setIdle} label='Idle status' hint='Appear as away in the friends list' />
              </Panel>
            )}
            {tab === 'cards' && (
              <Panel title='Player card' right={shownCards && <span className='text-[11px] text-muted tabular-nums'>{shownCards.length}</span>}>
                {search}
                {!shownCards ? <div className='grid grid-cols-5 gap-2'>{Array.from({ length: 10 }).map((_, i) => <Skeleton key={i} className='h-32 rounded-xl' />)}</div>
                  : !shownCards.length ? <Empty title='No cards found' className='py-10' /> : (
                    <div className='grid grid-cols-5 gap-2'>
                      {shownCards.map(c => (
                        <Choice key={c.uuid} on={lc(curCard) === lc(c.uuid)} onClick={() => setCardId(c.uuid)} title={c.displayName} className='p-1.5 text-left'>
                          <img src={c.displayIcon} alt='' className='w-full rounded-lg' loading='lazy' draggable={false} />
                          <div className='text-[10.5px] font-medium text-muted truncate mt-1 px-0.5 text-center'>{c.displayName}</div>
                        </Choice>
                      ))}
                    </div>
                  )}
              </Panel>
            )}
            {tab === 'borders' && (
              <Panel title='Level border' hint='Equipped on your account, not only shown to friends'>
                <div className='grid grid-cols-4 gap-2'>
                  {!borders ? Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className='h-24 rounded-xl' />) : borders.filter(b => b.levelNumberAppearance).map(b => (
                    <Choice key={b.uuid} on={lc(curBorder) === lc(b.uuid)} onClick={() => setBorderId(b.uuid)} className='p-3'>
                      <img src={b.levelNumberAppearance} alt='' className='w-full h-11 object-contain' loading='lazy' draggable={false} />
                      <div className='text-[10.5px] font-medium text-muted text-center mt-1.5 tabular-nums'>From level {b.startingLevel}</div>
                    </Choice>
                  ))}
                </div>
              </Panel>
            )}
            {tab === 'titles' && (
              <Panel title='Title' right={shownTitles && <span className='text-[11px] text-muted tabular-nums'>{shownTitles.length}</span>}>
                {search}
                {!shownTitles ? <Skeleton className='h-40 rounded-xl' /> : (
                  <div className='grid grid-cols-2 gap-2'>
                    <TitleRow on={!curTitle} onClick={() => setTitleId('')} title='No title' sub='Remove title' />
                    {shownTitles.map(t => <TitleRow key={t.uuid} on={lc(curTitle) === lc(t.uuid)} onClick={() => setTitleId(t.uuid)} title={t.titleText} sub={t.displayName} />)}
                  </div>
                )}
              </Panel>
            )}
          </Swap>
        </ToolLayout>
      </RequireRiot>
    </Page>
  )
}

function TitleRow({ on, onClick, title, sub }) {
  return (
    <Choice on={on} onClick={onClick} className='w-full text-left px-3.5 py-2.5'>
      <div className='text-[12.5px] font-semibold text-text tracking-tight truncate'>{title}</div>
      <div className='text-[10.5px] text-muted mt-0.5 truncate'>{sub}</div>
    </Choice>
  )
}
