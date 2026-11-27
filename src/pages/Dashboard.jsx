import { For } from 'solid-js'
import { Page, RequireRiot, Stagger, Item } from '../ui'
import { useRiot } from '../lib/riot'
import { useInvoke } from '../lib/ipc'
import { useCatalog, pickPass } from './dashboard/catalog'
import { TrendTile, FormTile, SessionTile, WalletCard, PassCard } from './dashboard/Cards'
import { HomeHero, ShopCard, FriendsPanel } from './dashboard/HomeLayout'

// Home: a hero with your overview and session, today's shop beside your online friends, then the smaller tiles
function DashboardBody(props) {
  const riotA = useRiot()
  const catA = useCatalog()
  const identity = useInvoke('store:identity')
  const account = useInvoke('progression:account')
  const rank = useInvoke('store:rank')
  const rr = useInvoke('progression:rrHistory', [20])
  const wallet = useInvoke('store:wallet', [], { poll: () => (props.active ? 60000 : undefined) })
  const store = useInvoke('store:storefront')
  const contracts = useInvoke('progression:contracts')
  const friends = useInvoke('social:friends', [], { poll: () => (props.active ? 30000 : undefined), key: 'puuid' })
  const party = useInvoke('social:party', [], { poll: () => (props.active ? 15000 : undefined) })
  
  const tiles = [
    ['', <HomeHero riot={riotA()} identity={identity.data} account={account.data} rank={rank.data} rr={rr} party={party} />],
    ['lg:col-span-8', <ShopCard store={store.data} cat={catA()} />],
    // the friends list takes the shop's height and scrolls inside it
    ['lg:col-span-4 relative min-h-[440px]', <FriendsPanel friends={friends} />],
    ['xl:col-span-5', <TrendTile rr={rr} />],
    ['md:col-span-6 xl:col-span-3', <SessionTile rr={rr} />],
    ['md:col-span-6 xl:col-span-4', <FormTile rr={rr} />],
    ['md:col-span-6 xl:col-span-7', <PassCard pass={pickPass(contracts.data?.contracts)} cat={catA()} loading={contracts.loading && !contracts.data} />],
    ['md:col-span-6 xl:col-span-5', <WalletCard wallet={wallet.data} cat={catA()} />],
  ]
    return (<Page bodyClass='pt-7'>
      <Stagger class='bento' step={0.045}>
        <For each={tiles}>{([span, el], i) => <Item index={i()} class={'col-span-12 ' + span}>{el}</Item>}</For>
      </Stagger>
    </Page>)
  
}

export default function Dashboard(props) {
  return <RequireRiot><DashboardBody active={props.active !== false} /></RequireRiot>
}
