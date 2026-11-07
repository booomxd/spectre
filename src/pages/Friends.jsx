import React, { useMemo, useState } from 'react'
import { FiClock, FiEdit3, FiLogOut, FiMessageSquare, FiUserPlus, FiUsers, FiX, FiCheck, FiUserX, FiSearch, FiPlus } from 'react-icons/fi'
import { Page, Card, Heading, Button, Input, Toggle, Badge, Skeleton, Empty, ErrorState, RequireRiot, withToast, cx, Stagger, Item, FadeIn } from '../ui'
import { invoke, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { navigate } from '../nav'
import { RankIcon, PlayerCard, StatusDot } from './live/parts'
import { queueName, STATE_LABEL } from './live/util'
import { Conversations, ChatPanel } from './friends/Chat'
import { ListLabel, ListRow, Pane, SearchField, SPLIT_BODY, SplitView } from './friends/Layout'

function statusLine(f) {
  const s = f.status
  if (!f.online) return 'Offline'
  if (f.product !== 'valorant') return f.product === 'league_of_legends' ? 'Playing League of Legends' : 'Online'
  const mode = s.queueId ? queueName(s.queueId) : null
  switch (s.state) {
    case 'ingame': return [mode, s.map, s.score && `${s.score[0]} - ${s.score[1]}`].filter(Boolean).join(' · ') || 'In match'
    case 'pregame': return ['Agent select', mode, s.map].filter(Boolean).join(' · ')
    case 'queue': return `In queue${mode ? ' · ' + mode : ''}`
    default: return STATE_LABEL[s.state] + (mode && s.state === 'menus' ? ' · ' + mode : '')
  }
}

// Quick actions for one friend (row hover and the chat header).
function FriendActions({ f, canInvite, onInvite, onChat }) {
  const b = 'w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:pointer-events-none'
  return (
    <div className='flex items-center gap-0.5' onClick={e => e.stopPropagation()}>
      {onChat && <button className={b} title='Message' onClick={() => onChat(f)}><FiMessageSquare size={14} /></button>}
      <button className={b} title='Invite to party' disabled={!canInvite || !f.online} onClick={() => onInvite(f)}><FiUserPlus size={14} /></button>
      <button className={b} title='Match history' onClick={() => navigate('history', { puuid: f.puuid })}><FiClock size={14} /></button>
      <button className={b} title='Add note' onClick={() => navigate('memo', { puuid: f.puuid, name: `${f.gameName}#${f.tagLine}` })}><FiEdit3 size={14} /></button>
    </div>
  )
}

function FriendRow({ f, index, canInvite, onInvite, onChat, chatOpen }) {
  const s = f.status
  const val = f.product === 'valorant'
  return (
    <Item index={index}>
      <ListRow selected={chatOpen} layoutId='squad-friend' onClick={() => onChat(f)} dim={!f.online}>
        <div className='relative shrink-0'>
          <PlayerCard id={s.card} name={f.gameName} size={38} />
          {f.online && <StatusDot state={s.state} className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
        </div>
        <div className='relative min-w-0 flex-1'>
          <div className='flex items-baseline gap-1 truncate'>
            <span className='text-[13.5px] font-semibold tracking-tight text-text truncate'>{f.gameName}</span>
            <span className='text-[11px] text-muted'>#{f.tagLine}</span>
            {f.spectre && <span className='self-center ml-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent))]' title='Uses Spectre' />}
          </div>
          <div className='text-[11.5px] text-muted truncate mt-0.5'>{f.note ? <span className='text-accent/90'>{f.note} · </span> : null}{statusLine(f)}</div>
        </div>
        <div className='relative flex items-center gap-2 shrink-0 group-hover:opacity-0 transition-opacity'>
          {val && s.partySize > 1 && <span className='text-[10.5px] font-semibold text-muted tabular-nums inline-flex items-center gap-1'><FiUsers size={11} />{s.partySize}</span>}
          {val && <RankIcon tier={s.rank} size={26} />}
        </div>
        <div className='absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity glass-strong rounded-full px-0.5'>
          <FriendActions f={f} canInvite={canInvite} onInvite={onInvite} />
        </div>
      </ListRow>
    </Item>
  )
}

function Group({ title, items, chatPuuid, offset = 0, ...rest }) {
  if (!items.length) return null
  return (
    <>
      <ListLabel count={items.length}>{title}</ListLabel>
      <Stagger className='flex flex-col gap-0.5'>
        {items.map((f, i) => <FriendRow key={f.puuid} f={f} index={offset + i} chatOpen={chatPuuid === f.puuid} {...rest} />)}
      </Stagger>
    </>
  )
}

function PartyPanel({ party, loading, error, reload }) {
  const [busy, setBusy] = useState(false)
  const act = async (p, ok) => { setBusy(true); await withToast(p, ok); setBusy(false); reload(true) }
  if (loading && !party) return <Skeleton className='h-[260px] rounded-3xl' />
  if (error && !party) return <Card className='p-6 rounded-3xl'><Empty icon={FiUsers} title='Party unavailable' hint='Open VALORANT to use parties.' className='!py-8' /></Card>
  if (!party) return <Card className='p-6 rounded-3xl'><Empty icon={FiUsers} title='No party' hint='Start VALORANT to get a party.' className='!py-8' /></Card>
  const queued = party.state === 'MATCHMAKING'
  const slots = Math.max(5, party.members.length)
  return (
    <Card className='relative overflow-hidden p-6 rounded-3xl'>
      <span className='halo -top-32 -left-24 w-96 h-96 opacity-70' />
      <div className='relative flex items-start justify-between gap-4 mb-6'>
        <div>
          <div className='eyebrow mb-2'>Your party</div>
          <div className='flex items-baseline gap-3'>
            <span className='display text-[30px]'>{queued ? 'In queue' : 'Lobby'}</span>
            {party.queueId && <span className='text-[13px] text-muted'>{queueName(party.queueId)}</span>}
          </div>
        </div>
        <div className='flex items-center gap-2'>
          <Badge tone={queued ? 'warn' : 'neutral'}>{party.members.length}/5</Badge>
          {party.open && <Badge tone='good'>Open</Badge>}
        </div>
      </div>
      <Stagger className='relative grid grid-cols-5 gap-3'>
        {Array.from({ length: slots }, (_, i) => {
          const mem = party.members[i]
          if (!mem) return (
            <Item key={'empty' + i} index={i} className='glass-inset rounded-2xl h-[148px] flex flex-col items-center justify-center gap-2 text-muted'>
              <span className='w-10 h-10 rounded-full border border-dashed border-line flex items-center justify-center'><FiPlus size={14} /></span>
              <span className='text-[11px] font-medium'>Open slot</span>
            </Item>
          )
          return (
            <Item key={mem.puuid} index={i} className={cx('group relative rounded-2xl h-[148px] px-3 pt-4 pb-3 flex flex-col items-center text-center', mem.self ? 'accent-soft' : 'glass')}>
              <PlayerCard id={mem.card} name={mem.hidden ? null : mem.gameName} size={46} />
              <div className='mt-2.5 w-full text-[12.5px] font-semibold tracking-tight text-text truncate'>{mem.hidden ? 'Hidden player' : mem.gameName || '...'}</div>
              <div className='text-[10.5px] text-muted truncate w-full'>{mem.owner ? 'Leader' : 'Member'}{mem.level != null && ` · Lv ${mem.level}`}</div>
              <div className='mt-auto'><RankIcon tier={mem.rank} size={24} /></div>
              {party.iOwn && !mem.self && (
                <button title='Kick' disabled={busy} onClick={() => act(invoke('social:partyRemove', mem.puuid), 'Removed from party')}
                  className='absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad/15 transition-[transform,opacity,background-color,border-color,color] duration-200'><FiUserX size={13} /></button>
              )}
            </Item>
          )
        })}
      </Stagger>
      <div className='relative mt-6 pt-5 border-t border-line flex items-center justify-between gap-6'>
        <div className='flex-1 max-w-sm'>
          <Toggle checked={party.open} disabled={!party.iOwn || busy} label='Open party' hint={party.iOwn ? 'Friends can join freely' : 'Only the leader can change this'}
            onChange={v => act(invoke('social:partyAccess', v), v ? 'Party opened' : 'Party closed')} />
        </div>
        {party.members.length > 1 && <Button variant='danger' size='sm' icon={FiLogOut} disabled={busy} onClick={() => act(invoke('social:partyRemove', party.members.find(m => m.self).puuid), 'Left party')}>Leave party</Button>}
      </div>
    </Card>
  )
}

function Requests({ data, reload }) {
  const [busy, setBusy] = useState('')
  const empty = !data || (!data.incoming.length && !data.outgoing.length)
  const run = async (key, channel, puuid, ok) => { setBusy(key); await withToast(invoke(channel, puuid), ok); setBusy(''); reload(true) }
  const Row = ({ r, children }) => (
    <div className='flex items-center gap-2 rounded-xl px-2.5 py-2 -mx-1 hover:bg-surface-2/70 transition-colors'>
      <div className='min-w-0 flex-1 text-[13px] font-medium text-text truncate'>{r.gameName}<span className='text-[11px] text-muted'> #{r.tagLine}</span></div>
      {children}
    </div>
  )
  return (
    <Card className='p-5 rounded-3xl h-full'>
      <Heading hint={empty ? 'Nothing pending' : `${data.incoming.length} incoming · ${data.outgoing.length} sent`}>Requests</Heading>
      {!empty && (
        <div className='max-h-60 overflow-y-auto -mr-2 pr-2'>
          {data.incoming.map(r => (
            <Row key={r.puuid} r={r}>
              <Button size='icon' variant='glow' className='!w-8 !h-8' title='Accept' loading={busy === 'a' + r.puuid} onClick={() => run('a' + r.puuid, 'social:acceptRequest', r.puuid, 'Friend added')}><FiCheck /></Button>
              <Button size='icon' variant='ghost' className='!w-8 !h-8' title='Decline' loading={busy === 'd' + r.puuid} onClick={() => run('d' + r.puuid, 'social:declineRequest', r.puuid, 'Declined')}><FiX /></Button>
            </Row>
          ))}
          {data.outgoing.map(r => (
            <Row key={r.puuid} r={r}>
              <Badge>Sent</Badge>
              <Button size='icon' variant='ghost' className='!w-8 !h-8' title='Cancel' loading={busy === 'c' + r.puuid} onClick={() => run('c' + r.puuid, 'social:cancelRequest', r.puuid, 'Request cancelled')}><FiX /></Button>
            </Row>
          ))}
        </div>
      )}
    </Card>
  )
}

function AddFriend({ onDone }) {
  const [id, setId] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async e => {
    e.preventDefault()
    const i = id.lastIndexOf('#')
    if (i < 1 || i === id.length - 1) return withToast(Promise.reject(new Error('Use the format Name#Tag')))
    setBusy(true)
    const ok = await withToast(invoke('social:addFriend', id.slice(0, i).trim(), id.slice(i + 1).trim()), 'Friend request sent')
    setBusy(false)
    if (ok) { setId(''); onDone() }
  }
  return (
    <Card className='p-5 rounded-3xl h-full'>
      <Heading hint='Send a request by Riot ID'>Add a friend</Heading>
      <form onSubmit={submit} className='flex gap-2'>
        <Input value={id} onChange={e => setId(e.target.value)} placeholder='Name#Tag' className='!rounded-full' />
        <Button type='submit' variant='primary' icon={FiUserPlus} loading={busy} disabled={!id.includes('#')}>Add</Button>
      </form>
    </Card>
  )
}

function FriendsBody({ active }) {
  const poll = active ? 5000 : undefined
  const friends = useInvoke('social:friends', [], { poll })
  const party = useInvoke('social:party', [], { poll })
  const requests = useInvoke('social:requests', [], { poll })
  const convs = useInvoke('chat:conversations', [], { poll: active ? 4000 : undefined })
  const [q, setQ] = useState('')
  const [chat, setChat] = useState(null)
  const byPuuid = useMemo(() => Object.fromEntries((friends.data || []).map(f => [f.puuid, f])), [friends.data])
  // A DM's conversation id is the friend's pid; reuse the existing conversation if there is one.
  const openChat = (cid, puuid) => setChat({ cid, puuid })
  const chatWith = f => {
    const cid = convs.data?.find(c => c.puuid === f.puuid)?.cid || f.pid
    if (!cid) return withToast(Promise.reject(new Error("Can't message this friend right now")))
    openChat(cid, f.puuid)
  }

  const groups = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const list = (friends.data || []).filter(f => !needle || `${f.gameName}#${f.tagLine}`.toLowerCase().includes(needle) || f.note?.toLowerCase().includes(needle))
    const rank = f => ({ ingame: 0, pregame: 1, queue: 2, menus: 3, away: 4 }[f.status.state] ?? 5)
    const sorted = [...list].sort((a, b) => rank(a) - rank(b) || a.gameName.localeCompare(b.gameName))
    return {
      valorant: sorted.filter(f => f.online && f.product === 'valorant'),
      elsewhere: sorted.filter(f => f.online && f.product !== 'valorant'),
      offline: sorted.filter(f => !f.online).sort((a, b) => (b.lastOnline || 0) - (a.lastOnline || 0)),
    }
  }, [friends.data, q])

  const canInvite = !!party.data
  const invite = f => withToast(invoke('social:invite', f.gameName, f.tagLine), `Invited ${f.gameName}`)
  const online = groups.valorant.length + groups.elsewhere.length
  const pending = requests.data?.incoming?.length || 0
  const chatFriend = chat && byPuuid[chat.puuid]
  const shared = { canInvite, onInvite: invite, onChat: chatWith, chatPuuid: chat?.puuid }

  const list = (
    <Pane title='Friends' right={friends.data && <span className='text-[11px] font-semibold text-muted tabular-nums'><span className='text-good'>{online}</span> / {friends.data.length}</span>}
      header={<SearchField value={q} onChange={setQ} placeholder='Search friends or notes' />}>
      {friends.loading && !friends.data ? (
        <div className='flex flex-col gap-1.5 p-1'>{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className='h-[54px] rounded-2xl' />)}</div>
      ) : friends.error && !friends.data ? <ErrorState error={friends.error} onRetry={friends.reload} />
        : !friends.data?.length ? <Empty icon={FiUsers} title='No friends yet' hint='Add a friend by Riot ID.' />
          : !(online || groups.offline.length) ? <Empty icon={FiSearch} title='No matches' hint='Try a different name or note.' />
            : <>
              {!q && <Conversations convs={convs.data} friends={byPuuid} selected={chat?.cid} onOpen={openChat} />}
              <Group title='In VALORANT' items={groups.valorant} {...shared} />
              <Group title='Elsewhere' items={groups.elsewhere} offset={groups.valorant.length} {...shared} />
              <Group title='Offline' items={groups.offline} offset={online} {...shared} />
            </>}
    </Pane>
  )

  return (
    <Page title='Friends' subtitle={friends.data ? `${online} online of ${friends.data.length}${pending ? ` · ${pending} new ${pending === 1 ? 'request' : 'requests'}` : ''}` : 'Your Riot friends and party'}
      bodyClassName={SPLIT_BODY}>
      <SplitView list={list}>
        {chat ? (
          <ChatPanel key={chat.cid} cid={chat.cid} friend={chatFriend} statusLine={statusLine} active={active}
            actions={chatFriend && <FriendActions f={chatFriend} canInvite={canInvite} onInvite={invite} />}
            onClose={() => setChat(null)} onSent={() => convs.reload(true)} />
        ) : (
          <FadeIn className='flex flex-col gap-5'>
            <PartyPanel party={party.data} loading={party.loading} error={party.error} reload={party.reload} />
            <div className='grid grid-cols-1 xl:grid-cols-2 gap-5'>
              <AddFriend onDone={requests.reload} />
              <Requests data={requests.data} reload={requests.reload} />
            </div>
          </FadeIn>
        )}
      </SplitView>
    </Page>
  )
}

export default function Friends({ active }) {
  const { connected } = useRiot()
  return (
    <RequireRiot>
      {connected && <FriendsBody active={active} />}
    </RequireRiot>
  )
}
