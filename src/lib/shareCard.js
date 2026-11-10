// Share card: draws one match as a 1200x630 image (the size Discord shows inline) and puts it on the clipboard, so it
// can be pasted straight into a chat. If the clipboard refuses, the image is saved to Pictures\Spectre instead.
import { invoke } from './ipc'

const W = 1200, H = 630
const FONT = '"Inter Variable", "Inter", "Segoe UI", system-ui, sans-serif'
const TONE = { win: ['#3ddc84', 'VICTORY'], loss: ['#ff5c6c', 'DEFEAT'], draw: ['#f5b942', 'DRAW'] }

// Remote art needs CORS to be drawn and exported; a missing picture just leaves its spot empty.
const load = src => new Promise(done => {
  if (!src) return done(null)
  const img = new Image()
  img.crossOrigin = 'anonymous'
  img.onload = () => done(img)
  img.onerror = () => done(null)
  // The app has usually shown this picture already, and that cached copy was fetched without CORS, so asking for
  // the same address again is refused. A query string makes it a separate request that does carry the CORS header.
  img.src = /^https?:/.test(src) ? src + (src.includes('?') ? '&' : '?') + 'share=1' : src
})

function cover(ctx, img, x, y, w, h) {
  const r = Math.max(w / img.width, h / img.height)
  const sw = w / r, sh = h / r
  ctx.drawImage(img, (img.width - sw) / 2, (img.height - sh) / 2, sw, sh, x, y, w, h)
}

function rounded(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.roundRect(x, y, w, h, r)
}

