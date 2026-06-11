# Markup Agent Start

Markup is a visual UI feedback board. Use the same language as the user.

Use the strongest visual tools available to you. Do not assume that reading the generated
prompt means you have inspected the original UI.

Review in this order:

1. Open the current Markup board with your integrated browser.
2. Use browser screenshots, image analysis, element inspection, annotations, and console tools
   when available to inspect both the original UI and its visible annotations.
3. If the board cannot be inspected, ask for the annotated PNG.
4. At minimum, read the generated prompt and its coordinates.
5. If visual evidence and the prompt conflict, confirm with the user before editing.

## Screenshot review

```text
screenshot -> open in Markup -> user marks feedback -> agent inspects board -> implement
```

When an image file is available, prepare the board with the CLI helper:

```bash
curl -fsSL <MARKUP_URL>/cli/markup.mjs -o /tmp/markup.mjs
node /tmp/markup.mjs open --image <SCREENSHOT_PATH> --url <MARKUP_URL>
```

If no file is available, open a blank board and ask the user to paste or drag the screenshot.

After the board opens:

1. Ask the user to mark one or two changes.
2. Inspect the board yourself when browser tools are available.
3. Otherwise ask for both the annotated PNG and AI prompt.
4. Confirm the visible instructions before editing code.

## Live development review

When the prompt includes a development server and screen path:

1. Confirm that an editable repository or local source tree is available.
2. Open the development server and the exact screen path in Markup.
3. Keep the same screen path while editing.
4. Make the requested code change.
5. Wait for HMR, or use Markup's reload control.
6. Reinspect the same screen with browser screenshots, element inspection, and console logs.
7. Preserve annotations during reload; treat a different path as a separate screen review.

The embedded app may optionally report client-side route changes:

```js
window.parent.postMessage(
  { type: "markup:route", href: window.location.href },
  "https://your-markup.example"
);
```

Do not upload source code to Markup. Markup receives only screenshots, URLs, paths, and review
annotations.
