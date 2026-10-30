import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Limit, Saved } from '../types'
import { BRIEF_PROMPT, CACHE_TTL_MS, openCommand, parseRenew, renewDaysLeft, renewText } from './shared'
import type { Lang } from './shared'
import { DAY_MS, applyMessage, applyTurn, dateKey, digest, digestText, emptyChat, emptyDay, planWindows, rangeDays, winStep } from './stats'
import type { ChatRec, Dataset, DayChat, WinRec } from './stats'
import { helpText } from './help'
import { plural } from './words'
import { bandInfo, renderBand } from './view'
import { renderCard } from './card'

// The only module the mod names, so it is the only place that registers hooks and the only one that
// holds `$` (the validator lets `$` go only to functions of the same file). Everything else is pure and
// lives apart, with tests:
//   view.tsx    the band as a tree        card.tsx   the /tview card as a tree
//   stats.ts    statistics and digest     layout.ts  widths, formats, what to drop
//   help.ts     the text of /tview help   shared.ts  the colours, the short prompt, the cache TTL

const five = atom({ plugin: 'tview', key: 'five' } as const, null)
const week = atom({ plugin: 'tview', key: 'week' } as const, null)
const ctx = atom({ plugin: 'tview', key: 'ctx' } as const, null)
const tokens = atom({ plugin: 'tview', key: 'tokens' } as const, null)
const now = atom({ plugin: 'tview', key: 'now' } as const, 0)
const images = atom({ plugin: 'tview', key: 'images' } as const, null)
const turns = atom({ plugin: 'tview', key: 'turns' } as const, null)
const agents = atom({ plugin: 'tview', key: 'agents' } as const, [])
const others = atom({ plugin: 'tview', key: 'others' } as const, [])
const watched = atom({ plugin: 'tview', key: 'watched' } as const, null)
// The subscription's renewal date as one number (the day of the month, or month*100+day for a yearly plan),
// kept in the store as `renew:day`, shared by all chats
const renewDay = atom({ plugin: 'tview', key: 'renewDay' } as const, null)
const trouble = atom({ plugin: 'tview', key: 'trouble' } as const, {})
const brief = atom({ plugin: 'tview', key: 'brief' } as const, false)
// Requests made so far in each running turn of the main loop, by turn id; dropped when the turn completes
const stepsOf = new Map<string, number>()

const toLimit = (r: { percentUsed: number; resetsAt?: string } | undefined): Limit | null =>
  r ? { percent: r.percentUsed, resetsAt: r.resetsAt } : null

// A side job (statistics, a click on a dot) must never stop what the person asked for: sending a prompt,
// finishing a turn. Its failure is kept for `/tview debug` and goes no further.
async function guarded($: EngineInterface, where: 'stats' | 'open', job: () => Promise<unknown>) {
  try {
    await job()
    await update($, trouble, t => (t[where] === undefined ? t : { ...t, [where]: undefined }))
  } catch (err) {
    await update($, trouble, t => ({ ...t, [where]: String(err).slice(0, 200) })).catch(() => undefined)
  }
}

// The store is read, changed and written back, so two such jobs of one moment (a turn ends while a prompt
// is sent) would overwrite each other. They run one after another.
let storeQueue: Promise<unknown> = Promise.resolve()
const inTurn = <T,>(job: () => Promise<T>): Promise<T> => {
  const run = storeQueue.then(job, job)
  storeQueue = run.catch(() => undefined)
  return run
}

// ---- What the band shows for this chat. Kept per chat in the plugin's store, so it is back after a
// restart or a re-entry: the last turn's tokens, the counts of images and prompts. A chat met
// for the first time is added last and pushes out the oldest ones beyond KEEP_CHATS, so the file stays small.
const KEEP_CHATS = 40
const chatKey = async ($: EngineInterface) => `chat:${await $.session.id()}`

