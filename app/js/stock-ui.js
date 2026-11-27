/** UI: запасы (продукты/блюда), корзина, планировщик периода */

import {
  storeName,
  rub,
  amountLabel,
  matchFromInventory,
  buildBasket,
  estimatePlanCost,
  slotsFromPlan,
  basketToText,
  daysRu,
  buildPeriodPlan,
  recipeStockHint,
  suggestReplacements,
  placeRecipeInPlan,
} from "./engine.js";
import {
  inventoryAmounts,
  invAmount,
  setInvAmount,
  addInvAmount,
  expiryStatus,
  unitOptions,
  toBaseAmount,
  formatAmount,
  nutritionLine,
  emptyMealLot,
  defaultMealExpiry,
} from "./inventory.js";
import { makeEvent } from "./sync.js";

function fmtDay(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("ru-RU", { day: "numeric", month: "short" });
}

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

function uid() {
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

export function createStockUi(ctx) {
  const {
    state,
    $,
    $$,
    toast,
    persistLocal,
    saveInventoryAndSync,
    openRecipe,
    setScreen,
  } = ctx;

  function amounts() {
    return inventoryAmounts(state.inventory);
  }

  function guessZone(p) {
    const z = state.inventory[p.id]?.zone || state.settings.invZones?.[p.id];
    if (z) return z;
    return p.defaultZone || "pantry";
  }

  function openProductModal(productId) {
    const p = state.cat.products[productId];
    if (!p) return;
    const lot = state.inventory[productId] || { amount: 0, boughtAt: "", expiresAt: "", zone: guessZone(p), note: "" };
    const disp = lot.amount
      ? (() => {
          const opts = unitOptions(p);
          if (p.unit === "g" && lot.amount >= 1000) return { qty: lot.amount / 1000, unit: "kg" };
          if (p.unit === "ml" && lot.amount >= 1000) return { qty: lot.amount / 1000, unit: "l" };
          return { qty: lot.amount, unit: opts[0].value };
        })()
      : { qty: "", unit: unitOptions(p)[0].value };

    $("#productModalTitle").textContent = p.name;
    $("#productModalBody").innerHTML = `
      <p class="sk-meta">${p.category || "продукт"} · ${storeName(state.data.stores, p.store)} · КБЖУ на ${p.unit === "pcs" ? "1 шт" : "100 г/мл"}: ${p.kcal || 0} ккал, Б ${p.protein || 0}, Ж ${p.fat || 0}, У ${p.carbs || 0}</p>
      <div class="sk-plan-form">
        <label class="sk-field">Количество
          <input class="sk-input" type="number" min="0" step="any" id="pm-qty" value="${disp.qty}" />
        </label>
        <label class="sk-field">Единица
          <select class="sk-select" id="pm-unit">
            ${unitOptions(p).map((o) => `<option value="${o.value}" ${o.value === disp.unit ? "selected" : ""}>${o.label}</option>`).join("")}
          </select>
        </label>
        <label class="sk-field">Зона
          <select class="sk-select" id="pm-zone">
            ${Object.entries(ZONE_LABEL).map(([k, lab]) => `<option value="${k}" ${(lot.zone || guessZone(p)) === k ? "selected" : ""}>${lab}</option>`).join("")}
          </select>
        </label>
        <label class="sk-field">Дата покупки
          <input class="sk-input" type="date" id="pm-bought" value="${lot.boughtAt || ""}" />
        </label>
        <label class="sk-field span-2">Срок годности (необязательно)
          <input class="sk-input" type="date" id="pm-exp" value="${lot.expiresAt || ""}" />
        </label>
        <label class="sk-field span-2">Заметка
          <input class="sk-input" id="pm-note" value="${(lot.note || "").replace(/"/g, "&quot;")}" placeholder="акция, открыта упаковка…" />
        </label>
      </div>
      <div class="sk-meta" id="pm-nut">${lot.amount ? nutritionLine(p, lot.amount) : "Укажите количество — посчитаем КБЖУ партии"}</div>
      <div class="sk-row">
        <button class="sk-btn sk-btn-primary" id="pm-save">Сохранить</button>
        <button class="sk-btn sk-btn-ghost" id="pm-del">Убрать из запасов</button>
      </div>`;

    const syncNut = () => {
      const base = toBaseAmount(+$("#pm-qty").value || 0, $("#pm-unit").value, p);
      $("#pm-nut").textContent = base ? nutritionLine(p, base) : "Укажите количество";
    };
    $("#pm-qty").oninput = syncNut;
    $("#pm-unit").onchange = syncNut;

    $("#pm-save").onclick = async () => {
      const base = toBaseAmount(+$("#pm-qty").value || 0, $("#pm-unit").value, p);
      const zone = $("#pm-zone").value;
      if (!state.settings.invZones) state.settings.invZones = {};
      state.settings.invZones[p.id] = zone;
      state.inventory = setInvAmount(state.inventory, p.id, base, {
        boughtAt: $("#pm-bought").value || null,
        expiresAt: $("#pm-exp").value || null,
        zone,
        note: $("#pm-note").value.trim(),
      });
      await saveInventoryAndSync();
      closeProductModal();
      toast("Запас сохранён");
      renderInventory();
    };
    $("#pm-del").onclick = async () => {
      state.inventory = setInvAmount(state.inventory, p.id, 0);
      await saveInventoryAndSync();
      closeProductModal();
      toast("Убрали");
      renderInventory();
    };
    $("#productModal")?.classList.add("show");
  }

  function closeProductModal() {
    $("#productModal")?.classList.remove("show");
  }

  function renderInventory() {
    const root = $("#screen-inventory");
    const tab = state._invTab || "products";
    const filter = state._invFilter || "all";
    const zoneF = state._invZone || "all";
    const q = (state._invQ || "").trim().toLowerCase();
    const stocked = Object.keys(state.inventory).length;
    const meals = state.settings.mealStock || [];
    const expN = [...expiringProductIds()].length + meals.filter((m) => expiryStatus(m.expiresAt) !== "ok" && expiryStatus(m.expiresAt) !== "none").length;

    root.innerHTML = `
      <div class="sk-hero">
        <h1>Запасы</h1>
        <p>Продукты и уже приготовленные блюда. Срок годности подсвечивается — удобно планировать, что съесть первым.</p>
      </div>
      <div class="sk-stat-row">
        <div class="sk-stat"><span class="sk-meta">Продуктов</span><b>${stocked}</b></div>
        <div class="sk-stat"><span class="sk-meta">Блюд в запасе</span><b>${meals.length}</b></div>
        <div class="sk-stat"><span class="sk-meta">С истекающим сроком</span><b>${expN}</b></div>
      </div>
      <div class="sk-seg sk-seg-wide" id="inv-tabs">
        <button type="button" data-tab="products" class="${tab === "products" ? "active" : ""}">Продукты</button>
        <button type="button" data-tab="meals" class="${tab === "meals" ? "active" : ""}">Блюда</button>
      </div>
      <div id="inv-body"></div>`;

    $$("#inv-tabs [data-tab]").forEach((b) => {
      b.onclick = () => {
        state._invTab = b.dataset.tab;
        renderInventory();
      };
    });

    if (tab === "meals") return renderMealStock($("#inv-body"));
    renderProductStock($("#inv-body"), { filter, zoneF, q });
  }

  function expiringProductIds(within = 3) {
    const set = new Set();
    for (const [id, lot] of Object.entries(state.inventory || {})) {
      const st = expiryStatus(lot.expiresAt, within);
      if (st === "soon" || st === "expired") set.add(id);
    }
    return set;
  }

  function renderProductStock(body, { filter, zoneF, q }) {
    const cats = state.data.productCategories || [...new Set(state.data.products.map((p) => p.category))];
    body.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:12px">
        <div class="sk-chip-row" id="quick"></div>
        <div class="sk-row">
          <label class="sk-field" style="flex:1;min-width:160px">Поиск
            <input class="sk-input" id="inv-q" value="${state._invQ || ""}" placeholder="название…" />
          </label>
          <label class="sk-field">Категория
            <select class="sk-select" id="inv-cat">
              <option value="all">Все</option>
              ${cats.map((c) => `<option value="${c}" ${filter === c ? "selected" : ""}>${c}</option>`).join("")}
              <option value="have" ${filter === "have" ? "selected" : ""}>Только есть</option>
              <option value="expiring" ${filter === "expiring" ? "selected" : ""}>Истекает</option>
            </select>
          </label>
          <label class="sk-field">Зона
            <select class="sk-select" id="inv-zone">
              <option value="all">Все зоны</option>
              ${Object.entries(ZONE_LABEL).map(([k, lab]) => `<option value="${k}" ${zoneF === k ? "selected" : ""}>${lab}</option>`).join("")}
            </select>
          </label>
          <button class="sk-btn sk-btn-primary" id="run-match">Что приготовить</button>
        </div>
      </div>
      <div class="inv-table-wrap"><table class="sk-table inv-table" id="inv-table"><thead><tr><th>Продукт</th><th>Кол-во</th><th>Зона</th><th>Срок</th><th></th></tr></thead><tbody></tbody></table></div>
      <div class="sk-grid" id="match-results" style="margin-top:14px"></div>`;

    QUICK.forEach(([id, amt]) => {
      const p = state.cat.products[id];
      if (!p) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-chip";
      b.textContent = `+ ${p.name}`;
      b.onclick = async () => {
        const shelf = p.shelfDays || 14;
        const exp = new Date();
        exp.setDate(exp.getDate() + shelf);
        state.inventory = addInvAmount(state.inventory, id, amt, {
          zone: guessZone(p),
          boughtAt: new Date().toISOString().slice(0, 10),
          expiresAt: exp.toISOString().slice(0, 10),
        });
        await saveInventoryAndSync();
        toast(`+ ${p.name}`);
        renderInventory();
      };
      $("#quick").appendChild(b);
    });

    let list = state.data.products.slice();
    if (filter === "have") list = list.filter((p) => invAmount(state.inventory, p.id) > 0);
    else if (filter === "expiring") list = list.filter((p) => expiringProductIds().has(p.id));
    else if (filter !== "all") list = list.filter((p) => p.category === filter);
    if (zoneF !== "all") list = list.filter((p) => guessZone(p) === zoneF);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));
    list.sort((a, b) => {
      const ea = state.inventory[a.id]?.expiresAt || "9999";
      const eb = state.inventory[b.id]?.expiresAt || "9999";
      const ha = invAmount(state.inventory, a.id) > 0 ? 0 : 1;
      const hb = invAmount(state.inventory, b.id) > 0 ? 0 : 1;
      return ha - hb || String(ea).localeCompare(String(eb)) || a.name.localeCompare(b.name);
    });

    const tb = $("#inv-table tbody");
    list.forEach((p) => {
      const amt = invAmount(state.inventory, p.id);
      const lot = state.inventory[p.id];
      const st = expiryStatus(lot?.expiresAt);
      const tr = document.createElement("tr");
      tr.className = `inv-row ${amt ? "has" : ""} exp-${st}`;
      tr.innerHTML = `
        <td><b>${p.name}</b><div class="sk-meta">${p.category}${amt ? ` · ${nutritionLine(p, amt)}` : ""}</div></td>
        <td>${amt ? formatAmount(amt, p) : "—"}</td>
        <td>${ZONE_LABEL[guessZone(p)] || "—"}</td>
        <td>${lot?.expiresAt ? lot.expiresAt : "—"}</td>
        <td><button type="button" class="sk-btn sk-btn-ghost" style="min-height:40px">Открыть</button></td>`;
      tr.onclick = () => openProductModal(p.id);
      tb.appendChild(tr);
    });

    $("#inv-q").oninput = (e) => {
      state._invQ = e.target.value;
      clearTimeout(state._invQTimer);
      state._invQTimer = setTimeout(() => renderInventory(), 160);
    };
    $("#inv-cat").onchange = (e) => {
      state._invFilter = e.target.value;
      renderInventory();
    };
    $("#inv-zone").onchange = (e) => {
      state._invZone = e.target.value;
      renderInventory();
    };
    $("#run-match").onclick = () => {
      const results = matchFromInventory(state.data.dishes, state.cat.products, amounts(), state.settings, {
        minServings: 2,
        mode: "almost",
      }).slice(0, 18);
      const box = $("#match-results");
      const exp = expiringProductIds();
      box.innerHTML = results.length ? "" : `<div class="sk-col-12"><div class="sk-note">Ничего не подобрали.</div></div>`;
      results.forEach((r) => {
        const hint = recipeStockHint(r.dish, amounts(), state.cat.products, exp);
        const col = document.createElement("div");
        col.className = "sk-col-4";
        col.innerHTML = `<button type="button" class="sk-match ${hint.expiring.length ? "warn" : ""}"><strong>${r.dish.name}</strong><span class="sk-meta">${r.why} · ${Math.round(r.coverage * 100)}%</span>${hint.expiring.length ? `<span class="sk-tag hot">есть истекающие</span>` : `<span class="sk-tag ok">${daysRu(r.dish.batchDays)}</span>`}</button>`;
        col.querySelector("button").onclick = () => openRecipe(r.dish.id);
        box.appendChild(col);
      });
    };
  }

  function renderMealStock(body) {
    const meals = state.settings.mealStock || [];
    body.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:12px">
        <p class="sk-meta" style="margin:0 0 10px">После «Приготовил» блюдо появляется здесь с сроком хранения. Отметьте, когда порции закончились.</p>
        <div class="shop-add">
          <select class="sk-select" id="meal-recipe" style="flex:1;min-width:180px">
            ${state.data.dishes.slice(0, 200).map((d) => `<option value="${d.id}">${d.name}</option>`).join("")}
          </select>
          <input class="sk-input" id="meal-portions" type="number" min="1" value="4" style="max-width:90px" />
          <button class="sk-btn sk-btn-accent" id="meal-add">В запас блюд</button>
        </div>
      </div>
      <div class="shop-list" id="meal-list"></div>`;

    // richer select: use first 200 alphabetically is weak — use search later; for now all via filter
    const sel = $("#meal-recipe");
    sel.innerHTML = state.data.dishes
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 400)
      .map((d) => `<option value="${d.id}">${d.name}</option>`)
      .join("");

    const box = $("#meal-list");
    if (!meals.length) box.innerHTML = `<div class="sk-note">Готовых блюд пока нет.</div>`;
    meals
      .slice()
      .sort((a, b) => String(a.expiresAt || "").localeCompare(String(b.expiresAt || "")))
      .forEach((m) => {
        const st = expiryStatus(m.expiresAt);
        const row = document.createElement("div");
        row.className = `shop-item exp-${st}`;
        row.innerHTML = `
          <div style="flex:1">
            <b>${m.name}</b>
            <div class="sk-meta">${m.portions} порц · ${ZONE_LABEL[m.zone] || m.zone} · до ${m.expiresAt || "—"} · приготовлено ${m.cookedAt || "—"}</div>
          </div>
          <button type="button" class="sk-btn sk-btn-ghost" data-eat style="min-height:40px">−1 порц</button>
          <button type="button" class="shop-del" data-del>×</button>`;
        row.querySelector("[data-eat]").onclick = async () => {
          m.portions = Math.max(0, (+m.portions || 0) - 1);
          if (m.portions <= 0) state.settings.mealStock = state.settings.mealStock.filter((x) => x.id !== m.id);
          await persistLocal();
          renderInventory();
        };
        row.querySelector("[data-del]").onclick = async () => {
          state.settings.mealStock = state.settings.mealStock.filter((x) => x.id !== m.id);
          await persistLocal();
          renderInventory();
        };
        if (m.recipeId) {
          row.querySelector("b").style.cursor = "pointer";
          row.querySelector("b").onclick = () => openRecipe(m.recipeId);
        }
        box.appendChild(row);
      });

    $("#meal-add").onclick = async () => {
      const id = $("#meal-recipe").value;
      const d = state.cat.dishes[id];
      if (!d) return;
      const portions = Math.max(1, +$("#meal-portions").value || 1);
      state.settings.mealStock.push(
        emptyMealLot({
          recipeId: id,
          name: d.name,
          portions,
          cookedAt: new Date().toISOString().slice(0, 10),
          expiresAt: defaultMealExpiry(d.batchDays || 2),
          zone: "fridge",
        })
      );
      await persistLocal();
      toast("Блюдо в запасе");
      renderInventory();
    };
  }

  function ensureBasketPick() {
    if (!state.settings.basketPick) {
      state.settings.basketPick = {
        days: state.plan.map((_, i) => i),
        meals: { breakfast: true, lunch: true, dinner: true },
      };
    }
    if (!Array.isArray(state.settings.shoppingList)) state.settings.shoppingList = [];
    if (!Array.isArray(state.settings.treats)) state.settings.treats = [];
    return state.settings.basketPick;
  }

  function renderBasket() {
    const root = $("#screen-basket");
    const pick = ensureBasketPick();
    const tab = state._basketTab || "plan";
    const slots = slotsFromPlan(state.plan, state.cat.dishes, pick);
    const basket = buildBasket(slots, state.cat.dishes, state.cat.products, amounts());
    const buyCount = Object.values(basket.byStore).reduce((s, g) => s + g.lines.length, 0);
    const listOpen = (state.settings.shoppingList || []).filter((x) => !x.done).length;
    const weekStart = Date.now() - 7 * 86400000;
    const treatsWeek = (state.settings.treats || []).filter((t) => new Date(t.at).getTime() > weekStart);
    const treatsSum = treatsWeek.reduce((s, t) => s + (t.cost || 0), 0);
    const treatsCap = state.settings.treatsWeekly || 2500;

    root.innerHTML = `
      <div class="sk-hero">
        <h1>Корзина</h1>
        <p>Из отмеченных слотов плана. Галочка у позиции — сразу в запасы того же продукта. Список — свободные пункты для магазина.</p>
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

    body.innerHTML = `
      <div class="sk-stat-row">
        <div class="sk-stat"><span class="sk-meta">Докупить</span><b>${rub(basket.total)}</b></div>
        <div class="sk-stat"><span class="sk-meta">Позиций</span><b>${buyCount}</b></div>
        <div class="sk-stat"><span class="sk-meta">Уже есть</span><b>${basket.lines.filter((l) => l.covered).length}</b></div>
      </div>
      <div class="sk-card" style="margin-bottom:14px">
        <div class="sk-meta" style="margin-bottom:8px">Слоты для закупки</div>
        <div class="sk-chip-row" id="pick-days"></div>
        <div class="sk-chip-row" id="pick-meals"></div>
      </div>
      <div class="sk-card" style="margin-bottom:14px">
        <h3 style="margin-top:0">Добавить продукт вручную</h3>
        <div class="shop-add">
          <select class="sk-select" id="man-prod" style="flex:2;min-width:160px"></select>
          <input class="sk-input" id="man-qty" type="number" min="0" step="any" placeholder="кол-во" style="max-width:100px" />
          <select class="sk-select" id="man-unit" style="max-width:90px"></select>
          <button class="sk-btn sk-btn-accent" id="man-add">В список</button>
        </div>
      </div>
      <div class="sk-row" style="margin-bottom:12px">
        <button class="sk-btn sk-btn-primary" id="copy-basket">Скопировать</button>
        <button class="sk-btn sk-btn-accent" id="mark-checked">Отмеченные → в запасы</button>
      </div>
      <div class="store-cols" id="basket-stores"></div>`;

    const prodSel = $("#man-prod");
    state.data.products
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((p) => {
        const o = document.createElement("option");
        o.value = p.id;
        o.textContent = `${p.name} · ${p.category}`;
        prodSel.appendChild(o);
      });
    const fillUnits = () => {
      const p = state.cat.products[prodSel.value];
      $("#man-unit").innerHTML = unitOptions(p)
        .map((u) => `<option value="${u.value}">${u.label}</option>`)
        .join("");
    };
    fillUnits();
    prodSel.onchange = fillUnits;
    $("#man-add").onclick = async () => {
      const p = state.cat.products[prodSel.value];
      const base = toBaseAmount(+$("#man-qty").value || 0, $("#man-unit").value, p);
      if (!p || !base) return toast("Укажите количество");
      state.settings.shoppingList.unshift({
        id: uid(),
        text: `${p.name} — ${formatAmount(base, p)}`,
        productId: p.id,
        amount: base,
        done: false,
        store: p.store,
        category: p.category,
        at: new Date().toISOString(),
      });
      state._basketTab = "list";
      await persistLocal();
      renderBasket();
    };

    state.plan.forEach((day, i) => {
      const on = pick.days.includes(i);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `sk-chip ${on ? "on" : ""}`;
      b.textContent = day.dayName || day.label || `День ${i + 1}`;
      b.onclick = async () => {
        if (on) pick.days = pick.days.filter((d) => d !== i);
        else pick.days = [...pick.days, i].sort((a, c) => a - c);
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

    if (!state._basketChecks) state._basketChecks = {};
    const storesBox = $("#basket-stores");
    if (!buyCount) storesBox.innerHTML = `<div class="sk-note">По выбранным слотам докупать нечего.</div>`;
    for (const [storeId, group] of Object.entries(basket.byStore)) {
      const col = document.createElement("div");
      col.className = "store-block";
      col.innerHTML = `<div class="store-head"><h3>${storeName(state.data.stores, storeId)}</h3><span class="sk-kpi" style="font-size:1.15rem">${rub(group.total)}</span></div><ul class="shop-lines"></ul>`;
      const ul = col.querySelector("ul");
      group.lines.forEach((l) => {
        const checked = !!state._basketChecks[l.id];
        const li = document.createElement("li");
        li.innerHTML = `<label class="basket-check"><input type="checkbox" data-id="${l.id}" ${checked ? "checked" : ""} /><span><b>${l.name}</b><small>${state.cat.products[l.id]?.category || ""} · ${formatAmount(l.buy, state.cat.products[l.id])}</small></span></label><span>${rub(l.cost)}</span>`;
        li.querySelector("input").onchange = (e) => {
          state._basketChecks[l.id] = e.target.checked;
        };
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
    $("#mark-checked").onclick = async () => {
      const lines = basket.lines.filter((l) => !l.covered && state._basketChecks[l.id]);
      if (!lines.length) return toast("Отметьте галочками что купили");
      let sum = 0;
      lines.forEach((l) => {
        sum += l.cost;
        const p = state.cat.products[l.id];
        const shelf = p?.shelfDays || 14;
        const exp = new Date();
        exp.setDate(exp.getDate() + shelf);
        state.inventory = addInvAmount(state.inventory, l.id, l.buy, {
          zone: p?.defaultZone || guessZone(p || { id: l.id }),
          boughtAt: new Date().toISOString().slice(0, 10),
          expiresAt: exp.toISOString().slice(0, 10),
        });
        delete state._basketChecks[l.id];
      });
      state.events.push(
        makeEvent({
          type: "spend",
          category: "cooking",
          total: Math.round(sum),
          items: lines.map((l) => ({ id: l.id, name: l.name, buy: l.buy, amount: l.buy, cost: l.cost })),
        })
      );
      state.budget.cookingSpent = (state.budget.cookingSpent || 0) + Math.round(sum);
      await persistLocal();
      toast(`${lines.length} поз. → запасы`);
      renderBasket();
    };
  }

  function renderShopList(body) {
    const items = state.settings.shoppingList || [];
    body.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:14px">
        <h2 style="margin-top:0">Список в магазин</h2>
        <p class="sk-meta">Галочка = купили → если пункт привязан к продукту, он уйдёт в запасы.</p>
        <div class="shop-add">
          <input class="sk-input sk-input-lg" id="shop-text" placeholder="Молоко 2л, салфетки…" />
          <button class="sk-btn sk-btn-accent" id="shop-add">Добавить</button>
        </div>
      </div>
      <div class="shop-list" id="shop-list"></div>
      <div class="sk-row" style="margin-top:12px">
        <button class="sk-btn sk-btn-ghost" id="shop-clear-done">Убрать купленное</button>
        <button class="sk-btn sk-btn-ghost" id="shop-copy">Скопировать</button>
      </div>`;

    const box = $("#shop-list");
    if (!items.length) box.innerHTML = `<div class="sk-note">Список пуст.</div>`;
    items.forEach((it) => {
      const row = document.createElement("div");
      row.className = `shop-item ${it.done ? "done" : ""}`;
      row.innerHTML = `
        <button type="button" class="shop-check">${it.done ? "✓" : ""}</button>
        <div style="flex:1;min-width:0">
          <input class="shop-edit" value="${(it.text || "").replace(/"/g, "&quot;")}" />
          ${it.category ? `<div class="sk-meta">${it.category}</div>` : ""}
        </div>
        <button type="button" class="shop-del">×</button>`;
      row.querySelector(".shop-check").onclick = async () => {
        it.done = !it.done;
        if (it.done && it.productId && it.amount) {
          const p = state.cat.products[it.productId];
          const shelf = p?.shelfDays || 14;
          const exp = new Date();
          exp.setDate(exp.getDate() + shelf);
          state.inventory = addInvAmount(state.inventory, it.productId, it.amount, {
            zone: p?.defaultZone || "pantry",
            boughtAt: new Date().toISOString().slice(0, 10),
            expiresAt: exp.toISOString().slice(0, 10),
          });
          toast(`В запасы: ${p?.name || it.text}`);
        }
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
      const found = state.data.products.find((p) => text.toLowerCase().includes(p.name.toLowerCase()));
      state.settings.shoppingList.unshift({
        id: uid(),
        text,
        done: false,
        productId: found?.id || null,
        category: found?.category || null,
        at: new Date().toISOString(),
      });
      await persistLocal();
      renderBasket();
    };
    $("#shop-add").onclick = add;
    $("#shop-text").onkeydown = (e) => e.key === "Enter" && add();
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
        <div><div class="sk-meta">Вкусняшки за 7 дней</div><div class="sk-kpi">${rub(treatsSum)}</div></div>
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
    if (!treatsWeek.length) box.innerHTML = `<div class="sk-note">Пока пусто.</div>`;
    treatsWeek
      .slice()
      .reverse()
      .forEach((t) => {
        const row = document.createElement("div");
        row.className = "shop-item";
        row.innerHTML = `<span style="flex:1"><b>${t.name}</b><div class="sk-meta">${fmtDay(t.at)}</div></span><b>${rub(t.cost)}</b><button type="button" class="shop-del">×</button>`;
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
      renderBasket();
    };
  }

  function renderPeriod() {
    const root = $("#screen-period");
    const per = state.settings.period || { days: 7, adults: 2, childPortions: 1, childAge: 1.5, mode: "recipes" };
    const start = state._periodStart || new Date().toISOString().slice(0, 10);
    const mode = state._periodMode || per.mode || "recipes";
    const amt = amounts();
    const exp = expiringProductIds(3);
    const mealExp = (state.settings.mealStock || []).filter((m) => {
      const st = expiryStatus(m.expiresAt);
      return st === "soon" || st === "expired";
    });

    root.innerHTML = `
      <div class="sk-hero">
        <h1>План на период</h1>
        <p>Свои даты в приложении (облако между телефонами). Google Calendar не подключали — период считается от даты старта.</p>
      </div>
      <div class="sk-card tone" style="margin-bottom:14px">
        <div class="sk-plan-form">
          <label class="sk-field">Старт
            <input class="sk-input" type="date" id="per-start" value="${start}" />
          </label>
          <label class="sk-field">Дней
            <input class="sk-input" type="number" min="1" max="90" id="per-days" value="${per.days || 7}" />
          </label>
          <label class="sk-field">Взрослых
            <input class="sk-input" type="number" min="0" max="12" id="per-adults" value="${per.adults ?? 2}" />
          </label>
          <label class="sk-field">Детских порций
            <input class="sk-input" type="number" min="0" max="6" id="per-child" value="${per.childPortions ?? 1}" />
          </label>
          <label class="sk-field">Возраст ребёнка
            <input class="sk-input" type="number" min="0" max="18" step="0.5" id="per-age" value="${per.childAge ?? 1.5}" />
          </label>
          <label class="sk-field">Режим
            <select class="sk-select" id="per-mode">
              <option value="recipes" ${mode === "recipes" ? "selected" : ""}>От рецептов</option>
              <option value="products" ${mode === "products" ? "selected" : ""}>От продуктов</option>
            </select>
          </label>
        </div>
        <div class="sk-row">
          <button class="sk-btn sk-btn-accent" id="per-build">Собрать период</button>
          <button class="sk-btn sk-btn-primary" id="per-apply">Записать в план</button>
        </div>
      </div>
      ${
        mealExp.length || exp.size
          ? `<div class="sk-note"><b>Съесть раньше:</b> ${[
              ...mealExp.map((m) => m.name),
              ...[...exp].map((id) => state.cat.products[id]?.name).filter(Boolean),
            ]
              .slice(0, 8)
              .join(", ")}</div>`
          : ""
      }
      <div id="per-out"></div>`;

    const readPer = () => ({
      startDate: $("#per-start").value,
      days: +$("#per-days").value || 7,
      adults: +$("#per-adults").value || 0,
      childPortions: +$("#per-child").value || 0,
      childAge: +$("#per-age").value || 1.5,
      mode: $("#per-mode").value,
      weekNum: state.weekNum,
    });

    const draw = (plan) => {
      const cost = estimatePlanCost(plan, state.cat.dishes);
      const box = $("#per-out");
      box.innerHTML = `
        <div class="sk-forecast"><div><div class="sk-meta">Прогноз периода</div><div class="sk-kpi">${rub(cost)}</div></div>
        <div><div class="sk-meta">Дней</div><div class="sk-kpi" style="font-size:1.2rem">${plan.length}</div></div></div>
        <div class="sk-grid" id="per-grid"></div>`;
      const grid = $("#per-grid");
      plan.forEach((day) => {
        const col = document.createElement("div");
        col.className = "sk-col-4";
        let mealsHtml = "";
        ["breakfast", "lunch", "dinner"].forEach((key) => {
          const d = state.cat.dishes[day[key]];
          if (!d) return;
          const hint = recipeStockHint(d, amt, state.cat.products, exp);
          const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
          const cls = hint.expiring.length ? "exp-soon" : hint.coverage >= 0.85 ? "stock-ok" : hint.coverage >= 0.4 ? "stock-mid" : "stock-low";
          mealsHtml += `<div class="sk-meal ${cls}" data-rid="${d.id}"><b>${labels[key]}</b><div><div style="font-weight:750">${d.name}</div><div class="sk-meta">запасы ${Math.round(hint.coverage * 100)}%${hint.expiring.length ? " · истекает" : ""}</div></div><div class="price">${hint.have}/${hint.total}</div></div>`;
        });
        col.innerHTML = `<div class="sk-card"><h3 style="margin:0 0 8px;font-size:1.1rem">${day.label}</h3>${mealsHtml}</div>`;
        col.querySelectorAll("[data-rid]").forEach((el) => {
          el.onclick = () => openRecipe(el.dataset.rid);
        });
        grid.appendChild(col);
      });
      state._periodDraft = plan;
    };

    if (state._periodDraft?.length) draw(state._periodDraft);

    $("#per-build").onclick = () => {
      const opts = readPer();
      state._periodStart = opts.startDate;
      state._periodMode = opts.mode;
      state.settings.period = { ...opts };
      let plan = buildPeriodPlan(state.data, state.settings, opts);
      if (opts.mode === "products") {
        const matches = matchFromInventory(state.data.dishes, state.cat.products, amt, state.settings, {
          minServings: 2,
          mode: "almost",
        });
        const byType = { breakfast: [], soup: [], main: [], snack: [] };
        matches.forEach((m) => {
          const t = m.dish.type === "dessert" ? "snack" : m.dish.type;
          if (byType[t]) byType[t].push(m.dish);
        });
        plan = plan.map((day, i) => ({
          ...day,
          breakfast: byType.breakfast[i % Math.max(1, byType.breakfast.length)]?.id || day.breakfast,
          lunch: byType.soup[i % Math.max(1, byType.soup.length)]?.id || day.lunch,
          dinner: byType.main[i % Math.max(1, byType.main.length)]?.id || day.dinner,
        }));
      }
      // prefer meals that use expiring products
      if (exp.size) {
        const prefer = state.data.dishes.filter((d) => d.ingredients?.some((ing) => exp.has(ing.id)));
        plan = plan.map((day, i) => {
          const cand = prefer[i % Math.max(1, prefer.length)];
          if (cand && (cand.type === "main" || cand.type === "soup")) {
            return { ...day, dinner: cand.type === "main" ? cand.id : day.dinner, lunch: cand.type === "soup" ? cand.id : day.lunch };
          }
          return day;
        });
      }
      draw(plan);
      toast("Период собран");
    };

    $("#per-apply").onclick = async () => {
      if (!state._periodDraft?.length) return toast("Сначала соберите период");
      state.plan = state._periodDraft;
      state.settings.period = readPer();
      await persistLocal();
      toast("Записали в план");
      setScreen("plan");
    };
  }

  function onCooked(d, form) {
    state.settings.mealStock = state.settings.mealStock || [];
    state.settings.mealStock.push(
      emptyMealLot({
        recipeId: d.id,
        name: d.name,
        portions: form.servings,
        cookedAt: new Date().toISOString().slice(0, 10),
        expiresAt: defaultMealExpiry(form.days || d.batchDays || 2),
        zone: "fridge",
      })
    );
  }

  return {
    renderInventory,
    renderBasket,
    renderPeriod,
    openProductModal,
    closeProductModal,
    onCooked,
    suggestReplacements,
    amounts,
  };
}
