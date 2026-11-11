// app navigation
import { FiActivity, FiAward, FiClock, FiCompass, FiEdit3, FiFileText, FiGrid, FiHome, FiLayers, FiMessageSquare, FiRadio, FiSearch, FiSettings, FiShoppingBag, FiTrendingUp, FiUserCheck, FiUsers } from 'react-icons/fi'
import { FaDiscord } from 'react-icons/fa'
import { GunIcon } from './pages/live/parts'

import Dashboard from './pages/Dashboard'
import Friends from './pages/Friends'
import LiveMatch from './pages/LiveMatch'
import Progression from './pages/Progression'
import Loadout from './pages/Loadout'
import PlayerSearch from './pages/PlayerSearch'
import MatchHistory from './pages/MatchHistory'
import Memo from './pages/Memo'
import Activity from './pages/Activity'
import FriendActivity from './pages/FriendActivity'
import Shop from './pages/Shop'
import Discord from './pages/Discord'
import Weapons from './pages/Weapons'
import Leaderboard from './pages/Leaderboard'
import PatchNotes from './pages/PatchNotes'
import Suggestions from './pages/Suggestions'
import Settings from './pages/Settings'
import Strategies from './pages/Strategies'

// `full`: the page manages its own full-bleed layout (no Page header), e.g. the Playbook board
export const SECTIONS = [
  { id: 'home', label: 'Home', icon: FiHome, pages: [
    { id: 'dashboard', label: 'Home', icon: FiGrid, component: Dashboard },
  ] },
  { id: 'live', label: 'Live', icon: FiRadio, pages: [
    { id: 'live', label: 'Live Match', icon: FiRadio, component: LiveMatch },
  ] },
  { id: 'career', label: 'Career', icon: FiTrendingUp, pages: [
    { id: 'progression', label: 'Progression', icon: FiTrendingUp, component: Progression },
    { id: 'history', label: 'Matches', icon: FiClock, component: MatchHistory },
    { id: 'activity', label: 'Encounters', icon: FiActivity, component: Activity },
    { id: 'leaderboard', label: 'Leaderboard', icon: FiAward, component: Leaderboard },
  ] },
  { id: 'squad', label: 'Squad', icon: FiUsers, pages: [
    { id: 'friends', label: 'Friends', icon: FiUsers, component: Friends },
    { id: 'friendlog', label: 'Feed', icon: FiUserCheck, component: FriendActivity },
    { id: 'memo', label: 'Notes', icon: FiEdit3, component: Memo },
    { id: 'search', label: 'Lookup', icon: FiSearch, component: PlayerSearch },
  ] },
  { id: 'arsenal', label: 'Arsenal', icon: FiLayers, pages: [
    { id: 'loadout', label: 'Loadout', icon: FiLayers, component: Loadout },
    { id: 'shop', label: 'Store', icon: FiShoppingBag, component: Shop },
    { id: 'weapons', label: 'Weapons', icon: GunIcon, component: Weapons },
  ] },
  { id: 'playbook', label: 'Playbook', icon: FiCompass, pages: [
    { id: 'strategies', label: 'Strategies', icon: FiCompass, component: Strategies, full: true },
  ] },
]

// right side of the dock (icon buttons)
export const UTILITY = [
  { id: 'discord', label: 'Discord', icon: FaDiscord, component: Discord },
  { id: 'patchnotes', label: "What's new", icon: FiFileText, component: PatchNotes },
  { id: 'suggestions', label: 'Feedback', icon: FiMessageSquare, component: Suggestions },
  { id: 'settings', label: 'Settings', icon: FiSettings, component: Settings },
]

// Settings > Experimental tools (ids kept for navigate())
export { EXPERIMENTAL, EXPERIMENTAL_IDS } from './pages/settings/tools'

// every page the shell renders, by id
export const PAGES = Object.fromEntries([...SECTIONS.flatMap(s => s.pages.map(p => ({ ...p, section: s.id }))), ...UTILITY.map(p => ({ ...p, section: null }))].map(p => [p.id, p]))
export const sectionOf = id => SECTIONS.find(s => s.pages.some(p => p.id === id)) || null

// v2 exports kept for anything still importing them
export const GROUPS = SECTIONS.map(s => ({ label: s.label, pages: s.pages }))
export const STRATEGIES = PAGES.strategies

// pages can navigate with: window.dispatchEvent(new CustomEvent('spectre:navigate', { detail: { page: 'history', params: {...} } }))
export function navigate(page, params) {
  window.dispatchEvent(new CustomEvent('spectre:navigate', { detail: { page, params } }))
}
