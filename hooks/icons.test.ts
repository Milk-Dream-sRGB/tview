import { test, expect } from 'claude-code/testing'

import { agentsIcon, cacheIcon, readIcon, ctxIcon, fiveIcon, resetIcon, shortIcon, weekIcon, writeIcon } from './icons'

const count = (s: string, re: RegExp) => (s.match(re) ?? []).length

test('icons: every icon is one svg document with a 16 grid', () => {
  for (const s of [fiveIcon(50), resetIcon(3_600_000), ctxIcon(40), ctxIcon(null), cacheIcon(1_800_000), cacheIcon(null), shortIcon(true), shortIcon(false), writeIcon(), readIcon(), agentsIcon(3), weekIcon(70)]) {
    expect(s.startsWith('<svg')).toBe(true)
    expect(s.endsWith('</svg>')).toBe(true)
    expect(s).toContain('viewBox="0 0 16 16"')
    expect(s).not.toContain('NaN')
  }
})

test('icons: an alert colour replaces the scheme colour', () => {
  expect(fiveIcon(90, '#e6d98a')).toContain('stroke="#e6d98a"')
  expect(fiveIcon(10)).toContain('currentColor')
})

test('icons: the cache snowflake arms follow ten minutes each, cold is all dim', () => {
  const lit = (s: string) => count(s, /<path/g) - count(s, /opacity=/g)
  expect(lit(cacheIcon(60 * 60_000))).toBe(6)
  expect(lit(cacheIcon(35 * 60_000))).toBe(4)
  expect(lit(cacheIcon(10 * 60_000))).toBe(1)
  expect(lit(cacheIcon(0))).toBe(0)
  expect(lit(cacheIcon(null))).toBe(0)
})

test('icons: the segment rings drain and fill', () => {
  // five segments: whole hours bright, the nearest one partly
  const bright = (s: string) => count(s, /<path d="M[^"]*"\/>/g)
  expect(bright(resetIcon(5 * 3_600_000))).toBe(5)
  expect(bright(resetIcon(2.5 * 3_600_000))).toBe(3)
  expect(bright(resetIcon(0))).toBe(0)
  expect(bright(weekIcon(100))).toBe(7)
  expect(bright(weekIcon(0))).toBe(0)
})

test('icons: agents show one dot each, at most four', () => {
  const dots = (s: string) => count(s, /r="1.45"/g)
  expect([0, 1, 3, 9].map(n => dots(agentsIcon(n)))).toEqual([0, 1, 3, 4])
})

test('weekIcon: the renewal dot is only drawn when asked for, in its colour', () => {
  expect(weekIcon(50)).not.toContain('<circle')
  expect(weekIcon(50, { color: '#e6d98a' })).toContain('fill="#e6d98a"')
    expect(weekIcon(50, { color: '#e6d98a' })).toContain('<mask')
})
