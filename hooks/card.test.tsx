import { test, expect } from 'claude-code/testing'

import { renderCard } from './card'
import { helpText } from './help'
import { DOT_GREEN, PALE_RED, PALE_YELLOW } from './shared'
import { all, button, fakeUi, shown, textOf } from './tree'

const copy = () => {}
const STATS = ['tview · статистика · 30 дн.', '## Технически', 'Окон 5 часов: 12, пик 51%', '1% лимита: ≈ 40k токенов', '## Как вы себя ведёте', 'Сообщений в чате: медиана 12'].join('\n')

test('card: a title without the plugin name, a copy button, sections and rows', () => {
  const tree = renderCard(fakeUi, STATS, copy)
  const texts = shown(tree)
  expect(texts[0]).toBe('статистика · 30 дн.')
  expect(texts).toContain('Технически')
  expect(texts).toContain('Окон 5 часов')
  expect(texts).toContain('12, пик 51%')
  expect(button(tree, 'copy')?.props.onPress).toBe(copy)
})

test('card: a value may hold colons, only the first one splits the row', () => {
  const texts = shown(renderCard(fakeUi, 'tview · статистика · x\nСтрока: до сброса: два часа', copy))
  expect(texts).toContain('Строка')
  expect(texts).toContain('до сброса: два часа')
})

test('card: statistics rows are label and value side by side', () => {
  const rows = all(renderCard(fakeUi, STATS, copy)).filter(n => n.type === 'Box' && n.props.columnGap === 2)
  expect(rows.length).toBe(3)
})

test('help: every icon stands on a line of its own above its explanation', () => {
  const tree = renderCard(fakeUi, helpText('short prompt'), copy)
  const blocks = all(tree).filter(n => n.type === 'Box' && n.props.flexDirection === 'column' && n.props.paddingX === undefined)
  expect(blocks.length).toBeGreaterThan(20)
  for (const b of blocks) {
    const kids = Array.isArray(b.props.children) ? b.props.children.flat() : [b.props.children]
    expect(kids.length).toBe(2)
    expect(kids[1].props.paddingLeft).toBe(2)
  }
})

test('help: a blank line between rows, none after a section heading', () => {
  const blocks = all(renderCard(fakeUi, helpText('x'), copy)).filter(n => n.type === 'Box' && n.props.flexDirection === 'column' && n.props.paddingX === undefined)
  expect(blocks[0]?.props.marginTop).toBe(0)
  expect(blocks[1]?.props.marginTop).toBe(1)
})

test('help in English is laid out as the Russian one: icon above the explanation', () => {
  const tree = renderCard(fakeUi, helpText('x', 'en'), copy)
  const blocks = all(tree).filter(n => n.type === 'Box' && n.props.flexDirection === 'column' && n.props.paddingX === undefined)
  expect(blocks.length).toBeGreaterThan(20)
  expect(shown(tree)[0]).toBe('help')
})

test('help: English swatch names take the same colours', () => {
  const tree = renderCard(fakeUi, helpText('x', 'en'), copy)
  const colorOf = (whole: string) => {
    const outer = all(tree).find(n => n.type === 'Text' && textOf(n) === whole && all(n).length === 3)
    return outer ? all(outer)[1]?.props.color : undefined
  }
  expect(colorOf('● green')).toBe(DOT_GREEN)
  expect(colorOf('● yellow')).toBe(PALE_YELLOW)
  expect(colorOf('● red')).toBe(PALE_RED)
})

test('help: the dots take the colour of the cache state they name', () => {
  const tree = renderCard(fakeUi, helpText('x'), copy)
  // a swatch row is a Text holding a coloured dot and the name
  const colorOf = (whole: string) => {
    const outer = all(tree).find(n => n.type === 'Text' && textOf(n) === whole && all(n).length === 3)
    return outer ? all(outer)[1]?.props.color : undefined
  }
  expect(colorOf('● зелёный')).toBe(DOT_GREEN)
  expect(colorOf('● жёлтый')).toBe(PALE_YELLOW)
  expect(colorOf('● красный')).toBe(PALE_RED)
})
