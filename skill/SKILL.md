---
name: markup
description: Use Markup to review screenshots or live local web apps visually before implementing UI changes. Trigger when the user asks to open a screenshot in Markup, annotate UI feedback, review a screen graphically, inspect a Markup board, or iterate on a development server with visual feedback.
---

# Markup

<!-- markup-skill-version: 0.2.0 -->

Use Markup for these loops:

```text
screenshot -> user marks feedback -> copy annotated image and prompt -> confirm -> implement
local dev URL -> operate app -> mark feedback -> implement -> HMR/reload -> verify same path
```

## Prepare the board

Resolve the board URL in this order:

1. A URL supplied by the user.
2. The `MARKUP_URL` environment variable.
3. `http://127.0.0.1:4173/` when the local server is reachable.

Do not guess an undeclared production URL.

When a screenshot exists as a file, run the bundled helper:

```bash
node <skill-dir>/scripts/markup.mjs open --image "<path>" --url "<markup-url>"
```

If the screenshot only exists on the clipboard, open the blank Markup URL and ask the user to
paste it onto the board with `Cmd+V` or `Ctrl+V`.

## Review

1. Open the current Markup board with the available integrated browser.
2. Use screenshots, image analysis, element inspection, annotations, and console tools when
   available. Reading the generated prompt alone is not visual confirmation.
3. Let the user add ranges, pins, arrows, text, and color changes.
4. If the board cannot be inspected, ask for the annotated PNG.
5. Read the generated prompt and confirm it against the visible annotations.
6. Implement and verify the requested UI changes.
7. For live development reviews, return to the same saved screen path after HMR or reload.

## Boundaries

- Default to one screenshot.
- Do not upload source code.
- Do not invent feedback that is not visible in the returned board or prompt.
- Prefer a normal browser tab for clipboard reliability.

For API details, read `<MARKUP_URL>/docs/agent-bridge-api.md`.
