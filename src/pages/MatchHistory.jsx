import { RequireRiot, Page } from '../ui'
import HistoryPanel from './history/HistoryPanel'

// recent matches for you, or for another player when opened with { puuid }
export default function MatchHistory(props) {
  
    const other = () => (props.params?.puuid)
    return (<Page title='Matches' subtitle={other() ? 'Recent matches for the selected player' : 'Your recent matches, results and performance'}>
      <RequireRiot>
        <HistoryPanel puuid={other()} />
      </RequireRiot>
    </Page>)
  
}
