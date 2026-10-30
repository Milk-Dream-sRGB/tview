import { test, expect } from 'claude-code/testing'

import { DROP, GAP, NB, SEP_W, isSep, tidySeps, cacheLeft, fitRow, fmt, chatCounts, pie, resetLeft, rowWidth, slot } from './layout'

const MIN = 60_000

test('fmt: plain, thousands, millions', () => {
  expect(fmt(0)).toBe('0')
  expect(fmt(999)).toBe('999')
  expect(fmt(1000)).toBe('1k')
  expect(fmt(1499)).toBe('1k')
  expect(fmt(1500)).toBe('2k')
  expect(fmt(1_250_000)).toBe('1.3M')
})

test('resetLeft: hours above an hour, 5-minute steps, exact minutes in the last ten', () => {
  expect(resetLeft(5 * 60 * MIN)).toBe('5')
  expect(resetLeft(3 * 60 * MIN)).toBe('3')
  expect(resetLeft(119 * MIN)).toBe('1')
  expect(resetLeft(60 * MIN)).toBe('1')
  expect(resetLeft(58 * MIN)).toBe('1')
  expect(resetLeft(55 * MIN)).toBe('55')
  expect(resetLeft(51 * MIN)).toBe('55')
  expect(resetLeft(50 * MIN)).toBe('50')
  expect(resetLeft(16 * MIN)).toBe('20')
  expect(resetLeft(11 * MIN)).toBe('15')
  expect(resetLeft(10 * MIN + 1)).toBe('15')
  expect(resetLeft(10 * MIN)).toBe('10')
  expect(resetLeft(9 * MIN + 30_000)).toBe('10')
  expect(resetLeft(9 * MIN)).toBe('9')
  expect(resetLeft(5 * MIN)).toBe('5')
  expect(resetLeft(4 * MIN)).toBe('4')
  expect(resetLeft(1 * MIN)).toBe('1')
  expect(resetLeft(30_000)).toBe('1')
  expect(resetLeft(0)).toBe('0')
  expect(resetLeft(-5 * MIN)).toBe('0')
})

test('resetLeft: in the last hour it rounds up, never reports less than the real time left', () => {
  for (let ms = 0; ms <= 55 * MIN; ms += 20_000) {
    const text = resetLeft(ms)
    const shown = Number(text)
    expect(shown >= ms / MIN).toBe(true)
  }
})

test('cacheLeft: minutes, <10 at the end, a dash when cold, capped at 59', () => {
  expect(cacheLeft(60 * MIN)).toBe('59')
  expect(cacheLeft(59 * MIN)).toBe('59')
  expect(cacheLeft(30 * MIN)).toBe('30')
  expect(cacheLeft(10 * MIN)).toBe('10')
  expect(cacheLeft(9 * MIN + 1)).toBe('10')
  expect(cacheLeft(9 * MIN)).toBe('<10')
  expect(cacheLeft(1)).toBe('<10')
  expect(cacheLeft(0)).toBe('—')
  expect(cacheLeft(-MIN)).toBe('—')
})

test('slot: a value, or a dash until it arrives', () => {
  expect(slot('◉', '356k')).toBe(`◉${NB}356k`)
  expect(slot('◉', 0)).toBe(`◉${NB}0`)
  expect(slot('◉', null)).toBe(`◉${NB}—`)
  expect(slot('✎', undefined)).toBe(`✎${NB}—`)
})

test('chatCounts: messages alone, then messages/images once there is a picture', () => {
  expect(chatCounts(34, null)).toBe('34')
  expect(chatCounts(34, 0)).toBe('34')
  expect(chatCounts(34, 1)).toBe('34/1')
  expect(chatCounts(0, 2)).toBe('0/2')
  expect(chatCounts(null, null)).toBe(null)
  expect(chatCounts(null, 3)).toBe('—/3')
})

test('pie: fills in quarters and stays in range', () => {
  expect(pie(0)).toBe('○')
  expect(pie(25)).toBe('◔')
  expect(pie(50)).toBe('◑')
  expect(pie(75)).toBe('◕')
  expect(pie(100)).toBe('●')
  expect(pie(-5)).toBe('○')
  expect(pie(250)).toBe('●')
})

