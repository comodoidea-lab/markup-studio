import type { Annotation, AnnotationType } from "../state/types";

export const TYPE_LABELS: Record<AnnotationType, string> = {
  layout: "レイアウト",
  style: "見た目",
  copy: "テキスト",
  remove: "削除",
  behavior: "動作",
};

export interface PromptContext {
  isLive: boolean;
  liveOrigin?: string;
  livePath?: string;
  liveUrl?: string;
}

export function promptData(annotations: Annotation[], context: PromptContext) {
  return {
    task: context.isLive
      ? "以下のWebアプリを、画面上の注釈に従って修正してください。"
      : "添付したUIスクリーンショットを、以下の注釈に従って修正してください。",
    context: {
      coordinateSystem: "表示領域の左上を原点とするパーセント座標",
      preserveUnmentionedAreas: true,
      ...(context.isLive
        ? {
            developmentServer: context.liveOrigin,
            screenPath: context.livePath,
            targetUrl: context.liveUrl,
          }
        : {}),
    },
    instructions: annotations.map((annotation, index) => ({
      id: index + 1,
      category: annotation.type,
      categoryLabel: TYPE_LABELS[annotation.type],
      target: annotation.kind === "text"
        ? {
            kind: "text-box",
            x: annotation.x,
            y: annotation.y,
            width: annotation.width ?? 30,
            height: annotation.height ?? 10,
          }
        : ["rect", "color"].includes(annotation.kind)
        ? {
            kind: annotation.kind === "color" ? "color-area" : "area",
            x: annotation.x,
            y: annotation.y,
            width: annotation.width,
            height: annotation.height,
            ...(annotation.kind === "color" ? { desiredColor: annotation.color } : {}),
          }
        : annotation.kind === "arrow"
          ? {
              kind: "arrow",
              startX: annotation.x,
              startY: annotation.y,
              endX: annotation.endX,
              endY: annotation.endY,
            }
          : { kind: annotation.kind, x: annotation.x, y: annotation.y },
      request: annotation.text || "（修正内容を入力してください）",
    })),
  };
}

type PromptJson = ReturnType<typeof promptData>;

export function markdownPrompt(data: PromptJson): string {
  const lines = [
    "# UI修正依頼",
    "",
    data.task,
    "指定していない箇所のデザインと挙動は維持してください。",
  ];
  const context = data.context as Record<string, string | boolean>;
  if (context.targetUrl) {
    lines.push(
      "",
      "## 開発画面",
      "",
      `- 開発サーバー: ${context.developmentServer}`,
      `- 画面パス: ${context.screenPath}`,
      `- 対象URL: ${context.targetUrl}`,
      "- 修正後は同じ画面パスで表示を再確認してください。",
    );
  }
  lines.push("", "## 修正内容");

  data.instructions.forEach((item) => {
    const target = item.target as unknown as Record<string, number | string>;
    let label: string;
    if (target.kind === "area") {
      label = `範囲 x:${Number(target.x).toFixed(1)}%, y:${Number(target.y).toFixed(1)}%, w:${Number(target.width).toFixed(1)}%, h:${Number(target.height).toFixed(1)}%`;
    } else if (target.kind === "text-box") {
      label = `テキストボックス x:${Number(target.x).toFixed(1)}%, y:${Number(target.y).toFixed(1)}%, w:${Number(target.width).toFixed(1)}%, h:${Number(target.height).toFixed(1)}%`;
    } else if (target.kind === "color-area") {
      label = `色変更範囲 x:${Number(target.x).toFixed(1)}%, y:${Number(target.y).toFixed(1)}%, w:${Number(target.width).toFixed(1)}%, h:${Number(target.height).toFixed(1)}% → ${String(target.desiredColor).toUpperCase()}`;
    } else if (target.kind === "arrow") {
      label = `矢印 (${Number(target.startX).toFixed(1)}%, ${Number(target.startY).toFixed(1)}%) → (${Number(target.endX).toFixed(1)}%, ${Number(target.endY).toFixed(1)}%)`;
    } else {
      label = `位置 x:${Number(target.x).toFixed(1)}%, y:${Number(target.y).toFixed(1)}%`;
    }
    lines.push("", `${item.id}. **${item.categoryLabel}** — ${label}`, `   ${item.request}`);
  });
  return lines.join("\n");
}

export function buildPromptText(
  annotations: Annotation[],
  context: PromptContext,
  format: "markdown" | "json",
): string {
  if (!annotations.length) return "";
  const data = promptData(annotations, context);
  return format === "json" ? JSON.stringify(data, null, 2) : markdownPrompt(data);
}