// Over the limit, the least recently active records of a kind go, judged by the time inside each record, not by
// the order the store lists its keys in. Only runs when a kind is over its limit, and never touches `except`.
async function pruneOldest($: EngineInterface, prefix: string, keep: number, except: string, lastActive: (v: unknown) => number) {
  const keys = (await $.store.keys()).filter(k => k.startsWith(prefix) && k !== except)
  if (keys.length < keep) return
  const aged = await Promise.all(keys.map(async k => [k, lastActive(await $.store.get(k))] as const))
  aged.sort((a, b) => a[1] - b[1])
  for (const [k] of aged.slice(0, aged.length - keep + 1)) await $.store.delete(k)
}

async function persist($: EngineInterface) {
  const key = await chatKey($)
  const saved: Saved = {
    tokens: await read($, tokens),
    images: await read($, images),
    turns: await read($, turns),
    ctx: await read($, ctx),
  }
  const isNew = (await $.store.get(key)) === undefined
  await $.store.set(key, saved)
  if (!isNew) return
  await pruneOldest($, 'chat:', KEEP_CHATS, key, v => (v as Saved | undefined)?.tokens?.at ?? 0)
}

async function restore($: EngineInterface) {
  const saved = (await $.store.get(await chatKey($))) as Saved | undefined
  if (!saved) return false
  await update($, tokens, () => saved.tokens ?? null)
  await update($, images, () => saved.images ?? null)
  await update($, turns, () => saved.turns ?? null)
  if (saved.ctx) await update($, ctx, () => saved.ctx ?? null)
  return saved.images != null && saved.turns != null
}

// The limits belong to the account, not to a chat: the last reading is kept under one shared key so a chat
// opened now shows them at once, before its first turn brings a measurement. A window that has already
// reset counts as empty: nothing is spent in a window that has not begun, so a cold start shows 0% and not nothing.
async function restoreLimits($: EngineInterface) {
  const saved = (await $.store.get('last:limits')) as { five?: Limit | null; week?: Limit | null } | undefined
  if (!saved) return
  const t = Date.now()
  const alive = (l: Limit | null | undefined) => (!l ? null : !l.resetsAt || Date.parse(l.resetsAt) > t ? l : { percent: 0 })
  if (await read($, five) === null) await update($, five, () => alive(saved.five))
  if (await read($, week) === null) await update($, week, () => alive(saved.week))
}

// The limits the engine knows right now (what `session.measure` pushes). Used where no measure arrives by
// itself: a chat just opened, and a check every five minutes. Empty figures change nothing.
async function seedLimits($: EngineInterface) {
  const u = await $.session.usage()
  const f = toLimit(u.rateLimits.find(r => r.kind === 'five_hour'))
  const w = toLimit(u.rateLimits.find(r => r.kind === 'seven_day'))
  // Written only when it differs from what is shown, so a check that finds nothing new redraws nothing
  const differs = (a: Limit | null, b: Limit) => a === null || a.percent !== b.percent || a.resetsAt !== b.resetsAt
  if (f && differs(await read($, five), f)) await update($, five, () => f)
  if (w && differs(await read($, week), w)) await update($, week, () => w)
}

// The context the way the app's own "Context window" line counts it: the whole window by category (system
// prompt, tools, messages), estimated locally. The plain `context.tokens` is not used here: right after a
// compaction it covers the messages only (10k where the app says 69k). Sets ctx; with no figure it clears it
// when `clear` (after a compaction the old number is wrong) and otherwise leaves what was restored.
async function seedContext($: EngineInterface, clear: boolean) {
  // `full` counts each category with the token-count API as /context does (the app's own figure); the local
  // `summary` estimate ran ~14% low (60k against 69k), so it is only the fallback
  const u = await $.session.usage({ breakdown: 'full' }).catch(() => $.session.usage({ breakdown: 'summary' }))
  const total = u.context.breakdown?.totalTokens
  const figure = total !== undefined && total > 0 && u.context.window > 0
    ? { percent: Math.round((total / u.context.window) * 100), tokens: total }
    : null
  if (figure || clear) await update($, ctx, () => figure)
}

