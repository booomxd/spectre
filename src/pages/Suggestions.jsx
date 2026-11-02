import { useState } from 'react'
import { FiGithub, FiSend } from 'react-icons/fi'
import { Button, Card, Input, Label, Page, Textarea, toast } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'
import logo from '../assets/spectre-logo.svg'

const cx = (...c) => c.filter(Boolean).join(' ')
const KINDS = [['suggestion', '💡', 'Suggestion'], ['bug', '🐞', 'Bug report'], ['other', '💬', 'Something else']]

// Send ideas and bug reports to the developer: by email when it's set up, otherwise as a GitHub issue.
export default function Suggestions() {
  const { data: cfg } = useInvoke('feedback:config')
  const [kind, setKind] = useState('suggestion')
  const [message, setMessage] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  const [sent, setSent] = useState(false)
  const label = KINDS.find(k => k[0] === kind)[2]
  const tooShort = message.trim().length < 10

  const github = () => {
    const title = `${label}: ${message.trim().split('\n')[0].slice(0, 70)}`
    const body = `${message.trim()}\n\n---\nSpectre ${cfg?.version || ''}${contact.trim() ? ` · Contact: ${contact.trim()}` : ''}`
    openExternal(`https://github.com/${cfg?.repo || 'booomxd/spectre'}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`)
    toast('Opened GitHub in your browser. Submit the issue there to send it.')
  }
  // Emailed via Web3Forms from the page itself (its free plan rejects requests from the app's backend).
  const email = async () => {
    let last = 0
    try { last = +localStorage.getItem('spectre:feedback-at') || 0 } catch (e) { }
    if (Date.now() - last < 60000) throw new Error('Please wait a minute before sending another one')
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: cfg.key, subject: `Spectre ${label.toLowerCase()} (v${cfg.version})`, from_name: 'Spectre app',
        message: message.trim(), contact: contact.trim() || 'not given', version: cfg.version, botcheck: '',
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) throw new Error(body.message || 'Could not send, please try again')
    try { localStorage.setItem('spectre:feedback-at', String(Date.now())) } catch (e) { }
  }
  const send = async () => {
    if (!cfg?.key) return github()
    setBusy(true)
    try { await email(); setSent(true); setMessage('') }
    catch (e) { toast.error(e.message) }
    setBusy(false)
  }

  return (
    <Page title='Suggestions' subtitle='Ideas, bugs or anything else: it goes straight to the developer.'>
      <div className='grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px] items-start max-w-5xl'>
        <Card className='anim-rise p-5'>
          {sent ? (
            <div className='anim-fade flex flex-col items-center text-center gap-2 py-10'>
              <img src={logo} alt='' className='w-14 h-14' draggable={false} />
              <div className='font-display text-xl font-bold'>Thanks, got it 👻</div>
              <p className='text-[13px] text-muted max-w-sm'>Your {label.toLowerCase()} was sent. If you left a contact, you may hear back.</p>
              <Button className='mt-2' onClick={() => setSent(false)}>Send another</Button>
            </div>
          ) : (
            <div className='flex flex-col gap-4'>
              <div className='flex flex-wrap gap-2'>
                {KINDS.map(([id, emoji, text]) => (
                  <button key={id} onClick={() => setKind(id)}
                    className={cx('h-9 px-3.5 rounded-lg border text-[13px] font-semibold transition-colors',
                      kind === id ? 'border-accent/60 bg-accent/10 text-text' : 'border-line bg-surface-2/50 text-muted hover:text-text')}>
                    {emoji} {text}
                  </button>
                ))}
              </div>
              <div>
                <Label hint={kind === 'bug' ? 'What happened, and what did you expect? Steps to reproduce help a lot.' : 'Be as detailed as you like.'}>Message</Label>
                <Textarea rows={8} value={message} onChange={e => setMessage(e.target.value)} maxLength={5000}
                  placeholder={kind === 'bug' ? 'When I open Live Match during agent select...' : 'It would be great if Spectre could...'} />
              </div>
              <div>
                <Label hint='Optional, only if you want a reply'>Discord or email</Label>
                <Input value={contact} onChange={e => setContact(e.target.value)} maxLength={200} placeholder='yourname or you@example.com' />
              </div>
              <div className='flex flex-wrap items-center gap-3'>
                <Button variant='primary' icon={cfg?.key ? FiSend : FiGithub} loading={busy} disabled={tooShort} onClick={send}>
                  {cfg?.key ? 'Send' : 'Send via GitHub'}
                </Button>
                {cfg?.key && <button className='text-xs text-muted hover:text-text' disabled={tooShort} onClick={github}>or post it on GitHub</button>}
                {tooShort && message && <span className='text-xs text-muted'>A little more, please (10+ characters)</span>}
              </div>
            </div>
          )}
        </Card>
        <Card className='anim-rise p-5 text-[12px] text-muted leading-relaxed' style={{ '--i': 1 }}>
          <div className='text-[13px] font-semibold text-text mb-2'>What gets sent</div>
          <p>Only your message, the contact you typed (if any) and your Spectre version. Nothing about your Riot account is included.</p>
          <p className='mt-2'>{cfg?.key ? 'Messages are emailed to the developer.' : 'Messages open as an issue on Spectre’s GitHub, which needs a free GitHub account and is public.'}</p>
        </Card>
      </div>
    </Page>
  )
}
