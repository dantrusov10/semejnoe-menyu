/** Запасы продуктов (лоты) и готовых блюд. */

export function emptyLot(amount = 0, extras = {}) {
  return {
    amount: +amount || 0,
    boughtAt: extras.boughtAt || null,
    expiresAt: extras.expiresAt || null,
    zone: extras.zone || null,
    note: extras.note || "",
  };
}

/** Миграция старого вида { id: number } → { id: lot } */
export function normalizeInventory(raw) {
  const out = {};
  for (const [id, v] of Object.entries(raw || {})) {
    if (v == null) continue;
    if (typeof v === "number") {
      if (v > 0) out[id] = emptyLot(v);
    } else if (typeof v === "object") {
      const amt = +v.amount || 0;
      if (amt > 0) {
        out[id] = {
          amount: amt,
          boughtAt: v.boughtAt || null,
          expiresAt: v.expiresAt || null,
          zone: v.zone || null,
          note: v.note || "",
        };
      }
    }
  }
  return out;
}

export function invAmount(inventory, id) {
  const v = inventory?.[id];
  if (v == null) return 0;
  if (typeof v === "number") return v;
  return +v.amount || 0;
}

/** Плоский вид { id: amount } для старых алгоритмов */
export function inventoryAmounts(inventory) {
  const out = {};
  for (const id of Object.keys(inventory || {})) {
    const a = invAmount(inventory, id);
    if (a > 0) out[id] = a;
  }
  return out;
}

export function setInvAmount(inventory, id, amount, patch = {}) {
  const next = { ...inventory };
  const amt = +amount || 0;
  if (amt <= 0) {
    delete next[id];
    return next;
  }
  const prev = typeof inventory[id] === "object" ? inventory[id] : emptyLot(inventory[id] || 0);
  next[id] = { ...prev, ...patch, amount: amt };
  return next;
}

export function addInvAmount(inventory, id, delta, patch = {}) {
  const cur = invAmount(inventory, id);
  return setInvAmount(inventory, id, cur + delta, {
    ...(typeof inventory[id] === "object" ? inventory[id] : {}),
    ...patch,
    boughtAt: patch.boughtAt || (typeof inventory[id] === "object" ? inventory[id].boughtAt : null) || new Date().toISOString().slice(0, 10),
  });
}

export function daysUntil(dateStr, now = new Date()) {
  if (!dateStr) return null;
  const t = new Date(dateStr);
  if (Number.isNaN(t.getTime())) return null;
  return Math.ceil((t - now) / 86400000);
}

export function expiryStatus(expiresAt, warnDays = 3) {
  const d = daysUntil(expiresAt);
  if (d == null) return "none";
  if (d < 0) return "expired";
  if (d <= warnDays) return "soon";
  return "ok";
}

export function unitOptions(product) {
  if (!product) return [{ value: "g", label: "г", factor: 1 }];
  if (product.unit === "pcs") return [{ value: "pcs", label: "шт", factor: 1 }];
  if (product.unit === "ml") {
    return [
      { value: "ml", label: "мл", factor: 1 },
      { value: "l", label: "л", factor: 1000 },
    ];
  }
  return [
    { value: "g", label: "г", factor: 1 },
    { value: "kg", label: "кг", factor: 1000 },
  ];
}

export function toBaseAmount(qty, unitValue, product) {
  const opts = unitOptions(product);
  const opt = opts.find((o) => o.value === unitValue) || opts[0];
  return Math.round((+qty || 0) * opt.factor * 100) / 100;
}

export function fromBaseAmount(amount, product) {
  if (!product) return { qty: amount, unit: "g" };
  if (product.unit === "pcs") return { qty: amount, unit: "pcs" };
  if (product.unit === "ml") {
    if (amount >= 1000) return { qty: Math.round((amount / 1000) * 100) / 100, unit: "l" };
    return { qty: amount, unit: "ml" };
  }
  if (amount >= 1000) return { qty: Math.round((amount / 1000) * 100) / 100, unit: "kg" };
  return { qty: amount, unit: "g" };
}

export function formatAmount(amount, product) {
  const { qty, unit } = fromBaseAmount(amount, product);
  const labels = { g: "г", kg: "кг", ml: "мл", l: "л", pcs: "шт" };
  return `${qty} ${labels[unit] || unit}`;
}

export function nutritionLine(product, amount) {
  if (!product) return "";
  const base = product.unit === "pcs" ? 1 : 100;
  const factor = (amount || 0) / base;
  const kcal = Math.round((product.kcal || 0) * factor);
  const p = Math.round((product.protein || 0) * factor * 10) / 10;
  const f = Math.round((product.fat || 0) * factor * 10) / 10;
  const c = Math.round((product.carbs || 0) * factor * 10) / 10;
  return `${kcal} ккал · Б ${p} · Ж ${f} · У ${c}`;
}

export function emptyMealLot(partial = {}) {
  return {
    id: partial.id || `m_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
    recipeId: partial.recipeId || null,
    name: partial.name || "Блюдо",
    portions: +partial.portions || 1,
    cookedAt: partial.cookedAt || new Date().toISOString().slice(0, 10),
    expiresAt: partial.expiresAt || null,
    zone: partial.zone || "fridge",
    note: partial.note || "",
  };
}

export function defaultMealExpiry(batchDays = 2, cookedAt = new Date()) {
  const d = new Date(cookedAt);
  d.setDate(d.getDate() + Math.min(4, Math.max(1, batchDays)));
  return d.toISOString().slice(0, 10);
}

export function sortByExpiry(items, getExpires) {
  return [...items].sort((a, b) => {
    const ea = getExpires(a);
    const eb = getExpires(b);
    if (!ea && !eb) return 0;
    if (!ea) return 1;
    if (!eb) return -1;
    return String(ea).localeCompare(String(eb));
  });
}
