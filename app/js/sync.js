import { APP_CONFIG } from "./config.js";

const DEVICE_KEY = "sk_device_id";

export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export function emptyCloud() {
  return {
    inventory: {},
    events: [],
    plan: null,
    settings: null,
    budget: null,
    weekNum: 1,
    updatedAt: null,
  };
}

function apiHeaders() {
  return {
    "Content-Type": "application/json",
    "X-Family-Key": APP_CONFIG.familyKey,
  };
}

/** Тянем полное состояние семьи из облака (Cloudflare KV). ПК не нужен. */
export async function pullCloud() {
  const res = await fetch(`${APP_CONFIG.apiBase}/state`, {
    headers: apiHeaders(),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Облако недоступно (${res.status})`);
  const data = await res.json();
  return { ...emptyCloud(), ...data };
}

/** Пишем состояние — вызывается автоматически при каждом сохранении. */
export async function pushCloud(payload) {
  const body = {
    inventory: payload.inventory || {},
    events: (payload.events || []).slice(-2000),
    plan: payload.plan ?? null,
    settings: payload.settings ?? null,
    budget: payload.budget ?? null,
    weekNum: payload.weekNum ?? 1,
    device: deviceId(),
  };
  const res = await fetch(`${APP_CONFIG.apiBase}/state`, {
    method: "PUT",
    headers: apiHeaders(),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Не удалось сохранить в облако (${res.status})`);
  return res.json();
}

export async function healthCloud() {
  const res = await fetch(`${APP_CONFIG.apiBase}/health`, { cache: "no-store" });
  if (!res.ok) throw new Error("health fail");
  return res.json();
}

export function mergeEvents(localEvents, cloudEvents) {
  const map = new Map();
  for (const e of [...(cloudEvents || []), ...(localEvents || [])]) {
    if (!e?.id) continue;
    map.set(e.id, e);
  }
  return [...map.values()].sort((a, b) => String(a.at).localeCompare(String(b.at)));
}

export function makeEvent(partial) {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    at: new Date().toISOString(),
    device: deviceId(),
    ...partial,
  };
}

/** @deprecated токен больше не нужен — оставлен для совместимости UI */
export function getToken() {
  return "cloud";
}
export function setToken(_t) {}

export { APP_CONFIG };
