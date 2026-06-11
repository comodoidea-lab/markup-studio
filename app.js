const stage = document.querySelector("#stage");
const annotationLayer = document.querySelector("#annotationLayer");
const instructionList = document.querySelector("#instructionList");
const template = document.querySelector("#instructionTemplate");
const imageInput = document.querySelector("#imageInput");
const sourceImage = document.querySelector("#sourceImage");
const liveFrame = document.querySelector("#liveFrame");
const liveModeBar = document.querySelector("#liveModeBar");
const liveModeStatus = document.querySelector("#liveModeStatus");
const liveUrlForm = document.querySelector("#liveUrlForm");
const liveUrlInput = document.querySelector("#liveUrlInput");
const demoPage = document.querySelector("#demoPage");
const dropZone = document.querySelector("#dropZone");
const promptPreview = document.querySelector("#promptPreview");
const annotationCount = document.querySelector("#annotationCount");
const sidebarCount = document.querySelector("#sidebarCount");
const undoButton = document.querySelector("#undoButton");
const clearButton = document.querySelector("#clearButton");
const copyImageButton = document.querySelector("#copyImage");
const downloadImageButton = document.querySelector("#downloadImage");
const toolbarColor = document.querySelector("#toolbarColor");
const toolbarColorSwatch = document.querySelector("#toolbarColorSwatch");
const guideModal = document.querySelector("#guideModal");
const openGuideButton = document.querySelector("#openGuide");
const toast = document.querySelector("#toast");
const starterPrompt = document.querySelector("#starterPrompt");
const copyStarterPromptButton = document.querySelector("#copyStarterPrompt");
const pasteImageButton = document.querySelector("#pasteImage");
const insertAgentButton = document.querySelector("#insertAgent");

let annotations = [];
let activeTool = "rect";
let outputFormat = "markdown";
let drawing = null;
let nextId = 1;
let selectedColor = toolbarColor.value;
let currentBoardId = boardIdFromLocation() || "default";
let currentBoardTitle = "UI Review";
let currentSourceType = "demo";
let currentLiveUrl = "";
let liveInteractionEnabled = false;
let saveTimer = null;

const MARKUP_DB_NAME = "markup-agent-boards";
const MARKUP_DB_VERSION = 1;
const MARKUP_MESSAGE_TYPES = new Set(["markup:import", "markup:clear"]);

const typeLabels = {
  layout: "レイアウト",
  style: "見た目",
  copy: "テキスト",
  remove: "削除",
  behavior: "動作",
};

function boardIdFromLocation() {
  const match = location.hash.match(/^#local=([a-zA-Z0-9_-]+)$/);
  return match ? match[1] : "";
}

function sanitizeId(value, fallback = "board") {
  const sanitized = String(value || "")
    .trim()
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
  return sanitized || `${fallback}-${Date.now().toString(36)}`;
}

function annotationStorageKey(boardId = currentBoardId) {
  return `markup-annotations:${boardId}`;
}

function hasStoredAnnotations(boardId = currentBoardId) {
  return localStorage.getItem(annotationStorageKey(boardId)) !== null;
}

function openMarkupDb() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(MARKUP_DB_NAME, MARKUP_DB_VERSION);
    request.addEventListener("upgradeneeded", () => {
      if (!request.result.objectStoreNames.contains("boards")) {
        request.result.createObjectStore("boards", { keyPath: "id" });
      }
    });
    request.addEventListener("success", () => resolve(request.result));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function readBoard(boardId) {
  const db = await openMarkupDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("boards", "readonly");
    const request = transaction.objectStore("boards").get(boardId);
    request.addEventListener("success", () => resolve(request.result || null));
    request.addEventListener("error", () => reject(request.error));
  });
}

async function writeBoard(board) {
  const db = await openMarkupDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("boards", "readwrite");
    transaction.objectStore("boards").put(board);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

async function deleteBoard(boardId) {
  const db = await openMarkupDb();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("boards", "readwrite");
    transaction.objectStore("boards").delete(boardId);
    transaction.addEventListener("complete", resolve);
    transaction.addEventListener("error", () => reject(transaction.error));
  });
}

function setBoardUrl(boardId) {
  history.replaceState(
    null,
    "",
    `${location.pathname}#local=${encodeURIComponent(boardId)}`,
  );
}

function loadAnnotations(boardId = currentBoardId) {
  try {
    const boardAnnotations = JSON.parse(
      localStorage.getItem(annotationStorageKey(boardId)) || "null",
    );
    if (Array.isArray(boardAnnotations)) return boardAnnotations;
    if (boardId === "default") {
      const legacy = JSON.parse(localStorage.getItem("markup-annotations") || "[]");
      return Array.isArray(legacy) ? legacy : [];
    }
  } catch {
    return [];
  }
  return [];
}

