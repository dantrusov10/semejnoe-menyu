import {
  dbGet,
  dbSet,
  dbExportAll,
  dbImportAll,
  defaultSettings,
  defaultBudgetLedger,
} from "./db.js";
import {
  indexCatalog,
  storeName,
  rub,
  amountLabel,
  draftWeekPlan,
  estimatePlanCost,
  planDayIndex,
  scaleIngredients,
  placeRecipeInPlan,
  daysRu,
  banForMonth,
  familyServings,
  suggestReplacements,
  childNotes,
  proteinBalance,
  markBatchHints,
  recipeStockHint,
  repairPlanLabels,
  matchFromInventory,
} from "./engine.js";
import { normalizeInventory, invAmount, setInvAmount, inventoryAmounts, expiryStatus } from "./inventory.js";
import { createStockUi } from "./stock-ui.js";
import { dishIcon } from "./icons.js";
import { openSkModal, closeSkModal } from "./a11y-modals.js";
import {
  pullCloud,
  pushCloud,
  healthCloud,
  mergeEvents,
  makeEvent,
  APP_CONFIG,
  deviceId,
} from "./sync.js";
import {
  filterEvents,
  popularProducts,
  spendByCategory,
  spendTimeline,
  totalSpend,
  cooksByMeal,
  SPEND_LABELS,
  monthForecast,
  topExpensiveProducts,
  stockCoverageShare,
  dayjs,
} from "./stats.js";
import { initReminders, ensureNotifyPermission, maybeEveningReminder } from "./notify.js";
import { aiSuggest, aiQuota } from "./ai.js";

const state = {
  data: null,
  cat: null,
  settings: defaultSettings(),
  inventory: {},
  events: [],
  plan: [],
  weekNum: 1,
  budget: defaultBudgetLedger(),
  screen: "today",
  selectedRecipe: null,
  matchMode: "almost",
  syncAt: null,
  syncError: null,
  charts: {},
};

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
let fuse;
let toastTimer;

function toast(msg) {
  const el = $("#toast");
  if (!el) return;
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("show"), 2800);
}

async function persistLocal() {
  await dbSet("settings", state.settings);
  await dbSet("inventory", state.inventory);
  await dbSet("events", state.events);
  await dbSet("plan", state.plan);
  await dbSet("weekNum", state.weekNum);
  await dbSet("budget", state.budget);
  // автосохранение в облако — без кнопок
  cloudSave().catch((e) => {
    state.syncError = String(e.message || e);
    updateSyncBadge();
  });
}

async function cloudSave() {
  const res = await pushCloud({
    inventory: state.inventory,
    events: state.events,
    plan: state.plan,
    settings: state.settings,
    budget: state.budget,
    weekNum: state.weekNum,
  });
  state.syncAt = res.updatedAt || new Date().toISOString();
  state.syncError = null;
  updateSyncBadge();
}

function isMojibakeText(s) {
  return !s || /[?]{2,}|�/.test(String(s));
}

/** Чинит ??? в покупках/кастом-продуктах (после битой UTF-8 выгрузки). */
function repairShoppingMojibake() {
  const UNIT_LABEL = { pcs: "шт", pack: "уп", g: "г", kg: "кг", ml: "мл", l: "л" };
  const KNOWN = [
    { idPattern: /^custom_\?{4}_\?{8}_/, name: "Фуэт / колбаски", unit: "pcs", qty: 1, category: "вкусняшки", spendCategory: "treats", comment: "Вкусняшки недели" },
    { idPattern: /^custom_\?{2}_\?{4}_\?{3}_/, name: "Твёрдый сыр", unit: "g", qty: 200, category: "вкусняшки", spendCategory: "treats", comment: "Вкусняшки недели" },
    { idPattern: /^custom_\?{5}_/, name: "Чипсы", unit: "pack", qty: 1, category: "вкусняшки", spendCategory: "treats", comment: "Вкусняшки недели" },
    { idPattern: /^custom_\?{8}_/, name: "Сухарики", unit: "pack", qty: 1, category: "вкусняшки", spendCategory: "treats", comment: "Вкусняшки недели" },
  ];
  const slugId = (name, suffix) => {
    const slug = name
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/[^a-zа-я0-9]+/gi, "_")
      .replace(/^_|_$/g, "")
      .slice(0, 40);
    return `custom_${slug}_${suffix}`;
  };

  if (!Array.isArray(state.settings.customProducts)) state.settings.customProducts = [];
  if (!Array.isArray(state.settings.shoppingList)) state.settings.shoppingList = [];
  const idMap = new Map();
  let changed = false;

  state.settings.customProducts = state.settings.customProducts
    .map((p) => {
      const hit = KNOWN.find((k) => k.idPattern.test(p?.id || ""));
      if (!hit || (!isMojibakeText(p.name) && !isMojibakeText(p.category))) return p;
      const suffix = (p.id.split("_").pop() || "x").slice(0, 5);
      const newId = slugId(hit.name, suffix);
      idMap.set(p.id, newId);
      changed = true;
      return {
        ...p,
        id: newId,
        name: hit.name,
        unit: hit.unit === "pack" || hit.unit === "pcs" ? "pcs" : hit.unit === "g" ? "g" : p.unit,
        category: hit.category,
        custom: true,
      };
    })
    .filter((p) => p && !isMojibakeText(p.name));

  state.settings.shoppingList = state.settings.shoppingList.map((it) => {
    const oldId = it.productId || "";
    let hit = KNOWN.find((k) => k.idPattern.test(oldId));
    if (!hit && isMojibakeText(it.text)) {
      hit = KNOWN.find(
        (k) => k.qty === Number(it.qty) && k.unit === it.unit && k.spendCategory === (it.spendCategory || "")
      );
    }
    if (!hit) return it;
    const newId = idMap.get(oldId) || slugId(hit.name, (oldId.split("_").pop() || "x").slice(0, 5));
    if (!idMap.has(oldId)) {
      idMap.set(oldId, newId);
      if (!state.settings.customProducts.some((p) => p.id === newId)) {
        state.settings.customProducts.push({
          id: newId,
          name: hit.name,
          unit: hit.unit === "pack" || hit.unit === "pcs" ? "pcs" : hit.unit,
          price: 0,
          store: "ashan",
          category: hit.category,
          kcal: 0,
          protein: 0,
          fat: 0,
          carbs: 0,
          shelfDays: 14,
          defaultZone: "pantry",
          brand: "",
          photo: "",
          custom: true,
        });
      }
    }
    changed = true;
    return {
      ...it,
      productId: newId,
      text: `${hit.name} — ${it.qty ?? hit.qty} ${UNIT_LABEL[it.unit] || it.unit}`,
      category: hit.category,
      comment: isMojibakeText(it.comment) ? hit.comment : it.comment,
    };
  });

  return changed;
}

function mergeCustomProducts() {
  const repaired = repairShoppingMojibake();
  if (!Array.isArray(state.settings.customProducts)) state.settings.customProducts = [];
  for (const p of state.settings.customProducts) {
    if (!p?.id) continue;
    state.cat.products[p.id] = p;
    if (!state.data.products.find((x) => x.id === p.id)) state.data.products.push(p);
  }
  const meta = state.settings.productMeta || {};
  for (const [id, m] of Object.entries(meta)) {
    const p = state.cat.products[id];
    if (!p || !m) continue;
    if (m.category != null) p.category = m.category;
    if (m.brand != null) p.brand = m.brand;
    if (m.photo != null) p.photo = m.photo;
  }
  if (!Array.isArray(state.settings.customDishes)) state.settings.customDishes = [];
  for (const d of state.settings.customDishes) {
    if (!d?.id) continue;
    state.cat.dishes[d.id] = d;
    if (!state.data.dishes.find((x) => x.id === d.id)) state.data.dishes.push(d);
  }
  return repaired;
}

function isTyping() {
  const a = document.activeElement;
  if (!a) return false;
  const tag = a.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || a.isContentEditable;
}

async function loadLocal() {
  state.settings = { ...defaultSettings(), ...(await dbGet("settings", {})) };
  if (!Array.isArray(state.settings.mealStock)) state.settings.mealStock = [];
  if (!Array.isArray(state.settings.customProducts)) state.settings.customProducts = [];
  if (!state.settings.productMeta || typeof state.settings.productMeta !== "object") state.settings.productMeta = {};
  if (!state.settings.period) state.settings.period = defaultSettings().period;
  if (state.settings.alcoholBudget == null) {
    state.settings.alcoholBudget = (state.settings.wineBudget || 0) + (state.settings.ginBudget || 0);
  }
  if (state.settings.sweetBudget == null) state.settings.sweetBudget = 4000;
  state.inventory = normalizeInventory((await dbGet("inventory", {})) || {});
  state.events = (await dbGet("events", [])) || [];
  state.weekNum = (await dbGet("weekNum", 1)) || 1;
  state.budget = { ...defaultBudgetLedger(), ...(await dbGet("budget", {})) };
  if (state.budget.alcoholSpent == null) {
    state.budget.alcoholSpent = (state.budget.wineSpent || 0) + (state.budget.ginSpent || 0);
  }
  if (state.budget.sweetSpent == null) state.budget.sweetSpent = 0;
  const savedPlan = await dbGet("plan", null);
  state.plan = repairPlanLabels(
    savedPlan?.length ? savedPlan : draftWeekPlan(state.data, state.settings, state.weekNum),
    state.data?.menu
  );
  if (mergeCustomProducts()) await persistLocal();
}

function dish(id) {
  return state.cat.dishes[id];
}

function updateSyncBadge() {
  const els = [$("#sync-badge"), $("#sync-badge-mobile")].filter(Boolean);
  if (!els.length) return;
  const offline = !!state.syncError;
  const text = offline ? "офлайн" : state.syncAt ? `облако ${dayjs(state.syncAt).format("HH:mm")}` : "облако";
  const cls = offline ? "sk-pill" : "sk-pill ok";
  els.forEach((el) => {
    el.textContent = text;
    el.className = el.id === "sync-badge-mobile" ? `${cls} sk-pill-mobile` : cls;
  });
}

