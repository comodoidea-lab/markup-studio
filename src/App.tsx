import { useEffect, useState } from "react";
import { useAppStore } from "./state/appStore";
import { useDesignStore } from "./state/designStore";
import { useSettingsStore } from "./state/settingsStore";
import { showToast, useToastStore } from "./ui/toast";
import { DesignMode } from "./design/DesignMode";
import { ReviewMode } from "./review/ReviewMode";
import { CanvasView } from "./design/CanvasView";
import { SettingsModal } from "./ui/SettingsModal";
import { AgentSetupModal } from "./ui/AgentSetupModal";
import { BoardManagerModal } from "./ui/BoardManagerModal";
import { Bot, Frame, HardDrive, KeyRound, MessageSquareWarning, PenTool } from "lucide-react";

const EMBED_VIEW = (() => {
  const value = new URLSearchParams(location.search).get("embed");
  return value === "canvas" || value === "design" || value === "1";
})();

function Toast() {
  const message = useToastStore((state) => state.message);
  const visible = useToastStore((state) => state.visible);
  return (
    <div
      role="status"
      className={`fixed bottom-5 left-1/2 z-[60] -translate-x-1/2 rounded-full bg-slate-900 px-4 py-2 text-xs font-medium text-white shadow-xl transition-all duration-200 ${
        visible ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-2 opacity-0"
      }`}
    >
      {message}
    </div>
  );
}

export default function App() {
  const mode = useAppStore((state) => state.mode);
  const setMode = useAppStore((state) => state.setMode);
  const docName = useDesignStore((state) => state.doc.name);
  const renameDoc = useDesignStore((state) => state.renameDoc);
  const load = useDesignStore((state) => state.load);
  const openSettings = useSettingsStore((state) => state.openSettings);
  const hasKey = useSettingsStore((state) => Boolean(state.keys[state.provider]));
  const [agentSetupOpen, setAgentSetupOpen] = useState(false);
  const [boardManagerOpen, setBoardManagerOpen] = useState(false);

  useEffect(() => {
    void load();
  }, [load]);

  // Canvas-only view for embedding (e.g. reviewing the board itself
  // through the review mode's Live URL): /?embed=canvas
  if (EMBED_VIEW) {
    return (
      <div className="h-screen text-[#171813]">
        <CanvasView autoFit />
        <Toast />
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col text-[#171813]">
      <header className="flex h-12 shrink-0 items-center gap-2 border-b border-[#d9d9d0] bg-[#f4f3ed]/90 px-3 backdrop-blur md:gap-3">
        <a className="flex shrink-0 items-center gap-2" href="#" aria-label="Markup ホーム">
          <img src="/assets/icons/favicon-32.png" alt="" className="h-6 w-6 rounded" />
          <span className="hidden text-sm font-extrabold tracking-tight whitespace-nowrap md:inline">
            Markup Studio
          </span>
        </a>

        <div className="flex shrink-0 items-center gap-0.5 rounded-xl bg-[#e9e8e0] p-0.5">
          <button
            className={`flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-3 ${
              mode === "design" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
            onClick={() => setMode("design")}
          >
            <PenTool size={13} className="shrink-0" />
            <span className="hidden sm:inline">デザイン</span>
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-[10px] px-2.5 py-1.5 text-xs font-semibold whitespace-nowrap sm:px-3 ${
              mode === "review" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
            }`}
            onClick={() => setMode("review")}
          >
            <MessageSquareWarning size={13} className="shrink-0" />
            <span className="hidden sm:inline">レビュー</span>
          </button>
        </div>

        {mode === "design" && (
          <>
            <input
              className="hidden w-40 min-w-0 rounded-md border border-transparent px-2 py-1 text-xs font-medium text-slate-600 hover:border-slate-200 focus:border-blue-400 focus:outline-none lg:block xl:w-48"
              value={docName}
              onChange={(event) => renameDoc(event.target.value)}
              aria-label="ドキュメント名"
            />
            <button
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:bg-slate-50"
              title="フレームセット（ボード）の保存・読み込み"
              onClick={() => setBoardManagerOpen(true)}
            >
              <HardDrive size={12} className="shrink-0" />
              <span className="hidden xl:inline">ボード</span>
            </button>
            <button
              className="flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-[11px] whitespace-nowrap text-slate-500 hover:bg-slate-50"
              title="パネルなしでキャンバスだけを表示するURLをコピーします。レビューモードのLive URLに貼ると、ボードのみを注釈できます"
              onClick={async () => {
                const url = `${location.origin}${location.pathname}?embed=canvas`;
                await navigator.clipboard.writeText(url).catch(() => {});
                showToast("キャンバスのみ表示するURLをコピーしました。レビューのLive URLに貼り付けてください", 4000);
              }}
            >
              <Frame size={12} className="shrink-0" />
              <span className="hidden xl:inline">キャンバスのみURL</span>
            </button>
          </>
        )}

        <div className="ml-auto flex shrink-0 items-center gap-1.5 md:gap-2">
          <button
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-2 py-1.5 text-xs font-semibold whitespace-nowrap text-slate-600 hover:bg-slate-50 md:px-2.5"
            title="CursorやCodexと連携するスタータープロンプトを表示"
            onClick={() => setAgentSetupOpen(true)}
          >
            <Bot size={13} className="shrink-0" />
            <span className="hidden lg:inline">エージェント連携</span>
          </button>
          <button
            className={`flex items-center gap-1.5 rounded-lg border px-2 py-1.5 text-xs font-semibold whitespace-nowrap md:px-2.5 ${
              hasKey
                ? "border-slate-200 text-slate-600 hover:bg-slate-50"
                : "border-violet-300 bg-violet-50 text-violet-700 hover:bg-violet-100"
            }`}
            onClick={() => openSettings(true)}
          >
            <KeyRound size={13} className="shrink-0" />
            <span className="hidden lg:inline">{hasKey ? "AI設定" : "APIキーを設定"}</span>
          </button>
        </div>
      </header>

      <main className="min-h-0 flex-1">{mode === "design" ? <DesignMode /> : <ReviewMode />}</main>

      <SettingsModal />
      <AgentSetupModal open={agentSetupOpen} onClose={() => setAgentSetupOpen(false)} />
      <BoardManagerModal open={boardManagerOpen} onClose={() => setBoardManagerOpen(false)} />
      <Toast />
    </div>
  );
}
