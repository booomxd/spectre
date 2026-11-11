import { createContext, createElement, useContext, useEffect, useState } from 'react'
import { invoke, useEvent } from './ipc'

const RiotContext = createContext({ connected: false })

// provides the Riot connection status
export function RiotProvider({ children }) {
  const [status, setStatus] = useState({ connected: false })
  useEffect(() => { invoke('riot:status').then(setStatus).catch(() => { }) }, [])
  useEvent('riot:status', setStatus)
  return createElement(RiotContext.Provider, { value: status }, children)
}

export const useRiot = () => useContext(RiotContext)
