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
} from "./engine.js";
import {
  getToken,
  setToken,
  pullCloud,
  pushCloud,
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
let recipeModal;
let toastObj;
let fuse;

function toast(msg) {
  $("#toastBody").textContent = msg;
  toastObj.show();
}

async function persistLocal() {
  await dbSet("settings", state.settings);
  await dbSet("inventory", state.inventory);
  await dbSet("events", state.events);
  await dbSet("plan", state.plan);
  await dbSet("weekNum", state.weekNum);
  await dbSet("budget", state.budget);
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
  if (!getToken()) {
    el.textContent = "без синка";
    el.className = "badge text-bg-warning";
    return;
  }
  if (state.syncError) {
    el.textContent = "ошибка синка";
    el.className = "badge text-bg-danger";
    return;
  }
  el.textContent = state.syncAt ? `синк ${dayjs(state.syncAt).format("HH:mm")}` : "синк ок";
  el.className = "badge text-bg-light text-success";
}

async function syncPull(preferCloudInventory = true) {
  const token = getToken();
  if (!token) return;
  try {
    const cloud = await pullCloud(token);
    if (preferCloudInventory) state.inventory = { ...(cloud.inventory || {}) };
    state.events = mergeEvents(state.events, cloud.events || []);
    state.syncAt = cloud.updatedAt || new Date().toISOString();
    state.syncError = null;
    await persistLocal();
    updateSyncBadge();
  } catch (e) {
    state.syncError = String(e.message || e);
    updateSyncBadge();
    throw e;
  }
}

async function syncPush() {
  const token = getToken();
  if (!token) return;
  try {
    await pushCloud({ inventory: state.inventory, events: state.events });
    state.syncAt = new Date().toISOString();
    state.syncError = null;
    updateSyncBadge();
  } catch (e) {
    state.syncError = String(e.message || e);
    updateSyncBadge();
    throw e;
  }
}

async function saveInventoryAndSync() {
  await persistLocal();
  if (getToken()) {
    try {
      await syncPush();
    } catch (e) {
      toast(e.message);
    }
  }
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
  $$(".screen").forEach((p) => p.classList.toggle("d-none", p.id !== `screen-${name}`));
  const collapse = bootstrap.Collapse.getInstance($("#mainNav"));
  if (collapse && window.innerWidth < 992) collapse.hide();
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
    root.innerHTML = `<div class="alert alert-warning">Плана нет — откройте «План».</div>`;
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
    <div class="d-flex flex-wrap justify-content-between align-items-start gap-2 mb-3">
      <div>
        <h1 class="h3 mb-1">${day.dayName}: меню дня</h1>
        <p class="text-secondary mb-0">${day.cookHint || ""}</p>
      </div>
      <div class="d-flex flex-wrap gap-2">
        <span class="badge text-bg-success-subtle text-success border">Неделя ${state.weekNum}</span>
        <span class="badge text-bg-secondary-subtle text-secondary border">День ${idx + 1}/7</span>
      </div>
    </div>
    <div class="row g-2 g-md-3" id="today-meals"></div>
    <div class="d-grid d-sm-flex gap-2 mt-3">
      <button class="btn btn-success btn-lg" id="btn-cook-dinner"><i class="bi bi-fire me-1"></i>Готовлю ужин</button>
      <button class="btn btn-outline-secondary btn-lg" id="btn-swap-dinner">Заменить ужин</button>
      <button class="btn btn-outline-success btn-lg" id="btn-from-inv">Из запасов</button>
    </div>`;
  const box = $("#today-meals");
  meals.forEach(([label, , id]) => {
    const d = dish(id);
    if (!d) return;
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-xl-4";
    col.innerHTML = `
      <div class="card meal-tile h-100 shadow-sm border-0">
        <div class="card-body d-flex justify-content-between align-items-center gap-2">
          <div>
            <div class="text-uppercase text-secondary small fw-semibold">${label}</div>
            <div class="fw-semibold">${d.name}</div>
            <div class="small text-secondary">${d.timeMin} мин · batch ${d.batchDays} дн · ${d.category}</div>
          </div>
          <div class="text-success fw-bold text-nowrap">~${rub(d.costPerServing)}</div>
        </div>
      </div>`;
    col.querySelector(".meal-tile").onclick = () => openRecipe(id);
    box.appendChild(col);
  });
  $("#btn-cook-dinner").onclick = () => openRecipe(day.dinner);
  $("#btn-swap-dinner").onclick = () => swapMeal(idx, "dinner");
  $("#btn-from-inv").onclick = () => setScreen("inventory");
}

async function swapMeal(dayIndex, mealKey) {
  const day = state.plan[dayIndex];
  const current = dish(day[mealKey]);
  if (!current) return;
  const alts = state.data.dishes.filter(
    (d) => d.type === current.type && d.id !== current.id && !state.settings.disliked.includes(d.id)
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
  root.innerHTML = `
    <div class="row g-3 align-items-end mb-3">
      <div class="col-6 col-md-3">
        <label class="form-label">Неделя шаблона</label>
        <select class="form-select form-select-lg" id="week-select">
          ${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.weekNum === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}
        </select>
      </div>
      <div class="col-12 col-md-auto d-grid d-md-flex gap-2">
        <button class="btn btn-success" id="gen-week"><i class="bi bi-magic me-1"></i>Авточерновик</button>
        <button class="btn btn-outline-success" id="to-basket-week">В корзину</button>
      </div>
      <div class="col-md-auto ms-md-auto">
        <div class="card border-0 shadow-sm"><div class="card-body py-2 px-3">Ориентир недели: <strong>${rub(cost)}</strong></div></div>
      </div>
    </div>
    <div class="row g-3" id="plan-grid"></div>`;
  $("#week-select").onchange = (e) => (state.weekNum = +e.target.value);
  $("#gen-week").onclick = async () => {
    state.plan = draftWeekPlan(state.data, state.settings, state.weekNum);
    await persistLocal();
    toast("Неделя пересобрана");
    renderPlan();
  };
  $("#to-basket-week").onclick = () => setScreen("basket");
  const grid = $("#plan-grid");
  state.plan.forEach((day, idx) => {
    const col = document.createElement("div");
    col.className = "col-12 col-lg-6 col-xxl-4";
    const today = idx === planDayIndex(state.plan);
    col.innerHTML = `<div class="card h-100 shadow-sm border-0 ${today ? "border border-success" : ""}"><div class="card-body"></div></div>`;
    const body = col.querySelector(".card-body");
    body.innerHTML = `<div class="d-flex justify-content-between"><h2 class="h5 mb-1">${day.dayName}${today ? " · сегодня" : ""}</h2><button class="btn btn-sm btn-outline-secondary" data-swap>Не хочу ужин</button></div><p class="small text-secondary">${day.cookHint || ""}</p>`;
    ["breakfast", "lunch", "dinner"].forEach((key) => {
      const d = dish(day[key]);
      if (!d) return;
      const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
      const row = document.createElement("button");
      row.type = "button";
      row.className = "btn btn-light w-100 text-start mb-2 meal-tile";
      row.innerHTML = `<span class="badge text-bg-secondary me-2">${labels[key]}</span>${d.name}<span class="float-end text-success small">${d.batchDays}д</span>`;
      row.onclick = () => openRecipe(d.id);
      body.appendChild(row);
    });
    body.querySelector("[data-swap]").onclick = async () => {
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

function renderInventory() {
  const root = $("#screen-inventory");
  root.innerHTML = `
    <div class="card border-0 shadow-sm mb-3">
      <div class="card-body">
        <h1 class="h3">Запасы <span class="fs-6 text-secondary fw-normal">(общие для семьи)</span></h1>
        <p class="text-secondary">Изменения уходят в облако gist — на другом телефоне появятся после синка / обновления.</p>
        <div class="d-flex flex-wrap gap-2 mb-3" id="quick"></div>
        <div class="row g-2 align-items-end">
          <div class="col-6 col-md-3">
            <label class="form-label">Режим подбора</label>
            <select class="form-select" id="match-mode">
              <option value="strict">Только если всё есть</option>
              <option value="almost" selected>Почти хватает (~250 ₽)</option>
            </select>
          </div>
          <div class="col-6 col-md-2">
            <label class="form-label">Мин. порций</label>
            <input type="number" class="form-control" id="min-serv" value="2" min="1" />
          </div>
          <div class="col-12 col-md-auto d-grid d-md-flex gap-2">
            <button class="btn btn-success" id="run-match"><i class="bi bi-search me-1"></i>Показать блюда</button>
            <button class="btn btn-outline-secondary" id="pull-inv">Обновить из облака</button>
            <button class="btn btn-outline-danger" id="clear-inv">Сбросить</button>
          </div>
        </div>
      </div>
    </div>
    <div class="row g-2 mb-3" id="inv-grid"></div>
    <div class="row g-3" id="match-results"></div>`;

  QUICK.forEach(([id, amt]) => {
    const p = state.cat.products[id];
    if (!p) return;
    const b = document.createElement("button");
    b.type = "button";
    b.className = "btn btn-outline-success btn-sm inv-chip";
    b.innerHTML = `<i class="bi bi-plus"></i> ${p.name}`;
    b.onclick = async () => {
      state.inventory[id] = (state.inventory[id] || 0) + amt;
      await saveInventoryAndSync();
      renderInventory();
      toast(`+ ${p.name}`);
    };
    $("#quick").appendChild(b);
  });

  const list =
    state.settings.profile === "kitchen"
      ? state.data.products.filter((p) => (state.inventory[p.id] || 0) > 0 || QUICK.some(([id]) => id === p.id))
      : state.data.products;

  list.forEach((p) => {
    const col = document.createElement("div");
    col.className = "col-12 col-sm-6 col-lg-4 col-xxl-3";
    col.innerHTML = `
      <div class="input-group">
        <span class="input-group-text small" style="min-width:58%">${p.name}</span>
        <input type="number" class="form-control" min="0" placeholder="0" data-pid="${p.id}" value="${state.inventory[p.id] || ""}" />
      </div>
      <div class="form-text">${storeName(state.data.stores, p.store)} · ${p.unit}</div>`;
    $("#inv-grid").appendChild(col);
  });

  const syncInputs = () => {
    $$("#inv-grid input").forEach((inp) => {
      const v = parseFloat(inp.value);
      if (!v) delete state.inventory[inp.dataset.pid];
      else state.inventory[inp.dataset.pid] = v;
    });
  };

  $("#inv-grid").onchange = async () => {
    syncInputs();
    await saveInventoryAndSync();
  };
  $("#match-mode").value = state.matchMode;
  $("#match-mode").onchange = (e) => (state.matchMode = e.target.value);
  $("#run-match").onclick = () => {
    syncInputs();
    runMatch();
  };
  $("#pull-inv").onclick = async () => {
    try {
      await syncPull(true);
      toast("Запасы обновлены из облака");
      renderInventory();
    } catch (e) {
      toast(e.message);
    }
  };
  $("#clear-inv").onclick = async () => {
    state.inventory = {};
    await saveInventoryAndSync();
    renderInventory();
  };
}

function runMatch() {
  const minServ = +$("#min-serv").value || 1;
  const results = matchFromInventory(state.data.dishes, state.cat.products, state.inventory, state.settings, {
    minServings: minServ,
    mode: state.matchMode,
  }).slice(0, 24);
  const box = $("#match-results");
  box.innerHTML = results.length ? "" : `<div class="col-12"><div class="alert alert-secondary">Ничего не подобрали — добавьте запасы.</div></div>`;
  results.forEach((r) => {
    const col = document.createElement("div");
    col.className = "col-12 col-md-6 col-xl-4";
    col.innerHTML = `
      <div class="card h-100 shadow-sm border-0 meal-tile">
        <div class="card-body">
          <h2 class="h5">${r.dish.name}</h2>
          <p class="small text-secondary mb-2">${r.why} · покрытие ${Math.round(r.coverage * 100)}% · ~${r.portions || "?"} порц</p>
          <div class="d-flex flex-wrap gap-1 mb-2">
            <span class="badge text-bg-success">${r.dish.category}</span>
            <span class="badge text-bg-light text-dark border">${r.dish.timeMin} мин</span>
            <span class="badge text-bg-light text-dark border">${rub(r.dish.costBatch)}</span>
          </div>
          ${r.missing.length ? `<div class="small text-warning-emphasis">Докупить: ${r.missing.map((m) => m.name).slice(0, 4).join(", ")}</div>` : `<div class="alert alert-success py-2 mb-0">Можно готовить</div>`}
        </div>
      </div>`;
    col.querySelector(".card").onclick = () => openRecipe(r.dish.id);
    box.appendChild(col);
  });
}

/* ——— BASKET ——— */
function renderBasket() {
  const root = $("#screen-basket");
  const slots = slotsFromPlan(state.plan, state.cat.dishes);
  const basket = buildBasket(slots, state.cat.dishes, state.cat.products, state.inventory);
  root.innerHTML = `
    <div class="card border-0 shadow-sm mb-3"><div class="card-body">
      <h1 class="h3">Корзина на неделю</h1>
      <p class="text-secondary">План × порции − общие запасы. Списки по магазинам.</p>
      <div class="row g-2 mb-3">
        <div class="col-4"><div class="p-3 bg-success-subtle rounded-3"><div class="small">Докупить</div><div class="fs-4 fw-bold">${rub(basket.total)}</div></div></div>
        <div class="col-4"><div class="p-3 bg-body-secondary rounded-3"><div class="small">Позиций</div><div class="fs-4 fw-bold">${Object.values(basket.byStore).reduce((s, g) => s + g.lines.length, 0)}</div></div></div>
        <div class="col-4"><div class="p-3 bg-body-secondary rounded-3"><div class="small">Уже есть</div><div class="fs-4 fw-bold">${basket.lines.filter((l) => l.covered).length}</div></div></div>
      </div>
      <div class="d-grid d-sm-flex gap-2">
        <button class="btn btn-success" id="copy-basket"><i class="bi bi-clipboard me-1"></i>Копировать</button>
        <button class="btn btn-outline-success" id="mark-bought">Отметить покупку</button>
      </div>
    </div></div>
    <div class="row g-3" id="basket-stores"></div>`;

  for (const [storeId, group] of Object.entries(basket.byStore)) {
    const col = document.createElement("div");
    col.className = "col-12 col-lg-6";
    col.innerHTML = `
      <div class="card shadow-sm border-0 h-100">
        <div class="card-header bg-white fw-semibold">${storeName(state.data.stores, storeId)} · ${rub(group.total)}</div>
        <div class="table-responsive"><table class="table table-sm mb-0"><thead><tr><th>Продукт</th><th>Купить</th><th>₽</th></tr></thead><tbody></tbody></table></div>
      </div>`;
    const tb = col.querySelector("tbody");
    group.lines.forEach((l) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${l.name}${l.note ? `<div class="small text-secondary">${l.note}</div>` : ""}</td><td>${amountLabel(state.cat.products[l.id], l.buy)}</td><td>${rub(l.cost)}</td>`;
      tb.appendChild(tr);
    });
    $("#basket-stores").appendChild(col);
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
    const ev = makeEvent({ type: "spend", category: "cooking", total: Math.round(basket.total), items });
    state.events.push(ev);
    state.budget.cookingSpent = (state.budget.cookingSpent || 0) + Math.round(basket.total);
    // добавляем купленное в запасы
    items.forEach((it) => {
      state.inventory[it.id] = (state.inventory[it.id] || 0) + (it.buy || 0);
    });
    await persistLocal();
    try {
      await syncPush();
    } catch (e) {
      toast(e.message);
    }
    toast(`Покупка ${rub(basket.total)} учтена`);
    renderBasket();
  };
}

