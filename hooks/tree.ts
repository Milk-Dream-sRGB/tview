// Test helpers: stand-in elements that turn a tree into plain data, and a way to read it. The views
// take their elements as an argument, so a test needs no engine to see what a person would see.
type Node = { type: string; props: Record<string, unknown> & { children?: unknown } }

const mk = (name: string) => (props: Record<string, unknown>) => ({ type: name, props }) as Node
export const fakeUi = { Box: mk('Box'), Text: mk('Text'), Button: mk('Button') } as never

const kids = (n: Node): unknown[] => (Array.isArray(n.props.children) ? n.props.children.flat(Infinity) : n.props.children === undefined ? [] : [n.props.children])
const isNode = (x: unknown): x is Node => typeof x === 'object' && x !== null && 'type' in x

// Every element of the tree, outermost first
export function all(tree: unknown): Node[] {
  if (!isNode(tree)) return []
  return [tree, ...kids(tree).flatMap(all)]
}
// The text a Text element shows, its nested Texts included
export const textOf = (n: Node): string => kids(n).map(k => (isNode(k) ? textOf(k) : k === false || k == null ? '' : String(k))).join('')
// What a person reads on the tree, one entry per Text and per Button label
export const shown = (tree: unknown) => all(tree).filter(n => n.type === 'Text' && !all(n).slice(1).some(c => c.type === 'Text')).map(textOf)
export const buttons = (tree: unknown) => all(tree).filter(n => n.type === 'Button')
export const button = (tree: unknown, key: string) => buttons(tree).find(b => b.props.key === key)
