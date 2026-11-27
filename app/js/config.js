/** Облако семьи — Cloudflare Workers + KV (ПК не нужен, работает 24/7). */
export const APP_CONFIG = {
  /** API всегда в интернете */
  apiBase: "https://semejnoe-menyu-api.aspiring-detective.workers.dev",
  /** Общий ключ семьи — оба телефона видят одни данные */
  familyKey: "bogdaniha",
  pollMs: 15000,
  appName: "Семейная кухня",
  /** Gist — запасной канал (не обязателен) */
  gistId: "6b77d9fa965fac6a5bed0898c9777ba9",
  gistFile: "family-sync.json",
};
