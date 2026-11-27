import dayjs from "https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm";

/** Фильтр событий по периоду [from, to] inclusive */
export function filterEvents(events, from, to) {
  const a = dayjs(from).startOf("day");
  const b = dayjs(to).endOf("day");
  return (events || []).filter((e) => {
    const t = dayjs(e.at);
    return t.isAfter(a.subtract(1, "ms")) && t.isBefore(b.add(1, "ms"));
  });
}

export function popularProducts(events, products, limit = 15) {
  const map = new Map();
  for (const e of events) {
    const items = e.items || [];
    for (const it of items) {
      const id = it.id;
      if (!id) continue;
      const cur = map.get(id) || { id, qty: 0, cost: 0, count: 0, name: products[id]?.name || it.name || id };
      cur.qty += it.amount || it.buy || 0;
      cur.cost += it.cost || 0;
      cur.count += 1;
      map.set(id, cur);
    }
  }
  return [...map.values()].sort((x, y) => y.count - x.count || y.cost - x.cost).slice(0, limit);
}

/** Контуры: cooking | alcohol | treats | sweet | other (+ meal keys) */
export function normalizeSpendCategory(raw) {
  const c = String(raw || "other").toLowerCase();
  if (c === "wine" || c === "gin" || c === "alcohol" || c === "вино" || c === "джин") return "alcohol";
  if (c === "treats" || c === "вкусняшки") return "treats";
  if (c === "sweet" || c === "tea" || c === "сладкое" || c === "к чаю") return "sweet";
  if (["breakfast", "lunch", "dinner", "snack", "brunch"].includes(c)) return c;
  if (c === "cooking" || c === "готовка") return "cooking";
  return "other";
}

/** Угадать контур по продукту / тексту */
export function guessSpendCategory(product, text = "") {
  const blob = `${product?.category || ""} ${product?.name || ""} ${text}`.toLowerCase();
  if (/вино|джин|алкогол|пиво|виски|водка|лик[её]р|коньяк|шампан|wine|gin|beer/.test(blob)) return "alcohol";
  if (/шоколад|печень|конфет|варень|мёд|мед|сахар|мороженое|зефир|пряник|сладк|к чаю|cake|cookie/.test(blob))
    return "sweet";
  if (/чипсы|снек|snack|вкусня|treat|орехи жарен|попкорн/.test(blob)) return "treats";
  if (product?.category === "сладкое" || product?.category === "выпечка") return "sweet";
  return "cooking";
}

export const SPEND_LABELS = {
  cooking: "Готовка",
  alcohol: "Алкоголь",
  treats: "Вкусняшки",
  sweet: "Сладкое / к чаю",
  other: "Прочее",
  breakfast: "Завтрак",
  lunch: "Обед",
  dinner: "Ужин",
  snack: "Перекус",
};

/**
 * Контуры расходов + разбивка готовки по приёмам (если event.meal / meal-категория).
 */
export function spendByCategory(events) {
  const out = {
    cooking: 0,
    alcohol: 0,
    treats: 0,
    sweet: 0,
    other: 0,
    breakfast: 0,
    lunch: 0,
    dinner: 0,
    snack: 0,
  };
  for (const e of events) {
    if (e.type !== "spend") continue;
    const total = e.total || 0;
    let key = normalizeSpendCategory(e.category);
    if (["breakfast", "lunch", "dinner", "snack"].includes(key)) {
      out.cooking += total;
      out[key] += total;
      continue;
    }
    if (out[key] === undefined) key = "other";
    out[key] += total;
    if (key === "cooking" && e.meal && out[e.meal] !== undefined) out[e.meal] += total;
  }
  return out;
}

/** Сколько раз готовили по приёмам пищи */
export function cooksByMeal(events) {
  const out = { breakfast: 0, lunch: 0, dinner: 0, snack: 0, other: 0 };
  for (const e of events || []) {
    if (e.type !== "cook") continue;
    const m = e.meal && out[e.meal] !== undefined ? e.meal : "other";
    out[m] += 1;
  }
  return out;
}

export function spendTimeline(events, from, to) {
  const a = dayjs(from).startOf("day");
  const b = dayjs(to).startOf("day");
  const days = [];
  let cur = a;
  while (cur.isBefore(b) || cur.isSame(b, "day")) {
    days.push({ date: cur.format("YYYY-MM-DD"), label: cur.format("DD.MM"), total: 0 });
    cur = cur.add(1, "day");
  }
  const idx = Object.fromEntries(days.map((d, i) => [d.date, i]));
  for (const e of events) {
    if (e.type !== "spend") continue;
    const key = dayjs(e.at).format("YYYY-MM-DD");
    if (idx[key] === undefined) continue;
    days[idx[key]].total += e.total || 0;
  }
  return days;
}

