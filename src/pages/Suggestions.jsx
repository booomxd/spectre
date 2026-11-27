import { createSignal } from 'solid-js'
import { FiAlertCircle, FiGithub, FiMessageCircle, FiSend, FiShield, FiZap } from 'solid-icons/fi'
import { Button, Card, FadeIn, Input, Label, Page, SegmentedTabs, Swap, Textarea, toast } from '../ui'
import { openExternal, useInvoke } from '../lib/ipc'
import logo from '../assets/spectre-logo.svg'

const KINDS = [['suggestion', FiZap, 'Suggestion'], ['bug', FiAlertCircle, 'Bug report'], ['other', FiMessageCircle, 'Something else']]

// send ideas and bug reports to the developer: by email when it's set up
export default function Suggestions() {
  const __invoke = useInvoke('feedback:config')
  const [kindS, setKind] = createSignal('suggestion')
  const [messageS, setMessage] = createSignal('')
  const [contactS, setContact] = createSignal('')
  const [busyS, setBusy] = createSignal(false)
  const [sentS, setSent] = createSignal(false)
  
    const label = () => (KINDS.find(k => k[0] === kindS())[2])
    const tooShort = () => (messageS().trim().length < 10)
    const github = () => {
    const title = `${label()}: ${messageS().trim().split('\n')[0].slice(0, 70)}`
    const body = `${messageS().trim()}\n\n---\nSpectre ${__invoke.data?.version || ''}${contactS().trim() ? ` · Contact: ${contactS().trim()}` : ''}`
    openExternal(`https://github.com/${__invoke.data?.repo || 'booomxd/spectre'}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`)
    toast('Opened GitHub in your browser. Submit the issue there to send it.')
  }
    const email = async () => {
    let last = 0
    try { last = +localStorage.getItem('spectre:feedback-at') || 0 } catch (e) { }
    if (Date.now() - last < 60000) throw new Error('Please wait a minute before sending another one')
    const res = await fetch('https://api.web3forms.com/submit', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({
        access_key: __invoke.data.key, subject: `Spectre ${label().toLowerCase()} (v${__invoke.data.version})`, from_name: 'Spectre app',
        message: messageS().trim(), contact: contactS().trim() || 'not given', version: __invoke.data.version, botcheck: '',
      }),
    })
    const body = await res.json().catch(() => ({}))
    if (!res.ok || !body.success) throw new Error(body.message || 'Could not send, please try again')
    try { localStorage.setItem('spectre:feedback-at', String(Date.now())) } catch (e) { }
  }
    const send = async () => {
    if (!__invoke.data?.key) return github()
    setBusy(true)
    try { await email(); setSent(true); setMessage('') }
    catch (e) { toast.error(e.message) }
    setBusy(false)
  }
    return (<Page title='Feedback' subtitle='Ideas, bugs or anything else: it goes straight to the developer.'>
      <div class='max-w-2xl flex flex-col gap-6 pb-4'>
        <FadeIn>
          <Card class='relative overflow-hidden rounded-3xl'>
            <span class='halo -top-32 -left-24 w-96 h-96' />
            <Swap id={sentS() ? 'sent' : 'form'} class='relative'>
              {sentS() ? (
                <div class='flex flex-col items-center text-center gap-2.5 px-8 py-16'>
                  <span class='accent-soft w-20 h-20 rounded-3xl flex items-center justify-center mb-2'><img decoding='async' src={logo} alt='' class='w-12 h-12' draggable={false} /></span>
                  <div class='display text-[28px] text-text'>Thanks, got it</div>
                  <p class='text-[13px] text-muted max-w-sm leading-relaxed'>Your {label().toLowerCase()} was sent. If you left a contact, you may hear back.</p>
                  <Button class='mt-3' onClick={() => setSent(false)}>Send another</Button>
                </div>
              ) : (
                <div class='flex flex-col gap-6 p-7'>
                  <div>
                    <div class='eyebrow mb-3'>What is it about?</div>
                    <SegmentedTabs size='lg' layoutId='feedback-kind' value={kindS()} onChange={setKind}
                      tabs={KINDS.map(([value, icon, text]) => ({ value, icon, label: text }))} />
                  </div>
                  <div>
                    <Label hint={kindS() === 'bug' ? 'What happened, and what did you expect? Steps to reproduce help a lot.' : 'Be as detailed as you like.'}>Message</Label>
                    <Textarea rows={8} value={messageS()} onInput={e => setMessage(e.target.value)} maxLength={5000} class='rounded-2xl px-4 py-3.5 leading-relaxed'
                      placeholder={kindS() === 'bug' ? 'When I open Live Match during agent select...' : 'It would be great if Spectre could...'} />
                    <div class='mt-1.5 flex justify-between text-[11px] text-muted tabular-nums'>
                      <span>{tooShort() && messageS() ? 'A little more, please (10+ characters)' : ''}</span>
                      <span>{messageS().length} / 5000</span>
                    </div>
                  </div>
                  <div>
                    <Label hint='Optional, only if you want a reply'>Discord or email</Label>
                    <Input value={contactS()} onInput={e => setContact(e.target.value)} maxLength={200} placeholder='yourname or you@example.com' />
                  </div>
                  <div class='hairline' />
                  <div class='flex flex-wrap items-center justify-between gap-3'>
                    {__invoke.data?.key
                      ? <button class='text-xs font-medium text-muted hover:text-accent transition-colors disabled:opacity-50 inline-flex items-center gap-1.5' disabled={tooShort()} onClick={github}><FiGithub /> or post it on GitHub</button>
                      : <span />}
                    <Button variant='primary' size='lg' icon={__invoke.data?.key ? FiSend : FiGithub} loading={busyS()} disabled={tooShort()} onClick={send}>
                      {__invoke.data?.key ? 'Send' : 'Send via GitHub'}
                    </Button>
                  </div>
                </div>
              )}
            </Swap>
          </Card>
        </FadeIn>
        <FadeIn delay={0.08} class='flex gap-4 px-2'>
          <span class='glass w-9 h-9 rounded-xl flex items-center justify-center text-accent shrink-0'><FiShield size={15} /></span>
          <div class='text-[12px] text-muted leading-relaxed'>
            <div class='text-[13px] font-semibold text-text mb-0.5'>What gets sent</div>
            Only your message, the contact you typed (if any) and your Spectre version. Nothing about your Riot account is included.{' '}
            {__invoke.data?.key ? 'Messages are emailed to the developer.' : 'Messages open as an issue on Spectre’s GitHub, which needs a free GitHub account and is public.'}
          </div>
        </FadeIn>
      </div>
    </Page>)
  
}
