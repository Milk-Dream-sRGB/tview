import { test, expect } from 'claude-code/testing'

import { bandInfo, renderBand } from './view'
import type { BandInput } from './view'
import { PALE_ORANGE, PALE_RED, PALE_YELLOW, DOT_GREEN } from './shared'
import { all, button, buttons, fakeUi, shown, textOf } from './tree'

const T = 1_000_000_000_000
const HOUR = 3_600_000
const MIN = 60_000

const input = (over: Partial<BandInput> = {}): BandInput => ({
  bodyColumns: 120,
  now: T,
  five: { percent: 25, resetsAt: new Date(T + 2 * HOUR).toISOString() },
  week: { percent: 62 },
  ctx: { percent: 11, tokens: 106_000 },
  tokens: { read: 825_000, written: 10_000, fresh: 4, output: 5_000, at: T - 10 * MIN, steps: 17 },
  armed: false,
  images: 19,
  turns: 68,
  agents: 0,
  renewDays: null,
  others: [],
  ...over,
})
const calls: string[] = []
const acts = { toggleShort: () => void calls.push('short'), open: (l: string) => void calls.push(`open ${l}`), refresh: () => void calls.push('refresh') }
const draw = (over: Partial<BandInput> = {}) => renderBand(fakeUi, input(over), acts)

test('band: every item of a roomy band is drawn with its value', () => {
  const texts = shown(draw())
  for (const want of ['◔ 25%', '↺ 2', '○ 106k', '⋯ 17', '◉ 825k', '✎ 10k', '↓ 5k', '△ 50', '◑ 62%']) {
    expect(texts).toContain(want.replace(/ /g, ' '))
  }
  expect(buttons(draw()).map(b => b.props.key)).toEqual(['five', 'short', 'week'])
  expect(texts).toContain('≡ 68/19')
})

test('band: new input shows only when it is unusually large, requests of the turn always show', () => {
  const plain = (s: string | undefined) => s?.replace(/ /g, ' ')
  const found = (prefix: string, over: Partial<BandInput> = {}) => plain(shown(draw(over)).find(t => t.startsWith(prefix)))
  const tk = (fresh: number, steps?: number) => ({ tokens: { read: 1, written: 1, fresh, output: 1, at: T - MIN, steps } })
  expect(found('↑')).toBeUndefined()
  expect(found('↑', tk(49, 3))).toBeUndefined()
  expect(found('↑', tk(50, 3))).toBe('↑ 50')
  expect(found('↑', tk(12_400, 3))).toBe('↑ 12k')
  // a record saved before the count existed shows a dash, not a wrong number
  expect(found('⋯', tk(4))).toBe('⋯ —')
  expect(found('⋯', tk(4, 1))).toBe('⋯ 1')
})

test('band: pressing a limit refreshes the limits', () => {
  calls.length = 0
  ;(button(draw(), 'five')?.props.onPress as () => void)()
  ;(button(draw(), 'week')?.props.onPress as () => void)()
  expect(calls).toEqual(['refresh', 'refresh'])
})

test('band: the short button shows its state, and pressing runs the actions', () => {
  expect(button(draw(), 'short')?.props.label).toBe('✧ short')
  expect(button(draw({ armed: true }), 'short')?.props.label).toBe('✦ short')
  calls.length = 0
  ;(button(draw(), 'short')?.props.onPress as () => void)()
  expect(calls).toEqual(['short'])
})

test('band: images only show after the slash once there are any, an unknown count is a dash', () => {
  expect(shown(draw({ images: 0, turns: 7 }))).toContain('≡ 7')
  expect(shown(draw({ images: null, turns: null }))).toContain('≡ —')
})

test('band: the 5h percent is green up to 5, plain from 6 to 95, red from 96', () => {
  const colorOf = (p: number) => all(draw({ five: { percent: p } })).find(n => n.type === 'Text' && /^[○◔◑◕●]/.test(textOf(n)))?.props.color
  expect(colorOf(0)).toBe(DOT_GREEN)
  expect(colorOf(5)).toBe(DOT_GREEN)
  expect(colorOf(6)).toBeUndefined()
  expect(colorOf(95)).toBeUndefined()
  expect(colorOf(96)).toBe(PALE_RED)
})

test('band: a narrow band drops middle items whole, never cuts with an ellipsis, keeps both limits', () => {
  let previous = Infinity
  for (const columns of [120, 90, 70, 60, 50, 44, 36, 30, 24, 20]) {
    const texts = shown(draw({ bodyColumns: columns }))
    expect(texts.some(t => t.includes('…'))).toBe(false)
    expect(texts).toContain('◔ 25%')
    expect(texts).toContain('◑ 62%')
    expect(texts.length <= previous).toBe(true)
    previous = texts.length
  }
})

