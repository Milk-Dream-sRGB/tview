// Pure statistics: the shapes kept in the store and the digest `/tview` shows. Nothing here touches
// the engine, so all of it is covered by tests.
//
// What is stored, and why it cannot race: every chat writes only keys of its own (`stat:chat:<id>`,
// `stat:day:<date>:<id>`), and the limit windows are shared records that only ever grow towards the
// same value (`stat:win:…`), so two chats open at once never overwrite each other's numbers.

import type { Lang } from './shared'
import { W } from './words'

type Tok = { fresh: number; read: number; written: number; out: number }

// One chat, from its first message to its last
export type ChatRec = { id: string; start: number; last: number; msgs: number; images: number; tok: Tok; agentTok: Tok }

// One chat on one local calendar day; `hours` counts its messages per hour of the day
export type DayChat = { date: string; id: string; msgs: number; images: number; tok: Tok; agentTok: Tok; hours: number[] }

// A limit window (5 hours or a week): when it was first seen, the highest percent, when it reached HIT
export type WinRec = { id: string; t: number; peak: number; hitAt?: number }

export type Dataset = { chats: ChatRec[]; days: DayChat[]; five: WinRec[]; week: WinRec[]; since: number }

export const HIT = 95
export const DAY_MS = 86_400_000
const MIN_MS = 60_000

export const zeroTok = (): Tok => ({ fresh: 0, read: 0, written: 0, out: 0 })
export const emptyChat = (id: string, t: number): ChatRec => ({ id, start: t, last: t, msgs: 0, images: 0, tok: zeroTok(), agentTok: zeroTok() })
export const emptyDay = (date: string, id: string): DayChat => ({ date, id, msgs: 0, images: 0, tok: zeroTok(), agentTok: zeroTok(), hours: Array(24).fill(0) })

// A window's record after a new reading: the peak only grows, the moment of reaching HIT is kept once
export function winStep(prev: WinRec | undefined, id: string, pct: number, t: number): { rec: WinRec; changed: boolean } {
  const rec: WinRec = prev ?? { id, t, peak: 0 }
  const peak = Math.max(rec.peak, Math.round(pct))
  const hitAt = rec.hitAt ?? (pct >= HIT ? t : undefined)
  const changed = !prev || peak !== rec.peak || hitAt !== rec.hitAt
  return { rec: { ...rec, peak, hitAt }, changed }
}

const pad = (n: number) => String(n).padStart(2, '0')
export const dateKey = (t: number) => {
  const d = new Date(t)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}
const parseDate = (key: string) => {
  const [y = 0, m = 1, d = 1] = key.split('-').map(Number)
  return new Date(y, m - 1, d)
}
// "06.10" for a time
const dayMonth = (t: number) => `${pad(new Date(t).getDate())}.${pad(new Date(t).getMonth() + 1)}`
// Monday is 0
export const weekday = (t: number) => (new Date(t).getDay() + 6) % 7

// What counts as work: everything but cache reads, which are cheap and would drown the rest
export const work = (t: Tok) => t.fresh + t.written + t.out

export const median = (xs: number[]) => {
  if (xs.length === 0) return 0
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? (s[m] ?? 0) : ((s[m - 1] ?? 0) + (s[m] ?? 0)) / 2
}
export const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)
const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0)
const argmax = (xs: number[]) => xs.indexOf(Math.max(...xs))

