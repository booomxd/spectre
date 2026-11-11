import { Page, RequireRiot, Stagger, Item } from '../ui'
import { useRiot } from '../lib/riot'
import { useInvoke } from '../lib/ipc'
import { useCatalog, pickPass } from './dashboard/catalog'
import { TrendTile, FormTile, SessionTile, WalletCard, PassCard } from './dashboard/Cards'
import { HomeHero, ShopCard, FriendsPanel } from './dashboard/HomeLayout'

// Home: a hero with your overview and session, today's shop beside your online friends, then the smaller tiles
function DashboardBody({ active }) {
  const riot = useRiot()
  const cat = useCatalog()
  const identity = useInvoke('store:identity')
  const account = useInvoke('progression:account')
  const rank = useInvoke('store:rank')
  const rr = useInvoke('progression:rrHistory', [20])
  const wallet = useInvoke('store:wallet', [], { poll: active ? 60000 : undefined })
  const store = useInvoke('store:storefront')
  const contracts = useInvoke('progression:contracts')
  const friends = useInvoke('social:friends', [], { poll: active ? 30000 : undefined })

  const party = useInvoke('social:party', [], { poll: active ? 15000 : undefined })

  const tiles = [
    ['', <HomeHero riot={riot} identity={identity.data} account={account.data} rank={rank.data} rr={rr} party={party} />],
    ['lg:col-span-8', <ShopCard store={store.data} cat={cat} />],
    // the friends list takes the shop's height and scrolls inside it
    ['lg:col-span-4 relative min-h-[440px]', <FriendsPanel friends={friends} />],
    ['xl:col-span-5', <TrendTile rr={rr} />],
    ['md:col-span-6 xl:col-span-3', <SessionTile rr={rr} />],
    ['md:col-span-6 xl:col-span-4', <FormTile rr={rr} />],
    ['md:col-span-6 xl:col-span-7', <PassCard pass={pickPass(contracts.data?.contracts)} cat={cat} loading={contracts.loading && !contracts.data} />],
    ['md:col-span-6 xl:col-span-5', <WalletCard wallet={wallet.data} cat={cat} />],
  ]

  return (
    // no page header: the hero tile is the header here
    <Page bodyClassName='pt-7'>
      <Stagger className='bento' step={0.045}>
        {tiles.map(([span, el], i) => <Item key={i} index={i} className={'col-span-12 ' + span}>{el}</Item>)}
      </Stagger>
    </Page>
  )
}

export default function Dashboard({ active }) {
  return <RequireRiot><DashboardBody active={active !== false} /></RequireRiot>
}
