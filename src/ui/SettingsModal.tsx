import { useSettingsStore } from "../state/settingsStore";
import { useWorkersAI } from "../ai/config";
import type { AIProvider } from "../state/types";
import { KeyRound, X } from "lucide-react";

const PROVIDERS: { id: AIProvider; label: string; keyHint: string }[] = [
  { id: "anthropic", label: "Anthropic (Claude)", keyHint: "sk-ant-…" },
  { id: "openai", label: "OpenAI (GPT)", keyHint: "sk-…" },
  { id: "gemini", label: "Google (Gemini)", keyHint: "AIza…" },
];

export function SettingsModal() {
  const open = useSettingsStore((state) => state.settingsOpen);
  const provider = useSettingsStore((state) => state.provider);
  const keys = useSettingsStore((state) => state.keys);
  const models = useSettingsStore((state) => state.models);
  const setProvider = useSettingsStore((state) => state.setProvider);
  const setKey = useSettingsStore((state) => state.setKey);
  const setModel = useSettingsStore((state) => state.setModel);
  const openSettings = useSettingsStore((state) => state.openSettings);
  const persistKeys = useSettingsStore((state) => state.persistKeys);
  const setPersistKeys = useSettingsStore((state) => state.setPersistKeys);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-slate-900/50" onClick={() => openSettings(false)} />
      <div className="relative w-[460px] max-w-[92vw] rounded-2xl bg-white p-5 shadow-2xl">
        <button
          className="absolute top-3.5 right-3.5 rounded-md p-1 text-slate-400 hover:bg-slate-100"
          onClick={() => openSettings(false)}
        >
          <X size={16} />
        </button>
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <KeyRound size={16} className="text-violet-600" /> AI設定 (BYOK)
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-slate-500">
          {useWorkersAI()
            ? "Cloudflare デプロイ時は Workers AI（/api/generate）を優先します。ローカル単体開発（npm run dev）では BYOK キーがフォールバックとして使われます。"
            : "APIキーはこのブラウザのlocalStorageにのみ保存され、各プロバイダのAPIへ直接送信されます。サーバーには一切送信されません。"}
        </p>

        <div className="mt-4 space-y-3">
          {PROVIDERS.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border p-3 ${
                provider === item.id ? "border-violet-400 bg-violet-50/50" : "border-slate-200"
              }`}
            >
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="provider"
                  checked={provider === item.id}
                  onChange={() => setProvider(item.id)}
                />
                <span className="text-sm font-semibold text-slate-800">{item.label}</span>
              </label>
              <div className="mt-2 flex gap-2">
                <input
                  type="password"
                  className="flex-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-violet-400 focus:outline-none"
                  placeholder={`APIキー (${item.keyHint})`}
                  value={keys[item.id]}
                  onChange={(event) => setKey(item.id, event.target.value.trim())}
                  autoComplete="off"
                />
                <input
                  type="text"
                  className="w-40 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs focus:border-violet-400 focus:outline-none"
                  placeholder="モデル名"
                  value={models[item.id]}
                  onChange={(event) => setModel(item.id, event.target.value.trim())}
                  spellCheck={false}
                />
              </div>
            </div>
          ))}
        </div>

        <label className="mt-3 flex items-start gap-2 text-xs text-slate-600">
          <input
            type="checkbox"
            className="mt-0.5"
            checked={persistKeys}
            onChange={(event) => setPersistKeys(event.target.checked)}
          />
          <span>
            APIキーをこのブラウザに保存する
            <span className="block text-[10.5px] text-slate-400">
              オフにすると共有PC向けにセッション限定保存になり、タブを閉じるとキーは消去されます
            </span>
          </span>
        </label>

        <button
          className="mt-4 w-full rounded-xl bg-slate-900 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          onClick={() => openSettings(false)}
        >
          完了
        </button>
      </div>
    </div>
  );
}
