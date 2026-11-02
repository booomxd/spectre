// Every page in the app. The sidebar renders these groups in order; `tab` picks which top tab owns it.
import { FiActivity, FiAward, FiClock, FiCompass, FiEdit3, FiFileText, FiGrid, FiLayers, FiMessageSquare, FiRadio, FiSearch, FiSettings, FiShoppingBag, FiTarget, FiTrendingUp, FiUsers, FiUser, FiZap } from 'react-icons/fi'
import { FaDiscord } from 'react-icons/fa'
import { GiTrophy, GiPistolGun } from 'react-icons/gi'

import Dashboard from './pages/Dashboard'
import Friends from './pages/Friends'
import LiveMatch from './pages/LiveMatch'
import Progression from './pages/Progression'
import Loadout from './pages/Loadout'
import PlayerSearch from './pages/PlayerSearch'
import MatchHistory from './pages/MatchHistory'
import Memo from './pages/Memo'
import Activity from './pages/Activity'
import Shop from './pages/Shop'
import Discord from './pages/Discord'
import Weapons from './pages/Weapons'
import Leaderboard from './pages/Leaderboard'
import RankEditor from './pages/RankEditor'
import Customize from './pages/Customize'
import Premier from './pages/Premier'
import Status from './pages/Status'
import PatchNotes from './pages/PatchNotes'
import Suggestions from './pages/Suggestions'
import Settings from './pages/Settings'
import Strategies from './pages/Strategies'

export const GROUPS = [
  {
    label: 'Live', pages: [
      { id: 'dashboard', label: 'Dashboard', icon: FiGrid, component: Dashboard },
      { id: 'friends', label: 'Friends', icon: FiUsers, component: Friends },
      { id: 'live', label: 'Live Match', icon: FiRadio, component: LiveMatch },
    ]
  },
  {
    label: 'Stats', pages: [
      { id: 'progression', label: 'Progression', icon: FiTrendingUp, component: Progression },
      { id: 'loadout', label: 'Loadout', icon: FiLayers, component: Loadout },
      { id: 'search', label: 'Player Search', icon: FiSearch, component: PlayerSearch },
      { id: 'history', label: 'Match History', icon: FiClock, component: MatchHistory },
      { id: 'memo', label: 'Notes', icon: FiEdit3, component: Memo },
      { id: 'activity', label: 'Encounters', icon: FiActivity, component: Activity },
    ]
  },
  {
    label: 'Explore', pages: [
      { id: 'shop', label: 'Shop', icon: FiShoppingBag, component: Shop },
      { id: 'discord', label: 'Discord', icon: FaDiscord, component: Discord },
      { id: 'weapons', label: 'Weapons', icon: GiPistolGun, component: Weapons },
      { id: 'leaderboard', label: 'Leaderboard', icon: FiAward, component: Leaderboard },
    ]
  },
  {
    label: 'LARP', pages: [
      { id: 'rank', label: 'Rank Editor', icon: FiTarget, component: RankEditor },
      { id: 'customize', label: 'Customize', icon: FiUser, component: Customize },
      { id: 'premier', label: 'Premier', icon: GiTrophy, component: Premier },
      { id: 'status', label: 'Status', icon: FiZap, component: Status },
    ]
  },
  {
    label: 'System', pages: [
      { id: 'patchnotes', label: 'Patch Notes', icon: FiFileText, component: PatchNotes },
      { id: 'suggestions', label: 'Suggestions', icon: FiMessageSquare, component: Suggestions },
      { id: 'settings', label: 'Settings', icon: FiSettings, component: Settings },
    ]
  },
]

export const PAGES = Object.fromEntries(GROUPS.flatMap(g => g.pages).map(p => [p.id, p]))

// The Tactics tab is a single full-width workspace.
export const STRATEGIES = { id: 'strategies', label: 'Strategies', icon: FiCompass, component: Strategies }

// Pages can navigate with: window.dispatchEvent(new CustomEvent('spectre:navigate', { detail: { page: 'history', params: {...} } }))
export function navigate(page, params) {
  window.dispatchEvent(new CustomEvent('spectre:navigate', { detail: { page, params } }))
}
