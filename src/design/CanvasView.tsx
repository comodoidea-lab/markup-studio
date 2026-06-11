import { useCallback, useEffect, useRef, useState } from "react";
import type { DesignNode } from "../state/types";
import { useDesignStore } from "../state/designStore";
import { NodeRenderer } from "./NodeRenderer";
import { Minus, Plus, Maximize } from "lucide-react";

const MIN_ZOOM = 0.1;
const MAX_ZOOM = 3;

interface SnapGuides {
  x: number | null;
  y: number | null;
}

/** Snaps a dragged frame's edges to other frames' edges. */
function snapPosition(
  rawX: number,
  rawY: number,
  width: number,
  height: number,
  others: DesignNode[],
  zoom: number,
): { x: number; y: number; guides: SnapGuides } {
  const threshold = 8 / zoom;
  const xEdges: number[] = [];
  const yEdges: number[] = [];
  for (const other of others) {
    const otherW = Number(other.style.width ?? 390);
    const otherH = Number(other.style.height ?? 844);
    xEdges.push(other.x ?? 0, (other.x ?? 0) + otherW);
    yEdges.push(other.y ?? 0, (other.y ?? 0) + otherH);
  }
  let x = rawX;
  let y = rawY;
  const guides: SnapGuides = { x: null, y: null };
  for (const edge of xEdges) {
    if (Math.abs(rawX - edge) < threshold) {
      x = edge;
      guides.x = edge;
      break;
    }
    if (Math.abs(rawX + width - edge) < threshold) {
      x = edge - width;
      guides.x = edge;
      break;
    }
  }
  for (const edge of yEdges) {
    if (Math.abs(rawY - edge) < threshold) {
      y = edge;
      guides.y = edge;
      break;
    }
    if (Math.abs(rawY + height - edge) < threshold) {
      y = edge - height;
      guides.y = edge;
      break;
    }
  }
  return { x: Math.round(x), y: Math.round(y), guides };
}

