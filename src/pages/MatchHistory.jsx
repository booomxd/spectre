import { RequireRiot, Page } from '../ui'
import HistoryPanel from './history/HistoryPanel'

// Recent matches for you, or for another player when opened with { puuid }.
export default function MatchHistory({ params }) {
  const other = params?.puuid
  return (
    <Page title='Matches' subtitle={other ? 'Recent matches for the selected player' : 'Your recent matches, results and performance'}>
      <RequireRiot>
        <HistoryPanel key={other || 'me'} puuid={other} />
      </RequireRiot>
    </Page>
  )
}