export function totalSpend(events) {
  return events.filter((e) => e.type === "spend").reduce((s, e) => s + (e.total || 0), 0);
}

/** Средняя цена за базовую ед. из истории покупок */
export function avgUnitPrices(events) {
  const map = new Map();
  for (const e of events || []) {
    if (e.type !== "spend") continue;
    for (const it of e.items || []) {
      if (!it.id || !it.amount || !it.cost) continue;
      const cur = map.get(it.id) || { sum: 0, qty: 0 };
      cur.sum += it.cost;
      cur.qty += it.amount;
      map.set(it.id, cur);
    }
  }
  const out = {};
  for (const [id, v] of map) {
    if (v.qty > 0) out[id] = v.sum / v.qty;
  }
  return out;
}

/** Оценка стоимости блюда: история покупок → иначе catalog price */
export function estimateDishCost(dish, products, avgPrices) {
  let sum = 0;
  for (const ing of dish.ingredients || []) {
    const p = products[ing.id];
    const hist = avgPrices?.[ing.id];
    const unit = hist != null ? hist : p?.price || 0;
    sum += unit * ing.amount;
  }
  return Math.round(sum);
}

export function estimatePlanCostSmart(plan, dishes, products, avgPrices) {
  let sum = 0;
  for (const day of plan || []) {
    for (const key of ["breakfast", "lunch", "dinner"]) {
      const d = dishes[day[key]];
      if (d) sum += estimateDishCost(d, products, avgPrices) / Math.max(1, d.servings) * 3;
    }
  }
  return Math.round(sum);
}

/** Прогноз месяца: факт → экстраполяция до конца месяца */
export function monthForecast(events, budgetPlanTotal) {
  const now = dayjs();
  const month = now.format("YYYY-MM");
  const day = now.date();
  const daysInMonth = now.daysInMonth();
  let spent = 0;
  const byCat = { cooking: 0, alcohol: 0, treats: 0, sweet: 0, other: 0 };
  for (const e of events || []) {
    if (e.type !== "spend") continue;
    if (!String(e.at || "").startsWith(month)) continue;
    const t = e.total || 0;
    spent += t;
    const k = normalizeSpendCategory(e.category);
    if (byCat[k] !== undefined) byCat[k] += t;
    else byCat.other += t;
  }
  const pace = day > 0 ? spent / day : 0;
  const projected = Math.round(pace * daysInMonth);
  const plan = budgetPlanTotal || 0;
  const remainingDays = Math.max(0, daysInMonth - day);
  const left = plan - spent;
  const dailyCap = remainingDays > 0 ? left / remainingDays : 0;
  return {
    month,
    day,
    daysInMonth,
    spent: Math.round(spent),
    projected,
    plan,
    left: Math.round(left),
    dailyCap: Math.round(dailyCap),
    over: plan > 0 && projected > plan,
    byCat,
  };
}

/** Топ дорогих ингредиентов по истории покупок */
export function topExpensiveProducts(events, products, limit = 10) {
  const map = new Map();
  for (const e of events || []) {
    if (e.type !== "spend") continue;
    for (const it of e.items || []) {
      if (!it.id || !it.cost) continue;
      const cur = map.get(it.id) || { id: it.id, name: products[it.id]?.name || it.name || it.id, cost: 0, count: 0 };
      cur.cost += it.cost;
      cur.count += 1;
      map.set(it.id, cur);
    }
  }
  return [...map.values()].sort((a, b) => b.cost - a.cost).slice(0, limit);
}

/** История цен по продукту */
export function priceHistory(events, productId, limit = 8) {
  const rows = [];
  for (const e of events || []) {
    if (e.type !== "spend") continue;
    for (const it of e.items || []) {
      if (it.id !== productId || !it.cost) continue;
      rows.push({ at: e.at, cost: it.cost, amount: it.amount || 0 });
    }
  }
  return rows.sort((a, b) => String(b.at).localeCompare(String(a.at))).slice(0, limit);
}

/** Доля дней плана, закрытых запасами (по coverage ужина) */
export function stockCoverageShare(plan, dishes, products, inventoryAmountsMap) {
  let ok = 0;
  let total = 0;
  for (const day of plan || []) {
    const d = dishes[day.dinner];
    if (!d) continue;
    total += 1;
    const hint = (() => {
      let have = 0;
      for (const ing of d.ingredients || []) {
        if ((inventoryAmountsMap[ing.id] || 0) > 0) have += 1;
      }
      const n = d.ingredients?.length || 1;
      return have / n;
    })();
    if (hint >= 0.7) ok += 1;
  }
  return { ok, total, share: total ? ok / total : 0 };
}

export { dayjs };
