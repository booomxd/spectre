import React, { useMemo, useState } from 'react'
import { FiClock, FiEdit3, FiLogOut, FiMessageSquare, FiSearch, FiUserPlus, FiUsers, FiX, FiCheck, FiUserX } from 'react-icons/fi'
import { Page, Card, SectionTitle, Button, Input, Toggle, Badge, Skeleton, Empty, ErrorState, RequireRiot, withToast } from '../ui'
import { invoke, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { navigate } from '../nav'
import { RankIcon, PlayerCard, StatusDot } from './live/parts'
import { queueName, STATE_LABEL } from './live/util'
import { Conversations, ChatPanel } from './friends/Chat'

const cx = (...c) => c.filter(Boolean).join(' ')

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

function FriendRow({ f, i, canInvite, onInvite, onChat, chatOpen }) {
  const s = f.status
  const val = f.product === 'valorant'
  return (
    <div onClick={() => onChat(f)} style={{ '--i': i }}
      className={cx('group anim-rise flex items-center gap-3 rounded-xl border px-3 py-2.5 cursor-pointer transition-colors',
        chatOpen ? 'border-accent/50 bg-surface-2' : 'border-line bg-surface hover:border-accent/40 hover:bg-surface-2/60', !f.online && !chatOpen && 'opacity-60 hover:opacity-100')}>
      <div className='relative'>
        <PlayerCard id={s.card} name={f.gameName} size={42} />
        {f.online && <StatusDot state={s.state} className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
      </div>
      <div className='min-w-0 flex-1'>
        <div className='flex items-baseline gap-1.5 truncate'>
          <span className='text-[13px] font-semibold text-text truncate'>{f.gameName}</span>
          <span className='text-[11px] text-muted'>#{f.tagLine}</span>
          {f.spectre && <Badge tone='accent' className='!h-4 !px-1.5 !text-[9px] self-center'>Spectre</Badge>}
          {f.note && <span className='text-[11px] text-accent/80 truncate'>· {f.note}</span>}
        </div>
        <div className='text-[12px] text-muted truncate'>{statusLine(f)}</div>
      </div>
      {val && s.partySize > 1 && <Badge><FiUsers /> {s.partySize}/{s.maxPartySize}</Badge>}
      {val && s.level != null && <span className='hidden xl:block text-[11px] text-muted w-10 text-right'>Lv {s.level}</span>}
      {val && <RankIcon tier={s.rank} size={30} />}
      <div className='flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity' onClick={e => e.stopPropagation()}>
        <Button variant='ghost' size='sm' className='!px-2' title='Message' onClick={() => onChat(f)}><FiMessageSquare /></Button>
        <Button variant='ghost' size='sm' className='!px-2' title='Invite to party' disabled={!canInvite || !f.online} onClick={() => onInvite(f)}><FiUserPlus /></Button>
        <Button variant='ghost' size='sm' className='!px-2' title='Match history' onClick={() => navigate('history', { puuid: f.puuid })}><FiClock /></Button>
        <Button variant='ghost' size='sm' className='!px-2' title='Add note' onClick={() => navigate('memo', { puuid: f.puuid, name: `${f.gameName}#${f.tagLine}` })}><FiEdit3 /></Button>
      </div>
    </div>
  )
}

function Group({ title, items, chatPuuid, ...rest }) {
  if (!items.length) return null
  return (
    <section className='mb-6'>
      <SectionTitle right={<span className='text-[11px] text-muted'>{items.length}</span>}>{title}</SectionTitle>
      <div className='grid gap-2 stagger'>{items.map((f, i) => <FriendRow key={f.puuid} f={f} i={i} chatOpen={chatPuuid === f.puuid} {...rest} />)}</div>
    </section>
  )
}

function PartyPanel({ party, loading, error, reload }) {
  const [busy, setBusy] = useState(false)
  const act = async (p, ok) => { setBusy(true); await withToast(p, ok); setBusy(false); reload(true) }
  if (loading && !party) return <Card className='p-4'><Skeleton className='h-14 w-full' /></Card>
  if (error && !party) return <Card className='p-4 text-[12px] text-muted'>Party unavailable. Open VALORANT to use parties.</Card>
  if (!party) return <Card className='p-4'><Empty icon={FiUsers} title='No party' hint='Start VALORANT to get a party.' className='!py-6' /></Card>
  return (
    <Card className='p-4 anim-fade'>
      <div className='flex items-center justify-between mb-3'>
        <div className='flex items-center gap-2'>
          <Badge tone={party.state === 'MATCHMAKING' ? 'warn' : 'neutral'}>{party.state === 'MATCHMAKING' ? 'In queue' : 'Lobby'}</Badge>
          {party.queueId && <span className='text-[12px] text-muted'>{queueName(party.queueId)}</span>}
        </div>
        <span className='text-[11px] text-muted'>{party.members.length}/5</span>
      </div>
      <div className='grid gap-2 mb-3 stagger'>
        {party.members.map((m, i) => (
          <div key={m.puuid} className='anim-rise flex items-center gap-2.5' style={{ '--i': i }}>
            <PlayerCard id={m.card} name={m.hidden ? null : m.gameName} size={34} />
            <div className='min-w-0 flex-1'>
              <div className='text-[13px] font-semibold truncate'>{m.hidden ? 'Hidden player' : m.gameName || '...'}{m.tagLine && <span className='text-[11px] text-muted font-normal'> #{m.tagLine}</span>}</div>
              <div className='text-[11px] text-muted'>{m.owner ? 'Leader' : 'Member'}{m.level != null && ` · Lv ${m.level}`}{m.self && ' · You'}</div>
            </div>
            <RankIcon tier={m.rank} size={26} />
            {party.iOwn && !m.self && <Button variant='ghost' size='sm' className='!px-2' title='Kick' disabled={busy} onClick={() => act(invoke('social:partyRemove', m.puuid), 'Removed from party')}><FiUserX /></Button>}
          </div>
        ))}
      </div>
      <div className='border-t border-line pt-3 flex items-center justify-between gap-3'>
        <Toggle checked={party.open} disabled={!party.iOwn || busy} label='Open party' hint={party.iOwn ? 'Friends can join freely' : 'Only the leader can change this'}
          onChange={v => act(invoke('social:partyAccess', v), v ? 'Party opened' : 'Party closed')} />
        {party.members.length > 1 && <Button variant='danger' size='sm' icon={FiLogOut} disabled={busy} onClick={() => act(invoke('social:partyRemove', party.members.find(m => m.self).puuid), 'Left party')}>Leave</Button>}
      </div>
    </Card>
  )
}

function Requests({ data, reload }) {
  const [busy, setBusy] = useState('')
  if (!data || (!data.incoming.length && !data.outgoing.length)) return null
  const run = async (key, channel, puuid, ok) => { setBusy(key); await withToast(invoke(channel, puuid), ok); setBusy(''); reload(true) }
  const Row = ({ r, children }) => (
    <div className='anim-rise flex items-center gap-2 py-1.5'>
      <div className='min-w-0 flex-1 text-[13px] truncate'>{r.gameName}<span className='text-[11px] text-muted'> #{r.tagLine}</span></div>
      {children}
    </div>
  )
  return (
    <Card className='p-4 anim-fade'>
      <SectionTitle>Friend requests</SectionTitle>
      <div className='max-h-60 overflow-y-auto pr-1'>
        {data.incoming.map(r => (
          <Row key={r.puuid} r={r}>
            <Button size='sm' variant='subtle' className='!px-2' title='Accept' loading={busy === 'a' + r.puuid} onClick={() => run('a' + r.puuid, 'social:acceptRequest', r.puuid, 'Friend added')}><FiCheck /></Button>
            <Button size='sm' variant='ghost' className='!px-2' title='Decline' loading={busy === 'd' + r.puuid} onClick={() => run('d' + r.puuid, 'social:declineRequest', r.puuid, 'Declined')}><FiX /></Button>
          </Row>
        ))}
        {data.outgoing.map(r => (
          <Row key={r.puuid} r={r}>
            <Badge>Sent</Badge>
            <Button size='sm' variant='ghost' className='!px-2' title='Cancel' loading={busy === 'c' + r.puuid} onClick={() => run('c' + r.puuid, 'social:cancelRequest', r.puuid, 'Request cancelled')}><FiX /></Button>
          </Row>
        ))}
      </div>
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
    <Card className='p-4'>
      <SectionTitle>Add friend</SectionTitle>
      <form onSubmit={submit} className='flex gap-2'>
        <Input value={id} onChange={e => setId(e.target.value)} placeholder='Name#Tag' />
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

  return (
    <Page title='Friends' subtitle={friends.data ? `${online} online of ${friends.data.length}` : 'Your Riot friends and party'}>
      <div className={cx('grid gap-6 items-start', chat ? 'lg:grid-cols-[1fr_420px]' : 'lg:grid-cols-[1fr_330px]')}>
        <div className='min-w-0'>
          <div className='relative mb-5'>
            <FiSearch className='absolute left-3 top-1/2 -translate-y-1/2 text-muted' />
            <Input value={q} onChange={e => setQ(e.target.value)} placeholder='Search friends or notes' className='!pl-9' />
          </div>
          {friends.loading && !friends.data ? (
            <div className='grid gap-2'>{Array.from({ length: 7 }, (_, i) => <Skeleton key={i} className='h-[62px] rounded-xl' />)}</div>
          ) : friends.error && !friends.data ? <ErrorState error={friends.error} onRetry={friends.reload} />
            : !friends.data?.length ? <Empty icon={FiUsers} title='No friends yet' hint='Add a friend by Riot ID on the right.' />
              : !(online || groups.offline.length) ? <Empty icon={FiSearch} title='No matches' hint='Try a different name or note.' />
                : <>
                  {!q && <Conversations convs={convs.data} friends={byPuuid} selected={chat?.cid} onOpen={openChat} />}
                  <Group title='Online in VALORANT' items={groups.valorant} canInvite={canInvite} onInvite={invite} onChat={chatWith} chatPuuid={chat?.puuid} />
                  <Group title='Online elsewhere' items={groups.elsewhere} canInvite={canInvite} onInvite={invite} onChat={chatWith} chatPuuid={chat?.puuid} />
                  <Group title='Offline' items={groups.offline} canInvite={canInvite} onInvite={invite} onChat={chatWith} chatPuuid={chat?.puuid} />
                </>}
        </div>
        {chat ? (
          <div className='lg:sticky lg:top-0'>
            <ChatPanel key={chat.cid} cid={chat.cid} friend={byPuuid[chat.puuid]} statusLine={statusLine} active={active}
              onClose={() => setChat(null)} onSent={() => convs.reload(true)} />
          </div>
        ) : <div className='grid gap-4 lg:sticky lg:top-0'>
          <div>
            <SectionTitle>Party</SectionTitle>
            <PartyPanel party={party.data} loading={party.loading} error={party.error} reload={party.reload} />
          </div>
          <AddFriend onDone={requests.reload} />
          <Requests data={requests.data} reload={requests.reload} />
        </div>}
      </div>
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
