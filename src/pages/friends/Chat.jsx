import React, { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { FiMessageSquare, FiSend, FiX } from 'react-icons/fi'
import { Badge, Card, SectionTitle, Button, Input, Skeleton, Empty, toast } from '../../ui'
import { invoke, useInvoke } from '../../lib/ipc'
import { PlayerCard, StatusDot } from '../live/parts'

const cx = (...c) => c.filter(Boolean).join(' ')

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
    <section className='mb-7'>
      <SectionTitle right={<span className='text-[11px] text-muted tabular-nums'>{convs.length}</span>}>Recent conversations</SectionTitle>
      <div className='grid gap-2 stagger'>
        {convs.map((c, i) => {
          const f = friends[c.puuid]
          const name = f?.gameName || c.last?.gameName || 'Unknown'
          return (
            <button key={c.cid} onClick={() => onOpen(c.cid, c.puuid)} style={{ '--i': i }}
              className={cx('anim-rise flex items-center gap-3.5 rounded-xl border px-3.5 py-2.5 text-left transition-all duration-200',
                selected === c.cid ? 'accent-soft border-transparent' : 'glass hover:border-accent/40 hover:bg-surface-2')}>
              <div className='relative'>
                <PlayerCard id={f?.status?.card} name={name} size={36} />
                {f?.online && <StatusDot state={f.status.state} className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
              </div>
              <div className='min-w-0 flex-1'>
                <div className='flex items-center justify-between gap-2'>
                  <span className='text-[13px] font-semibold tracking-tight text-text truncate'>{name}</span>
                  <span className='text-[11px] text-muted shrink-0 tabular-nums'>{timeLabel(c.last?.time, true)}</span>
                </div>
                <div className='flex items-center justify-between gap-2 mt-0.5'>
                  <span className={cx('text-[12px] truncate', c.unread ? 'text-text' : 'text-muted')}>{c.last ? (c.last.fromMe ? 'You: ' : '') + c.last.body : 'No messages yet'}</span>
                  {c.unread > 0 && <span className='anim-pop shrink-0 min-w-[18px] h-[18px] px-1 rounded-full accent-fill text-bg text-[10px] font-bold tabular-nums flex items-center justify-center'>{c.unread}</span>}
                </div>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

// Message thread with one friend. Polls while open; sends with Enter.
export function ChatPanel({ cid, friend, statusLine, active, onClose, onSent }) {
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
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: list.length > 1 ? 'smooth' : 'auto' })
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
  return (
    <Card className='anim-rise flex flex-col overflow-hidden h-[calc(100vh-190px)] min-h-[420px]'>
      <div className='flex items-center gap-3 px-5 py-4 border-b border-line'>
        <div className='relative'>
          <PlayerCard id={friend?.status?.card} name={name} size={38} />
          {friend?.online && <StatusDot state={friend.status.state} className='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
        </div>
        <div className='min-w-0 flex-1'>
          <div className='font-display text-[16px] font-bold tracking-tight text-text truncate'>{name}{friend?.tagLine && <span className='font-sans text-[11px] text-muted font-normal tracking-normal'> #{friend.tagLine}</span>}{friend?.spectre && <Badge tone='accent' className='!h-4 !px-1.5 !text-[9px] ml-1.5 align-middle'>Spectre</Badge>}</div>
          <div className='text-[12px] text-muted truncate mt-0.5'>{friend ? statusLine(friend) : ''}</div>
        </div>
        <Button variant='ghost' size='sm' className='!px-2' title='Close chat' onClick={onClose}><FiX /></Button>
      </div>

      <div ref={scroller} className='flex-1 overflow-y-auto px-5 py-5 flex flex-col gap-1.5'>
        {msgs.loading && !msgs.data ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className={cx('h-10 w-2/5 rounded-2xl', i % 2 && 'self-end')} />)
        ) : !list.length ? (
          <Empty icon={FiMessageSquare} title={`Say hi to ${name}`} hint='Messages go through your Riot chat, same as in-game.' />
        ) : list.map((m, i) => {
          const prev = list[i - 1]
          const gap = !prev || prev.fromMe !== m.fromMe || m.time - prev.time > 5 * 60000
          return (
            <div key={m.id} className={cx('anim-rise flex flex-col max-w-[78%]', m.fromMe ? 'self-end items-end' : 'self-start items-start', gap && i > 0 && 'mt-3')}>
              {gap && <span className='text-[11px] font-medium text-muted mb-1 px-1.5'>{m.fromMe ? 'You' : name} · {timeLabel(m.time)}</span>}
              <div className={cx('rounded-2xl px-4 py-2.5 text-[13px] leading-snug text-text whitespace-pre-wrap break-words select-text',
                m.fromMe ? 'accent-soft rounded-br-md' : 'glass rounded-bl-md',
                m.pending && 'opacity-60')}>
                {m.body}
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={send} className='flex items-center gap-2.5 px-4 py-3.5 border-t border-line'>
        <Input ref={input} value={text} onChange={e => setText(e.target.value)} placeholder={`Message ${name}`} maxLength={500} className='!h-10 !rounded-full !px-4' />
        <Button type='submit' variant='primary' className='!w-10 !h-10 !px-0 shrink-0' disabled={!text.trim()} loading={sending} title='Send'><FiSend /></Button>
      </form>
    </Card>
  )
}
