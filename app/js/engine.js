/** Алгоритмы: подбор из запасов, автоплан, корзина. */

export function indexCatalog(data) {
  const products = Object.fromEntries(data.products.map((p) => [p.id, p]));
  const dishes = Object.fromEntries(data.dishes.map((d) => [d.id, d]));
  return { products, dishes, stores: data.stores, budget: data.budget, menu: data.menu };
}

export function storeName(stores, id) {
  return stores[id]?.name || id;
}

export function rub(n) {
  return `${Math.round(n || 0).toLocaleString("ru-RU")} ₽`;
}

/** «на 1 день» / «на 2 дня» / «на 5 дней» — без слова Batch */
export function daysRu(n) {
  const d = Math.max(1, Math.round(n || 1));
  const mod10 = d % 10;
  const mod100 = d % 100;
  let word = "дней";
  if (mod10 === 1 && mod100 !== 11) word = "день";
  else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) word = "дня";
  return `на ${d} ${word}`;
}

export function isBanned(dishId, settings, now = new Date()) {
  const until = settings?.bannedUntil?.[dishId];
  if (!until) return false;
  return new Date(until) > now;
}

export function banForMonth(settings, dishId, days = 30) {
  const next = { ...(settings.bannedUntil || {}) };
  const until = new Date();
  until.setDate(until.getDate() + days);
  next[dishId] = until.toISOString();
  return next;
}

/**
 * Умные замены без LLM: тот же тип/белок/цена/дни + любимое/−бан.
 * Позже поверх можно вызвать LLM с этим shortlist.
 */
export function suggestReplacements(dish, allDishes, settings, opts = {}) {
  const limit = opts.limit || 5;
  const priceTol = opts.priceTol || 0.45;
  const base = dish.costPerServing || 1;
  const scored = [];
  for (const d of allDishes) {
    if (d.id === dish.id) continue;
    if (settings.disliked?.includes(d.id) || isBanned(d.id, settings)) continue;
    if (d.type !== dish.type && !(dish.type === "main" && d.type === "soup")) continue;
    const priceDiff = Math.abs((d.costPerServing || 0) - base) / base;
    if (priceDiff > priceTol && (d.costPerServing || 0) > base * 1.5) continue;
    let score = 40;
    if (d.protein === dish.protein) score += 20;
    if (d.category === dish.category) score += 10;
    if (Math.abs((d.batchDays || 1) - (dish.batchDays || 1)) <= 1) score += 10;
    if (settings.loved?.includes(d.id)) score += 15;
    score -= priceDiff * 25;
    score -= Math.min(15, ((d.timeMin || 40) - (dish.timeMin || 40)) / 5);
    scored.push({ dish: d, score, why: explainReplace(dish, d) });
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit);
}

function explainReplace(from, to) {
  const bits = [];
  if (to.protein === from.protein) bits.push("тот же белок");
  if (to.category === from.category) bits.push("та же категория");
  if ((to.batchDays || 1) === (from.batchDays || 1)) bits.push(daysRu(to.batchDays || 1));
  bits.push(`~${Math.round(to.costPerServing || 0)} ₽/порц`);
  return bits.join(" · ");
}

function recentCookIds(events, days = 21) {
  const cut = Date.now() - days * 86400000;
  const ids = new Set();
  for (const e of events || []) {
    if (e.type !== "cook" || !e.recipeId) continue;
    if (new Date(e.at).getTime() >= cut) ids.add(e.recipeId);
  }
  return ids;
}

function pickVaried(pool, used, settings, recent, rng) {
  if (!pool.length) return null;
  const scored = pool.map((d) => {
    let s = rng();
    if (settings.loved?.includes(d.id)) s += 2.5;
    if (recent.has(d.id)) s -= 3;
    if (used.has(d.id)) s -= 4;
    if (settings.disliked?.includes(d.id) || isBanned(d.id, settings)) s -= 100;
    return { d, s };
  });
  scored.sort((a, b) => b.s - a.s);
  const top = scored.slice(0, Math.min(8, scored.length));
  return top[Math.floor(rng() * top.length)]?.d || scored[0].d;
}