const MORE_SCREENS = new Set(["period", "recipes", "stats", "budget", "sync"]);

function closeMoreSheet() {
  $("#more-sheet")?.setAttribute("hidden", "");
}

function openMoreSheet() {
  $("#more-sheet")?.removeAttribute("hidden");
}

function syncNavUi(name) {
  $$("#nav-list [data-screen]").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  $$("#tabbar [data-screen]").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  const moreBtn = $("#tabbar [data-more]");
  if (moreBtn) moreBtn.classList.toggle("active", MORE_SCREENS.has(name));
  $$("#more-sheet [data-screen]").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
}

async function syncPull(preferCloud = true) {
  try {
    const cloud = await pullCloud();
    if (preferCloud) {
      if (cloud.inventory) state.inventory = normalizeInventory(cloud.inventory);
      if (cloud.plan?.length) state.plan = repairPlanLabels(cloud.plan, state.data?.menu);
      if (cloud.settings) {
        state.settings = { ...defaultSettings(), ...state.settings, ...cloud.settings };
        if (!Array.isArray(state.settings.mealStock)) state.settings.mealStock = [];
        if (!Array.isArray(state.settings.customProducts)) state.settings.customProducts = [];
      }
      if (cloud.budget) state.budget = { ...state.budget, ...cloud.budget };
      if (cloud.weekNum) state.weekNum = cloud.weekNum;
    }
    mergeCustomProducts();
    state.events = mergeEvents(state.events, cloud.events || []);
    state.syncAt = cloud.updatedAt || new Date().toISOString();
    state.syncError = null;
    await dbSet("settings", state.settings);
    await dbSet("inventory", state.inventory);
    await dbSet("events", state.events);
    await dbSet("plan", state.plan);
    await dbSet("weekNum", state.weekNum);
    await dbSet("budget", state.budget);
    updateSyncBadge();
  } catch (e) {
    state.syncError = String(e.message || e);
    updateSyncBadge();
    throw e;
  }
}

async function saveInventoryAndSync() {
  await persistLocal();
}

const PAGE_META = {
  today: ["Сегодня", "Что едим, что готово, чего не хватает."],
  plan: ["Меню", "Принятое меню по дням. Новое — в «Сборке»."],
  period: ["Сборка", "Авточерновик на N дней → принять в меню."],
  inventory: ["Запасы", "Продукты и подбор: строго / почти / срочно."],
  basket: ["Покупки", "Список, шаблоны, шаринг. Цена — при покупке."],
  recipes: ["Рецепты", "Поиск, своё блюдо, любимое → меню."],
  stats: ["Статистика", "Категории, приёмы, товары, покрытие запасами."],
  budget: ["Бюджет", "Факт + прогноз до конца месяца."],
  sync: ["Облако", "Синхронизация и напоминания."],
};

const SCREEN_HINTS = {
  today: {
    id: "hint_today",
    text: "Сегодня — блюда из меню. «Замена» меняет слот. Готовое после «Приготовил» появляется ниже.",
  },
  plan: {
    id: "hint_menu",
    text: "Меню — то, что уже принято. Собрать новое: «Сборка» → авточерновик → «В меню».",
  },
  period: {
    id: "hint_assembly",
    text: "Сборка сразу строит авточерновик. Параметры можно поменять и нажать «Авточерновик» ещё раз.",
  },
  inventory: {
    id: "hint_stock",
    text: "Строго = только из того, что есть. Почти = можно докупить немного. Срочно = сначала продукты со сроком.",
  },
  basket: {
    id: "hint_basket",
    text: "Цена при покупке обновляет историю. Пополнение запасов со скрина тоже может подтянуть цены в каталог.",
  },
};

function hintHtml(screen) {
  const h = SCREEN_HINTS[screen];
  if (!h) return "";
  if (!state.settings.hintsDismissed) state.settings.hintsDismissed = {};
  if (state.settings.hintsDismissed[h.id]) return "";
  return `<div class="sk-hint" data-hint="${h.id}" role="status">
    <p>${h.text}</p>
    <button type="button" class="sk-btn sk-btn-ghost" data-hint-dismiss style="min-height:40px">Понятно</button>
  </div>`;
}

function bindHintDismiss(root) {
  root?.querySelector("[data-hint-dismiss]")?.addEventListener("click", async () => {
    const id = root.querySelector("[data-hint]")?.dataset.hint;
    if (!id) return;
    if (!state.settings.hintsDismissed) state.settings.hintsDismissed = {};
    state.settings.hintsDismissed[id] = true;
    await persistLocal();
    root.querySelector("[data-hint]")?.remove();
  });
}

function setScreen(name) {
  state.screen = name;
  closeMoreSheet();
  syncNavUi(name);
  $$(".sk-panel").forEach((p) => p.classList.toggle("active", p.id === `screen-${name}`));
  const meta = PAGE_META[name] || [name, ""];
  if ($("#page-title")) $("#page-title").textContent = meta[0];
  if ($("#page-lead")) $("#page-lead").textContent = meta[1];
  try {
    window.scrollTo({ top: 0, behavior: "auto" });
  } catch {
    window.scrollTo(0, 0);
  }
  renderScreen();
}

function renderScreen() {
  ({
    today: renderToday,
    plan: renderPlan,
    period: renderPeriod,
    inventory: renderInventory,
    basket: renderBasket,
    recipes: renderRecipes,
    stats: renderStats,
    budget: renderBudget,
    sync: renderSync,
  })[state.screen]?.();
}

function budgetPlanTotal() {
  const s = state.settings;
  return (s.cookingBudget || 0) + alcoholPlan(s) + (s.treatsBudget || 0) + (s.sweetBudget || 0);
}

function mealStockActive() {
  return (state.settings.mealStock || []).filter((m) => (m.portions || 0) > 0);
}

async function eatMealPortion(mealId, count = 1) {
  const meals = state.settings.mealStock || [];
  const m = meals.find((x) => x.id === mealId);
  if (!m) return;
  const n = Math.max(1, Math.min(m.portions || 1, +count || 1));
  m.portions = (m.portions || 1) - n;
  if (m.portions <= 0) state.settings.mealStock = meals.filter((x) => x.id !== mealId);
  await persistLocal();
  toast(n === 1 ? "Съели 1 порцию" : `Съели ${n} порц.`);
  renderScreen();
}

/** Категория «без мяса» = category ИЛИ protein ИЛИ веге-тег */
function matchesCategory(d, cat) {
  if (cat === "all") return true;
  if (d.category === cat) return true;
  if (cat === "без мяса") {
    return d.protein === "без мяса" || (d.tags || []).includes("веге") || (d.tags || []).includes("без мяса");
  }
  return false;
}

function planDateRange(plan) {
  const dates = (plan || []).map((d) => d.date).filter(Boolean).sort();
  return { from: dates[0] || null, to: dates[dates.length - 1] || null, count: dates.length };
}

function openDayModal(day) {
  if (!day) return;
  $("#dayModalTitle").textContent = day.label || day.dayName || "День";
  const meals = [
    ["Завтрак", day.breakfast],
    ["Обед", day.lunch],
    ["Ужин", day.dinner],
    ...(day.snacks || []).map((id, i) => [`Перекус ${i + 1}`, id]),
  ];
  $("#dayModalBody").innerHTML = `
    <p class="sk-meta">${day.cookHint || ""}</p>
    <div class="sk-grid" id="day-meals"></div>`;
  const box = $("#day-meals");
  meals.forEach(([label, id]) => {
    const d = dish(id);
    if (!d) return;
    const col = document.createElement("div");
    col.className = "sk-col-12";
    col.innerHTML = `<div class="sk-meal"><b>${label}</b><div><div style="font-weight:750">${dishIcon(d)} ${d.name}</div><div class="sk-meta">${d.timeMin} мин · ${d.category}</div></div><div class="price">~${rub(d.costPerServing)}</div></div>`;
    col.querySelector(".sk-meal").onclick = () => {
      closeSkModal($("#dayModal"));
      openRecipe(d.id);
    };
    box.appendChild(col);
  });
  openSkModal($("#dayModal"), {
    titleId: "dayModalTitle",
    close: () => closeSkModal($("#dayModal")),
  });
}

function renderMonthCalendar(rootSel, plan) {
  const box = $(rootSel);
  if (!box) return;
  const now = new Date();
  const y = state._calY ?? now.getFullYear();
  const m = state._calM ?? now.getMonth();
  const first = new Date(y, m, 1);
  const startPad = (first.getDay() + 6) % 7;
  const daysInMonth = new Date(y, m + 1, 0).getDate();
  const byDate = Object.fromEntries((plan || []).filter((d) => d.date).map((d) => [d.date, d]));
  const range = planDateRange(plan);
  const monthName = first.toLocaleDateString("ru-RU", { month: "long", year: "numeric" });
  box.innerHTML = `
    <div class="sk-ok" style="margin-bottom:10px">Меню покрывает <b>${range.count}</b> дн.${range.from && range.to ? `: с <b>${range.from}</b> по <b>${range.to}</b>` : ""}. Нажмите день — меню дня.</div>
    <div class="sk-row" style="justify-content:space-between;margin-bottom:8px">
      <button class="sk-btn sk-btn-ghost" id="cal-prev" style="min-height:40px">←</button>
      <strong style="text-transform:capitalize">${monthName}</strong>
      <button class="sk-btn sk-btn-ghost" id="cal-next" style="min-height:40px">→</button>
    </div>
    <div class="cal-grid">${["пн","вт","ср","чт","пт","сб","вс"].map((d) => `<div class="cal-dow">${d}</div>`).join("")}<div id="cal-days" style="display:contents"></div></div>`;
  const daysBox = $("#cal-days");
  for (let i = 0; i < startPad; i++) {
    const el = document.createElement("div");
    el.className = "cal-cell muted";
    daysBox.appendChild(el);
  }
  for (let d = 1; d <= daysInMonth; d++) {
    const iso = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const el = document.createElement("div");
    const isToday = iso === now.toISOString().slice(0, 10);
    const day = byDate[iso];
    const has = !!day;
    el.className = `cal-cell ${isToday ? "today" : ""} ${has ? "has" : ""}`;
    const dinnerName = has && dish(day.dinner) ? dish(day.dinner).name.split(" ").slice(0, 2).join(" ") : "";
    el.innerHTML = `<b>${d}</b>${has ? `<div class="sk-meta">${dinnerName || "меню"}</div>` : ""}`;
    if (has) el.onclick = () => openDayModal(day);
    daysBox.appendChild(el);
  }
  $("#cal-prev").onclick = () => {
    state._calM = m - 1;
    if (state._calM < 0) {
      state._calM = 11;
      state._calY = y - 1;
    }
    renderPlan();
  };
  $("#cal-next").onclick = () => {
    state._calM = m + 1;
    if (state._calM > 11) {
      state._calM = 0;
      state._calY = y + 1;
    }
    renderPlan();
  };
}

