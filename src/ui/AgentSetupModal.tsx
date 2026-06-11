import { useState } from "react";
import { writeClipboardText } from "../review/annotatedPng";
import { showToast } from "../ui/toast";
import { Bot, Check, Copy, X } from "lucide-react";

export function starterPrompt(): string {
  const startUrl = new URL("./start.md", location.href).href;
  return [
    "Markupオンボーディングを開始してください:",
    startUrl,
    "",
    "Markupボードやローカル開発画面を開くときは、AIエディターの内蔵ブラウザでの表示を優先してください。",
    "内蔵ブラウザが使えないエディターやエージェントの場合のみ、デフォルトブラウザで開いてください。",
  ].join("\n");
}

export function AgentSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState(false);

  if (!open) return null;

  const prompt = starterPrompt();

  const copy = async () => {
    const ok = await writeClipboardText(prompt);
    if (ok) {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
      showToast("スタータープロンプトをコピーしました");
    } else {
      showToast("コピーできませんでした。テキストを選択してコピーしてください", 3500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative w-[480px] max-w-[92vw] rounded-2xl bg-white p-5 shadow-2xl">
        <button
          className="absolute top-3.5 right-3.5 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          onClick={onClose}
        >
          <X size={16} />
        </button>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <Bot size={16} className="text-orange-500" /> エージェント連携
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          下のスタータープロンプトを AIエディター等に一度貼り付けると、スクリーンショットを
          Markupで開き、注釈をもとに修正する流れをエージェントと共有できます。コピー文には
          内蔵ブラウザ優先の指示も含まれます。
        </p>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Quick start
            </span>
            <button
              className="flex items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-600"
              onClick={() => void copy()}
            >
              {copied ? <Check size={12} /> : <Copy size={12} />} コピー
            </button>
          </div>
          <pre className="mt-2 text-[11px] leading-relaxed break-all whitespace-pre-wrap text-slate-700">
            {prompt}
          </pre>
        </div>

        <div className="mt-3 flex gap-3 text-[11.5px]">
          <a
            className="font-semibold text-blue-600 hover:underline"
            href="/start.md"
            target="_blank"
            rel="noreferrer"
          >
            start.md
          </a>
          <a
            className="font-semibold text-blue-600 hover:underline"
            href="/skill/SKILL.md"
            target="_blank"
            rel="noreferrer"
          >
            Markup Skill
          </a>
          <a
            className="font-semibold text-blue-600 hover:underline"
            href="/docs/agent-bridge-api.md"
            target="_blank"
            rel="noreferrer"
          >
            Agent Bridge API
          </a>
        </div>
      </div>
    </div>
  );
}
