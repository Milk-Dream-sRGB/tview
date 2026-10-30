export type Limit = { percent: number; resetsAt?: string }
export type Saved = { tokens?: Tokens | null; images?: number | null; turns?: number | null; ctx?: { percent: number; tokens?: number } | null }
// `steps`: how many requests the turn made (absent in records saved before 0.53.0)
export type Tokens = { read: number; written: number; fresh: number; output: number; at: number; steps?: number }

declare module 'claude-code' {
  interface PluginState {
    tview: {
      five: Limit | null
      week: Limit | null
      ctx: { percent: number; tokens?: number } | null
      tokens: Tokens | null
      now: number; brief: boolean; renewDay: number | null; images: number | null; turns: number | null; agents: string[]; others: { at: number; link: string }[]; watched: { five?: { id: string; pct: number }; week?: { id: string; pct: number } } | null; trouble: { others?: string; stats?: string; open?: string }
    }
  }
}