async function swapMeal(dayIndex, mealKey) {
  const day = state.plan[dayIndex];
  const current = dish(day[mealKey]);
  if (!current) return;
  const smart = suggestReplacements(current, state.data.dishes, state.settings, { limit: 5 });
  if (!smart.length) return toast("Нет замен");
  const pick = smart[0].dish;
  day[mealKey] = pick.id;
  await persistLocal();
  toast(`Замена: ${pick.name} (${smart[0].why})`);
  renderScreen();
}

/* ——— TODAY (кухонный режим) ——— */
function renderToday() {
  const root = $("#screen-today");
  const idx = planDayIndex(state.plan);
  const today = state.plan[idx];
  const amt = inventoryAmounts(state.inventory);
  const meals = mealStockActive();
  const fc = monthForecast(state.events, budgetPlanTotal());
  const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };

  const mode = state._matchMode || "almost";
  const expiring = new Set();
  for (const [id, lot] of Object.entries(state.inventory || {})) {
    const st = expiryStatus(lot.expiresAt, 3);
    if (st === "soon" || st === "expired") expiring.add(id);
  }
  const stockMatches = matchFromInventory(state.data.dishes, state.cat.products, amt, state.settings, {
    minServings: 2,
    mode,
    maxMissingRub: mode === "urgent" ? 320 : 200,
    expiringIds: expiring,
  }).slice(0, 5);

  root.innerHTML = `
    ${hintHtml("today")}
    <div class="sk-forecast">
      <div><div class="sk-meta">Месяц сейчас</div><div class="sk-kpi" style="font-size:1.35rem">${rub(fc.spent)}</div></div>
      <div><div class="sk-meta">Прогноз к концу</div><div class="sk-kpi" style="font-size:1.35rem;color:${fc.over ? "var(--hot)" : "inherit"}">${rub(fc.projected)}</div></div>
      <div><div class="sk-meta">Лимит / день</div><div class="sk-kpi" style="font-size:1.2rem">${rub(fc.dailyCap)}</div></div>
    </div>
    <div class="sk-card tone" style="margin-bottom:14px">
      <div class="sk-row" style="justify-content:space-between;align-items:center;margin-bottom:8px">
        <h2 style="margin:0">${today ? today.label || today.dayName : "Нет меню"}</h2>
        <button class="sk-btn sk-btn-ghost" id="td-to-plan" style="min-height:40px">Всё меню</button>
      </div>
      <p class="sk-meta">${today?.cookHint || "Соберите меню в «Сборке» или шаблон недели"}</p>
      <div id="td-meals"></div>
    </div>
    <div class="sk-card" style="margin-bottom:14px">
      <h3 style="margin-top:0">Из запасов</h3>
      <div class="sk-seg sk-seg-wide" id="td-match-modes" role="tablist" aria-label="Режим подбора">
        <button type="button" data-mode="strict" class="${mode === "strict" ? "active" : ""}">Строго</button>
        <button type="button" data-mode="almost" class="${mode === "almost" ? "active" : ""}">Почти</button>
        <button type="button" data-mode="urgent" class="${mode === "urgent" ? "active" : ""}">Срочно</button>
      </div>
      <div class="sk-chip-row" id="td-stock-cook" style="margin-top:8px"></div>
    </div>
    <div class="sk-card" style="margin-bottom:14px" id="td-batch">
      <h3 style="margin-top:0">Готовое в холодильнике</h3>
      <div id="td-meals-stock"></div>
    </div>
    <div class="sk-row">
      <button class="sk-btn sk-btn-accent" id="td-basket">Покупки</button>
      <button class="sk-btn sk-btn-ghost" id="td-inv">Запасы</button>
      <button class="sk-btn sk-btn-ghost" id="td-period">Сборка</button>
    </div>`;
  bindHintDismiss(root);

  const box = $("#td-meals");
  if (today) {
    ["breakfast", "lunch", "dinner"].forEach((key) => {
      const d = dish(today[key]);
      if (!d) return;
      const hint = recipeStockHint(d, amt, state.cat.products);
      const notes = childNotes(d, state.settings);
      const warn = notes.find((n) => n.level === "block" || n.level === "warn");
      const row = document.createElement("div");
      row.className = "sk-meal";
      row.style.marginTop = "10px";
      row.innerHTML = `
        <b>${labels[key]}</b>
        <div>
          <div style="font-weight:750">${dishIcon(d)} ${d.name}</div>
          <div class="sk-meta">${d.timeMin} мин · запасы ${Math.round(hint.coverage * 100)}%${warn ? ` · ${warn.text}` : ""}</div>
        </div>
        <div class="sk-meal-actions">
          <button class="sk-btn sk-btn-ghost" data-open>Рецепт</button>
          <button class="sk-btn sk-btn-ghost" data-swap>Замена</button>
        </div>`;
      row.querySelector("[data-open]").onclick = (e) => {
        e.stopPropagation();
        openRecipe(d.id);
      };
      row.querySelector("[data-swap]").onclick = async (e) => {
        e.stopPropagation();
        await swapMeal(idx, key);
      };
      row.onclick = () => openRecipe(d.id);
      box.appendChild(row);
    });
  } else {
    box.innerHTML = `<div class="sk-note">Меню пусто — откройте «Сборку» или «Рецепты».</div>`;
  }

  const cookBox = $("#td-stock-cook");
  if (!stockMatches.length) {
    cookBox.innerHTML = `<div class="sk-meta">В этом режиме пока нечего предложить.</div>`;
  } else {
    stockMatches.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-chip";
      b.textContent = `${m.dish.name} · ${Math.round(m.coverage * 100)}%`;
      b.title = m.why;
      b.onclick = () => openRecipe(m.dish.id);
      cookBox.appendChild(b);
    });
  }
  $$("#td-match-modes [data-mode]").forEach((b) => {
    b.onclick = () => {
      state._matchMode = b.dataset.mode;
      renderToday();
    };
  });

  const stockBox = $("#td-meals-stock");
  if (!meals.length) {
    stockBox.innerHTML = `<div class="sk-meta">Пока пусто. После «Приготовил» блюдо появится здесь на ${daysRu(2)}–${daysRu(4)}.</div>`;
  } else {
    meals.forEach((m) => {
      const st = expiryStatus(m.expiresAt);
      const row = document.createElement("div");
      row.className = `shop-item exp-${st}`;
      row.innerHTML = `<div style="flex:1"><b>${m.name}</b><div class="sk-meta">${m.portions} порц · до ${m.expiresAt || "—"}</div></div>
        <div class="sk-row" style="gap:6px;align-items:center;flex-wrap:wrap">
          ${m.recipeId ? `<button class="sk-btn sk-btn-ghost" data-cook style="min-height:40px">Приготовил</button>` : ""}
          <input class="sk-input" type="number" min="1" max="${m.portions}" value="1" data-n style="max-width:64px" />
          <button class="sk-btn sk-btn-accent" data-eat style="min-height:40px">Съел</button>
        </div>`;
      row.querySelector("[data-cook]")?.addEventListener("click", () => openRecipe(m.recipeId));
      row.querySelector("[data-eat]").onclick = () => eatMealPortion(m.id, row.querySelector("[data-n]").value);
      stockBox.appendChild(row);
    });
  }

  $("#td-to-plan").onclick = () => setScreen("plan");
  $("#td-basket").onclick = () => setScreen("basket");
  $("#td-inv").onclick = () => setScreen("inventory");
  $("#td-period").onclick = () => setScreen("period");
}