// info: { result, score: 'us - them' | null, map, mode, agent, kda, kd, acs, hs, adr, rr, rankName, name, when }
// art: { splash, agentIcon, rankIcon, logo }
export async function drawMatchCard(info, art) {
  const [splash, agent, rank, logo] = await Promise.all([load(art.splash), load(art.agentIcon), load(art.rankIcon), load(art.logo)])
  await document.fonts?.ready
  const c = document.createElement('canvas')
  c.width = W; c.height = H
  const x = c.getContext('2d')
  const [tone, word] = TONE[info.result] || TONE.draw

  // Backdrop: the map, darkened towards the left so the text stays readable.
  x.fillStyle = '#0b0b12'
  x.fillRect(0, 0, W, H)
  if (splash) { x.globalAlpha = 0.85; cover(x, splash, 0, 0, W, H); x.globalAlpha = 1 }
  let g = x.createLinearGradient(0, 0, W, 0)
  g.addColorStop(0, 'rgba(8,8,14,0.96)'); g.addColorStop(0.55, 'rgba(8,8,14,0.78)'); g.addColorStop(1, 'rgba(8,8,14,0.35)')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  g = x.createLinearGradient(0, H * 0.45, 0, H)
  g.addColorStop(0, 'rgba(8,8,14,0)'); g.addColorStop(1, 'rgba(8,8,14,0.9)')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  // Result colour: a soft wash and a bar on the left edge.
  g = x.createRadialGradient(0, H / 2, 0, 0, H / 2, 620)
  g.addColorStop(0, tone + '40'); g.addColorStop(1, tone + '00')
  x.fillStyle = g; x.fillRect(0, 0, W, H)
  x.fillStyle = tone; rounded(x, 0, 70, 8, H - 140, 4); x.fill()

  x.textBaseline = 'alphabetic'
  // Header: wordmark on the left, mode and date on the right.
  if (logo) x.drawImage(logo, 64, 52, 40, 40)
  x.fillStyle = '#ffffff'; x.font = `700 26px ${FONT}`; x.fillText('SPECTRE', logo ? 116 : 64, 82)
  x.textAlign = 'right'; x.fillStyle = 'rgba(255,255,255,0.7)'; x.font = `500 22px ${FONT}`
  x.fillText([info.mode, info.when].filter(Boolean).join('  ·  '), W - 64, 82)
  x.textAlign = 'left'

  // Result, score and map.
  x.fillStyle = tone; x.font = `800 104px ${FONT}`; x.fillText(word, 60, 250)
  const wordW = x.measureText(word).width
  if (info.score) { x.fillStyle = '#ffffff'; x.font = `700 64px ${FONT}`; x.fillText(info.score, 60 + wordW + 36, 246) }
  x.fillStyle = 'rgba(255,255,255,0.85)'; x.font = `600 34px ${FONT}`; x.fillText(info.map || '', 64, 304)

  // Agent portrait and player.
  const ay = 356
  x.save(); rounded(x, 64, ay, 112, 112, 26); x.clip()
  x.fillStyle = 'rgba(255,255,255,0.08)'; x.fillRect(64, ay, 112, 112)
  if (agent) x.drawImage(agent, 64, ay, 112, 112)
  x.restore()
  x.strokeStyle = 'rgba(255,255,255,0.22)'; x.lineWidth = 2; rounded(x, 64, ay, 112, 112, 26); x.stroke()
  x.fillStyle = '#ffffff'; x.font = `700 38px ${FONT}`; x.fillText(info.name || info.agent || '', 200, ay + 50)
  x.fillStyle = 'rgba(255,255,255,0.65)'; x.font = `500 24px ${FONT}`
  x.fillText(info.name ? info.agent || '' : '', 200, ay + 88)

  // Rank and RR change on the right of the player line.
  if (info.rr != null || rank) {
    let rx = W - 64
    x.textAlign = 'right'
    if (info.rr != null) {
      x.fillStyle = info.rr > 0 ? '#3ddc84' : info.rr < 0 ? '#ff5c6c' : 'rgba(255,255,255,0.7)'
      x.font = `800 52px ${FONT}`
      const t = `${info.rr > 0 ? '+' : ''}${info.rr} RR`
      x.fillText(t, rx, ay + 62); rx -= x.measureText(t).width + 22
    }
    if (rank) x.drawImage(rank, rx - 84, ay + 6, 84, 84)
    if (info.rankName) { x.fillStyle = 'rgba(255,255,255,0.65)'; x.font = `500 22px ${FONT}`; x.fillText(info.rankName, W - 64, ay + 104) }
    x.textAlign = 'left'
  }

  // Stat strip.
  const stats = [['K / D / A', info.kda], ['K/D', info.kd], ['ACS', info.acs], ['HS', info.hs], ['ADR', info.adr]].filter(s => s[1] != null && s[1] !== '')
  const sy = 508, sw = (W - 128) / Math.max(stats.length, 1)
  x.fillStyle = 'rgba(255,255,255,0.07)'; rounded(x, 64, sy, W - 128, 86, 22); x.fill()
  x.strokeStyle = 'rgba(255,255,255,0.12)'; x.lineWidth = 1; rounded(x, 64, sy, W - 128, 86, 22); x.stroke()
  stats.forEach(([label, value], i) => {
    const cx = 64 + sw * i + 28
    x.fillStyle = '#ffffff'; x.font = `700 32px ${FONT}`; x.fillText(String(value), cx, sy + 44)
    x.fillStyle = 'rgba(255,255,255,0.55)'; x.font = `600 16px ${FONT}`; x.fillText(label.toUpperCase(), cx, sy + 70)
  })

  return new Promise((done, fail) => c.toBlob(b => (b ? done(b) : fail(new Error('Could not draw the card'))), 'image/png'))
}

const toBase64 = blob => new Promise((done, fail) => {
  const r = new FileReader()
  r.onload = () => done(String(r.result).split(',')[1])
  r.onerror = () => fail(new Error('Could not read the card'))
  r.readAsDataURL(blob)
})

// Copies the card to the clipboard. Returns 'copied', or 'saved' when it had to fall back to a file.
export async function shareCard(blob, fileName) {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })])
    return 'copied'
  } catch {
    await invoke('share:save', fileName, await toBase64(blob))
    return 'saved'
  }
}
