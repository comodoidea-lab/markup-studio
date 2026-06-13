import { useEffect, useState } from "react";
import type { DesignNode, NodeStyle, SizeValue } from "../state/types";
import { useDesignStore, useSelectedNode } from "../state/designStore";
import { isContainer } from "../state/nodeUtils";
import { editNodeWithAI } from "../ai/actions";
import { useSettingsStore } from "../state/settingsStore";
import {
  AlignCenterHorizontal,
  AlignEndHorizontal,
  AlignStartHorizontal,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Loader2,
  MoveVertical,
  Sparkles,
} from "lucide-react";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="border-b border-slate-200 px-3 py-3">
      <p className="mb-2 text-[10.5px] font-bold tracking-wider text-slate-400 uppercase">{title}</p>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-2 text-xs text-slate-600">
      <span className="w-16 shrink-0">{label}</span>
      <div className="flex flex-1 items-center justify-end gap-1">{children}</div>
    </label>
  );
}

function NumberInput({
  value,
  onChange,
  min,
  max,
  step,
}: {
  value: number | undefined;
  onChange: (value: number | undefined) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  return (
    <input
      type="number"
      className="w-[68px] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-right text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
      value={value ?? ""}
      min={min}
      max={max}
      step={step}
      placeholder="—"
      onChange={(event) => {
        const raw = event.target.value;
        onChange(raw === "" ? undefined : Number(raw));
      }}
    />
  );
}

function ColorInput({
  value,
  onChange,
}: {
  value: string | undefined;
  onChange: (value: string | undefined) => void;
}) {
  return (
    <div className="flex items-center gap-1">
      <input
        type="color"
        className="h-6 w-7 cursor-pointer rounded border border-slate-200"
        value={value?.startsWith("#") ? value.slice(0, 7) : "#ffffff"}
        onChange={(event) => onChange(event.target.value)}
      />
      <input
        type="text"
        className="w-[74px] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
        value={value ?? ""}
        placeholder="none"
        onChange={(event) => onChange(event.target.value || undefined)}
      />
    </div>
  );
}

function SizeInput({
  value,
  onChange,
}: {
  value: SizeValue | undefined;
  onChange: (value: SizeValue | undefined) => void;
}) {
  const mode = typeof value === "number" ? "px" : (value ?? "auto");
  return (
    <div className="flex items-center gap-1">
      {mode === "px" && (
        <NumberInput value={value as number} onChange={(v) => onChange(v ?? undefined)} min={0} />
      )}
      <select
        className="rounded-md border border-slate-200 bg-white px-1 py-1 text-xs text-slate-700 focus:outline-none"
        value={mode}
        onChange={(event) => {
          const next = event.target.value;
          if (next === "px") onChange(typeof value === "number" ? value : 200);
          else if (next === "auto") onChange(undefined);
          else onChange(next as SizeValue);
        }}
      >
        <option value="auto">auto</option>
        <option value="px">px</option>
        <option value="fill">fill</option>
        <option value="hug">hug</option>
      </select>
    </div>
  );
}

function AIEditBox({ node }: { node: DesignNode }) {
  const [prompt, setPrompt] = useState("");
  const aiBusy = useDesignStore((state) => state.aiBusy);
  const canUseAI = useSettingsStore((state) => state.canUseAI());
  const openSettings = useSettingsStore((state) => state.openSettings);

  const run = async () => {
    if (!prompt.trim() || aiBusy) return;
    if (!canUseAI) {
      openSettings(true);
      return;
    }
    const text = prompt;
    setPrompt("");
    await editNodeWithAI(node.id, text).catch(() => {});
  };

  return (
    <div className="border-b border-slate-200 bg-gradient-to-b from-violet-50 to-white px-3 py-3">
      <p className="mb-1.5 flex items-center gap-1 text-[10.5px] font-bold tracking-wider text-violet-500 uppercase">
        <Sparkles size={11} /> AI edit
      </p>
      <div className="flex items-end gap-1.5">
        <textarea
          rows={2}
          className="flex-1 resize-none rounded-lg border border-violet-200 bg-white px-2 py-1.5 text-xs text-slate-800 placeholder:text-slate-400 focus:border-violet-400 focus:outline-none"
          placeholder={
            node.type === "frame"
              ? "例: ダークモードにして、ヒーローを大胆に"
              : "例: もっと目立たせて、角を丸く"
          }
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
              event.preventDefault();
              void run();
            }
          }}
        />
        <button
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-600 text-white shadow-sm hover:bg-violet-700 disabled:opacity-50"
          disabled={aiBusy || !prompt.trim()}
          onClick={() => void run()}
          title="このノードをAIで修正 (⌘Enter)"
        >
          {aiBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}
        </button>
      </div>
    </div>
  );
}

