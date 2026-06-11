import { create } from "zustand";
import type { ChatMessage, DesignDocument, DesignNode, NodeStyle } from "./types";
import {
  cloneWithNewIds,
  createFrame,
  findFrameOf,
  findNode,
  findParent,
  genId,
  isContainer,
} from "./nodeUtils";
import { deleteDesign, listDesigns, writeDesign } from "./persistence";

const HISTORY_LIMIT = 80;

interface Viewport {
  x: number;
  y: number;
  zoom: number;
}

interface DesignState {
  doc: DesignDocument;
  selectedId: string | null;
  hoverId: string | null;
  viewport: Viewport;
  past: DesignNode[][];
  future: DesignNode[][];
  transientSnapshot: DesignNode[] | null;
  chat: ChatMessage[];
  aiBusy: boolean;
  loaded: boolean;

  load: () => Promise<void>;
  openBoard: (doc: DesignDocument) => void;
  newBoard: () => void;
  saveBoardNow: () => Promise<void>;
  saveBoardAs: (name: string) => Promise<void>;
  removeBoard: (id: string) => Promise<void>;
  select: (id: string | null) => void;
  setHover: (id: string | null) => void;
  setViewport: (viewport: Viewport) => void;
  renameDoc: (name: string) => void;

  mutate: (fn: (frames: DesignNode[]) => void, options?: { history?: boolean }) => void;
  beginTransient: () => void;
  commitTransient: () => void;
  undo: () => void;
  redo: () => void;

  addFrame: (width: number, height: number, label: string) => string;
  insertGeneratedFrame: (frame: DesignNode, near?: string | null) => string;
  replaceNode: (id: string, replacement: DesignNode) => void;
  addChild: (parentId: string, node: DesignNode) => void;
  deleteNode: (id: string) => void;
  duplicateNode: (id: string) => void;
  moveNode: (id: string, delta: -1 | 1) => void;
  updateNode: (id: string, patch: Partial<DesignNode>, options?: { history?: boolean }) => void;
  updateStyle: (id: string, patch: Partial<NodeStyle>, options?: { history?: boolean }) => void;

  pushChat: (message: ChatMessage) => void;
  setAiBusy: (busy: boolean) => void;
}

function newDocument(name = "Untitled design"): DesignDocument {
  return {
    id: genId("design"),
    name,
    frames: [],
    updatedAt: new Date().toISOString(),
  };
}

function resetEditorState(doc: DesignDocument) {
  return {
    doc,
    selectedId: null,
    hoverId: null,
    viewport: { x: 0, y: 0, zoom: 0.85 },
    past: [] as DesignNode[][],
    future: [] as DesignNode[][],
    transientSnapshot: null,
    chat: [] as ChatMessage[],
  };
}

let saveTimer: number | undefined;

function scheduleSave(doc: DesignDocument) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    writeDesign({ ...doc, updatedAt: new Date().toISOString() }).catch(() => {});
  }, 400);
}

function frameSpawnPosition(frames: DesignNode[]): { x: number; y: number } {
  if (!frames.length) return { x: 80, y: 60 };
  const maxRight = Math.max(
    ...frames.map((frame) => (frame.x ?? 0) + Number(frame.style.width ?? 390)),
  );
  const minY = Math.min(...frames.map((frame) => frame.y ?? 0));
  return { x: maxRight + 120, y: minY };
}