function scheduleBoardSave() {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(async () => {
    if (currentSourceType === "demo") return;
    try {
      await writeBoard({
        id: currentBoardId,
        title: currentBoardTitle,
        sourceType: currentSourceType,
        image: currentSourceType === "image" ? sourceImage.src : null,
        liveUrl: currentSourceType === "live" ? currentLiveUrl : null,
        annotations,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      // The visible review loop remains usable even if browser storage is unavailable.
    }
  }, 250);
}

function applyImageSource(src, { clearAnnotations = true } = {}) {
  return new Promise((resolve, reject) => {
    if (typeof src !== "string" || !src.trim()) {
      reject(new Error("画像データがありません"));
      return;
    }

    sourceImage.onload = () => {
      currentSourceType = "image";
      currentLiveUrl = "";
      sourceImage.style.display = "block";
      liveFrame.style.display = "none";
      liveFrame.removeAttribute("src");
      liveModeBar.hidden = true;
      stage.classList.remove("live-interaction");
      demoPage.style.display = "none";
      if (clearAnnotations) annotations = [];
      render();
      scheduleBoardSave();
      resolve();
    };
    sourceImage.onerror = () => reject(new Error("画像を読み込めませんでした"));
    sourceImage.src = src;
  });
}

function normalizeLiveUrl(value) {
  const input = String(value || "").trim();
  if (!input) throw new Error("WebアプリのURLを入力してください");
  const withProtocol = /^[a-z][a-z0-9+.-]*:\/\//i.test(input) ? input : `http://${input}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("HTTPまたはHTTPSのURLを入力してください");
  }
  const isLoopback = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (location.protocol === "https:" && url.protocol === "http:" && !isLoopback) {
    throw new Error("HTTPS版のMarkupではHTTPSのWebアプリを指定してください");
  }
  return url.href;
}

function setLiveInteraction(enabled) {
  liveInteractionEnabled = Boolean(enabled);
  stage.classList.toggle("live-interaction", liveInteractionEnabled);
  liveModeStatus.textContent = liveInteractionEnabled ? "操作モード" : "注釈モード";
  liveModeBar.querySelectorAll("[data-live-mode]").forEach((button) => {
    button.classList.toggle(
      "active",
      button.dataset.liveMode === (liveInteractionEnabled ? "interact" : "annotate"),
    );
  });
}

function applyLiveSource(url, { clearAnnotations = true } = {}) {
  currentSourceType = "live";
  currentLiveUrl = normalizeLiveUrl(url);
  currentBoardTitle = new URL(currentLiveUrl).hostname || "Live UI Review";
  sourceImage.removeAttribute("src");
  sourceImage.style.display = "none";
  demoPage.style.display = "none";
  liveFrame.src = currentLiveUrl;
  liveFrame.style.display = "block";
  liveModeBar.hidden = false;
  liveUrlInput.value = currentLiveUrl;
  setLiveInteraction(false);
  if (clearAnnotations) annotations = [];
  render();
  scheduleBoardSave();
}

function pointFromEvent(event) {
  const bounds = stage.getBoundingClientRect();
  return {
    x: Math.max(0, Math.min(100, ((event.clientX - bounds.left) / bounds.width) * 100)),
    y: Math.max(0, Math.min(100, ((event.clientY - bounds.top) / bounds.height) * 100)),
  };
}

function createSvgElement(name, attributes = {}) {
  const element = document.createElementNS("http://www.w3.org/2000/svg", name);
  Object.entries(attributes).forEach(([key, value]) => element.setAttribute(key, value));
  return element;
}

function annotationMarkup(annotation, isDrawing = false) {
  const group = createSvgElement("g", { "data-id": annotation.id });
  const shapeClass = `annotation-shape${isDrawing ? " drawing" : ""}`;

  if (annotation.kind === "arrow") {
    const angle = Math.atan2(annotation.endY - annotation.y, annotation.endX - annotation.x);
    const headLength = 3.2;
    const leftX = annotation.endX - headLength * Math.cos(angle - Math.PI / 6);
    const leftY = annotation.endY - headLength * Math.sin(angle - Math.PI / 6);
    const rightX = annotation.endX - headLength * Math.cos(angle + Math.PI / 6);
    const rightY = annotation.endY - headLength * Math.sin(angle + Math.PI / 6);
    group.append(
      createSvgElement("line", {
        x1: annotation.x,
        y1: annotation.y,
        x2: annotation.endX,
        y2: annotation.endY,
        class: `annotation-arrow${isDrawing ? " drawing" : ""}`,
      }),
      createSvgElement("polygon", {
        points: `${annotation.endX},${annotation.endY} ${leftX},${leftY} ${rightX},${rightY}`,
        class: "annotation-arrow-head",
      }),
    );
  } else if (annotation.kind === "text") {
    const label = `${isDrawing ? "" : `${annotations.indexOf(annotation) + 1} · `}${annotation.text || "テキスト"}`;
    const labelWidth = Math.min(42, Math.max(12, label.length * 1.45 + 3));
    group.append(
      createSvgElement("rect", {
        x: annotation.x,
        y: annotation.y,
        width: labelWidth,
        height: 5,
        rx: 1,
        class: "annotation-note-bg",
      }),
    );
    const noteText = createSvgElement("text", {
      x: annotation.x + 1.5,
      y: annotation.y + 2.65,
      class: "annotation-note-text",
    });
    noteText.textContent = label;
    group.append(noteText);
  } else if (annotation.kind === "color") {
    const color = annotation.color || "#2563eb";
    group.append(
      createSvgElement("rect", {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        rx: 0.7,
        class: `annotation-color-area${isDrawing ? " drawing" : ""}`,
        fill: color,
        "fill-opacity": "0.42",
        stroke: color,
      }),
    );
    if (!isDrawing) {
      group.append(
        createSvgElement("rect", {
          x: annotation.x,
          y: annotation.y,
          width: 13,
          height: 4.6,
          rx: 1,
          class: "annotation-color-chip",
          fill: color,
        }),
      );
      const colorText = createSvgElement("text", {
        x: annotation.x + 1.2,
        y: annotation.y + 2.45,
        class: "annotation-color-text",
      });
      colorText.textContent = `${annotations.indexOf(annotation) + 1} · ${color.toUpperCase()}`;
      group.append(colorText);
    }
  } else if (annotation.kind === "pin") {
    group.append(
      createSvgElement("circle", {
        cx: annotation.x,
        cy: annotation.y,
        r: 2.2,
        class: shapeClass,
      }),
    );
  } else {
    group.append(
      createSvgElement("rect", {
        x: annotation.x,
        y: annotation.y,
        width: annotation.width,
        height: annotation.height,
        rx: 0.7,
        class: shapeClass,
      }),
    );
  }

  if (!isDrawing && !["text", "color"].includes(annotation.kind)) {
    const labelX = annotation.kind === "pin" ? annotation.x : annotation.x;
    const labelY = annotation.kind === "pin" ? annotation.y : annotation.y;
    group.append(
      createSvgElement("circle", {
        cx: labelX,
        cy: labelY,
        r: 2.05,
        class: "annotation-label",
      }),
    );
    const text = createSvgElement("text", {
      x: labelX,
      y: labelY + 0.15,
      class: "annotation-label-text",
    });
    text.textContent = String(annotations.indexOf(annotation) + 1);
    group.append(text);
  }

  return group;
}

function renderAnnotations() {
  annotationLayer.replaceChildren();
  annotationLayer.setAttribute("viewBox", "0 0 100 100");
  annotationLayer.setAttribute("preserveAspectRatio", "none");
  annotations.forEach((annotation) => annotationLayer.append(annotationMarkup(annotation)));
  if (drawing) annotationLayer.append(annotationMarkup(drawing, true));
}

function coordsLabel(annotation) {
  if (annotation.kind === "pin" || annotation.kind === "text") {
    return `pin · x ${annotation.x.toFixed(1)}% · y ${annotation.y.toFixed(1)}%`;
  }
  if (annotation.kind === "arrow") {
    return `arrow · x1 ${annotation.x.toFixed(1)}% · y1 ${annotation.y.toFixed(1)}% · x2 ${annotation.endX.toFixed(1)}% · y2 ${annotation.endY.toFixed(1)}%`;
  }
  return `area · x ${annotation.x.toFixed(1)}% · y ${annotation.y.toFixed(1)}% · w ${annotation.width.toFixed(1)}% · h ${annotation.height.toFixed(1)}%`;
}

function renderInstructions() {
  instructionList.replaceChildren();

  if (!annotations.length) {
    const empty = document.createElement("div");
    empty.className = "sidebar-empty";
    empty.innerHTML = "<span>01</span><p>左の画面で修正したい場所をドラッグして囲んでください。</p>";
    instructionList.append(empty);
  }

  annotations.forEach((annotation, index) => {
    const fragment = template.content.cloneNode(true);
    const card = fragment.querySelector(".instruction-card");
    const number = fragment.querySelector(".instruction-number");
    const select = fragment.querySelector(".instruction-type");
    const text = fragment.querySelector(".instruction-text");
    const coords = fragment.querySelector(".instruction-coords");
    const colorRow = fragment.querySelector(".instruction-color-row");
    const colorInput = fragment.querySelector(".instruction-color");
    const colorValue = fragment.querySelector(".instruction-color-value");

    card.dataset.id = annotation.id;
    number.textContent = String(index + 1).padStart(2, "0");
    select.value = annotation.type;
    text.value = annotation.text;
    coords.textContent = coordsLabel(annotation);
    if (annotation.kind === "color") {
      colorRow.hidden = false;
      colorInput.value = annotation.color || "#2563eb";
      colorValue.textContent = colorInput.value;
      text.placeholder = "例：このカードの背景色を変更する";
      colorInput.addEventListener("input", (event) => {
        annotation.color = event.target.value;
        colorValue.textContent = annotation.color;
        renderAnnotations();
        updatePrompt();
        persist();
      });
    }

    select.addEventListener("change", (event) => {
      annotation.type = event.target.value;
      updatePrompt();
      persist();
    });
    text.addEventListener("input", (event) => {
      annotation.text = event.target.value;
      renderAnnotations();
      updatePrompt();
      persist();
    });
    fragment.querySelector(".delete-instruction").addEventListener("click", () => {
      annotations = annotations.filter((item) => item.id !== annotation.id);
      render();
    });
    instructionList.append(fragment);
  });
}

function promptData() {
  const isLive = currentSourceType === "live";
  return {
    task: isLive
      ? "以下のWebアプリを、画面上の注釈に従って修正してください。"
      : "添付したUIスクリーンショットを、以下の注釈に従って修正してください。",
    context: {
      coordinateSystem: "表示領域の左上を原点とするパーセント座標",
      preserveUnmentionedAreas: true,
      ...(isLive ? { targetUrl: currentLiveUrl } : {}),
    },
    instructions: annotations.map((annotation, index) => ({
      id: index + 1,
      category: annotation.type,
      categoryLabel: typeLabels[annotation.type],
      target: ["rect", "color"].includes(annotation.kind)
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

function markdownPrompt(data) {
  const lines = [
    "# UI修正依頼",
    "",
    data.task,
    "指定していない箇所のデザインと挙動は維持してください。",
  ];
  if (data.context.targetUrl) {
    lines.push("", "## 対象URL", "", data.context.targetUrl);
  }
  lines.push("", "## 修正内容");

  data.instructions.forEach((item) => {
    let target;
    if (item.target.kind === "area") {
      target = `範囲 x:${item.target.x.toFixed(1)}%, y:${item.target.y.toFixed(1)}%, w:${item.target.width.toFixed(1)}%, h:${item.target.height.toFixed(1)}%`;
    } else if (item.target.kind === "color-area") {
      target = `色変更範囲 x:${item.target.x.toFixed(1)}%, y:${item.target.y.toFixed(1)}%, w:${item.target.width.toFixed(1)}%, h:${item.target.height.toFixed(1)}% → ${item.target.desiredColor.toUpperCase()}`;
    } else if (item.target.kind === "arrow") {
      target = `矢印 (${item.target.startX.toFixed(1)}%, ${item.target.startY.toFixed(1)}%) → (${item.target.endX.toFixed(1)}%, ${item.target.endY.toFixed(1)}%)`;
    } else {
      target = `位置 x:${item.target.x.toFixed(1)}%, y:${item.target.y.toFixed(1)}%`;
    }
    lines.push("", `${item.id}. **${item.categoryLabel}** — ${target}`, `   ${item.request}`);
  });
  return lines.join("\n");
}

function updatePrompt() {
  if (!annotations.length) {
    promptPreview.textContent = "注釈を追加すると、ここにAI向けの指示が生成されます。";
    return;
  }
  const data = promptData();
  promptPreview.textContent =
    outputFormat === "json" ? JSON.stringify(data, null, 2) : markdownPrompt(data);
}

function updateMeta() {
  const count = annotations.length;
  annotationCount.textContent = `${count} annotation${count === 1 ? "" : "s"}`;
  sidebarCount.textContent = String(count);
  undoButton.disabled = count === 0;
  clearButton.disabled = count === 0;
  copyImageButton.title =
    currentSourceType === "live"
      ? "ライブ画面は画像化できません。スクリーンショットを読み込んでください"
      : "注釈付き画像をコピー";
  downloadImageButton.title =
    currentSourceType === "live"
      ? "ライブ画面は画像化できません。スクリーンショットを読み込んでください"
      : "注釈付きPNGを保存";
}

function persist() {
  localStorage.setItem(annotationStorageKey(), JSON.stringify(annotations));
  scheduleBoardSave();
}

function render() {
  renderAnnotations();
  renderInstructions();
  updatePrompt();
  updateMeta();
  persist();
}

function addPin(point) {
  annotations.push({
    id: nextId++,
    kind: "pin",
    x: point.x,
    y: point.y,
    type: "style",
    text: "",
  });
  render();
  focusLatestInstruction();
}

function addText(point) {
  annotations.push({
    id: nextId++,
    kind: "text",
    x: point.x,
    y: point.y,
    type: "copy",
    text: "",
  });
  render();
  focusLatestInstruction();
}

function focusLatestInstruction() {
  requestAnimationFrame(() => {
    const textareas = instructionList.querySelectorAll("textarea");
    const latest = textareas[textareas.length - 1];
    if (latest) {
      latest.focus();
      instructionList.scrollTop = instructionList.scrollHeight;
    }
  });
}

stage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  if (event.target.closest?.(".live-mode-bar")) return;
  if (currentSourceType === "live" && liveInteractionEnabled) return;
  const point = pointFromEvent(event);
  if (activeTool === "pin") {
    addPin(point);
    return;
  }
  if (activeTool === "text") {
    addText(point);
    return;
  }
  drawing = {
    id: "drawing",
    kind: activeTool === "arrow" ? "arrow" : activeTool === "color" ? "color" : "rect",
    startX: point.x,
    startY: point.y,
    x: point.x,
    y: point.y,
    endX: point.x,
    endY: point.y,
    width: 0,
    height: 0,
    color: selectedColor,
  };
  stage.setPointerCapture(event.pointerId);
  renderAnnotations();
});

stage.addEventListener("pointermove", (event) => {
  if (!drawing) return;
  const point = pointFromEvent(event);
  if (drawing.kind === "arrow") {
    drawing.endX = point.x;
    drawing.endY = point.y;
    renderAnnotations();
    return;
  }
  drawing.x = Math.min(drawing.startX, point.x);
  drawing.y = Math.min(drawing.startY, point.y);
  drawing.width = Math.abs(point.x - drawing.startX);
  drawing.height = Math.abs(point.y - drawing.startY);
  renderAnnotations();
});

stage.addEventListener("pointerup", () => {
  if (!drawing) return;
  if (
    drawing.kind === "arrow" &&
    Math.hypot(drawing.endX - drawing.x, drawing.endY - drawing.y) > 2
  ) {
    annotations.push({
      id: nextId++,
      kind: "arrow",
      x: drawing.x,
      y: drawing.y,
      endX: drawing.endX,
      endY: drawing.endY,
      type: "layout",
      text: "",
    });
  } else if (["rect", "color"].includes(drawing.kind) && drawing.width > 1 && drawing.height > 1) {
    annotations.push({
      id: nextId++,
      kind: drawing.kind,
      x: drawing.x,
      y: drawing.y,
      width: drawing.width,
      height: drawing.height,
      type: drawing.kind === "color" ? "style" : "layout",
      text: drawing.kind === "color" ? `この範囲の色を${drawing.color.toUpperCase()}に変更する` : "",
      ...(drawing.kind === "color" ? { color: drawing.color } : {}),
    });
  }
  drawing = null;
  render();
  focusLatestInstruction();
});

document.querySelectorAll(".tool").forEach((button) => {
  button.addEventListener("click", () => {
    if (currentSourceType === "live") setLiveInteraction(false);
    activeTool = button.dataset.tool;
    document.querySelectorAll(".tool").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
  });
});

toolbarColor.addEventListener("input", (event) => {
  selectedColor = event.target.value;
  toolbarColorSwatch.style.background = selectedColor;
});

document.querySelectorAll("[data-format]").forEach((button) => {
  button.addEventListener("click", () => {
    outputFormat = button.dataset.format;
    document.querySelectorAll("[data-format]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    updatePrompt();
  });
});

undoButton.addEventListener("click", () => {
  annotations.pop();
  render();
});

clearButton.addEventListener("click", () => {
  annotations = [];
  render();
});

function loadImage(file) {
  if (!file || !file.type.startsWith("image/")) return;
  const reader = new FileReader();
  reader.addEventListener("load", async () => {
    currentBoardId = sanitizeId(`review-${Date.now().toString(36)}`);
    currentBoardTitle = file.name || "Clipboard image";
    setBoardUrl(currentBoardId);
    await applyImageSource(reader.result);
    imageInput.value = "";
  });
  reader.readAsDataURL(file);
}

imageInput.addEventListener("change", (event) => loadImage(event.target.files[0]));

liveUrlForm.addEventListener("submit", (event) => {
  event.preventDefault();
  try {
    currentBoardId = sanitizeId(`live-${Date.now().toString(36)}`);
    setBoardUrl(currentBoardId);
    applyLiveSource(liveUrlInput.value);
    showToast("Webアプリを開きました。表示されない場合はiframeが禁止されています", 4000);
  } catch (error) {
    showToast(error.message, 3500);
  }
});

liveModeBar.querySelectorAll("[data-live-mode]").forEach((button) => {
  button.addEventListener("click", () => {
    setLiveInteraction(button.dataset.liveMode === "interact");
  });
});

function imageFromClipboardItems(items) {
  for (const item of items) {
    if (item.kind === "file" && item.type.startsWith("image/")) {
      return item.getAsFile();
    }
  }
  return null;
}

async function pasteImageFromClipboard() {
  if (!navigator.clipboard?.read) {
    showToast("このブラウザでは直接読み取れません。⌘Vで画像を貼り付けてください", 4000);
    return;
  }

  try {
    const items = await navigator.clipboard.read();
    for (const item of items) {
      const imageType = item.types.find((type) => type.startsWith("image/"));
      if (!imageType) continue;
      loadImage(await item.getType(imageType));
      showToast("クリップボードの画像を読み込みました");
      return;
    }
    showToast("クリップボードに画像がありません", 3000);
  } catch {
    showToast("読み取りが許可されませんでした。⌘Vで画像を貼り付けてください", 4000);
  }
}

pasteImageButton.addEventListener("click", pasteImageFromClipboard);

document.addEventListener("paste", (event) => {
  const image = imageFromClipboardItems(event.clipboardData?.items || []);
  if (!image) return;
  event.preventDefault();
  loadImage(image);
  showToast("クリップボードの画像を読み込みました");
});

["dragenter", "dragover"].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.add("is-dragging");
  });
});

["dragleave", "drop"].forEach((name) => {
  dropZone.addEventListener(name, (event) => {
    event.preventDefault();
    dropZone.classList.remove("is-dragging");
  });
});

dropZone.addEventListener("drop", (event) => loadImage(event.dataTransfer.files[0]));

function copyWithSelectionFallback(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  textarea.style.opacity = "0";
  document.body.append(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange(0, textarea.value.length);

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

async function writeClipboard(text) {
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
      // Local file pages commonly reject the async Clipboard API.
    }
  }
  return copyWithSelectionFallback(text);
}

async function copyPrompt() {
  if (!annotations.length) {
    showToast("先に注釈を追加してください");
    return;
  }

  const prompt = promptPreview.textContent;
  const copied = await writeClipboard(prompt);
  if (copied) {
    showToast(`AIプロンプトをコピーしました（${prompt.length}文字）`);
    return;
  }

  showToast("コピーできませんでした。プロンプト欄から手動でコピーしてください", 3500);
}

async function insertIntoAgent() {
  if (!annotations.length) {
    showToast("先に注釈を追加してください");
    return;
  }

  const handoff = `Markupの指示どおり修正して\n\n${promptPreview.textContent}`;
  const copied = await writeClipboard(handoff);
  if (copied) {
    showToast("エージェントへ渡す内容をコピーしました");
    return;
  }
  showToast("コピーできませんでした。プロンプト欄から手動でコピーしてください", 3500);
}

function drawContainedImage(context, image, width, height) {
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

function drawAnnotationsOnCanvas(context, width, height) {
  const accent = "#ff5a36";
  const scale = Math.min(width, height);
  context.lineWidth = Math.max(3, scale * 0.0032);
  context.strokeStyle = accent;
  context.fillStyle = "rgba(255, 90, 54, 0.10)";

  annotations.forEach((annotation, index) => {
    const x = (annotation.x / 100) * width;
    const y = (annotation.y / 100) * height;

    if (annotation.kind === "color") {
      const areaWidth = (annotation.width / 100) * width;
      const areaHeight = (annotation.height / 100) * height;
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
    } else if (annotation.kind === "arrow") {
      const endX = (annotation.endX / 100) * width;
      const endY = (annotation.endY / 100) * height;
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
      const label = `${index + 1} · ${annotation.text || "テキスト"}`;
      const fontSize = Math.max(20, scale * 0.025);
      const paddingX = fontSize * 0.65;
      const paddingY = fontSize * 0.42;
      context.font = `800 ${fontSize}px Arial, sans-serif`;
      const labelWidth = context.measureText(label).width + paddingX * 2;
      const labelHeight = fontSize + paddingY * 2;
      context.fillStyle = accent;
      context.beginPath();
      context.roundRect(x, y, labelWidth, labelHeight, fontSize * 0.3);
      context.fill();
      context.fillStyle = "#ffffff";
      context.textAlign = "left";
      context.textBaseline = "middle";
      context.fillText(label, x + paddingX, y + labelHeight / 2);
      return;
    } else {
      context.beginPath();
      if (annotation.kind === "pin") {
        context.arc(x, y, scale * 0.022, 0, Math.PI * 2);
      } else {
        const areaWidth = (annotation.width / 100) * width;
        const areaHeight = (annotation.height / 100) * height;
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

function createAnnotatedCanvas() {
  if (currentSourceType === "live") {
    throw new Error(
      "ライブ画面はブラウザ制約で画像化できません。スクリーンショットを読み込んでコピーしてください",
    );
  }
  if (!sourceImage.src || sourceImage.style.display === "none") {
    throw new Error("画像を読み込んでください");
  }

  const stageRatio = stage.clientWidth / stage.clientHeight;
  const width = Math.max(1200, Math.min(2400, sourceImage.naturalWidth || 1600));
  const height = Math.round(width / stageRatio);
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  drawContainedImage(context, sourceImage, width, height);
  drawAnnotationsOnCanvas(context, width, height);
  return canvas;
}

function canvasToPngBlob(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new Error("PNGの生成に失敗しました"));
    }, "image/png");
  });
}

function downloadPng(blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `markup-${new Date().toISOString().slice(0, 10)}.png`;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function copyImageWithSelectionFallback(canvas) {
  const container = document.createElement("div");
  const image = document.createElement("img");
  container.contentEditable = "true";
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  image.src = canvas.toDataURL("image/png");
  container.append(image);
  document.body.append(container);

  const selection = window.getSelection();
  const range = document.createRange();
  range.selectNode(image);
  selection.removeAllRanges();
  selection.addRange(range);

  let copied = false;
  try {
    copied = document.execCommand("copy");
  } catch {
    copied = false;
  } finally {
    selection.removeAllRanges();
    container.remove();
  }
  return copied;
}

async function copyImageThroughLocalServer(pngBlob) {
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

async function copyAnnotatedImage() {
  if (!annotations.length) {
    showToast("先に注釈を追加してください");
    return;
  }

  let canvas;
  try {
    canvas = createAnnotatedCanvas();
  } catch (error) {
    showToast(error.message, 3000);
    return;
  }

  let pngBlob;
  try {
    pngBlob = await canvasToPngBlob(canvas);
  } catch {
    showToast("注釈付き画像を生成できませんでした", 3500);
    return;
  }

  if (await copyImageThroughLocalServer(pngBlob)) {
    showToast("注釈付き画像をシステムクリップボードへコピーしました");
    return;
  }

  if (window.isSecureContext && navigator.clipboard?.write && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({
          "image/png": pngBlob,
        }),
      ]);
      showToast("注釈付き画像をコピーしました");
      return;
    } catch {
      // Browser policy may reject image clipboard writes on local file pages.
    }
  }

  if (copyImageWithSelectionFallback(canvas)) {
    showToast("注釈付き画像をコピーしました");
    return;
  }

  try {
    downloadPng(pngBlob);
    const reason =
      location.protocol === "file:"
        ? "file://では画像コピーが禁止されるため、PNGで保存しました。localhostで開くとコピーできます"
        : "画像コピーが許可されないため、PNGで保存しました";
    showToast(reason, 5000);
  } catch {
    showToast("注釈付き画像を生成できませんでした", 3500);
  }
}

async function downloadAnnotatedImage() {
  if (!annotations.length) {
    showToast("先に注釈を追加してください");
    return;
  }

  try {
    const canvas = createAnnotatedCanvas();
    const pngBlob = await canvasToPngBlob(canvas);
    downloadPng(pngBlob);
    showToast("注釈付きPNGを保存しました。Codexの＋から添付できます", 4000);
  } catch (error) {
    showToast(error.message || "注釈付き画像を生成できませんでした", 4000);
  }
}

function showToast(message, duration = 1800) {
  toast.textContent = message;
  toast.classList.add("show");
  window.setTimeout(() => toast.classList.remove("show"), duration);
}

function getStarterPrompt() {
  const startUrl = new URL("./start.md", location.href).href;
  return `Markupオンボーディングを開始してください:\n${startUrl}`;
}

async function copyStarterPrompt() {
  const text = getStarterPrompt();
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const range = document.createRange();
    range.selectNodeContents(starterPrompt);
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
    document.execCommand("copy");
    selection.removeAllRanges();
  }
  showToast("スタータープロンプトをコピーしました");
}

