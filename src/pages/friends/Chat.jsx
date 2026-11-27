import { createEffect, createSignal, on, Show } from 'solid-js'
import { FiMessageSquare, FiSend, FiX } from 'solid-icons/fi'
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

// recent DM conversations, newest first
export function Conversations(props) {
  
    
    return (<Show when={!(!props.convs?.length)} fallback={null}><>
      <ListLabel count={props.convs.length}>Recent chats</ListLabel>
      <Stagger class='flex flex-col gap-0.5'>
        {props.convs.map((c, i) => {
          const f = props.friends[c.puuid]
          const name = f?.gameName || c.last?.gameName || 'Unknown'
          return (
            <Item index={i}>
              <ListRow as='button' selected={props.selected === c.cid} layoutId='squad-friend' onClick={() => props.onOpen(c.cid, c.puuid)}>
                <div class='relative shrink-0'>
                  <PlayerCard id={f?.status?.card} name={name} size={38} />
                  {f?.online && <StatusDot state={f.status.state} class='absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5' />}
                </div>
                <div class='relative min-w-0 flex-1'>
                  <div class='flex items-center justify-between gap-2'>
                    <span class='text-[13.5px] font-semibold tracking-tight text-text truncate'>{name}</span>
                    <span class='text-[10.5px] text-muted shrink-0 tabular-nums'>{timeLabel(c.last?.time, true)}</span>
                  </div>
                  <div class='flex items-center justify-between gap-2 mt-0.5'>
                    <span class={cx('text-[11.5px] truncate', c.unread ? 'text-text font-medium' : 'text-muted')}>{c.last ? (c.last.fromMe ? 'You: ' : '') + c.last.body : 'No messages yet'}</span>
                    {c.unread > 0 && <span class='anim-pop shrink-0 min-w-[18px] h-[18px] px-1 rounded-full accent-fill text-bg text-[10px] font-bold tabular-nums flex items-center justify-center'>{c.unread}</span>}
                  </div>
                </div>
              </ListRow>
            </Item>
          )
        })}
      </Stagger>
    </></Show>)
  
}

// message thread with one friend
export function ChatPanel(props) {
  const msgs = useInvoke('chat:messages', () => [props.cid], { poll: () => (props.active ? 2500 : undefined), deps: () => ([props.cid]) })
  const [pendingS, setPending] = createSignal([])
  const [textS, setText] = createSignal('')
  const [sendingS, setSending] = createSignal(false)
  const scroller = { current: null }
  const input = { current: null }
  createEffect(on(() => [props.cid], () => { setPending([]); setText(''); input.current?.focus() }))
  createEffect(on(() => [list().length, props.cid], () => {
    const el = scroller.current
    if (el) el.scrollTo({ top: el.scrollHeight, behavior: list().length > 1 && !prefersReducedMotion() ? 'smooth' : 'auto' })
  }))
  
    const list = () => ([...(msgs.data || []), ...pendingS().filter(p => !(msgs.data || []).some(m => m.fromMe && m.body === p.body && m.time >= p.time - 5000))])
    const send = async e => {
    e.preventDefault()
    const body = textS().trim()
    if (!body || sendingS()) return
    setSending(true)
    setText('')
    setPending(p => [...p, { id: 'pending-' + Date.now(), body, time: Date.now(), fromMe: true, pending: true }])
    try { await invoke('chat:send', props.cid, body); msgs.reload(true); props.onSent?.() }
    catch (err) { toast.error(err.message); setPending(p => p.filter(x => x.body !== body)); setText(body) }
    setSending(false)
    input.current?.focus()
  }
    const name = () => (props.friend?.gameName || list().find(m => !m.fromMe)?.gameName || 'Chat')
    const animFrom = () => (Math.max(0, list().length - 6))
    return (<Card class='anim-fade flex flex-col overflow-hidden h-full min-h-[420px] rounded-3xl'>
      <div class='relative flex items-center gap-3.5 px-6 py-4 border-b border-line'>
        <span class='halo -top-24 -left-10 w-64 h-64 opacity-60' />
        <div class='relative shrink-0'>
          <PlayerCard id={props.friend?.status?.card} name={name()} size={44} />
          {props.friend?.online && <StatusDot state={props.friend.status.state} class='absolute -bottom-0.5 -right-0.5 w-3 h-3' />}
        </div>
        <div class='relative min-w-0 flex-1'>
          <div class='flex items-center gap-2'>
            <span class='display text-[22px] truncate'>{name()}</span>
            {props.friend?.tagLine && <span class='text-[12px] text-muted'>#{props.friend.tagLine}</span>}
            {props.friend?.spectre && <Badge tone='accent'>Spectre</Badge>}
          </div>
          <div class='text-[12px] text-muted truncate mt-1'>{props.friend ? props.statusLine(props.friend) : ''}</div>
        </div>
        {props.actions && <div class='relative'>{props.actions}</div>}
        <Button variant='ghost' size='icon' class='relative' title='Close chat' onClick={props.onClose}><FiX /></Button>
      </div>

      <div ref={el => (scroller.current = el)} class='flex-1 overflow-y-auto px-6 py-5 flex flex-col gap-1.5'>
        {msgs.loading && !msgs.data ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton class={cx('h-10 w-2/5 rounded-2xl', i % 2 && 'self-end')} />)
        ) : !list().length ? (
          <Empty icon={FiMessageSquare} title={`Say hi to ${name()}`} hint='Messages go through your Riot chat, same as in-game.' class='my-auto' />
        ) : list().map((m, i) => {
          const prev = list()[i - 1]
          const gap = !prev || prev.fromMe !== m.fromMe || m.time - prev.time > 5 * 60000
          return (
            <div class={cx('flex flex-col max-w-[72%]', i >= animFrom() && 'anim-rise', m.fromMe ? 'self-end items-end' : 'self-start items-start', gap && i > 0 && 'mt-3')}>
              {gap && <span class='text-[10.5px] font-medium text-muted mb-1 px-2'>{m.fromMe ? 'You' : name()} · {timeLabel(m.time)}</span>}
              <div class={cx('rounded-[20px] px-4 py-2.5 text-[13px] leading-snug whitespace-pre-wrap break-words select-text',
                m.fromMe ? 'accent-fill text-bg rounded-br-md' : 'glass-inset text-text rounded-bl-md',
                m.pending && 'opacity-60')}>
                <span translate='no'>{m.body}</span>
              </div>
            </div>
          )
        })}
      </div>

      <form onSubmit={send} class='px-4 pb-4'>
        <div class='glass-field flex items-center gap-2 rounded-full pl-5 pr-1.5 h-12'>
          <input ref={el => (input.current = el)} value={textS()} onInput={e => setText(e.target.value)} placeholder={`Message ${name()}`} maxLength={500}
            class='flex-1 min-w-0 bg-transparent outline-none text-[13px] text-text placeholder:text-muted/60' />
          <Button type='submit' variant='primary' size='icon' class='shrink-0' disabled={!textS().trim()} loading={sendingS()} title='Send'><FiSend /></Button>
        </div>
      </form>
    </Card>)
  
}
