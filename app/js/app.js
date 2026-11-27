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
  matchFromInventory,
  buildBasket,
  draftWeekPlan,
  estimatePlanCost,
  planDayIndex,
  slotsFromPlan,
  basketToText,
  scaleIngredients,
  placeRecipeInPlan,
  daysRu,
  banForMonth,
  isBanned,
  familyServings,
} from "./engine.js";
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
  dayjs,
} from "./stats.js";

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

async function loadLocal() {
  state.settings = { ...defaultSettings(), ...(await dbGet("settings", {})) };
  state.inventory = (await dbGet("inventory", {})) || {};
  state.events = (await dbGet("events", [])) || [];
  state.weekNum = (await dbGet("weekNum", 1)) || 1;
  state.budget = { ...defaultBudgetLedger(), ...(await dbGet("budget", {})) };
  const savedPlan = await dbGet("plan", null);
  state.plan = savedPlan?.length ? savedPlan : draftWeekPlan(state.data, state.settings, state.weekNum);
}

function dish(id) {
  return state.cat.dishes[id];
}

function updateSyncBadge() {
  const el = $("#sync-badge");
  if (!el) return;
  if (state.syncError) {
    el.textContent = "офлайн";
    el.className = "sk-pill";
    return;
  }
  el.textContent = state.syncAt ? `облако ${dayjs(state.syncAt).format("HH:mm")}` : "облако";
  el.className = "sk-pill ok";
}

