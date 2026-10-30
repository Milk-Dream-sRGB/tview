# tview

A small band above the prompt in the Claude desktop app: your limits, context and cache at a glance.

<p align="center">
  <img src="docs/band.png" alt="The tview band above the prompt in the Claude desktop app" width="780">
</p>

| | | | |
|---|---|---|---|
| <img src="docs/icons/five.svg" width="20" height="20"> | 5-hour limit used | <img src="docs/icons/short.svg" width="20" height="20"> | "short answer" button |
| <img src="docs/icons/reset.svg" width="20" height="20"> | time to the limit reset | <img src="docs/icons/turns.svg" width="20" height="20"> | messages / images in the chat |
| <img src="docs/icons/context.svg" width="20" height="20"> | context size of the chat | <img src="docs/icons/agents.svg" width="20" height="20"> | running subagents |
| <img src="docs/icons/read.svg" width="20" height="20"> <img src="docs/icons/write.svg" width="20" height="20"> | cache read / cache write (last turn) | <img src="docs/icons/week.svg" width="20" height="20"> | weekly limit |
| <img src="docs/icons/cache.svg" width="20" height="20"> | how long the cache stays warm | <img src="docs/icons/chat.svg" width="20" height="20"> | another chat, coloured by its cache |
| <img src="docs/icons/requests.svg" width="20" height="20"> | requests in the last turn | | |

## Install

```
/plugin install tview --marketplace Milk-Dream-sRGB/tview
```

In the desktop app: **+** next to the prompt box, **Plugins**, **Add marketplace** with `Milk-Dream-sRGB/tview`, **Add plugin**. Then type `/tview help`.

More: [details](docs/DETAILS.md) · [cache guide](CACHE_GUIDE.md) · MIT · If it helped, [say thanks](https://app.lava.top/seqvo)
