import { test, expect } from 'claude-code/testing'

import { openCommand, parseRenew, renewBadge, renewDaysLeft, swatchOf, DOT_GREEN, PALE_RED, PALE_YELLOW } from './shared'

const LINK = 'claude://claude.ai/epitaxy/local_00000000-0000-4000-8000-000000000000'

test('openCommand: open on macOS, cmd /c start with an empty title on Windows', () => {
  expect(openCommand(LINK, false)).toEqual(['open', LINK])
  expect(openCommand(LINK, true)).toEqual(['cmd', '/c', 'start', '', LINK])
})

test('openCommand: nothing but app links is ever opened', () => {
  for (const bad of ['', 'https://example.com', 'file:///etc/passwd', 'claude:/x', ' claude://x', 'javascript:alert(1)']) {
    expect(openCommand(bad, false)).toBeNull()
    expect(openCommand(bad, true)).toBeNull()
  }
})

test('swatchOf: dots take the cache colour, plain labels none', () => {
  expect(swatchOf('● зелёный')).toBe(DOT_GREEN)
  expect(swatchOf('● жёлтый')).toBe(PALE_YELLOW)
  expect(swatchOf('● красный')).toBe(PALE_RED)
  expect(swatchOf('↺ 2')).toBeUndefined()
})

test('renewDaysLeft: days to the next renewal day, the same day is 0, short months renew on their last day', () => {
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 15).getTime()
  expect(renewDaysLeft(7, at(2026, 10, 7))).toBe(0)
  expect(renewDaysLeft(7, at(2026, 10, 1))).toBe(6)
  expect(renewDaysLeft(7, at(2026, 10, 8))).toBe(30)
  expect(renewDaysLeft(31, at(2026, 11, 20))).toBe(10)
  expect(renewDaysLeft(31, at(2026, 2, 1))).toBe(27)
  expect(renewDaysLeft(7, at(2026, 12, 20))).toBe(18)
})

test('renewBadge: nothing without a day, green while far, yellow within a week, red within two days', () => {
  expect(renewBadge(null)).toBeNull()
  expect(renewBadge(8)).toEqual({ color: DOT_GREEN })
  expect(renewBadge(7)).toEqual({ color: PALE_YELLOW })
  expect(renewBadge(2)).toEqual({ color: PALE_RED })
  expect(renewBadge(0)).toEqual({ color: PALE_RED })
})

test('renew: monthly is a day, yearly is day.month, anything else is refused; a yearly date counts to the next year', () => {
  expect(parseRenew('7')).toBe(7)
  expect(parseRenew('22.10')).toBe(1022)
  expect(parseRenew('22/10')).toBe(1022)
  for (const bad of ['', '0', '32', '7.13', '7.0', 'abc', '7.10.2']) expect(parseRenew(bad)).toBeNull()
  const at = (y: number, m: number, d: number) => new Date(y, m - 1, d, 15).getTime()
  expect(renewDaysLeft(1022, at(2026, 10, 7))).toBe(15)
  expect(renewDaysLeft(1022, at(2026, 10, 23))).toBe(364)
  expect(renewDaysLeft(229, at(2026, 2, 1))).toBe(27)
})
