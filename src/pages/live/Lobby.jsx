import { For, Index, createEffect, createSignal, on, onCleanup, Show } from 'solid-js'
import { FiCheck, FiKey, FiLock, FiPlay, FiSquare, FiUnlock, FiUserPlus, FiUsers } from 'solid-icons/fi'
import { FaSolidCrown as FaCrown } from 'solid-icons/fa'
import { Badge, Button, Card, Empty, FadeIn, Input, Item, Pill, Skeleton, Stagger, toast, withToast } from '../../ui'
import { invoke, useInvoke } from '../../lib/ipc'
import { ModeIcon, PlayerCard, RankIcon } from './parts'
import { queueName } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')
const label = 'eyebrow mb-2.5'

// your party and lobby controls: members, invites, invite codes, mode, matchmaking and party access
export default function Lobby(props) {
  const party = useInvoke('social:party', [], { poll: () => (props.active ? 4000 : undefined) })
  const [inviteS, setInvite] = createSignal('')
  const [codeS, setCode] = createSignal('')
  const [workingS, setWorking] = createSignal(null)
  const [askedS, setAsked] = createSignal(null)
  createEffect(on(() => [askedS(), inQueue()], () => { if (askedS() != null && inQueue() === askedS()) setAsked(null) }))
  createEffect(on(() => [askedS()], () => {
    if (askedS() == null) return
    const t = setTimeout(() => setAsked(null), 15000)
    { onCleanup(() => clearTimeout(t)); return }
  }))
  
    const p = () => (party.data)
    const locked = () => (props.matchState && props.matchState !== 'menus')
    const inQueue = () => (p()?.state === 'MATCHMAKING')
    const searching = () => (askedS() ?? inQueue())
    const act = async (key, fn, ok) => {
    setWorking(key)
    // A request that never comes back must not leave the button spinning forever
    const late = new Promise((_, no) => setTimeout(() => no(new Error("Riot didn't answer. Try again.")), 15000))
    const r = await withToast(Promise.race([fn(), late]), ok)
    setWorking(null)
    party.reload(true)
    return r
  }
    const sendInvite = () => {
    const i = inviteS().lastIndexOf('#')
    if (i < 1) { toast.error('Enter a Riot ID like Name#Tag'); return }
    act('invite', () => invoke('social:invite', inviteS().slice(0, i).trim(), inviteS().slice(i + 1).trim()), `Invited ${inviteS()}`).then(r => r && setInvite(''))
  }
    const join = () => act('join', () => invoke('social:joinCode', codeS()), 'Joined party').then(r => r && setCode(''))
    
    
    const ready = () => (p().members.filter(m => m.ready).length)
    const ownerOnly = () => (!p().iOwn ? 'Only the party leader can change this' : undefined)
    const open = () => (Math.max(0, 5 - p().members.length))
    const focusInvite = () => document.getElementById('lobby-invite')?.focus()
    return (<Show when={!(party.loading && !p())} fallback={<div class='grid gap-5 xl:grid-cols-[1.25fr_1fr]'><Skeleton class='h-[420px] rounded-3xl' /><Skeleton class='h-[420px] rounded-3xl' /></div>}><Show when={!(!p())} fallback={<Card class='p-10 rounded-3xl'><Empty icon={FiUsers} title='No party found' hint='Open VALORANT to see your party and lobby controls here.' /></Card>}><div class='flex flex-col gap-5'>
      {party.error && (
        <FadeIn class='glass rounded-2xl px-5 py-3.5 flex items-center gap-3 text-[13px] text-muted !border-bad/30'>
          <FiLock class='text-bad shrink-0' /> Spectre can't read your party right now, so this may be out of date. If it stays like this, restart VALORANT.
        </FadeIn>
      )}
      {locked() && (
        <FadeIn class='glass rounded-2xl px-5 py-3.5 flex items-center gap-3 text-[13px] text-muted !border-warn/30'>
          <FiLock class='text-warn shrink-0' /> Your match is in progress. Matchmaking, mode and access are locked; you can still invite friends.
        </FadeIn>
      )}
      <Stagger class='grid gap-5 xl:grid-cols-[1.25fr_1fr] items-start' step={0.06}>
        <Item index={0} class='glass relative overflow-hidden rounded-3xl p-7'>
          <span class='halo -left-24 -top-28 w-80 h-80 opacity-60' />
          <div class='relative flex items-end justify-between gap-3 mb-6'>
            <div>
              <div class='eyebrow mb-2'>Party</div>
              <div class='display text-[30px] text-text'>{p().members.length}<span class='text-muted'>/5</span> <span class='text-[18px] tracking-tight text-muted font-semibold'>players</span></div>
              <div class='mt-2 flex items-center gap-2 text-[12px] text-muted tabular-nums'>
                <span class={cx('w-1.5 h-1.5 rounded-full', ready() === p().members.length ? 'bg-good shadow-[0_0_8px_rgb(var(--good))]' : 'bg-warn')} />{ready()} of {p().members.length} ready
              </div>
            </div>
            <Button size='sm' variant='glow' icon={FiUserPlus} onClick={focusInvite}>Invite</Button>
          </div>

          <div class='relative grid gap-2'>
            <For each={p().members}>{m => (
              <div class={cx('min-w-0 flex items-center gap-3.5 rounded-2xl px-3.5 py-3 transition-colors', m.self ? 'accent-soft' : 'glass-inset')}>
                <PlayerCard id={m.hidden ? null : m.card} name={m.hidden ? null : m.gameName} size={42} class='!rounded-xl' />
                <div class='min-w-0 flex-1'>
                  <div class='flex items-center gap-1.5 min-w-0'>
                    <span class='text-[14px] font-semibold tracking-tight text-text truncate'>{m.hidden ? 'Hidden player' : m.gameName || '...'}</span>
                    {!m.hidden && m.tagLine && <span class='text-[11px] text-muted shrink-0'>#{m.tagLine}</span>}
                    {m.owner && <FaCrown class='text-warn shrink-0' size={11} title='Party leader' />}
                    {m.self && <Badge tone='accent'>You</Badge>}
                  </div>
                  <div class='flex items-center gap-1.5 text-[11px] text-muted mt-1 tabular-nums'>
                    <RankIcon tier={m.rank} size={16} />{m.level != null && <span>Lv {m.level}</span>}
                  </div>
                </div>
                {m.self && !locked()
                  ? <Button size='sm' variant={m.ready ? 'primary' : 'subtle'} icon={FiCheck} loading={workingS() === 'ready'}
                    onClick={() => act('ready', () => invoke('social:ready', !m.ready))}>{m.ready ? 'Ready' : 'Standby'}</Button>
                  : <Badge tone={m.ready ? 'good' : 'neutral'}>{m.ready ? 'Ready' : 'Standby'}</Badge>}
              </div>
            )}</For>
            <Index each={Array.from({ length: open() })}>{() => (
              <button onClick={focusInvite}
                class='h-[52px] rounded-2xl border border-dashed border-line flex items-center justify-center gap-2 text-[12px] font-semibold text-muted hover:text-text hover:border-accent/40 transition-colors'>
                <FiUserPlus /> Open slot
              </button>
            )}</Index>
          </div>

          <div class='hairline my-6' />
          <div class='relative grid sm:grid-cols-2 gap-4'>
            <form onSubmit={e => { e.preventDefault(); sendInvite() }}>
              <div class={label}>Invite by Riot ID</div>
              <div class='flex gap-2'>
                <Input id='lobby-invite' value={inviteS()} onInput={e => setInvite(e.target.value)} placeholder='Name#Tag' />
                <Button type='submit' size='icon' icon={FiUserPlus} loading={workingS() === 'invite'} disabled={!inviteS().trim()} title='Send invite' class='!h-10 !w-10 shrink-0' />
              </div>
            </form>
            <form onSubmit={e => { e.preventDefault(); join() }}>
              <div class={label}>Join with invite code</div>
              <div class='flex gap-2'>
                <Input value={codeS()} onInput={e => setCode(e.target.value)} placeholder='Enter invite code' disabled={locked()} />
                <Button type='submit' size='icon' icon={FiKey} loading={workingS() === 'join'} disabled={locked() || !codeS().trim()} title='Join party' class='!h-10 !w-10 shrink-0' />
              </div>
            </form>
          </div>
        </Item>

        <Item index={1} class='glass rounded-3xl p-7'>
          <div class='eyebrow mb-2'>Mode</div>
          <div class='flex items-center gap-2.5'>
            <ModeIcon queue={p().queueId} size={22} class='text-accent' />
            <span class='display text-[30px] text-text'>{p().queueId ? queueName(p().queueId) : 'No mode'}</span>
          </div>
          {p().queueOk === false && <p class='mt-3 text-[12px] leading-snug text-warn'>Riot has {queueName(p().queueId)} turned off right now. Pick another mode to queue.</p>}
          <div class='grid grid-cols-2 md:grid-cols-3 gap-2 mt-6'>
            <For each={p().queues}>{q => (
              <button disabled={locked() || searching() || !p().iOwn || workingS() === 'queue'} title={ownerOnly()}
                onClick={() => act('queue', () => invoke('social:queue', q))}
                class={cx('relative flex items-center gap-2 h-11 px-3.5 rounded-xl text-[12.5px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                  p().queueId === q ? 'accent-soft text-text' : 'glass-inset text-muted hover:text-text hover:border-accent/30')}>
                <ModeIcon queue={q} size={15} class={p().queueId === q ? 'text-accent' : undefined} /><span class='truncate'>{queueName(q)}</span>
              </button>
            )}</For>
          </div>
          <Button variant={searching() ? 'subtle' : 'primary'} size='lg' class='w-full mt-5 !h-12 text-[14px]' icon={searching() ? FiSquare : FiPlay}
            loading={workingS() === 'mm'} disabled={locked() || !p().iOwn || (!searching() && p().queueOk === false)} title={ownerOnly()}
            onClick={() => { const want = !searching(); act('mm', () => invoke('social:matchmaking', want).then(r => { setAsked(want); return r }), want ? 'Searching for a match' : 'Search cancelled') }}>
            {searching() ? 'Cancel search' : 'Find match'}
          </Button>

          <div class='hairline my-6' />
          <div class={cx(label, 'flex items-center gap-1.5')}><FiLock /> Party access</div>
          <div class='glass-inset grid grid-cols-2 gap-1 p-1 rounded-full'>
            <For each={[[true, 'Open', FiUnlock], [false, 'Closed', FiLock]]}>{([isOpen, text, Icon]) => (
              <button disabled={locked() || !p().iOwn || p().open === isOpen} title={ownerOnly()}
                onClick={() => act('access', () => invoke('social:partyAccess', isOpen))}
                class={cx('relative h-9 rounded-full text-[12.5px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed',
                  p().open === isOpen ? 'text-text' : 'text-muted hover:text-text disabled:opacity-60')}>
                {p().open === isOpen && <Pill layoutId='lobby-access' />}
                <Icon class='relative' /> <span class='relative'>{text} party</span>
              </button>
            )}</For>
          </div>

          <div class={cx(label, 'flex items-center gap-1.5 mt-6')}><FiKey /> Invite code</div>
          <div class='glass-field flex items-center justify-between gap-3 rounded-full pl-5 pr-1.5 h-12'>
            {p().inviteCode
              ? <button class='font-display text-lg font-bold tracking-[0.22em] tabular-nums text-text hover:text-accent transition-colors' title='Copy code'
                onClick={() => navigator.clipboard.writeText(p().inviteCode).then(() => toast('Invite code copied'))}>{p().inviteCode}</button>
              : <span class='text-[13px] text-muted'>No active invite code.</span>}
            <Button size='sm' variant='ghost' loading={workingS() === 'code'} disabled={!p().iOwn} title={ownerOnly()}
              onClick={() => act('code', () => invoke('social:inviteCode', !p().inviteCode))}>{p().inviteCode ? 'Disable' : 'Generate'}</Button>
          </div>
        </Item>
      </Stagger>
    </div></Show></Show>)
  
}
