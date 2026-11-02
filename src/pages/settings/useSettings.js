import { useCallback, useEffect, useState } from 'react'
import { invoke, useEvent } from '../../lib/ipc'
import { toast } from '../../ui'

// Settings object + a patch function (optimistic; the backend merges nested groups).
export function useSettings() {
  const [settings, setSettings] = useState(null)
  const [error, setError] = useState(null)
  useEffect(() => { invoke('settings:get').then(setSettings).catch(e => setError(e.message)) }, [])
  useEvent('settings:changed', setSettings)
  const save = useCallback(async patch => {
    setSettings(s => s && {
      ...s, ...patch,
      overlay: { ...s.overlay, ...patch.overlay },
      discord: { ...s.discord, ...patch.discord },
    })
    try { setSettings(await invoke('settings:set', patch)) }
    catch (e) { toast.error(e.message); invoke('settings:get').then(setSettings).catch(() => { }) }
  }, [])
  return { settings, error, save }
}