function FrameView({
  frame,
  onSnapGuides,
}: {
  frame: DesignNode;
  onSnapGuides: (guides: SnapGuides | null) => void;
}) {
  const select = useDesignStore((state) => state.select);
  const selected = useDesignStore((state) => state.selectedId === frame.id);
  const updateNode = useDesignStore((state) => state.updateNode);
  const updateStyle = useDesignStore((state) => state.updateStyle);
  const beginTransient = useDesignStore((state) => state.beginTransient);
  const commitTransient = useDesignStore((state) => state.commitTransient);
  const zoom = useDesignStore((state) => state.viewport.zoom);

  const width = Number(frame.style.width ?? 390);
  const height = Number(frame.style.height ?? 844);

  const startDrag = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0) return;
      event.stopPropagation();
      select(frame.id);
      beginTransient();
      const startX = event.clientX;
      const startY = event.clientY;
      const originX = frame.x ?? 0;
      const originY = frame.y ?? 0;
      const currentZoom = useDesignStore.getState().viewport.zoom;

      const others = useDesignStore
        .getState()
        .doc.frames.filter((other) => other.id !== frame.id);
      const frameW = Number(frame.style.width ?? 390);
      const frameH = Number(frame.style.height ?? 844);

      const onMove = (move: PointerEvent) => {
        const rawX = originX + (move.clientX - startX) / currentZoom;
        const rawY = originY + (move.clientY - startY) / currentZoom;
        const snapped = snapPosition(rawX, rawY, frameW, frameH, others, currentZoom);
        onSnapGuides(snapped.guides.x != null || snapped.guides.y != null ? snapped.guides : null);
        updateNode(frame.id, { x: snapped.x, y: snapped.y }, { history: false });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        onSnapGuides(null);
        commitTransient();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [frame, select, updateNode, beginTransient, commitTransient, onSnapGuides],
  );

  const startResize = useCallback(
    (event: React.PointerEvent, axis: "x" | "y" | "xy") => {
      event.stopPropagation();
      select(frame.id);
      beginTransient();
      const startX = event.clientX;
      const startY = event.clientY;
      const originW = width;
      const originH = height;
      const currentZoom = useDesignStore.getState().viewport.zoom;

      const onMove = (move: PointerEvent) => {
        const patch: Record<string, number> = {};
        if (axis !== "y") {
          patch.width = Math.max(120, Math.round(originW + (move.clientX - startX) / currentZoom));
        }
        if (axis !== "x") {
          patch.height = Math.max(120, Math.round(originH + (move.clientY - startY) / currentZoom));
        }
        updateStyle(frame.id, patch, { history: false });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
        commitTransient();
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [frame.id, width, height, select, updateStyle, beginTransient, commitTransient],
  );

  const handleSize = Math.max(8, 10 / zoom);

  return (
    <div className="absolute" style={{ left: frame.x ?? 0, top: frame.y ?? 0 }}>
      <div
        className={`absolute -top-7 left-0 flex max-w-full cursor-grab items-center gap-1 truncate text-[13px] font-semibold select-none active:cursor-grabbing ${
          selected ? "text-blue-600" : "text-slate-500"
        }`}
        style={{ fontSize: Math.min(15, Math.max(11, 13 / zoom)) }}
        onPointerDown={startDrag}
      >
        {frame.name ?? "Frame"}
        <span className="font-normal text-slate-400">
          {width}×{height}
        </span>
      </div>
      <div
        className="relative overflow-hidden bg-white"
        style={{
          width,
          height,
          borderRadius: 6,
          boxShadow: selected
            ? "0 0 0 2px #2563eb, 0 18px 48px rgba(15,23,42,0.18)"
            : "0 0 0 1px rgba(15,23,42,0.08), 0 14px 40px rgba(15,23,42,0.12)",
        }}
        onPointerDown={(event) => {
          event.stopPropagation();
          select(frame.id);
        }}
      >
        <div className="h-full w-full overflow-hidden">
          <NodeRenderer node={{ ...frame, x: undefined, y: undefined }} parentDirection="column" />
        </div>
      </div>
      {selected && (
        <>
          <div
            className="absolute cursor-ew-resize"
            style={{ right: -handleSize / 2, top: 0, width: handleSize, height: "100%" }}
            onPointerDown={(event) => startResize(event, "x")}
          />
          <div
            className="absolute cursor-ns-resize"
            style={{ bottom: -handleSize / 2, left: 0, height: handleSize, width: "100%" }}
            onPointerDown={(event) => startResize(event, "y")}
          />
          <div
            className="absolute rounded-full border-2 border-blue-600 bg-white"
            style={{
              right: -handleSize,
              bottom: -handleSize,
              width: handleSize * 1.6,
              height: handleSize * 1.6,
              cursor: "nwse-resize",
            }}
            onPointerDown={(event) => startResize(event, "xy")}
          />
        </>
      )}
    </div>
  );
}

export function CanvasView({ autoFit = false }: { autoFit?: boolean }) {
  const frames = useDesignStore((state) => state.doc.frames);
  const loaded = useDesignStore((state) => state.loaded);
  const viewport = useDesignStore((state) => state.viewport);
  const setViewport = useDesignStore((state) => state.setViewport);
  const select = useDesignStore((state) => state.select);
  const containerRef = useRef<HTMLDivElement>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuides | null>(null);
  const autoFitDone = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const state = useDesignStore.getState().viewport;
      if (event.ctrlKey || event.metaKey) {
        const bounds = container.getBoundingClientRect();
        const cursorX = event.clientX - bounds.left;
        const cursorY = event.clientY - bounds.top;
        const nextZoom = Math.min(
          MAX_ZOOM,
          Math.max(MIN_ZOOM, state.zoom * Math.exp(-event.deltaY * 0.0022)),
        );
        const scale = nextZoom / state.zoom;
        setViewport({
          zoom: nextZoom,
          x: cursorX - (cursorX - state.x) * scale,
          y: cursorY - (cursorY - state.y) * scale,
        });
      } else {
        setViewport({ ...state, x: state.x - event.deltaX, y: state.y - event.deltaY });
      }
    };
    container.addEventListener("wheel", onWheel, { passive: false });
    return () => container.removeEventListener("wheel", onWheel);
  }, [setViewport]);

  const startPan = useCallback(
    (event: React.PointerEvent) => {
      if (event.button !== 0 && event.button !== 1) return;
      select(null);
      const start = useDesignStore.getState().viewport;
      const startX = event.clientX;
      const startY = event.clientY;
      const onMove = (move: PointerEvent) => {
        setViewport({
          ...start,
          x: start.x + (move.clientX - startX),
          y: start.y + (move.clientY - startY),
        });
      };
      const onUp = () => {
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      };
      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
    },
    [select, setViewport],
  );

  const zoomBy = (factor: number) => {
    const container = containerRef.current;
    const state = useDesignStore.getState().viewport;
    const bounds = container?.getBoundingClientRect();
    const centerX = bounds ? bounds.width / 2 : 0;
    const centerY = bounds ? bounds.height / 2 : 0;
    const nextZoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, state.zoom * factor));
    const scale = nextZoom / state.zoom;
    setViewport({
      zoom: nextZoom,
      x: centerX - (centerX - state.x) * scale,
      y: centerY - (centerY - state.y) * scale,
    });
  };

  useEffect(() => {
    if (!autoFit || autoFitDone.current || !loaded || !frames.length) return;
    autoFitDone.current = true;
    requestAnimationFrame(() => zoomToFitRef.current());
  }, [autoFit, loaded, frames.length]);

  const zoomToFit = () => {
    const container = containerRef.current;
    if (!container || !frames.length) return;
    const bounds = container.getBoundingClientRect();
    const minX = Math.min(...frames.map((frame) => frame.x ?? 0));
    const minY = Math.min(...frames.map((frame) => frame.y ?? 0));
    const maxX = Math.max(
      ...frames.map((frame) => (frame.x ?? 0) + Number(frame.style.width ?? 390)),
    );
    const maxY = Math.max(
      ...frames.map((frame) => (frame.y ?? 0) + Number(frame.style.height ?? 844)),
    );
    const zoom = Math.min(
      MAX_ZOOM,
      Math.max(
        MIN_ZOOM,
        Math.min((bounds.width - 120) / (maxX - minX), (bounds.height - 140) / (maxY - minY)),
      ),
    );
    setViewport({
      zoom,
      x: (bounds.width - (maxX - minX) * zoom) / 2 - minX * zoom,
      y: (bounds.height - (maxY - minY) * zoom) / 2 - minY * zoom + 14,
    });
  };
  const zoomToFitRef = useRef(zoomToFit);
  zoomToFitRef.current = zoomToFit;

  return (
    <div
      ref={containerRef}
      className="relative h-full w-full touch-none overflow-hidden bg-[#f4f3ed]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(32,33,28,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(32,33,28,0.05) 1px, transparent 1px)",
        backgroundSize: `${24 * viewport.zoom}px ${24 * viewport.zoom}px`,
        backgroundPosition: `${viewport.x}px ${viewport.y}px`,
      }}
      onPointerDown={startPan}
    >
      <div
        className="absolute top-0 left-0 origin-top-left"
        style={{ transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})` }}
      >
        {frames.map((frame) => (
          <FrameView key={frame.id} frame={frame} onSnapGuides={setSnapGuides} />
        ))}
        {snapGuides?.x != null && (
          <div
            className="pointer-events-none absolute bg-pink-500"
            style={{ left: snapGuides.x, top: -100000, width: 1 / viewport.zoom, height: 200000 }}
          />
        )}
        {snapGuides?.y != null && (
          <div
            className="pointer-events-none absolute bg-pink-500"
            style={{ top: snapGuides.y, left: -100000, height: 1 / viewport.zoom, width: 200000 }}
          />
        )}
      </div>

      <div className="absolute right-4 bottom-4 flex items-center gap-1 rounded-xl border border-[#d9d9d0] bg-white p-1 shadow-lg">
        <button
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          onClick={() => zoomBy(1 / 1.2)}
          title="ズームアウト"
        >
          <Minus size={15} />
        </button>
        <span className="w-12 text-center text-xs font-semibold text-slate-600 tabular-nums">
          {Math.round(viewport.zoom * 100)}%
        </span>
        <button
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          onClick={() => zoomBy(1.2)}
          title="ズームイン"
        >
          <Plus size={15} />
        </button>
        <button
          className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100"
          onClick={zoomToFit}
          title="全体を表示"
        >
          <Maximize size={15} />
        </button>
      </div>
    </div>
  );
}
