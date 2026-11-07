import { useState } from 'react'
import { FiAlertCircle, FiGithub, FiMessageCircle, FiSend, FiShield, FiZap } from 'react-icons/fi'
import { Button, Card, FadeIn, Input, Label, Page, SegmentedTabs, Swap, Textarea, toast } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'
import logo from '../assets/spectre-logo.svg'

const KINDS = [['suggestion', FiZap, 'Suggestion'], ['bug', FiAlertCircle, 'Bug report'], ['other', FiMessageCircle, 'Something else']]

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
    <Page title='Feedback' subtitle='Ideas, bugs or anything else: it goes straight to the developer.'>
      <div className='max-w-2xl xl:max-w-[1040px] grid gap-5 xl:grid-cols-[minmax(0,1fr)_300px] items-start pb-4'>
        <FadeIn>
          <Card className='relative overflow-hidden rounded-3xl'>
            <span className='halo -top-32 -left-24 w-96 h-96' />
            <Swap id={sent ? 'sent' : 'form'} className='relative'>
              {sent ? (
                <div className='flex flex-col items-center text-center gap-2.5 px-6 py-16'>
                  <span className='accent-soft w-20 h-20 rounded-3xl flex items-center justify-center mb-2'><img src={logo} alt='' className='w-12 h-12' draggable={false} /></span>
                  <div className='display text-[24px] text-text'>Thanks, got it</div>
                  <p className='text-[13px] text-muted max-w-sm leading-relaxed'>Your {label.toLowerCase()} was sent. If you left a contact, you may hear back.</p>
                  <Button className='mt-3' onClick={() => setSent(false)}>Send another</Button>
                </div>
              ) : (
                <div className='flex flex-col gap-5 p-6'>
                  <div>
                    <div className='eyebrow mb-3'>What is it about?</div>
                    <SegmentedTabs size='lg' layoutId='feedback-kind' value={kind} onChange={setKind}
                      tabs={KINDS.map(([value, icon, text]) => ({ value, icon, label: text }))} />
                  </div>
                  <div>
                    <Label hint={kind === 'bug' ? 'What happened, and what did you expect? Steps to reproduce help a lot.' : 'Be as detailed as you like.'}>Message</Label>
                    <Textarea rows={8} value={message} onChange={e => setMessage(e.target.value)} maxLength={5000} className='rounded-2xl px-4 py-3.5 leading-relaxed'
                      placeholder={kind === 'bug' ? 'When I open Live Match during agent select...' : 'It would be great if Spectre could...'} />
                    <div className='mt-1.5 flex justify-between text-[11px] text-muted tabular-nums'>
                      <span>{tooShort && message ? 'A little more, please (10+ characters)' : ''}</span>
                      <span>{message.length} / 5000</span>
                    </div>
                  </div>
                  <div>
                    <Label hint='Optional, only if you want a reply'>Discord or email</Label>
                    <Input value={contact} onChange={e => setContact(e.target.value)} maxLength={200} placeholder='yourname or you@example.com' />
                  </div>
                  <div className='hairline' />
                  <div className='flex flex-wrap items-center justify-between gap-3'>
                    {cfg?.key
                      ? <button className='text-xs font-medium text-muted hover:text-accent transition-colors disabled:opacity-50 inline-flex items-center gap-1.5' disabled={tooShort} onClick={github}><FiGithub /> or post it on GitHub</button>
                      : <span />}
                    <Button variant='primary' size='lg' icon={cfg?.key ? FiSend : FiGithub} loading={busy} disabled={tooShort} onClick={send}>
                      {cfg?.key ? 'Send' : 'Send via GitHub'}
                    </Button>
                  </div>
                </div>
              )}
            </Swap>
          </Card>
        </FadeIn>
        <FadeIn delay={0.08} className='flex flex-col gap-4 xl:pt-2'>
          <div className='flex gap-4 px-2 min-w-0'>
          <span className='glass w-9 h-9 rounded-xl flex items-center justify-center text-accent shrink-0'><FiShield size={15} /></span>
          <div className='min-w-0 text-[12px] text-muted leading-relaxed'>
            <div className='text-[13px] font-semibold text-text mb-0.5'>What gets sent</div>
            Only your message, the contact you typed (if any) and your Spectre version. Nothing about your Riot account is included.{' '}
            {cfg?.key ? 'Messages are emailed to the developer.' : 'Messages open as an issue on Spectre’s GitHub, which needs a free GitHub account and is public.'}
          </div>
          </div>
          <Card className='hidden xl:block px-4 py-1 rounded-2xl'>
            {[
              ['Type', label],
              ['Message', message.trim() ? `${message.trim().length} characters` : '-'],
              ['Contact', contact.trim() ? 'Included' : 'Not given'],
              ['Version', cfg?.version ? `Spectre ${cfg.version}` : '-'],
              ['Delivery', cfg?.key ? 'Email' : `GitHub issue · ${cfg?.repo || 'booomxd/spectre'}`],
            ].map(([k, v], i) => (
              <div key={k} className={'flex items-center justify-between gap-3 py-2.5 text-[12px]' + (i ? ' border-t border-line/60' : '')}>
                <span className='text-muted shrink-0'>{k}</span>
                <span className='font-medium text-text truncate tabular-nums'>{v}</span>
              </div>
            ))}
          </Card>
        </FadeIn>
      </div>
    </Page>
  )
}
