// languages
import { useEffect, useState } from 'react'

export const LANGS = [
  ['en', 'English'], ['zh', '简体中文'], ['ru', 'Русский'], ['hi', 'हिन्दी'], ['ja', '日本語'],
  ['ko', '한국어'], ['fr', 'Français'], ['es', 'Español'], ['de', 'Deutsch'], ['pt', 'Português'],
]
const KEY = 'spectre-lang'
const ATTRS = ['title', 'placeholder', 'aria-label']

let lang = 'en'
let dict = null // Map of English label -> label in the current language; null for English
let observer = null
const texts = new WeakMap() // text node -> { src, out }
const attrs = new WeakMap() // element -> { [attr]: { src, out } }
const subs = new Set()

// translates the label inside `s`, keeping the spaces around it. null when the label isn't in the table
function tr(s) {
  const k = s.trim()
  if (!k || !dict) return null
  const t = dict.get(k)
  return t ? s.replace(k, t) : null
}

// one value (a text node's text or an attribute)
function next(cur, st) {
  const src = st && cur === st.out ? st.src : cur
  const t = tr(src)
  return t == null ? (src === cur ? null : { src, out: src, plain: true }) : { src, out: t }
}

function doText(n) {
  const p = n.parentElement
  if (!p || p.closest('[translate="no"], script, style, textarea, code')) return
  const cur = n.nodeValue
  const r = next(cur, texts.get(n))
  if (!r) { texts.delete(n); return }
  if (r.plain) texts.delete(n); else texts.set(n, r)
  if (r.out !== cur) n.nodeValue = r.out
}

function doAttr(el, a) {
  const cur = el.getAttribute(a)
  if (cur == null || el.closest('[translate="no"]')) return
  const bag = attrs.get(el) || {}
  const r = next(cur, bag[a])
  if (!r || r.plain) delete bag[a]; else bag[a] = r
  attrs.set(el, bag)
  if (r && r.out !== cur) el.setAttribute(a, r.out)
}

function walk(root) {
  if (root.nodeType === Node.TEXT_NODE) return doText(root)
  if (root.nodeType !== Node.ELEMENT_NODE) return
  const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
  for (let n = w.nextNode(); n; n = w.nextNode()) doText(n)
  const sel = ATTRS.map(a => `[${a}]`).join(',')
  const els = [...root.querySelectorAll(sel)]
  if (root.matches(sel)) els.push(root)
  els.forEach(el => ATTRS.forEach(a => doAttr(el, a)))
}

function watch() {
  if (observer) return
  observer = new MutationObserver(muts => {
    for (const m of muts) {
      if (m.type === 'characterData') doText(m.target)
      else if (m.type === 'attributes') doAttr(m.target, m.attributeName)
      else m.addedNodes.forEach(walk)
    }
  })
  observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS })
}

export const getLang = () => lang

export async function setLang(code, save = true) {
  if (!LANGS.some(l => l[0] === code)) code = 'en'
  if (save) { try { localStorage.setItem(KEY, code) } catch { /* private mode */ } }
  if (code === 'en') dict = null
  else {
    const { default: table } = await import('../locales/table.js')
    const col = table.cols.indexOf(code)
    dict = new Map(table.rows.filter(r => r[col]).map(r => [r[0], r[col]]))
  }
  lang = code
  document.documentElement.lang = code
  if (code !== 'en') watch()
  if (observer) walk(document.body)
  subs.forEach(f => f(code))
}

// called once at startup, before the first render
export function initLang() {
  let saved = null
  try { saved = localStorage.getItem(KEY) } catch { /* private mode */ }
  if (saved && saved !== 'en') setLang(saved, false).catch(() => { })
}

export function useLang() {
  const [code, setCode] = useState(lang)
  useEffect(() => { subs.add(setCode); setCode(lang); return () => { subs.delete(setCode) } }, [])
  return [code, setLang]
}