// Subagents of this chat that are still running. Spawn adds one, the agent's own turn.complete removes
// it; the list is also checked against the engine's, in case a finish was missed (a killed agent).
async function syncAgents($: EngineInterface) {
  const running = new Set((await $.agent.list()).filter(a => a.status === 'running').map(a => a.id))
  await update($, agents, ids => ids.filter(id => running.has(id)))
}

// The app knows when each chat last did something, which is also when its cache was last refreshed. The
// dots show up to two other chats, newest first, until the cache is cold (an hour).
const LIVE_DOTS = 2

async function refreshOthers($: EngineInterface) {
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { limit: 12 })
    const block = (r.content as { type: string; text?: string }[] | undefined)?.find(c => c.type === 'text')
    if (r.isError) {
      await update($, trouble, t => ({ ...t, others: `the app refused: ${(block?.text ?? '').slice(0, 160)}` }))
      return
    }
    const sessions = JSON.parse(block?.text ?? '[]') as { link?: string; isArchived?: boolean; lastActivityAt?: string }[]
    const t = Date.now()
    const list = sessions
      .filter(s => !s.isArchived && s.link?.startsWith('claude://') && s.lastActivityAt && t - Date.parse(s.lastActivityAt) < CACHE_TTL_MS)
      .sort((a, b) => Date.parse(b.lastActivityAt as string) - Date.parse(a.lastActivityAt as string))
      .slice(0, LIVE_DOTS)
      .map(s => ({ at: Date.parse(s.lastActivityAt as string), link: s.link as string }))
    await update($, others, () => list)
    await update($, trouble, x => ({ ...x, others: undefined }))
  } catch (err) {
    // no dots; the reason is kept for /tview debug
    await update($, trouble, x => ({ ...x, others: String(err).slice(0, 200) }))
  }
}

// ---- Quiet statistics (read with /tview). Only numbers, never text; kept apart from the state above
// (its own `stat:` keys). Every chat writes only keys of its own, so chats open at once cannot overwrite
// each other; the limit windows are shared records that only grow towards the same value. What each
// event does to the numbers is in stats.ts; here it is only read from the store and written back.
const MAX_STAT_CHATS = 2000
const KEEP_DAYS = 400

const statWrite = ($: EngineInterface, t: number, change: (chat: ChatRec, day: DayChat) => void) =>
  inTurn(() => statWriteNow($, t, change))

async function statWriteNow($: EngineInterface, t: number, change: (chat: ChatRec, day: DayChat) => void) {
  const id = await $.session.id()
  const chatKeyName = `stat:chat:${id}`
  const date = dateKey(t)
  const dayKey = `stat:day:${date}:${id}`
  const found = (await $.store.get(chatKeyName)) as ChatRec | undefined
  const chat = found ?? emptyChat(id, t)
  const day = ((await $.store.get(dayKey)) as DayChat | undefined) ?? emptyDay(date, id)
  change(chat, day)
  await $.store.set(chatKeyName, chat)
  await $.store.set(dayKey, day)
  if (found) return
  await pruneOldest($, 'stat:chat:', MAX_STAT_CHATS, chatKeyName, v => (v as ChatRec | undefined)?.last ?? 0)
}

// The app reports the limits only when a whole percent changes, and planWindows says which windows are
// new or grew: the store is touched for those only, a handful of writes per window
type Limits = { kind: string; percentUsed: number; resetsAt?: string }[]
const statMeasure = ($: EngineInterface, limits: Limits) => inTurn(() => statMeasureNow($, limits))

async function statMeasureNow($: EngineInterface, limits: Limits) {
  const { next, todo } = planWindows((await read($, watched)) ?? {}, limits)
  if (todo.length === 0) return
  const t = await $.clock.now()
  for (const w of todo) {
    const key = `stat:win:${w.key}:${w.id}`
    const { rec, changed } = winStep((await $.store.get(key)) as WinRec | undefined, w.id, w.pct, t)
    if (changed) await $.store.set(key, rec)
  }
  await update($, watched, () => next)
}