/* ——— PLAN ——— */
function renderPlan() {
  const root = $("#screen-plan");
  state.plan = markBatchHints(state.plan, state.cat.dishes);
  const cost = estimatePlanCost(state.plan, state.cat.dishes);
  const bal = proteinBalance(state.plan, state.cat.dishes);
  root.innerHTML = `
    ${hintHtml("plan")}
    <div class="sk-forecast">
      <div><div class="sk-meta">Прогноз меню</div><div class="sk-kpi">${rub(cost)}</div></div>
      <div><div class="sk-meta">Дней</div><div class="sk-kpi" style="font-size:1.2rem">${state.plan.length}</div></div>
      <div><div class="sk-meta">Белок (приёмы)</div><div class="sk-meta">кур ${bal.chicken} · свин ${bal.pork} · гов ${bal.beef} · рыб ${bal.fish}</div></div>
    </div>
    <div class="sk-card" style="margin-bottom:14px">
      <h3 style="margin-top:0">Календарь</h3>
      <div id="cal-wrap"></div>
    </div>
    <div class="sk-row">
      <button class="sk-btn sk-btn-accent" id="to-period">Сборка</button>
      <button class="sk-btn sk-btn-ghost" id="to-basket-week">В покупки</button>
      <button class="sk-btn sk-btn-ghost" id="to-today">Сегодня</button>
      <button class="sk-btn sk-btn-primary" id="gen-week">Шаблон недели</button>
      <button class="sk-btn sk-btn-ghost" id="gen-loved">Из любимого</button>
    </div>
    <div class="sk-grid" id="plan-grid" style="margin-top:12px"></div>`;
  bindHintDismiss(root);

  renderMonthCalendar("#cal-wrap", state.plan);
  $("#to-period").onclick = () => setScreen("period");
  $("#to-basket-week").onclick = () => setScreen("basket");
  $("#to-today").onclick = () => setScreen("today");
  $("#gen-week").onclick = async () => {
    state.plan = markBatchHints(draftWeekPlan(state.data, state.settings, state.weekNum), state.cat.dishes);
    await persistLocal();
    toast("Шаблон недели");
    renderPlan();
  };
  $("#gen-loved").onclick = async () => {
    const loved = (state.settings.loved || []).map((id) => state.cat.dishes[id]).filter(Boolean);
    if (loved.length < 3) return toast("Добавьте хотя бы 3 любимых блюда");
    let plan = draftWeekPlan(state.data, state.settings, state.weekNum);
    const byType = { breakfast: loved.filter((d) => d.type === "breakfast"), soup: loved.filter((d) => d.type === "soup"), main: loved.filter((d) => d.type === "main") };
    plan = plan.map((day, i) => ({
      ...day,
      breakfast: byType.breakfast[i % Math.max(1, byType.breakfast.length)]?.id || day.breakfast,
      lunch: byType.soup[i % Math.max(1, byType.soup.length)]?.id || day.lunch,
      dinner: byType.main[i % Math.max(1, byType.main.length)]?.id || day.dinner,
    }));
    state.plan = markBatchHints(plan, state.cat.dishes);
    await persistLocal();
    toast("Неделя из любимого");
    renderPlan();
  };

  const focus = state._focusDate;
  const grid = $("#plan-grid");
  const todayIdx = planDayIndex(state.plan);
  state.plan.forEach((day, dayIdx) => {
    if (focus && day.date && day.date !== focus) return;
    const col = document.createElement("div");
    col.className = "sk-col-4";
    const isToday = dayIdx === todayIdx || day.date === new Date().toISOString().slice(0, 10);
    col.innerHTML = `<div class="sk-card ${isToday ? "tone" : ""}"><div class="sk-row" style="margin:0 0 8px;justify-content:space-between"><h2 style="margin:0;font-size:1.1rem">${day.label || day.dayName}</h2><button class="sk-btn sk-btn-ghost" data-swap style="min-height:40px">Не хочу ужин</button></div><div data-meals></div></div>`;
    const mealsBox = col.querySelector("[data-meals]");
    ["breakfast", "lunch", "dinner"].forEach((key) => {
      const d = dish(day[key]);
      if (!d) return;
      const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
      const row = document.createElement("div");
      row.className = "sk-meal";
      row.style.marginTop = "8px";
      row.innerHTML = `<b>${labels[key]}</b><div><div style="font-weight:750">${dishIcon(d)} ${d.name}</div><div class="sk-meta">${daysRu(d.batchDays)}</div></div><div class="price">~${rub(d.costPerServing)}</div>`;
      row.onclick = () => openRecipe(d.id);
      mealsBox.appendChild(row);
    });
    col.querySelector("[data-swap]").onclick = async (e) => {
      e.stopPropagation();
      state.settings.bannedUntil = banForMonth(state.settings, day.dinner, 30);
      if (!state.settings.disliked.includes(day.dinner)) state.settings.disliked.push(day.dinner);
      await swapMeal(dayIdx, "dinner");
    };
    grid.appendChild(col);
  });
  if (focus) {
    const clear = document.createElement("button");
    clear.className = "sk-btn sk-btn-ghost";
    clear.textContent = "Показать все дни";
    clear.onclick = () => {
      state._focusDate = null;
      renderPlan();
    };
    grid.prepend(clear);
  }
}

/* ——— STOCK UI (inventory / basket / period) ——— */
let stockUi;
function ensureStockUi() {
  if (stockUi) return stockUi;
  stockUi = createStockUi({
    state,
    $,
    $$,
    toast,
    persistLocal,
    saveInventoryAndSync,
    openRecipe,
    setScreen,
  });
  return stockUi;
}
function injectScreenHint(screen) {
  const root = $(`#screen-${screen}`);
  if (!root) return;
  const html = hintHtml(screen);
  if (!html || root.querySelector("[data-hint]")) return;
  root.insertAdjacentHTML("afterbegin", html);
  bindHintDismiss(root);
}

function renderInventory() {
  ensureStockUi().renderInventory();
  injectScreenHint("inventory");
}
function renderBasket() {
  ensureStockUi().renderBasket();
  injectScreenHint("basket");
}
function renderPeriod() {
  ensureStockUi().renderPeriod();
  injectScreenHint("period");
}

/* ——— RECIPES ——— */
function mealTypeDefault(d) {
  if (d.type === "breakfast") return "breakfast";
  if (d.type === "soup") return "lunch";
  if (d.type === "snack") return "dinner";
  return "dinner";
}

function renderRecipes() {
  const root = $("#screen-recipes");
  const proteins = [...new Set(state.data.dishes.map((d) => d.protein))].sort();
  const cats = [...new Set(state.data.dishes.map((d) => d.category))].sort();
  root.innerHTML = `
    <div class="sk-card tone" style="margin-bottom:12px">
      <div class="sk-row" style="justify-content:space-between;align-items:center">
        <div>
          <b>Своё блюдо</b>
          <div class="sk-meta">Сохранится в каталог семьи и будет в поиске</div>
        </div>
        <button class="sk-btn sk-btn-accent" id="btn-custom-dish">Добавить</button>
      </div>
      <div id="custom-dish-form" style="display:none;margin-top:12px">
        <div class="sk-plan-form">
          <label class="sk-field span-2">Название<input class="sk-input" id="cd-name" placeholder="Например: запеканка мамы" /></label>
          <label class="sk-field">Тип
            <select class="sk-select" id="cd-type">
              <option value="main">Основное</option>
              <option value="soup">Суп</option>
              <option value="breakfast">Завтрак</option>
              <option value="snack">Перекус</option>
            </select>
          </label>
          <label class="sk-field">Белок<input class="sk-input" id="cd-protein" value="своё" /></label>
          <label class="sk-field">Минут<input class="sk-input" type="number" id="cd-time" value="30" /></label>
          <label class="sk-field">На дней<input class="sk-input" type="number" id="cd-batch" value="2" min="1" max="7" /></label>
          <label class="sk-field span-2">Для дочки<input class="sk-input" id="cd-child" placeholder="Без сахара, мягко…" /></label>
          <label class="sk-field span-2">Шаги (по строке)<textarea class="sk-input" id="cd-steps" rows="3" placeholder="1.&#10;2."></textarea></label>
        </div>
        <button class="sk-btn sk-btn-primary" id="cd-save" style="margin-top:8px">Сохранить блюдо</button>
      </div>
    </div>
    <div class="sk-card" style="margin-bottom:14px">
      <div class="sk-row">
        <label class="sk-field" style="flex:1;min-width:180px">Поиск
          <input class="sk-input" id="recipe-q" placeholder="борщ, творог, минтай…" value="${state._recipeQ || ""}" />
        </label>
        <label class="sk-field">Приём / тип
          <select class="sk-select" id="f-type">
            <option value="all">Все</option>
            <option value="breakfast">Завтраки</option>
            <option value="soup">Супы</option>
            <option value="main">Основные</option>
            <option value="snack">Перекусы</option>
            <option value="dessert">Десерты</option>
          </select>
        </label>
        <label class="sk-field">Белок / рацион
          <select class="sk-select" id="f-protein"><option value="all">Все</option>${proteins.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </label>
        <label class="sk-field">Раздел
          <select class="sk-select" id="f-cat"><option value="all">Все</option>${cats.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </label>
        <label class="sk-field">Время
          <select class="sk-select" id="f-time"><option value="all">Любое</option><option value="20">≤20</option><option value="40">≤40</option><option value="60">≤60</option></select>
        </label>
        <label class="sk-field" style="flex-direction:row;align-items:center;gap:8px;min-height:48px">
          <input type="checkbox" id="f-batch" /> на 2+ дня
        </label>
      </div>
      <p class="sk-meta" style="margin:8px 0 0">«Завтраки» + белок «без мяса» — ок. Раздел «без мяса» тоже ловит завтраки и веге.</p>
    </div>
    <div class="recipe-count" id="recipe-count"></div>
    <div class="recipe-pick-grid" id="recipe-list"></div>`;

  fuse = new Fuse(state.data.dishes, {
    keys: ["name", "description", "category", "tags", "protein"],
    threshold: 0.38,
  });

  const redraw = () => {
    const q = ($("#recipe-q").value || "").trim();
    state._recipeQ = q;
    const type = $("#f-type").value;
    const cat = $("#f-cat").value;
    const protein = $("#f-protein").value;
    const time = $("#f-time").value;
    const batchOnly = $("#f-batch").checked;
    let list = q ? fuse.search(q).map((x) => x.item) : state.data.dishes.slice();
    list = list.filter((d) => {
      if (type !== "all" && d.type !== type) return false;
      if (!matchesCategory(d, cat)) return false;
      if (protein !== "all" && d.protein !== protein) return false;
      if (time !== "all" && (d.timeMin || 0) > +time) return false;
      if (batchOnly && (d.batchDays || 1) < 2) return false;
      return true;
    });
    $("#recipe-count").textContent = `Найдено: ${list.length}`;
    const pane = $("#recipe-list");
    pane.innerHTML = "";
    if (!list.length) {
      pane.innerHTML = `<div class="sk-note">Ничего не найдено — ослабьте фильтр «Раздел» или белок.</div>`;
      return;
    }
    list.slice(0, 120).forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `recipe-pick ${d.id === state.selectedRecipe ? "active" : ""}`;
      b.innerHTML = `<span class="ico">${dishIcon(d)}</span><strong>${d.name}</strong><span class="sk-meta">${d.type} · ${d.protein} · ${d.timeMin} мин · ${rub(d.costBatch)}</span>`;
      b.onclick = () => {
        state.selectedRecipe = d.id;
        openRecipe(d.id, true);
      };
      pane.appendChild(b);
    });
    if (list.length > 120) {
      const more = document.createElement("div");
      more.className = "sk-meta";
      more.textContent = `Показаны 120 из ${list.length} — уточните поиск.`;
      pane.appendChild(more);
    }
  };

  $("#btn-custom-dish").onclick = () => {
    const box = $("#custom-dish-form");
    box.style.display = box.style.display === "none" ? "block" : "none";
  };
  $("#cd-save").onclick = async () => {
    const name = $("#cd-name").value.trim();
    if (!name) return toast("Название");
    const steps = ($("#cd-steps").value || "")
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);
    const id = `custom_dish_${name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").slice(0, 36)}_${Math.random().toString(36).slice(2, 5)}`;
    const dishNew = {
      id,
      name,
      type: $("#cd-type").value,
      category: "своё",
      protein: $("#cd-protein").value.trim() || "своё",
      timeMin: +$("#cd-time").value || 30,
      batchDays: +$("#cd-batch").value || 2,
      servings: 4,
      costBatch: 0,
      costPerServing: 0,
      description: "Семейный рецепт",
      child: $("#cd-child").value.trim() || "По вкусу семьи",
      ingredients: [],
      steps: steps.length ? steps : ["Приготовить по семейному способу"],
      tips: [],
      tags: ["своё"],
      stores: [],
      equipment: [],
      custom: true,
    };
    if (!Array.isArray(state.settings.customDishes)) state.settings.customDishes = [];
    state.settings.customDishes.push(dishNew);
    mergeCustomProducts();
    await persistLocal();
    toast(`«${name}» сохранено`);
    renderRecipes();
    openRecipe(id);
  };

  ["recipe-q", "f-type", "f-cat", "f-protein", "f-time", "f-batch"].forEach((id) => {
    $("#" + id).addEventListener("input", redraw);
    $("#" + id).addEventListener("change", redraw);
  });
  redraw();
}

