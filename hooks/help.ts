// The text of `/tview help` (`/tview help en` for English), in the card's format: `## Section` lines
// and `label: value` lines, a label never holding ": ". A label starting with `● ` is drawn
// with a swatch of the dot's own colour. Pure, so a test can check that every icon of the band is explained,
// in both languages.

import type { Lang } from './shared'

export type { Lang }
type Row = [string, string]
type Section = [string, Row[]]
type Text = { title: string; sections: Section[] }

const RU = (brief: string): Text => ({
  title: 'tview · справка',
  sections: [
    ['Значки панели', [
      ['Дуга · 25%', 'Сколько израсходовано от 5-часового лимита; дуга заполняется в 16 шагов. До 5% значок и процент бледно-зелёные (окно только началось), с 96% бледно-красные.'],
      ['Пять сегментов', 'До сброса 5-часового лимита: по сегменту на час, ближайший тает по минутам. Числа нет. Бледно-жёлтая, когда осталось меньше 15 минут, бледно-красная меньше 5.'],
      ['Спидометр · 106k', 'Токены в контексте этого чата, стрелка и дуга показывают долю окна. Прочерк значит, что данных ещё нет (новый чат или только что был /compact). Значок бледно-оранжевый с 200k токенов и красный с 400k.'],
      ['Серая середина · 825k', 'Токены, прочитанные из кеша на последнем ходу. За ход их бывает много: контекст читается заново при каждом шаге.'],
      ['Снежинка', 'До остывания кеша: шесть лучей, каждый десять минут, гаснут по одному. Все погасли значит кеш остыл. Числа нет.'],
      ['Яркая середина · 10k', 'Токены, записанные в кеш на последнем ходу: новое, что попало в контекст.'],
      ['Перевёрнутая стопка · 17', 'Сколько запросов к модели сделал последний ход. Каждый вызов инструмента это отдельный запрос, и каждый заново читает весь контекст: поэтому чтение за ход бывает в десятки раз больше контекста.'],
      ['Точка внизу · 62', 'Новый ввод без кеша: обычно несколько токенов на запрос, поэтому значок виден, только когда их от 50 за ход. Это странное поведение, возможный признак того, что кеш не сработал.'],
      ['Точка вверху · 5k', 'Токены, которые написала модель.'],
      ['Стопка · 68/19', 'Сообщений в чате и после черты картинок (черты нет, пока картинок нет).'],
      ['Орбита · 2', 'Сколько агентов этого чата работает сейчас (точек на орбите до четырёх); пока их нет, значка нет.'],
      ['Семь сегментов · 62%', 'Недельный лимит, справа: по сегменту на день недели, заливка идёт плавно. Число видно всегда.'],
      ['Точка в углу недельного значка', 'Продление подписки (дату задаёт /tview renew). Бледно-зелёная, за неделю до продления жёлтая, за два дня красная. Пока отладка, бледно-зелёная точка видна всегда.'],
    ]],
    ['Кнопки', [
      ['Две строки', 'Это short. Нажмите, и к следующему вашему сообщению мод незаметно добавит короткую просьбу отвечать по делу (яркая вторая строка с точкой значит включено). После отправки выключается сам, повторное нажатие отменяет.'],
      ['Что добавляется', brief],
      ['Квадрат на квадрате', 'Нажатие открывает этот чат (значки объяснены ниже).'],
    ]],
    ['Значки других чатов рядом с недельным лимитом', [
      ['Что это', 'Другие ваши чаты, где что-то происходило не больше часа назад, то есть их кеш ещё тёплый. До двух штук, самый свежий слева. Когда кеш остыл, значок пропадает.'],
      ['● зелёный', 'До остывания кеша больше 15 минут.'],
      ['● жёлтый', 'От 5 до 15 минут: пора вернуться в чат, если не хочется платить за остывший кеш.'],
      ['● красный', 'Меньше 5 минут.'],
    ]],
    ['Команды', [
      ['/tview', 'Статистика за 30 дней: на что уходит лимит и время, как вы себя ведёте.'],
      ['/tview 7', 'То же за 7, 90 дней или «all» за всё время.'],
      ['/tview renew 7', 'Когда продлевается подписка: /tview renew 7 для помесячной оплаты (7-го числа), /tview renew 22.10 для годовой. /tview renew off убирает, /tview renew показывает, сколько осталось.'],
      ['/tview reset confirm', 'Стереть накопленную статистику.'],
      ['/tview help', 'Эта справка. По-английски: /tview help en.'],
    ]],
  ],
})

