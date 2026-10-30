import type { ClientElements, ElementConstructor, SvgProps } from 'claude-code'

import type { Limit, Tokens } from '../types'
import { CACHE_TTL_MS, DOT_GREEN, PALE_ORANGE, PALE_RED, PALE_YELLOW, renewBadge } from './shared'
import { agentsIcon, writeIcon, cacheIcon, chatIcon, ctxIcon, fiveIcon, inputIcon, outputIcon, readIcon, resetIcon, shortIcon, stepsIcon, turnsIcon, weekIcon } from './icons'
import { NB, GAP, SEP_W, isSep, cacheLeft as cacheText, fitRow, fmt, chatCounts, pie, resetLeft, slot } from './layout'

// The band above the prompt as a tree: pure, it takes plain data and the three things a press does.
// Nothing here touches the engine; the hooks in register.tsx read the state and pass it in.

export type BandInput = {
  bodyColumns: number
  now: number
  five: Limit | null
  week: Limit | null
  ctx: { percent: number; tokens?: number } | null
  tokens: Tokens | null
  armed: boolean
  images: number | null
  turns: number | null
  agents: number
  // Days to the subscription renewal, null while the day is not set
  renewDays: number | null
  others: { at: number; link: string }[]
}
// `Svg` exists on the desktop only; without it the glyph in `text` is drawn
type BandUi = ClientElements & { Svg?: ElementConstructor<SvgProps> }
type BandActions = { toggleShort: () => void; open: (link: string) => void }

// 5-hour limit: green up to 5% (a fresh window), the usual colour from 6 to 95, red from 96
const alert = (p: number) => (Math.round(p) >= 96 ? PALE_RED : Math.round(p) <= 5 ? DOT_GREEN : undefined)

// The context icon turns pale orange from 200k tokens and red from 400k
const CTX_ORANGE = 200_000
const CTX_RED = 400_000
const ctxColor = (tokens: number | undefined) => (tokens === undefined ? undefined : tokens >= CTX_RED ? PALE_RED : tokens >= CTX_ORANGE ? PALE_ORANGE : undefined)

// Same borders as the cache timer's: green above 15 minutes, yellow from 5 to 15, red under 5
const dotColor = (leftMs: number) => (leftMs < 5 * 60_000 ? PALE_RED : leftMs < 15 * 60_000 ? PALE_YELLOW : DOT_GREEN)

// The token numbers take a fixed width (up to 4 cells: 999, 12k, 999k, 1.2M), so a digit more or less does not
// change the width of the right group and does not tip the fit: otherwise these icons, the first to be dropped
// on a tight band, came and went with every turn
const TOKEN_W = 4

// New input (tokens outside the cache) is normally 1-3 per request, up to a few dozen a turn; it shows only from
// this many in a turn (the user's choice: 50 is already odd behaviour). Raise it if it turns up too often.
const FRESH_SHOWN_FROM = 50

// Margin against a band that is narrower than it reports
const MARGIN = 2


// Items that are shown quieter: a mid grey that reads on the light and the dark panel alike
const DIM_TEXT = '#8e8e8e'
const dimmed = (svg: string) => svg.replace('<svg ', '<svg opacity=".45" ')

// The weekly number shows from this fill (0: always, the user watches the week closely, 0.49.2)
const WEEK_NUMBER_FROM = 0

// A band item. `svg` is the vector icon (desktop), `text` the glyph row drawn when there is no `Svg`.
// With an icon the item is `value` after an icon box of ICON cells; both widths are counted in cells.
type Item = { key: string; text: string; color?: string; svg?: string; value?: string; alt?: string; link?: string; dim?: boolean; pad?: boolean }
const DOT_SLOTS = 2
// 0.54.10: 4 cells (was 3): on the user's screen a 3-cell box was no wider than the 16 px icon and the number stood against it
const ICON = 4
// The icon box in cells: an icon with a value has a gap before it, an icon alone needs none
// The two limits (round icons with a percent) stand a cell closer to their number: the user found the gap too big (0.54.13)
const TIGHT = new Set(['five', 'week'])
const boxOf = (it: { key?: string; value?: string }) => (it.value && !TIGHT.has(it.key ?? '') ? ICON : ICON - 1)
// A blank that survives a trim (a non-breaking space does not), so a Button over an icon keeps its width
const BLANK = '\u2800'
const withIcon = (key: string, glyphText: string, svg: string, value: string | undefined, alt: string, on: boolean, color?: string, dim?: boolean): Item =>
  on
    ? { key, text: `${NB.repeat(boxOf({ key, value }))}${value ?? ''}`, color, svg: dim ? dimmed(svg) : svg, value, alt, dim }
    : { key, text: glyphText, color, dim }