test('band: the cache timer counts down, shows <10 at the end and a dash when cold', () => {
  const at = (ago: number) => shown(draw({ tokens: { read: 1, written: 1, fresh: 1, output: 1, at: T - ago } })).find(t => t.startsWith('△'))
  expect(at(10 * MIN)).toBe('△ 50')
  expect(at(55 * MIN)).toBe('△ <10')
  expect(at(61 * MIN)).toBe('△ —')
  expect(shown(draw({ tokens: null })).find(t => t.startsWith('△'))).toBe('△ —')
})

test('band: the agents marker only while some run', () => {
  expect(shown(draw()).some(t => t.startsWith('◈'))).toBe(false)
  expect(shown(draw({ agents: 2 }))).toContain('◈ 2')
})

test('band: the weekly number is always shown, and the weekly icon keeps the plain ink near the reset', () => {
  const weekTexts = (week: BandInput['week']) => shown(draw({ week })).filter(t => t.startsWith('◑') || t.startsWith('◕') || t.startsWith('●'))
  expect(weekTexts({ percent: 79 })).toEqual(['◕\u00a079%'])
  expect(weekTexts({ percent: 80 })).toEqual(['◕\u00a080%'])
  const Svg = (props: Record<string, unknown>) => ({ type: 'Svg', props })
  const weekSvg = (resetsIn: number) => String(all(renderBand({ ...(fakeUi as object), Svg } as never, input({ week: { percent: 50, resetsAt: new Date(T + resetsIn).toISOString() } }), acts)).filter(n => n.type === 'Svg').find(n => /^Weekly/.test(String(n.props.alt)))?.props.source)
  expect(weekSvg(30 * HOUR)).toContain('currentColor')
  expect(weekSvg(23 * HOUR)).not.toContain(DOT_GREEN)
})

test('band: there are no drawn separators, gaps are empty boxes', () => {
  const Svg = (props: Record<string, unknown>) => ({ type: 'Svg', props })
  const svgs = all(renderBand({ ...(fakeUi as object), Svg } as never, input(), acts)).filter(n => n.type === 'Svg')
  expect(svgs.some(n => /M8 2v12/.test(String(n.props.source)))).toBe(false)
})

test('band: no weekly limit, no weekly item', () => {
  expect(shown(draw({ week: null })).some(t => t.startsWith('◑'))).toBe(false)
})

test('band: dots of other chats, warm ones only, coloured by the cache timer, each one a button that opens its chat', () => {
  const link = (n: string) => `claude://claude.ai/epitaxy/local_${n}`
  const tree = draw({ others: [
    { at: T - 5 * MIN, link: link('a') },
    { at: T - 50 * MIN, link: link('b') },
    { at: T - 58 * MIN, link: link('c') },
    { at: T - 61 * MIN, link: link('cold') },
  ] })
  const dots = all(tree).filter(n => n.type === 'Text' && textOf(n) === '●')
  expect(dots.map(d => d.props.color)).toEqual([DOT_GREEN, PALE_YELLOW, PALE_RED])
  expect(buttons(tree).filter(b => String(b.props.key).startsWith('go')).length).toBe(3)
  calls.length = 0
  ;(button(tree, 'go1')?.props.onPress as () => void)()
  expect(calls).toEqual([`open ${link('b')}`])
})

test('band: dots stand left of the weekly limit', () => {
  const texts = shown(draw({ others: [{ at: T - 5 * MIN, link: 'claude://x' }] }))
  expect(texts.indexOf('●')).toBeLessThan(texts.indexOf('◑ 62%'))
})

test('band: nothing known yet, dashes instead of numbers and nothing broken', () => {
  const texts = shown(draw({ five: null, week: null, ctx: null, tokens: null, images: null, turns: null, others: [] }))
  expect(texts).toContain('○ —')
  expect(texts.some(t => t.startsWith('◔'))).toBe(false)
})

test('band: a margin of two cells against a band narrower than it reports, and never narrower than 20', () => {
  const root = (columns: number) => draw({ bodyColumns: columns }) as unknown as { props: { width: number; marginLeft: number; height: number } }
  expect(root(120).props.width).toBe(118)
  expect(root(120).props.marginLeft).toBe(1)
  expect(root(120).props.height).toBe(1)
  expect(root(10).props.width).toBe(20)
})