const EN = (brief: string): Text => ({
  title: 'tview · help',
  sections: [
    ['Band icons', [
      ['Arc · 25%', 'How much of the 5-hour limit is spent; the arc fills in 16 steps. Up to 5% the icon and percent are pale green (the window just began), from 96% pale red.'],
      ['Five segments', 'Time to the 5-hour limit reset: one segment per hour, the nearest one drains by the minute. No number. Pale yellow under 15 minutes left, pale red under 5.'],
      ['Gauge · 106k', 'Tokens in this chat\'s context; the needle and the arc show its share of the window. A dash means no data yet (a new chat or right after /compact). The icon turns pale orange from 200k tokens and red from 400k.'],
      ['Grey core · 825k', 'Tokens read from the cache on the last turn. A turn can read a lot: the context is read again at every step.'],
      ['Snowflake', 'Until the cache cools: six arms, ten minutes each, going dark one by one. All dark means the cache is cold. No number.'],
      ['Bright core · 10k', 'Tokens written to the cache on the last turn: what is new in the context.'],
      ['Upside-down stack · 17', 'How many requests to the model the last turn made. Every tool call is a request of its own, and each one reads the whole context again: that is why a turn can read many times the context.'],
      ['Dot at the bottom · 62', 'New input outside the cache: normally a few tokens a request, so the icon shows only from 50 a turn. That is odd behaviour, a possible sign that the cache missed.'],
      ['Dot at the top · 5k', 'Tokens the model wrote.'],
      ['Stack · 68/19', 'Messages in the chat and, after the slash, images (no slash until there are images).'],
      ['Orbit · 2', 'How many agents of this chat are running now (up to four dots on the orbit); no icon while there are none.'],
      ['Seven segments · 62%', 'The weekly limit, on the right: one segment per day of the week, filling smoothly. The number is always shown.'],
      ['Dot on the weekly icon', 'The subscription renewal (set the day with /tview renew). Pale green, yellow a week before, red two days before. While tuning, a pale green dot is always shown.'],
    ]],
    ['Buttons', [
      ['Two lines', 'This is short. Press it, and the mod quietly adds a short ask to answer to the point to your next message (a bright second line with a dot means on). It turns itself off after sending; pressing again cancels.'],
      ['What is added', brief],
      ['Square over a square', 'Pressing it opens that chat (the icons are explained below).'],
    ]],
    ['Other chats\' icons beside the weekly limit', [
      ['What they are', 'Your other chats where something happened within the last hour, so their cache is still warm. Up to two, the freshest on the left. When the cache is cold the icon disappears.'],
      ['● green', 'More than 15 minutes until the cache cools.'],
      ['● yellow', '5 to 15 minutes: time to return to the chat if you do not want to pay for a cold cache.'],
      ['● red', 'Less than 5 minutes.'],
    ]],
    ['Commands', [
      ['/tview', 'Statistics for 30 days: where the limit and time go, how you behave.'],
      ['/tview 7', 'The same for 7, 90 days or «all» for all time.'],
      ['/tview renew 7', 'When the subscription renews: /tview renew 7 for a monthly plan (the 7th), /tview renew 22.10 for a yearly one. /tview renew off removes it, /tview renew shows the days left.'],
      ['/tview reset confirm', 'Erase the collected statistics.'],
      ['/tview help', 'This help. In Russian: /tview help ru.'],
    ]],
  ],
})

export function helpText(briefPrompt: string, lang: Lang = 'ru'): string {
  const t = (lang === 'en' ? EN : RU)(briefPrompt)
  return [t.title, ...t.sections.flatMap(([name, rows]) => [`## ${name}`, ...rows.map(([l, v]) => `${l}: ${v}`)])].join('\n')
}
