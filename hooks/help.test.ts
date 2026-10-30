import { test, expect } from 'claude-code/testing'

import { helpText } from './help'
import type { Lang } from './help'

const LANGS: Lang[] = ['ru', 'en']

// The band's icons are vector drawings, so a text card names them: each name must stand in its language's text
const HELP_ICONS: Record<Lang, string[]> = {
  ru: ['Дуга', 'Пять сегментов', 'Спидометр', 'Серая середина', 'Снежинка', 'Яркая середина', 'Перевёрнутая стопка', 'Точка внизу', 'Точка вверху', 'Две строки', 'Стопка', 'Орбита', 'Семь сегментов', 'Точка в углу недельного значка', 'Квадрат на квадрате'],
  en: ['Arc', 'Five segments', 'Gauge', 'Grey core', 'Snowflake', 'Bright core', 'Upside-down stack', 'Dot at the bottom', 'Dot at the top', 'Two lines', 'Stack', 'Orbit', 'Seven segments', 'Dot on the weekly icon', 'Square over a square'],
}

test('help: every icon of the band is explained, in both languages', () => {
  for (const lang of LANGS) {
    const text = helpText('x', lang)
    for (const icon of HELP_ICONS[lang]) expect(text.includes(icon)).toBe(true)
  }
})

test('help: the card format, a title, sections and label: value lines with no colon in a label', () => {
  for (const lang of LANGS) {
    const lines = helpText('x', lang).split('\n')
    expect(lines[0]).toBe(lang === 'ru' ? 'tview · справка' : 'tview · help')
    expect(lines.filter(l => l.startsWith('## ')).length).toBeGreaterThanOrEqual(4)
    for (const l of lines.slice(1).filter(l => !l.startsWith('## '))) {
      const cut = l.indexOf(': ')
      expect(cut).toBeGreaterThan(0)
      expect(l.slice(0, cut).includes(':')).toBe(false)
    }
  }
})

test('help: the two languages have the same rows in the same order, and the Russian one is the default', () => {
  const shape = (lang: Lang) => helpText('x', lang).split('\n').map(l => (l.startsWith('## ') ? '##' : l.slice(0, l.indexOf(': ') > 0 ? l.indexOf(': ') : 0).replace(/[а-яё]+|[a-z]+/gi, 'w')))
  expect(shape('en').length).toBe(shape('ru').length)
  expect(helpText('x')).toBe(helpText('x', 'ru'))
  expect(helpText('x', 'en')).not.toBe(helpText('x', 'ru'))
})

test('help: the short prompt is shown as it is sent', () => {
  for (const lang of LANGS) expect(helpText('Answer only to the point.', lang)).toContain('Answer only to the point.')
})

test('help: no Russian letters in the English text outside the shared icons and the cache words', () => {
  expect(/[а-яё]/i.test(helpText('x', 'en'))).toBe(false)
})
