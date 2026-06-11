import { useEffect, useState } from "react";
import { useDesignStore } from "../state/designStore";
import { CanvasView } from "./CanvasView";
import { LayersPanel } from "./LayersPanel";
import { InspectorPanel } from "./InspectorPanel";
import { AIPanel } from "./AIPanel";
import { CodePanel } from "./CodePanel";
import { Code2, Redo2, SlidersHorizontal, Sparkles, Undo2 } from "lucide-react";

type RightTab = "design" | "ai" | "code";

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return (
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT" ||
    target.isContentEditable
  );
}

export function DesignMode() {
  const [rightTab, setRightTab] = useState<RightTab>("design");
  const undo = useDesignStore((state) => state.undo);
  const redo = useDesignStore((state) => state.redo);
  const canUndo = useDesignStore((state) => state.past.length > 0);
  const canRedo = useDesignStore((state) => state.future.length > 0);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "z") {
        if (isTypingTarget(event.target)) return;
        event.preventDefault();
        if (event.shiftKey) useDesignStore.getState().redo();
        else useDesignStore.getState().undo();
        return;
      }
      if ((event.key === "Delete" || event.key === "Backspace") && !isTypingTarget(event.target)) {
        const { selectedId, deleteNode } = useDesignStore.getState();
        if (selectedId) {
          event.preventDefault();
          deleteNode(selectedId);
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <div className="flex h-full min-h-0">
      <aside className="w-56 shrink-0 border-r border-[#d9d9d0] bg-[#fbfaf5]">
        <LayersPanel />
      </aside>

      <div className="relative min-w-0 flex-1">
        <CanvasView />
        <div className="absolute top-3 left-3 flex items-center gap-0.5 rounded-xl border border-[#d9d9d0] bg-white p-1 shadow-md">
          <button
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            onClick={undo}
            disabled={!canUndo}
            title="元に戻す (⌘Z)"
          >
            <Undo2 size={15} />
          </button>
          <button
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30"
            onClick={redo}
            disabled={!canRedo}
            title="やり直す (⇧⌘Z)"
          >
            <Redo2 size={15} />
          </button>
        </div>
      </div>

      <aside className="flex w-80 shrink-0 flex-col border-l border-[#d9d9d0] bg-[#fbfaf5]">
        <div className="flex border-b border-slate-200">
          {(
            [
              ["design", "デザイン", SlidersHorizontal],
              ["ai", "AI", Sparkles],
              ["code", "コード", Code2],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              className={`flex flex-1 items-center justify-center gap-1.5 border-b-2 px-2 py-2 text-xs font-semibold ${
                rightTab === id
                  ? "border-blue-600 text-blue-700"
                  : "border-transparent text-slate-500 hover:text-slate-700"
              }`}
              onClick={() => setRightTab(id)}
            >
              <Icon size={13} /> {label}
            </button>
          ))}
        </div>
        <div className="min-h-0 flex-1">
          {rightTab === "design" && <InspectorPanel />}
          {rightTab === "ai" && <AIPanel />}
          {rightTab === "code" && <CodePanel />}
        </div>
      </aside>
    </div>
  );
}
