import { DOT_GREEN as GREEN } from './shared'

// Vector icons of the band, as SVG markup strings: pure, no `$`. One family: 16 grid, 1.5 stroke,
// round caps, the unfilled part of a gauge at 28%. The markup is drawn as an isolated image, so it cannot
// inherit the text colour: a colour is either given, or taken from the system scheme (light/dark).

const f2 = (x: number) => x.toFixed(2)
const pt = (r: number, deg: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180
  return [8 + r * Math.cos(a), 8 + r * Math.sin(a)]
}
const arc = (r: number, a0: number, a1: number) => {
  const [p, q] = [pt(r, a0), pt(r, a1)]
  return `M${f2(p[0])} ${f2(p[1])}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${f2(q[0])} ${f2(q[1])}`
}

// Without a colour the strokes follow the system scheme; with one (the alert colours) they are that colour
const STYLE = '<style>svg{color:#2a2a2a}@media (prefers-color-scheme:dark){svg{color:#e8e8e8}}</style>'
const wrap = (body: string, color?: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16" width="16" height="16" fill="none" stroke="${color ?? 'currentColor'}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">${color ? '' : STYLE}${body}</svg>`
const DIM = 'opacity=".28"'

const FIVE_STEPS = 16

// 5-hour limit: a three-quarter arc with the gap at the bottom, filled clockwise in 16 steps
export function fiveIcon(percent: number, color?: string) {
  const a0 = -135
  const span = 270
  const n = Math.min(FIVE_STEPS, Math.max(0, Math.round((percent / 100) * FIVE_STEPS)))
  const fill = n === 0 ? '' : `<path d="${arc(6, a0, a0 + Math.max((span * n) / FIVE_STEPS, 1))}"/>`
  return wrap(`<path d="${arc(6, a0, a0 + span)}" ${DIM}/>${fill}`, color)
}

const clamp = (x: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, x))
const F = 'fill="currentColor" stroke="none"'

// A ring of equal segments (gaps between them) that drain or fill by a fraction of the whole: whole segments
// bright, the one in between partly, the rest dim. `done` is in segments (0..count).
function segments(count: number, done: number, color?: string, lastGreen = false) {
  const step = 360 / count
  const gap = count > 5 ? 9 : 8
  let s = ''
  for (let i = 0; i < count; i++) {
    const a0 = i * step + gap
    const a1 = (i + 1) * step - gap
    s += `<path d="${arc(6, a0, a1)}" ${DIM}/>`
    const f = clamp(done - i, 0, 1)
    // the last segment left (the final hour) is green: the reset is near
    const tint = lastGreen && i === 0 && done <= 1 ? ` stroke="${GREEN}"` : ''
    if (f > 0) s += `<path d="${arc(6, a0, a0 + Math.max((a1 - a0) * f, 1))}"${tint}/>`
  }
  return wrap(s, color)
}

// Time to the 5-hour reset: five segments, one per hour, the nearest hour drains in minutes
export const resetIcon = (msLeft: number) => segments(5, clamp(msLeft / 3_600_000, 0, 5), undefined, true)
// Weekly limit: seven segments, one per day of the week, filled by the percent
// A badge in the top right corner marks the subscription renewal: a filled dot in a pale colour. The ring of
// segments is cut open around it so it reads clearly.
export const weekIcon = (percent: number, badge?: { color: string } | null, color?: string) => {
  const svg = segments(7, clamp(percent / 100, 0, 1) * 7, color)
  if (!badge) return svg
  const dot = `<circle cx="12.8" cy="3.2" r="2.3" fill="${badge.color}" stroke="none"/>`
  const hole = '<defs><mask id="h"><rect width="16" height="16" fill="white"/><circle cx="12.8" cy="3.2" r="3.9" fill="black"/></mask></defs><g mask="url(#h)">'
  const open = svg.indexOf('>') + 1
  return `${svg.slice(0, open)}${hole}${svg.slice(open, svg.lastIndexOf('</svg>'))}</g>${dot}</svg>`
}

