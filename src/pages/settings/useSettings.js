import { createSignal } from 'solid-js'
import { invoke, useEvent } from '../../lib/ipc'
import { toast } from '../../ui'

// Settings object + a patch function (optimistic). Returns getters: s.settings, s.error
export function useSettings() {
  const [settings, setSettings] = createSignal(null)
  const [error, setError] = createSignal(null)
  invoke('settings:get').then(setSettings).catch(e => setError(e.message))
  useEvent('settings:changed', setSettings)
  const save = async patch => {
    setSettings(s => s && {
      ...s, ...patch,
      overlay: { ...s.overlay, ...patch.overlay },
      discord: { ...s.discord, ...patch.discord },
    })
    try { setSettings(await invoke('settings:set', patch)) }
    catch (e) { toast.error(e.message); invoke('settings:get').then(setSettings).catch(() => { }) }
  }
  return { get settings() { return settings() }, get error() { return error() }, save }
}