/* ——— RECIPES ——— */
function renderRecipes() {
  const root = $("#screen-recipes");
  const cats = [...new Set(state.data.dishes.map((d) => d.category))].sort();
  const proteins = [...new Set(state.data.dishes.map((d) => d.protein))].sort();
  root.innerHTML = `
    <div class="card border-0 shadow-sm mb-3"><div class="card-body">
      <h1 class="h3 mb-3">Рецепты</h1>
      <div class="row g-2">
        <div class="col-12 col-md-4"><input class="form-control form-control-lg" id="recipe-q" placeholder="Поиск: борщ, минтай, творог…" /></div>
        <div class="col-6 col-md-2">
          <select class="form-select" id="f-type"><option value="all">Все типы</option><option value="breakfast">Завтраки</option><option value="soup">Супы</option><option value="main">Основные</option><option value="snack">Перекусы</option></select>
        </div>
        <div class="col-6 col-md-2"><select class="form-select" id="f-cat"><option value="all">Категория</option>${cats.map((c) => `<option value="${c}">${c}</option>`).join("")}</select></div>
        <div class="col-6 col-md-2"><select class="form-select" id="f-protein"><option value="all">Белок</option>${proteins.map((c) => `<option value="${c}">${c}</option>`).join("")}</select></div>
        <div class="col-6 col-md-2"><select class="form-select" id="f-time"><option value="all">Время</option><option value="20">≤20 мин</option><option value="40">≤40 мин</option><option value="60">≤60 мин</option></select></div>
        <div class="col-12 col-md-4"><select id="f-tags" multiple placeholder="Теги…"></select></div>
        <div class="col-6 col-md-2 form-check mt-2 ms-2"><input class="form-check-input" type="checkbox" id="f-batch" /><label class="form-check-label" for="f-batch">Только batch 2+ дн</label></div>
        <div class="col-6 col-md-2 form-check mt-2"><input class="form-check-input" type="checkbox" id="f-child" /><label class="form-check-label" for="f-child">Удобно ребёнку</label></div>
      </div>
    </div></div>
    <div class="recipe-layout-desk">
      <div class="list-group recipe-list-pane shadow-sm rounded-3 overflow-hidden mb-3 mb-lg-0" id="recipe-list"></div>
      <div class="card border-0 shadow-sm d-none d-lg-block"><div class="card-body" id="recipe-view"><p class="text-secondary">Выберите рецепт слева</p></div></div>
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
      if (child && d.type === "snack" && (d.tags || []).includes("сахар")) return false;
      if (tags.length && !tags.every((t) => (d.tags || []).includes(t))) return false;
      return true;
    });
    const pane = $("#recipe-list");
    pane.innerHTML = "";
    list.forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = `list-group-item list-group-item-action ${d.id === state.selectedRecipe ? "active" : ""}`;
      b.innerHTML = `<div class="fw-semibold">${d.name}</div><div class="small ${d.id === state.selectedRecipe ? "text-white-50" : "text-secondary"}">${d.category} · ${d.timeMin} мин · ${rub(d.costBatch)}</div>`;
      b.onclick = () => {
        state.selectedRecipe = d.id;
        openRecipe(d.id, false);
        $("#recipe-view").innerHTML = recipeHtml(d);
        redraw();
      };
      pane.appendChild(b);
    });
    if (!list.length) pane.innerHTML = `<div class="p-3 text-secondary">Ничего не найдено</div>`;
    const cur = dish(state.selectedRecipe);
    if (cur && $("#recipe-view")) $("#recipe-view").innerHTML = recipeHtml(cur);
  };

  ["recipe-q", "f-type", "f-cat", "f-protein", "f-time", "f-batch", "f-child"].forEach((id) => {
    $("#" + id).addEventListener("input", redraw);
    $("#" + id).addEventListener("change", redraw);
  });
  ts.on("change", redraw);
  if (!state.selectedRecipe) state.selectedRecipe = state.data.dishes[0]?.id;
  redraw();
}

function recipeHtml(d) {
  const stores = [...new Set((d.stores || []).map((s) => storeName(state.data.stores, s)))].join(", ");
  const rows = (d.ingredients || [])
    .map((i) => {
      const p = state.cat.products[i.id];
      return `<tr><td>${p?.name || i.id}</td><td>${amountLabel(p, i.amount)}</td><td>${storeName(state.data.stores, p?.store)}</td><td>${rub((p?.price || 0) * i.amount)}</td></tr>`;
    })
    .join("");
  return `
    <p class="lead">${d.description || ""}</p>
    <div class="d-flex flex-wrap gap-1 mb-2">
      <span class="badge text-bg-success">${d.category}</span>
      <span class="badge text-bg-secondary">${d.protein}</span>
      ${(d.equipment || []).map((e) => `<span class="badge text-bg-light text-dark border">${e}</span>`).join("")}
      <span class="badge text-bg-light text-dark border">batch ${d.batchDays} дн</span>
      <span class="badge text-bg-light text-dark border">${d.servings} порц</span>
      <span class="badge text-bg-light text-dark border">~${d.timeMin} мин</span>
      <span class="badge text-bg-warning-subtle text-dark">партия ${rub(d.costBatch)}</span>
    </div>
    <p class="small text-secondary">Где купить: ${stores || "—"}</p>
    <div class="alert alert-warning"><strong>Дочка:</strong> ${d.child}</div>
    <h3 class="h5">Ингредиенты на партию</h3>
    <div class="table-responsive"><table class="table table-sm align-middle"><thead><tr><th>Продукт</th><th>Кол-во</th><th>Магазин</th><th>₽</th></tr></thead><tbody>${rows}</tbody></table></div>
    <h3 class="h5">Как готовить</h3>
    <ol class="recipe-step">${(d.steps || []).map((s) => `<li class="mb-2">${s}</li>`).join("")}</ol>
    <h3 class="h5">Подсказки</h3>
    <ul>${(d.tips || []).map((t) => `<li>${t}</li>`).join("")}</ul>
    <div class="alert alert-success">На порцию ~<strong>${rub(d.costPerServing)}</strong></div>
    <div class="d-grid d-sm-flex gap-2">
      <button class="btn btn-success" data-act="cooked"><i class="bi bi-check2 me-1"></i>Приготовил — списать продукты</button>
      <button class="btn btn-outline-secondary" data-act="dislike">Не предлагать</button>
      <button class="btn btn-outline-success" data-act="love">В любимое</button>
    </div>`;
}

function bindRecipeActions(d, root) {
  root.querySelector('[data-act="dislike"]')?.addEventListener("click", async () => {
    if (!state.settings.disliked.includes(d.id)) state.settings.disliked.push(d.id);
    await persistLocal();
    toast("Скрыли из подборок");
  });
  root.querySelector('[data-act="love"]')?.addEventListener("click", async () => {
    if (!state.settings.loved.includes(d.id)) state.settings.loved.push(d.id);
    await persistLocal();
    toast("В любимых");
  });
  root.querySelector('[data-act="cooked"]')?.addEventListener("click", async () => {
    const items = [];
    for (const ing of d.ingredients || []) {
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

function openRecipe(id, showModal = true) {
  const d = dish(id);
  if (!d) return;
  state.selectedRecipe = id;
  $("#recipeModalTitle").textContent = d.name;
  const body = $("#recipeModalBody");
  body.innerHTML = recipeHtml(d);
  bindRecipeActions(d, body);
  if ($("#recipe-view")) {
    $("#recipe-view").innerHTML = recipeHtml(d);
    bindRecipeActions(d, $("#recipe-view"));
  }
  if (showModal) recipeModal.show();
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
    try {
      await syncPush();
    } catch (_) {}
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
      <h1 class="h3"><i class="bi bi-cloud-check me-2"></i>Общие запасы семьи</h1>
      <p>Один и тот же облачный файл (GitHub Gist) видят оба телефона. Нужен <strong>личный токен GitHub</strong> с правом <code>gist</code> — один раз вставить на каждом устройстве.</p>
      <ol>
        <li>Откройте <a href="https://github.com/settings/tokens" target="_blank" rel="noopener">github.com/settings/tokens</a></li>
        <li>Generate new token (classic) → отметьте только <code>gist</code> → Generate</li>
        <li>Вставьте токен ниже на этом телефоне и на телефоне жены</li>
      </ol>
      <div class="alert alert-secondary small">Gist ID уже прописан в приложении: <code>${APP_CONFIG.gistId}</code>. Устройство: <code>${deviceId()}</code></div>
      <label class="form-label">GitHub token (gist)</label>
      <input type="password" class="form-control form-control-lg mb-2" id="gh-token" value="${getToken()}" placeholder="ghp_…" autocomplete="off" />
      <div class="d-grid d-sm-flex gap-2 mb-3">
        <button class="btn btn-success" id="save-token">Сохранить токен</button>
        <button class="btn btn-outline-success" id="btn-pull">Забрать из облака</button>
        <button class="btn btn-outline-secondary" id="btn-push">Отправить в облако</button>
      </div>
      <div class="small text-secondary mb-3">Последний синк: ${state.syncAt ? dayjs(state.syncAt).format("DD.MM.YYYY HH:mm") : "—"} ${state.syncError ? `· ошибка: ${state.syncError}` : ""}</div>
      <hr />
      <h2 class="h5">Резервная копия</h2>
      <div class="d-flex flex-wrap gap-2">
        <button class="btn btn-outline-secondary" id="export-data">Экспорт JSON</button>
        <button class="btn btn-outline-secondary" id="import-data">Импорт JSON</button>
        <input type="file" id="import-file" accept="application/json" class="d-none" />
      </div>
      <p class="small text-secondary mt-3 mb-0">Архитектура: <a href="docs/PRODUCT-ARCHITECTURE.md">docs/PRODUCT-ARCHITECTURE.md</a> · старый прототип: <a href="prototype.html">prototype.html</a></p>
    </div></div>`;

  $("#save-token").onclick = async () => {
    setToken($("#gh-token").value);
    toast("Токен сохранён на устройстве");
    updateSyncBadge();
    try {
      await syncPull(true);
      toast("Подтянули общие запасы");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#btn-pull").onclick = async () => {
    try {
      await syncPull(true);
      toast("Обновлено из облака");
    } catch (e) {
      toast(e.message);
    }
  };
  $("#btn-push").onclick = async () => {
    try {
      await syncPush();
      toast("Отправлено в облако");
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
    toast("Импорт готов");
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

  recipeModal = new bootstrap.Modal("#recipeModal");
  toastObj = new bootstrap.Toast("#liveToast", { delay: 2600 });

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

  if (getToken()) {
    syncPull(true).catch(() => {});
  }
  setInterval(() => {
    if (getToken() && document.visibilityState === "visible") {
      syncPull(true)
        .then(() => {
          if (state.screen === "inventory") renderInventory();
        })
        .catch(() => {});
    }
  }, APP_CONFIG.pollMs);

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible" && getToken()) syncPull(true).catch(() => {});
  });
}

boot();