function openGuide() {
  guideModal.hidden = false;
  document.body.classList.add("modal-open");
  guideModal.querySelector(".guide-close").focus();
}

function closeGuide() {
  guideModal.hidden = true;
  document.body.classList.remove("modal-open");
  openGuideButton.focus();
}

function normalizeImportPayload(payload) {
  const image = payload?.images?.[0] || payload?.image;
  const src =
    typeof image === "string" ? image : image?.src || image?.dataUrl || image?.url;
  if (!src) throw new Error("importBoard requires one image.");
  if (src.length > 20 * 1024 * 1024) {
    throw new Error("The imported image payload is too large.");
  }
  if (!/^(data:image\/|https?:\/\/)/i.test(src)) {
    throw new Error("Only image data URLs and HTTP(S) image URLs are accepted.");
  }

  return {
    boardId: sanitizeId(payload.boardId || payload.storageKey || `review-${Date.now()}`),
    title: String(payload.title || image?.title || "UI Review").slice(0, 120),
    src,
  };
}

async function importBoard(payload) {
  const imported = normalizeImportPayload(payload);
  currentBoardId = imported.boardId;
  currentBoardTitle = imported.title;
  localStorage.removeItem(annotationStorageKey(currentBoardId));
  annotations = [];
  nextId = 1;
  await applyImageSource(imported.src);
  setBoardUrl(currentBoardId);
  await writeBoard({
    id: currentBoardId,
    title: currentBoardTitle,
    sourceType: "image",
    image: sourceImage.src,
    liveUrl: null,
    annotations: [],
    updatedAt: new Date().toISOString(),
  });
  return {
    boardId: currentBoardId,
    title: currentBoardTitle,
    url: location.href,
    imageCount: 1,
  };
}

