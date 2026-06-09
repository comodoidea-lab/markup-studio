---
name: markup
description: Use Markup to review app or website screenshots visually before implementing UI changes. Trigger when the user asks to open a screenshot in Markup, annotate UI feedback, review a screen graphically, or prepare a visual review board for an AI coding agent.
---

# Markup

<!-- markup-skill-version: 0.1.0 -->

Use Markup for this loop:

```text
screenshot -> user marks feedback -> copy annotated image and prompt -> confirm -> implement
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

1. Let the user add ranges, pins, arrows, text, and color changes.
2. Ask them to use `画像をコピー` and `Copy AI prompt`.
3. Read the returned image and prompt.
4. Confirm the visible requested changes before editing code.
5. Implement and verify the requested UI changes.

## Boundaries

- Default to one screenshot.
- Do not upload source code.
- Do not invent feedback that is not visible in the returned board or prompt.
- Prefer a normal browser tab for clipboard reliability.

For API details, read `<MARKUP_URL>/docs/agent-bridge-api.md`.
