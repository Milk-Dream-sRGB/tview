import { test, expect } from 'claude-code/testing'

import { DAY_MS, HIT, applyMessage, applyTurn, dateKey, digest, digestText, emptyChat, emptyDay, fmtPct, longestStreak, median, planWindows, rangeDays, weekday, windowId, winStep, zeroTok } from './stats'
import type { ChatRec, Dataset, DayChat, WinRec } from './stats'

const NOW = new Date(2026, 9, 6, 15, 0, 0).getTime()
const rows = (d: ReturnType<typeof digest>) => Object.fromEntries([...d.tech, ...d.fun])
const data = (over: Partial<Dataset>): Dataset => ({ chats: [], days: [], five: [], week: [], since: NOW - 3 * DAY_MS, ...over })
const chat = (over: Partial<ChatRec>): ChatRec => ({ ...emptyChat('c', NOW - 3_600_000), last: NOW, msgs: 5, ...over })
const day = (over: Partial<DayChat>): DayChat => ({ ...emptyDay(dateKey(NOW), 'c'), msgs: 5, ...over })
const win = (over: Partial<WinRec>): WinRec => ({ id: 'w', t: NOW - 3_600_000, peak: 40, ...over })

test('small helpers: median and percent', () => {
  expect(median([])).toBe(0)
  expect(median([3, 1, 2])).toBe(2)
  expect(median([1, 2, 3, 4])).toBe(2.5)
  expect(fmtPct(0.44)).toBe('0.4%')
  expect(fmtPct(9.96)).toBe('10%')
  expect(fmtPct(14.4)).toBe('14%')
})

test('weekday: Monday is 0, Sunday is 6', () => {
  expect(weekday(new Date(2026, 9, 5, 12).getTime())).toBe(0)
  expect(weekday(new Date(2026, 9, 11, 12).getTime())).toBe(6)
})

test('longestStreak: consecutive days only, repeats ignored', () => {
  expect(longestStreak([])).toBe(0)
  expect(longestStreak(['2026-10-01', '2026-10-02', '2026-10-02', '2026-10-03', '2026-10-05'])).toBe(3)
  expect(longestStreak(['2026-10-01', '2026-10-03'])).toBe(1)
})

test('rangeDays: numbers, all, and anything else is not a range', () => {
  expect(rangeDays('30')).toBe(30)
  expect(rangeDays('all')).toBe(0)
  expect(rangeDays('0')).toBeUndefined()
  expect(rangeDays('reset')).toBeUndefined()
  expect(rangeDays(undefined)).toBeUndefined()
})

test('winStep: a new window is stored, the peak only grows, the moment of reaching the limit is kept once', () => {
  const first = winStep(undefined, 'w', 40.4, 1000)
  expect(first.changed).toBe(true)
  expect(first.rec).toEqual({ id: 'w', t: 1000, peak: 40, hitAt: undefined })
  expect(winStep(first.rec, 'w', 40.4, 2000).changed).toBe(false)
  expect(winStep(first.rec, 'w', 30, 2000).rec.peak).toBe(40)
  const hit = winStep(first.rec, 'w', HIT + 1, 3000)
  expect(hit.changed).toBe(true)
  expect(hit.rec.hitAt).toBe(3000)
  expect(winStep(hit.rec, 'w', 100, 4000).rec.hitAt).toBe(3000)
})

test('digest: no chats gives an empty digest and a friendly text', () => {
  const d = digest(data({}), 30, NOW)
  expect(d.empty).toBe(true)
  expect(digestText(d)).toContain('Данных за этот период пока нет')
})

test('digest: one chat, only the rows that have data behind them', () => {
  const tok = { fresh: 10, read: 900, written: 100, out: 40 }
  const r = rows(digest(data({ chats: [chat({ tok })], days: [day({ tok })] }), 30, NOW))
  expect(r['Сообщений в чате']).toContain('медиана 5')
  expect(r['Куда уходят токены']).toContain('запись в кеш')
  expect(r['Окон 5 часов']).toBeUndefined()
  expect(r['1% лимита']).toBeUndefined()
  expect(r['Самый дорогой чат']).toBeUndefined()
  expect(r['Время жизни чата']).toContain('1 ч')
  expect(r['Считаю с']).toContain('раньше данных нет')
})

