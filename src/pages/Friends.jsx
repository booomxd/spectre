import { For, Index, createSignal, splitProps, Show, createMemo } from 'solid-js'
import { FiClock, FiEdit3, FiLogOut, FiMessageSquare, FiUserPlus, FiUsers, FiX, FiCheck, FiUserX, FiSearch, FiPlus } from 'solid-icons/fi'
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

// quick actions for one friend
function FriendActions(props) {
  
    const b = () => ('w-8 h-8 rounded-full flex items-center justify-center text-muted hover:text-text hover:bg-surface-2 transition-colors disabled:opacity-40 disabled:pointer-events-none')
    return (<div class='flex items-center gap-0.5' onClick={e => e.stopPropagation()}>
      {props.onChat && <button class={b()} title='Message' onClick={() => props.onChat(props.f)}><FiMessageSquare size={14} /></button>}
      <button class={b()} title='Invite to party' disabled={!props.canInvite || !props.f.online} onClick={() => props.onInvite(props.f)}><FiUserPlus size={14} /></button>
      <button class={b()} title='Match history' onClick={() => navigate('history', { puuid: props.f.puuid })}><FiClock size={14} /></button>
      <button class={b()} title='Add note' onClick={() => navigate('memo', { puuid: props.f.puuid, name: `${props.f.gameName}#${props.f.tagLine}` })}><FiEdit3 size={14} /></button>
    </div>)
  
}