// With the desktop's Svg the icons are vector, the value follows, and short stays a button over their icon
test('band: with Svg the icons are drawn as vectors and the presses are kept', () => {
  const Svg = (props: Record<string, unknown>) => ({ type: 'Svg', props })
  const tree = renderBand({ ...(fakeUi as object), Svg } as never, input({ bodyColumns: 130, five: { percent: 25, resetsAt: new Date(T + 2 * HOUR).toISOString() } }), acts)
  const svgs = all(tree).filter(n => n.type === 'Svg')
  expect(svgs.length).toBe(11)
  for (const s of svgs) {
    expect(String(s.props.source)).toContain('<svg')
    expect(String(s.props.alt).length > 0 || /M8 2v12/.test(String(s.props.source))).toBe(true)
  }
  // the number is plain text now, the Button over it holds blanks only
  expect(shown(tree)).toContain('25%')
  expect(shown(tree)).toContain('62%')
  // the countdown and the cache timer have no digits any more
  expect(shown(tree).some(t => /^[↺△]/.test(t))).toBe(false)
  expect(buttons(tree).map(b => b.props.key)).toEqual(['five', 'short', 'week'])
  calls.length = 0
  ;(button(tree, 'short')?.props.onPress as () => void)()
  expect(calls).toEqual(['short'])
})

test('band: the context icon turns pale orange from 200k and red from 400k, the number stays plain', () => {
  const Svg = (props: Record<string, unknown>) => ({ type: 'Svg', props })
  const ctxSvg = (tokens: number) => String(all(renderBand({ ...(fakeUi as object), Svg } as never, input({ ctx: { percent: 20, tokens } }), acts)).filter(n => n.type === 'Svg').find(n => n.props.alt === 'Context')?.props.source)
  expect(ctxSvg(150_000)).toContain('currentColor')
  expect(ctxSvg(200_000)).toContain(PALE_ORANGE)
  expect(ctxSvg(399_000)).toContain(PALE_ORANGE)
  expect(ctxSvg(400_000)).toContain(PALE_RED)
})

test('band: the snowflake is not a button, and without Svg the cache stays a plain glyph', () => {
  expect(buttons(draw()).map(b => b.props.key)).toEqual(['five', 'short', 'week'])
})

test('band: the token icons do not come and go with the digits of the numbers', () => {
  // the same band width, token numbers of different lengths: the same items stay
  const keys = (read: number, fresh: number) => {
    const b = bandInfo(input({ bodyColumns: 100, tokens: { read, written: 10_000, fresh, output: 5_000, at: T - 10 * MIN } }), true)
    return [...b.left, ...b.middle, ...b.right].map(it => it.key).join()
  }
  for (const columns of [90, 100, 110, 120, 130, 140]) {
    const at = (read: number, fresh: number) => {
      const b = bandInfo(input({ bodyColumns: columns, tokens: { read, written: 10_000, fresh, output: 5_000, at: T - 10 * MIN } }), true)
      return [...b.left, ...b.middle, ...b.right].map(it => it.key).join()
    }
    expect(at(4, 4)).toBe(at(825_000, 49))
    expect(at(99_000, 1)).toBe(at(1_200_000, 48))
  }
  expect(keys(1, 1)).toBe(keys(999_000, 49))
})

test('band: token numbers are drawn as long as they are, no blanks after them (even gaps)', () => {
  const Svg = (props: Record<string, unknown>) => ({ type: 'Svg', props })
  const tree = renderBand({ ...(fakeUi as object), Svg } as never, input({ bodyColumns: 140, tokens: { read: 142_000, written: 8_000, fresh: 4, output: 3_000, at: T - 10 * MIN, steps: 2 } }), acts)
  const texts = all(tree).filter(n => n.type === 'Text').map(textOf)
  for (const want of ['142k', '8k', '2', '3k']) expect(texts).toContain(want)
})


test('band: once the cache has cooled the numbers of the last turn show a dash', () => {
  const dash = (tokens: BandInput['tokens']) => shown(draw({ tokens })).filter(t => /^[◉✎⋯↓]/.test(t)).map(t => t.replace(/ /g, ' '))
  expect(dash({ read: 825_000, written: 10_000, fresh: 4, output: 5_000, at: T - 61 * MIN, steps: 17 })).toEqual(['◉ —', '✎ —', '⋯ —', '↓ —'])
  expect(dash({ read: 825_000, written: 10_000, fresh: 4, output: 5_000, at: T - 10 * MIN, steps: 17 })).toEqual(['◉ 825k', '✎ 10k', '⋯ 17', '↓ 5k'])
})
