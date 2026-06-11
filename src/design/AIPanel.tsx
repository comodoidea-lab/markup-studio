import { useRef, useState } from "react";
import { useDesignStore } from "../state/designStore";
import { useSettingsStore } from "../state/settingsStore";
import { generateScreen } from "../ai/actions";
import { DEVICE_PRESETS } from "../state/nodeUtils";
import { ImagePlus, Loader2, Send, Settings2, Sparkles, X } from "lucide-react";

export function AIPanel() {
  const chat = useDesignStore((state) => state.chat);
  const aiBusy = useDesignStore((state) => state.aiBusy);
  const select = useDesignStore((state) => state.select);
  const hasKey = useSettingsStore((state) => Boolean(state.keys[state.provider]));
  const provider = useSettingsStore((state) => state.provider);
  const model = useSettingsStore((state) => state.models[state.provider]);
  const openSettings = useSettingsStore((state) => state.openSettings);

  const [prompt, setPrompt] = useState("");
  const [device, setDevice] = useState<(typeof DEVICE_PRESETS)[number]["id"]>("mobile");
  const [image, setImage] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const logRef = useRef<HTMLDivElement>(null);

  const run = async () => {
    if (!prompt.trim() || aiBusy) return;
    if (!hasKey) {
      openSettings(true);
      return;
    }
    const preset = DEVICE_PRESETS.find((item) => item.id === device)!;
    const text = prompt;
    const attachedImage = image ?? undefined;
    setPrompt("");
    setImage(null);
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight });
    });
    await generateScreen(text, preset.width, preset.height, attachedImage).catch(() => {});
    requestAnimationFrame(() => {
      logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" });
    });
  };

  const onPickImage = (file: File | undefined) => {
    if (!file || !file.type.startsWith("image/")) return;
    const reader = new FileReader();
    reader.addEventListener("load", () => setImage(String(reader.result)));
    reader.readAsDataURL(file);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-slate-200 px-3 py-2">
        <span className="flex items-center gap-1.5 text-[11px] font-bold tracking-wider text-slate-500 uppercase">
          <Sparkles size={12} className="text-violet-500" /> AI generate
        </span>
        <button
          className="flex max-w-[55%] items-center gap-1 rounded-md px-1.5 py-0.5 text-[10.5px] text-slate-500 hover:bg-slate-100"
          onClick={() => openSettings(true)}
          title="AI設定"
        >
          <Settings2 size={11} className="shrink-0" />
          <span className="truncate whitespace-nowrap">
            {provider} / {model}
          </span>
        </button>
      </div>

      <div ref={logRef} className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
        {chat.length === 0 && (
          <div className="rounded-xl border border-dashed border-slate-200 px-3 py-4 text-xs leading-relaxed text-slate-500">
            作りたい画面を文章で指示すると、編集可能なフレームとして生成されます。
            <br />
            <span className="text-slate-400">
              例: 「音楽ストリーミングアプリのホーム画面。今日のおすすめ、最近聴いた曲、プレイリスト一覧」
            </span>
          </div>
        )}
        {chat.map((message) => (
          <div
            key={message.id}
            className={`max-w-[95%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-wrap ${
              message.role === "user"
                ? "ml-auto bg-blue-600 text-white"
                : message.kind === "error"
                  ? "border border-red-200 bg-red-50 text-red-700"
                  : "border border-slate-200 bg-white text-slate-700"
            }`}
          >
            {message.content}
            {message.frameId && (
              <button
                className="mt-1 block text-[11px] font-semibold text-violet-600 hover:underline"
                onClick={() => select(message.frameId!)}
              >
                フレームを選択 →
              </button>
            )}
          </div>
        ))}
        {aiBusy && (
          <div className="flex items-center gap-2 px-1 text-xs text-slate-500">
            <Loader2 size={13} className="animate-spin" /> 生成中…
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-2.5">
        {image && (
          <div className="mb-2 flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5">
            <img src={image} alt="参考画像" className="h-9 w-9 rounded object-cover" />
            <span className="flex-1 text-[11px] text-slate-500">参考画像を添付</span>
            <button className="text-slate-400 hover:text-red-500" onClick={() => setImage(null)}>
              <X size={13} />
            </button>
          </div>
        )}
        <textarea
          rows={3}
          className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
          placeholder="作りたい画面を説明… (⌘Enterで生成)"
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void run();
            }
          }}
        />
        <div className="mt-1.5 flex items-center gap-1.5">
          <select
            className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] text-slate-600 focus:outline-none"
            value={device}
            onChange={(event) => setDevice(event.target.value as typeof device)}
          >
            {DEVICE_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.label} {preset.width}×{preset.height}
              </option>
            ))}
          </select>
          <button
            className="rounded-lg border border-slate-200 p-1.5 text-slate-500 hover:bg-slate-50"
            title="参考画像を添付"
            onClick={() => fileRef.current?.click()}
          >
            <ImagePlus size={14} />
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={(event) => onPickImage(event.target.files?.[0])}
          />
          <button
            className="ml-auto flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
            disabled={aiBusy || !prompt.trim()}
            onClick={() => void run()}
          >
            {aiBusy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            生成
          </button>
        </div>
      </div>
    </div>
  );
}
