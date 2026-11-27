/** UI: запасы, покупки (единый список), период */

import {
  rub,
  matchFromInventory,
  buildBasket,
  estimatePlanCost,
  slotsFromPlan,
  daysRu,
  buildPeriodPlan,
  recipeStockHint,
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
  emptyMealLot,
  defaultMealExpiry,
} from "./inventory.js";
import { makeEvent } from "./sync.js";
import { productIcon } from "./icons.js";

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
];

const ZONE_LABEL = { fridge: "Холодильник", freezer: "Морозилка", pantry: "Кладовка" };

function uid() {
  return `i_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function kbjuTable(p, amount) {
  if (!p) return "";
  const base = p.unit === "pcs" ? 1 : 100;
  const f = (amount || base) / base;
  const row = (label, per100, total) =>
    `<tr><th>${label}</th><td>${per100}</td><td><b>${Math.round(total * 10) / 10}</b></td></tr>`;
  return `<table class="sk-table kbju-table"><thead><tr><th></th><th>на ${p.unit === "pcs" ? "1 шт" : "100 г"}</th><th>партия</th></tr></thead><tbody>
    ${row("ккал", p.kcal || 0, (p.kcal || 0) * f)}
    ${row("Белки", p.protein || 0, (p.protein || 0) * f)}
    ${row("Жиры", p.fat || 0, (p.fat || 0) * f)}
    ${row("Углеводы", p.carbs || 0, (p.carbs || 0) * f)}
  </tbody></table>`;
}

export function createStockUi(ctx) {
  const { state, $, $$, toast, persistLocal, saveInventoryAndSync, openRecipe, setScreen } = ctx;

  function amounts() {
    return inventoryAmounts(state.inventory);
  }

  function guessZone(p) {
    return state.inventory[p?.id]?.zone || state.settings.invZones?.[p?.id] || p?.defaultZone || "pantry";
  }

  function expiringIds(within = 3) {
    const set = new Set();
    for (const [id, lot] of Object.entries(state.inventory || {})) {
      const st = expiryStatus(lot.expiresAt, within);
      if (st === "soon" || st === "expired") set.add(id);
    }
    return set;
  }

  function ensureList() {
    if (!Array.isArray(state.settings.shoppingList)) state.settings.shoppingList = [];
    if (!state.settings.basketPick) {
      state.settings.basketPick = {
        days: state.plan.map((_, i) => i),
        meals: { breakfast: true, lunch: true, dinner: true },
      };
    }
    return state.settings.shoppingList;
  }

  /* ——— INVENTORY ——— */
  function renderInventory() {
    const root = $("#screen-inventory");
    const tab = state._invTab || "products";
    const meals = state.settings.mealStock || [];
    root.innerHTML = `
      <div class="sk-seg sk-seg-wide" id="inv-tabs">
        <button type="button" data-tab="products" class="${tab === "products" ? "active" : ""}">Продукты</button>
        <button type="button" data-tab="meals" class="${tab === "meals" ? "active" : ""}">Блюда (${meals.length})</button>
      </div>
      <div id="inv-body"></div>`;
    $$("#inv-tabs [data-tab]").forEach((b) => {
      b.onclick = () => {
        state._invTab = b.dataset.tab;
        renderInventory();
      };
    });
    if (tab === "meals") return renderMeals($("#inv-body"));
    renderProducts($("#inv-body"));
  }

  function renderProducts(body) {
    const filter = state._invFilter || "have";
    const zoneF = state._invZone || "all";
    const q = (state._invQ || "").trim().toLowerCase();
    const cats = state.data.productCategories || [...new Set(state.data.products.map((p) => p.category))];
    const openId = state._invOpen || null;

    body.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:12px">
        <div class="sk-chip-row" id="quick"></div>
        <div class="sk-row">
          <label class="sk-field" style="flex:1;min-width:160px">Поиск<input class="sk-input" id="inv-q" value="${state._invQ || ""}" /></label>
          <label class="sk-field">Показ
            <select class="sk-select" id="inv-cat">
              <option value="have" ${filter === "have" ? "selected" : ""}>Что есть</option>
              <option value="all" ${filter === "all" ? "selected" : ""}>Весь каталог</option>
              <option value="expiring" ${filter === "expiring" ? "selected" : ""}>Истекает</option>
              ${cats.map((c) => `<option value="${c}" ${filter === c ? "selected" : ""}>${c}</option>`).join("")}
            </select>
          </label>
          <label class="sk-field">Зона
            <select class="sk-select" id="inv-zone">
              <option value="all">Все</option>
              ${Object.entries(ZONE_LABEL).map(([k, lab]) => `<option value="${k}" ${zoneF === k ? "selected" : ""}>${lab}</option>`).join("")}
            </select>
          </label>
        </div>
      </div>
      <div class="inv-table-wrap"><table class="sk-table inv-table"><thead><tr><th></th><th>Продукт</th><th>Кол-во</th><th>Зона</th><th>Срок</th></tr></thead><tbody id="inv-tb"></tbody></table></div>`;

    QUICK.forEach(([id, amt]) => {
      const p = state.cat.products[id];
      if (!p) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-chip";
      b.textContent = `${productIcon(p)} + ${p.name}`;
      b.onclick = async () => {
        const exp = new Date();
        exp.setDate(exp.getDate() + (p.shelfDays || 14));
        state.inventory = addInvAmount(state.inventory, id, amt, {
          zone: guessZone(p),
          boughtAt: new Date().toISOString().slice(0, 10),
          expiresAt: exp.toISOString().slice(0, 10),
        });
        await saveInventoryAndSync();
        renderInventory();
      };
      $("#quick").appendChild(b);
    });

    let list = state.data.products.slice();
    if (filter === "have") list = list.filter((p) => invAmount(state.inventory, p.id) > 0);
    else if (filter === "expiring") list = list.filter((p) => expiringIds().has(p.id));
    else if (filter !== "all") list = list.filter((p) => p.category === filter);
    if (zoneF !== "all") list = list.filter((p) => guessZone(p) === zoneF);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q));

    const tb = $("#inv-tb");
    list.forEach((p) => {
      const amt = invAmount(state.inventory, p.id);
      const lot = state.inventory[p.id] || {};
      const st = expiryStatus(lot.expiresAt);
      const tr = document.createElement("tr");
      tr.className = `inv-row ${amt ? "has" : ""} exp-${st} ${openId === p.id ? "open" : ""}`;
      tr.innerHTML = `<td><span class="prod-ico">${productIcon(p)}</span></td>
        <td><b>${p.name}</b><div class="sk-meta">${p.category}</div></td>
        <td>${amt ? formatAmount(amt, p) : "—"}</td>
        <td>${ZONE_LABEL[guessZone(p)]}</td>
        <td>${lot.expiresAt || "—"}</td>`;
      tr.onclick = () => {
        state._invOpen = state._invOpen === p.id ? null : p.id;
        renderInventory();
      };
      tb.appendChild(tr);
      if (openId === p.id) {
        const detail = document.createElement("tr");
        detail.className = "inv-detail";
        const disp =
          amt >= 1000 && p.unit === "g"
            ? { qty: amt / 1000, unit: "kg" }
            : amt >= 1000 && p.unit === "ml"
              ? { qty: amt / 1000, unit: "l" }
              : { qty: amt || "", unit: unitOptions(p)[0].value };
        detail.innerHTML = `<td colspan="5">
          <div class="sk-plan-form">
            <label class="sk-field">Кол-во<input class="sk-input" id="pe-qty" type="number" min="0" step="any" value="${disp.qty}" /></label>
            <label class="sk-field">Ед.<select class="sk-select" id="pe-unit">${unitOptions(p)
              .map((u) => `<option value="${u.value}" ${u.value === disp.unit ? "selected" : ""}>${u.label}</option>`)
              .join("")}</select></label>
            <label class="sk-field">Зона<select class="sk-select" id="pe-zone">${Object.entries(ZONE_LABEL)
              .map(([k, lab]) => `<option value="${k}" ${guessZone(p) === k ? "selected" : ""}>${lab}</option>`)
              .join("")}</select></label>
            <label class="sk-field">Купили<input class="sk-input" type="date" id="pe-bought" value="${lot.boughtAt || ""}" /></label>
            <label class="sk-field span-2">Годен до<input class="sk-input" type="date" id="pe-exp" value="${lot.expiresAt || ""}" /></label>
            <label class="sk-field span-2">Комментарий<input class="sk-input" id="pe-note" value="${(lot.note || "").replace(/"/g, "&quot;")}" /></label>
          </div>
          ${kbjuTable(p, amt || (p.unit === "pcs" ? 1 : 100))}
          <div class="sk-row" style="margin-top:10px">
            <button class="sk-btn sk-btn-primary" id="pe-save">Сохранить</button>
            <button class="sk-btn sk-btn-ghost" id="pe-del">Убрать</button>
          </div>
        </td>`;
        tb.appendChild(detail);
        detail.querySelector("#pe-save").onclick = async (e) => {
          e.stopPropagation();
          const base = toBaseAmount(+detail.querySelector("#pe-qty").value || 0, detail.querySelector("#pe-unit").value, p);
          const zone = detail.querySelector("#pe-zone").value;
          if (!state.settings.invZones) state.settings.invZones = {};
          state.settings.invZones[p.id] = zone;
          state.inventory = setInvAmount(state.inventory, p.id, base, {
            zone,
            boughtAt: detail.querySelector("#pe-bought").value || null,
            expiresAt: detail.querySelector("#pe-exp").value || null,
            note: detail.querySelector("#pe-note").value.trim(),
          });
          await saveInventoryAndSync();
          toast("Сохранено");
          renderInventory();
        };
        detail.querySelector("#pe-del").onclick = async (e) => {
          e.stopPropagation();
          state.inventory = setInvAmount(state.inventory, p.id, 0);
          await saveInventoryAndSync();
          state._invOpen = null;
          renderInventory();
        };
      }
    });

    $("#inv-q").oninput = (e) => {
      state._invQ = e.target.value;
      clearTimeout(state._invQTimer);
      state._invQTimer = setTimeout(() => renderInventory(), 150);
    };
    $("#inv-cat").onchange = (e) => {
      state._invFilter = e.target.value;
      renderInventory();
    };
    $("#inv-zone").onchange = (e) => {
      state._invZone = e.target.value;
      renderInventory();
    };
  }

  function renderMeals(body) {
    const meals = state.settings.mealStock || [];
    body.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:12px">
        <div class="shop-add">
          <input class="sk-input" id="meal-q" placeholder="Найти блюдо…" style="flex:1" />
          <input class="sk-input" id="meal-portions" type="number" min="1" value="4" style="max-width:90px" />
          <button class="sk-btn sk-btn-accent" id="meal-add">В запас</button>
        </div>
        <div class="shop-ac-list" id="meal-ac" style="display:none;position:relative"></div>
      </div>
      <div class="shop-list" id="meal-list"></div>`;
    let picked = null;
    const ac = $("#meal-ac");
    $("#meal-q").oninput = () => {
      const q = $("#meal-q").value.trim().toLowerCase();
      if (q.length < 2) {
        ac.style.display = "none";
        return;
      }
      const hits = state.data.dishes.filter((d) => d.name.toLowerCase().includes(q)).slice(0, 8);
      ac.style.display = "block";
      ac.innerHTML = hits
        .map((d) => `<button type="button" data-id="${d.id}">${d.name}</button>`)
        .join("") || `<div class="sk-meta" style="padding:10px">Нет</div>`;
      ac.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          picked = b.dataset.id;
          $("#meal-q").value = state.cat.dishes[picked].name;
          ac.style.display = "none";
        };
      });
    };
    $("#meal-add").onclick = async () => {
      if (!picked) return toast("Выберите блюдо из подсказки");
      const d = state.cat.dishes[picked];
      state.settings.mealStock.push(
        emptyMealLot({
          recipeId: d.id,
          name: d.name,
          portions: +$("#meal-portions").value || 1,
          cookedAt: new Date().toISOString().slice(0, 10),
          expiresAt: defaultMealExpiry(d.batchDays || 2),
        })
      );
      await persistLocal();
      renderInventory();
    };
    const box = $("#meal-list");
    if (!meals.length) box.innerHTML = `<div class="sk-note">Нет готовых блюд.</div>`;
    meals.forEach((m) => {
      const st = expiryStatus(m.expiresAt);
      const row = document.createElement("div");
      row.className = `shop-item exp-${st}`;
      row.innerHTML = `<div style="flex:1"><b>${m.name}</b><div class="sk-meta">${m.portions} порц · до ${m.expiresAt || "—"}</div></div>
        <button type="button" class="sk-btn sk-btn-ghost" data-eat style="min-height:40px">−1</button>
        <button type="button" class="shop-del" data-del>×</button>`;
      row.querySelector("[data-eat]").onclick = async () => {
        m.portions -= 1;
        if (m.portions <= 0) state.settings.mealStock = state.settings.mealStock.filter((x) => x.id !== m.id);
        await persistLocal();
        renderInventory();
      };
      row.querySelector("[data-del]").onclick = async () => {
        state.settings.mealStock = state.settings.mealStock.filter((x) => x.id !== m.id);
        await persistLocal();
        renderInventory();
      };
      box.appendChild(row);
    });
  }

  /* ——— UNIFIED SHOPPING LIST ——— */
  function mergePlanIntoList() {
    const pick = state.settings.basketPick;
    const slots = slotsFromPlan(state.plan, state.cat.dishes, pick);
    const basket = buildBasket(slots, state.cat.dishes, state.cat.products, amounts());
    const list = ensureList();
    let added = 0;
    basket.lines
      .filter((l) => !l.covered)
      .forEach((l) => {
        const exists = list.find((x) => !x.done && x.productId === l.id);
        if (exists) {
          exists.amount = (exists.amount || 0) + l.buy;
          exists.text = `${l.name} — ${formatAmount(exists.amount, state.cat.products[l.id])}`;
        } else {
          list.push({
            id: uid(),
            text: `${l.name} — ${formatAmount(l.buy, state.cat.products[l.id])}`,
            productId: l.id,
            amount: l.buy,
            category: state.cat.products[l.id]?.category || "",
            comment: "",
            done: false,
            price: null,
            source: "plan",
            at: new Date().toISOString(),
          });
          added++;
        }
      });
    return added;
  }

  function renderBasket() {
    const root = $("#screen-basket");
    const list = ensureList();
    const pick = state.settings.basketPick;
    const open = list.filter((x) => !x.done);
    const done = list.filter((x) => x.done);

    root.innerHTML = `
      <div class="sk-stat-row">
        <div class="sk-stat"><span class="sk-meta">К покупке</span><b>${open.length}</b></div>
        <div class="sk-stat"><span class="sk-meta">Куплено</span><b>${done.length}</b></div>
        <div class="sk-stat"><span class="sk-meta">Сумма по чекам</span><b>${rub(done.reduce((s, x) => s + (x.price || 0), 0))}</b></div>
      </div>
      <div class="sk-card tone" style="margin-bottom:12px">
        <div class="sk-meta" style="margin-bottom:8px">Дни плана → в список (без цен — цену ставите галочкой в магазине)</div>
        <div class="sk-chip-row" id="pick-days"></div>
        <div class="sk-chip-row" id="pick-meals"></div>
        <button class="sk-btn sk-btn-accent" id="from-plan" style="margin-top:8px">Добавить нужное из плана</button>
      </div>
      <div class="sk-card" style="margin-bottom:12px">
        <div class="shop-add">
          <div class="shop-ac">
            <input class="sk-input sk-input-lg" id="shop-text" placeholder="Начните вводить: молоко, фарш…" autocomplete="off" />
            <div class="shop-ac-list" id="shop-ac" style="display:none"></div>
          </div>
          <input class="sk-input" id="shop-qty" type="number" min="0" step="any" placeholder="кол-во" style="max-width:100px" />
          <select class="sk-select" id="shop-unit" style="max-width:90px"><option value="g">г</option></select>
          <button class="sk-btn sk-btn-primary" id="shop-add">Добавить</button>
        </div>
        <input class="sk-input" id="shop-comment" placeholder="Комментарий к новой позиции (необяз.)" style="margin-top:8px;width:100%" />
      </div>
      <div class="shop-list" id="shop-open"></div>
      <h3 style="margin:16px 0 8px">Куплено</h3>
      <div class="shop-list" id="shop-done"></div>
      <div class="sk-row" style="margin-top:12px">
        <button class="sk-btn sk-btn-ghost" id="shop-clear-done">Очистить купленное</button>
        <button class="sk-btn sk-btn-ghost" id="shop-copy">Скопировать список</button>
      </div>`;

    state.plan.forEach((day, i) => {
      const on = pick.days.includes(i);
      const b = document.createElement("button");
      b.type = "button";
      b.className = `sk-chip ${on ? "on" : ""}`;
      b.textContent = day.dayName || `День ${i + 1}`;
      b.onclick = async () => {
        pick.days = on ? pick.days.filter((d) => d !== i) : [...pick.days, i].sort((a, c) => a - c);
        await persistLocal();
        renderBasket();
      };
      $("#pick-days").appendChild(b);
    });
    [
      ["breakfast", "Завтраки"],
      ["lunch", "Обеды"],
      ["dinner", "Ужины"],
    ].forEach(([k, lab]) => {
      const on = pick.meals[k] !== false;
      const b = document.createElement("button");
      b.type = "button";
      b.className = `sk-chip ${on ? "on" : ""}`;
      b.textContent = lab;
      b.onclick = async () => {
        pick.meals[k] = !on;
        await persistLocal();
        renderBasket();
      };
      $("#pick-meals").appendChild(b);
    });

    $("#from-plan").onclick = async () => {
      const n = mergePlanIntoList();
      await persistLocal();
      toast(n ? `+${n} позиций из плана` : "Уже в списке или всё есть в запасах");
      renderBasket();
    };

    let pickedProd = null;
    const fillUnits = (p) => {
      $("#shop-unit").innerHTML = unitOptions(p || { unit: "g" })
        .map((u) => `<option value="${u.value}">${u.label}</option>`)
        .join("");
    };
    fillUnits(null);
    const ac = $("#shop-ac");
    $("#shop-text").oninput = () => {
      const q = $("#shop-text").value.trim().toLowerCase();
      pickedProd = null;
      if (q.length < 1) {
        ac.style.display = "none";
        return;
      }
      const hits = state.data.products.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
      ac.style.display = hits.length ? "block" : "none";
      ac.innerHTML = hits
        .map(
          (p) =>
            `<button type="button" data-id="${p.id}">${productIcon(p)} ${p.name} <span class="sk-meta">${p.category}</span></button>`
        )
        .join("");
      ac.querySelectorAll("button").forEach((b) => {
        b.onclick = () => {
          pickedProd = state.cat.products[b.dataset.id];
          $("#shop-text").value = pickedProd.name;
          fillUnits(pickedProd);
          ac.style.display = "none";
        };
      });
    };

    const addItem = async () => {
      const textRaw = $("#shop-text").value.trim();
      if (!textRaw) return toast("Введите название");
      const p =
        pickedProd ||
        state.data.products.find((x) => x.name.toLowerCase() === textRaw.toLowerCase()) ||
        state.data.products.find((x) => textRaw.toLowerCase().includes(x.name.toLowerCase()));
      const qty = +$("#shop-qty").value || 0;
      const unit = $("#shop-unit").value;
      const amount = p && qty ? toBaseAmount(qty, unit, p) : null;
      const comment = $("#shop-comment").value.trim();
      ensureList().unshift({
        id: uid(),
        text: amount && p ? `${p.name} — ${formatAmount(amount, p)}` : textRaw,
        productId: p?.id || null,
        amount,
        category: p?.category || "",
        comment,
        done: false,
        price: null,
        source: "manual",
        at: new Date().toISOString(),
      });
      $("#shop-text").value = "";
      $("#shop-qty").value = "";
      $("#shop-comment").value = "";
      pickedProd = null;
      await persistLocal();
      renderBasket();
    };
    $("#shop-add").onclick = addItem;
    $("#shop-text").onkeydown = (e) => {
      if (e.key === "Enter") addItem();
    };

    const paint = (box, items, bought) => {
      if (!items.length) {
        box.innerHTML = `<div class="sk-note">${bought ? "Пока пусто" : "Список пуст — добавьте из плана или вручную"}</div>`;
        return;
      }
      items.forEach((it) => {
        const p = it.productId ? state.cat.products[it.productId] : null;
        const row = document.createElement("div");
        row.className = `shop-item ${it.done ? "done" : ""}`;
        row.innerHTML = `
          <button type="button" class="shop-check">${it.done ? "✓" : ""}</button>
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:8px;align-items:center">${p ? `<span class="prod-ico">${productIcon(p)}</span>` : ""}
              <input class="shop-edit" value="${(it.text || "").replace(/"/g, "&quot;")}" />
            </div>
            <div class="sk-meta">${it.category || ""}${it.amount && p ? ` · ${formatAmount(it.amount, p)}` : ""}${it.price != null ? ` · ${rub(it.price)}` : ""}</div>
            <input class="sk-input" data-comment placeholder="комментарий" value="${(it.comment || "").replace(/"/g, "&quot;")}" style="margin-top:6px;min-height:40px;width:100%" />
            ${
              !it.done
                ? ""
                : ""
            }
            <div class="price-pop" data-price-row style="display:none">
              <input class="sk-input" type="number" min="0" data-price placeholder="Цена ₽" style="max-width:120px" />
              <button class="sk-btn sk-btn-accent" data-price-ok style="min-height:40px">В запасы</button>
              <button class="sk-btn sk-btn-ghost" data-price-skip style="min-height:40px">Без цены</button>
            </div>
          </div>
          <button type="button" class="shop-del">×</button>`;

        row.querySelector(".shop-check").onclick = async () => {
          if (it.done) {
            it.done = false;
            it.price = null;
            await persistLocal();
            renderBasket();
            return;
          }
          const pop = row.querySelector("[data-price-row]");
          pop.style.display = "flex";
          row.querySelector("[data-price]")?.focus();
        };
        row.querySelector("[data-price-ok]")?.addEventListener("click", async () => {
          const price = Math.round(+row.querySelector("[data-price]").value || 0);
          await markBought(it, price);
        });
        row.querySelector("[data-price-skip]")?.addEventListener("click", async () => {
          await markBought(it, 0);
        });
        row.querySelector(".shop-edit").onchange = async (e) => {
          it.text = e.target.value.trim();
          await persistLocal();
        };
        row.querySelector("[data-comment]").onchange = async (e) => {
          it.comment = e.target.value.trim();
          await persistLocal();
        };
        row.querySelector(".shop-del").onclick = async () => {
          state.settings.shoppingList = state.settings.shoppingList.filter((x) => x.id !== it.id);
          await persistLocal();
          renderBasket();
        };
        box.appendChild(row);
      });
    };

    async function markBought(it, price) {
      it.done = true;
      it.price = price || 0;
      it.boughtAt = new Date().toISOString();
      if (it.productId && it.amount) {
        const p = state.cat.products[it.productId];
        const exp = new Date();
        exp.setDate(exp.getDate() + (p?.shelfDays || 14));
        state.inventory = addInvAmount(state.inventory, it.productId, it.amount, {
          zone: p?.defaultZone || "pantry",
          boughtAt: new Date().toISOString().slice(0, 10),
          expiresAt: exp.toISOString().slice(0, 10),
        });
      }
      if (price > 0) {
        state.events.push(
          makeEvent({
            type: "spend",
            category: "cooking",
            total: price,
            items: [{ id: it.productId, name: it.text, amount: it.amount, cost: price }],
          })
        );
        state.budget.cookingSpent = (state.budget.cookingSpent || 0) + price;
      }
      await persistLocal();
      toast(price ? `Куплено за ${rub(price)}` : "Куплено");
      renderBasket();
    }

    paint($("#shop-open"), open, false);
    paint($("#shop-done"), done, true);

    $("#shop-clear-done").onclick = async () => {
      state.settings.shoppingList = state.settings.shoppingList.filter((x) => !x.done);
      await persistLocal();
      renderBasket();
    };
    $("#shop-copy").onclick = async () => {
      const text = open.map((x) => `• ${x.text}${x.comment ? ` (${x.comment})` : ""}`).join("\n");
      try {
        await navigator.clipboard.writeText(text || "—");
        toast("Скопировано");
      } catch {
        prompt("Скопируйте:", text);
      }
    };
  }

  /* ——— PERIOD ——— */
  function renderPeriod() {
    const root = $("#screen-period");
    const per = state.settings.period || { days: 7, adults: 2, childPortions: 1, childAge: 1.5, mode: "recipes" };
    const start = state._periodStart || new Date().toISOString().slice(0, 10);
    const amt = amounts();
    const exp = expiringIds(3);

    root.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:14px">
        <div class="sk-plan-form">
          <label class="sk-field">Старт<input class="sk-input" type="date" id="per-start" value="${start}" /></label>
          <label class="sk-field">Дней<input class="sk-input" type="number" min="1" max="90" id="per-days" value="${per.days || 7}" /></label>
          <label class="sk-field">Взрослых<input class="sk-input" type="number" min="0" id="per-adults" value="${per.adults ?? 2}" /></label>
          <label class="sk-field">Детских порций<input class="sk-input" type="number" min="0" id="per-child" value="${per.childPortions ?? 1}" /></label>
          <label class="sk-field">Возраст ребёнка<input class="sk-input" type="number" step="0.5" id="per-age" value="${per.childAge ?? 1.5}" /></label>
          <label class="sk-field">Режим
            <select class="sk-select" id="per-mode">
              <option value="recipes">Разнообразие рецептов</option>
              <option value="products">От запасов</option>
              <option value="loved">Упор на любимое</option>
            </select>
          </label>
        </div>
        <div class="sk-row">
          <button class="sk-btn sk-btn-accent" id="per-build">Собрать (новый seed)</button>
          <button class="sk-btn sk-btn-primary" id="per-apply">В план</button>
        </div>
        <p class="sk-meta">Каждый сбор — другое меню: любимое↑, недавно ели↓, без повторов в окне.</p>
      </div>
      <div id="per-out"></div>`;

    $("#per-mode").value = per.mode || "recipes";

    const draw = (plan) => {
      const cost = estimatePlanCost(plan, state.cat.dishes);
      $("#per-out").innerHTML = `<div class="sk-forecast"><div><div class="sk-meta">Прогноз</div><div class="sk-kpi">${rub(cost)}</div></div>
        <div><div class="sk-meta">Дней</div><div class="sk-kpi" style="font-size:1.2rem">${plan.length}</div></div></div>
        <div class="sk-grid" id="per-grid"></div>`;
      plan.forEach((day) => {
        const col = document.createElement("div");
        col.className = "sk-col-4";
        let html = `<div class="sk-card"><h3 style="margin:0 0 8px;font-size:1.05rem">${day.label}</h3>`;
        ["breakfast", "lunch", "dinner"].forEach((key) => {
          const d = state.cat.dishes[day[key]];
          if (!d) return;
          const hint = recipeStockHint(d, amt, state.cat.products, exp);
          const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
          html += `<div class="sk-meal ${hint.expiring.length ? "exp-soon" : hint.coverage > 0.7 ? "stock-ok" : "stock-mid"}" data-rid="${d.id}" style="margin-top:6px"><b>${labels[key]}</b><div><div style="font-weight:750">${d.name}</div><div class="sk-meta">запасы ${Math.round(hint.coverage * 100)}%</div></div><div class="price">${hint.have}/${hint.total}</div></div>`;
        });
        html += `</div>`;
        col.innerHTML = html;
        col.querySelectorAll("[data-rid]").forEach((el) => {
          el.onclick = () => openRecipe(el.dataset.rid);
        });
        $("#per-grid").appendChild(col);
      });
      state._periodDraft = plan;
    };

    if (state._periodDraft?.length) draw(state._periodDraft);

    $("#per-build").onclick = () => {
      const opts = {
        startDate: $("#per-start").value,
        days: +$("#per-days").value || 7,
        adults: +$("#per-adults").value || 0,
        childPortions: +$("#per-child").value || 0,
        childAge: +$("#per-age").value || 1.5,
        mode: $("#per-mode").value,
        events: state.events,
        seed: Date.now() ^ Math.floor(Math.random() * 1e9),
      };
      // loved boost via temporary settings clone
      const settings = { ...state.settings };
      if (opts.mode === "loved") {
        settings.loved = [...(settings.loved || [])];
      }
      let plan = buildPeriodPlan(state.data, settings, opts);
      if (opts.mode === "products") {
        const matches = matchFromInventory(state.data.dishes, state.cat.products, amt, settings, {
          minServings: 2,
          mode: "almost",
        });
        const byType = { breakfast: [], soup: [], main: [] };
        matches.forEach((m) => {
          if (byType[m.dish.type]) byType[m.dish.type].push(m.dish);
        });
        plan = plan.map((day, i) => ({
          ...day,
          breakfast: byType.breakfast[i % Math.max(1, byType.breakfast.length)]?.id || day.breakfast,
          lunch: byType.soup[i % Math.max(1, byType.soup.length)]?.id || day.lunch,
          dinner: byType.main[i % Math.max(1, byType.main.length)]?.id || day.dinner,
        }));
      }
      state._periodStart = opts.startDate;
      state.settings.period = opts;
      draw(plan);
      toast("Новый вариант периода");
    };

    $("#per-apply").onclick = async () => {
      if (!state._periodDraft?.length) return toast("Сначала соберите");
      state.plan = state._periodDraft;
      await persistLocal();
      toast("В плане");
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
      })
    );
  }

  return {
    renderInventory,
    renderBasket,
    renderPeriod,
    closeProductModal: () => {},
    onCooked,
    amounts,
  };
}