// On start: a store from an older layout is cleared (keeping its start date), and days older than
// KEEP_DAYS are dropped (a day's key carries its date, so nothing has to be read to tell)
async function statSetup($: EngineInterface) {
  const t = await $.clock.now()
  const meta = (await $.store.get('stat:meta')) as { v?: number; since?: number } | undefined
  const keys = (await $.store.keys()).filter(k => k.startsWith('stat:'))
  if (meta?.v !== 2) {
    for (const k of keys) await $.store.delete(k)
    await $.store.set('stat:meta', { v: 2, since: meta?.since ?? t })
    return
  }
  const cutoff = dateKey(t - KEEP_DAYS * DAY_MS)
  for (const k of keys.filter(k => k.startsWith('stat:day:') && k.slice(9, 19) < cutoff)) await $.store.delete(k)
}

async function loadStats($: EngineInterface): Promise<Dataset> {
  const keys = await $.store.keys()
  const read = async <T,>(prefix: string) =>
    (await Promise.all(keys.filter(k => k.startsWith(prefix)).map(k => $.store.get(k)))).filter(Boolean) as T[]
  const meta = (await $.store.get('stat:meta')) as { since?: number } | undefined
  return {
    chats: await read<ChatRec>('stat:chat:'),
    days: await read<DayChat>('stat:day:'),
    five: await read<WinRec>('stat:win:five:'),
    week: await read<WinRec>('stat:win:week:'),
    since: meta?.since ?? Date.now(),
  }
}

let lastBand = 'not drawn yet'

// `/tview debug`: why the dots may be missing in a chat: what the refresh keeps and the last problem it
// had, and the call made again here and now, with its error shown
async function debugReport($: EngineInterface) {
  const lines = [`debug · session ${await $.session.id()}`]
  lines.push(`folder: ${await $.session.cwd()}`)
  lines.push(`dots: ${(await read($, others)).length} chats kept, last problem: ${(await read($, trouble)).others ?? 'none'}`)
  const { stats, open } = await read($, trouble)
  lines.push(`statistics: ${stats ?? 'ok'}; opening a chat: ${open ?? 'ok'}`)
  lines.push(`band: ${lastBand}`)
  try {
    // The context as the engine reports it three ways, against what the band keeps
    const plain = (await $.session.usage()).context
    const whole = (await $.session.usage({ breakdown: 'summary' })).context
    lines.push(`context: band ${JSON.stringify(await read($, ctx))}; usage.tokens ${plain.tokens}, percent ${plain.percent}, window ${plain.window}; breakdown total ${whole.breakdown?.totalTokens}`)
  } catch (err) {
    lines.push(`context: usage failed: ${String(err).slice(0, 200)}`)
  }
  try {
    const r = await $.mcp.call('ccd_session_mgmt', 'list_sessions', { limit: 12 })
    const text = (r.content as { type: string; text?: string }[] | undefined)?.find(c => c.type === 'text')?.text ?? ''
    lines.push(`list_sessions now: ${r.isError ? 'ERROR' : 'ok'} ${r.isError ? text.slice(0, 200) : `${(JSON.parse(text || '[]') as unknown[]).length} chats`}`)
  } catch (err) {
    lines.push(`list_sessions now: error ${String(err).slice(0, 200)}`)
  }
  lines.push('dots wait for a chat that is not archived, has a claude:// link and was active within the hour; the list is asked every two minutes and after each turn')
  return lines.join('\n')
}

