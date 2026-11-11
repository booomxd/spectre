// Store wishlist, shared by every page: one cached list, updated by whichever page changes it
import React, { useEffect, useState } from 'react'
import { FiHeart } from 'react-icons/fi'
import { invoke } from './ipc'
import { toast } from '../ui'

const cx = (...c) => c.filter(Boolean).join(' ')
let cache = null
const subs = new Set()
const publish = items => { cache = items || []; subs.forEach(f => f(cache)) }
const lc = s => (s || '').toLowerCase()

export function useWishlist() {
  const [items, setItems] = useState(cache || [])
  useEffect(() => {
    subs.add(setItems)
    if (cache) setItems(cache)
    else invoke('wishlist:list').then(publish).catch(() => { })
    return () => { subs.delete(setItems) }
  }, [])
  const ids = new Set(items.map(i => i.id))
  return {
    items,
    has: id => ids.has(lc(id)),
    toggle: (id, name) => invoke('wishlist:toggle', { id: lc(id), name }).then(next => {
      publish(next)
      const on = next.some(i => i.id === lc(id))
      toast(on ? `${name} added to your wishlist` : `${name} removed from your wishlist`, on ? 'good' : 'neutral')
    }).catch(e => toast.error(e.message || 'Could not update your wishlist')),
  }
}

// heart in the corner of a skin tile
export function WishButton({ id, name, className }) {
  const { has, toggle } = useWishlist()
  if (!id) return null
  const on = has(id)
  const label = on ? 'Remove from wishlist' : 'Add to wishlist'
  return (
    <button type='button' aria-label={label} title={label} aria-pressed={on}
      onClick={e => { e.stopPropagation(); toggle(id, name) }}
      className={cx('w-8 h-8 rounded-full glass flex items-center justify-center transition-[opacity,color,transform] duration-200 active:scale-90',
        on ? 'text-bad opacity-100' : 'text-muted hover:text-text', className)}>
      <FiHeart size={13} fill={on ? 'currentColor' : 'none'} />
    </button>
  )
}
