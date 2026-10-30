// Pure helpers of the band: formats, counting and the fit of the two groups.
// Nothing here touches the engine, so the tests can run it as it is.

export const NB = ' '
export const GAP = 1

export type Item = { key: string; text: string }

export const fmt = (n: number) =>
  n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${n}`

// Reset countdown, bare number: whole hours (1-5), then 5-minute steps in the last hour (55 down to 10),
// and exact minutes (10, 9, ... 1, 0) in the last ten.
// Rounded up, so the real reset can come earlier than the number says.
export const resetLeft = (ms: number) => {
  const m = Math.max(0, Math.ceil(ms / 60000))
  if (m >= 60) return `${Math.floor(m / 60)}`
  if (m <= 10) return `${m}`
  const step = Math.ceil(m / 5) * 5
  return step >= 60 ? '1' : `${step}`
}

// Minutes until the cache cools: 10-59, '<10' for the last ten minutes, '—' once it is cold
export const cacheLeft = (ms: number) => {
  if (ms <= 0) return '—'
  const m = Math.ceil(ms / 60000)
  return m < 10 ? '<10' : `${Math.min(59, m)}`
}

// Circle that fills as the value grows: empty, quarter, half, three quarters, full
const PIE = ['○', '◔', '◑', '◕', '●']
export const pie = (p: number) => PIE[Math.min(4, Math.max(0, Math.round(p / 25)))] ?? '○'

// Width in cells of a row of items with the gap between them
export const rowWidth = (items: { text: string }[]) =>
  items.reduce((n, it) => n + [...it.text].length, 0) + Math.max(0, items.length - 1) * GAP

// An entry of the band: icon and value, a dash while there is no value
export const slot = (icon: string, value: string | number | null | undefined) => `${icon}${NB}${value ?? '—'}`

// Messages in the chat, and after a slash the images in it once there are any: 34 or 34/1
export const chatCounts = (turns: number | null, images: number | null) =>
  images ? `${turns ?? '—'}/${images}` : turns === null ? null : `${turns}`

// What goes first when the band is narrow (the user's order, 0.48). What is not here (the limits, the dots) never goes.
export const DROP = ['fresh', 'steps', 'output', 'written', 'read', 'turns', 'short', 'cache', 'agents', 'ctx']

// A separator is a thin line between groups; it takes SEP_W cells and goes with its neighbours
export const SEP_W = 2
export const isSep = (it: { key: string }) => it.key.startsWith('sep')

// Separators never stand first, last or twice in a row
export function tidySeps<T extends { key: string }>(items: T[]): T[] {
  const out: T[] = []
  for (const it of items) {
    const last = out[out.length - 1]
    if (isSep(it) && (last === undefined || isSep(last))) continue
    out.push(it)
  }
  const end = out[out.length - 1]
  if (end && isSep(end)) out.pop()
  return out
}

// Fits three groups into a band `width` wide: left and right of one width (the wider of the two), so the middle
// stands in the true centre, a gap on each side of it. Entries leave in DROP order until it fits.
// With `loose`, a band that is too narrow for that gives up the true centre before it gives up an entry: the
// sides take what they need each and the middle stands as near the centre as they allow.
export function fitRow<T extends Item>(left: T[], mid: T[], right: T[], width: number, loose = false) {
  const room = (l: T[], m: T[], r: T[]) => rowWidth(m) + 2 * Math.max(rowWidth(l), rowWidth(r)) + 2 * GAP <= width
  const roomLoose = (l: T[], m: T[], r: T[]) => rowWidth(l) + rowWidth(m) + rowWidth(r) + 4 * GAP <= width
  let l = tidySeps(left)
  let m = tidySeps(mid)
  let r = tidySeps(right)
  for (const k of DROP) {
    if (room(l, m, r) || (loose && roomLoose(l, m, r))) break
    l = tidySeps(l.filter(it => it.key !== k))
    m = tidySeps(m.filter(it => it.key !== k))
    r = tidySeps(r.filter(it => it.key !== k))
  }
  const centred = room(l, m, r)
  const fits = centred || (loose && roomLoose(l, m, r))
  const sideW = fits ? Math.floor((width - rowWidth(m)) / 2) : Math.floor(width / 2)
  if (centred || !fits) return { left: l, mid: m, right: r, fits, sideW, sideL: sideW, sideR: sideW }
  // The left side takes the least it needs (or its half of the centre if that is more), the right the rest
  const needL = rowWidth(l) + GAP
  const needR = rowWidth(r) + GAP
  const sideL = Math.max(needL, Math.min(sideW, width - rowWidth(m) - needR))
  return { left: l, mid: m, right: r, fits, sideW, sideL, sideR: width - rowWidth(m) - sideL }
}
