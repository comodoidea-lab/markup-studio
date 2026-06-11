import { useMemo, useState } from "react";
import { writeClipboardText } from "../review/annotatedPng";
import { showToast } from "../ui/toast";
import { Bot, Check, Copy, ExternalLink, Globe, Monitor, X } from "lucide-react";

export function markupUrls() {
  const boardUrl = new URL("/", location.href).href;
  const startUrl = new URL("./start.md", location.href).href;
  return { boardUrl, startUrl };
}

export function starterPrompt(): string {
  const { boardUrl, startUrl } = markupUrls();
  return [
    "Markupオンボーディングを開始してください:",
    "",
    `1. まず Markup ボードを開いてください: ${boardUrl}`,
    `2. 次に手順書 start.md を読んでください: ${startUrl}`,
    "",
    "Markupボードやローカル開発画面を開くときは、AIエディターの内蔵ブラウザ（Cursor の Browser / Simple Browser など）での表示を優先してください。",
    "内蔵ブラウザが使えないエディターやエージェントの場合のみ、デフォルトブラウザで開いてください。",
    "ボードを開いたら start.md の手順どおり、注釈の確認と修正を進めてください。",
  ].join("\n");
}

export function AgentSetupModal({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [copied, setCopied] = useState<"prompt" | "url" | null>(null);
  const { boardUrl, startUrl } = useMemo(() => markupUrls(), []);

  if (!open) return null;

  const prompt = starterPrompt();

  const flashCopied = (kind: "prompt" | "url") => {
    setCopied(kind);
    window.setTimeout(() => setCopied(null), 1500);
  };

  const copyPrompt = async () => {
    const ok = await writeClipboardText(prompt);
    if (ok) {
      flashCopied("prompt");
      showToast("スタータープロンプトをコピーしました");
    } else {
      showToast("コピーできませんでした。テキストを選択してコピーしてください", 3500);
    }
  };

  const copyBoardUrl = async () => {
    const ok = await writeClipboardText(boardUrl);
    if (ok) {
      flashCopied("url");
      showToast("ボードURLをコピーしました。Simple Browser に貼り付けてください", 3500);
    } else {
      showToast("コピーできませんでした", 3000);
    }
  };

  const openExternal = () => {
    window.open(boardUrl, "_blank", "noopener,noreferrer");
    showToast("外部ブラウザで Markup を開きました", 2500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative max-h-[90vh] w-[520px] max-w-full overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
        <button
          className="absolute top-3.5 right-3.5 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          onClick={onClose}
          aria-label="閉じる"
        >
          <X size={16} />
        </button>
        <h2 className="flex items-center gap-2 pr-8 text-base font-bold text-slate-800">
          <Bot size={16} className="text-orange-500" /> エージェント連携
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          Cursor ではスタータープロンプトのコピーだけでは内蔵ブラウザは自動で開きません。
          下の手順で Simple Browser に URL を貼るか、エージェントへプロンプトを渡してください。
        </p>

        <section className="mt-3 rounded-xl border border-[#ff5a36]/25 bg-[#fff8f5] p-3">
          <p className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-[#ff5a36] uppercase">
            <Monitor size={12} /> Cursor で内蔵ブラウザに開く
          </p>
          <ol className="mt-2 space-y-1.5 text-[11.5px] leading-relaxed text-slate-700">
            <li>
              <span className="font-bold text-slate-800">1.</span>{" "}
              <code className="rounded bg-white px-1 py-0.5 text-[10.5px]">⌘ + Shift + P</code>{" "}
              → <strong>Simple Browser: Show</strong>
            </li>
            <li>
              <span className="font-bold text-slate-800">2.</span> 下のボタンで URL をコピーし、
              Simple Browser のアドレス欄に貼り付け
            </li>
            <li>
              <span className="font-bold text-slate-800">3.</span> エージェントへスタータープロンプトを貼り、
              <code className="rounded bg-white px-1 py-0.5 text-[10.5px]">start.md</code>{" "}
              を読ませる
            </li>
          </ol>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-slate-800"
              onClick={() => void copyBoardUrl()}
            >
              {copied === "url" ? <Check size={12} /> : <Copy size={12} />}
              ボードURLをコピー
            </button>
            <button
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-slate-700 hover:bg-slate-50"
              onClick={openExternal}
            >
              <ExternalLink size={12} />
              外部ブラウザで開く
            </button>
          </div>
          <p className="mt-2 break-all font-mono text-[10px] text-slate-500">{boardUrl}</p>
        </section>

        <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              Quick start（エージェントへ貼り付け）
            </span>
            <button
              className="flex shrink-0 items-center gap-1 rounded-md bg-orange-500 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-orange-600"
              onClick={() => void copyPrompt()}
            >
              {copied === "prompt" ? <Check size={12} /> : <Copy size={12} />} コピー
            </button>
          </div>
          <pre className="mt-2 text-[11px] leading-relaxed break-all whitespace-pre-wrap text-slate-700">
            {prompt}
          </pre>
        </div>

        <div className="mt-3 flex flex-wrap gap-3 text-[11.5px]">
          <a
            className="inline-flex items-center gap-1 font-semibold text-blue-600 hover:underline"
            href={startUrl}
            target="_blank"
            rel="noreferrer"
          >
            <Globe size={12} /> start.md
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