function recipeHtml(d, servingsOverride = null) {
  const servings = servingsOverride || d.servings;
  const scaled = scaleIngredients(d, servings);
  const cost = scaled.reduce((s, i) => s + (state.cat.products[i.id]?.price || 0) * i.amount, 0);
  const stores = [...new Set((d.stores || []).map((s) => storeName(state.data.stores, s)))].join(", ");
  const rows = scaled
    .map((i) => {
      const p = state.cat.products[i.id];
      return `<tr><td>${p?.name || i.id}</td><td>${amountLabel(p, i.amount)}</td><td>${storeName(state.data.stores, p?.store)}</td><td>${rub((p?.price || 0) * i.amount)}</td></tr>`;
    })
    .join("");
  const startIdx = planDayIndex(state.plan);
  const dayOpts = state.plan
    .map((day, i) => `<option value="${i}" ${i === startIdx ? "selected" : ""}>${day.dayName}${i === startIdx ? " (сегодня)" : ""}</option>`)
    .join("");
  return `
    <p class="sk-meta" style="font-size:1.02rem;color:var(--ink)">${d.description || ""}</p>
    <div class="sk-chip-row">
      <span class="sk-tag ok">${d.category}</span>
      <span class="sk-tag">${d.protein}</span>
      ${(d.equipment || []).map((e) => `<span class="sk-tag">${e}</span>`).join("")}
      <span class="sk-tag">~${d.timeMin} мин</span>
      <span class="sk-tag hot">база ${d.servings} порц · ${rub(d.costBatch)}</span>
    </div>
    <p class="sk-meta">Где купить: ${stores || "—"}</p>
    <div class="sk-card" style="margin:10px 0;padding:12px">
      <b>Для дочки</b>
      <ul style="margin:8px 0 0;padding-left:18px" id="child-notes-list">
        ${childNotes(d, state.settings)
          .map((n) => `<li class="child-note child-${n.level}">${n.text}</li>`)
          .join("") || `<li class="sk-meta">Без особых ограничений</li>`}
      </ul>
    </div>

    <div class="sk-card tone" style="margin:14px 0">
      <h3 style="margin-top:0">Добавить в ближайшую еду</h3>
      <p class="sk-meta">Сколько взрослых и детских порций, на сколько дней готовите сразу — продукты пересчитаются.</p>
      <div class="sk-plan-form" data-plan-form>
        <label class="sk-field">Приём пищи
          <select class="sk-select" data-f="meal">
            <option value="breakfast" ${mealTypeDefault(d) === "breakfast" ? "selected" : ""}>Завтрак</option>
            <option value="lunch" ${mealTypeDefault(d) === "lunch" ? "selected" : ""}>Обед</option>
            <option value="dinner" ${mealTypeDefault(d) === "dinner" ? "selected" : ""}>Ужин</option>
          </select>
        </label>
        <label class="sk-field">С какого дня
          <select class="sk-select" data-f="start">${dayOpts}</select>
        </label>
        <label class="sk-field">Взрослых
          <input class="sk-input" type="number" min="0" max="12" value="2" data-f="adults" />
        </label>
        <label class="sk-field">Детских порций
          <input class="sk-input" type="number" min="0" max="6" value="1" data-f="child" />
        </label>
        <label class="sk-field">Готовим сразу на (дней)
          <input class="sk-input" type="number" min="1" max="7" value="${Math.min(3, d.batchDays || 2)}" data-f="days" />
        </label>
        <label class="sk-field">Порций всего
          <input class="sk-input" type="number" min="1" max="40" value="${Math.max(d.servings, 6)}" data-f="servings" />
        </label>
      </div>
      <div class="sk-meta" data-scale-hint>Ингредиенты ниже под выбранные порции · сейчас ~${rub(cost)}</div>
      <div class="sk-row">
        <button class="sk-btn sk-btn-accent" data-act="to-plan">В план</button>
        <button class="sk-btn sk-btn-ghost" data-act="sync-servings">Пересчитать продукты</button>
      </div>
    </div>

    <h3>Ингредиенты <span class="sk-meta" data-ing-label>(на ${servings} порц)</span></h3>
    <div style="overflow:auto"><table class="sk-table" data-ing-table><thead><tr><th>Продукт</th><th>Кол-во</th><th>Магазин</th><th>₽</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3>Как готовить</h3>
    <ol class="recipe-step">${(d.steps || []).map((s) => `<li>${s}</li>`).join("")}</ol>
    <h3>Подсказки</h3>
    <ul>${(d.tips || []).map((t) => `<li>${t}</li>`).join("")}</ul>
    <div class="sk-ok">Базовая порция рецепта ~<b>${rub(d.costPerServing)}</b></div>
    <div class="sk-row">
      <button class="sk-btn sk-btn-primary" data-act="cooked">Приготовил</button>
      <button class="sk-btn sk-btn-ghost" data-act="replace">Умная замена</button>
      <button class="sk-btn sk-btn-ghost" data-act="dislike">Не предлагать месяц</button>
      <button class="sk-btn sk-btn-ghost" data-act="love">В любимое</button>
    </div>
    <div data-replace-box></div>`;
}

function readPlanForm(root, d) {
  const g = (name) => root.querySelector(`[data-f="${name}"]`);
  const adults = Math.max(0, +g("adults")?.value || 2);
  const child = Math.max(0, +g("child")?.value || 0);
  const people = Math.max(1, adults + child);
  const days = Math.max(1, Math.min(7, +g("days")?.value || 1));
  const equivPerDay = familyServings(adults, child);
  let servings = Math.max(1, +g("servings")?.value || equivPerDay * days);
  return {
    meal: g("meal")?.value || mealTypeDefault(d),
    startIndex: +g("start")?.value || 0,
    people,
    adults,
    child,
    days,
    servings,
    equivPerDay,
  };
}

function refreshIngredientTable(root, d) {
  const form = readPlanForm(root, d);
  const scaled = scaleIngredients(d, form.servings);
  const cost = scaled.reduce((s, i) => s + (state.cat.products[i.id]?.price || 0) * i.amount, 0);
  const tb = root.querySelector("[data-ing-table] tbody");
  const label = root.querySelector("[data-ing-label]");
  const hint = root.querySelector("[data-scale-hint]");
  if (label) label.textContent = `(на ${form.servings} порц · ${form.adults} взр. + ${form.child} дет. · ${daysRu(form.days)})`;
  if (hint) hint.textContent = `Ингредиенты под готовку ${daysRu(form.days)} · ~${rub(cost)} · ~${Math.round(form.servings / form.days)} порц/день`;
  if (tb) {
    tb.innerHTML = scaled
      .map((i) => {
        const p = state.cat.products[i.id];
        return `<tr><td>${p?.name || i.id}</td><td>${amountLabel(p, i.amount)}</td><td>${storeName(state.data.stores, p?.store)}</td><td>${rub((p?.price || 0) * i.amount)}</td></tr>`;
      })
      .join("");
  }
}