/** mulberry32 — стабильный «рандом» от seed */
function rngFromSeed(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * План на период с разнообразием: любимое↑, недавно ели↓, без повторов в окне.
 * seed меняется каждый сбор → разное меню.
 */
export function buildPeriodPlan(data, settings, opts = {}) {
  const days = Math.max(1, Math.min(90, +opts.days || 7));
  const start = opts.startDate ? new Date(opts.startDate) : new Date();
  start.setHours(12, 0, 0, 0);
  const adults = Math.max(0, +opts.adults || 2);
  const childPortions = Math.max(0, +opts.childPortions || 1);
  const childAge = opts.childAge ?? 1.5;
  const seed = opts.seed || Date.now();
  const rng = rngFromSeed(seed >>> 0);
  const recent = recentCookIds(opts.events || [], 21);
  const blocked = (id) => settings.disliked?.includes(id) || isBanned(id, settings);

  const byType = { breakfast: [], soup: [], main: [], snack: [], dessert: [] };
  for (const d of data.dishes) {
    if (blocked(d.id)) continue;
    if (byType[d.type]) byType[d.type].push(d);
  }

  const used = new Set();
  const plan = [];
  for (let i = 0; i < days; i++) {
    const dt = new Date(start);
    dt.setDate(start.getDate() + i);
    const iso = dt.toISOString().slice(0, 10);
    const dayName = ["Вс", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"][dt.getDay()];
    const breakfast = pickVaried(byType.breakfast, used, settings, recent, rng);
    const lunch = pickVaried(byType.soup.length ? byType.soup : byType.main, used, settings, recent, rng);
    const dinner = pickVaried(byType.main, used, settings, recent, rng);
    const snack = pickVaried(byType.snack.length ? byType.snack : byType.dessert, used, settings, recent, rng);
    [breakfast, lunch, dinner, snack].forEach((d) => d && used.add(d.id));
    // раз в 7 дней чуть чистим used чтобы длинные периоды не исчерпали пул
    if (i > 0 && i % 7 === 0) used.clear();

    plan.push({
      date: iso,
      dayName,
      label: `${dayName} ${dt.getDate()}.${String(dt.getMonth() + 1).padStart(2, "0")}`,
      day: i + 1,
      week: Math.floor(i / 7) + 1,
      breakfast: breakfast?.id,
      lunch: lunch?.id,
      dinner: dinner?.id,
      snacks: snack ? [snack.id] : [],
      cookHint: i % 3 === 0 ? "День новой варки" : "Разогрев / лёгкая готовка",
      people: { adults, childPortions, childAge },
      meta: {
        breakfast: { people: adults + childPortions, adults, child: childPortions },
        lunch: { people: adults + childPortions, adults, child: childPortions },
        dinner: { people: adults + childPortions, adults, child: childPortions },
      },
      seed,
    });
  }
  return plan;
}

/** Покрытие рецепта запасами + истекающие */
export function recipeStockHint(dish, inventoryAmountsMap, products, expiringIds = new Set()) {
  if (!dish?.ingredients?.length) return { coverage: 0, have: 0, total: 0, missing: [], expiring: [] };
  let have = 0;
  const missing = [];
  const expiring = [];
  for (const ing of dish.ingredients) {
    const amt = inventoryAmountsMap[ing.id] || 0;
    if (amt > 0) {
      have += 1;
      if (expiringIds.has(ing.id)) expiring.push(ing.id);
    } else missing.push(ing.id);
  }
  const total = dish.ingredients.length;
  return { coverage: total ? have / total : 0, have, total, missing, expiring };
}

export function amountLabel(product, amount) {
  if (!product) return String(amount);
  if (product.unit === "pcs") return `${amount} шт`;
  if (product.unit === "ml") return `${amount} мл`;
  return `${amount} г`;
}

/** Жёсткие ограничения ребёнка / семьи */
export function violatesHardConstraints(dish, settings) {
  const tags = new Set(dish.tags || []);
  const name = (dish.name || "").toLowerCase();
  const ids = new Set((dish.ingredients || []).map((i) => i.id));
  const r = settings.childRules || {};

  if (tags.has("орехи") || ids.has("nuts")) return "орехи";
  if (r.noHoney && (ids.has("honey_adult") || name.includes("мёд"))) {
    // мёд только взрослым — не блок рецепта целиком, если есть детская пометка
  }
  if (ids.has("sugar") && dish.type === "snack" && r.noSugar) return "сахар в перекусе";
  // субпродукты кроме печени
  if (name.includes("сердц") || name.includes("рубец")) return "субпродукт";
  return null;
}

/**
 * Подбор блюд из запасов.
 * inventory: { [productId]: number }
 */
export function matchFromInventory(dishes, products, inventory, settings, opts = {}) {
  const minServ = opts.minServings ?? 2;
  const mode = opts.mode || "almost"; // strict | almost | waste
  const maxMissingRub = opts.maxMissingRub ?? 250;
  const results = [];

  for (const dish of dishes) {
    const hard = violatesHardConstraints(dish, settings);
    if (hard) continue;
    if (settings.disliked?.includes(dish.id) || isBanned(dish.id, settings)) continue;
    if (!dish.ingredients?.length) continue;

    let portions = Infinity;
    let haveCount = 0;
    let total = dish.ingredients.length;
    const missing = [];
    let missingCost = 0;
    let wasteScore = 0;

    for (const ing of dish.ingredients) {
      const have = inventory[ing.id] || 0;
      const per = ing.amount / Math.max(1, dish.servings);
      if (have > 0) {
        haveCount += 1;
        portions = Math.min(portions, have / per);
        // скоропорт: молочка/зелень/мясо без expiry — лёгкий буст если есть
        const p = products[ing.id];
        if (p && ["milk", "kefir", "sourcream", "tvorog", "dill", "chicken_cheap"].includes(ing.id)) {
          wasteScore += 0.05;
        }
      } else {
        const p = products[ing.id];
        const cost = (p?.price || 0) * ing.amount;
        missing.push({ id: ing.id, amount: ing.amount, cost, name: p?.name || ing.id });
        missingCost += cost;
      }
    }

    if (!Number.isFinite(portions)) portions = 0;
    portions = Math.floor(portions * 10) / 10;
    const coverage = total ? haveCount / total : 0;

    if (mode === "strict" && missing.length) continue;
    if (mode === "almost" && missingCost > maxMissingRub && coverage < 0.7) continue;
    if (portions < minServ && missing.length === 0) continue;
    if (mode === "strict" && portions < minServ) continue;

    const preferenceFit = settings.loved?.includes(dish.id) ? 1 : 0;
    const varietyBonus = 0.5; // без истории — нейтрально
    const effortNorm = Math.min(1, (dish.timeMin || 40) / 90);
    const missingCostNorm = Math.min(1, missingCost / 500);

    const score =
      40 * coverage +
      20 * Math.min(1, portions / 6) +
      15 * Math.min(1, wasteScore) +
      10 * preferenceFit +
      10 * varietyBonus -
      15 * missingCostNorm -
      10 * effortNorm;

    results.push({
      dish,
      coverage,
      portions: missing.length ? Math.max(portions, 0) : portions,
      missing,
      missingCost,
      score,
      why:
        coverage >= 0.99
          ? "Всё есть на кухне"
          : missing.length
            ? `Не хватает на ~${Math.round(missingCost)} ₽`
            : "Можно готовить",
    });
  }

  results.sort((a, b) => b.score - a.score);
  return results;
}

/** Масштаб ингредиентов */
export function scaleIngredients(dish, targetServings) {
  const scale = targetServings / Math.max(1, dish.servings);
  return (dish.ingredients || []).map((ing) => {
    let amount = ing.amount * scale;
    if (ing.id === "egg") amount = Math.max(1, Math.round(amount));
    else if (amount >= 50) amount = Math.round(amount / 10) * 10;
    else amount = Math.round(amount);
    return { id: ing.id, amount };
  });
}

/** Взрослые + детские порции → общий масштаб (детская ~0.55 взрослой) */
export function familyServings(adults, childPortions, childFactor = 0.55) {
  const a = Math.max(0, +adults || 0);
  const c = Math.max(0, +childPortions || 0);
  return Math.max(1, Math.round(a + c * childFactor));
}

/**
 * Корзина: слоты плана → need − inventory → по магазинам
 * slots: [{ recipeId, servings }]
 */
export function buildBasket(slots, dishes, products, inventory, opts = {}) {
  const reserve = opts.reserve || {};
  const need = {};

  for (const slot of slots) {
    const dish = dishes[slot.recipeId];
    if (!dish) continue;
    const scaled = scaleIngredients(dish, slot.servings || dish.servings);
    for (const ing of scaled) {
      need[ing.id] = (need[ing.id] || 0) + ing.amount;
    }
  }

  const lines = [];
  let total = 0;

  for (const [id, qty] of Object.entries(need)) {
    const product = products[id];
    if (!product) continue;
    const have = Math.max(0, (inventory[id] || 0) - (reserve[id] || 0));
    let buy = Math.max(0, qty - have);
    if (buy <= 0) {
      lines.push({
        id,
        name: product.name,
        need: qty,
        have,
        buy: 0,
        store: product.store,
        cost: 0,
        covered: true,
        unit: product.unit,
      });
      continue;
    }
    // округление до удобной фасовки
    buy = packRound(product, buy);
    const cost = buy * product.price;
    total += cost;
    lines.push({
      id,
      name: product.name,
      need: qty,
      have,
      buy,
      store: product.store,
      cost,
      covered: false,
      unit: product.unit,
      note: buy > qty - have + 1 ? "Округлили до удобной фасовки" : "",
    });
  }

  lines.sort((a, b) => a.store.localeCompare(b.store) || a.name.localeCompare(b.name));

  const byStore = {};
  for (const line of lines) {
    if (line.covered) continue;
    byStore[line.store] = byStore[line.store] || { lines: [], total: 0 };
    byStore[line.store].lines.push(line);
    byStore[line.store].total += line.cost;
  }

  return { lines, byStore, total, needCount: Object.keys(need).length };
}

function packRound(product, buy) {
  if (product.unit === "pcs") return Math.ceil(buy);
  if (["oil", "milk", "kefir"].includes(product.id)) return Math.ceil(buy / 100) * 100;
  if (product.store === "parnoe" || product.price >= 0.3) {
    // мясо/дорогое — до 50 г
    return Math.ceil(buy / 50) * 50;
  }
  if (buy < 100) return Math.ceil(buy / 10) * 10;
  return Math.ceil(buy / 100) * 100;
}

/**
 * Авточерновик на 7 дней из каталожного menu (неделя weekNum 1–12)
 * + лёгкая подстройка под дизлайки
 */
export function draftWeekPlan(data, settings, weekNum = 1) {
  const days = data.menu.filter((m) => m.week === weekNum);
  const dishes = Object.fromEntries(data.dishes.map((d) => [d.id, d]));
  const blocked = (id) => settings.disliked?.includes(id) || isBanned(id, settings);
  const plan = days.map((day) => {
    const pick = (id) => {
      if (!blocked(id)) return id;
      const dish = dishes[id];
      if (!dish) return id;
      const alt = data.dishes.find((d) => d.type === dish.type && d.id !== id && !blocked(d.id));
      return alt?.id || id;
    };
    return {
      week: day.week,
      day: day.day,
      dayName: day.dayName,
      label: day.label,
      cookHint: day.cookHint,
      breakfast: pick(day.breakfast),
      lunch: pick(day.lunch),
      dinner: pick(day.dinner),
      snacks: day.snacks.map(pick),
      status: { breakfast: "planned", lunch: "planned", dinner: "planned" },
    };
  });
  return plan;
}

/** Оценка стоимости плана (по costPerServing * условные порции семьи) */
export function estimatePlanCost(plan, dishes) {
  let sum = 0;
  for (const day of plan) {
    for (const key of ["breakfast", "lunch", "dinner"]) {
      const d = dishes[day[key]];
      if (d) sum += (d.costPerServing || 0) * 3; // грубо на семью
    }
    for (const sid of day.snacks || []) {
      const d = dishes[sid];
      if (d) sum += d.costPerServing || 0;
    }
  }
  return Math.round(sum);
}

export function todayKey() {
  const t = new Date();
  return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, "0")}-${String(t.getDate()).padStart(2, "0")}`;
}

/** День плана: по умолчанию день недели от понедельника = индекс в текущем плане */
export function planDayIndex(plan) {
  if (!plan?.length) return 0;
  const js = new Date().getDay(); // 0 Sun
  const monBased = js === 0 ? 6 : js - 1;
  return Math.min(monBased, plan.length - 1);
}

/**
 * Слоты плана → корзина.
 * pick: { days?: number[], meals?: { breakfast?, lunch?, dinner? } }
 */
export function slotsFromPlan(plan, dishes, pick = null) {
  const dayIdx = pick?.days;
  const meals = pick?.meals || { breakfast: true, lunch: true, dinner: true };
  const slots = [];
  plan.forEach((day, idx) => {
    if (dayIdx && !dayIdx.includes(idx)) return;
    for (const key of ["breakfast", "lunch", "dinner"]) {
      if (meals[key] === false) continue;
      const id = day[key];
      const d = dishes[id];
      if (!d) continue;
      const meta = day.meta?.[key];
      const servings = meta?.servingsPerDay || meta?.servings || d.servings;
      slots.push({
        recipeId: id,
        servings,
        meal: key,
        dayIndex: idx,
        label: day.label || day.dayName,
        people: meta?.people,
        batchDays: meta?.batchDays,
      });
    }
  });
  return slots;
}

/** Поставить блюдо в план на несколько дней подряд */
export function placeRecipeInPlan(plan, opts) {
  const {
    recipeId,
    meal = "dinner",
    startIndex = 0,
    days = 1,
    people = 3,
    servings = null,
    dishBaseServings = 6,
  } = opts;
  const totalServings = servings || people * Math.max(1, days);
  const servingsPerDay = Math.max(1, Math.round(totalServings / Math.max(1, days)));
  const next = plan.map((d) => ({ ...d, meta: { ...(d.meta || {}) } }));
  for (let i = 0; i < days; i++) {
    const idx = startIndex + i;
    if (idx >= next.length) break;
    next[idx] = {
      ...next[idx],
      [meal]: recipeId,
      meta: {
        ...(next[idx].meta || {}),
        [meal]: {
          people,
          servings: totalServings,
          servingsPerDay,
          batchDays: days,
          dishBaseServings,
          placedAt: new Date().toISOString(),
        },
      },
      cookHint:
        i === 0
          ? `Новая варка: ${meal}, ~${totalServings} порц ${daysRu(days)}.`
          : `Разогрев (${i + 1}/${days})`,
    };
  }
  return next;
}

export function basketToText(basket, stores) {
  const lines = ["Корзина семейного меню", ""];
  for (const [storeId, group] of Object.entries(basket.byStore)) {
    lines.push(`— ${storeName(stores, storeId)} (~${Math.round(group.total)} ₽)`);
    for (const l of group.lines) {
      const unit = l.unit === "pcs" ? "шт" : l.unit === "ml" ? "мл" : "г";
      lines.push(`  • ${l.name}: ${l.buy} ${unit}`);
    }
    lines.push("");
  }
  lines.push(`Итого докупить: ~${Math.round(basket.total)} ₽`);
  return lines.join("\n");
}
