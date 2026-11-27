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

const state = {
  data: null,
  cat: null,
  settings: defaultSettings(),
  inventory: {},
  plan: [],
  weekNum: 1,
  budget: defaultBudgetLedger(),
  screen: "today",
  selectedRecipe: null,
  matchMode: "almost",
};

const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

function toast(msg) {
  const el = $("#toast");
  el.textContent = msg;
  el.classList.add("show");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove("show"), 2400);
}

async function persist() {
  await dbSet("settings", state.settings);
  await dbSet("inventory", state.inventory);
  await dbSet("plan", state.plan);
  await dbSet("weekNum", state.weekNum);
  await dbSet("budget", state.budget);
}

async function loadState() {
  state.settings = { ...defaultSettings(), ...(await dbGet("settings", {})) };
  state.inventory = (await dbGet("inventory", {})) || {};
  state.weekNum = (await dbGet("weekNum", 1)) || 1;
  state.budget = { ...defaultBudgetLedger(), ...(await dbGet("budget", {})) };
  const savedPlan = await dbGet("plan", null);
  if (savedPlan?.length) state.plan = savedPlan;
  else state.plan = draftWeekPlan(state.data, state.settings, state.weekNum);
}

function dish(id) {
  return state.cat.dishes[id];
}

function applyProfile() {
  document.body.classList.toggle("profile-kitchen", state.settings.profile === "kitchen");
  document.body.classList.toggle("profile-command", state.settings.profile === "command");
  $$(".profile-switch button").forEach((b) => {
    b.classList.toggle("active", b.dataset.profile === state.settings.profile);
  });
  // kitchen default screen
  if (state.settings.profile === "kitchen" && ["budget", "family"].includes(state.screen)) {
    state.screen = "today";
  }
}

function setScreen(name) {
  state.screen = name;
  $$(".nav button").forEach((b) => b.classList.toggle("active", b.dataset.screen === name));
  $$(".panel").forEach((p) => p.classList.toggle("active", p.id === `screen-${name}`));
  renderScreen();
}

function renderScreen() {
  applyProfile();
  const map = {
    today: renderToday,
    plan: renderPlan,
    inventory: renderInventory,
    basket: renderBasket,
    recipes: renderRecipes,
    budget: renderBudget,
    family: renderFamily,
  };
  map[state.screen]?.();
}

/* ——— TODAY ——— */
function renderToday() {
  const idx = planDayIndex(state.plan);
  const day = state.plan[idx];
  const root = $("#screen-today");
  if (!day) {
    root.innerHTML = `<div class="card"><p>Плана нет. Откройте «План» и сгенерируйте неделю.</p></div>`;
    return;
  }
  const meals = [
    ["Завтрак", day.breakfast],
    ["Обед", day.lunch],
    ["Ужин", day.dinner],
    ["Перекус", day.snacks?.[0]],
    ["Перекус 2", day.snacks?.[1]],
  ];
  root.innerHTML = `
    <div class="card">
      <h2>${day.dayName}: что готовим</h2>
      <p class="meta">${day.cookHint || ""}</p>
      <div class="chips">
        <span class="chip">Неделя ${state.weekNum}</span>
        <span class="chip">День ${idx + 1}/7</span>
      </div>
      <div id="today-meals"></div>
      <div class="row" style="margin-top:14px">
        <button class="btn btn-primary" id="btn-cook-dinner">Готовлю ужин</button>
        <button class="btn btn-ghost" id="btn-swap-dinner">Заменить ужин</button>
        <button class="btn btn-ghost" id="btn-from-inv">Из запасов</button>
      </div>
    </div>`;
  const box = $("#today-meals");
  meals.forEach(([label, id]) => {
    const d = dish(id);
    if (!d) return;
    const row = document.createElement("div");
    row.className = "meal-row";
    row.innerHTML = `<b>${label}</b><span>${d.name}</span><span class="price">~${rub(d.costPerServing)}/порц</span>`;
    row.onclick = () => openRecipe(id);
    box.appendChild(row);
  });
  $("#btn-cook-dinner").onclick = () => openRecipe(day.dinner, { kitchen: true });
  $("#btn-swap-dinner").onclick = () => swapMeal(idx, "dinner");
  $("#btn-from-inv").onclick = () => setScreen("inventory");
}

