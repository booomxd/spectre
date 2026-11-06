// The experimental (LARP) tools shown in Settings > Experimental. Ids are the old page ids, so navigate('rank') etc. still work.
// Plain data only (no page imports), so the nav and the shell can use it without an import cycle.
import { FiTarget, FiUser, FiZap } from 'react-icons/fi'
import { GiTrophy } from 'react-icons/gi'

export const EXPERIMENTAL = [
  { id: 'rank', label: 'Rank Editor', icon: FiTarget, hint: 'Show a different rank in your profile' },
  { id: 'customize', label: 'Profile', icon: FiUser, hint: 'Card, title, level and status text' },
  { id: 'premier', label: 'Premier', icon: GiTrophy, hint: 'Premier team tag and division' },
  { id: 'status', label: 'Status', icon: FiZap, hint: 'Presence state shown to friends' },
]
export const EXPERIMENTAL_IDS = new Set(EXPERIMENTAL.map(p => p.id))