const fmtN = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${Math.round(n / 1e3)}k` : `${Math.round(n)}`)
// A percent of the limit: a tenth below 10, whole above
export const fmtPct = (p: number) => (p < 10 ? `${(Math.round(p * 10) / 10).toString()}%` : `${Math.round(p)}%`)
export type Row = [label: string, value: string]
type Digest = { title: string; lang: Lang; empty: boolean; tech: Row[]; fun: Row[] }

// Longest run of consecutive days with messages
export function longestStreak(dates: string[]) {
  const days = [...new Set(dates)].sort().map(d => Math.round(parseDate(d).getTime() / DAY_MS))
  let best = 0
  let run = 0
  days.forEach((d, i) => {
    run = i > 0 && d - (days[i - 1] ?? 0) === 1 ? run + 1 : 1
    best = Math.max(best, run)
  })
  return best
}

const MARATHON = 80

// Two short lists of facts about the last `rangeDays` days (all the data when 0): where the limit and
// the time go, and how the person behaves. A row appears only when there is data behind it.
// What a chat costs in percent is an estimate: its work tokens over how many tokens one percent of the
// 5h limit is worth on average (all work over the sum of the windows' peaks). The words come from
// words.ts, in the language asked for.
export function digest(data: Dataset, rangeDays: number, now: number, lang: Lang = 'ru'): Digest {
  const w = W[lang]
  const title = w.rangeLabel(rangeDays)
  const last = dateKey(now)
  const first = rangeDays > 0 ? dateKey(now - (rangeDays - 1) * DAY_MS) : '0000-00-00'
  const fromMs = rangeDays > 0 ? parseDate(first).getTime() : 0
  const toMs = parseDate(last).getTime() + DAY_MS
  const days = data.days.filter(d => d.date >= first && d.date <= last && d.msgs > 0)
  const chats = data.chats.filter(c => c.last >= fromMs && c.last < toMs && c.msgs > 0)
  if (chats.length === 0) return { title, lang, empty: true, tech: [], fun: [] }
  const five = data.five.filter(x => x.t >= fromMs && x.t < toMs)
  const week = data.week.filter(x => x.t >= fromMs && x.t < toMs)

  const tech: Row[] = []
  const fun: Row[] = []

  // ---- where the limit and the time go
  if (five.length > 0) {
    const hits = five.filter(x => x.hitAt !== undefined).length
    tech.push(w.windows(five.length, Math.round(mean(five.map(x => x.peak))), HIT, hits))
  }
  if (week.length > 0) {
    const hit = week.filter(x => x.hitAt !== undefined)
    const byDay = Array(7).fill(0)
    for (const x of hit) byDay[weekday(x.hitAt as number)] += 1
    tech.push(w.weekly(hit.length, week.length, hit.length > 0 ? w.dayIn[argmax(byDay)] ?? null : null, HIT))
  }

  const tok = days.reduce((a, d) => ({ fresh: a.fresh + d.tok.fresh, written: a.written + d.tok.written, out: a.out + d.tok.out, read: a.read + d.tok.read }), zeroTok())
  const agent = sum(days.map(d => work(d.agentTok)))
  const all = work(tok) + agent
  if (all > 0) {
    const p = (n: number) => `${Math.round((n / all) * 100)}%`
    tech.push(w.tokens(p(tok.written), p(tok.out), p(tok.fresh), p(agent)))
  }

  // Tokens per percent: only the work of the chats seen against the windows they fell in
  const peaks = sum(five.map(x => x.peak))
  const perPct = peaks >= 5 && work(tok) > 0 ? work(tok) / peaks : null
  if (perPct) {
    tech.push(w.perPct(fmtN(perPct)))
    const cost = (c: ChatRec) => work(c.tok) / perPct
    const sorted = [...chats].sort((a, b) => cost(b) - cost(a))
    const total = sum(chats.map(cost))
    if (chats.length >= 3 && total > 0) {
      const top = sorted[0]
      if (top) tech.push(w.priciest(fmtPct(cost(top)), top.msgs, dayMonth(top.start)))
      tech.push(w.top3(Math.round((sum(sorted.slice(0, 3).map(cost)) / total) * 100)))
      const perMsg = (xs: ChatRec[]) => sum(xs.map(cost)) / Math.max(1, sum(xs.map(c => c.msgs)))
      const short = chats.filter(c => c.msgs <= 10)
      const long = chats.filter(c => c.msgs > 40)
      if (short.length >= 3 && long.length >= 3 && perMsg(short) > 0) {
        tech.push(w.msgPrice(fmtPct(perMsg(short)), fmtPct(perMsg(long)), (perMsg(long) / perMsg(short)).toFixed(1)))
      }
    }
  }

  const lives = chats.map(c => c.last - c.start).filter(ms => ms > 0)
  if (lives.length > 0) tech.push(w.lifetime(w.dur(Math.round(median(lives) / MIN_MS)), w.dur(Math.round(Math.max(...lives) / MIN_MS))))

  // ---- how the person behaves
  const msgs = chats.map(c => c.msgs)
  const activeDays = [...new Set(days.map(d => d.date))]
  const span = rangeDays > 0 ? rangeDays : Math.max(1, Math.round((parseDate(last).getTime() - parseDate(activeDays.sort()[0] ?? last).getTime()) / DAY_MS) + 1)
  fun.push(w.perChat(Math.round(median(msgs)), mean(msgs).toFixed(1), Math.max(...msgs)))
  fun.push(w.perDay((chats.length / Math.max(1, activeDays.length)).toFixed(1), Math.round(sum(msgs) / Math.max(1, activeDays.length))))

  const byHour = Array(24).fill(0)
  const byWeekday = Array(7).fill(0)
  for (const d of days) {
    d.hours.forEach((n, h) => { byHour[h] += n })
    byWeekday[weekday(parseDate(d.date).getTime() + DAY_MS / 2)] += d.msgs
  }
  const total = sum(byHour)
  if (total > 0) {
    fun.push(w.favourite((w.dayNames[argmax(byWeekday)] ?? ''), pad(argmax(byHour))))
    const weekend = byWeekday[5] + byWeekday[6]
    fun.push(w.nights(Math.round((sum(byHour.slice(0, 6)) / total) * 100), Math.round((weekend / total) * 100)))
  }

  fun.push(w.streak(activeDays.length, span, longestStreak(activeDays)))

  const withImg = chats.filter(c => c.images > 0)
  if (withImg.length > 0) fun.push(w.images(Math.round((withImg.length / chats.length) * 100), mean(chats.map(c => c.images)).toFixed(1), Math.max(...chats.map(c => c.images))))
  const marathons = chats.filter(c => c.msgs > MARATHON).length
  if (marathons > 0) fun.push(w.marathons(marathons, MARATHON))
  fun.push(w.since(`${dayMonth(data.since)}.${new Date(data.since).getFullYear()}`))

  return { title, lang, empty: false, tech, fun }
}

// The text `/tview` prints: `## Section` lines and `label: value` lines. The widget draws from it
// and Copy puts it on the clipboard as it stands.
export function digestText(d: Digest): string {
  const w = W[d.lang]
  const head = `tview · ${w.statistics} · ${d.title}`
  if (d.empty) return `${head}\n${w.empty}`
  const block = (name: string, rows: Row[]) => (rows.length ? [`## ${name}`, ...rows.map(([l, v]) => `${l}: ${v}`)] : [])
  return [head, ...block(w.sectionTech, d.tech), ...block(w.sectionFun, d.fun)].join('\n')
}

