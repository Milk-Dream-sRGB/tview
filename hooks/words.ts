// The words of the statistics card, in Russian and English: every label and every sentence the digest
// builds, so adding a language is one more object here. Pure.
import type { Lang } from './shared'

// "1 день / 2 дня / 5 дней" for Russian
export const plural = (n: number, one: string, few: string, many: string) =>
  n % 10 === 1 && n % 100 !== 11 ? one : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 12 || n % 100 > 14) ? few : many

type Words = {
  statistics: string
  rangeLabel: (days: number) => string
  empty: string
  sectionTech: string
  sectionFun: string
  dayNames: string[]
  dayIn: string[]
  dur: (minutes: number) => string
  windows: (n: number, avgPeak: number, hit: number, hits: number) => [string, string]
  weekly: (hit: number, weeks: number, dayIn: string | null, hit95: number) => [string, string]
  tokens: (written: string, out: string, fresh: string, agents: string) => [string, string]
  perPct: (n: string) => [string, string]
  priciest: (pct: string, msgs: number, date: string) => [string, string]
  top3: (pct: number) => [string, string]
  msgPrice: (short: string, long: string, times: string) => [string, string]
  lifetime: (median: string, longest: string) => [string, string]
  perChat: (median: number, mean: string, record: number) => [string, string]
  perDay: (chats: string, msgs: number) => [string, string]
  favourite: (day: string, hour: string) => [string, string]
  nights: (night: number, weekend: number) => [string, string]
  streak: (days: number, span: number, streak: number) => [string, string]
  images: (share: number, avg: string, record: number) => [string, string]
  marathons: (n: number, limit: number) => [string, string]
  since: (date: string) => [string, string]
}

const RU: Words = {
  statistics: 'статистика',
  rangeLabel: days => (days === 0 ? 'всё время' : `${days} дн.`),
  empty: 'Данных за этот период пока нет. Сбор идёт тихо с момента включения; через несколько чатов здесь появятся цифры.',
  sectionTech: 'Технически: на что уходит лимит и время',
  sectionFun: 'Как вы себя ведёте',
  dayNames: ['понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота', 'воскресенье'],
  dayIn: ['понедельник', 'вторник', 'среду', 'четверг', 'пятницу', 'субботу', 'воскресенье'],
  dur: m => (m < 60 ? `${Math.max(1, m)} мин` : m % 60 ? `${Math.floor(m / 60)} ч ${m % 60} мин` : `${m / 60} ч`),
  windows: (n, avg, hit, hits) => ['Окон 5 часов', `${n}, пик в среднем ${avg}%, до ${hit}% доходил ${hits} ${plural(hits, 'раз', 'раза', 'раз')}`],
  weekly: (hit, weeks, dayIn, hit95) => ['Недельный лимит', `до ${hit95}% в ${hit} из ${weeks} недель${dayIn ? `, чаще всего в ${dayIn}` : ''}`],
  tokens: (written, out, fresh, agents) => ['Куда уходят токены', `запись в кеш ${written} · вывод ${out} · новый ввод ${fresh} · агенты ${agents}`],
  perPct: n => ['1% лимита', `≈ ${n} токенов работы`],
  priciest: (pct, msgs, date) => ['Самый дорогой чат', `≈ ${pct} лимита · ${msgs} сообщ. · ${date}`],
  top3: pct => ['Три самых дорогих', `≈ ${pct}% всего расхода`],
  msgPrice: (short, long, times) => ['Цена сообщения', `в коротких чатах (до 10) ≈ ${short}, в длинных (больше 40) ≈ ${long}: в ${times} раза дороже`],
  lifetime: (median, longest) => ['Время жизни чата', `медиана ${median}, самый долгий ${longest}`],
  perChat: (median, mean, record) => ['Сообщений в чате', `медиана ${median} · в среднем ${mean} · рекорд ${record}`],
  perDay: (chats, msgs) => ['Чатов в день', `${chats} в дни работы, сообщений ${msgs}`],
  favourite: (day, hour) => ['Любимое время', `${day}, около ${hour}:00`],
  nights: (night, weekend) => ['Ночью и по выходным', `${night}% сообщений с 00 до 06 · ${weekend}% в выходные`],
  streak: (days, span, streak) => ['Дней с работой', `${days} из ${span}, самая длинная серия ${streak} ${plural(streak, 'день', 'дня', 'дней')}`],
  images: (share, avg, record) => ['Картинки', `в ${share}% чатов, в среднем ${avg} на чат, рекорд ${record}`],
  marathons: (n, limit) => ['Марафоны', `${n} ${plural(n, 'чат', 'чата', 'чатов')} длиннее ${limit} сообщений`],
  since: date => ['Считаю с', `${date}, раньше данных нет`],
}

const s = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`

const EN: Words = {
  statistics: 'statistics',
  rangeLabel: days => (days === 0 ? 'all time' : `${days} days`),
  empty: 'No data for this period yet. Collecting is quiet and starts the moment it was switched on; after a few chats numbers will appear here.',
  sectionTech: 'Technical: where the limit and the time go',
  sectionFun: 'How you behave',
  dayNames: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  dayIn: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  dur: m => (m < 60 ? `${Math.max(1, m)} min` : m % 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m / 60} h`),
  windows: (n, avg, hit, hits) => ['5-hour windows', `${n}, average peak ${avg}%, reached ${hit}% ${s(hits, 'time')}`],
  weekly: (hit, weeks, dayIn, hit95) => ['Weekly limit', `reached ${hit95}% in ${hit} of ${s(weeks, 'week')}${dayIn ? `, most often on ${dayIn}` : ''}`],
  tokens: (written, out, fresh, agents) => ['Where the tokens go', `cache writes ${written} · output ${out} · new input ${fresh} · agents ${agents}`],
  perPct: n => ['1% of the limit', `≈ ${n} work tokens`],
  priciest: (pct, msgs, date) => ['Most expensive chat', `≈ ${pct} of the limit · ${s(msgs, 'message')} · ${date}`],
  top3: pct => ['Top three chats', `≈ ${pct}% of all spending`],
  msgPrice: (short, long, times) => ['Price of a message', `in short chats (up to 10) ≈ ${short}, in long ones (over 40) ≈ ${long}: ${times}× more`],
  lifetime: (median, longest) => ['Chat lifetime', `median ${median}, longest ${longest}`],
  perChat: (median, mean, record) => ['Messages per chat', `median ${median} · mean ${mean} · record ${record}`],
  perDay: (chats, msgs) => ['Chats per day', `${chats} on working days, ${s(msgs, 'message')}`],
  favourite: (day, hour) => ['Favourite time', `${day}, around ${hour}:00`],
  nights: (night, weekend) => ['Nights and weekends', `${night}% of messages between 00 and 06 · ${weekend}% at weekends`],
  streak: (days, span, streak) => ['Working days', `${days} of ${span}, longest streak ${s(streak, 'day')}`],
  images: (share, avg, record) => ['Images', `in ${share}% of chats, ${avg} per chat on average, record ${record}`],
  marathons: (n, limit) => ['Marathons', `${s(n, 'chat')} longer than ${limit} messages`],
  since: date => ['Counting since', `${date}, nothing earlier`],
}

export const W: Record<Lang, Words> = { ru: RU, en: EN }