async function syncPull(preferCloud = true) {
  try {
    const cloud = await pullCloud();
    if (preferCloud) {
      if (cloud.inventory) state.inventory = { ...cloud.inventory };
      if (cloud.plan?.length) state.plan = cloud.plan;
      if (cloud.settings) state.settings = { ...state.settings, ...cloud.settings };
      if (cloud.budget) state.budget = { ...state.budget, ...cloud.budget };
      if (cloud.weekNum) state.weekNum = cloud.weekNum;
    }
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

function applyProfile() {
  document.body.classList.toggle("profile-kitchen", state.settings.profile === "kitchen");
  document.body.classList.toggle("profile-command", state.settings.profile === "command");
  $$("[data-profile]").forEach((b) => b.classList.toggle("active", b.dataset.profile === state.settings.profile));
  if (state.settings.profile === "kitchen" && ["budget", "stats"].includes(state.screen)) {
    state.screen = "today";
  }
}

function setScreen(name) {
  state.screen = name;
  $$("#nav-list [data-screen]").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  $$(".sk-panel").forEach((p) => p.classList.toggle("active", p.id === `screen-${name}`));
  renderScreen();
}

function renderScreen() {
  applyProfile();
  ({
    today: renderToday,
    plan: renderPlan,
    inventory: renderInventory,
    basket: renderBasket,
    recipes: renderRecipes,
    stats: renderStats,
    budget: renderBudget,
    sync: renderSync,
  })[state.screen]?.();
}

/* ——— TODAY ——— */
function renderToday() {
  const idx = planDayIndex(state.plan);
  const day = state.plan[idx];
  const root = $("#screen-today");
  if (!day) {
    root.innerHTML = `<div class="sk-note">Плана нет — откройте «План» или добавьте блюдо из «Рецепты».</div>`;
    return;
  }
  const meals = [
    ["Завтрак", "breakfast", day.breakfast],
    ["Обед", "lunch", day.lunch],
    ["Ужин", "dinner", day.dinner],
    ["Перекус", "snack", day.snacks?.[0]],
    ["Перекус 2", "snack", day.snacks?.[1]],
  ];
  root.innerHTML = `
    <div class="sk-hero">
      <div class="sk-chip-row">
        <span class="sk-tag hot">Неделя ${state.weekNum}</span>
        <span class="sk-tag">${day.dayName} · день ${idx + 1}/7</span>
      </div>
      <h1>${day.dayName}: что едим</h1>
      <p>${day.cookHint || "Откройте блюдо или добавьте своё из раздела Рецепты."}</p>
    </div>
    <div class="sk-grid" id="today-meals"></div>
    <div class="sk-row" style="margin-top:16px">
      <button class="sk-btn sk-btn-accent" id="btn-cook-dinner">Готовлю ужин</button>
      <button class="sk-btn sk-btn-ghost" id="btn-swap-dinner">Заменить ужин</button>
      <button class="sk-btn sk-btn-ghost" id="btn-add-recipe">Добавить блюдо в план</button>
      <button class="sk-btn sk-btn-ghost" id="btn-from-inv">Из запасов</button>
    </div>`;
  const box = $("#today-meals");
  meals.forEach(([label, mealKey, id]) => {
    const d = dish(id);
    if (!d) return;
    const meta = day.meta?.[mealKey];
    const col = document.createElement("div");
    col.className = "sk-col-4";
    col.innerHTML = `<div class="sk-meal"><b>${label}</b><div><div style="font-weight:750">${d.name}</div><div class="sk-meta">${d.timeMin} мин · ${d.category}${meta ? ` · ${meta.people || "?"} чел · ${daysRu(meta.batchDays || 1)}` : ` · ${daysRu(d.batchDays)}`}</div></div><div class="price">~${rub(d.costPerServing)}</div></div>`;
    col.querySelector(".sk-meal").onclick = () => openRecipe(id);
    box.appendChild(col);
  });
  $("#btn-cook-dinner").onclick = () => openRecipe(day.dinner);
  $("#btn-swap-dinner").onclick = () => swapMeal(idx, "dinner");
  $("#btn-add-recipe").onclick = () => setScreen("recipes");
  $("#btn-from-inv").onclick = () => setScreen("inventory");
}

async function swapMeal(dayIndex, mealKey) {
  const day = state.plan[dayIndex];
  const current = dish(day[mealKey]);
  if (!current) return;
  const alts = state.data.dishes.filter(
    (d) =>
      d.type === current.type &&
      d.id !== current.id &&
      !state.settings.disliked.includes(d.id) &&
      !isBanned(d.id, state.settings)
  );
  if (!alts.length) return toast("Нет замен");
  const pick = alts[Math.floor(Math.random() * Math.min(5, alts.length))];
  day[mealKey] = pick.id;
  await persistLocal();
  toast(`Заменили на: ${pick.name}`);
  renderScreen();
}

/* ——— PLAN ——— */
function renderPlan() {
  const root = $("#screen-plan");
  const cost = estimatePlanCost(state.plan, state.cat.dishes);
  const monthCap = Math.round((state.settings.cookingBudget || 32000) / 4);
  const over = cost > monthCap;
  root.innerHTML = `
    <div class="sk-hero">
      <h1>План недели</h1>
      <p>Авточерновик или ручная сборка: люди, порции, на сколько дней готовите сразу.</p>
    </div>
    <div class="sk-forecast ${over ? "warn" : ""}">
      <div>
        <div class="sk-meta">Прогноз готовки на неделю</div>
        <div class="sk-kpi">${rub(cost)}</div>
      </div>
      <div>
        <div class="sk-meta">Ориентир ~¼ месячного лимита</div>
        <div class="sk-kpi" style="font-size:1.2rem">${rub(monthCap)}</div>
      </div>
      <p class="sk-meta" style="grid-column:1/-1;margin:0">${over ? "Выше ориентира — упростите ужин или замените рыбу/мясо." : "В пределах ориентира. Корзина считает только отмеченные слоты."}</p>
    </div>
    <div class="sk-row">
      <label class="sk-field">Неделя шаблона
        <select class="sk-select" id="week-select">
          ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.weekNum === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}
        </select>
      </label>
      <button class="sk-btn sk-btn-primary" id="gen-week">Авточерновик</button>
      <button class="sk-btn sk-btn-ghost" id="to-basket-week">В корзину</button>
      <button class="sk-btn sk-btn-accent" id="to-recipes">Добавить блюдо</button>
    </div>
    <div class="sk-grid" id="plan-grid"></div>`;
  $("#week-select").onchange = (e) => (state.weekNum = +e.target.value);
  $("#gen-week").onclick = async () => {
    state.plan = draftWeekPlan(state.data, state.settings, state.weekNum);
    await persistLocal();
    toast("Неделя пересобрана");
    renderPlan();
  };
  $("#to-basket-week").onclick = () => setScreen("basket");
  $("#to-recipes").onclick = () => setScreen("recipes");
  const grid = $("#plan-grid");
  state.plan.forEach((day, idx) => {
    const col = document.createElement("div");
    col.className = "sk-col-4";
    const today = idx === planDayIndex(state.plan);
    col.innerHTML = `<div class="sk-card ${today ? "tone" : ""}"><div class="sk-row" style="margin:0 0 8px;justify-content:space-between;align-items:center"><h2 style="margin:0;font-size:1.15rem">${day.dayName}${today ? " · сегодня" : ""}</h2><button class="sk-btn sk-btn-ghost" data-swap style="min-height:40px">Не хочу ужин</button></div><p class="sk-meta">${day.cookHint || ""}</p><div data-meals></div></div>`;
    const mealsBox = col.querySelector("[data-meals]");
    ["breakfast", "lunch", "dinner"].forEach((key) => {
      const d = dish(day[key]);
      if (!d) return;
      const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
      const meta = day.meta?.[key];
      const row = document.createElement("div");
      row.className = "sk-meal";
      row.style.marginTop = "8px";
      const span = meta?.batchDays || d.batchDays || 1;
      row.innerHTML = `<b>${labels[key]}</b><div><div style="font-weight:750">${d.name}</div><div class="sk-meta">${meta ? `${meta.people || "?"} чел · ${daysRu(span)} · ${meta.servings || "?"} порц` : daysRu(span)}</div></div><div class="price">${span > 1 ? daysRu(span) : "~1 д"}</div>`;
      row.onclick = () => openRecipe(d.id);
      mealsBox.appendChild(row);
    });
    col.querySelector("[data-swap]").onclick = async (e) => {
      e.stopPropagation();
      state.settings.bannedUntil = banForMonth(state.settings, day.dinner, 30);
      if (!state.settings.disliked.includes(day.dinner)) state.settings.disliked.push(day.dinner);
      await swapMeal(idx, "dinner");
      await persistLocal();
    };
    grid.appendChild(col);
  });
}

/* ——— INVENTORY ——— */
const QUICK = [
  ["chicken_cheap", 1000],
  ["egg", 10],
  ["potato", 2000],
  ["onion", 500],
  ["carrot", 500],
  ["milk", 1000],
  ["tvorog", 400],
  ["buckwheat", 800],
  ["rice", 800],
  ["pasta", 500],
  ["mince_cheap", 500],
  ["pollock", 500],
  ["cabbage", 1000],
  ["butter", 180],
  ["sourcream", 300],
];

const ZONE_LABEL = { fridge: "Холодильник", freezer: "Морозилка", pantry: "Кладовка" };

function guessZone(p) {
  const z = state.settings.invZones?.[p.id];
  if (z) return z;
  if (p.store === "parnoe" || /mince|chicken|pork|beef|pollock|sole|tilapia|salmon|liver/.test(p.id)) return "freezer";
  if (/milk|kefir|sourcream|tvorog|butter|cheese|egg|dill/.test(p.id)) return "fridge";
  return "pantry";
}

function renderInventory() {
  const root = $("#screen-inventory");
  const stocked = state.data.products.filter((p) => (state.inventory[p.id] || 0) > 0);
  const filter = state._invFilter || "all";
  const q = (state._invQ || "").trim().toLowerCase();

  root.innerHTML = `
    <div class="sk-hero">
      <h1>Запасы</h1>
      <p>Общие для семьи. Плюс — быстро дописать; зона (холодильник / морозилка / кладовка) — чтобы видеть, куда класть покупку из Парного мяса.</p>
    </div>
    <div class="sk-stat-row">
      <div class="sk-stat"><span class="sk-meta">Позиций дома</span><b>${stocked.length}</b></div>
      <div class="sk-stat"><span class="sk-meta">Морозилка</span><b>${stocked.filter((p) => guessZone(p) === "freezer").length}</b></div>
      <div class="sk-stat"><span class="sk-meta">Холодильник</span><b>${stocked.filter((p) => guessZone(p) === "fridge").length}</b></div>
    </div>
    <div class="sk-card tone" style="margin-bottom:14px">
      <div class="sk-meta" style="margin-bottom:8px">Быстро добавить</div>
      <div class="sk-chip-row" id="quick"></div>
      <div class="sk-row">
        <label class="sk-field" style="flex:1;min-width:180px">Поиск
          <input class="sk-input" id="inv-q" placeholder="курица, гречка…" value="${state._invQ || ""}" />
        </label>
        <label class="sk-field">Зона
          <select class="sk-select" id="inv-zone-f">
            <option value="all" ${filter === "all" ? "selected" : ""}>Все</option>
            <option value="fridge" ${filter === "fridge" ? "selected" : ""}>Холодильник</option>
            <option value="freezer" ${filter === "freezer" ? "selected" : ""}>Морозилка</option>
            <option value="pantry" ${filter === "pantry" ? "selected" : ""}>Кладовка</option>
            <option value="have" ${filter === "have" ? "selected" : ""}>Только что есть</option>
          </select>
        </label>
        <label class="sk-field">Подбор блюд
          <select class="sk-select" id="match-mode">
            <option value="almost">Почти хватает</option>
            <option value="strict">Всё есть</option>
          </select>
        </label>
        <button class="sk-btn sk-btn-primary" id="run-match">Что можно приготовить</button>
        <button class="sk-btn sk-btn-ghost" id="clear-inv">Сбросить</button>
      </div>
    </div>
    <div class="inv-grid" id="inv-grid"></div>
    <div class="sk-grid" id="match-results" style="margin-top:16px"></div>`;

  QUICK.forEach(([id, amt]) => {
    const p = state.cat.products[id];
    if (!p) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "sk-chip";
    b.textContent = `+ ${p.name}`;
    b.onclick = async () => {
      state.inventory[id] = (state.inventory[id] || 0) + amt;
      if (!state.settings.invZones) state.settings.invZones = {};
      if (!state.settings.invZones[id]) state.settings.invZones[id] = guessZone(p);
      await saveInventoryAndSync();
      renderInventory();
      toast(`+ ${p.name}`);
    };
    $("#quick").appendChild(b);
  });

  let list = state.data.products.slice();
  if (state.settings.profile === "kitchen" && filter !== "all") {
    list = list.filter((p) => (state.inventory[p.id] || 0) > 0 || QUICK.some(([id]) => id === p.id));
  }
  if (filter === "have") list = list.filter((p) => (state.inventory[p.id] || 0) > 0);
  else if (filter !== "all") list = list.filter((p) => guessZone(p) === filter);
  if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || p.id.includes(q));

  const grid = $("#inv-grid");
  list.forEach((p) => {
    const have = state.inventory[p.id] || 0;
    const zone = guessZone(p);
    const card = document.createElement("div");
    card.className = `inv-card ${have ? "has" : ""}`;
    card.innerHTML = `
      <div class="inv-card-top">
        <strong>${p.name}</strong>
        <select class="sk-zone" data-zone="${p.id}" aria-label="Зона">
          ${Object.entries(ZONE_LABEL)
            .map(([k, lab]) => `<option value="${k}" ${zone === k ? "selected" : ""}>${lab}</option>`)
            .join("")}
        </select>
      </div>
      <div class="inv-card-amt">
        <button type="button" data-minus="1" aria-label="меньше">−</button>
        <input type="number" min="0" step="any" data-pid="${p.id}" value="${have || ""}" placeholder="0" />
        <button type="button" data-plus="1" aria-label="больше">+</button>
        <span class="sk-meta">${p.unit === "pcs" ? "шт" : p.unit === "ml" ? "мл" : "г"}</span>
      </div>
      <div class="sk-meta">${storeName(state.data.stores, p.store)}</div>`;
    const inp = card.querySelector("input");
    const step = p.unit === "pcs" ? 1 : p.unit === "ml" ? 100 : 100;
    card.querySelector("[data-minus]").onclick = async () => {
      const v = Math.max(0, (parseFloat(inp.value) || 0) - step);
      inp.value = v || "";
      await commitInvInput(inp);
    };
    card.querySelector("[data-plus]").onclick = async () => {
      inp.value = String((parseFloat(inp.value) || 0) + step);
      await commitInvInput(inp);
    };
    inp.onchange = () => commitInvInput(inp);
    card.querySelector("[data-zone]").onchange = async (e) => {
      if (!state.settings.invZones) state.settings.invZones = {};
      state.settings.invZones[p.id] = e.target.value;
      await persistLocal();
    };
    grid.appendChild(card);
  });

  $("#inv-q").oninput = (e) => {
    state._invQ = e.target.value;
    clearTimeout(state._invQTimer);
    state._invQTimer = setTimeout(() => renderInventory(), 180);
  };
  $("#inv-zone-f").onchange = (e) => {
    state._invFilter = e.target.value;
    renderInventory();
  };
  $("#match-mode").value = state.matchMode;
  $("#match-mode").onchange = (e) => (state.matchMode = e.target.value);
  $("#run-match").onclick = () => runMatch();
  $("#clear-inv").onclick = async () => {
    if (!confirm("Обнулить все запасы?")) return;
    state.inventory = {};
    await saveInventoryAndSync();
    renderInventory();
  };
}

async function commitInvInput(inp) {
  const v = parseFloat(inp.value);
  if (!v) delete state.inventory[inp.dataset.pid];
  else state.inventory[inp.dataset.pid] = v;
  await saveInventoryAndSync();
}

function runMatch() {
  const results = matchFromInventory(state.data.dishes, state.cat.products, state.inventory, state.settings, {
    minServings: 2,
    mode: state.matchMode,
  }).slice(0, 18);
  const box = $("#match-results");
  if (!box) return;
  box.innerHTML = results.length
    ? ""
    : `<div class="sk-col-12"><div class="sk-note">Ничего не подобрали — добавьте запасы или ослабьте режим подбора.</div></div>`;
  results.forEach((r) => {
    const col = document.createElement("div");
    col.className = "sk-col-4";
    col.innerHTML = `
      <button type="button" class="sk-match">
        <strong>${r.dish.name}</strong>
        <span class="sk-meta">${r.why} · ${Math.round(r.coverage * 100)}% · ~${r.portions || "?"} порц · ${daysRu(r.dish.batchDays)}</span>
        ${
          r.missing.length
            ? `<span class="sk-tag hot">док. ${r.missing
                .map((m) => m.name)
                .slice(0, 3)
                .join(", ")}</span>`
            : `<span class="sk-tag ok">можно готовить</span>`
        }
      </button>`;
    col.querySelector("button").onclick = () => openRecipe(r.dish.id);
    box.appendChild(col);
  });
}

/* ——— BASKET + shopping list + treats ——— */
function ensureBasketPick() {
  if (!state.settings.basketPick) {
    state.settings.basketPick = {
      days: [0, 1, 2, 3, 4, 5, 6],
      meals: { breakfast: true, lunch: true, dinner: true },
    };
  }
  if (!Array.isArray(state.settings.shoppingList)) state.settings.shoppingList = [];
  if (!Array.isArray(state.settings.treats)) state.settings.treats = [];
  return state.settings.basketPick;
}

function uid() {
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function renderBasket() {
  const root = $("#screen-basket");
  const pick = ensureBasketPick();
  const tab = state._basketTab || "plan";
  const slots = slotsFromPlan(state.plan, state.cat.dishes, pick);
  const basket = buildBasket(slots, state.cat.dishes, state.cat.products, state.inventory);
  const buyCount = Object.values(basket.byStore).reduce((s, g) => s + g.lines.length, 0);
  const listOpen = (state.settings.shoppingList || []).filter((x) => !x.done).length;
  const weekStart = dayjs().subtract(7, "day");
  const treatsWeek = (state.settings.treats || []).filter((t) => dayjs(t.at).isAfter(weekStart));
  const treatsSum = treatsWeek.reduce((s, t) => s + (t.cost || 0), 0);
  const treatsCap = state.settings.treatsWeekly || 2500;

  root.innerHTML = `
    <div class="sk-hero">
      <h1>Корзина</h1>
      <p>Из отмеченных слотов плана — что докупить. Список — свободные пункты «купи то-то» для магазина. Вкусняшки — лимит на неделю.</p>
    </div>
    <div class="sk-seg sk-seg-wide" id="basket-tabs">
      <button type="button" data-tab="plan" class="${tab === "plan" ? "active" : ""}">Из плана</button>
      <button type="button" data-tab="list" class="${tab === "list" ? "active" : ""}">Список${listOpen ? ` · ${listOpen}` : ""}</button>
      <button type="button" data-tab="treats" class="${tab === "treats" ? "active" : ""}">Вкусняшки</button>
    </div>
    <div id="basket-body"></div>`;

  $$("#basket-tabs [data-tab]").forEach((b) => {
    b.onclick = () => {
      state._basketTab = b.dataset.tab;
      renderBasket();
    };
  });

  const body = $("#basket-body");
  if (tab === "list") return renderShopList(body);
  if (tab === "treats") return renderTreats(body, treatsWeek, treatsSum, treatsCap);

  const dayNames = state.plan.map((d) => d.dayName);
  body.innerHTML = `
    <div class="sk-stat-row">
      <div class="sk-stat"><span class="sk-meta">Докупить</span><b>${rub(basket.total)}</b></div>
      <div class="sk-stat"><span class="sk-meta">Позиций</span><b>${buyCount}</b></div>
      <div class="sk-stat"><span class="sk-meta">Уже есть</span><b>${basket.lines.filter((l) => l.covered).length}</b></div>
    </div>
    <div class="sk-card" style="margin-bottom:14px">
      <div class="sk-meta" style="margin-bottom:8px">Какие слоты включить в закупку</div>
      <div class="sk-chip-row" id="pick-days"></div>
      <div class="sk-chip-row" id="pick-meals"></div>
    </div>
    <div class="sk-row" style="margin-bottom:12px">
      <button class="sk-btn sk-btn-primary" id="copy-basket">Скопировать текст</button>
      <button class="sk-btn sk-btn-accent" id="mark-bought">Купили — в запасы</button>
      <button class="sk-btn sk-btn-ghost" id="to-list-merge">Перенести в список</button>
    </div>
    <div class="store-cols" id="basket-stores"></div>`;

  dayNames.forEach((name, i) => {
    const on = pick.days.includes(i);
    const b = document.createElement("button");
    b.type = "button";
    b.className = `sk-chip ${on ? "on" : ""}`;
    b.textContent = name;
    b.onclick = async () => {
      if (on) pick.days = pick.days.filter((d) => d !== i);
      else pick.days = [...pick.days, i].sort((a, b) => a - b);
      state.settings.basketPick = pick;
      await persistLocal();
      renderBasket();
    };
    $("#pick-days").appendChild(b);
  });
  [
    ["breakfast", "Завтраки"],
    ["lunch", "Обеды"],
    ["dinner", "Ужины"],
  ].forEach(([key, lab]) => {
    const on = pick.meals[key] !== false;
    const b = document.createElement("button");
    b.type = "button";
    b.className = `sk-chip ${on ? "on" : ""}`;
    b.textContent = lab;
    b.onclick = async () => {
      pick.meals[key] = !on;
      state.settings.basketPick = pick;
      await persistLocal();
      renderBasket();
    };
    $("#pick-meals").appendChild(b);
  });

  const storesBox = $("#basket-stores");
  if (!buyCount) {
    storesBox.innerHTML = `<div class="sk-note">По выбранным слотам докупать нечего — либо всё есть в запасах, либо снимите/добавьте дни выше.</div>`;
  }
  for (const [storeId, group] of Object.entries(basket.byStore)) {
    const col = document.createElement("div");
    col.className = "store-block";
    col.innerHTML = `
      <div class="store-head">
        <h3>${storeName(state.data.stores, storeId)}</h3>
        <span class="sk-kpi" style="font-size:1.15rem">${rub(group.total)}</span>
      </div>
      <ul class="shop-lines"></ul>`;
    const ul = col.querySelector("ul");
    group.lines.forEach((l) => {
      const li = document.createElement("li");
      li.innerHTML = `<span><b>${l.name}</b>${l.note ? `<small>${l.note}</small>` : ""}</span><span>${amountLabel(state.cat.products[l.id], l.buy)}</span><span>${rub(l.cost)}</span>`;
      ul.appendChild(li);
    });
    storesBox.appendChild(col);
  }

  $("#copy-basket").onclick = async () => {
    const text = basketToText(basket, state.data.stores);
    try {
      await navigator.clipboard.writeText(text);
      toast("Скопировано");
    } catch {
      prompt("Скопируйте:", text);
    }
  };
  $("#mark-bought").onclick = async () => {
    const items = basket.lines
      .filter((l) => !l.covered)
      .map((l) => ({ id: l.id, name: l.name, buy: l.buy, amount: l.buy, cost: l.cost }));
    if (!items.length) return toast("Нечего отмечать");
    state.events.push(makeEvent({ type: "spend", category: "cooking", total: Math.round(basket.total), items }));
    state.budget.cookingSpent = (state.budget.cookingSpent || 0) + Math.round(basket.total);
    items.forEach((it) => {
      state.inventory[it.id] = (state.inventory[it.id] || 0) + (it.buy || 0);
    });
    await persistLocal();
    toast(`Покупка ${rub(basket.total)} → запасы`);
    renderBasket();
  };
  $("#to-list-merge").onclick = async () => {
    const lines = basket.lines.filter((l) => !l.covered);
    lines.forEach((l) => {
      state.settings.shoppingList.push({
        id: uid(),
        text: `${l.name} — ${amountLabel(state.cat.products[l.id], l.buy)}`,
        done: false,
        store: l.store,
        at: new Date().toISOString(),
      });
    });
    state._basketTab = "list";
    await persistLocal();
    toast(`В список: ${lines.length} поз.`);
    renderBasket();
  };
}

function renderShopList(body) {
  const items = state.settings.shoppingList || [];
  body.innerHTML = `
    <div class="sk-card tone" style="margin-bottom:14px">
      <h2 style="margin-top:0">Список в магазин</h2>
      <p class="sk-meta">Жена пишет пункты — муж видит на телефоне в облаке. Как в мессенджере, но здесь.</p>
      <div class="shop-add">
        <input class="sk-input sk-input-lg" id="shop-text" placeholder="Молоко 2л, хлеб, салфетки…" />
        <button class="sk-btn sk-btn-accent" id="shop-add">Добавить</button>
      </div>
    </div>
    <div class="shop-list" id="shop-list"></div>
    <div class="sk-row" style="margin-top:12px">
      <button class="sk-btn sk-btn-ghost" id="shop-clear-done">Убрать купленное</button>
      <button class="sk-btn sk-btn-ghost" id="shop-copy">Скопировать открытые</button>
    </div>`;

  const box = $("#shop-list");
  if (!items.length) {
    box.innerHTML = `<div class="sk-note">Список пуст. Добавьте первое — например «бананы 1 кг».</div>`;
  }
  items.forEach((it) => {
    const row = document.createElement("div");
    row.className = `shop-item ${it.done ? "done" : ""}`;
    row.innerHTML = `
      <button type="button" class="shop-check" aria-label="готово">${it.done ? "✓" : ""}</button>
      <input class="shop-edit" value="${(it.text || "").replace(/"/g, "&quot;")}" />
      <button type="button" class="shop-del" aria-label="удалить">×</button>`;
    row.querySelector(".shop-check").onclick = async () => {
      it.done = !it.done;
      await persistLocal();
      renderBasket();
    };
    row.querySelector(".shop-edit").onchange = async (e) => {
      it.text = e.target.value.trim();
      await persistLocal();
    };
    row.querySelector(".shop-del").onclick = async () => {
      state.settings.shoppingList = state.settings.shoppingList.filter((x) => x.id !== it.id);
      await persistLocal();
      renderBasket();
    };
    box.appendChild(row);
  });

  const add = async () => {
    const text = $("#shop-text").value.trim();
    if (!text) return;
    state.settings.shoppingList.unshift({ id: uid(), text, done: false, at: new Date().toISOString() });
    await persistLocal();
    renderBasket();
  };
  $("#shop-add").onclick = add;
  $("#shop-text").onkeydown = (e) => {
    if (e.key === "Enter") add();
  };
  $("#shop-clear-done").onclick = async () => {
    state.settings.shoppingList = state.settings.shoppingList.filter((x) => !x.done);
    await persistLocal();
    renderBasket();
  };
  $("#shop-copy").onclick = async () => {
    const text = state.settings.shoppingList
      .filter((x) => !x.done)
      .map((x) => `• ${x.text}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text || "—");
      toast("Скопировано");
    } catch {
      prompt("Скопируйте:", text);
    }
  };
}

function renderTreats(body, treatsWeek, treatsSum, treatsCap) {
  const over = treatsSum > treatsCap;
  body.innerHTML = `
    <div class="sk-forecast ${over ? "warn" : ""}">
      <div><div class="sk-meta">Вкусняшки за неделю</div><div class="sk-kpi">${rub(treatsSum)}</div></div>
      <div><div class="sk-meta">Лимит</div><div class="sk-kpi" style="font-size:1.2rem">${rub(treatsCap)}</div></div>
    </div>
    <div class="sk-card" style="margin-bottom:14px">
      <div class="shop-add">
        <input class="sk-input" id="treat-name" placeholder="Что купили" />
        <input class="sk-input" id="treat-cost" type="number" min="0" placeholder="₽" style="max-width:110px" />
        <button class="sk-btn sk-btn-accent" id="treat-add">Записать</button>
      </div>
    </div>
    <div class="shop-list" id="treat-list"></div>`;
  const box = $("#treat-list");
  if (!treatsWeek.length) box.innerHTML = `<div class="sk-note">Пока пусто на этой неделе.</div>`;
  treatsWeek
    .slice()
    .reverse()
    .forEach((t) => {
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `<span style="flex:1"><b>${t.name}</b><div class="sk-meta">${dayjs(t.at).format("dd, D MMM")}</div></span><b>${rub(t.cost)}</b><button type="button" class="shop-del">×</button>`;
      row.querySelector(".shop-del").onclick = async () => {
        state.settings.treats = state.settings.treats.filter((x) => x.id !== t.id);
        await persistLocal();
        renderBasket();
      };
      box.appendChild(row);
    });
  $("#treat-add").onclick = async () => {
    const name = $("#treat-name").value.trim();
    const cost = Math.round(+$("#treat-cost").value || 0);
    if (!name || !cost) return toast("Название и сумма");
    state.settings.treats.push({ id: uid(), name, cost, at: new Date().toISOString() });
    state.events.push(makeEvent({ type: "spend", category: "treats", total: cost, items: [{ name, cost }] }));
    state.budget.treatsSpent = (state.budget.treatsSpent || 0) + cost;
    await persistLocal();
    toast("Записали");
    renderBasket();
  };
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
  const cats = [...new Set(state.data.dishes.map((d) => d.category))].sort();
  const proteins = [...new Set(state.data.dishes.map((d) => d.protein))].sort();
  root.innerHTML = `
    <div class="sk-hero">
      <h1>Рецепты</h1>
      <p>Выберите блюдо → укажите людей, порции и на сколько дней → добавьте в ближайший план.</p>
    </div>
    <div class="sk-card" style="margin-bottom:14px">
      <div class="sk-row">
        <label class="sk-field" style="flex:1;min-width:180px">Поиск
          <input class="sk-input sk-input-lg" id="recipe-q" placeholder="борщ, минтай, творог…" />
        </label>
        <label class="sk-field">Тип
          <select class="sk-select" id="f-type"><option value="all">Все</option><option value="breakfast">Завтраки</option><option value="soup">Супы</option><option value="main">Основные</option><option value="snack">Перекусы</option></select>
        </label>
        <label class="sk-field">Категория
          <select class="sk-select" id="f-cat"><option value="all">Все</option>${cats.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </label>
        <label class="sk-field">Белок
          <select class="sk-select" id="f-protein"><option value="all">Все</option>${proteins.map((c) => `<option value="${c}">${c}</option>`).join("")}</select>
        </label>
        <label class="sk-field">Время
          <select class="sk-select" id="f-time"><option value="all">Любое</option><option value="20">≤20</option><option value="40">≤40</option><option value="60">≤60</option></select>
        </label>
        <label class="sk-field" style="min-width:180px">Теги
          <select id="f-tags" multiple placeholder="Теги…"></select>
        </label>
        <label class="sk-field" style="flex-direction:row;align-items:center;gap:8px;min-height:48px">
          <input type="checkbox" id="f-batch" /> сразу на 2+ дня
        </label>
        <label class="sk-field" style="flex-direction:row;align-items:center;gap:8px;min-height:48px">
          <input type="checkbox" id="f-child" /> для ребёнка
        </label>
      </div>
    </div>
    <div class="recipe-layout-desk">
      <div class="sk-list recipe-list-pane" id="recipe-list"></div>
      <div class="sk-card" id="recipe-view"><p class="sk-meta">Выберите рецепт слева или откройте карточку</p></div>
    </div>`;

  const allTags = [...new Set(state.data.dishes.flatMap((d) => d.tags || []))].sort();
  const ts = new TomSelect("#f-tags", {
    plugins: ["remove_button"],
    options: allTags.map((t) => ({ value: t, text: t })),
    maxOptions: 50,
  });

  fuse = new Fuse(state.data.dishes, {
    keys: ["name", "description", "category", "tags", "protein", "steps"],
    threshold: 0.35,
  });

  const redraw = () => {
    const q = ($("#recipe-q").value || "").trim();
    const type = $("#f-type").value;
    const cat = $("#f-cat").value;
    const protein = $("#f-protein").value;
    const time = $("#f-time").value;
    const tags = ts.getValue();
    const batchOnly = $("#f-batch").checked;
    const child = $("#f-child").checked;
    let list = q ? fuse.search(q).map((x) => x.item) : state.data.dishes;
    list = list.filter((d) => {
      if (type !== "all" && d.type !== type) return false;
      if (cat !== "all" && d.category !== cat) return false;
      if (protein !== "all" && d.protein !== protein) return false;
      if (time !== "all" && d.timeMin > +time) return false;
      if (batchOnly && (d.batchDays || 1) < 2) return false;
      if (child && (d.tags || []).some((t) => t === "острое")) return false;
      if (tags.length && !tags.every((t) => (d.tags || []).includes(t))) return false;
      return true;
    });
    const pane = $("#recipe-list");
    pane.innerHTML = "";
    list.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = d.id === state.selectedRecipe ? "active" : "";
      b.innerHTML = `<div style="font-weight:750">${d.name}</div><div class="sk-meta">${d.category} · ${d.timeMin} мин · ${rub(d.costBatch)}</div>`;
      b.onclick = () => {
        state.selectedRecipe = d.id;
        mountRecipeView(d, $("#recipe-view"));
        redraw();
      };
      pane.appendChild(b);
    });
    if (!list.length) pane.innerHTML = `<div style="padding:14px" class="sk-meta">Ничего не найдено</div>`;
  };

  ["recipe-q", "f-type", "f-cat", "f-protein", "f-time", "f-batch", "f-child"].forEach((id) => {
    $("#" + id).addEventListener("input", redraw);
    $("#" + id).addEventListener("change", redraw);
  });
  ts.on("change", redraw);
  if (!state.selectedRecipe) state.selectedRecipe = state.data.dishes[0]?.id;
  redraw();
  const cur = dish(state.selectedRecipe);
  if (cur) mountRecipeView(cur, $("#recipe-view"));
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
    <div class="sk-note"><b>Дочка:</b> ${d.child}</div>

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
      <button class="sk-btn sk-btn-primary" data-act="cooked">Приготовил — списать</button>
      <button class="sk-btn sk-btn-ghost" data-act="dislike">Не предлагать месяц</button>
      <button class="sk-btn sk-btn-ghost" data-act="love">В любимое</button>
    </div>`;
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
  root.querySelector('[data-act="cooked"]')?.addEventListener("click", async () => {
    const form = readPlanForm(root, d);
    const scaled = scaleIngredients(d, form.servings);
    const items = [];
    for (const ing of scaled) {
      const have = state.inventory[ing.id] || 0;
      const use = Math.min(have, ing.amount);
      if (use > 0) {
        state.inventory[ing.id] = have - use;
        if (state.inventory[ing.id] <= 0) delete state.inventory[ing.id];
        items.push({ id: ing.id, amount: use, name: state.cat.products[ing.id]?.name });
      }
    }
    state.events.push(makeEvent({ type: "cook", recipeId: d.id, recipeName: d.name, items }));
    await saveInventoryAndSync();
    toast("Списали продукты с общих запасов");
  });
}

function mountRecipeView(d, root) {
  if (!root) return;
  root.innerHTML = recipeHtml(d);
  bindRecipeActions(d, root);
}

function openRecipeModal() {
  $("#recipeModal")?.classList.add("show");
}
function closeRecipeModal() {
  $("#recipeModal")?.classList.remove("show");
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

function renderStats() {
  destroyCharts();
  const root = $("#screen-stats");
  const fromDefault = dayjs().subtract(30, "day").format("YYYY-MM-DD");
  const toDefault = dayjs().format("YYYY-MM-DD");
  root.innerHTML = `
    <div class="card border-0 shadow-sm mb-3"><div class="card-body">
      <h1 class="h3">Статистика</h1>
      <div class="row g-2 align-items-end">
        <div class="col-6 col-md-3"><label class="form-label">С</label><input type="date" class="form-control" id="stat-from" value="${fromDefault}" /></div>
        <div class="col-6 col-md-3"><label class="form-label">По</label><input type="date" class="form-control" id="stat-to" value="${toDefault}" /></div>
        <div class="col-12 col-md-auto"><button class="btn btn-success" id="stat-run">Показать</button></div>
      </div>
    </div></div>
    <div class="row g-3 mb-3" id="stat-kpis"></div>
    <div class="row g-3">
      <div class="col-12 col-lg-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><h2 class="h5">Траты по дням</h2><div class="chart-box"><canvas id="chart-timeline"></canvas></div></div></div></div>
      <div class="col-12 col-lg-6"><div class="card border-0 shadow-sm h-100"><div class="card-body"><h2 class="h5">Траты по контурам</h2><div class="chart-box"><canvas id="chart-cat"></canvas></div></div></div></div>
      <div class="col-12"><div class="card border-0 shadow-sm"><div class="card-body"><h2 class="h5">Популярные товары</h2><div class="table-responsive"><table class="table" id="pop-table"><thead><tr><th>#</th><th>Товар</th><th>Раз</th><th>Кол-во</th><th>Сумма ₽</th></tr></thead><tbody></tbody></table></div></div></div></div>
    </div>`;

  const draw = () => {
    destroyCharts();
    const from = $("#stat-from").value;
    const to = $("#stat-to").value;
    const ev = filterEvents(state.events, from, to);
    const pop = popularProducts(ev, state.cat.products, 20);
    const cats = spendByCategory(ev);
    const timeline = spendTimeline(ev, from, to);
    const sum = totalSpend(ev);
    $("#stat-kpis").innerHTML = `
      <div class="col-6 col-md-3"><div class="p-3 bg-white rounded-3 shadow-sm"><div class="small text-secondary">Траты</div><div class="fs-4 fw-bold">${rub(sum)}</div></div></div>
      <div class="col-6 col-md-3"><div class="p-3 bg-white rounded-3 shadow-sm"><div class="small text-secondary">Событий</div><div class="fs-4 fw-bold">${ev.length}</div></div></div>
      <div class="col-6 col-md-3"><div class="p-3 bg-white rounded-3 shadow-sm"><div class="small text-secondary">Уникальных товаров</div><div class="fs-4 fw-bold">${pop.length}</div></div></div>
      <div class="col-6 col-md-3"><div class="p-3 bg-white rounded-3 shadow-sm"><div class="small text-secondary">Готовка в факте</div><div class="fs-4 fw-bold">${rub(cats.cooking)}</div></div></div>`;

    state.charts.timeline = new Chart($("#chart-timeline"), {
      type: "line",
      data: {
        labels: timeline.map((d) => d.label),
        datasets: [{ label: "₽", data: timeline.map((d) => d.total), borderColor: "#198754", tension: 0.25, fill: false }],
      },
      options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } },
    });
    state.charts.cat = new Chart($("#chart-cat"), {
      type: "doughnut",
      data: {
        labels: ["Готовка", "Вино", "Джин", "Вкусняшки", "Прочее"],
        datasets: [{ data: [cats.cooking, cats.wine, cats.gin, cats.treats, cats.other], backgroundColor: ["#198754", "#6f42c1", "#fd7e14", "#ffc107", "#adb5bd"] }],
      },
      options: { responsive: true, maintainAspectRatio: false },
    });
    const tb = $("#pop-table tbody");
    tb.innerHTML = pop
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td>${p.name}</td><td>${p.count}</td><td>${Math.round(p.qty)}</td><td>${rub(p.cost)}</td></tr>`
      )
      .join("") || `<tr><td colspan="5" class="text-secondary">Пока нет данных за период — отметьте покупки в корзине или «приготовил» в рецепте.</td></tr>`;
  };
  $("#stat-run").onclick = draw;
  draw();
}

/* ——— BUDGET ——— */
function renderBudget() {
  const root = $("#screen-budget");
  const s = state.settings;
  const b = state.budget;
  const totalPlan = s.cookingBudget + s.wineBudget + s.ginBudget + s.treatsBudget;
  const totalFact = (b.cookingSpent || 0) + (b.wineSpent || 0) + (b.ginSpent || 0) + (b.treatsSpent || 0);
  root.innerHTML = `
    <div class="row g-3 mb-3">
      <div class="col-md-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary">План месяца</div><div class="fs-3 fw-bold">${rub(totalPlan)}</div></div></div></div>
      <div class="col-md-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary">Факт</div><div class="fs-3 fw-bold">${rub(totalFact)}</div></div></div></div>
      <div class="col-md-4"><div class="card border-0 shadow-sm"><div class="card-body"><div class="text-secondary">Остаток</div><div class="fs-3 fw-bold">${rub(totalPlan - totalFact)}</div></div></div></div>
    </div>
    <div class="card border-0 shadow-sm"><div class="card-body">
      <h1 class="h4">Контуры</h1>
      <div class="table-responsive"><table class="table align-middle">
        <thead><tr><th>Статья</th><th>План</th><th>Факт</th><th>+ факт</th></tr></thead>
        <tbody>
          <tr><td>Готовка</td><td>${rub(s.cookingBudget)}</td><td>${rub(b.cookingSpent)}</td><td><input type="number" class="form-control" id="add-cooking" /></td></tr>
          <tr><td>Вино</td><td>${rub(s.wineBudget)}</td><td>${rub(b.wineSpent)}</td><td><input type="number" class="form-control" id="add-wine" /></td></tr>
          <tr><td>Джин</td><td>${rub(s.ginBudget)}</td><td>${rub(b.ginSpent)}</td><td><input type="number" class="form-control" id="add-gin" /></td></tr>
          <tr><td>Вкусняшки</td><td>${rub(s.treatsBudget)}</td><td>${rub(b.treatsSpent)}</td><td><input type="number" class="form-control" id="add-treats" /></td></tr>
        </tbody>
      </table></div>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-success" id="save-budget">Сохранить</button>
        <button class="btn btn-outline-secondary" id="reset-budget">Сбросить факт</button>
      </div>
    </div></div>`;
  $("#save-budget").onclick = async () => {
    const add = async (sel, key, category) => {
      const v = parseFloat($(sel).value) || 0;
      if (!v) return;
      state.budget[key] = (state.budget[key] || 0) + v;
      state.events.push(makeEvent({ type: "spend", category, total: v, items: [] }));
    };
    await add("#add-cooking", "cookingSpent", "cooking");
    await add("#add-wine", "wineSpent", "wine");
    await add("#add-gin", "ginSpent", "gin");
    await add("#add-treats", "treatsSpent", "treats");
    await persistLocal();
    toast("Бюджет обновлён");
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
  root.innerHTML = `
    <div class="card border-0 shadow-sm"><div class="card-body">
      <h1 class="h3"><i class="bi bi-cloud-check me-2"></i>Облако семьи</h1>
      <div class="alert alert-success">
        <strong>Ничего настраивать не нужно.</strong> Любое сохранение (запасы, план, покупка, бюджет)
        само уходит в облако Cloudflare. С другого телефона или через неделю — данные подтянутся сами.
        Домашний компьютер <strong>не нужен</strong>.
      </div>
      <ul class="mb-3">
        <li>API: <code>${APP_CONFIG.apiBase}</code></li>
        <li>Семья: <code>${APP_CONFIG.familyKey}</code></li>
        <li>Устройство: <code>${deviceId()}</code></li>
        <li>Последнее сохранение: ${state.syncAt ? dayjs(state.syncAt).format("DD.MM.YYYY HH:mm") : "—"}</li>
        <li>Статус: ${state.syncError ? `<span class="text-danger">${state.syncError}</span>` : `<span class="text-success">ок</span>`}</li>
      </ul>
      <div class="d-flex flex-wrap gap-2 mb-3">
        <button class="btn btn-outline-success" id="btn-pull">Обновить сейчас</button>
        <button class="btn btn-outline-secondary" id="btn-health">Проверить облако</button>
      </div>
      <hr />
      <h2 class="h5">Резервная копия на всякий случай</h2>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-secondary" id="export-data">Экспорт JSON</button>
        <button class="btn btn-outline-secondary" id="import-data">Импорт JSON</button>
        <input type="file" id="import-file" accept="application/json" class="d-none" />
      </div>
    </div></div>`;

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

  $$("[data-profile]").forEach((b) => {
    b.onclick = async () => {
      state.settings.profile = b.dataset.profile;
      await persistLocal();
      applyProfile();
      setScreen(state.settings.profile === "kitchen" ? "today" : state.screen);
      toast(state.settings.profile === "kitchen" ? "Режим «Кухня»" : "Командный центр");
    };
  });
  $$("#nav-list [data-screen]").forEach((b) => {
    b.onclick = () => setScreen(b.dataset.screen);
  });

  applyProfile();
  updateSyncBadge();
  setScreen(state.settings.profile === "kitchen" ? "today" : "plan");

  syncPull(true)
    .then(() => {
      applyProfile();
      renderScreen();
    })
    .catch(() => {});

  setInterval(() => {
    if (document.visibilityState === "visible") {
      syncPull(true)
        .then(() => {
          if (["inventory", "plan", "today"].includes(state.screen)) renderScreen();
        })
        .catch(() => {});
    }
  }, APP_CONFIG.pollMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
      syncPull(true)
        .then(() => renderScreen())
        .catch(() => {});
    }
  });
}

boot();
