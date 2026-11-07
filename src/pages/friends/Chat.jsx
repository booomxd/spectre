import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FiMessageSquare, FiSend, FiX } from 'react-icons/fi'
import { Badge, Card, Button, Skeleton, Empty, toast, cx, Stagger, Item } from '../../ui'
import { invoke, useInvoke } from '../../lib/ipc'
import { prefersReducedMotion } from '../../lib/theme'
import { PlayerCard, StatusDot } from '../live/parts'
import { ListLabel, ListRow } from './Layout'

export function timeLabel(ms, short) {
  if (!ms) return ''
  const d = new Date(ms)
  const today = new Date()
  if (d.toDateString() === today.toDateString()) return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  const days = Math.floor((today - d) / 86400000)
  if (days < 7) return d.toLocaleDateString([], { weekday: short ? 'short' : 'long' })
  return d.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

// Recent DM conversations, newest first. `friends` maps puuid -> friend for names/cards/status.
export function Conversations({ convs, friends, selected, onOpen }) {
  if (!convs?.length) return null
  return (
    <>
      <ListLabel count={convs.length}>Recent chats</ListLabel>
      <Stagger className='flex flex-col gap-0.5'>
        {convs.map((c, i) => {
          const f = friends[c.puuid]
          const name = f?.gameName || c.last?.gameName || 'Unknown'
          return (
            <Item key={c.cid} index={i}>
              <ListRow as='button' selected={selected === c.cid} layoutId='squad-friend' onClick={() => onOpen(c.cid, c.puuid)}>
                <div className='relative shrink-0'>
                  <PlayerCard id={f?.status?.card} name={name} size={38} />
                  {f?.online && <StatusDot state={f.status.state} className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
                </div>
                <div className='relative min-w-0 flex-1'>
                  <div className='flex items-center justify-between gap-2'>
                    <span className='text-[13.5px] font-semibold tracking-tight text-text truncate'>{name}</span>
                    <span className='text-[10.5px] text-muted shrink-0 tabular-nums'>{timeLabel(c.last?.time, true)}</span>
                  </div>
                  <div className='flex items-center justify-between gap-2 mt-0.5'>
                    <span className={cx('text-[11.5px] truncate', c.unread ? 'text-text font-medium' : 'text-muted')}>{c.last ? (c.last.fromMe ? 'You: ' : '') + c.last.body : 'No messages yet'}</span>
                    {c.unread > 0 && <span className='anim-pop shrink-0 min-w-[18px] h-[18px] px-1 rounded-full accent-fill text-bg text-[10px] font-bold tabular-nums flex items-center justify-center'>{c.unread}</span>}
                  </div>
                </div>
              </ListRow>
            </Item>
          )
        })}
      </Stagger>
    </>
  )
}

// Message thread with one friend. Polls while open; sends with Enter. `actions` renders in the header.
export function ChatPanel({ cid, friend, statusLine, active, onClose, onSent, actions }) {
  const msgs = useInvoke('chat:messages', [cid], { poll: active ? 2500 : undefined, deps: [cid] })
  const [pending, setPending] = useState([])
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const scroller = useRef(null)
  const input = useRef(null)

  useEffect(() => { setPending([]); setText(''); input.current?.focus() }, [cid])

  // Drop optimistic messages once the real ones arrive.
  const list = [...(msgs.data || []), ...pending.filter(p => !(msgs.data || []).some(m => m.fromMe && m.body === p.body && m.time >= p.time - 5000))]

  useLayoutEffect(() => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: list.length > 1 && !prefersReducedMotion() ? 'smooth' : 'auto' })
  }, [list.length, cid])

  const send = async e => {
    e.preventDefault()
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    setPending(p => [...p, { id: 'pending-' + Date.now(), body, time: Date.now(), fromMe: true, pending: true }])
    try { await invoke('chat:send', cid, body); msgs.reload(true); onSent?.() }
    catch (err) { toast.error(err.message); setPending(p => p.filter(x => x.body !== body)); setText(body) }
    setSending(false)
    input.current?.focus()
  }

  const name = friend?.gameName || list.find(m => !m.fromMe)?.gameName || 'Chat'
  // Only the newest bubbles animate in; older history renders in place.
  const animFrom = Math.max(0, list.length - 6)
  return (
    <Card className='anim-fade flex flex-col overflow-hidden h-full min-h-[420px] rounded-3xl'>
      <div className='relative flex items-center gap-3.5 px-5 py-4 border-b border-line'>
        <span className='halo -top-24 -left-10 w-64 h-64 opacity-60' />
        <div className='relative shrink-0'>
          <PlayerCard id={friend?.status?.card} name={name} size={44} />
          {friend?.online && <StatusDot state={friend.status.state} className='absolute -bottom-0.5 -right-0.5 w-3 h-3' />}
        </div>
        <div className='relative min-w-0 flex-1'>
          <div className='flex items-center gap-2'>
            <span className='display text-[22px] truncate'>{name}</span>
            {friend?.tagLine && <span className='text-[12px] text-muted'>#{friend.tagLine}</span>}
            {friend?.spectre && <Badge tone='accent'>Spectre</Badge>}
          </div>
          <div className='text-[12px] text-muted truncate mt-1'>{friend ? statusLine(friend) : ''}</div>
        </div>
        {actions && <div className='relative'>{actions}</div>}
        <Button variant='ghost' size='icon' className='relative' title='Close chat' onClick={onClose}><FiX /></Button>
      </div>

      <div ref={scroller} className='flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1.5'>
        {msgs.loading && !msgs.data ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className={cx('h-10 w-2/5 rounded-2xl', i % 2 && 'self-end')} />)
        ) : !list.length ? (
          <Empty icon={FiMessageSquare} title={`Say hi to ${name}`} hint='Messages go through your Riot chat, same as in-game.' className='my-auto' />
        ) : list.map((m, i) => {
          const prev = list[i - 1]
          const gap = !prev || prev.fromMe !== m.fromMe || m.time - prev.time > 5 * 60000
          return (
            <div key={m.id} className={cx('flex flex-col max-w-[min(72%,640px)]', i >= animFrom && 'anim-rise', m.fromMe ? 'self-end items-end' : 'self-start items-start', gap && i > 0 && 'mt-3')}>
              {gap && <span className='text-[10.5px] font-medium text-muted mb-1 px-2'>{m.fromMe ? 'You' : name} · {timeLabel(m.time)}</span>}
              <div className={cx('rounded-[20px] px-4 py-2.5 text-[13px] leading-snug whitespace-pre-wrap break-words select-text',
                m.fromMe ? 'accent-fill text-bg rounded-br-md' : 'glass-inset text-text rounded-bl-md',
                m.pending && 'opacity-60')}>
                {m.body}
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={send} className='px-4 pb-4'>
        <div className='glass-field flex items-center gap-2 rounded-full pl-5 pr-1.5 h-12'>
          <input ref={input} value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${name}`} maxLength={500}
            className='flex-1 min-w-0 bg-transparent outline-none text-[13px] text-text placeholder:text-muted/60' />
          <Button type='submit' variant='primary' size='icon' className='shrink-0' disabled={!text.trim()} loading={sending} title='Send'><FiSend /></Button>
        </div>
      </form>
    </Card>
  )
}
