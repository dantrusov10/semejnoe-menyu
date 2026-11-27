/** Клиент free-tier AI через Cloudflare Worker */

import { APP_CONFIG } from "./config.js";

function headers() {
  return {
    "Content-Type": "application/json",
    "X-Family-Key": APP_CONFIG.familyKey,
  };
}

export async function aiQuota() {
  try {
    const res = await fetch(`${APP_CONFIG.apiBase}/ai/quota`, { headers: headers(), cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

/**
 * Умная замена: shortlist уже с клиента.
 * @returns {{ ranked, note, source, provider, quota } | null}
 */
export async function aiSuggest(payload) {
  const res = await fetch(`${APP_CONFIG.apiBase}/ai/suggest`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const err = new Error(data.message || "Лимит AI на сегодня");
    err.code = "quota";
    err.quota = data.quota;
    throw err;
  }
  if (!res.ok) {
    const err = new Error(data.message || `AI ${res.status}`);
    err.code = data.error || "fail";
    throw err;
  }
  return data;
}

/** Фото полки → черновик позиций */
export async function aiVision({ image, mimeType, knownProducts }) {
  const res = await fetch(`${APP_CONFIG.apiBase}/ai/vision`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify({ image, mimeType, knownProducts }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const err = new Error(data.message || "Лимит фото на сегодня");
    err.code = "quota";
    throw err;
  }
  if (res.status === 501) {
    const err = new Error(data.message || "Vision не настроен");
    err.code = "no_vision";
    throw err;
  }
  if (!res.ok) {
    throw new Error(data.message || `Vision ${res.status}`);
  }
  return data;
}

/** Сжать фото для vision (долгая сторона ≤1280, jpeg) */
export function compressImageFile(file, maxSide = 1280, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      let { width, height } = img;
      const scale = Math.min(1, maxSide / Math.max(width, height));
      width = Math.round(width * scale);
      height = Math.round(height * scale);
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ dataUrl, mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать фото"));
    };
    img.src = url;
  });
}