export function InspectorPanel() {
  const node = useSelectedNode();
  const updateNode = useDesignStore((state) => state.updateNode);
  const updateStyle = useDesignStore((state) => state.updateStyle);
  const moveNode = useDesignStore((state) => state.moveNode);
  const [nameDraft, setNameDraft] = useState(node?.name ?? "");

  useEffect(() => {
    setNameDraft(node?.name ?? "");
  }, [node?.id, node?.name]);

  if (!node) {
    return (
      <div className="flex h-full items-center justify-center px-6 text-center text-xs leading-relaxed text-slate-400">
        キャンバスで要素を選択すると、ここでスタイルを編集できます
      </div>
    );
  }

  const s = node.style;
  const set = (patch: Partial<NodeStyle>) => updateStyle(node.id, patch);
  const container = isContainer(node);
  const hasText = node.type === "text" || node.type === "button";

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      <div className="border-b border-slate-200 px-3 py-2.5">
        <div className="flex items-center justify-between gap-2">
          <input
            className="w-full rounded-md border border-transparent px-1 py-0.5 text-[13px] font-semibold text-slate-800 hover:border-slate-200 focus:border-blue-400 focus:outline-none"
            value={nameDraft}
            placeholder={node.type}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={() => updateNode(node.id, { name: nameDraft || undefined })}
          />
          <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-semibold text-slate-500 uppercase">
            {node.type}
          </span>
        </div>
        <div className="mt-1.5 flex items-center gap-1">
          <button
            className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            onClick={() => moveNode(node.id, -1)}
          >
            <ArrowUp size={11} /> 前へ
          </button>
          <button
            className="flex items-center gap-1 rounded-md border border-slate-200 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-50"
            onClick={() => moveNode(node.id, 1)}
          >
            <ArrowDown size={11} /> 後へ
          </button>
        </div>
      </div>

      <AIEditBox node={node} />

      {(node.type === "text" || node.type === "button") && (
        <Section title="Content">
          <textarea
            rows={2}
            className="w-full resize-none rounded-md border border-slate-200 px-2 py-1.5 text-xs text-slate-800 focus:border-blue-400 focus:outline-none"
            value={node.text ?? ""}
            onChange={(event) => updateNode(node.id, { text: event.target.value })}
          />
        </Section>
      )}
      {node.type === "input" && (
        <Section title="Content">
          <Row label="Placeholder">
            <input
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
              value={node.placeholder ?? ""}
              onChange={(event) => updateNode(node.id, { placeholder: event.target.value })}
            />
          </Row>
        </Section>
      )}
      {node.type === "image" && (
        <Section title="Content">
          <Row label="URL">
            <input
              className="w-full rounded-md border border-slate-200 px-2 py-1 text-xs focus:border-blue-400 focus:outline-none"
              value={node.src ?? ""}
              placeholder="https://…"
              onChange={(event) => updateNode(node.id, { src: event.target.value || undefined })}
            />
          </Row>
        </Section>
      )}

      {container && (
        <Section title="Auto layout">
          <Row label="方向">
            <div className="flex overflow-hidden rounded-md border border-slate-200">
              {(
                [
                  ["column", ArrowDown],
                  ["row", ArrowRight],
                ] as const
              ).map(([direction, Icon]) => (
                <button
                  key={direction}
                  className={`px-2.5 py-1 ${
                    (s.direction ?? "column") === direction
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                  onClick={() => set({ direction })}
                >
                  <Icon size={13} />
                </button>
              ))}
            </div>
          </Row>
          <Row label="Gap">
            <NumberInput value={s.gap} onChange={(gap) => set({ gap })} min={0} />
          </Row>
          <Row label="Padding X">
            <NumberInput value={s.paddingX} onChange={(paddingX) => set({ paddingX })} min={0} />
          </Row>
          <Row label="Padding Y">
            <NumberInput value={s.paddingY} onChange={(paddingY) => set({ paddingY })} min={0} />
          </Row>
          <Row label="Align">
            <div className="flex overflow-hidden rounded-md border border-slate-200">
              {(
                [
                  ["start", AlignStartHorizontal],
                  ["center", AlignCenterHorizontal],
                  ["end", AlignEndHorizontal],
                  ["stretch", MoveVertical],
                ] as const
              ).map(([align, Icon]) => (
                <button
                  key={align}
                  title={align}
                  className={`px-2 py-1 ${
                    (s.align ?? "stretch") === align
                      ? "bg-blue-600 text-white"
                      : "text-slate-500 hover:bg-slate-50"
                  }`}
                  onClick={() => set({ align })}
                >
                  <Icon size={12} />
                </button>
              ))}
            </div>
          </Row>
          <Row label="Justify">
            <select
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none"
              value={s.justify ?? "start"}
              onChange={(event) => set({ justify: event.target.value as NodeStyle["justify"] })}
            >
              <option value="start">start</option>
              <option value="center">center</option>
              <option value="end">end</option>
              <option value="between">between</option>
            </select>
          </Row>
        </Section>
      )}

      <Section title="Size">
        <Row label="Width">
          <SizeInput value={s.width} onChange={(width) => set({ width })} />
        </Row>
        <Row label="Height">
          <SizeInput value={s.height} onChange={(height) => set({ height })} />
        </Row>
      </Section>

      <Section title="Appearance">
        <Row label="Fill">
          <ColorInput value={s.background} onChange={(background) => set({ background })} />
        </Row>
        <Row label="Border">
          <NumberInput value={s.borderWidth} onChange={(borderWidth) => set({ borderWidth })} min={0} />
          <ColorInput value={s.borderColor} onChange={(borderColor) => set({ borderColor })} />
        </Row>
        <Row label="Radius">
          <NumberInput value={s.radius} onChange={(radius) => set({ radius })} min={0} />
        </Row>
        <Row label="Shadow">
          <select
            className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none"
            value={s.shadow ?? "none"}
            onChange={(event) => set({ shadow: event.target.value as NodeStyle["shadow"] })}
          >
            <option value="none">none</option>
            <option value="sm">sm</option>
            <option value="md">md</option>
            <option value="lg">lg</option>
          </select>
        </Row>
        <Row label="Opacity">
          <NumberInput
            value={s.opacity}
            onChange={(opacity) => set({ opacity })}
            min={0}
            max={1}
            step={0.05}
          />
        </Row>
      </Section>

      {(hasText || node.type === "input") && (
        <Section title="Typography">
          <Row label="Size">
            <NumberInput value={s.fontSize} onChange={(fontSize) => set({ fontSize })} min={6} />
          </Row>
          <Row label="Weight">
            <select
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none"
              value={s.fontWeight ?? 400}
              onChange={(event) => set({ fontWeight: Number(event.target.value) })}
            >
              {[300, 400, 500, 600, 700, 800, 900].map((weight) => (
                <option key={weight} value={weight}>
                  {weight}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Color">
            <ColorInput value={s.color} onChange={(color) => set({ color })} />
          </Row>
          <Row label="Align">
            <select
              className="rounded-md border border-slate-200 bg-white px-1.5 py-1 text-xs focus:outline-none"
              value={s.textAlign ?? "left"}
              onChange={(event) => set({ textAlign: event.target.value as NodeStyle["textAlign"] })}
            >
              <option value="left">left</option>
              <option value="center">center</option>
              <option value="right">right</option>
            </select>
          </Row>
          <Row label="Line height">
            <NumberInput
              value={s.lineHeight}
              onChange={(lineHeight) => set({ lineHeight })}
              min={0.8}
              max={3}
              step={0.1}
            />
          </Row>
        </Section>
      )}
    </div>
  );
}
