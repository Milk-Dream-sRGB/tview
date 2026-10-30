// What the band's view, the card and the hooks all use: pure values and functions, no `$`.

// The two languages of /tview help and of the statistics card
export type Lang = 'ru' | 'en'

// 1h on a Claude subscription within limits; set to 5 * 60 * 1000 for an API key
export const CACHE_TTL_MS = 60 * 60 * 1000

// One-shot: attached to the next prompt only when the "short" toggle is on.
// To remove the feature, delete BRIEF_PROMPT, the `brief` atom, the prompt.submit hook and the button.
export const BRIEF_PROMPT = [
  'Answer only to the point.',
  'No preamble and no recap of the question.',
  'Give a summary of what you did only at the very end, after at least 4 messages of work, and keep it short.',
  'If something important is unclear or risky, say so in one line instead of a long explanation.',
].join(' ')

export const PALE_YELLOW = '#e6d98a'
export const PALE_ORANGE = '#e8b88a'
export const PALE_RED = '#e89a9a'
// Pale on purpose: the dots are a reminder, not an alarm
export const DOT_GREEN = '#a9c9ae'

// Subscription renewal. A monthly plan: the day of the month (`/tview renew 7`). A yearly plan: day.month
// (`/tview renew 22.10`). Kept as one number: 7 is the 7th of every month, 1022 the 22nd of October every year.
// A dot on the weekly icon: pale green by default, yellow a week before, red in the last two days.
const RENEW_WARN_DAYS = 7
const RENEW_RED_DAYS = 2
// While the feature is being tuned the green dot is always there; set to false to show it only in the last week
const RENEW_ALWAYS = true

// The text after `/tview renew`: "7" (monthly) or "22.10" (yearly, also 22/10 and 22-10); null when it is no date
export function parseRenew(text: string): number | null {
  const m = /^(\d{1,2})(?:[./-](\d{1,2}))?$/.exec(text.trim())
  if (!m) return null
  const day = Number(m[1])
  const month = m[2] === undefined ? 0 : Number(m[2])
  if (day < 1 || day > 31 || (m[2] !== undefined && (month < 1 || month > 12))) return null
  return month * 100 + day
}

// How a code reads back to the person
export const renewText = (code: number) => (code >= 100 ? `${code % 100}.${String(Math.floor(code / 100)).padStart(2, '0')}` : `${code}`)

// Whole calendar days to the next renewal (0 on the day itself); a day that a month lacks falls on its last day
export function renewDaysLeft(code: number, nowMs: number): number {
  const n = new Date(nowMs)
  const today = new Date(n.getFullYear(), n.getMonth(), n.getDate())
  const day = code % 100
  const month = Math.floor(code / 100)
  const on = (y: number, m: number) => new Date(y, m, Math.min(day, new Date(y, m + 1, 0).getDate()))
  let next = month === 0 ? on(n.getFullYear(), n.getMonth()) : on(n.getFullYear(), month - 1)
  if (next < today) {
    next = month === 0
      ? (after => on(after.getFullYear(), after.getMonth()))(new Date(n.getFullYear(), n.getMonth() + 1, 1))
      : on(n.getFullYear() + 1, month - 1)
  }
  return Math.round((next.getTime() - today.getTime()) / 86_400_000)
}

// What the weekly icon's dot looks like for the days left (null: nothing to draw)
export function renewBadge(days: number | null): { color: string } | null {
  if (days === null) return null
  if (days <= RENEW_RED_DAYS) return { color: PALE_RED }
  if (days <= RENEW_WARN_DAYS) return { color: PALE_YELLOW }
  return RENEW_ALWAYS ? { color: DOT_GREEN } : null
}

// A help row's label that starts with `● colour` is drawn with that colour
export const swatchOf = (label: string) =>
  label.startsWith('● ') ? ({ зелёный: DOT_GREEN, жёлтый: PALE_YELLOW, красный: PALE_RED, green: DOT_GREEN, yellow: PALE_YELLOW, red: PALE_RED } as Record<string, string>)[label.slice(2)]
  : undefined

// The command that opens a chat's link in the app: only `claude://` links, `open` on macOS, `cmd /c start`
// on Windows (its empty first argument is the window title `start` would otherwise take the link for)
export const openCommand = (link: string, isWindows: boolean): string[] | null =>
  !link.startsWith('claude://') ? null : isWindows ? ['cmd', '/c', 'start', '', link] : ['open', link]
