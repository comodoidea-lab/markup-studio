import type { Annotation } from "../state/types";

function drawContainedImage(
  context: CanvasRenderingContext2D,
  image: HTMLImageElement,
  width: number,
  height: number,
) {
  const imageRatio = image.naturalWidth / image.naturalHeight;
  const canvasRatio = width / height;
  let drawWidth = width;
  let drawHeight = height;
  let drawX = 0;
  let drawY = 0;

  if (imageRatio > canvasRatio) {
    drawHeight = width / imageRatio;
    drawY = (height - drawHeight) / 2;
  } else {
    drawWidth = height * imageRatio;
    drawX = (width - drawWidth) / 2;
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, drawX, drawY, drawWidth, drawHeight);
}

function drawAnnotations(
  context: CanvasRenderingContext2D,
  annotations: Annotation[],
  width: number,
  height: number,
) {
  const accent = "#ff5a36";
  const scale = Math.min(width, height);
  context.lineWidth = Math.max(3, scale * 0.0032);
  context.strokeStyle = accent;
  context.fillStyle = "rgba(255, 90, 54, 0.10)";

  annotations.forEach((annotation, index) => {
    const x = (annotation.x / 100) * width;
    const y = (annotation.y / 100) * height;

    if (annotation.kind === "color") {
      const areaWidth = ((annotation.width ?? 0) / 100) * width;
      const areaHeight = ((annotation.height ?? 0) / 100) * height;
      const color = annotation.color || "#2563eb";
      context.save();
      context.globalAlpha = 0.42;
      context.fillStyle = color;
      context.fillRect(x, y, areaWidth, areaHeight);
      context.restore();
      context.strokeStyle = color;
      context.setLineDash([14, 9]);
      context.strokeRect(x, y, areaWidth, areaHeight);
      context.setLineDash([]);

      const label = `${index + 1} · ${color.toUpperCase()}`;
      const fontSize = Math.max(17, scale * 0.021);
      const paddingX = fontSize * 0.55;
      const labelHeight = fontSize * 1.7;
      context.font = `800 ${fontSize}px Arial, sans-serif`;
      const labelWidth = context.measureText(label).width + paddingX * 2;
      context.fillStyle = color;
      context.fillRect(x, y, labelWidth, labelHeight);
      context.fillStyle = "#ffffff";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(label, x + paddingX, y + labelHeight / 2);
      context.strokeStyle = accent;
      context.fillStyle = "rgba(255, 90, 54, 0.10)";
      return;
    }

    if (annotation.kind === "arrow") {
      const endX = ((annotation.endX ?? 0) / 100) * width;
      const endY = ((annotation.endY ?? 0) / 100) * height;
      const angle = Math.atan2(endY - y, endX - x);
      const headLength = Math.max(20, scale * 0.032);
      context.beginPath();
      context.moveTo(x, y);
      context.lineTo(endX, endY);
      context.stroke();
      context.beginPath();
      context.moveTo(endX, endY);
      context.lineTo(
        endX - headLength * Math.cos(angle - Math.PI / 6),
        endY - headLength * Math.sin(angle - Math.PI / 6),
      );
      context.lineTo(
        endX - headLength * Math.cos(angle + Math.PI / 6),
        endY - headLength * Math.sin(angle + Math.PI / 6),
      );
      context.closePath();
      context.fillStyle = accent;
      context.fill();
    } else if (annotation.kind === "text") {
      const areaWidth = ((annotation.width ?? 30) / 100) * width;
      const areaHeight = ((annotation.height ?? 10) / 100) * height;
      const padding = Math.max(8, scale * 0.01);
      const fontSize = Math.max(14, scale * 0.018);
      const lineHeight = fontSize * 1.35;

      context.strokeStyle = accent;
      context.lineWidth = Math.max(2, scale * 0.0028);
      context.strokeRect(x, y, areaWidth, areaHeight);

      const body = annotation.text || "テキスト";
      context.fillStyle = accent;
      context.font = `700 ${fontSize}px Arial, sans-serif`;
      const maxWidth = areaWidth - padding * 2;
      const lines: string[] = [];
      let line = "";
      for (const char of body) {
        const test = line + char;
        if (context.measureText(test).width > maxWidth && line) {
          lines.push(line);
          line = char;
        } else {
          line = test;
        }
      }
      if (line) lines.push(line);
      let cursorY = y + padding + fontSize;
      const maxY = y + areaHeight - padding;
      for (const textLine of lines) {
        if (cursorY > maxY) break;
        context.fillText(textLine, x + padding, cursorY);
        cursorY += lineHeight;
      }
      context.strokeStyle = accent;
      context.fillStyle = "rgba(255, 90, 54, 0.10)";
      return;
    } else {
      context.beginPath();
      if (annotation.kind === "pin") {
        context.arc(x, y, scale * 0.022, 0, Math.PI * 2);
      } else {
        const areaWidth = ((annotation.width ?? 0) / 100) * width;
        const areaHeight = ((annotation.height ?? 0) / 100) * height;
        context.rect(x, y, areaWidth, areaHeight);
      }
      context.fill();
      context.stroke();
    }

    const radius = Math.max(15, scale * 0.021);
    context.beginPath();
    context.fillStyle = accent;
    context.arc(x, y, radius, 0, Math.PI * 2);
    context.fill();

    context.fillStyle = "#ffffff";
    context.font = `800 ${Math.max(18, radius * 1.05)}px Arial, sans-serif`;
    context.textAlign = "center";
    context.textBaseline = "middle";
    context.fillText(String(index + 1), x, y + 1);
    context.fillStyle = "rgba(255, 90, 54, 0.10)";
  });
}

export async function createAnnotatedCanvas(
  imageSrc: string,
  annotations: Annotation[],
  stageRatio: number,
): Promise<HTMLCanvasElement> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = () => reject(new Error("画像を読み込めませんでした"));
    element.src = imageSrc;
  });

  const width = Math.max(1200, Math.min(2400, image.naturalWidth || 1600));
  const height = Math.round(width / stageRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d")!;
  drawContainedImage(context, image, width, height);
  drawAnnotations(context, annotations, width, height);
  return canvas;
}

export function canvasToPngBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNGの生成に失敗しました"));
    }, "image/png");
  });
}

export function downloadPng(blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `markup-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copyImageThroughLocalServer(pngBlob: Blob): Promise<boolean> {
  if (!["127.0.0.1", "localhost"].includes(location.hostname)) return false;
  try {
    const response = await fetch("/api/copy-image", {
      method: "POST",
      headers: { "Content-Type": "image/png" },
      body: pngBlob,
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function copyPngToClipboard(pngBlob: Blob): Promise<"copied" | "downloaded"> {
  if (await copyImageThroughLocalServer(pngBlob)) return "copied";
  if (window.isSecureContext && navigator.clipboard?.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([new ClipboardItem({ "image/png": pngBlob })]);
      return "copied";
    } catch {
      // Browser policy may reject image clipboard writes.
    }
  }
  downloadPng(pngBlob);
  return "downloaded";
}

export async function writeClipboardText(text: string): Promise<boolean> {
  if (["127.0.0.1", "localhost"].includes(location.hostname)) {
    try {
      const response = await fetch("/api/copy-text", {
        method: "POST",
        headers: { "Content-Type": "text/plain; charset=utf-8" },
        body: text,
      });
      if (response.ok) return true;
    } catch {
      // Fall through to the browser clipboard APIs.
    }
  }
  if (window.isSecureContext && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fall through to the legacy path.
    }
  }
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    textarea.remove();
  }
  return copied;
}