// `/tview [7|30|90|all] [en|ru]`: the statistics, `help [en|ru]`: the legend (both drawn as a card by the
// CommandOutput hook), `reset confirm`: a wipe. `en` or `ru` anywhere in the arguments picks the language.
async function statCommand($: EngineInterface, args: string) {
  const parts = args.trim().split(/\s+/).filter(Boolean)
  const lang: Lang = parts.includes('en') ? 'en' : 'ru'
  const [word, arg] = parts.filter(p => p !== 'en' && p !== 'ru')
  const say = (ru: string, en: string) => (lang === 'en' ? en : ru)
  if (word === 'reset') {
    if (arg !== 'confirm') return say('Это сотрёт всю накопленную статистику (сами чаты не трогает). Чтобы подтвердить: /tview reset confirm', 'This erases all collected statistics (the chats themselves are not touched). To confirm: /tview reset confirm')
    for (const k of (await $.store.keys()).filter(k => k.startsWith('stat:') && k !== 'stat:meta')) await $.store.delete(k)
    await $.store.set('stat:meta', { v: 2, since: await $.clock.now() })
    return say('Статистика стёрта, сбор начнётся заново.', 'Statistics erased, collecting starts over.')
  }
  if (word === 'renew') {
    if (arg === 'off') {
      await $.store.delete('renew:day')
      await update($, renewDay, () => null)
      return say('Дата продления убрана.', 'Renewal date removed.')
    }
    if (arg !== undefined) {
      const code = parseRenew(arg)
      if (code === null) return say('Помесячная оплата: /tview renew 7 (число месяца). Годовая: /tview renew 22.10 (число.месяц). Убрать: /tview renew off', 'Monthly plan: /tview renew 7 (the day of the month). Yearly: /tview renew 22.10 (day.month). To remove: /tview renew off')
      await $.store.set('renew:day', code)
      await update($, renewDay, () => code)
    }
    const code = (await $.store.get('renew:day')) as number | undefined
    if (code === undefined) return say('Дата продления не задана. Помесячная оплата: /tview renew 7. Годовая: /tview renew 22.10.', 'No renewal date set. Monthly plan: /tview renew 7. Yearly: /tview renew 22.10.')
    const left = renewDaysLeft(code, Date.now())
    const yearly = code >= 100
    return say(
      `Подписка продлевается ${yearly ? `каждый год ${renewText(code)}` : `${code}-го числа каждого месяца`}, осталось ${left} ${plural(left, 'день', 'дня', 'дней')}. Точка на недельном значке бледно-зелёная, жёлтая за неделю до продления и красная за два дня.`,
      `The subscription renews ${yearly ? `every year on ${renewText(code)}` : `on day ${code} of every month`}, ${left} ${left === 1 ? 'day' : 'days'} left. The dot on the weekly icon is pale green, yellow a week before and red two days before.`,
    )
  }
  if (word === 'debug') return debugReport($)
  if (word === 'help') return helpText(BRIEF_PROMPT, lang)
  const days = word ? rangeDays(word) : 30
  if (days === undefined) return say('Команды: /tview [7|30|90|all] [en|ru], /tview renew <число[.месяц]>, /tview reset confirm, /tview help [en|ru]', 'Commands: /tview [7|30|90|all] [en|ru], /tview renew <day[.month]>, /tview reset confirm, /tview help [en|ru]')
  return digestText(digest(await loadStats($), days, Date.now(), lang))
}

