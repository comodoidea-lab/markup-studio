/** Use Cloudflare Workers AI via `/api/generate` (default: on). Set `VITE_USE_WORKERS_AI=false` to force BYOK. */
export function useWorkersAI(): boolean {
  return import.meta.env.VITE_USE_WORKERS_AI !== "false";
}
