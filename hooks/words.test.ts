import { test, expect } from 'claude-code/testing'

import { W, plural } from './words'
import { digest, digestText, emptyChat, emptyDay } from './stats'
import type { Dataset, WinRec } from './stats'

test('plural: Russian forms', () => {
  const f = (n: number) => plural(n, 'день', 'дня', 'дней')
  expect([1, 2, 4, 5, 11, 12, 14, 21, 22, 25, 101, 111].map(f)).toEqual(['день', 'дня', 'дня', 'дней', 'дней', 'дней', 'дней', 'день', 'дня', 'дней', 'день', 'дней'])
})

test('words: durations in both languages', () => {
  expect(W.ru.dur(20)).toBe('20 мин')
  expect(W.ru.dur(61)).toBe('1 ч 1 мин')
  expect(W.ru.dur(120)).toBe('2 ч')
  expect(W.en.dur(20)).toBe('20 min')
  expect(W.en.dur(61)).toBe('1 h 1 min')
  expect(W.en.dur(120)).toBe('2 h')
  expect(W.ru.dur(0)).toBe('1 мин')
})

test('words: range labels and weekday names', () => {
  expect(W.ru.rangeLabel(30)).toBe('30 дн.')
  expect(W.ru.rangeLabel(0)).toBe('всё время')
  expect(W.en.rangeLabel(30)).toBe('30 days')
  expect(W.en.rangeLabel(0)).toBe('all time')
  for (const l of ['ru', 'en'] as const) {
    expect(W[l].dayNames.length).toBe(7)
    expect(W[l].dayIn.length).toBe(7)
  }
})

// A dataset that fills every row of the card
const NOW = new Date(2026, 9, 6, 15, 0, 0).getTime()
const DAY = 86_400_000
function full(): Dataset {
  const win = (id: string, peak: number, hit = false): WinRec => ({ id, t: NOW - DAY, peak, hitAt: hit ? NOW - DAY : undefined })
  const chats = Array.from({ length: 8 }, (_, i) => ({
    ...emptyChat(`c${i}`, NOW - 3 * 3_600_000), last: NOW - 3_600_000,
    msgs: i < 4 ? 5 : 90, images: i === 0 ? 3 : 0, tok: { fresh: 1, read: 10, written: 60_000 + i * 20_000, out: 10_000 },
  }))
  const days = ['2026-10-04', '2026-10-05', '2026-10-06'].map(date => ({ ...emptyDay(date, 'c'), msgs: 50, hours: Array(24).fill(2), tok: { fresh: 1, read: 10, written: 200_000, out: 40_000 } }))
  return { chats, days, five: [win('a', 80), win('b', 97, true)], week: [win('w', 96, true)], since: NOW - 5 * DAY }
}

test('digest: the two languages give the same rows, the same shape, in their own words', () => {
  const ru = digest(full(), 30, NOW, 'ru')
  const en = digest(full(), 30, NOW, 'en')
  expect(en.tech.length).toBe(ru.tech.length)
  expect(en.fun.length).toBe(ru.fun.length)
  expect(ru.tech.length).toBeGreaterThanOrEqual(7)
  expect(ru.fun.length).toBeGreaterThanOrEqual(7)
  const textEn = digestText(en)
  expect(/[а-яё]/i.test(textEn)).toBe(false)
  expect(/[а-яё]/i.test(digestText(ru))).toBe(true)
  expect(textEn.split('\n')[0]).toBe('tview · statistics · 30 days')
  expect(digestText(ru).split('\n')[0]).toBe('tview · статистика · 30 дн.')
})

test('digest: English rows read as sentences', () => {
  const r = Object.fromEntries(digest(full(), 30, NOW, 'en').tech.concat(digest(full(), 30, NOW, 'en').fun))
  expect(r['5-hour windows']).toBe('2, average peak 89%, reached 95% 1 time')
  expect(r['Weekly limit']).toContain('reached 95% in 1 of 1 week, most often on ')
  expect(r['Where the tokens go']).toContain('cache writes')
  expect(r['Messages per chat']).toContain('median')
  expect(r['Counting since']).toContain('nothing earlier')
})

test('digest: both digests have the same card format, `## section` and `label: value` lines', () => {
  for (const lang of ['ru', 'en'] as const) {
    const lines = digestText(digest(full(), 30, NOW, lang)).split('\n')
    expect(lines.filter(l => l.startsWith('## ')).length).toBe(2)
    for (const l of lines.slice(1).filter(l => !l.startsWith('## '))) expect(l.includes(': ')).toBe(true)
  }
})

test('digest: no data in English says so in English', () => {
  const t = digestText(digest({ chats: [], days: [], five: [], week: [], since: NOW }, 7, NOW, 'en'))
  expect(t).toContain('No data for this period yet')
  expect(/[а-яё]/i.test(t)).toBe(false)
})