const sepItem = (n: number) => ({ key: `sep${n}`, text: NB.repeat(SEP_W) })
const left = [
  { key: 'five', text: `◔${NB}25%` },
  { key: 'reset', text: `↺${NB}2` },
  sepItem(1),
  { key: 'short', text: `✧${NB}short` },
]
const mid = [
  { key: 'ctx', text: `○${NB}80k` },
  { key: 'turns', text: `≡${NB}12` },
  { key: 'cache', text: `△${NB}59` },
]
const right = [
  { key: 'read', text: `◉${NB}356k` },
  { key: 'written', text: `✎${NB}42k` },
  { key: 'fresh', text: `↑${NB}8` },
  { key: 'output', text: `↓${NB}3k` },
  sepItem(2),
  { key: 'week', text: `◑${NB}62%` },
]
const keys = (items: { key: string }[]) => items.map(i => i.key)
const need = rowWidth(mid) + 2 * Math.max(rowWidth(left), rowWidth(right)) + 2 * GAP

test('fitRow: everything stays when there is room, the middle in the true centre', () => {
  const r = fitRow(left, mid, right, need)
  expect(r.fits).toBe(true)
  expect(keys(r.left)).toEqual(keys(left))
  expect(keys(r.mid)).toEqual(keys(mid))
  expect(keys(r.right)).toEqual(keys(right))
  expect(r.sideW).toBe(Math.floor((need - rowWidth(mid)) / 2))
})

test('fitRow: one cell short drops the first in line, ↑', () => {
  const r = fitRow(left, mid, right, need - 1)
  expect(r.fits).toBe(true)
  expect([...keys(r.left), ...keys(r.mid), ...keys(r.right)]).not.toContain('fresh')
  expect(keys(r.mid)).toContain('turns')
})

test('fitRow: the order follows DROP, the limits and the weekly item never go, the drop of an expensive turn goes last', () => {
  let previous = left.length + mid.length + right.length + 1
  for (let width = need; width >= 30; width--) {
    const r = fitRow(left, mid, right, width)
    const kept = [...keys(r.left), ...keys(r.mid), ...keys(r.right)]
    expect(r.fits).toBe(true)
    expect(rowWidth(r.mid) + 2 * Math.max(rowWidth(r.left), rowWidth(r.right)) + 2 * GAP <= width).toBe(true)
    expect(kept.length <= previous).toBe(true)
    previous = kept.length
    for (const k of ['five', 'reset', 'week']) expect(kept).toContain(k)
  }
  expect(DROP[DROP.length - 1]).toBe('ctx')
})

test('fitRow: a separator never stands first, last or twice, whatever was dropped', () => {
  for (let width = need; width >= 30; width--) {
    const r = fitRow(left, mid, right, width)
    for (const side of [r.left, r.mid, r.right]) {
      if (side.length === 0) continue
      expect(isSep(side[0]!)).toBe(false)
      expect(isSep(side[side.length - 1]!)).toBe(false)
      side.forEach((it, i) => i > 0 && expect(isSep(it) && isSep(side[i - 1]!)).toBe(false))
    }
  }
  expect(keys(tidySeps([sepItem(1), { key: 'a', text: 'a' }, sepItem(2), sepItem(3), { key: 'b', text: 'b' }, sepItem(4)]))).toEqual(['a', 'sep2', 'b'])
})

test('fitRow: too narrow for the limits, the groups halve the band and the middle is gone', () => {
  const r = fitRow(left, mid, right, 8)
  expect(r.fits).toBe(false)
  expect(r.sideW).toBe(4)
})

test('fitRow loose: a band too narrow for the true centre keeps its entries and moves the middle off-centre', () => {
  const strict = fitRow(left, mid, right, need - 1)
  const loose = fitRow(left, mid, right, need - 1, true)
  expect(strict.right.length).toBeLessThan(right.length)
  expect(loose.right.length).toBe(right.length)
  expect(loose.fits).toBe(true)
  expect(loose.sideL + loose.sideR + rowWidth(loose.mid)).toBe(need - 1)
  expect(loose.sideL).toBeGreaterThanOrEqual(rowWidth(loose.left) + GAP)
  expect(loose.sideR).toBeGreaterThanOrEqual(rowWidth(loose.right) + GAP)
})

test('fitRow loose: with room for the true centre nothing moves', () => {
  const r = fitRow(left, mid, right, need, true)
  expect(r.sideL).toBe(r.sideW)
  expect(r.sideR).toBe(r.sideW)
})
