import { APP_CONFIG } from "./config.js";

const TOKEN_KEY = "sk_gh_gist_token";
const DEVICE_KEY = "sk_device_id";

export function getToken() {
  return localStorage.getItem(TOKEN_KEY) || "";
}

export function setToken(token) {
  if (!token) localStorage.removeItem(TOKEN_KEY);
  else localStorage.setItem(TOKEN_KEY, token.trim());
}

export function deviceId() {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

function headers(token, withJson = true) {
  const h = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
  if (token) h.Authorization = `Bearer ${token}`;
  if (withJson) h["Content-Type"] = "application/json";
  return h;
}

export function emptyCloud() {
  return {
    version: 1,
    updatedAt: new Date().toISOString(),
    updatedBy: deviceId(),
    inventory: {},
    events: [],
  };
}

/** Тянем общее состояние семьи из private gist */
export async function pullCloud(token = getToken()) {
  if (!token) throw new Error("Нет токена GitHub (gist). Введите в разделе Синхрон.");
  const res = await fetch(`https://api.github.com/gists/${APP_CONFIG.gistId}`, {
    headers: headers(token, false),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Не удалось прочитать облако (${res.status}): ${t.slice(0, 180)}`);
  }
  const gist = await res.json();
  const file = gist.files?.[APP_CONFIG.gistFile];
  if (!file?.content) return emptyCloud();
  try {
    return { ...emptyCloud(), ...JSON.parse(file.content) };
  } catch {
    return emptyCloud();
  }
}

/** Пушим inventory + events (events храним последние 2000) */
export async function pushCloud(payload, token = getToken()) {
  if (!token) throw new Error("Нет токена GitHub (gist).");
  const body = {
    files: {
      [APP_CONFIG.gistFile]: {
        content: JSON.stringify(
          {
            ...payload,
            version: 1,
            updatedAt: new Date().toISOString(),
            updatedBy: deviceId(),
            events: (payload.events || []).slice(-2000),
          },
          null,
          2
        ),
      },
    },
  };
  const res = await fetch(`https://api.github.com/gists/${APP_CONFIG.gistId}`, {
    method: "PATCH",
    headers: headers(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`Не удалось сохранить (${res.status}): ${t.slice(0, 180)}`);
  }
  return res.json();
}

/**
 * Слияние инвентаря: берём max по количеству? Нет — last-write-wins по updatedAt полям.
 * Проще и предсказуемее для семьи: облако после pull — источник правды для inventory,
 * локальные несохранённые правки пушим целиком.
 */
export function mergeInventory(localInv, cloudInv, prefer = "local") {
  if (prefer === "cloud") return { ...(cloudInv || {}) };
  return { ...(cloudInv || {}), ...(localInv || {}) };
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

export { APP_CONFIG };