export const useDesignStore = create<DesignState>((set, get) => ({
  doc: newDocument(),
  selectedId: null,
  hoverId: null,
  viewport: { x: 0, y: 0, zoom: 0.85 },
  past: [],
  future: [],
  transientSnapshot: null,
  chat: [],
  aiBusy: false,
  loaded: false,

  load: async () => {
    try {
      const designs = await listDesigns();
      if (designs.length) {
        const latest = designs.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
        set({ ...resetEditorState(latest), loaded: true });
        return;
      }
    } catch {
      // IndexedDB unavailable — keep the in-memory document.
    }
    const doc = newDocument();
    set({ ...resetEditorState(doc), loaded: true });
    scheduleSave(doc);
  },

  openBoard: (doc) => {
    set(resetEditorState(doc));
    scheduleSave(doc);
  },

  newBoard: () => {
    const doc = newDocument();
    set(resetEditorState(doc));
    scheduleSave(doc);
  },

  saveBoardNow: async () => {
    const doc = { ...get().doc, updatedAt: new Date().toISOString() };
    set({ doc });
    await writeDesign(doc);
  },

  saveBoardAs: async (name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    const source = get().doc;
    const doc: DesignDocument = {
      ...structuredClone(source),
      id: genId("design"),
      name: trimmed,
      updatedAt: new Date().toISOString(),
    };
    await writeDesign(doc);
    set(resetEditorState(doc));
  },

  removeBoard: async (id) => {
    await deleteDesign(id);
    if (get().doc.id !== id) return;
    try {
      const remaining = (await listDesigns()).sort((a, b) =>
        b.updatedAt.localeCompare(a.updatedAt),
      );
      if (remaining.length) {
        set(resetEditorState(remaining[0]));
        return;
      }
    } catch {
      // fall through to a fresh board
    }
    const doc = newDocument();
    set(resetEditorState(doc));
    scheduleSave(doc);
  },

  select: (id) => set({ selectedId: id }),
  setHover: (id) => set({ hoverId: id }),
  setViewport: (viewport) => set({ viewport }),
  renameDoc: (name) => {
    const doc = { ...get().doc, name };
    set({ doc });
    scheduleSave(doc);
  },

  mutate: (fn, options) => {
    const { doc, past } = get();
    const frames = structuredClone(doc.frames);
    fn(frames);
    const nextDoc = { ...doc, frames };
    const withHistory = options?.history !== false;
    set({
      doc: nextDoc,
      past: withHistory ? [...past.slice(-HISTORY_LIMIT), doc.frames] : past,
      future: withHistory ? [] : get().future,
    });
    scheduleSave(nextDoc);
  },

  beginTransient: () => {
    if (!get().transientSnapshot) set({ transientSnapshot: get().doc.frames });
  },

  commitTransient: () => {
    const { transientSnapshot, past, doc } = get();
    if (!transientSnapshot) return;
    if (transientSnapshot !== doc.frames) {
      set({ past: [...past.slice(-HISTORY_LIMIT), transientSnapshot], future: [] });
    }
    set({ transientSnapshot: null });
    scheduleSave(doc);
  },

  undo: () => {
    const { past, future, doc } = get();
    if (!past.length) return;
    const previous = past[past.length - 1];
    const nextDoc = { ...doc, frames: previous };
    set({
      doc: nextDoc,
      past: past.slice(0, -1),
      future: [doc.frames, ...future].slice(0, HISTORY_LIMIT),
      selectedId: null,
    });
    scheduleSave(nextDoc);
  },

  redo: () => {
    const { past, future, doc } = get();
    if (!future.length) return;
    const next = future[0];
    const nextDoc = { ...doc, frames: next };
    set({
      doc: nextDoc,
      past: [...past.slice(-HISTORY_LIMIT), doc.frames],
      future: future.slice(1),
      selectedId: null,
    });
    scheduleSave(nextDoc);
  },

  addFrame: (width, height, label) => {
    const position = frameSpawnPosition(get().doc.frames);
    const frame = createFrame(label, width, height, position.x, position.y);
    get().mutate((frames) => {
      frames.push(frame);
    });
    set({ selectedId: frame.id });
    return frame.id;
  },

  insertGeneratedFrame: (frame, near) => {
    const frames = get().doc.frames;
    let x: number;
    let y: number;
    const anchor = near ? frames.find((item) => item.id === near) : null;
    if (anchor) {
      x = (anchor.x ?? 0) + Number(anchor.style.width ?? 390) + 120;
      y = anchor.y ?? 0;
    } else {
      ({ x, y } = frameSpawnPosition(frames));
    }
    const placed = { ...frame, x, y };
    get().mutate((draft) => {
      draft.push(placed);
    });
    set({ selectedId: placed.id });
    return placed.id;
  },

  replaceNode: (id, replacement) => {
    get().mutate((frames) => {
      const index = frames.findIndex((frame) => frame.id === id);
      if (index >= 0) {
        const old = frames[index];
        frames[index] = {
          ...replacement,
          type: "frame",
          x: old.x,
          y: old.y,
          style: { ...replacement.style, width: old.style.width, height: old.style.height },
        };
        return;
      }
      const parent = findParent(frames, id);
      if (!parent?.children) return;
      const childIndex = parent.children.findIndex((child) => child.id === id);
      if (childIndex >= 0) parent.children[childIndex] = replacement;
    });
    set({ selectedId: replacement.id });
  },

  addChild: (parentId, node) => {
    get().mutate((frames) => {
      const parent = findNode(frames, parentId);
      if (!parent || !isContainer(parent)) return;
      parent.children = parent.children ?? [];
      parent.children.push(node);
    });
    set({ selectedId: node.id });
  },

  deleteNode: (id) => {
    get().mutate((frames) => {
      const frameIndex = frames.findIndex((frame) => frame.id === id);
      if (frameIndex >= 0) {
        frames.splice(frameIndex, 1);
        return;
      }
      const parent = findParent(frames, id);
      if (parent?.children) {
        parent.children = parent.children.filter((child) => child.id !== id);
      }
    });
    if (get().selectedId === id) set({ selectedId: null });
  },

  duplicateNode: (id) => {
    let newId: string | null = null;
    get().mutate((frames) => {
      const frameIndex = frames.findIndex((frame) => frame.id === id);
      if (frameIndex >= 0) {
        const copy = cloneWithNewIds(frames[frameIndex]);
        copy.x = (frames[frameIndex].x ?? 0) + 40;
        copy.y = (frames[frameIndex].y ?? 0) + 40;
        copy.name = `${frames[frameIndex].name ?? "Frame"} copy`;
        frames.splice(frameIndex + 1, 0, copy);
        newId = copy.id;
        return;
      }
      const parent = findParent(frames, id);
      if (!parent?.children) return;
      const index = parent.children.findIndex((child) => child.id === id);
      const copy = cloneWithNewIds(parent.children[index]);
      parent.children.splice(index + 1, 0, copy);
      newId = copy.id;
    });
    if (newId) set({ selectedId: newId });
  },

  moveNode: (id, delta) => {
    get().mutate((frames) => {
      const parent = findParent(frames, id);
      const list = parent?.children ?? frames;
      const index = list.findIndex((item) => item.id === id);
      const target = index + delta;
      if (index < 0 || target < 0 || target >= list.length) return;
      const [item] = list.splice(index, 1);
      list.splice(target, 0, item);
    });
  },

  updateNode: (id, patch, options) => {
    get().mutate((frames) => {
      const node = findNode(frames, id);
      if (node) Object.assign(node, patch);
    }, options);
  },

  updateStyle: (id, patch, options) => {
    get().mutate((frames) => {
      const node = findNode(frames, id);
      if (!node) return;
      node.style = { ...node.style, ...patch };
      for (const [key, value] of Object.entries(patch)) {
        if (value === undefined) delete (node.style as Record<string, unknown>)[key];
      }
    }, options);
  },

  pushChat: (message) => set({ chat: [...get().chat, message] }),
  setAiBusy: (busy) => set({ aiBusy: busy }),
}));

export function useSelectedNode(): DesignNode | null {
  return useDesignStore((state) =>
    state.selectedId ? findNode(state.doc.frames, state.selectedId) : null,
  );
}

export function selectedFrameId(): string | null {
  const { doc, selectedId } = useDesignStore.getState();
  if (!selectedId) return doc.frames[0]?.id ?? null;
  return findFrameOf(doc.frames, selectedId)?.id ?? doc.frames[0]?.id ?? null;
}
