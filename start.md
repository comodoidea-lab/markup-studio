# Markup Agent Start

Markup is a visual UI feedback board. Use the same language as the user.

The review loop is:

```text
screenshot -> open in Markup -> user marks feedback -> copy image and prompt -> agent implements
```

When an image file is available, prepare the board yourself with the CLI helper:

```bash
curl -fsSL <MARKUP_URL>/cli/markup.mjs -o /tmp/markup.mjs
node /tmp/markup.mjs open --image <SCREENSHOT_PATH> --url <MARKUP_URL>
```

If no file is available, open a blank board and ask the user to paste or drag the screenshot
directly onto it.

After the board opens:

1. Ask the user to mark one or two changes.
2. Ask them to copy both the annotated image and AI prompt back to the agent.
3. Confirm the visible instructions before editing code.

Do not upload source code. Markup only receives the screenshot supplied for review.