// A token item: the number is drawn as long as it is (even gaps), but the item's `text` keeps TOKEN_W cells
// in reserve, so the fit does not change with the digits (0.54.8: the padding used to be drawn, and the gaps
// between the numbers came out uneven)
const tokenItem = (key: string, glyphText: string, svg: string, n: number | undefined, alt: string, on: boolean): Item => {
  const value = n === undefined ? '—' : fmt(n)
  const it = withIcon(key, glyphText, svg, value, alt, on)
  return on ? { ...it, text: it.text + NB.repeat(Math.max(0, TOKEN_W - [...value].length)) } : it
}
// An empty gap between groups (the user dropped the drawn lines)
const sep = (key: string): Item => ({ key, text: NB.repeat(SEP_W) })

// Everything the band decides before drawing: what is on each side and what of it fits.
// `svg` tells whether the surface draws vector icons; without them the glyphs are kept.
export function bandInfo(v: BandInput, svg = false) {
  const t = v.now
  const f = v.five
  const width = Math.max(20, v.bodyColumns - MARGIN)
  const fiveText = f ? `${Math.round(f.percent)}%` : undefined
  const resetMs = f?.resetsAt ? Date.parse(f.resetsAt) - t : null
  const w = v.week
  const weekPct = w ? Math.round(w.percent) : 0
  // The number comes only when the week is nearly spent
  const weekValue = w && weekPct >= WEEK_NUMBER_FROM ? `${weekPct}%` : undefined

  // Cache and context
  const c = v.ctx
  const tk = v.tokens
  const ctxValue = c === null ? undefined : c.tokens !== undefined ? fmt(c.tokens) : `${c.percent}%`
  const cacheMs = tk ? CACHE_TTL_MS - (t - tk.at) : null
  // The last turn's numbers describe a cache that has cooled: they show a dash until the next turn
  const lt = tk && !(cacheMs !== null && cacheMs <= 0) ? tk : null
  const dots = v.others.filter(o => CACHE_TTL_MS - (t - o.at) > 0)

  // Left: the 5-hour limit and its reset, a gap, the short button
  const left: Item[] = [
    ...(f && fiveText ? [withIcon('five', `${pie(f.percent)}${NB}${fiveText}`, fiveIcon(f.percent, alert(f.percent)), fiveText, '5-hour limit', svg, alert(f.percent))] : []),
    ...(resetMs !== null ? [withIcon('reset', `↺${NB}${resetLeft(resetMs)}`, resetIcon(resetMs), undefined, 'Time to the 5-hour reset', svg)] : []),
    sep('sep1'),
    withIcon('short', `${v.armed ? '✦' : '✧'}${NB}short`, shortIcon(v.armed), undefined, v.armed ? 'Short answer: on' : 'Short answer: off', svg),
  ]

  // Middle, in the true centre: context, turns, the share of the limit of an expensive turn, the cache timer, agents
  const mid: Item[] = [
    withIcon('ctx', slot(c === null ? '○' : pie(c.percent), ctxValue ?? null), ctxIcon(c === null ? null : c.percent, ctxColor(c?.tokens)), ctxValue ?? '—', 'Context', svg),
    withIcon('turns', slot('≡', chatCounts(v.turns, v.images)), turnsIcon(), chatCounts(v.turns, v.images) ?? undefined, 'Turns and images', svg),
    withIcon('cache', slot('△', tk ? cacheText(cacheMs as number) : null), cacheIcon(cacheMs, cacheMs !== null && cacheMs > 0 ? (cacheMs < 5 * 60_000 ? PALE_RED : cacheMs < 15 * 60_000 ? PALE_YELLOW : undefined) : undefined), undefined, 'Time until the cache cools', svg),
    ...(v.agents > 0 ? [withIcon('agents', slot('◈', String(v.agents)), agentsIcon(v.agents), String(v.agents), 'Running subagents', svg)] : []),
  ]

  // Right: the last turn's tokens, a gap, the other chats' dots (two places always kept), a gap, the weekly limit
  const right: Item[] = [
    tokenItem('read', slot('◉', lt ? fmt(lt.read) : null), readIcon(), lt?.read, 'Tokens read from the cache', svg),
    tokenItem('written', slot('✎', lt ? fmt(lt.written) : null), writeIcon(), lt?.written, 'Tokens written to the cache', svg),
    tokenItem('steps', slot('⋯', lt?.steps === undefined ? null : fmt(lt.steps)), stepsIcon(), lt?.steps, 'Requests in the last turn', svg),
    // New input is a few tokens a request, so only an unusually large one is worth a place (the cache missed)
    ...(lt && lt.fresh >= FRESH_SHOWN_FROM ? [tokenItem('fresh', slot('↑', fmt(lt.fresh)), inputIcon(), lt.fresh, 'New input tokens', svg)] : []),
    tokenItem('output', slot('↓', lt ? fmt(lt.output) : null), outputIcon(), lt?.output, 'Generated tokens', svg),
    sep('sep2'),
    // Room for two dots is always kept, so the rest does not jump when a chat's dot comes or goes
    ...Array.from({ length: Math.max(DOT_SLOTS, dots.length) }, (_, i): Item => {
      const o = dots[i]
      if (!o) return { key: `pad${i}`, text: NB.repeat(svg ? SEP_W : 1), pad: true }
      const color = dotColor(CACHE_TTL_MS - (t - o.at))
      return { ...withIcon(`${i}`, '●', chatIcon(color), undefined, 'Another chat', svg, color), link: o.link }
    }),
    sep('sep3'),
    ...(w ? [withIcon('week', `${pie(w.percent)}${weekValue ? NB + weekValue : ''}`, weekIcon(w.percent, renewBadge(v.renewDays)), weekValue, v.renewDays === null ? 'Weekly limit' : `Weekly limit; the subscription renews in ${v.renewDays} days`, svg)] : []),
  ]
  const row = fitRow(left, mid, right, width, true)

  return { width, left: row.left, middle: row.mid, right: row.right, fits: row.fits, sideL: row.sideL, sideR: row.sideR }
}