async function clearImportedBoard(payload = {}) {
  const boardId = sanitizeId(payload.boardId || currentBoardId);
  localStorage.removeItem(annotationStorageKey(boardId));
  await deleteBoard(boardId);
  if (boardId === currentBoardId) {
    annotations = [];
    sourceImage.removeAttribute("src");
    sourceImage.style.display = "none";
    liveFrame.removeAttribute("src");
    liveFrame.style.display = "none";
    liveModeBar.hidden = true;
    demoPage.style.display = "block";
    currentSourceType = "demo";
    currentLiveUrl = "";
    currentBoardId = "default";
    currentBoardTitle = "UI Review";
    history.replaceState(null, "", location.pathname + location.search);
    render();
  }
  return { boardId, cleared: true };
}

function getBoardSnapshot() {
  return {
    version: 1,
    boardId: currentBoardId,
    title: currentBoardTitle,
    sourceType: currentSourceType,
    image: currentSourceType === "image" ? sourceImage.src || null : null,
    liveUrl: currentSourceType === "live" ? currentLiveUrl : null,
    annotations: structuredClone(annotations),
  };
}

async function restoreBoardFromLocation() {
  const boardId = boardIdFromLocation();
  if (!boardId) {
    annotations = loadAnnotations("default");
    nextId = Math.max(0, ...annotations.map((item) => Number(item.id) || 0)) + 1;
    render();
    return { restored: false };
  }

  currentBoardId = boardId;
  const board = await readBoard(boardId);
  if (!board?.image && !board?.liveUrl) {
    annotations = loadAnnotations(boardId);
    render();
    return { restored: false, boardId };
  }

  currentBoardTitle = board.title || "UI Review";
  const localAnnotations = loadAnnotations(boardId);
  annotations = hasStoredAnnotations(boardId)
    ? localAnnotations
    : Array.isArray(board.annotations)
      ? board.annotations
      : [];
  nextId = Math.max(0, ...annotations.map((item) => Number(item.id) || 0)) + 1;
  if (board.sourceType === "live" || board.liveUrl) {
    applyLiveSource(board.liveUrl, { clearAnnotations: false });
  } else {
    await applyImageSource(board.image, { clearAnnotations: false });
  }
  return { restored: true, boardId };
}