// Days to the renewal, null while the day is not set
async function renewLeft($: EngineInterface) {
  const day = await read($, renewDay)
  return day === null ? null : renewDaysLeft(day, (await read($, now)) || Date.now())
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await update($, now, () => Date.now())
    // Countdowns show whole minutes, so a minute is the finest tick that matters. Everything that asks
    // the app for something runs less often: the other chats' dots every two minutes (and at every
    // turn of this chat), the agents only while there are some.
    // A tick that fails is skipped, the next one tries again; nothing may escape as an unhandled rejection
    const tick = (job: () => Promise<unknown>) => void job().catch(() => undefined)
    $.clock.every(60_000, () => {
      tick(() => update($, now, () => Date.now()))
      tick(() => $.store.get('renew:day').then(d => update($, renewDay, () => (typeof d === 'number' ? d : null))))
      tick(() => read($, agents).then(running => (running.length > 0 ? syncAgents($) : undefined)))
      // A refresh that failed (a fresh chat may not be ready for the app's calls yet) tries again at once
      // instead of waiting for the two-minute round
      tick(() => read($, trouble).then(t => (t.others ? refreshOthers($) : undefined)))
    })
    $.clock.every(120_000, () => tick(() => refreshOthers($)))
    // The limits move between turns too (other chats, the app's own refresh); a check every five minutes
    // keeps the band close to the app
    $.clock.every(300_000, () => tick(() => seedLimits($)))
    await statSetup($)
    const savedDay = await $.store.get('renew:day')
    await update($, renewDay, () => (typeof savedDay === 'number' ? savedDay : null))
    // No read of the whole chat: the prompts so far come from a cheap counter, the images start at 0 and grow as they are sent
    if (!(await restore($))) {
      const prompts = await $.session.turns()
      await update($, turns, () => prompts)
      await update($, images, () => 0)
    }
    // A new chat has no measurement yet: show the last known limits and what the engine reads now
    await restoreLimits($).catch(() => undefined)
    await seedLimits($).catch(() => undefined)
    // Always asked: a record saved by an older version may hold a wrong figure (10k after a compaction)
    void seedContext($, false).catch(() => undefined)
    await refreshOthers($)
    await $.command.register({ name: 'tview', description: 'Usage statistics of the last days, and a legend of the band', argumentHint: '[7|30|90|all] [en|ru] | renew <day[.month]>|off | reset confirm | help [en|ru]' })
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await update($, five, () => toLimit(e.rateLimits.find(r => r.kind === 'five_hour')))
    await update($, week, () => toLimit(e.rateLimits.find(r => r.kind === 'seven_day')))
    // A measure with no fill yet (right after a compaction, or in a fresh chat) leaves what is shown as it is:
    // the compaction hook or the saved record has the better figure, a dash would only erase it
    if (e.context.percent !== undefined) await update($, ctx, () => ({ percent: e.context.percent as number, tokens: e.context.tokens }))
    await guarded($, 'stats', () => statMeasure($, e.rateLimits))
    const f = toLimit(e.rateLimits.find(r => r.kind === 'five_hour'))
    const w = toLimit(e.rateLimits.find(r => r.kind === 'seven_day'))
    if (f || w) await $.store.set('last:limits', { five: f, week: w }).catch(() => undefined)
    return next(e)
  })

  // After a compaction the context shrinks, but no measurement with a fill comes until the next turn, so
  // the new size is estimated here and the band is updated at once.
  on('session.compact', async ($, e, next) => {
    const r = await next(e)
    if (e.agentId || e.trigger === 'precompute' || r.messages === undefined) return r
    // `tokensAfter` is the conversation alone (no system prompt, tools), so the whole window is counted.
    // Not awaited: the counting asks the API and must not hold the compaction up; a failure leaves the
    // figure to the next measurement.
    // The engine installs the compacted transcript only after this hook returns, so a count made right
    // here still sees the old window (199k where the app said 71k). The old figure is dropped now, and the
    // window is counted again once the transcript has been replaced.
    const recount = () => seedContext($, false).then(() => guarded($, 'stats', () => persist($))).catch(() => undefined)
    void update($, ctx, () => null).catch(() => undefined)
    for (const ms of [2_000, 8_000, 25_000]) $.clock.after(ms, () => void recount())
    return r
    // If the hook itself fails, the compaction goes on as it was
  }).catch((_$, e, next) => next(e))

  on('agent.spawn', async ($, e, next) => {
    const r = await next(e)
    // The agent is already running; a failure to note it must not lose its result
    if (r.agentId) await update($, agents, ids => [...ids, r.agentId as string]).catch(() => undefined)
    return r
    // If the hook itself fails, the spawn goes on as it was (`next(e)` replays, nothing runs twice)
  }).catch((_$, e, next) => next(e))

  // Requests of a turn: each step is one request to the model, and the turn's token numbers are summed over
  // them. Only the position is noted (the largest wins), so a retry or a replay counts once.
  on('turn.step', async function* (_, e, next) {
    if (!e.agentId) stepsOf.set(e.turnId, Math.max(stepsOf.get(e.turnId) ?? 0, e.index + 1))
    return yield* next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const u = e.usage
    const t = await $.clock.now()
    const steps = stepsOf.get(e.turnId)
    stepsOf.delete(e.turnId)
    if (u && !e.agentId) {
      await update($, tokens, () => ({
        read: u.cache_read_input_tokens,
        written: u.cache_creation_input_tokens,
        fresh: u.input_tokens,
        output: u.output_tokens,
        at: t,
        steps,
      }))
      await update($, now, () => t)
    }
    if (e.agentId) await update($, agents, ids => ids.filter(id => id !== e.agentId))
    else await guarded($, 'stats', () => persist($))
    if (u) await guarded($, 'stats', () => statWrite($, t, (chat, day) => applyTurn(chat, day, u, !!e.agentId, t)))
    if (!e.agentId) await refreshOthers($)
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // Counted as they come; what a full read would add (tool result images) waits for a press on ≡.
    // Saved with the next finished turn, not on every message.
    const pictures = (e.attachments ?? []).filter(a => a.type === 'image').length
    if (pictures > 0) await update($, images, v => (v === null ? null : v + pictures))
    if (e.text.trim()) {
      await update($, turns, v => (v === null ? null : v + 1))
      // Statistics come last and may fail: the prompt goes out all the same
      await guarded($, 'stats', async () => {
        const t = await $.clock.now()
        await statWrite($, t, (chat, day) => applyMessage(chat, day, pictures, t))
      })
    }

    if (!(await read($, brief))) return next(e)
    await update($, brief, () => false)
    return next({ ...e, context: [...(e.context ?? []), BRIEF_PROMPT] })
    // If the hook itself fails, the prompt goes out as typed
  }).catch((_$, e, next) => next(e))

  on('command.run', { command: 'tview' }, async ($, e) => ({ text: await statCommand($, e.args) }))

  on('ui.render', { component: 'CommandOutput', props: { command: 'tview' } }, async ($, e, next) => {
    // The row may carry the plugin's name before the text, so the card starts at the title
    const start = e.props.text.indexOf('tview · ')
    if (e.props.isErrored || start < 0) return next(e)
    const text = e.props.text.slice(start)
    return renderCard($.ui.resolve(e) as never, text, press => void $.ui.copy({ text, surface: press.surface }))
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    // A survey in the slot no longer hides the band (0.54.9): the user reads the limits before answering
    const { Box } = $.ui.resolve(e)
    const own = await next(e)
    const ui = $.ui.resolve(e)
    const data = {
      bodyColumns: e.props.bodyColumns,
      now: (await read($, now)) || Date.now(),
      five: await read($, five),
      week: await read($, week),
      ctx: await read($, ctx),
      tokens: await read($, tokens),
      armed: await read($, brief),
      images: await read($, images),
      turns: await read($, turns),
      agents: (await read($, agents)).length,
      renewDays: await renewLeft($),
      others: await read($, others),
    }
    // For /tview debug: the width the app gave the band and what of it was kept
    const info = bandInfo(data, 'Svg' in ui && ui.Svg !== undefined)
    lastBand = `columns ${e.props.bodyColumns}, fits ${info.fits}, shown: ${[...info.left, ...info.middle, ...info.right].map(i => i.key).join(',')}`
    const band = renderBand({ ...ui, Svg: 'Svg' in ui ? ui.Svg : undefined } as never, data, {
      toggleShort: () => void update($, brief, v => !v),
      // Windows sets OS=Windows_NT; macOS does not set it. If `OS` is not given, the Windows variables
      // tell the same (`ComSpec`, `SystemRoot`); a failed start is kept for /tview debug, not thrown
      open: link => void guarded($, 'open', async () => {
        const isWindows = (await $.env.get('OS')) === 'Windows_NT' || (await $.env.get('SystemRoot')) !== undefined
        const argv = openCommand(link, isWindows)
        if (argv) await $.process.run(argv)
      }),
    })

    // Whatever the engine draws in this place on its own (a mascot, a notice) stays above the band
    if (!own) return band
    return (
      <Box flexDirection="column">
        {own}
        {band}
      </Box>
    )
  })
}