export function renderBand({ Box, Text, Button, Svg }: BandUi, v: BandInput, act: BandActions) {
  const { width, left, middle, right, fits, sideL, sideR } = bandInfo(v, Svg !== undefined)

  // The icon in a box of its own; with a value the text follows in the same row
  const icon = (it: Item) => (
    <Box key={it.key} columnGap={0}>
      <Box width={boxOf(it)} height={1} flexShrink={0}>{Svg && it.svg ? <Svg source={it.svg} alt={it.alt ?? ''} width={16} height={16} /> : null}</Box>
      {it.value ? <Text wrap="truncate" color={it.dim ? DIM_TEXT : it.color}>{it.value}</Text> : null}
    </Box>
  )
  // A pressable icon (short, the other chats' marks): the box is as wide as an icon box, and the icon and the Button
  // are both centred in it, so the native block under the pointer is centred on the icon whatever its own width.
  // The Button is absolute and comes after the icon, so it lies above it and takes the press over the icon too.
  const pressable = (it: Item, onPress: () => void) => (
    <Box key={it.key} width={boxOf(it)} height={1}>
      <Box position="absolute" top={0} left={0} right={0} height={1} justifyContent="center">
        {Svg && it.svg ? <Svg source={it.svg} alt={it.alt ?? ''} width={16} height={16} /> : null}
      </Box>
      <Box position="absolute" top={0} left={0} right={0} height={1} justifyContent="center">
        <Button key={it.key} plain label={BLANK} onPress={onPress} />
      </Box>
    </Box>
  )
  const plain = (it: Item) => (it.svg && Svg ? icon(it) : <Text key={it.key} wrap="truncate" color={it.dim ? DIM_TEXT : it.color}>{it.text}</Text>)
  const vector = (it: Item) => Boolean(it.svg && Svg)
  // Gaps and the free places for dots are empty boxes: spaces in a text could be trimmed
  const node = (it: Item) =>
    isSep(it) || it.pad ? <Box key={it.key} width={[...it.text].length} height={1} />
    : it.key === 'short' ? (vector(it) ? pressable(it, act.toggleShort) :<Button key="short" plain label={it.text} onPress={act.toggleShort} />)
    : it.link && vector(it) ? pressable({ ...it, key: `go${it.key}` }, () => act.open(it.link as string))
    : it.link
      ? (
        // The coloured dot is plain text; a transparent Button lies over it and takes the click
        <Box key={it.key} width={1} height={1}>
          <Text color={it.color}>{it.text}</Text>
          <Box position="absolute" top={0} left={0} width={1} height={1}>
            <Button key={`go${it.key}`} plain label={NB} onPress={() => act.open(it.link as string)} />
          </Box>
        </Box>
      )
      : plain(it)

  return (
    <Box width={width} height={1} marginLeft={MARGIN / 2}>
      <Box position="absolute" top={0} left={0} width={width} height={1}>
        <Box width={sideL} justifyContent="flex-start" columnGap={GAP}>
          {left.map(node)}
        </Box>
        <Box width={width - sideL - sideR} justifyContent="center" columnGap={GAP}>
          {fits && middle.map(node)}
        </Box>
        <Box width={sideR} justifyContent="flex-end" columnGap={GAP}>
          {right.map(node)}
        </Box>
      </Box>
    </Box>
  )
}