const markupReady = restoreBoardFromLocation().catch(() => {
  annotations = loadAnnotations(currentBoardId);
  render();
  return { restored: false };
});

window.Markup = {
  version: 1,
  ready: async () => {
    await markupReady;
    return { version: 1, ready: true };
  },
  importBoard,
  clearBoard: clearImportedBoard,
  getSnapshot: async () => {
    await markupReady;
    return getBoardSnapshot();
  },
};

window.addEventListener("message", async (event) => {
  const message = event.data;
  if (!message || !MARKUP_MESSAGE_TYPES.has(message.type)) return;

  const expectedToken = new URL(location.href).searchParams.get("token");
  if (expectedToken ? message.token !== expectedToken : event.origin !== location.origin) return;

  const responseTarget = event.source;
  try {
    const result =
      message.type === "markup:import"
        ? await importBoard(message.payload)
        : await clearImportedBoard(message.payload);
    responseTarget?.postMessage(
      {
        type: "markup:ack",
        ok: true,
        requestId: message.requestId,
        command: message.type,
        summary: result,
      },
      event.origin === "null" ? "*" : event.origin,
    );
  } catch (error) {
    responseTarget?.postMessage(
      {
        type: "markup:error",
        ok: false,
        requestId: message.requestId,
        command: message.type,
        errorMessage: error.message,
      },
      event.origin === "null" ? "*" : event.origin,
    );
  }
});

document.querySelector("#copyPrompt").addEventListener("click", copyPrompt);
document.querySelector("#copyPromptTop").addEventListener("click", copyPrompt);
insertAgentButton.addEventListener("click", insertIntoAgent);
copyImageButton.addEventListener("click", copyAnnotatedImage);
downloadImageButton.addEventListener("click", downloadAnnotatedImage);
starterPrompt.textContent = getStarterPrompt();
copyStarterPromptButton.addEventListener("click", copyStarterPrompt);
openGuideButton.addEventListener("click", openGuide);
guideModal.querySelectorAll("[data-close-guide]").forEach((element) => {
  element.addEventListener("click", closeGuide);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !guideModal.hidden) closeGuide();
});
