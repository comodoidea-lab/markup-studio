# Markup Agent Bridge API

Markup accepts one screenshot from an AI agent and keeps the review board local to the browser.

## Direct page API

```js
await window.Markup.ready();

const result = await window.Markup.importBoard({
  boardId: "home-review",
  title: "Home screen review",
  images: [
    {
      id: "screen-1",
      role: "primary",
      src: "data:image/png;base64,..."
    }
  ]
});
```

Available methods:

- `ready()`
- `importBoard(payload)`
- `clearBoard({ boardId? })`
- `getSnapshot()`

The board is saved in IndexedDB and its URL becomes `#local=<boardId>`.

## postMessage bridge

Open the board with a random token:

```text
https://your-markup.example/?token=<random-token>
```

Then send:

```js
boardWindow.postMessage(
  {
    type: "markup:import",
    token,
    requestId,
    payload
  },
  "https://your-markup.example"
);
```

Markup responds with `markup:ack` or `markup:error` using the same `requestId`.

Without a URL token, cross-origin messages are rejected. Same-origin messages are accepted.

## CLI helper

```bash
node cli/markup.mjs open \
  --image screenshot.png \
  --title "UI Review" \
  --url https://your-markup.example/
```

Set `MARKUP_URL` to omit `--url`.

The CLI creates a temporary launcher under the operating system temporary directory. It does
not write generated launcher files into the user project.

## Optional live route bridge

An app embedded by the live URL review can notify Markup when its client-side route changes:

```js
window.parent.postMessage(
  {
    type: "markup:route",
    href: window.location.href
  },
  "https://your-markup.example"
);
```

Markup accepts this message only from the currently embedded frame and its configured origin.
Changing the path clears annotations; reloading the same path preserves them.
