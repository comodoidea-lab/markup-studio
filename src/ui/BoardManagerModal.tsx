import { useEffect, useRef, useState } from "react";
import type { DesignDocument } from "../state/types";
import { useDesignStore } from "../state/designStore";
import { listDesigns, writeDesign } from "../state/persistence";
import { showToast } from "./toast";
import {
  Download,
  FolderOpen,
  HardDrive,
  Loader2,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";

const BOARD_FILE_VERSION = 1;

interface BoardFile {
  version: number;
  type: "markup-studio-board";
  document: DesignDocument;
}

function isDesignDocument(value: unknown): value is DesignDocument {
  if (!value || typeof value !== "object") return false;
  const doc = value as DesignDocument;
  return (
    typeof doc.id === "string" &&
    typeof doc.name === "string" &&
    Array.isArray(doc.frames) &&
    typeof doc.updatedAt === "string"
  );
}

function parseBoardFile(raw: unknown): DesignDocument | null {
  if (isDesignDocument(raw)) return raw;
  if (!raw || typeof raw !== "object") return null;
  const file = raw as BoardFile;
  if (file.type === "markup-studio-board" && isDesignDocument(file.document)) {
    return file.document;
  }
  return null;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString("ja-JP", {
      month: "numeric",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function safeFilename(name: string): string {
  return name.trim().replace(/[^\w\u3000-\u9fff.-]+/g, "_") || "board";
}

export function BoardManagerModal({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const doc = useDesignStore((state) => state.doc);
  const openBoard = useDesignStore((state) => state.openBoard);
  const newBoard = useDesignStore((state) => state.newBoard);
  const saveBoardNow = useDesignStore((state) => state.saveBoardNow);
  const saveBoardAs = useDesignStore((state) => state.saveBoardAs);
  const removeBoard = useDesignStore((state) => state.removeBoard);
  const renameDoc = useDesignStore((state) => state.renameDoc);

  const [boards, setBoards] = useState<DesignDocument[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveAsName, setSaveAsName] = useState("");
  const importRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      const items = await listDesigns();
      setBoards(items.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)));
    } catch {
      showToast("保存済みボードを読み込めませんでした", 3500);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!open) return;
    setSaveAsName(`${doc.name} copy`);
    void refresh();
  }, [open, doc.name]);

  if (!open) return null;

  const exportJson = (board: DesignDocument) => {
    const payload: BoardFile = {
      version: BOARD_FILE_VERSION,
      type: "markup-studio-board",
      document: board,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${safeFilename(board.name)}.markup-board.json`;
    link.click();
    URL.revokeObjectURL(url);
    showToast("ボードをJSONでエクスポートしました", 2500);
  };

  const importJsonFile = async (file: File | undefined | null) => {
    if (!file) return;
    try {
      const parsed = parseBoardFile(JSON.parse(await file.text()));
      if (!parsed) throw new Error("invalid format");
      openBoard(parsed);
      await writeDesign({ ...parsed, updatedAt: new Date().toISOString() });
      await refresh();
      showToast(`「${parsed.name}」を読み込みました`, 3000);
      onClose();
    } catch {
      showToast("ボードファイルの形式が正しくありません", 3500);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveBoardNow();
      await refresh();
      showToast("ボードを保存しました", 2200);
    } catch {
      showToast("保存に失敗しました", 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAs = async () => {
    const name = saveAsName.trim();
    if (!name) {
      showToast("ボード名を入力してください", 2500);
      return;
    }
    setSaving(true);
    try {
      await saveBoardAs(name);
      await refresh();
      showToast(`「${name}」として保存しました`, 3000);
      onClose();
    } catch {
      showToast("保存に失敗しました", 3500);
    } finally {
      setSaving(false);
    }
  };

  const handleOpen = (board: DesignDocument) => {
    openBoard(board);
    showToast(`「${board.name}」を開きました`, 2500);
    onClose();
  };

  const handleDelete = async (board: DesignDocument) => {
    if (!window.confirm(`「${board.name}」を削除しますか？`)) return;
    try {
      await removeBoard(board.id);
      await refresh();
      showToast("ボードを削除しました", 2500);
    } catch {
      showToast("削除に失敗しました", 3500);
    }
  };

  const handleNewBoard = () => {
    if (doc.frames.length && !window.confirm("未保存の変更は自動保存されます。新しい空ボードを開きますか？")) {
      return;
    }
    newBoard();
    showToast("新しい空ボードを開きました", 2500);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/50" onClick={onClose} />
      <div className="relative flex max-h-[88vh] w-[560px] max-w-full flex-col rounded-2xl bg-white shadow-2xl">
        <div className="flex items-start justify-between border-b border-slate-200 px-5 py-4">
          <div>
            <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
              <HardDrive size={16} className="text-[#ff5a36]" />
              ボード管理
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              フレームセットをこのブラウザに保存し、あとから呼び出せます。
            </p>
          </div>
          <button
            className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
            onClick={onClose}
            aria-label="閉じる"
          >
            <X size={16} />
          </button>
        </div>

        <div className="space-y-4 overflow-y-auto px-5 py-4">
          <section className="rounded-xl border border-slate-200 bg-slate-50/70 p-3">
            <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
              現在のボード
            </p>
            <input
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-semibold text-slate-800 focus:border-blue-400 focus:outline-none"
              value={doc.name}
              onChange={(event) => renameDoc(event.target.value)}
              aria-label="ボード名"
            />
            <p className="mt-1.5 text-[11px] text-slate-500">
              {doc.frames.length} フレーム · 最終更新 {formatDate(doc.updatedAt)}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                className="flex items-center gap-1.5 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSave()}
              >
                {saving ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                上書き保存
              </button>
              <button
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={() => exportJson(doc)}
              >
                <Download size={13} />
                JSONでエクスポート
              </button>
              <button
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                onClick={handleNewBoard}
              >
                <Plus size={13} />
                新しい空ボード
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <input
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs focus:border-blue-400 focus:outline-none"
                placeholder="別名で保存する名前"
                value={saveAsName}
                onChange={(event) => setSaveAsName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") void handleSaveAs();
                }}
              />
              <button
                className="shrink-0 rounded-lg border border-[#ff5a36]/30 bg-[#fff0eb] px-3 py-1.5 text-xs font-semibold text-[#ff5a36] hover:bg-[#ffe4dc] disabled:opacity-50"
                disabled={saving}
                onClick={() => void handleSaveAs()}
              >
                名前を付けて保存
              </button>
            </div>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between">
              <p className="text-[10px] font-bold tracking-widest text-slate-400 uppercase">
                保存済みボード
              </p>
              <button
                className="flex items-center gap-1 rounded-md px-2 py-1 text-[11px] text-slate-500 hover:bg-slate-100"
                onClick={() => importRef.current?.click()}
              >
                <Upload size={12} />
                JSONから読み込み
              </button>
              <input
                ref={importRef}
                type="file"
                accept="application/json,.json,.markup-board.json"
                className="hidden"
                onChange={(event) => {
                  void importJsonFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>

            {loading ? (
              <div className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-slate-200 py-8 text-xs text-slate-400">
                <Loader2 size={14} className="animate-spin" />
                読み込み中…
              </div>
            ) : boards.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center text-xs text-slate-500">
                まだ保存されたボードがありません。
                <br />
                上書き保存するか、JSONファイルを読み込んでください。
              </div>
            ) : (
              <div className="flex max-h-56 flex-col gap-1.5 overflow-y-auto">
                {boards.map((board) => {
                  const active = board.id === doc.id;
                  return (
                    <article
                      key={board.id}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 ${
                        active ? "border-blue-300 bg-blue-50/60" : "border-slate-200 bg-white"
                      }`}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-slate-800">
                          {board.name}
                          {active && (
                            <span className="ml-1.5 text-[10px] font-bold text-blue-600">
                              編集中
                            </span>
                          )}
                        </p>
                        <p className="text-[11px] text-slate-500">
                          {board.frames.length} フレーム · {formatDate(board.updatedAt)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-0.5">
                        {!active && (
                          <button
                            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                            title="開く"
                            onClick={() => handleOpen(board)}
                          >
                            <FolderOpen size={14} />
                          </button>
                        )}
                        <button
                          className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
                          title="JSONでエクスポート"
                          onClick={() => exportJson(board)}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          className="rounded-md p-1.5 text-red-500 hover:bg-red-50"
                          title="削除"
                          onClick={() => void handleDelete(board)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
