import { useEffect, useState } from 'react'
import { FaDiscord } from 'react-icons/fa'
import { FiExternalLink, FiPower } from 'react-icons/fi'
import { Badge, Button, Card, ErrorState, Input, Label, Page, SectionTitle, Skeleton, Toggle, toast } from '../ui'
import { invoke, openExternal, useInvoke } from '../lib/ipc'
import { useRiot } from '../lib/riot'
import { useSettings } from './settings/useSettings'

const TOGGLES = [
  ['showRank', 'Show rank', 'Your current competitive rank'],
  ['showMap', 'Show map', 'The map while in a match'],
  ['showScore', 'Show score', 'Live round score while in a match'],
  ['showParty', 'Show party size', 'Party members out of the maximum'],
]

const elapsed = start => {
  const s = Math.max(0, Math.floor((Date.now() - start) / 1000))
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`
}

// How the activity will look in a Discord profile.
function PreviewCard({ activity, loading, user }) {
  const [, tick] = useState(0)
  useEffect(() => { const t = setInterval(() => tick(n => n + 1), 1000); return () => clearInterval(t) }, [])
  return (
    <Card className='p-4'>
      <div className='text-[11px] font-bold tracking-[0.14em] uppercase text-muted mb-3'>Playing a game</div>
      {loading && !activity ? <Skeleton className='h-[88px] rounded-lg' /> : !activity ? (
        <p className='text-[13px] text-muted py-6 text-center'>Nothing to show. Start VALORANT and your status appears here.</p>
      ) : (
        <div key={activity.details + (activity.state || '')} className='anim-fade flex gap-3.5'>
          <div className='w-[88px] h-[88px] rounded-lg bg-surface-2 border border-line flex items-center justify-center shrink-0'>
            <span className='font-display text-2xl font-bold text-accent'>VAL</span>
          </div>
          <div className='min-w-0 flex flex-col justify-center gap-0.5'>
            <div className='text-[14px] font-bold truncate'>VALORANT</div>
            <div className='text-[13px] truncate'>{activity.details}</div>
            {activity.state && <div className='text-[13px] text-muted truncate'>{activity.state}</div>}
            {activity.party && <div className='text-[12px] text-muted'>(party {activity.party.size[0]} of {activity.party.size[1]})</div>}
            {activity.timestamps?.start && <div className='text-[12px] text-good'>{elapsed(activity.timestamps.start)} elapsed</div>}
          </div>
        </div>
      )}
      {user && <div className='text-[11px] text-muted mt-3'>Shown on the profile of {user.username}</div>}
    </Card>
  )
}

const STEPS = [
  'Open the Discord Developer Portal and create a New Application. Its name is what friends see after "Playing" (use VALORANT).',
  'Copy the Application ID from General Information and paste it below as the Client ID.',
  'Optional: under Rich Presence > Art Assets upload an image and note its key. Enter that key as the large image. Without one, your status shows as text only.',
]

export default function Discord({ active }) {
  const riot = useRiot()
  const { settings, error, save } = useSettings()
  const status = useInvoke('discord:status', [], { poll: 4000, skip: active === false })
  const [clientId, setClientId] = useState('')
  const [image, setImage] = useState('')
  const [busy, setBusy] = useState(false)
  const d = settings?.discord
  const s = status.data || {}

  useEffect(() => { if (d) { setClientId(c => c || d.clientId); setImage(i => i || d.largeImage) } }, [d?.clientId, d?.largeImage])

  const key = d ? [d.showRank, d.showMap, d.showScore, d.showParty, d.largeImage].join() : ''
  const preview = useInvoke('discord:preview', [], { deps: [key, riot.connected], poll: 15000, skip: !riot.connected || !d || active === false })

  const run = async (fn, ok) => {
    setBusy(true)
    try { await fn(); if (ok) toast.success(ok) } catch (e) { toast.error(e.message) }
    setBusy(false); status.reload(true)
  }
  const connect = () => run(async () => {
    if (image !== d.largeImage) await save({ discord: { largeImage: image.trim() } })
    await invoke('discord:connect', clientId.trim())
  }, 'Rich Presence is live')
  const disconnect = () => run(() => invoke('discord:disconnect'), 'Presence cleared')

  if (error) return <Page title='Discord'><ErrorState error={error} /></Page>
  const tone = s.connected ? 'good' : s.error ? 'bad' : 'neutral'

  return (
    <Page title='Discord' subtitle='Show your VALORANT status on your Discord profile'
      actions={<Badge tone={tone}>{s.connected ? 'Live' : s.error ? 'Error' : s.enabled ? 'Connecting' : 'Off'}</Badge>}>
      {!d ? <Skeleton className='h-80 rounded-xl max-w-5xl' /> : (
        <div className='grid gap-5 lg:grid-cols-[1fr_380px] max-w-5xl stagger'>
          <div className='flex flex-col gap-5'>
            <Card className='anim-rise p-5' style={{ '--i': 0 }}>
              <SectionTitle right={<FaDiscord className='text-muted' />}>Connection</SectionTitle>
              <Label hint='Application ID of your Discord application'>Client ID</Label>
              <Input value={clientId} onChange={e => setClientId(e.target.value)} placeholder='123456789012345678' disabled={s.connected} />
              <div className='mt-3'>
                <Label hint='Optional. Key of an image uploaded under Art Assets'>Large image key</Label>
                <Input value={image} onChange={e => setImage(e.target.value)} placeholder='valorant_logo' disabled={s.connected} />
              </div>
              <div className='flex items-center gap-3 mt-4'>
                {s.connected
                  ? <Button variant='danger' icon={FiPower} loading={busy} onClick={disconnect}>Disconnect</Button>
                  : <Button variant='primary' icon={FaDiscord} loading={busy} onClick={connect} disabled={!clientId.trim()}>Connect</Button>}
                <span className='text-xs text-muted'>
                  {s.connected ? `Connected as ${s.user?.username || 'Discord user'}${s.lastUpdate ? ' · updates every 15s' : ''}`
                    : s.error ? s.error : s.enabled ? 'Waiting for Discord...' : 'Discord must be running on this PC'}
                </span>
              </div>
            </Card>

            <Card className='anim-rise p-5' style={{ '--i': 1 }}>
              <SectionTitle>What to show</SectionTitle>
              <div className='flex flex-col gap-3.5'>
                {TOGGLES.map(([k, label, hint]) => (
                  <Toggle key={k} checked={d[k]} label={label} hint={hint} onChange={v => save({ discord: { [k]: v } })} />
                ))}
              </div>
            </Card>
          </div>

          <div className='flex flex-col gap-5'>
            <div className='anim-rise' style={{ '--i': 2 }}>
              <SectionTitle>Preview</SectionTitle>
              <PreviewCard activity={riot.connected ? preview.data?.activity : null} loading={preview.loading && riot.connected} user={s.connected ? s.user : null} />
            </div>
            <Card className='anim-rise p-5' style={{ '--i': 3 }}>
              <SectionTitle right={<Button size='sm' variant='ghost' icon={FiExternalLink} onClick={() => openExternal('https://discord.com/developers/applications')}>Developer Portal</Button>}>Setup</SectionTitle>
              <ol className='flex flex-col gap-2.5'>
                {STEPS.map((t, i) => (
                  <li key={i} className='flex gap-2.5 text-xs text-muted'>
                    <span className='w-5 h-5 shrink-0 rounded-md bg-accent/15 text-accent font-display font-bold text-[11px] flex items-center justify-center'>{i + 1}</span>
                    <span>{t}</span>
                  </li>
                ))}
              </ol>
            </Card>
          </div>
        </div>
      )}
    </Page>
  )
}
