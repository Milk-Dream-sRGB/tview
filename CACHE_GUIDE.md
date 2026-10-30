# Cheat sheet: cache, tokens and context in the tview band

A short reference to quickly recall what the numbers in the band mean and how to act on them.
This is a user guide, not part of the mod's README.

## 1. The main points in three lines

- **Context** (the icon with a gauge in the middle) is how "thick" the chat is right now. It is a single size indicator.
- **The four numbers on the right** (read, write, input, output) are what the **whole last turn** cost, summed over all of its requests.
- Do not worry about a large read; worry about a **jump in write** and a **bloated context**.

## 2. What each icon shows

| Icon | Name | Meaning |
|---|---|---|
| Bright box, grey core | Cache read | How many context tokens the server took from the ready cache. Cheap: about 0.1 of the price of regular input |
| Faint box, bright core | Cache write | New tokens added to the cache on this turn. 1.25× (up to 2× on the one-hour cache) of regular input |
| Inverted stack | Requests in the turn (0.53.0) | How many requests to the model the turn made; it stands after the cache write. It explains where a large read comes from: context × number of requests |
| Dot at the bottom | New input | Tokens outside the cache: the tail after the last cache mark. **Not the size of your message.** Since 0.53.0 it shows only from 50 per turn (odd behaviour, a possible cache miss) |
| Arrow up | Output | What Claude wrote. The most expensive tokens, about 5× regular input |
| Snowflake | Cache timer | Six arms of 10 minutes each, they go out one by one. All out means the cache has cooled |
| Line with a tick (`176k`) | Context | How much of the chat is occupied. Orange from 200k, red from 400k |
| `80/5` | Messages / images | Messages and images sent in the chat |

## 3. How to read the numbers

**A turn is not one request.** A "turn" is the whole answer to your message. If Claude called 17 tools, that is 17 requests, and each one reads the entire context again.
So a read of 3-5M in the band is normal: context 176k × ~17 steps ≈ 3M. It does not mean "3M is sitting in the cache".

**All four numbers on the right are sums over the whole turn**, not over the last request. The only "instant" number is the context (its state at the last request).

**What counts as output.** Not only the visible text: also commands and scripts for tools, the contents of written files (a 313-line translation file was the main part of 17k), the remarks between steps, and the final answer. That is why output can be large with a short closing message.

**Estimate of the context size for a turn:** read + write + input ≈ context.

**Why "new input = 10 tokens" for two paragraphs.** The message goes almost entirely into the cache **write**; only the tail stays in "input". You cannot see the size of your own message in the band. For Russian, a rule of thumb: 1 token per 2-3 characters, two paragraphs ≈ 300-600 tokens.

**Where the data comes from.** The API's own counters (per request); the mod sums them over the turn (`turn.complete`). You can trust them, but the categories depend on the cache, not on "what I sent".
For a breakdown of the context by composition (instructions, tools, history, files) there is the built-in `/context` command.

## 4. What it costs (in "regular input tokens")

Anthropic does not publish the exact weights of the subscription limit. A rough guide using API coefficients:

| Item | Coefficient |
|---|---|
| Cache read | 0.1× |
| Cache write | 1.25× (one-hour cache up to 2×) |
| New input | 1× |
| Output | ~5× |

Example turn: read 3.0M, write 88k, output 36k ≈ 300k + ~110-175k + ~180k ≈ **600-650k** conventional tokens. The read gives about half, although in number it is tens of times bigger than the rest.

Look up the real price of 1% of the limit in `/tview` ("how many tokens 1% of the limit costs", the most expensive chat). It is more reliable than the coefficients above.

## 5. Signals and what to do

| What you see | Meaning | Action |
|---|---|---|
| Read is large, write 1-10k | Normal work, the cache is warm | Nothing |
| Write ≈ the whole context (hundreds of k) | The cache cooled, the context was written again: an expensive turn | Do not pause for more than an hour in a big chat; compact before a pause |
| Context grows, 200k turns orange | Every turn gets more expensive, the model holds details worse | Plan a `/compact` at a task boundary |
| Context is red (400k+) | Expensive and imprecise | A new chat with a summary |
| Output is large | The limit goes to long answers | Ask for shorter answers and targeted edits |
| Read jumped within a turn | Many steps with tools | Narrow the task: "find X in file Y", not "study the project" |

## 6. How not to produce extra writes

A write is unavoidable for new text. What hurts is the **extra** one:

| What inflates it | How to avoid it |
|---|---|
| A cooled cache | Do not leave for more than an hour in a thick chat |
| Reading whole files | Ask for specific parts |
| Large command outputs and logs | `head` / `grep`, do not paste walls of text |
| Changing the model, editing CLAUDE.md or MCP in the middle of a chat | Do it at the start of a new chat |
| Heavy searches across the project | Hand them to agents (their own context, only the result comes back) |
| Images and PDFs | Attach only when needed |

## 7. The 5-hour limit and the cache lifetime

- While the limit is below 100%, the cache lives about 1 hour (subscription). At 97% nothing changes.
- The lifetime drops to 5 minutes when the session goes into **usage overage** (paid volume beyond the plan). This is my understanding of how the engine behaves, not confirmed by official documentation.
- Without Extra usage, at 100% you are simply stopped until the reset; the cache is not shortened.
- The mod always counts by the hour (`CACHE_TTL_MS`), so in overage the snowflake may be wrong.

**Scenario:** 97%, reset in 20 minutes, cache has 40 minutes left. Waiting for the reset is sensible: the cache survives the wait (40 > 20), and you continue on a fresh window. One limit: do not wait longer than what is left until the cache cools.
A single agent turn with 3-5M of reads can eat the remaining 3% and throw you into a block in the middle of a task.

## 8. When to `/compact`

| Context | Action |
|---|---|
| Up to ~150k | Too early |
| 150-250k | A good zone, at a task boundary |
| 250-400k | Already worth it |
| 400k+ | Better a new chat with a summary |

Rules:
1. Compact **between tasks**, not in the middle: details are lost in the summary.
2. While the **cache is warm** (the snowflake is lit): the compacting request reads the context cheaply.
3. **Before a pause**, not after it.
4. With a hint: `/compact keep the decisions, the current format and the open questions`.
5. If the task changed completely, a new chat is cleaner and cheaper.
6. Images are most likely lost in the summary; attach them again if needed.

**Compact before leaving.** Example 176k → ~70k:

| Scenario | Cost (conventional tokens) |
|---|---|
| Compact and leave | read 176k (0.1×) + summary (~15-30k × 5) + write of the new ~70k ≈ 170-250k |
| Leave without compacting, return after the cache cooled | write of all 176k ≈ 220-350k |
| Every next turn of 17 steps | read 176k against 70k: ~300k against ~120k |

Conclusion: a compact before a long absence (more than ~40 minutes until the cache cools) pays off, roughly within one turn. For up to ~40 minutes it is not needed for the sake of the cache.
Leaving until tomorrow with a different task: a new chat with a short summary.

## 9. Known limitations of the mod

- The cache lifetime is fixed at 1 hour; in overage (5 minutes) the snowflake does not know.
- After a manual `/compact` the snowflake does not update.
- The band sums per turn, so "write 8k" may be one large tool result, not your text.
- When exactly the engine writes the new context after `/compact` (immediately or on the first turn) is not known for certain; the calculations assume the first turn.
