// Store wishlist, shared by every page: one cached list, updated by whichever page changes it
import { Show, createMemo, createSignal } from 'solid-js'
import { FiHeart } from 'solid-icons/fi'
import { invoke } from './ipc'
import { toast } from '../ui'

const cx = (...c) => c.filter(Boolean).join(' ')
const [items, setItems] = createSignal(null)
let loading = false
const lc = s => (s || '').toLowerCase()
const ids = createMemo(() => new Set((items() || []).map(i => i.id)))

export function useWishlist() {
  if (!items() && !loading) { loading = true; invoke('wishlist:list').then(l => setItems(l || [])).catch(() => { loading = false }) }
  return {
    get items() { return items() || [] },
    has: id => ids().has(lc(id)),
    toggle: (id, name) => invoke('wishlist:toggle', { id: lc(id), name }).then(next => {
      setItems(next || [])
      const on = (next || []).some(i => i.id === lc(id))
      toast(on ? `${name} added to your wishlist` : `${name} removed from your wishlist`, on ? 'good' : 'neutral')
    }).catch(e => toast.error(e.message || 'Could not update your wishlist')),
  }
}

// heart in the corner of a skin tile
export function WishButton(props) {
  const w = useWishlist()
  const on = () => w.has(props.id)
  const label = () => on() ? 'Remove from wishlist' : 'Add to wishlist'
  return (
    <Show when={props.id}>
      <button type='button' aria-label={label()} title={label()} aria-pressed={on()}
        onClick={e => { e.stopPropagation(); w.toggle(props.id, props.name) }}
        class={cx('w-8 h-8 rounded-full glass flex items-center justify-center transition-[opacity,color,transform] duration-200 active:scale-90',
          on() ? 'text-bad opacity-100' : 'text-muted hover:text-text', props.class)}>
        <FiHeart size={13} fill={on() ? 'currentColor' : 'none'} />
      </button>
    </Show>
  )
}
