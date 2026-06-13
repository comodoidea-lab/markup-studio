# Markup Studio

AIでUIをデザイン・生成・編集し、コードまで出力するビジュアルワークスペースです。
スクリーンショットやWebアプリへの注釈レビュー(従来のMarkup)も統合されています。

## モード

### デザインモード

- **無限キャンバス** — パン/ズーム、複数フレーム(Mobile / Tablet / Desktop)を並べて編集
- **ノードベース編集** — Box / Text / Button / Input / Image をflexレイアウト(Auto Layout)で構成
- **レイヤーパネルとインスペクタ** — 余白・サイズ・色・角丸・影・タイポグラフィをGUIで編集
- **多段 undo/redo** (⌘Z / ⇧⌘Z)
- **AI画面生成 (BYOK)** — プロンプト(+参考スクリーンショット)から編集可能なフレームを生成
- **インラインAI編集** — 要素を選択して「もっと目立たせて」のように指示すると、その部分だけAIが修正
- **コード出力** — React (TSX) と HTML+CSS をワンクリックでコピー/ダウンロード、iframeライブプレビュー付き

### レビューモード

- スクリーンショットのドラッグ＆ドロップ / クリップボード貼り付け
- ライブURL(開発サーバー)をiframeで操作しながら注釈
- 範囲・ピン・矢印・文字・色の5種注釈と修正指示カード
- AI向け Markdown / JSON プロンプト生成、注釈付きPNGのコピー/保存
- **AIで編集可能なデザインに変換** — スクリーンショット+注釈からデザインモードのフレームを生成

## AI設定 (BYOK)

Cloudflare Workers にデプロイした場合、**Workers AI**（`@cf/google/gemma-3-12b-it`）が `/api/generate` 経由で使われます。APIキー不要です。

`npm run dev`（Vite + Cloudflare プラグイン）ではローカルでも `/api/generate` が使えます。BYOK へのフォールバックは `VITE_USE_WORKERS_AI=false` 時のみです。

右上の「APIキーを設定」から、Anthropic (Claude) / OpenAI (GPT) / Google (Gemini) の
いずれかのAPIキーを登録できます（フォールバック用）。キーはブラウザのlocalStorageにのみ保存され、
各プロバイダのAPIへ直接送信されます(サーバーには送信されません)。

`VITE_USE_WORKERS_AI=false` でビルドすると、常に BYOK モードになります。

## Cloudflare Workers

`wrangler.jsonc` と `worker/` で Workers AI バックエンドを提供します（`@cloudflare/vite-plugin` 使用）。

```bash
npm install
npm run build
npm run deploy                # Cloudflare Workers へデプロイ
npm run dev                   # Vite + Worker をローカルで起動
```

- **エンドポイント:** `POST /api/generate` — `{ system, user, imageDataUrl?, maxTokens? }` → `{ text }`
- **モデル:** `@cf/google/gemma-3-12b-it`（Workers AI 無料枠内）
- **静的アセット:** `dist/`（Vite ビルド）

## Vercel

`vercel.json` で設定済みです。リポジトリをインポートするだけでデプロイできます
(Framework: Vite / Build: `npm run build` / Output: `dist`)。

### キャンバスのみ表示 (埋め込みビュー)

`/?embed=canvas` を開くと、ヘッダーやパネルなしで無限キャンバスのみが表示されます
(自動で全体フィット)。デザインモードのヘッダーにある「キャンバスのみURL」ボタンで
コピーでき、レビューモードの Live URL に貼り付けると、自分のデザインボードだけを
注釈レビューできます。

## Agent integration

画像ファイルがある場合、CLIヘルパーからMarkupボードを開けます。

```bash
node cli/markup.mjs open \
  --image screenshot.png \
  --url https://your-markup.example/
```

ブラウザ自動化からは `window.Markup.importBoard(payload)` または `postMessage` を利用できます。
詳細は [`public/docs/agent-bridge-api.md`](./public/docs/agent-bridge-api.md) を参照してください。
従来の Agent Bridge API / Skill とは互換です。

## 開発

```bash
npm install
npm run dev      # http://localhost:4173
npm run build    # 型チェック + 本番ビルド (dist/)
```

技術スタック: Vite + React + TypeScript + Zustand + Tailwind CSS + Cloudflare Workers。
保存はブラウザ内(IndexedDB / localStorage)のみ。AI生成は Workers AI または BYOK。

## レガシー版

リライト前のバニラJS版は [`legacy/`](./legacy) に残しています。
macOSのシステムクリップボード中継(`server.py`)はローカル利用時に引き続き動作します。
