import { useCallback, useEffect, useRef, useState } from "react";
import { useReviewStore } from "./reviewStore";
import { Stage } from "./Stage";
import { buildPromptText } from "./promptGen";
import {
  canvasToPngBlob,
  copyPngToClipboard,
  createAnnotatedCanvas,
  downloadPng,
  writeClipboardText,
} from "./annotatedPng";
import { showToast } from "../ui/toast";
import { useAppStore } from "../state/appStore";
import { useSettingsStore } from "../state/settingsStore";
import { generateScreen } from "../ai/actions";
import {
  ArrowUpRight,
  Clipboard,
  Eraser,
  Image as ImageIcon,
  Loader2,
  MapPin,
  Palette,
  Plus,
  Sparkles,
  Square,
  Type,
  Undo2,
} from "lucide-react";

const TOOLS = [
  ["rect", "範囲", Square],
  ["pin", "ピン", MapPin],
  ["arrow", "矢印", ArrowUpRight],
  ["text", "文字", Type],
  ["color", "色", Palette],
] as const;

function InstructionCards({ listRef }: { listRef: React.RefObject<HTMLDivElement> }) {
  const annotations = useReviewStore((state) => state.annotations);
  const updateAnnotation = useReviewStore((state) => state.updateAnnotation);
  const removeAnnotation = useReviewStore((state) => state.removeAnnotation);

  const coordsLabel = (a: (typeof annotations)[number]) => {
    if (a.kind === "pin" || a.kind === "text") {
      return `pin · x ${a.x.toFixed(1)}% · y ${a.y.toFixed(1)}%`;
    }
    if (a.kind === "arrow") {
      return `arrow · x1 ${a.x.toFixed(1)}% · y1 ${a.y.toFixed(1)}% · x2 ${(a.endX ?? 0).toFixed(1)}% · y2 ${(a.endY ?? 0).toFixed(1)}%`;
    }
    return `area · x ${a.x.toFixed(1)}% · y ${a.y.toFixed(1)}% · w ${(a.width ?? 0).toFixed(1)}% · h ${(a.height ?? 0).toFixed(1)}%`;
  };

  if (!annotations.length) {
    return (
      <div className="flex items-start gap-2 rounded-xl border border-dashed border-slate-200 p-3 text-xs text-slate-500">
        <span className="font-bold text-slate-300">01</span>
        <p>左の画面で修正したい場所をドラッグして囲んでください。</p>
      </div>
    );
  }

  return (
    <div ref={listRef} className="flex flex-col gap-2">
      {annotations.map((annotation, index) => (
        <article key={annotation.id} className="rounded-xl border border-slate-200 bg-white p-2.5">
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-orange-500">
              {String(index + 1).padStart(2, "0")}
            </span>
            <select
              className="rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-700 focus:outline-none"
              value={annotation.type}
              onChange={(event) =>
                updateAnnotation(annotation.id, {
                  type: event.target.value as typeof annotation.type,
                })
              }
            >
              <option value="layout">レイアウト</option>
              <option value="style">見た目</option>
              <option value="copy">テキスト</option>
              <option value="remove">削除</option>
              <option value="behavior">動作</option>
            </select>
            <button
              className="ml-auto rounded p-0.5 text-slate-400 hover:bg-red-50 hover:text-red-500"
              title="この指示を削除"
              onClick={() => removeAnnotation(annotation.id)}
            >
              ×
            </button>
          </div>
          <textarea
            rows={2}
            className="mt-1.5 w-full resize-none rounded-lg border border-slate-200 px-2 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
            placeholder={
              annotation.kind === "color"
                ? "例：このカードの背景色を変更する"
                : "例：見出しを左揃えにして、上下の余白を広げる"
            }
            value={annotation.text}
            onChange={(event) => updateAnnotation(annotation.id, { text: event.target.value })}
          />
          {annotation.kind === "color" && (
            <div className="mt-1.5 flex items-center gap-2 text-[11px] text-slate-500">
              <span>変更後の色</span>
              <input
                type="color"
                className="h-5 w-7 cursor-pointer rounded border border-slate-200"
                value={annotation.color ?? "#2563eb"}
                onChange={(event) =>
                  updateAnnotation(annotation.id, { color: event.target.value })
                }
              />
              <code>{annotation.color}</code>
            </div>
          )}
          <p className="mt-1.5 font-mono text-[10px] text-slate-400">{coordsLabel(annotation)}</p>
        </article>
      ))}
    </div>
  );
}

