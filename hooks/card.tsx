import type { ClientElements, UiPressArgument } from 'claude-code'

import { swatchOf } from './shared'

// The answer of /tview as a card: a title with Copy, `## Section` headings, a muted label and its value
// per `label: value` line. Pure: the text and the press come in. `text` starts at the title line.
export function renderCard({ Box, Text, Button }: ClientElements, text: string, copy: (press: UiPressArgument) => void) {
  const [head = '', ...lines] = text.split('\n')
  // The legend (help) is laid out differently from the statistics: see below
  const spaced = head.includes('справка') || head.endsWith('· help')
  return (
    <Box flexDirection="column" borderStyle="round" borderDimColor paddingX={2} paddingY={1} marginY={1}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold>{head.replace('tview · ', '')}</Text>
        <Button key="copy" plain label="⧉ copy" onPress={copy} />
      </Box>
      {lines.map((line, i) => {
        if (line.startsWith('## ')) {
          return <Box key={`l${i}`} marginTop={i === 0 ? 0 : 1}><Text bold dimColor>{line.slice(3)}</Text></Box>
        }
        const cut = line.indexOf(': ')
        if (cut < 0) return <Text key={`l${i}`} dimColor>{line}</Text>
        const label = line.slice(0, cut)
        const value = line.slice(cut + 2)
        const swatch = swatchOf(label)
        // The label, drawn in its swatch colour when it has one
        const name = swatch
          ? <Text><Text color={swatch}>{label[0]}</Text><Text bold={spaced} dimColor={!spaced}>{label.slice(1)}</Text></Text>
          : <Text dimColor={!spaced} bold={spaced}>{label}</Text>
        // The legend has long, wrapping rows: the icon goes on a line of its own above its explanation,
        // and a blank line sets one row off from the next, so a block of text never reads as another's
        if (spaced) {
          return (
            <Box key={`l${i}`} flexDirection="column" marginTop={lines[i - 1]?.startsWith('## ') || i === 0 ? 0 : 1}>
              {name}
              <Box paddingLeft={2}><Text>{value}</Text></Box>
            </Box>
          )
        }
        return (
          <Box key={`l${i}`} columnGap={2}>
            <Box width={24} flexShrink={0}>{name}</Box>
            <Box flexGrow={1} flexShrink={1}><Text>{value}</Text></Box>
          </Box>
        )
      })}
    </Box>
  )
}