function bindRecipeActions(d, root) {
  root.dataset.bound = "1";
  const autoServings = () => {
    const adults = +root.querySelector('[data-f="adults"]')?.value || 2;
    const child = +root.querySelector('[data-f="child"]')?.value || 0;
    const days = +root.querySelector('[data-f="days"]')?.value || 1;
    const serv = root.querySelector('[data-f="servings"]');
    if (serv) serv.value = String(familyServings(adults, child) * days);
    refreshIngredientTable(root, d);
  };
  root.querySelector('[data-f="adults"]')?.addEventListener("change", autoServings);
  root.querySelector('[data-f="child"]')?.addEventListener("change", autoServings);
  root.querySelector('[data-f="days"]')?.addEventListener("change", autoServings);
  root.querySelector('[data-f="servings"]')?.addEventListener("change", () => refreshIngredientTable(root, d));
  root.querySelector('[data-act="sync-servings"]')?.addEventListener("click", () => refreshIngredientTable(root, d));

  root.querySelector('[data-act="to-plan"]')?.addEventListener("click", async () => {
    const form = readPlanForm(root, d);
    state.plan = placeRecipeInPlan(state.plan, {
      recipeId: d.id,
      meal: form.meal,
      startIndex: form.startIndex,
      days: form.days,
      people: form.people,
      servings: form.servings,
      dishBaseServings: d.servings,
    });
    await persistLocal();
    toast(`«${d.name}» → ${form.days} дн · ${form.people} чел · ${form.servings} порц`);
    closeRecipeModal();
    setScreen("plan");
  });

  root.querySelector('[data-act="dislike"]')?.addEventListener("click", async () => {
    if (!state.settings.disliked.includes(d.id)) state.settings.disliked.push(d.id);
    state.settings.bannedUntil = banForMonth(state.settings, d.id, 30);
    await persistLocal();
    toast("Не предлагаем ~месяц");
  });
  root.querySelector('[data-act="love"]')?.addEventListener("click", async () => {
    if (!state.settings.loved.includes(d.id)) state.settings.loved.push(d.id);
    if (state.settings.bannedUntil?.[d.id]) delete state.settings.bannedUntil[d.id];
    state.settings.disliked = (state.settings.disliked || []).filter((x) => x !== d.id);
    await persistLocal();
    toast("В любимых");
  });
  root.querySelector('[data-act="replace"]')?.addEventListener("click", async () => {
    const box = root.querySelector("[data-replace-box]");
    const list = suggestReplacements(d, state.data.dishes, state.settings, { limit: 6 });
    if (!list.length) {
      box.innerHTML = `<div class="sk-note">Пока нет похожих замен.</div>`;
      return;
    }
    box.innerHTML = `<div class="sk-card" style="margin-top:10px"><h3 style="margin-top:0">Умная замена</h3><p class="sk-meta" data-ai-status>Считаем…</p><div class="sk-chip-row" data-repl></div></div>`;
    const row = box.querySelector("[data-repl]");
    const status = box.querySelector("[data-ai-status]");
    const paintLocal = (items, note) => {
      if (status) status.textContent = note || "Локальный скорер";
      row.innerHTML = "";
      items.forEach((r) => {
        const dishObj = r.dish || state.cat.dishes[r.id];
        if (!dishObj) return;
        const b = document.createElement("button");
        b.type = "button";
        b.className = "sk-chip";
        b.textContent = `${dishObj.name} · ${r.reason || r.why || ""}`;
        b.onclick = () => openRecipe(dishObj.id);
        row.appendChild(b);
      });
    };
    paintLocal(list, "Локальный скорер · уточняем через AI…");
    try {
      const amt = inventoryAmounts(state.inventory);
      const inventoryTop = Object.entries(amt)
        .filter(([, v]) => v > 0)
        .slice(0, 25)
        .map(([id, qty]) => ({ id, name: state.cat.products[id]?.name, qty }));
      const expiringIds = Object.entries(state.inventory || {})
        .filter(([, lot]) => {
          const s = expiryStatus(lot.expiresAt, 3);
          return s === "soon" || s === "expired";
        })
        .map(([id]) => id);
      const fc = monthForecast(state.events, budgetPlanTotal());
      const ai = await aiSuggest({
        mode: "replace",
        currentId: d.id,
        meal: readPlanForm(root, d).meal,
        shortlist: list.map((r) => ({
          id: r.dish.id,
          name: r.dish.name,
          protein: r.dish.protein,
          type: r.dish.type,
          costPerServing: r.dish.costPerServing,
          batchDays: r.dish.batchDays,
          why: r.why,
        })),
        inventoryTop,
        expiringIds,
        childRules: state.settings.childRules,
        budgetPace: { projected: fc.projected, plan: fc.plan, over: fc.over },
        loved: state.settings.loved || [],
        disliked: state.settings.disliked || [],
      });
      const ranked = (ai.ranked || [])
        .map((r) => ({ id: r.id, dish: state.cat.dishes[r.id], reason: r.reason }))
        .filter((r) => r.dish);
      paintLocal(
        ranked.length ? ranked : list,
        `${ai.source === "ai" ? "AI" : "скорер"} · ${ai.provider || ""}${ai.quota ? ` · сегодня ${ai.quota.suggest}/${ai.quota.suggestLimit}` : ""}${ai.note ? ` · ${ai.note}` : ""}`
      );
    } catch (e) {
      paintLocal(list, e.code === "quota" ? e.message : `AI недоступен — скорер (${e.message})`);
    }
  });

  root.querySelector('[data-act="cooked"]')?.addEventListener("click", () => {
    openCookPreview(d, readPlanForm(root, d));
  });
}

/** Превью списания: скорректировать → подтвердить */
function openCookPreview(d, form) {
  const scaled = scaleIngredients(d, form.servings);
  const rows = scaled.map((ing) => {
    const p = state.cat.products[ing.id];
    const have = invAmount(state.inventory, ing.id);
    const need = ing.amount;
    const use = Math.min(have, need);
    return { id: ing.id, name: p?.name || ing.id, product: p, have, need, use };
  });
  $("#cookModalTitle").textContent = `Приготовил · ${d.name}`;
  $("#cookModalBody").innerHTML = `
    <p class="sk-meta">Проверьте, сколько списать со запасов. Можно поправить числа. Потом блюдо попадёт в «Готовое».</p>
    <label class="sk-field">Порций в готовое<input class="sk-input" type="number" min="1" id="cook-portions" value="${form.servings}" /></label>
    <div style="overflow:auto;margin-top:10px">
      <table class="sk-table" id="cook-deduct-table">
        <thead><tr><th></th><th>Продукт</th><th>Нужно</th><th>Есть</th><th>Списать</th></tr></thead>
        <tbody>
          ${rows
            .map(
              (r) => `<tr data-id="${r.id}">
              <td><input type="checkbox" data-on ${r.use > 0 || r.have > 0 ? "checked" : ""} /></td>
              <td><b>${r.name}</b>${r.have < r.need ? `<div class="sk-meta" style="color:var(--hot,#b33)">не хватает</div>` : ""}</td>
              <td>${amountLabel(r.product, r.need)}</td>
              <td>${r.have ? amountLabel(r.product, r.have) : "—"}</td>
              <td><input class="sk-input" type="number" min="0" step="any" data-use value="${r.use}" style="max-width:110px" /></td>
            </tr>`
            )
            .join("")}
        </tbody>
      </table>
    </div>
    <div class="sk-row" style="margin-top:12px">
      <button class="sk-btn sk-btn-primary" id="cook-confirm">Списать и в готовое</button>
      <button class="sk-btn sk-btn-ghost" id="cook-cancel">Отмена</button>
    </div>`;
  openSkModal($("#cookModal"), {
    titleId: "cookModalTitle",
    close: () => closeSkModal($("#cookModal")),
  });
  $("#cook-cancel").onclick = () => closeSkModal($("#cookModal"));
  $("#cook-confirm").onclick = async () => {
    const items = [];
    $$("#cook-deduct-table tbody tr").forEach((tr) => {
      const on = tr.querySelector("[data-on]")?.checked;
      if (!on) return;
      const id = tr.dataset.id;
      const use = Math.max(0, +tr.querySelector("[data-use]")?.value || 0);
      if (!use) return;
      const have = invAmount(state.inventory, id);
      const take = Math.min(have, use);
      if (take <= 0) return;
      state.inventory = setInvAmount(state.inventory, id, have - take);
      items.push({ id, amount: take, name: state.cat.products[id]?.name });
    });
    const portions = Math.max(1, +$("#cook-portions").value || form.servings);
    const form2 = { ...form, servings: portions };
    ensureStockUi().onCooked(d, form2);
    state.events.push(makeEvent({ type: "cook", recipeId: d.id, recipeName: d.name, meal: form.meal, items }));
    await saveInventoryAndSync();
    closeSkModal($("#cookModal"));
    closeRecipeModal();
    toast(items.length ? `Списали ${items.length} поз. · +${portions} порц. в готовое` : `В готовое +${portions} порц. (со запасов ничего)`);
    if (state.screen === "today" || state.screen === "inventory") renderScreen();
  };
}

function mountRecipeView(d, root) {
  if (!root) return;
  root.innerHTML = recipeHtml(d);
  bindRecipeActions(d, root);
}

function openRecipeModal() {
  openSkModal($("#recipeModal"), { titleId: "recipeModalTitle", close: closeRecipeModal });
}
function closeRecipeModal() {
  closeSkModal($("#recipeModal"));
}

function openRecipe(id, showModal = true) {
  const d = dish(id);
  if (!d) return;
  state.selectedRecipe = id;
  $("#recipeModalTitle").textContent = d.name;
  const body = $("#recipeModalBody");
  mountRecipeView(d, body);
  if ($("#recipe-view")) mountRecipeView(d, $("#recipe-view"));
  if (showModal) openRecipeModal();
}

/* ——— STATS ——— */
function destroyCharts() {
  Object.values(state.charts).forEach((c) => c?.destroy?.());
  state.charts = {};
}

function alcoholPlan(s) {
  return s.alcoholBudget ?? (s.wineBudget || 0) + (s.ginBudget || 0);
}
function alcoholFact(b) {
  return b.alcoholSpent ?? (b.wineSpent || 0) + (b.ginSpent || 0);
}

