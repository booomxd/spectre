import { Page, RequireRiot, Stagger, Item } from '../ui'
import { useRiot } from '../lib/riot'
import { useInvoke } from '../lib/ipc'
import { useCatalog, pickPass } from './dashboard/catalog'
import { Hero, RankTile, TrendTile, FormTile, SessionTile, WalletCard, BundleCard, DailyCard, PassCard, FriendsCard } from './dashboard/Cards'

// Home bento: identity + rank, ranked trend + recent form, then store, battle pass, wallet, daily offers and friends.
function DashboardBody({ active }) {
  const riot = useRiot()
  const cat = useCatalog()
  const identity = useInvoke('store:identity')
  const account = useInvoke('progression:account')
  const rank = useInvoke('store:rank')
  const rr = useInvoke('progression:rrHistory', [20])
  const wallet = useInvoke('store:wallet', [], { poll: 60000, skip: !active })
  const store = useInvoke('store:storefront')
  const contracts = useInvoke('progression:contracts')
  const friends = useInvoke('social:friends', [], { poll: 30000, skip: !active })

  const tiles = [
    ['xl:col-span-8', <Hero riot={riot} identity={identity.data} account={account.data} rr={rr.data} />],
    ['md:col-span-6 xl:col-span-4', <RankTile rank={rank.data} />],
    ['xl:col-span-5', <TrendTile rr={rr} />],
    ['md:col-span-6 xl:col-span-3', <SessionTile rr={rr} />],
    ['md:col-span-6 xl:col-span-4', <FormTile rr={rr} />],
    ['md:col-span-6 xl:col-span-5', <BundleCard bundles={store.data?.bundles} cat={cat} />],
    ['md:col-span-6 xl:col-span-4', <PassCard pass={pickPass(contracts.data?.contracts)} cat={cat} loading={contracts.loading && !contracts.data} />],
    ['md:col-span-6 xl:col-span-3', <WalletCard wallet={wallet.data} cat={cat} />],
    ['xl:col-span-8', <DailyCard store={store.data} cat={cat} />],
    ['md:col-span-6 xl:col-span-4', <FriendsCard friends={friends} />],
  ]

  return (
    // No page header: the hero tile is the header here (name, date, quick stats).
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
