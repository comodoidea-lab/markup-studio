# Markup

UIスクリーンショットへ視覚的な修正指示を加え、AI向けのMarkdownまたはJSONプロンプトを生成するツールです。

## Features

- スクリーンショットのドラッグ＆ドロップ
- URLを指定してWebアプリをiframe内で操作しながら注釈
- 範囲、ピン、矢印、文字による注釈
- ボタンやカードの変更色を視覚的に指定
- 注釈付きPNGの生成
- AI向けMarkdown / JSONプロンプトの生成
- ブラウザ内への下書き保存
- AIエージェントからのスクリーンショット自動投入

ライブURL機能は、対象サイトがiframe表示を許可している場合に利用できます。
クロスオリジンiframeはブラウザの制約で画像へ合成できないため、注釈付きPNGが必要な場合はスクリーンショットを読み込んでください。

## Agent integration

画像ファイルがある場合、CLIヘルパーからMarkupボードを開けます。

```bash
node cli/markup.mjs open \
  --image screenshot.png \
  --url https://your-markup.example/
```

ブラウザ自動化からは`window.Markup.importBoard(payload)`または`postMessage`を利用できます。
詳細は[`docs/agent-bridge-api.md`](./docs/agent-bridge-api.md)を参照してください。

## Vercel

フレームワークやビルド処理を必要としない静的サイトです。

1. このリポジトリをVercelへインポート
2. Framework Presetは `Other` を選択
3. Build CommandとOutput Directoryは空欄のままデプロイ

Vercel版で画像のクリップボード書き込みがブラウザに拒否された場合は、注釈付きPNGを自動的にダウンロードします。

## Local development

macOSでは以下を実行します。

```bash
./start.command
```

その後、[http://127.0.0.1:4173](http://127.0.0.1:4173)を開きます。

ローカルサーバー版では、注釈付きPNGをmacOSのシステムクリップボードへ直接コピーできます。