function FriendRow(props) {
  
    const s = () => (props.f.status)
    const val = () => (props.f.product === 'valorant')
    return (<Item index={props.index}>
      <ListRow selected={props.chatOpen} layoutId='squad-friend' onClick={() => props.onChat(props.f)} dim={!props.f.online}>
        <div class='relative shrink-0'>
          <PlayerCard id={s().card} name={props.f.gameName} size={38} />
          {props.f.online && <StatusDot state={s().state} class='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
        </div>
        <div class='relative min-w-0 flex-1'>
          <div class='flex items-baseline gap-1 truncate'>
            <span class='text-[13.5px] font-semibold tracking-tight text-text truncate'>{props.f.gameName}</span>
            <span class='text-[11px] text-muted'>#{props.f.tagLine}</span>
            {props.f.spectre && <span class='self-center ml-1 w-1.5 h-1.5 rounded-full bg-accent shadow-[0_0_8px_rgb(var(--accent))]' title='Uses Spectre' />}
          </div>
          <div class='text-[11.5px] text-muted truncate mt-0.5'>{props.f.note ? <span class='text-accent/90'>{props.f.note} · </span> : null}{statusLine(props.f)}</div>
        </div>
        <div class='relative flex items-center gap-2 shrink-0 group-hover:opacity-0 transition-opacity'>
          {val() && s().partySize > 1 && <span class='text-[10.5px] font-semibold text-muted tabular-nums inline-flex items-center gap-1'><FiUsers size={11} />{s().partySize}</span>}
          {val() && <RankIcon tier={s().rank} size={26} />}
        </div>
        <div class='absolute right-1.5 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity bg-panel border border-line shadow-lg rounded-full px-0.5'>
          <FriendActions f={props.f} canInvite={props.canInvite} onInvite={props.onInvite} />
        </div>
      </ListRow>
    </Item>)
  
}

function Group(props) {
  const [, rest] = splitProps(props, ["title","items","chatPuuid","offset"])
  
    
    return (<Show when={!(!props.items.length)} fallback={null}><>
      <ListLabel count={props.items.length}>{props.title}</ListLabel>
      <Stagger class='cv-list flex flex-col gap-0.5'>
        <For each={props.items}>{(f, i) => <FriendRow f={f} index={(props.offset ?? 0) + i()} chatOpen={props.chatPuuid === f.puuid} {...rest} />}</For>
      </Stagger>
    </></Show>)
  
}

function PartyPanel(props) {
  const [busyS, setBusy] = createSignal(false)
  
    const act = async (p, ok) => { setBusy(true); await withToast(p, ok); setBusy(false); props.reload(true) }
    
    
    
    const queued = () => (props.party.state === 'MATCHMAKING')
    const slots = () => (Math.max(5, props.party.members.length))
    return (<Show when={!(props.loading && !props.party)} fallback={<Skeleton class='h-[260px] rounded-3xl' />}><Show when={!(props.error && !props.party)} fallback={<Card class='p-6 rounded-3xl'><Empty icon={FiUsers} title='Party unavailable' hint='Open VALORANT to use parties.' class='!py-8' /></Card>}><Show when={!(!props.party)} fallback={<Card class='p-6 rounded-3xl'><Empty icon={FiUsers} title='No party' hint='Start VALORANT to get a party.' class='!py-8' /></Card>}><Card class='relative overflow-hidden p-6 rounded-3xl'>
      <span class='halo -top-32 -left-24 w-96 h-96 opacity-70' />
      <div class='relative flex items-start justify-between gap-4 mb-6'>
        <div>
          <div class='eyebrow mb-2'>Your party</div>
          <div class='flex items-baseline gap-3'>
            <span class='display text-[30px]'>{queued() ? 'In queue' : 'Lobby'}</span>
            {props.party.queueId && <span class='text-[13px] text-muted'>{queueName(props.party.queueId)}</span>}
          </div>
        </div>
        <div class='flex items-center gap-2'>
          <Badge tone={queued() ? 'warn' : 'neutral'}>{props.party.members.length}/5</Badge>
          {props.party.open && <Badge tone='good'>Open</Badge>}
        </div>
      </div>
      <Stagger class='relative grid grid-cols-5 gap-3'>
        <For each={props.party.members}>{(mem, i) => (
            <Item index={i()} class={cx('group relative rounded-2xl h-[148px] px-3 pt-4 pb-3 flex flex-col items-center text-center', mem.self ? 'accent-soft' : 'glass')}>
              <PlayerCard id={mem.card} name={mem.hidden ? null : mem.gameName} size={46} />
              <div class='mt-2.5 w-full text-[12.5px] font-semibold tracking-tight text-text truncate'>{mem.hidden ? 'Hidden player' : mem.gameName || '...'}</div>
              <div class='text-[10.5px] text-muted truncate w-full'>{mem.owner ? 'Leader' : 'Member'}{mem.level != null && ` · Lv ${mem.level}`}</div>
              <div class='mt-auto'><RankIcon tier={mem.rank} size={24} /></div>
              {props.party.iOwn && !mem.self && (
                <button title='Kick' disabled={busyS()} onClick={() => act(invoke('social:partyRemove', mem.puuid), 'Removed from party')}
                  class='absolute top-2 right-2 w-7 h-7 rounded-full flex items-center justify-center text-muted opacity-0 group-hover:opacity-100 hover:text-bad hover:bg-bad/15 transition-[transform,opacity,background-color,border-color,color] duration-200'><FiUserX size={13} /></button>
              )}
            </Item>
        )}</For>
        <Index each={Array.from({ length: slots() - props.party.members.length })}>{(_, i) => (
            <Item index={props.party.members.length + i} class='glass-inset rounded-2xl h-[148px] flex flex-col items-center justify-center gap-2 text-muted'>
              <span class='w-10 h-10 rounded-full border border-dashed border-line flex items-center justify-center'><FiPlus size={14} /></span>
              <span class='text-[11px] font-medium'>Open slot</span>
            </Item>
        )}</Index>
      </Stagger>
      <div class='relative mt-6 pt-5 border-t border-line flex items-center justify-between gap-6'>
        <div class='w-60'>
          <Toggle checked={props.party.open} disabled={!props.party.iOwn || busyS()} label='Open party' hint={props.party.iOwn ? 'Friends can join freely' : 'Only the leader can change this'}
            onChange={v => act(invoke('social:partyAccess', v), v ? 'Party opened' : 'Party closed')} />
        </div>
        {props.party.members.length > 1 && <Button variant='danger' size='sm' icon={FiLogOut} disabled={busyS()} onClick={() => act(invoke('social:partyRemove', props.party.members.find(m => m.self).puuid), 'Left party')}>Leave party</Button>}
      </div>
    </Card></Show></Show></Show>)
  
}

function Requests(props) {
  const [busyS, setBusy] = createSignal('')
  
    const empty = () => (!props.data || (!props.data.incoming.length && !props.data.outgoing.length))
    const run = async (key, channel, puuid, ok) => { setBusy(key); await withToast(invoke(channel, puuid), ok); setBusy(''); props.reload(true) }
    const Row = (props) => (
    <div class='flex items-center gap-2 rounded-xl px-2.5 py-2 -mx-1 hover:bg-surface-2/70 transition-colors'>
      <div class='min-w-0 flex-1 text-[13px] font-medium text-text truncate'>{props.r.gameName}<span class='text-[11px] text-muted'> #{props.r.tagLine}</span></div>
      {props.children}
    </div>
  )
    return (<Card class='p-5 rounded-3xl h-full'>
      <Heading hint={empty() ? 'Nothing pending' : `${props.data.incoming.length} incoming · ${props.data.outgoing.length} sent`}>Requests</Heading>
      {!empty() && (
        <div class='max-h-60 overflow-y-auto -mr-2 pr-2'>
          <For each={props.data.incoming}>{r => (
            <Row r={r}>
              <Button size='icon' variant='glow' class='!w-8 !h-8' title='Accept' loading={busyS() === 'a' + r.puuid} onClick={() => run('a' + r.puuid, 'social:acceptRequest', r.puuid, 'Friend added')}><FiCheck /></Button>
              <Button size='icon' variant='ghost' class='!w-8 !h-8' title='Decline' loading={busyS() === 'd' + r.puuid} onClick={() => run('d' + r.puuid, 'social:declineRequest', r.puuid, 'Declined')}><FiX /></Button>
            </Row>
          )}</For>
          <For each={props.data.outgoing}>{r => (
            <Row r={r}>
              <Badge>Sent</Badge>
              <Button size='icon' variant='ghost' class='!w-8 !h-8' title='Cancel' loading={busyS() === 'c' + r.puuid} onClick={() => run('c' + r.puuid, 'social:cancelRequest', r.puuid, 'Request cancelled')}><FiX /></Button>
            </Row>
          )}</For>
        </div>
      )}
    </Card>)
  
}

function AddFriend(props) {
  const [idS, setId] = createSignal('')
  const [busyS, setBusy] = createSignal(false)
  
    const submit = async e => {
    e.preventDefault()
    const i = idS().lastIndexOf('#')
    if (i < 1 || i === idS().length - 1) return withToast(Promise.reject(new Error('Use the format Name#Tag')))
    setBusy(true)
    const ok = await withToast(invoke('social:addFriend', idS().slice(0, i).trim(), idS().slice(i + 1).trim()), 'Friend request sent')
    setBusy(false)
    if (ok) { setId(''); props.onDone() }
  }
    return (<Card class='p-5 rounded-3xl h-full'>
      <Heading hint='Send a request by Riot ID'>Add a friend</Heading>
      <form onSubmit={submit} class='flex gap-2'>
        <Input value={idS()} onInput={e => setId(e.target.value)} placeholder='Name#Tag' class='!rounded-full' />
        <Button type='submit' variant='primary' icon={FiUserPlus} loading={busyS()} disabled={!idS().includes('#')}>Add</Button>
      </form>
    </Card>)
  
}

function FriendsBody(props) {
  const friends = useInvoke('social:friends', [], { poll: () => poll(), key: 'puuid' })
  const party = useInvoke('social:party', [], { poll: () => poll(), key: 'puuid' })
  const requests = useInvoke('social:requests', [], { poll: () => poll() })
  const convs = useInvoke('chat:conversations', [], { poll: () => (props.active ? 4000 : undefined), key: 'cid' })
  const [qS, setQ] = createSignal('')
  const [chatS, setChat] = createSignal(null)
  
    const poll = () => (props.active ? 5000 : undefined)
    const byPuuid = createMemo(() => Object.fromEntries((friends.data || []).map(f => [f.puuid, f])))
    const openChat = (cid, puuid) => setChat({ cid, puuid })
    const chatWith = f => {
    const cid = convs.data?.find(c => c.puuid === f.puuid)?.cid || f.pid
    if (!cid) return withToast(Promise.reject(new Error("Can't message this friend right now")))
    openChat(cid, f.puuid)
  }
    const groups = createMemo(() => {
    const needle = qS().trim().toLowerCase()
    const list = (friends.data || []).filter(f => !needle || `${f.gameName}#${f.tagLine}`.toLowerCase().includes(needle) || f.note?.toLowerCase().includes(needle))
    const rank = f => ({ ingame: 0, pregame: 1, queue: 2, menus: 3, away: 4 }[f.status.state] ?? 5)
    const sorted = [...list].sort((a, b) => rank(a) - rank(b) || a.gameName.localeCompare(b.gameName))
    return {
      valorant: sorted.filter(f => f.online && f.product === 'valorant'),
      elsewhere: sorted.filter(f => f.online && f.product !== 'valorant'),
      offline: sorted.filter(f => !f.online).sort((a, b) => (b.lastOnline || 0) - (a.lastOnline || 0)),
    }
  })
    const canInvite = () => (!!party.data)
    const invite = f => withToast(invoke('social:invite', f.gameName, f.tagLine), `Invited ${f.gameName}`)
    const online = () => (groups().valorant.length + groups().elsewhere.length)
    const onlineTotal = () => ((friends.data || []).filter(f => f.online).length)
    const pending = () => (requests.data?.incoming?.length || 0)
    const chatFriend = () => (chatS() && byPuuid()[chatS().puuid])
    const shared = () => ({ canInvite: canInvite(), onInvite: invite, onChat: chatWith, chatPuuid: chatS()?.puuid })
    const list = (
    (<Pane title='Friends' right={friends.data && <span class='text-[11px] font-semibold text-muted tabular-nums'><span class='text-good'>{onlineTotal()}</span> / {friends.data.length}</span>}
      header={<SearchField value={qS()} onChange={setQ} placeholder='Search friends or notes' />}>
      {friends.loading && !friends.data ? (
        <div class='flex flex-col gap-1.5 p-1'>{Array.from({ length: 8 }, (_, i) => <Skeleton class='h-[54px] rounded-2xl' />)}</div>
      ) : friends.error && !friends.data ? <ErrorState error={friends.error} onRetry={friends.reload} />
        : !friends.data?.length ? <Empty icon={FiUsers} title='No friends yet' hint='Add a friend by Riot ID.' />
          : !(online() || groups().offline.length) ? <Empty icon={FiSearch} title='No matches' hint='Try a different name or note.' />
            : <>
              {!qS() && <Conversations convs={convs.data} friends={byPuuid()} selected={chatS()?.cid} onOpen={openChat} />}
              <Group title='In VALORANT' items={groups().valorant} {...shared()} />
              <Group title='Elsewhere' items={groups().elsewhere} offset={groups().valorant.length} {...shared()} />
              <Group title='Offline' items={groups().offline} offset={online()} {...shared()} />
            </>}
    </Pane>)
  )
    return (<Page title='Friends' subtitle={friends.data ? `${onlineTotal()} online of ${friends.data.length}${pending() ? ` · ${pending()} new ${pending() === 1 ? 'request' : 'requests'}` : ''}` : 'Your Riot friends and party'}
      bodyClass={SPLIT_BODY}>
      <SplitView list={list}>
        {chatS() ? (
          // keyed by conversation: each chat gets its own messages, draft and send state
          <Show when={chatS()?.cid} keyed>{cid => (
            <ChatPanel cid={cid} friend={chatFriend()} statusLine={statusLine} active={props.active}
              actions={chatFriend() && <FriendActions f={chatFriend()} canInvite={canInvite()} onInvite={invite} />}
              onClose={() => setChat(null)} onSent={() => convs.reload(true)} />
          )}</Show>
        ) : (
          <FadeIn class='flex flex-col gap-5'>
            <PartyPanel party={party.data} loading={party.loading} error={party.error} reload={party.reload} />
            <div class='grid grid-cols-1 xl:grid-cols-2 gap-5'>
              <AddFriend onDone={requests.reload} />
              <Requests data={requests.data} reload={requests.reload} />
            </div>
          </FadeIn>
        )}
      </SplitView>
    </Page>)
  
}

export default function Friends(props) {
  const riotA = useRiot()
  return (
    <RequireRiot>
      <Show when={riotA().connected}><FriendsBody active={props.active} /></Show>
    </RequireRiot>
  )
}
