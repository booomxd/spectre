import { Page, RequireRiot } from '../ui'
import { useRiot } from '../lib/riot'
import { useInvoke } from '../lib/ipc'
import { useCatalog, pickPass } from './dashboard/catalog'
import { Hero, WalletCard, BundleCard, DailyCard, PassCard, FriendsCard, ClockCard } from './dashboard/Cards'

function DashboardBody({ active }) {
  const riot = useRiot()
  const cat = useCatalog()
  const identity = useInvoke('store:identity')
  const account = useInvoke('progression:account')
  const rank = useInvoke('store:rank')
  const wallet = useInvoke('store:wallet', [], { poll: 60000, skip: !active })
  const store = useInvoke('store:storefront')
  const contracts = useInvoke('progression:contracts')
  const friends = useInvoke('social:friends', [], { poll: 30000, skip: !active })

  return (
    <Page title='Dashboard' subtitle='Your account at a glance'>
      <div className='space-y-5'>
        <Hero riot={riot} identity={identity.data} account={account.data} rank={rank.data} />
        <div className='grid grid-cols-1 lg:grid-cols-3 gap-5 items-start'>
          <div className='lg:col-span-2 space-y-5'>
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
              <BundleCard bundles={store.data?.bundles} cat={cat} />
              <PassCard pass={pickPass(contracts.data?.contracts)} cat={cat} loading={contracts.loading && !contracts.data} />
            </div>
            <DailyCard store={store.data} cat={cat} />
          </div>
          <div className='space-y-5'>
            <WalletCard wallet={wallet.data} cat={cat} />
            <ClockCard store={store.data} />
            <FriendsCard friends={friends} />
          </div>
        </div>
      </div>
    </Page>
  )
}

export default function Dashboard({ active }) {
  return <RequireRiot><DashboardBody active={active !== false} /></RequireRiot>
}
