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

/**
 * Разбор фото/скринов → черновик позиций.
 * mode: "photo" | "screenshot"
 * images: [{ dataUrl|image, mimeType }] или один image
 */
export async function aiVision({ image, mimeType, images, knownProducts, mode = "photo" }) {
  const payload = {
    mode: mode === "screenshot" ? "screenshot" : "photo",
    knownProducts,
  };
  if (Array.isArray(images) && images.length) {
    payload.images = images.slice(0, 6).map((im) => ({
      data: im.dataUrl || im.image || im.data,
      mimeType: im.mimeType || "image/jpeg",
    }));
  } else {
    payload.image = image;
    payload.mimeType = mimeType || "image/jpeg";
  }
  const res = await fetch(`${APP_CONFIG.apiBase}/ai/vision`, {
    method: "POST",
    headers: headers(),
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 429) {
    const err = new Error(data.message || "Лимит разборов на сегодня");
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

/** Сжать изображение для vision. Для скринов — выше качество/разрешение (текст UI). */
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
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, width, height);
      ctx.drawImage(img, 0, 0, width, height);
      const dataUrl = canvas.toDataURL("image/jpeg", quality);
      resolve({ dataUrl, mimeType: "image/jpeg" });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Не удалось прочитать изображение"));
    };
    img.src = url;
  });
}

export function compressForVisionMode(file, mode) {
  if (mode === "screenshot") return compressImageFile(file, 1600, 0.88);
  return compressImageFile(file, 1280, 0.72);
}
