import React, { useState } from 'react'
import { FiCheck, FiKey, FiLock, FiPlay, FiSquare, FiUnlock, FiUserPlus, FiUsers } from 'react-icons/fi'
import { FaCrown } from 'react-icons/fa'
import { Badge, Button, Card, Empty, Input, Skeleton, toast, withToast } from '../../ui'
import { invoke, useInvoke } from '../../lib/ipc'
import { ModeIcon, PlayerCard, RankIcon } from './parts'
import { queueName } from './util'

const cx = (...c) => c.filter(Boolean).join(' ')
const label = 'text-[12px] font-semibold text-muted mb-1.5'

// Your party and lobby controls: members, invites, invite codes, mode, matchmaking and party access.
// `matchState` is the live match state: while in agent select or a match only inviting stays available.
export default function Lobby({ active, matchState }) {
  const party = useInvoke('social:party', [], { poll: active ? 4000 : undefined })
  const [invite, setInvite] = useState('')
  const [code, setCode] = useState('')
  const [working, setWorking] = useState(null)
  const p = party.data
  const locked = matchState && matchState !== 'menus'
  const searching = p?.state === 'MATCHMAKING'

  const act = async (key, fn, ok) => {
    setWorking(key)
    const r = await withToast(fn(), ok)
    setWorking(null)
    party.reload(true)
    return r
  }
  const sendInvite = () => {
    const i = invite.lastIndexOf('#')
    if (i < 1) { toast.error('Enter a Riot ID like Name#Tag'); return }
    act('invite', () => invoke('social:invite', invite.slice(0, i).trim(), invite.slice(i + 1).trim()), `Invited ${invite}`).then(r => r && setInvite(''))
  }
  const join = () => act('join', () => invoke('social:joinCode', code), 'Joined party').then(r => r && setCode(''))

  if (party.loading && !p) return <div className='grid gap-5 xl:grid-cols-2'><Skeleton className='h-64 rounded-xl' /><Skeleton className='h-64 rounded-xl' /></div>
  if (!p) return <Card className='p-8'><Empty icon={FiUsers} title='No party found' hint='Open VALORANT to see your party and lobby controls here.' /></Card>

  const ready = p.members.filter(m => m.ready).length
  const ownerOnly = !p.iOwn ? 'Only the party leader can change this' : undefined
  return (
    <div className='anim-fade flex flex-col gap-5'>
      {locked && <Card className='px-4 py-3 text-[13px] text-muted'>Your match is in progress. Matchmaking, mode and access are locked; you can still invite friends.</Card>}
      <div className='grid gap-5 xl:grid-cols-2 items-start'>
        <Card className='p-5'>
          <div className='flex items-start justify-between gap-3 mb-4'>
            <div>
              <div className='flex items-center gap-2 font-display text-lg font-bold'><FiUsers /> Your party</div>
              <div className='text-[12px] text-muted'>{p.members.length} of 5 players · {ready}/{p.members.length} ready</div>
            </div>
            <Button size='sm' icon={FiUserPlus} onClick={() => document.getElementById('lobby-invite')?.focus()}>Invite a friend</Button>
          </div>
          <div className='grid gap-2'>
            {p.members.map((m, i) => (
              <div key={m.puuid} style={{ '--i': i }} className='anim-rise flex items-center gap-3 rounded-xl border border-line bg-surface-2/40 px-3 py-2.5'>
                <PlayerCard id={m.hidden ? null : m.card} name={m.hidden ? null : m.gameName} size={38} />
                <div className='min-w-0 flex-1'>
                  <div className='flex items-center gap-1.5 min-w-0'>
                    <span className='text-[13px] font-bold truncate'>{m.hidden ? 'Hidden player' : m.gameName || '...'}</span>
                    {!m.hidden && m.tagLine && <span className='text-[11px] text-muted shrink-0'>#{m.tagLine}</span>}
                    {m.owner && <FaCrown className='text-warn shrink-0' size={11} title='Party leader' />}
                    {m.self && <Badge tone='accent'>You</Badge>}
                  </div>
                  <div className='flex items-center gap-1.5 text-[11px] text-muted mt-0.5'>
                    <RankIcon tier={m.rank} size={16} />{m.level != null && <span>Lv {m.level}</span>}
                  </div>
                </div>
                {m.self && !locked
                  ? <Button size='sm' variant={m.ready ? 'primary' : 'subtle'} icon={FiCheck} loading={working === 'ready'}
                    onClick={() => act('ready', () => invoke('social:ready', !m.ready))}>{m.ready ? 'Ready' : 'Standby'}</Button>
                  : <Badge tone={m.ready ? 'good' : 'neutral'}>{m.ready ? 'Ready' : 'Standby'}</Badge>}
              </div>
            ))}
          </div>
          <div className='grid sm:grid-cols-2 gap-4 mt-5'>
            <form onSubmit={e => { e.preventDefault(); sendInvite() }}>
              <div className={label}>Invite by Riot ID</div>
              <div className='flex gap-2'>
                <Input id='lobby-invite' value={invite} onChange={e => setInvite(e.target.value)} placeholder='Name#Tag' />
                <Button type='submit' icon={FiUserPlus} loading={working === 'invite'} disabled={!invite.trim()} title='Send invite' />
              </div>
            </form>
            <form onSubmit={e => { e.preventDefault(); join() }}>
              <div className={label}>Join with invite code</div>
              <div className='flex gap-2'>
                <Input value={code} onChange={e => setCode(e.target.value)} placeholder='Enter invite code' disabled={locked} />
                <Button type='submit' icon={FiKey} loading={working === 'join'} disabled={locked || !code.trim()} title='Join party' />
              </div>
            </form>
          </div>
        </Card>

        <Card className='p-5'>
          <div className='font-display text-lg font-bold'>Choose a mode</div>
          <div className='text-[12px] text-muted mb-4'>{p.queueId ? `${queueName(p.queueId)} selected` : 'No mode selected'}</div>
          <div className='grid grid-cols-2 md:grid-cols-3 gap-2'>
            {p.queues.map(q => (
              <button key={q} disabled={locked || searching || !p.iOwn || working === 'queue'} title={ownerOnly}
                onClick={() => act('queue', () => invoke('social:queue', q))}
                className={cx('flex items-center justify-between h-11 px-3 rounded-lg border text-[13px] font-semibold transition-colors disabled:opacity-60 disabled:cursor-not-allowed',
                  p.queueId === q ? 'border-accent/60 bg-accent/10 text-text' : 'border-line bg-surface-2/40 text-muted hover:text-text hover:border-accent/30')}>
                <span className='flex items-center gap-2 min-w-0'><ModeIcon queue={q} size={16} /><span className='truncate'>{queueName(q)}</span></span>
                {p.queueId === q && <FiCheck className='text-accent shrink-0' />}
              </button>
            ))}
          </div>
          <Button variant={searching ? 'subtle' : 'primary'} size='lg' className='w-full mt-4' icon={searching ? FiSquare : FiPlay}
            loading={working === 'mm'} disabled={locked || !p.iOwn} title={ownerOnly}
            onClick={() => act('mm', () => invoke('social:matchmaking', !searching), searching ? 'Search cancelled' : 'Searching for a match')}>
            {searching ? 'Cancel search' : 'Find match'}
          </Button>

          <div className='mt-6'>
            <div className={cx(label, 'flex items-center gap-1.5')}><FiLock /> Party access</div>
            <div className='grid grid-cols-2 gap-2'>
              {[[true, 'Open party', FiUnlock], [false, 'Closed party', FiLock]].map(([open, text, Icon]) => (
                <button key={text} disabled={locked || !p.iOwn || p.open === open} title={ownerOnly}
                  onClick={() => act('access', () => invoke('social:partyAccess', open))}
                  className={cx('h-10 rounded-lg border text-[13px] font-semibold flex items-center justify-center gap-2 transition-colors disabled:cursor-not-allowed',
                    p.open === open ? 'border-accent/50 bg-accent/10 text-text' : 'border-line text-muted hover:text-text disabled:opacity-60')}>
                  <Icon /> {text}
                </button>
              ))}
            </div>
          </div>

          <div className='mt-6'>
            <div className={cx(label, 'flex items-center gap-1.5')}><FiKey /> Invite code</div>
            <div className='flex items-center justify-between gap-3 rounded-lg border border-line px-3 h-11'>
              {p.inviteCode
                ? <button className='font-display text-lg font-bold tracking-widest hover:text-accent' title='Copy code'
                  onClick={() => navigator.clipboard.writeText(p.inviteCode).then(() => toast('Invite code copied'))}>{p.inviteCode}</button>
                : <span className='text-[13px] text-muted'>No active invite code.</span>}
              <Button size='sm' variant='ghost' loading={working === 'code'} disabled={!p.iOwn} title={ownerOnly}
                onClick={() => act('code', () => invoke('social:inviteCode', !p.inviteCode))}>{p.inviteCode ? 'Disable' : 'Generate'}</Button>
            </div>
          </div>
        </Card>
      </div>
    </div>
  )
}