test('digest: windows give the limit rows and the price of a percent', () => {
  const five = [win({ id: 'a', peak: 80 }), win({ id: 'b', peak: 97, hitAt: NOW - 1000 })]
  const week = [win({ id: 'w1', peak: 96, hitAt: new Date(2026, 9, 7, 12).getTime() })]
  const tok = { fresh: 0, read: 0, written: 1_000_000, out: 700_000 }
  const r = rows(digest(data({ five, week, chats: [chat({ tok })], days: [day({ tok })] }), 30, NOW))
  expect(r['Окон 5 часов']).toBe('2, пик в среднем 89%, до 95% доходил 1 раз')
  expect(r['Недельный лимит']).toContain('в 1 из 1 недель, чаще всего в среду')
  expect(r['1% лимита']).toContain('≈ 10k')
})

test('digest: expensive chats and the price of a message in long and short chats', () => {
  const mk = (n: number, msgs: number, written: number) =>
    Array.from({ length: n }, (_, i) => chat({ id: `${msgs}-${i}`, msgs, tok: { fresh: 0, read: 0, written, out: 0 } }))
  const chats = [...mk(3, 5, 10_000), ...mk(3, 60, 300_000)]
  const five = [win({ peak: 90 })]
  const days = [day({ msgs: 200, tok: { fresh: 0, read: 0, written: 930_000, out: 0 } })]
  const r = rows(digest(data({ five, chats, days }), 30, NOW))
  expect(r['Самый дорогой чат']).toContain('≈ 29% лимита')
  expect(r['Три самых дорогих']).toBe('≈ 97% всего расхода')
  expect(r['Цена сообщения']).toContain('дороже')
})

test('digest: chats outside the range stay out', () => {
  const old = chat({ id: 'old', start: NOW - 40 * DAY_MS, last: NOW - 40 * DAY_MS, msgs: 99 })
  const r = rows(digest(data({ chats: [old, chat({})], days: [day({})], five: [win({ t: NOW - 40 * DAY_MS })] }), 7, NOW))
  expect(r['Сообщений в чате']).toContain('рекорд 5')
  expect(r['Окон 5 часов']).toBeUndefined()
})

test('digest text: sections and label: value lines, the format the widget parses', () => {
  const tok = { fresh: 1, read: 5, written: 100, out: 40 }
  const text = digestText(digest(data({ chats: [chat({ tok })], days: [day({ tok, hours: Array(24).fill(1) })] }), 30, NOW))
  const lines = text.split('\n')
  expect(lines[0]).toBe('tview · статистика · 30 дн.')
  expect(lines.filter(l => l.startsWith('## ')).length).toBe(2)
  for (const l of lines.slice(1)) expect(l.startsWith('## ') || l.includes(': ')).toBe(true)
  expect(zeroTok().out).toBe(0)
})

test('applyMessage and applyTurn: a chat and its day grow together, agents have their own column', () => {
  const t = new Date(2026, 9, 6, 14, 30).getTime()
  const chat = emptyChat('c', t)
  const d = emptyDay('2026-10-06', 'c')
  applyMessage(chat, d, 2, t)
  expect([chat.msgs, chat.images, d.msgs, d.images, d.hours[14]]).toEqual([1, 2, 1, 2, 1])
  const u = { input_tokens: 1, output_tokens: 2, cache_read_input_tokens: 3, cache_creation_input_tokens: 4 }
  applyTurn(chat, d, u, false, t + 1000)
  applyTurn(chat, d, u, true, t + 2000)
  expect(chat.tok).toEqual({ fresh: 1, out: 2, read: 3, written: 4 })
  expect(d.agentTok).toEqual({ fresh: 1, out: 2, read: 3, written: 4 })
  expect(chat.last).toBe(t + 2000)
})

test('planWindows: only new or grown windows are planned, a repeat or a drop is skipped', () => {
  const reset = new Date(2026, 9, 6, 18, 0).toISOString()
  const limits = (p: number) => [{ kind: 'five_hour', percentUsed: p, resetsAt: reset }]
  const first = planWindows({}, limits(10))
  expect(first.todo.map(w => [w.key, w.pct])).toEqual([['five', 10]])
  expect(planWindows(first.next, limits(10)).todo).toEqual([])
  expect(planWindows(first.next, limits(5)).todo).toEqual([])
  expect(planWindows(first.next, limits(11)).todo.length).toBe(1)
  const later = [{ kind: 'five_hour', percentUsed: 1, resetsAt: new Date(2026, 9, 6, 23, 0).toISOString() }]
  expect(planWindows(first.next, later).todo.length).toBe(1)
  expect(planWindows(first.next, []).todo).toEqual([])
  const wobble = [{ kind: 'five_hour', percentUsed: 12, resetsAt: new Date(new Date(reset).getTime() + 20_000).toISOString() }]
  expect(planWindows(first.next, wobble).todo.map(w => w.id)).toEqual([windowId(reset)])
})