function renderStats() {
  destroyCharts();
  const root = $("#screen-stats");
  const fromDefault = dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const toDefault = dayjs().format("YYYY-MM-DD");
  const vis = state._statVis || { kpis: true, timeline: true, contours: true, meals: true, products: true, cooks: true, costly: true };
  root.innerHTML = `
    <div class="sk-card tone" style="margin-bottom:14px">
      <div class="sk-row">
        <label class="sk-field">С<input class="sk-input" type="date" id="stat-from" value="${state._statFrom || fromDefault}" /></label>
        <label class="sk-field">По<input class="sk-input" type="date" id="stat-to" value="${state._statTo || toDefault}" /></label>
        <button class="sk-btn sk-btn-primary" id="stat-run">Обновить</button>
      </div>
      <div class="stats-toggles" id="stat-toggles">
        ${[
          ["kpis", "Сводка"],
          ["timeline", "По дням"],
          ["contours", "Категории трат"],
          ["meals", "Приёмы пищи"],
          ["products", "Товары"],
          ["costly", "Дорогие"],
          ["cooks", "Готовки"],
        ]
          .map(
            ([k, lab]) =>
              `<label><input type="checkbox" data-vis="${k}" ${vis[k] ? "checked" : ""} /> ${lab}</label>`
          )
          .join("")}
      </div>
      <p class="sk-meta">Категории: готовка · алкоголь · вкусняшки · сладкое/к чаю · прочее. Плюс покрытие ужинов запасами.</p>
    </div>
    <div id="stat-kpis" class="sk-stat-row" style="${vis.kpis ? "" : "display:none"}"></div>
    <div class="sk-grid" style="margin-top:12px">
      <div class="sk-col-6" id="blk-timeline" style="${vis.timeline ? "" : "display:none"}"><div class="sk-card"><h3>Траты по дням</h3><div class="chart-box"><canvas id="chart-timeline"></canvas></div></div></div>
      <div class="sk-col-6" id="blk-contours" style="${vis.contours ? "" : "display:none"}"><div class="sk-card"><h3>Категории расходов</h3><p class="sk-meta">Куда уходят деньги</p><div class="chart-box"><canvas id="chart-cat"></canvas></div><div id="cat-legend" class="sk-meta" style="margin-top:8px"></div></div></div>
      <div class="sk-col-6" id="blk-meals" style="${vis.meals ? "" : "display:none"}"><div class="sk-card"><h3>Приёмы пищи</h3><p class="sk-meta">Сколько раз готовили</p><div class="chart-box"><canvas id="chart-meals"></canvas></div></div></div>
      <div class="sk-col-6" id="blk-meal-spend" style="${vis.meals ? "" : "display:none"}"><div class="sk-card"><h3>Готовка по приёмам ₽</h3><div class="chart-box"><canvas id="chart-meal-spend"></canvas></div></div></div>
      <div class="sk-col-12" id="blk-products" style="${vis.products ? "" : "display:none"}"><div class="sk-card"><h3>Популярные товары</h3><div style="overflow:auto"><table class="sk-table" id="pop-table"><thead><tr><th>#</th><th>Товар</th><th>Раз</th><th>Кол-во</th><th>Сумма</th></tr></thead><tbody></tbody></table></div></div></div>
      <div class="sk-col-12" id="blk-costly" style="${vis.costly ? "" : "display:none"}"><div class="sk-card"><h3>Самые дорогие покупки</h3><div style="overflow:auto"><table class="sk-table" id="costly-table"><thead><tr><th>#</th><th>Товар</th><th>Раз</th><th>Сумма</th></tr></thead><tbody></tbody></table></div></div></div>
      <div class="sk-col-12" id="blk-cooks" style="${vis.cooks ? "" : "display:none"}"><div class="sk-card"><h3>Последние готовки</h3><div id="cook-list"></div></div></div>
    </div>`;

  $$("#stat-toggles [data-vis]").forEach((inp) => {
    inp.onchange = () => {
      state._statVis = state._statVis || { ...vis };
      state._statVis[inp.dataset.vis] = inp.checked;
      renderStats();
    };
  });

  const draw = () => {
    destroyCharts();
    state._statFrom = $("#stat-from").value;
    state._statTo = $("#stat-to").value;
    const ev = filterEvents(state.events, state._statFrom, state._statTo);
    const pop = popularProducts(ev, state.cat.products, 20);
    const cats = spendByCategory(ev);
    const meals = cooksByMeal(ev);
    const timeline = spendTimeline(ev, state._statFrom, state._statTo);
    const sum = totalSpend(ev);
    const cookEv = ev.filter((e) => e.type === "cook");
    const cooks = cookEv.slice(-15).reverse();
    const cov = stockCoverageShare(state.plan, state.cat.dishes, state.cat.products, inventoryAmounts(state.inventory));
    const costly = topExpensiveProducts(ev, state.cat.products, 12);
    if ($("#stat-kpis")) {
      $("#stat-kpis").innerHTML = `
        <div class="sk-stat"><span class="sk-meta">Всего ₽</span><b>${rub(sum)}</b></div>
        <div class="sk-stat"><span class="sk-meta">Покупок</span><b>${ev.filter((e) => e.type === "spend").length}</b></div>
        <div class="sk-stat"><span class="sk-meta">Готовок</span><b>${cookEv.length}</b></div>
        <div class="sk-stat"><span class="sk-meta">Ужины из запасов</span><b>${Math.round(cov.share * 100)}%</b></div>`;
    }
    if (vis.timeline && $("#chart-timeline")) {
      state.charts.timeline = new Chart($("#chart-timeline"), {
        type: "line",
        data: {
          labels: timeline.map((d) => d.label),
          datasets: [{ label: "₽", data: timeline.map((d) => d.total), borderColor: "#1f3a56", backgroundColor: "rgba(31,58,86,.12)", tension: 0.3, fill: true }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
      });
    }
    if (vis.contours && $("#chart-cat")) {
      const keys = ["cooking", "alcohol", "treats", "sweet", "other"];
      const colors = ["#1f3a56", "#8b3a3a", "#2f6b4f", "#c8892a", "#9aa4b2"];
      state.charts.cat = new Chart($("#chart-cat"), {
        type: "doughnut",
        data: {
          labels: keys.map((k) => SPEND_LABELS[k]),
          datasets: [{ data: keys.map((k) => cats[k] || 0), backgroundColor: colors }],
        },
        options: { responsive: true, maintainAspectRatio: false },
      });
      if ($("#cat-legend")) {
        $("#cat-legend").innerHTML = keys
          .map((k) => `<div><b>${SPEND_LABELS[k]}</b> — ${rub(cats[k] || 0)}</div>`)
          .join("");
      }
    }
    if (vis.meals && $("#chart-meals")) {
      const mKeys = ["breakfast", "lunch", "dinner", "snack"];
      state.charts.meals = new Chart($("#chart-meals"), {
        type: "bar",
        data: {
          labels: mKeys.map((k) => SPEND_LABELS[k]),
          datasets: [{ label: "раз", data: mKeys.map((k) => meals[k] || 0), backgroundColor: "#1f3a56" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } } },
      });
    }
    if (vis.meals && $("#chart-meal-spend")) {
      const mKeys = ["breakfast", "lunch", "dinner", "snack"];
      state.charts.mealSpend = new Chart($("#chart-meal-spend"), {
        type: "bar",
        data: {
          labels: mKeys.map((k) => SPEND_LABELS[k]),
          datasets: [{ label: "₽", data: mKeys.map((k) => cats[k] || 0), backgroundColor: "#2f6b4f" }],
        },
        options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, scales: { y: { beginAtZero: true } } },
      });
    }
    if ($("#pop-table tbody")) {
      $("#pop-table tbody").innerHTML =
        pop.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.count}</td><td>${Math.round(p.qty)}</td><td>${rub(p.cost)}</td></tr>`).join("") ||
        `<tr><td colspan="5" class="sk-meta">Нет данных</td></tr>`;
    }
    if ($("#costly-table tbody")) {
      $("#costly-table tbody").innerHTML =
        costly.map((p, i) => `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.count}</td><td>${rub(p.cost)}</td></tr>`).join("") ||
        `<tr><td colspan="4" class="sk-meta">Нет данных</td></tr>`;
    }
    if ($("#cook-list")) {
      const mealLab = SPEND_LABELS;
      $("#cook-list").innerHTML = cooks.length
        ? cooks
            .map(
              (c) =>
                `<div class="shop-item"><div style="flex:1"><b>${c.recipeName || c.recipeId}</b><div class="sk-meta">${dayjs(c.at).format("D MMM HH:mm")}${c.meal ? ` · ${mealLab[c.meal] || c.meal}` : ""}</div></div></div>`
            )
            .join("")
        : `<div class="sk-meta">Пока нет отметок «Приготовил»</div>`;
    }
  };
  $("#stat-run").onclick = draw;
  draw();
}

/* ——— BUDGET ——— */
function purchasesFact() {
  const cats = spendByCategory(state.events || []);
  return {
    cooking: cats.cooking || 0,
    alcohol: cats.alcohol || 0,
    treats: cats.treats || 0,
    sweet: cats.sweet || 0,
    other: cats.other || 0,
  };
}

function renderBudget() {
  const root = $("#screen-budget");
  const s = state.settings;
  const b = state.budget;
  const fromPurchases = purchasesFact();
  const aPlan = alcoholPlan(s);
  const aFact = alcoholFact(b);
  const sweetPlan = s.sweetBudget || 0;
  const sweetFact = b.sweetSpent || 0;
  const totalPlan = (s.cookingBudget || 0) + aPlan + (s.treatsBudget || 0) + sweetPlan;
  const totalFact = (b.cookingSpent || 0) + aFact + (b.treatsSpent || 0) + sweetFact;
  const fc = monthForecast(state.events, totalPlan);
  root.innerHTML = `
    <div class="sk-stat-row">
      <div class="sk-stat"><span class="sk-meta">План месяца</span><b>${rub(totalPlan)}</b></div>
      <div class="sk-stat"><span class="sk-meta">Факт покупок</span><b>${rub(fc.spent)}</b></div>
      <div class="sk-stat"><span class="sk-meta">Прогноз к ${fc.daysInMonth}-му</span><b style="color:${fc.over ? "var(--hot,#b33)" : "inherit"}">${rub(fc.projected)}</b></div>
      <div class="sk-stat"><span class="sk-meta">Можно/день</span><b>${rub(fc.dailyCap)}</b></div>
    </div>
    <div class="sk-card ${fc.over ? "" : "tone"}" style="margin-bottom:12px">
      <p class="sk-meta">${fc.over ? `Темп выше цели: прогноз ${rub(fc.projected)} при плане ${rub(totalPlan)}. Осталось ${fc.daysInMonth - fc.day} дн.` : `Темп ок. Остаток бюджета ~${rub(fc.left)} на ${fc.daysInMonth - fc.day} дн.`}</p>
      <button class="sk-btn sk-btn-accent" id="pull-purchases">Подтянуть факт из покупок</button>
    </div>
    <div class="sk-card">
      <table class="sk-table">
        <thead><tr><th>Статья</th><th>План</th><th>Факт</th><th>Из покупок</th><th>+ корректировка</th></tr></thead>
        <tbody>
          <tr><td>Готовка</td><td>${rub(s.cookingBudget)}</td><td>${rub(b.cookingSpent)}</td><td>${rub(fromPurchases.cooking)}</td><td><input class="sk-input" type="number" id="add-cooking" /></td></tr>
          <tr><td>Алкоголь</td><td>${rub(aPlan)}</td><td>${rub(aFact)}</td><td>${rub(fromPurchases.alcohol)}</td><td><input class="sk-input" type="number" id="add-alcohol" /></td></tr>
          <tr><td>Вкусняшки</td><td>${rub(s.treatsBudget)}</td><td>${rub(b.treatsSpent)}</td><td>${rub(fromPurchases.treats)}</td><td><input class="sk-input" type="number" id="add-treats" /></td></tr>
          <tr><td>Сладкое / к чаю</td><td>${rub(sweetPlan)}</td><td>${rub(sweetFact)}</td><td>${rub(fromPurchases.sweet)}</td><td><input class="sk-input" type="number" id="add-sweet" /></td></tr>
        </tbody>
      </table>
      <div class="sk-row" style="margin-top:12px">
        <button class="sk-btn sk-btn-primary" id="save-budget">Сохранить корректировку</button>
        <button class="sk-btn sk-btn-ghost" id="reset-budget">Сбросить факт</button>
      </div>
    </div>`;
  $("#pull-purchases").onclick = async () => {
    state.budget.cookingSpent = fromPurchases.cooking;
    state.budget.alcoholSpent = fromPurchases.alcohol;
    state.budget.treatsSpent = fromPurchases.treats;
    state.budget.sweetSpent = fromPurchases.sweet;
    state.budget.wineSpent = 0;
    state.budget.ginSpent = 0;
    await persistLocal();
    toast("Факт = сумма покупок из журнала");
    renderBudget();
  };
  $("#save-budget").onclick = async () => {
    const add = async (sel, key, category) => {
      const v = parseFloat($(sel).value) || 0;
      if (!v) return;
      state.budget[key] = (state.budget[key] || 0) + v;
      state.events.push(makeEvent({ type: "spend", category, total: v, items: [] }));
    };
    await add("#add-cooking", "cookingSpent", "cooking");
    await add("#add-alcohol", "alcoholSpent", "alcohol");
    await add("#add-treats", "treatsSpent", "treats");
    await add("#add-sweet", "sweetSpent", "sweet");
    await persistLocal();
    toast("Корректировка сохранена");
    renderBudget();
  };
  $("#reset-budget").onclick = async () => {
    state.budget = defaultBudgetLedger();
    await persistLocal();
    renderBudget();
  };
}

/* ——— SYNC ——— */
function renderSync() {
  const root = $("#screen-sync");
  const rem = state.settings.reminders || { enabled: true, hour: 20, minute: 0 };
  root.innerHTML = `
    <div class="sk-hero"><h1>Облако семьи</h1><p>Сохранения уходят сами. ПК не нужен.</p></div>
    <div class="sk-ok"><b>Ничего настраивать не нужно.</b> Запасы, план, покупки и бюджет синхронизируются через Cloudflare.</div>
    <div class="sk-card" style="margin-bottom:12px">
      <h3 style="margin-top:0">Напоминания</h3>
      <p class="sk-meta">Вечером локальное уведомление: обновить запасы и покупки. Работает в установленном PWA (добавить на экран).</p>
      <label class="sk-field"><input type="checkbox" id="rem-on" ${rem.enabled !== false ? "checked" : ""} /> Включить вечернее напоминание</label>
      <label class="sk-field">Час (0–23)<input class="sk-input" type="number" min="0" max="23" id="rem-hour" value="${rem.hour ?? 20}" /></label>
      <div class="sk-row" style="margin-top:8px">
        <button class="sk-btn sk-btn-accent" id="rem-save">Сохранить</button>
        <button class="sk-btn sk-btn-ghost" id="rem-perm">Разрешить уведомления</button>
        <button class="sk-btn sk-btn-ghost" id="rem-test">Тест сейчас</button>
      </div>
      <p class="sk-meta">Статус разрешения: ${"Notification" in window ? Notification.permission : "нет поддержки"}</p>
    </div>
    <div class="sk-card">
      <p class="sk-meta">API: ${APP_CONFIG.apiBase}</p>
      <p class="sk-meta">Семья: ${APP_CONFIG.familyKey} · устройство ${deviceId()}</p>
      <p class="sk-meta">Последнее сохранение: ${state.syncAt ? dayjs(state.syncAt).format("DD.MM.YYYY HH:mm") : "—"}</p>
      <p class="sk-meta">Статус: ${state.syncError || "ок"}</p>
      <div class="sk-row">
        <button class="sk-btn sk-btn-primary" id="btn-pull">Обновить сейчас</button>
        <button class="sk-btn sk-btn-ghost" id="btn-health">Проверить облако</button>
      </div>
      <h3 style="margin-top:18px">Резервная копия</h3>
      <div class="sk-row">
        <button class="sk-btn sk-btn-ghost" id="export-data">Экспорт JSON</button>
        <button class="sk-btn sk-btn-ghost" id="import-data">Импорт JSON</button>
        <input type="file" id="import-file" accept="application/json" hidden />
      </div>
    </div>`;
  $("#rem-save").onclick = async () => {
    state.settings.reminders = {
      enabled: $("#rem-on").checked,
      hour: Math.max(0, Math.min(23, +$("#rem-hour").value || 20)),
      minute: 0,
    };
    await persistLocal();
    toast("Напоминание сохранено");
  };
  $("#rem-perm").onclick = async () => {
    const p = await ensureNotifyPermission();
    toast(p === "granted" ? "Разрешено" : `Статус: ${p}`);
    renderSync();
  };
  $("#rem-test").onclick = async () => {
    await ensureNotifyPermission();
    const storeKey = "sk_reminders";
    try {
      localStorage.setItem(storeKey, JSON.stringify({}));
    } catch {}
    const ok = await maybeEveningReminder({ ...state.settings, reminders: { enabled: true, hour: 0, minute: 0 } });
    toast(ok ? "Уведомление отправлено" : "Не удалось (нужно разрешение)");
  };

  $("#btn-pull").onclick = async () => {
    try {
      await syncPull(true);
      toast("Обновлено из облака");
      renderScreen();
    } catch (e) {
      toast(e.message);
    }
  };
  $("#btn-health").onclick = async () => {
    try {
      const h = await healthCloud();
      toast(h.ok ? "Облако онлайн, ПК не нужен" : "Проблема");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#export-data").onclick = async () => {
    const all = await dbExportAll();
    all.inventory = state.inventory;
    all.events = state.events;
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `semejnoe-backup-${dayjs().format("YYYY-MM-DD")}.json`;
    a.click();
  };
  $("#import-data").onclick = () => $("#import-file").click();
  $("#import-file").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const data = JSON.parse(await file.text());
    await dbImportAll(data);
    await loadLocal();
    await persistLocal();
    toast("Импорт готов и ушёл в облако");
    renderScreen();
  };
}

/* ——— boot ——— */
async function boot() {
  if (!window.APP_DATA) {
    document.body.innerHTML = `<div class="p-4">Не загрузился data/app-data.js</div>`;
    return;
  }
  state.data = window.APP_DATA;
  state.cat = indexCatalog(state.data);
  await loadLocal();

  $("#modal-close")?.addEventListener("click", closeRecipeModal);
  $("#recipeModal")?.addEventListener("click", (e) => {
    if (e.target.id === "recipeModal") closeRecipeModal();
  });
  $("#product-modal-close")?.addEventListener("click", () => ensureStockUi().closeProductModal());
  $("#productModal")?.addEventListener("click", (e) => {
    if (e.target.id === "productModal") ensureStockUi().closeProductModal();
  });
  $("#day-modal-close")?.addEventListener("click", () => closeSkModal($("#dayModal")));
  $("#dayModal")?.addEventListener("click", (e) => {
    if (e.target.id === "dayModal") closeSkModal($("#dayModal"));
  });
  $("#cook-modal-close")?.addEventListener("click", () => closeSkModal($("#cookModal")));
  $("#cookModal")?.addEventListener("click", (e) => {
    if (e.target.id === "cookModal") closeSkModal($("#cookModal"));
  });

  $$("#nav-list [data-screen]").forEach((b) => {
    b.onclick = () => setScreen(b.dataset.screen);
  });
  $$("#tabbar [data-screen]").forEach((b) => {
    b.onclick = () => setScreen(b.dataset.screen);
  });
  $("#tabbar [data-more]")?.addEventListener("click", () => openMoreSheet());
  $$("#more-sheet [data-close-more]").forEach((b) => {
    b.onclick = () => closeMoreSheet();
  });
  $$("#more-sheet [data-screen]").forEach((b) => {
    b.onclick = () => setScreen(b.dataset.screen);
  });

  state.settings.profile = "command";
  updateSyncBadge();
  const bootScreen = new URLSearchParams(location.search).get("screen") || "today";
  setScreen(["today", "plan", "period", "inventory", "basket", "recipes", "stats", "budget", "sync"].includes(bootScreen) ? bootScreen : "today");

  initReminders(state.settings).catch(() => {});
  navigator.serviceWorker?.addEventListener("message", (e) => {
    if (e.data?.type === "open-screen" && e.data.screen) setScreen(e.data.screen);
  });

  syncPull(true)
    .then(() => {
      renderScreen();
    })
    .catch(() => {});

  setInterval(() => {
    if (document.visibilityState === "visible") {
      syncPull(true)
        .then(() => {
          if (isTyping()) return;
          if (["inventory", "plan", "today"].includes(state.screen)) renderScreen();
        })
        .catch(() => {});
      maybeEveningReminder(state.settings);
    }
  }, APP_CONFIG.pollMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncPull(true)
        .then(() => {
          if (!isTyping()) renderScreen();
        })
        .catch(() => {});
      maybeEveningReminder(state.settings);
    }
  });
}

boot();