// `/tview 30`, `/tview all`: the range word to days (0 is all), or undefined
export const rangeDays = (word: string | undefined): number | undefined =>
  word === 'all' ? 0 : word && /^\d{1,4}$/.test(word) && Number(word) > 0 ? Number(word) : undefined

// ---- what the collector does with each event, as pure functions the hooks only wrap in store reads and writes

export type Usage = { input_tokens: number; output_tokens: number; cache_read_input_tokens: number; cache_creation_input_tokens: number }

// A chat and its day after one more message
export function applyMessage(chat: ChatRec, day: DayChat, pictures: number, t: number) {
  chat.msgs += 1
  chat.images += pictures
  chat.last = t
  day.msgs += 1
  day.images += pictures
  const hour = new Date(t).getHours()
  day.hours[hour] = (day.hours[hour] ?? 0) + 1
}

// A chat and its day after a finished turn; a subagent's tokens go to their own column
export function applyTurn(chat: ChatRec, day: DayChat, u: Usage, isAgent: boolean, t: number) {
  for (const tok of [isAgent ? chat.agentTok : chat.tok, isAgent ? day.agentTok : day.tok]) {
    tok.fresh += u.input_tokens
    tok.read += u.cache_read_input_tokens
    tok.written += u.cache_creation_input_tokens
    tok.out += u.output_tokens
  }
  chat.last = t
}

type Seen = { five?: { id: string; pct: number }; week?: { id: string; pct: number } }
export type Limits = { kind: string; percentUsed: number; resetsAt?: string }[]

// A window is told by its reset time rounded to ten minutes: one reported a few seconds apart is the same
export const windowId = (iso: string | undefined) => (iso ? new Date(Math.round(Date.parse(iso) / 600_000) * 600_000).toISOString() : undefined)

// The app reports the limits only when a whole percent changes. Given the last percent seen per window
// (kept in memory), says which windows are new or grew, so the store is touched only for those.
export function planWindows(seen: Seen, limits: Limits): { next: Seen; todo: { key: 'five' | 'week'; id: string; pct: number }[] } {
  const next: Seen = { ...seen }
  const todo: { key: 'five' | 'week'; id: string; pct: number }[] = []
  for (const [kind, key] of [['five_hour', 'five'], ['seven_day', 'week']] as const) {
    const r = limits.find(x => x.kind === kind)
    const id = windowId(r?.resetsAt)
    if (!r || !id) continue
    const before = seen[key]
    if (before && before.id === id && r.percentUsed <= before.pct) continue
    next[key] = { id, pct: r.percentUsed }
    todo.push({ key, id, pct: r.percentUsed })
  }
  return { next, todo }
}