async function swapMeal(dayIndex, mealKey) {
  const day = state.plan[dayIndex];
  const current = dish(day[mealKey]);
  if (!current) return;
  const alts = state.data.dishes
    .filter(
      (d) =>
        d.type === current.type &&
        d.id !== current.id &&
        !state.settings.disliked.includes(d.id)
    )
    .slice(0, 8);
  if (!alts.length) {
    toast("Нет замен в каталоге");
    return;
  }
  const pick = alts[Math.floor(Math.random() * Math.min(3, alts.length))];
  day[mealKey] = pick.id;
  state.plan = [...state.plan];
  await persist();
  toast(`Заменили на: ${pick.name}`);
  renderToday();
}

/* ——— PLAN ——— */
function renderPlan() {
  const root = $("#screen-plan");
  const cost = estimatePlanCost(state.plan, state.cat.dishes);
  root.innerHTML = `
    <div class="row">
      <label class="field">Неделя шаблона (1–12)
        <select id="week-select">${Array.from({ length: 12 }, (_, i) => `<option value="${i + 1}" ${state.weekNum === i + 1 ? "selected" : ""}>${i + 1}</option>`).join("")}</select>
      </label>
      <button class="btn btn-primary" id="gen-week">Авточерновик недели</button>
      <button class="btn btn-ghost" id="to-basket-week">В корзину на 7 дней</button>
    </div>
    <div class="grid stats">
      <div class="card"><div class="meta">Ориентир недели (семья)</div><strong style="font-size:1.3rem">${rub(cost)}</strong></div>
      <div class="card"><div class="meta">Цель готовки / мес</div><strong style="font-size:1.3rem">${rub(state.settings.cookingBudget)}</strong></div>
    </div>
    <div class="grid cards" id="plan-grid" style="margin-top:12px"></div>`;

  $("#week-select").onchange = (e) => {
    state.weekNum = +e.target.value;
  };
  $("#gen-week").onclick = async () => {
    state.plan = draftWeekPlan(state.data, state.settings, state.weekNum);
    await persist();
    toast("Неделя пересобрана");
    renderPlan();
  };
  $("#to-basket-week").onclick = () => setScreen("basket");

  const grid = $("#plan-grid");
  state.plan.forEach((day, idx) => {
    const el = document.createElement("div");
    el.className = "card";
    const isToday = idx === planDayIndex(state.plan);
    el.innerHTML = `<h3>${day.dayName}${isToday ? " · сегодня" : ""}</h3><p class="meta">${day.cookHint || ""}</p>`;
    ["breakfast", "lunch", "dinner"].forEach((key) => {
      const d = dish(day[key]);
      if (!d) return;
      const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
      const row = document.createElement("div");
      row.className = "meal-row";
      row.innerHTML = `<b>${labels[key]}</b><span>${d.name}</span><span class="price">${d.batchDays}д</span>`;
      row.onclick = () => openRecipe(d.id);
      el.appendChild(row);
    });
    const actions = document.createElement("div");
    actions.className = "row";
    const dislike = document.createElement("button");
    dislike.className = "btn btn-ghost";
    dislike.textContent = "Не хочу ужин";
    dislike.onclick = async (e) => {
      e.stopPropagation();
      const id = day.dinner;
      if (!state.settings.disliked.includes(id)) state.settings.disliked.push(id);
      await swapMeal(idx, "dinner");
      await persist();
      renderPlan();
    };
    actions.appendChild(dislike);
    el.appendChild(actions);
    grid.appendChild(el);
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
    <div class="card">
      <h2>Запасы</h2>
      <p class="meta">Введите что есть — получите блюда, на которые хватает. Быстрые чипы добавляют типичный остаток.</p>
      <div class="quick-chips" id="quick"></div>
      <div class="row">
        <label class="field">Режим
          <select id="match-mode">
            <option value="strict">Только если всё есть</option>
            <option value="almost" selected>Почти хватает (докупка до ~250 ₽)</option>
          </select>
        </label>
        <label class="field">Мин. порций
          <input type="number" id="min-serv" value="2" min="1" />
        </label>
        <button class="btn btn-primary" id="run-match">Показать блюда</button>
        <button class="btn btn-ghost" id="clear-inv">Сбросить запасы</button>
      </div>
    </div>
    <div class="inv-grid" id="inv-grid" style="margin-top:12px"></div>
    <div class="grid cards" id="match-results" style="margin-top:14px"></div>`;

  const quick = $("#quick");
  QUICK.forEach(([id, amt]) => {
    const p = state.cat.products[id];
    if (!p) return;
    const b = document.createElement("button");
    b.type = "button";
    b.textContent = `+ ${p.name}`;
    b.onclick = () => {
      state.inventory[id] = (state.inventory[id] || 0) + amt;
      persist();
      renderInventory();
      toast(`Добавили ${p.name}`);
    };
    quick.appendChild(b);
  });

  const grid = $("#inv-grid");
  // show products that have value OR all commonly used - show all for command, top used + filled for kitchen
  const list =
    state.settings.profile === "kitchen"
      ? state.data.products.filter((p) => (state.inventory[p.id] || 0) > 0 || QUICK.some(([id]) => id === p.id))
      : state.data.products;

  list.forEach((p) => {
    const el = document.createElement("label");
    el.className = "inv-item";
    el.innerHTML = `<span>${p.name}<br><span class="meta">${storeName(state.data.stores, p.store)} · ${p.unit}</span></span>`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.value = state.inventory[p.id] || "";
    input.placeholder = "0";
    input.dataset.pid = p.id;
    input.onchange = async () => {
      const v = parseFloat(input.value);
      if (!v) delete state.inventory[p.id];
      else state.inventory[p.id] = v;
      await persist();
    };
    el.appendChild(input);
    grid.appendChild(el);
  });

  $("#match-mode").value = state.matchMode;
  $("#match-mode").onchange = (e) => (state.matchMode = e.target.value);
  $("#run-match").onclick = runMatch;
  $("#clear-inv").onclick = async () => {
    state.inventory = {};
    await persist();
    renderInventory();
  };
}

function runMatch() {
  $$("#inv-grid input").forEach((inp) => {
    const id = inp.dataset.pid;
    if (!id) return;
    const v = parseFloat(inp.value);
    if (!v) delete state.inventory[id];
    else state.inventory[id] = v;
  });
  persist();

  const minServ = +$("#min-serv").value || 1;
  const results = matchFromInventory(
    state.data.dishes,
    state.cat.products,
    state.inventory,
    state.settings,
    { minServings: minServ, mode: state.matchMode }
  ).slice(0, 24);

  const box = $("#match-results");
  box.innerHTML = results.length
    ? ""
    : `<div class="card meta">Ничего не подобрали. Добавьте запасы чипами или введите количества.</div>`;
  results.forEach((r) => {
    const el = document.createElement("div");
    el.className = "card";
    el.style.cursor = "pointer";
    const pct = Math.round(r.coverage * 100);
    el.innerHTML = `
      <h3>${r.dish.name}</h3>
      <p class="meta">${r.why} · покрытие ${pct}% · ~${r.portions || "?"} порц</p>
      <div class="chips"><span class="chip">${r.dish.type}</span><span class="chip">${r.dish.timeMin} мин</span><span class="chip">партия ${rub(r.dish.costBatch)}</span></div>
      ${r.missing.length ? `<p class="meta" style="margin-top:8px">Докупить: ${r.missing.map((m) => m.name).slice(0, 4).join(", ")}</p>` : `<div class="okbox">Можно готовить сейчас</div>`}
    `;
    el.onclick = () => openRecipe(r.dish.id, { kitchen: true });
    box.appendChild(el);
  });
}

/* ——— BASKET ——— */
function renderBasket() {
  const root = $("#screen-basket");
  const slots = slotsFromPlan(state.plan, state.cat.dishes);
  const basket = buildBasket(slots, state.cat.dishes, state.cat.products, state.inventory);

  root.innerHTML = `
    <div class="card">
      <h2>Корзина на неделю</h2>
      <p class="meta">Собрано из плана × порции партий − текущие запасы. Разложено по магазинам.</p>
      <div class="grid stats">
        <div class="card" style="box-shadow:none"><div class="meta">Докупить</div><strong style="font-size:1.35rem">${rub(basket.total)}</strong></div>
        <div class="card" style="box-shadow:none"><div class="meta">Позиций</div><strong style="font-size:1.35rem">${Object.values(basket.byStore).reduce((s, g) => s + g.lines.length, 0)}</strong></div>
        <div class="card" style="box-shadow:none"><div class="meta">Уже есть (закрыто)</div><strong style="font-size:1.35rem">${basket.lines.filter((l) => l.covered).length}</strong></div>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="copy-basket">Скопировать список</button>
        <button class="btn btn-ghost" id="mark-bought">Отметить закупку в бюджете</button>
      </div>
    </div>
    <div class="grid cards" id="basket-stores" style="margin-top:12px"></div>
    <div class="card" style="margin-top:12px">
      <h3>Уже закрыто запасами</h3>
      <p class="meta">${basket.lines.filter((l) => l.covered).map((l) => l.name).slice(0, 30).join(", ") || "—"}</p>
    </div>`;

  const storesBox = $("#basket-stores");
  for (const [storeId, group] of Object.entries(basket.byStore)) {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = `<h3>${storeName(state.data.stores, storeId)}</h3><p class="meta">${state.data.stores[storeId]?.tip || ""} · ${rub(group.total)}</p>`;
    const table = document.createElement("table");
    table.className = "data";
    table.innerHTML = `<thead><tr><th>Продукт</th><th>Купить</th><th>₽</th></tr></thead>`;
    const tb = document.createElement("tbody");
    group.lines.forEach((l) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `<td>${l.name}${l.note ? `<div class="meta">${l.note}</div>` : ""}</td><td>${amountLabel(state.cat.products[l.id], l.buy)}</td><td>${rub(l.cost)}</td>`;
      tb.appendChild(tr);
    });
    table.appendChild(tb);
    el.appendChild(table);
    storesBox.appendChild(el);
  }

  $("#copy-basket").onclick = async () => {
    const text = basketToText(basket, state.data.stores);
    try {
      await navigator.clipboard.writeText(text);
      toast("Список скопирован");
    } catch {
      prompt("Скопируйте список:", text);
    }
  };
  $("#mark-bought").onclick = async () => {
    state.budget.cookingSpent = (state.budget.cookingSpent || 0) + Math.round(basket.total);
    await persist();
    toast(`В бюджет готовки +${rub(basket.total)}`);
  };
}

/* ——— RECIPES ——— */
function renderRecipes() {
  const root = $("#screen-recipes");
  if (!state.selectedRecipe) state.selectedRecipe = state.data.dishes[0]?.id;
  root.innerHTML = `
    <div class="row">
      <label class="field">Тип
        <select id="type-filter">
          <option value="all">Все</option>
          <option value="breakfast">Завтраки</option>
          <option value="soup">Супы</option>
          <option value="main">Основные</option>
          <option value="snack">Перекусы</option>
        </select>
      </label>
      <label class="field" style="flex:1;min-width:180px">Поиск
        <input id="recipe-q" placeholder="борщ, минтай, творог…" />
      </label>
    </div>
    <div class="recipe-layout">
      <div class="list" id="recipe-list"></div>
      <div class="card" id="recipe-view"></div>
    </div>`;
  const redraw = () => {
    const type = $("#type-filter").value;
    const q = ($("#recipe-q").value || "").toLowerCase();
    const list = $("#recipe-list");
    list.innerHTML = "";
    state.data.dishes
      .filter((d) => (type === "all" || d.type === type) && (!q || (d.name + d.ingredients.map((i) => state.cat.products[i.id]?.name || "").join(" ")).toLowerCase().includes(q)))
      .forEach((d) => {
        const b = document.createElement("button");
        b.textContent = `${d.name} · ${rub(d.costBatch)}`;
        if (d.id === state.selectedRecipe) b.classList.add("active");
        b.onclick = () => {
          state.selectedRecipe = d.id;
          $("#recipe-view").innerHTML = recipeHtml(d);
          redraw();
        };
        list.appendChild(b);
      });
    const cur = dish(state.selectedRecipe);
    if (cur) $("#recipe-view").innerHTML = recipeHtml(cur);
  };
  $("#type-filter").onchange = redraw;
  $("#recipe-q").oninput = redraw;
  redraw();
}

function recipeHtml(d, opts = {}) {
  const stores = [...new Set((d.stores || []).map((s) => storeName(state.data.stores, s)))].join(", ");
  const rows = (d.ingredients || [])
    .map((i) => {
      const p = state.cat.products[i.id];
      return `<tr><td>${p?.name || i.id}</td><td>${amountLabel(p, i.amount)}</td><td>${storeName(state.data.stores, p?.store)}</td><td>${rub((p?.price || 0) * i.amount)}</td></tr>`;
    })
    .join("");
  return `
    <h2 style="margin-top:0;font-family:var(--display)">${d.name}</h2>
    <div class="chips">
      <span class="chip">${d.type}</span>
      <span class="chip">batch ${d.batchDays} дн</span>
      <span class="chip">${d.servings} порц</span>
      <span class="chip">~${d.timeMin} мин</span>
      <span class="chip">партия ${rub(d.costBatch)}</span>
    </div>
    <p class="meta">Где купить: ${stores || "—"}</p>
    <div class="note"><b>Дочка:</b> ${d.child || "Без сахара/мёда/орехов; соль умеренно."}</div>
    ${opts.kitchen ? "" : ""}
    <h3>Ингредиенты на партию</h3>
    <table class="data"><thead><tr><th>Продукт</th><th>Кол-во</th><th>Магазин</th><th>₽</th></tr></thead><tbody>${rows}</tbody></table>
    <h3>Как готовить</h3>
    <ol class="steps">${(d.steps || []).map((s) => `<li>${s}</li>`).join("")}</ol>
    <div class="okbox">На порцию ~<b>${rub(d.costPerServing)}</b>. Разогрев ${d.batchDays} дн.</div>
    <div class="row">
      <button class="btn btn-warm" data-act="dislike">Не предлагать</button>
      <button class="btn btn-ghost" data-act="love">В любимое</button>
    </div>`;
}

function openRecipe(id, opts = {}) {
  state.selectedRecipe = id;
  const d = dish(id);
  if (!d) return;
  const modal = $("#modal");
  const body = $("#modal-body");
  body.innerHTML = recipeHtml(d, opts);
  body.querySelector('[data-act="dislike"]')?.addEventListener("click", async () => {
    if (!state.settings.disliked.includes(id)) state.settings.disliked.push(id);
    await persist();
    toast("Больше не предложим");
    modal.classList.remove("show");
  });
  body.querySelector('[data-act="love"]')?.addEventListener("click", async () => {
    if (!state.settings.loved.includes(id)) state.settings.loved.push(id);
    await persist();
    toast("В любимых");
  });
  modal.classList.add("show");
  if (state.screen === "recipes") renderRecipes();
}

/* ——— BUDGET ——— */
function renderBudget() {
  const root = $("#screen-budget");
  const s = state.settings;
  const b = state.budget;
  const totalPlan = s.cookingBudget + s.wineBudget + s.ginBudget + s.treatsBudget;
  const totalFact = (b.cookingSpent || 0) + (b.wineSpent || 0) + (b.ginSpent || 0) + (b.treatsSpent || 0);
  root.innerHTML = `
    <div class="grid stats">
      <div class="card"><div class="meta">План месяца</div><strong style="font-size:1.35rem">${rub(totalPlan)}</strong></div>
      <div class="card"><div class="meta">Факт</div><strong style="font-size:1.35rem">${rub(totalFact)}</strong></div>
      <div class="card"><div class="meta">Остаток плана</div><strong style="font-size:1.35rem">${rub(totalPlan - totalFact)}</strong></div>
    </div>
    <div class="card" style="margin-top:12px">
      <h2>Три контура</h2>
      <table class="data">
        <thead><tr><th>Статья</th><th>План</th><th>Факт</th><th>+ факт</th></tr></thead>
        <tbody>
          <tr><td>Готовка</td><td>${rub(s.cookingBudget)}</td><td>${rub(b.cookingSpent)}</td><td><input type="number" id="add-cooking" placeholder="0" style="min-width:90px;min-height:40px" /></td></tr>
          <tr><td>Вино</td><td>${rub(s.wineBudget)}</td><td>${rub(b.wineSpent)}</td><td><input type="number" id="add-wine" placeholder="0" style="min-width:90px;min-height:40px" /></td></tr>
          <tr><td>Джин (+тоник)</td><td>${rub(s.ginBudget)}</td><td>${rub(b.ginSpent)}</td><td><input type="number" id="add-gin" placeholder="0" style="min-width:90px;min-height:40px" /></td></tr>
          <tr><td>Вкусняшки</td><td>${rub(s.treatsBudget)}</td><td>${rub(b.treatsSpent)}</td><td><input type="number" id="add-treats" placeholder="0" style="min-width:90px;min-height:40px" /></td></tr>
        </tbody>
      </table>
      <div class="row">
        <button class="btn btn-primary" id="save-budget">Сохранить факт</button>
        <button class="btn btn-ghost" id="reset-budget-fact">Сбросить факт месяца</button>
      </div>
      <p class="meta">Вкусняшки ориентир ${rub(s.treatsWeekly)}/нед. Алкоголь учитываем честно, без нравоучений.</p>
    </div>`;

  $("#save-budget").onclick = async () => {
    const add = (id, key) => {
      const v = parseFloat($(id).value) || 0;
      state.budget[key] = (state.budget[key] || 0) + v;
    };
    add("#add-cooking", "cookingSpent");
    add("#add-wine", "wineSpent");
    add("#add-gin", "ginSpent");
    add("#add-treats", "treatsSpent");
    await persist();
    toast("Бюджет обновлён");
    renderBudget();
  };
  $("#reset-budget-fact").onclick = async () => {
    state.budget = defaultBudgetLedger();
    await persist();
    renderBudget();
  };
}

/* ——— FAMILY ——— */
function renderFamily() {
  const root = $("#screen-family");
  const s = state.settings;
  root.innerHTML = `
    <div class="card">
      <h2>Семья и правила</h2>
      <p class="meta">Жёсткие правила дочки и лимиты бюджета. Данные только на этом устройстве (IndexedDB).</p>
      <div class="note">Дочка: без сахара/мёда/орехов; соль и специи аккуратно; рыба — филе. Субпродукты — только печень.</div>
      <div class="row">
        <label class="field">Бюджет готовки / мес<input type="number" id="set-cooking" value="${s.cookingBudget}" /></label>
        <label class="field">Вино / мес<input type="number" id="set-wine" value="${s.wineBudget}" /></label>
        <label class="field">Джин потолок<input type="number" id="set-gin" value="${s.ginBudget}" /></label>
        <label class="field">Вкусняшки / мес<input type="number" id="set-treats" value="${s.treatsBudget}" /></label>
      </div>
      <div class="row">
        <button class="btn btn-primary" id="save-family">Сохранить</button>
        <button class="btn btn-ghost" id="export-data">Экспорт JSON</button>
        <button class="btn btn-ghost" id="import-data">Импорт JSON</button>
        <input type="file" id="import-file" accept="application/json" hidden />
      </div>
      <p class="meta">Дизлайков: ${s.disliked.length} · Любимых: ${s.loved.length}</p>
      <p class="footer-hint">Старый прототип меню: <a href="prototype.html">prototype.html</a> · Архитектура: <a href="docs/PRODUCT-ARCHITECTURE.md">docs/PRODUCT-ARCHITECTURE.md</a></p>
    </div>`;

  $("#save-family").onclick = async () => {
    state.settings.cookingBudget = +$("#set-cooking").value || 32000;
    state.settings.wineBudget = +$("#set-wine").value || 8000;
    state.settings.ginBudget = +$("#set-gin").value || 16000;
    state.settings.treatsBudget = +$("#set-treats").value || 10000;
    await persist();
    toast("Сохранено");
  };
  $("#export-data").onclick = async () => {
    const all = await dbExportAll();
    const blob = new Blob([JSON.stringify(all, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `semejnoe-menyu-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
  };
  $("#import-data").onclick = () => $("#import-file").click();
  $("#import-file").onchange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    await dbImportAll(JSON.parse(text));
    await loadState();
    toast("Импорт готов");
    renderScreen();
  };
}

/* ——— boot ——— */
async function boot() {
  if (!window.APP_DATA) {
    document.body.innerHTML = "<p style='padding:24px'>Не загрузились данные data/app-data.js</p>";
    return;
  }
  state.data = window.APP_DATA;
  state.cat = indexCatalog(state.data);
  await loadState();

  $$(".profile-switch button").forEach((b) => {
    b.onclick = async () => {
      state.settings.profile = b.dataset.profile;
      await persist();
      applyProfile();
      setScreen(state.settings.profile === "kitchen" ? "today" : state.screen);
      toast(state.settings.profile === "kitchen" ? "Режим «Кухня»" : "Командный центр");
    };
  });

  $$(".nav button").forEach((b) => {
    b.onclick = () => setScreen(b.dataset.screen);
  });

  $("#modal-close").onclick = () => $("#modal").classList.remove("show");
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal") $("#modal").classList.remove("show");
  });

  applyProfile();
  setScreen(state.settings.profile === "kitchen" ? "today" : "plan");
}

boot();