// Context: a speedometer: a half-ring over the hub, the filled part from the left, a needle at the fill
export function ctxIcon(percent: number | null, color?: string) {
  const f = percent === null ? 0 : clamp(percent / 100, 0, 1)
  const ink = color ?? 'currentColor'
  const at = (r: number, fill: number): [number, number] => {
    const a = Math.PI * (1 - fill)
    return [8 + r * Math.cos(a), 11.5 - r * Math.sin(a)]
  }
  const track = `<path d="M1 11.5A7 7 0 0 1 15 11.5" ${DIM}/>`
  const [ex, ey] = at(7, f)
  const fill = f > 0 ? `<path d="M1 11.5A7 7 0 0 1 ${f2(ex)} ${f2(ey)}"/>` : ''
  const [nx, ny] = at(4, f)
  const needle = percent === null ? '' : `<path d="M8 11.5L${f2(nx)} ${f2(ny)}" stroke-width="1.3"/>`
  const hub = `<circle cx="8" cy="11.5" r="1.5" fill="${ink}" stroke="none"/>`
  return wrap(track + fill + needle + hub, color)
}

// Cache read and write are a pair of boxes that swap the accent: read has a bright wall and a grey core,
// write (below) a faint wall and a bright core
export const readIcon = () =>
  wrap(`<rect x="2.5" y="2.5" width="11" height="11" rx="3.2"/><rect x="5.5" y="5.5" width="5" height="5" rx="1.4" ${F} opacity=".38"/>`)

// Cache timer: a six-armed snowflake, one arm per ten minutes, the arms go dark as the cache cools
export function cacheIcon(msLeft: number | null, color?: string) {
  const n = msLeft === null ? 0 : clamp(Math.ceil(msLeft / 600_000), 0, 6)
  let s = ''
  for (let i = 0; i < 6; i++) {
    const [x, y] = pt(6, i * 60)
    const [x0, y0] = pt(1.2, i * 60)
    s += `<path d="M${f2(x0)} ${f2(y0)}L${f2(x)} ${f2(y)}"${i < n ? '' : ` ${DIM}`}/>`
  }
  return wrap(s, color)
}

// The "short" toggle: two lines, the second one short; on, it ends in a bright dot.
export const shortIcon = (on: boolean) =>
  on
    ? wrap(`<path d="M3 5.5h10M3 10.5h4.5"/><circle cx="11.5" cy="10.5" r="1.15" ${F}/>`)
    : wrap(`<g ${DIM}><path d="M3 5.5h10M3 10.5h7"/></g>`)

// Turns of the chat, and the images in it: a stack of three plates, the plates pile up as the chat goes on
export const turnsIcon = () =>
  wrap(`<rect x="3" y="3" width="10" height="3" rx="1.5" ${DIM}/><rect x="3" y="6.5" width="10" height="3" rx="1.5" opacity=".6"/><rect x="3" y="10" width="10" height="3" rx="1.5"/>`)

// Subagents: dots on an orbit, one per agent (up to four)
export function agentsIcon(n: number) {
  const k = clamp(n, 0, 4)
  let s = `<circle cx="8" cy="8" r="6" ${DIM}/><circle cx="8" cy="8" r="1.4" ${F}/>`
  for (let i = 0; i < k; i++) {
    const [x, y] = pt(6, i * (360 / k) + 30)
    s += `<circle cx="${f2(x)}" cy="${f2(y)}" r="1.45" ${F}/>`
  }
  return wrap(s)
}

// New input and output tokens: a vertical track with a dot, at the bottom for input and at the top for output
export const inputIcon = () => wrap(`<path d="M8 2.5v11" ${DIM}/><circle cx="8" cy="11.5" r="2" ${F}/>`)
export const outputIcon = () => wrap(`<path d="M8 2.5v11" ${DIM}/><circle cx="8" cy="4.5" r="2" ${F}/>`)

// Requests of the last turn: the stack of the turns counter turned upside down (the bright plate on top)
export const stepsIcon = () =>
  wrap(`<rect x="3" y="3" width="10" height="3" rx="1.5"/><rect x="3" y="6.5" width="10" height="3" rx="1.5" opacity=".6"/><rect x="3" y="10" width="10" height="3" rx="1.5" ${DIM}/>`)

// Another chat: a square over a square, in the colour of that chat's cache
export const chatIcon = (color: string) =>
  wrap('<path d="M5.5 2.5h5a3 3 0 0 1 3 3v5" opacity=".5"/><rect x="2.5" y="5.5" width="8" height="8" rx="2.5"/>', color)

// Cache write: a small bright square inside a faint box
export const writeIcon = () =>
  wrap(`<rect x="2.5" y="2.5" width="11" height="11" rx="3.2" ${DIM}/><rect x="5.5" y="5.5" width="5" height="5" rx="1.4" ${F}/>`)