export function ReviewMode() {
  const store = useReviewStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const stageWrapRef = useRef<HTMLDivElement>(null);
  const [urlDraft, setUrlDraft] = useState("");
  const [dragging, setDragging] = useState(false);
  const [recreating, setRecreating] = useState(false);
  const setMode = useAppStore((state) => state.setMode);
  const hasKey = useSettingsStore((state) => Boolean(state.keys[state.provider]));
  const openSettings = useSettingsStore((state) => state.openSettings);

  const promptText = buildPromptText(
    store.annotations,
    {
      isLive: store.sourceType === "live",
      liveOrigin: store.liveOrigin,
      livePath: store.livePath,
      liveUrl: store.liveUrl,
    },
    store.outputFormat,
  );

  const loadImageFile = useCallback(
    (file: File | undefined | null) => {
      if (!file || !file.type.startsWith("image/")) return;
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        store.loadImage(String(reader.result), file.name || "Clipboard image");
      });
      reader.readAsDataURL(file);
    },
    [store],
  );

  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const items = event.clipboardData?.items || [];
      for (const item of items) {
        if (item.kind === "file" && item.type.startsWith("image/")) {
          event.preventDefault();
          loadImageFile(item.getAsFile());
          showToast("クリップボードの画像を読み込みました");
          return;
        }
      }
    };
    document.addEventListener("paste", onPaste);
    return () => document.removeEventListener("paste", onPaste);
  }, [loadImageFile]);

  const pasteFromClipboard = async () => {
    if (!navigator.clipboard?.read) {
      showToast("このブラウザでは直接読み取れません。⌘Vで画像を貼り付けてください", 4000);
      return;
    }
    try {
      const items = await navigator.clipboard.read();
      for (const item of items) {
        const imageType = item.types.find((type) => type.startsWith("image/"));
        if (!imageType) continue;
        const blob = await item.getType(imageType);
        loadImageFile(new File([blob], "clipboard.png", { type: imageType }));
        showToast("クリップボードの画像を読み込みました");
        return;
      }
      showToast("クリップボードに画像がありません", 3000);
    } catch {
      showToast("読み取りが許可されませんでした。⌘Vで画像を貼り付けてください", 4000);
    }
  };

  const copyPrompt = async (withHandoff: boolean) => {
    if (!store.annotations.length) {
      showToast("先に注釈を追加してください");
      return;
    }
    const text = withHandoff ? `Markupの指示どおり修正して\n\n${promptText}` : promptText;
    const copied = await writeClipboardText(text);
    showToast(
      copied
        ? withHandoff
          ? "エージェントへ渡す内容をコピーしました"
          : `AIプロンプトをコピーしました（${text.length}文字）`
        : "コピーできませんでした。プロンプト欄から手動でコピーしてください",
      copied ? 2200 : 3500,
    );
  };

  const exportPng = async (download: boolean) => {
    if (!store.annotations.length) {
      showToast("先に注釈を追加してください");
      return;
    }
    if (store.sourceType === "live") {
      showToast("ライブ画面は画像化できません。スクリーンショットを読み込んでください", 3500);
      return;
    }
    if (!store.imageSrc) {
      showToast("画像を読み込んでください", 3000);
      return;
    }
    try {
      const wrap = stageWrapRef.current;
      const ratio = wrap && wrap.clientHeight > 0 ? wrap.clientWidth / wrap.clientHeight : 16 / 10;
      const canvas = await createAnnotatedCanvas(store.imageSrc, store.annotations, ratio);
      const blob = await canvasToPngBlob(canvas);
      if (download) {
        downloadPng(blob);
        showToast("注釈付きPNGを保存しました", 3000);
        return;
      }
      const result = await copyPngToClipboard(blob);
      showToast(
        result === "copied"
          ? "注釈付き画像をコピーしました"
          : "画像コピーが許可されないため、PNGで保存しました",
        result === "copied" ? 2200 : 4000,
      );
    } catch (error) {
      showToast((error as Error).message || "注釈付き画像を生成できませんでした", 3500);
    }
  };

  const recreateWithAI = async () => {
    if (store.sourceType !== "image" || !store.imageSrc) {
      showToast("スクリーンショットを読み込んでから実行してください", 3000);
      return;
    }
    if (!hasKey) {
      openSettings(true);
      return;
    }
    setRecreating(true);
    try {
      const instructions = store.annotations.length
        ? `\n\n以下の注釈指示も反映してください:\n${buildPromptText(store.annotations, { isLive: false }, "markdown")}`
        : "";
      const prompt = `添付スクリーンショットのUIを忠実に再現してください。${instructions}`;
      await generateScreen(prompt, 390, 844, store.imageSrc);
      setMode("design");
      showToast("デザインモードに編集可能な画面を生成しました", 3500);
    } catch {
      showToast("生成に失敗しました。AI設定を確認してください", 3500);
    } finally {
      setRecreating(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 gap-4 overflow-y-auto p-4">
      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-0.5 rounded-xl border border-[#d9d9d0] bg-white p-1 shadow-sm">
            {TOOLS.map(([tool, label, Icon]) => (
              <button
                key={tool}
                className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium ${
                  store.activeTool === tool
                    ? "bg-[#fff0eb] text-[#ff5a36]"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
                onClick={() => store.setTool(tool)}
              >
                <Icon size={13} /> {label}
              </button>
            ))}
            <input
              type="color"
              className="ml-1 h-6 w-7 cursor-pointer rounded border border-slate-200"
              title="指定する色"
              value={store.selectedColor}
              onChange={(event) => store.setColor(event.target.value)}
            />
          </div>
          <span className="text-xs text-slate-400">{store.annotations.length} annotations</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => void exportPng(false)}
            >
              画像をコピー
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs text-slate-600 hover:bg-slate-50"
              onClick={() => void exportPng(true)}
            >
              PNG保存
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              title="ひとつ戻す"
              disabled={!store.annotations.length}
              onClick={store.undo}
            >
              <Undo2 size={13} />
            </button>
            <button
              className="rounded-lg border border-slate-200 bg-white p-1.5 text-slate-600 hover:bg-slate-50 disabled:opacity-40"
              title="すべて消去"
              disabled={!store.annotations.length}
              onClick={store.clearAnnotations}
            >
              <Eraser size={13} />
            </button>
          </div>
        </div>

        <div
          ref={stageWrapRef}
          className={`relative rounded-xl ${dragging ? "ring-2 ring-blue-400" : ""}`}
          onDragEnter={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={(event) => {
            event.preventDefault();
            setDragging(false);
          }}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            loadImageFile(event.dataTransfer.files[0]);
          }}
        >
          <Stage
            onAnnotationAdded={() => {
              requestAnimationFrame(() => {
                const textareas = listRef.current?.querySelectorAll("textarea");
                textareas?.[textareas.length - 1]?.focus();
              });
            }}
          />
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => fileRef.current?.click()}
          >
            <Plus size={13} /> ファイルを選ぶ
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => {
              loadImageFile(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50"
            onClick={() => void pasteFromClipboard()}
          >
            <Clipboard size={13} /> クリップボードから追加
          </button>
          <form
            className="flex flex-1 items-center gap-1.5"
            onSubmit={(event) => {
              event.preventDefault();
              try {
                store.openLiveUrl(urlDraft);
                showToast("Webアプリを開きました。表示されない場合はiframeが禁止されています", 4000);
              } catch (error) {
                showToast((error as Error).message, 3500);
              }
            }}
          >
            <span className="text-[11px] font-bold tracking-wide text-slate-400 uppercase">
              Live URL
            </span>
            <input
              type="url"
              className="min-w-40 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
              placeholder="http://localhost:3000 または https://example.com"
              value={urlDraft}
              onChange={(event) => setUrlDraft(event.target.value)}
              required
            />
            <button
              type="submit"
              className="rounded-lg bg-slate-800 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
            >
              Webアプリを開く
            </button>
          </form>
        </div>
        <p className="text-[11px] text-slate-400">
          iframe表示を禁止しているサイトは開けません。ライブ画面では注釈付き画像のコピーは利用できません。
          このアプリ自身のデザインボードをレビューするには <code>{location.origin}/?embed=canvas</code>{" "}
          を指定するとキャンバスのみ表示されます。
        </p>
      </div>

      <aside className="flex w-[340px] shrink-0 flex-col gap-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Instructions
            </p>
            <h2 className="text-sm font-bold text-slate-800">修正指示</h2>
          </div>
          <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-100 text-xs font-bold text-orange-600">
            {store.annotations.length}
          </span>
        </div>

        <div className="max-h-[40vh] overflow-y-auto">
          <InstructionCards listRef={listRef} />
        </div>

        <div className="flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                Output
              </p>
              <h3 className="text-[13px] font-bold text-slate-800">AI prompt</h3>
            </div>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-[11px]">
              {(["markdown", "json"] as const).map((format) => (
                <button
                  key={format}
                  className={`px-2.5 py-1 font-semibold ${
                    store.outputFormat === format
                      ? "bg-slate-800 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                  onClick={() => store.setFormat(format)}
                >
                  {format === "markdown" ? "MD" : "JSON"}
                </button>
              ))}
            </div>
          </div>
          <pre className="max-h-44 overflow-auto rounded-lg bg-slate-50 p-2.5 text-[10.5px] leading-relaxed whitespace-pre-wrap text-slate-600">
            {promptText || "注釈を追加すると、ここにAI向けの指示が生成されます。"}
          </pre>
          <div className="flex gap-1.5">
            <button
              className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              onClick={() => void copyPrompt(false)}
            >
              Copy prompt
            </button>
            <button
              className="flex-1 rounded-lg bg-slate-900 px-2 py-1.5 text-xs font-semibold text-white hover:bg-slate-800"
              onClick={() => void copyPrompt(true)}
            >
              Insert into agent
            </button>
          </div>
        </div>

        <button
          className="flex items-center justify-center gap-2 rounded-xl border border-violet-200 bg-gradient-to-r from-violet-50 to-fuchsia-50 px-3 py-2.5 text-xs font-bold text-violet-700 hover:border-violet-300 disabled:opacity-50"
          disabled={recreating || store.sourceType !== "image"}
          title="スクリーンショットをAIで編集可能なデザインとして再現し、注釈も反映します"
          onClick={() => void recreateWithAI()}
        >
          {recreating ? (
            <Loader2 size={14} className="animate-spin" />
          ) : (
            <Sparkles size={14} />
          )}
          AIで編集可能なデザインに変換
        </button>

        {store.sourceType === "image" && store.imageSrc && (
          <p className="flex items-center gap-1 text-[10.5px] text-slate-400">
            <ImageIcon size={11} /> {store.boardTitle}
          </p>
        )}
      </aside>
    </div>
  );
}
