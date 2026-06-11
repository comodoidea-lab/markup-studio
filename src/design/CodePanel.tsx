import { useMemo, useState } from "react";
import { useDesignStore } from "../state/designStore";
import { findFrameOf } from "../state/nodeUtils";
import { frameToHtml, frameToReact } from "../codegen/serialize";
import { Check, Copy, Download, Eye, FileCode2 } from "lucide-react";

type Tab = "preview" | "react" | "html";

export function CodePanel() {
  const frames = useDesignStore((state) => state.doc.frames);
  const selectedId = useDesignStore((state) => state.selectedId);
  const [tab, setTab] = useState<Tab>("preview");
  const [copied, setCopied] = useState(false);

  const frame = useMemo(() => {
    if (selectedId) {
      const found = findFrameOf(frames, selectedId);
      if (found) return found;
    }
    return frames[0] ?? null;
  }, [frames, selectedId]);

  const output = useMemo(() => {
    if (!frame) return { react: "", html: "", srcdoc: "" };
    const { html } = frameToHtml(frame);
    return { react: frameToReact(frame), html, srcdoc: html };
  }, [frame]);

  if (!frame) {
    return (
      <div className="flex h-full items-center justify-center text-xs text-slate-400">
        フレームがありません
      </div>
    );
  }

  const code = tab === "react" ? output.react : output.html;

  const copy = async () => {
    await navigator.clipboard.writeText(code).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };

  const download = () => {
    const filename = tab === "react" ? "Screen.tsx" : "screen.html";
    const blob = new Blob([code], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-1 overflow-x-auto border-b border-slate-200 px-2 py-1.5">
        {(
          [
            ["preview", "プレビュー", Eye],
            ["react", "React", FileCode2],
            ["html", "HTML", FileCode2],
          ] as const
        ).map(([id, label, Icon]) => (
          <button
            key={id}
            className={`flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-[11.5px] font-medium whitespace-nowrap ${
              tab === id ? "bg-slate-800 text-white" : "text-slate-500 hover:bg-slate-100"
            }`}
            onClick={() => setTab(id)}
          >
            <Icon size={12} className="shrink-0" /> {label}
          </button>
        ))}
        <span className="ml-auto hidden max-w-28 truncate text-[11px] text-slate-400 min-[1280px]:inline">
          {frame.name ?? "Frame"}
        </span>
        {tab !== "preview" && (
          <>
            <button
              className="ml-auto shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-100 min-[1280px]:ml-0"
              onClick={() => void copy()}
              title="コードをコピー"
            >
              {copied ? <Check size={13} className="text-green-600" /> : <Copy size={13} />}
            </button>
            <button
              className="shrink-0 rounded-md p-1 text-slate-500 hover:bg-slate-100"
              onClick={download}
              title="ダウンロード"
            >
              <Download size={13} />
            </button>
          </>
        )}
      </div>

      {tab === "preview" ? (
        <div className="flex-1 bg-slate-200 p-2">
          <iframe
            title="ライブプレビュー"
            className="h-full w-full rounded-lg border border-slate-300 bg-white"
            sandbox="allow-same-origin"
            srcDoc={output.srcdoc}
          />
        </div>
      ) : (
        <pre className="flex-1 overflow-auto bg-slate-900 p-3 text-[11px] leading-relaxed text-slate-100">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
