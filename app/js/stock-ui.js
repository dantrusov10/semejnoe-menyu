/** UI: запасы (модалка + пополнить), покупки, период */

import {
  rub,
  matchFromInventory,
  buildBasket,
  slotsFromPlan,
  buildPeriodPlan,
  recipeStockHint,
  proteinBalance,
  markBatchHints,
  daysRu,
} from "./engine.js";
import {
  inventoryAmounts,
  invAmount,
  setInvAmount,
  addInvAmount,
  expiryStatus,
  unitOptions,
  ALL_UNITS,
  toBaseAmount,
  formatAmount,
  fromBaseAmount,
  priceToTotal,
  emptyMealLot,
  defaultMealExpiry,
  inferBaseUnit,
} from "./inventory.js";
import { makeEvent } from "./sync.js";
import { productIcon } from "./icons.js";
import { avgUnitPrices, estimatePlanCostSmart, estimateDishCost, guessSpendCategory, SPEND_LABELS, priceHistory } from "./stats.js";
import { aiVision, compressImageFile, aiQuota } from "./ai.js";

const SHOP_TEMPLATES = [
  {
    id: "treats",
    name: "Вкусняшки недели",
    items: [
      { name: "Фуэт / колбаски", qty: 1, unit: "pcs", category: "treats" },
      { name: "Твёрдый сыр", qty: 200, unit: "g", category: "treats" },
      { name: "Чипсы", qty: 1, unit: "pack", category: "treats" },
      { name: "Сухарики", qty: 1, unit: "pack", category: "treats" },
    ],
  },
  {
    id: "gin",
    name: "Джин + тоник + лимон",
    items: [
      { name: "Джин", qty: 1, unit: "pcs", category: "alcohol" },
      { name: "Тоник", qty: 2, unit: "pcs", category: "alcohol" },
      { name: "Лимон", qty: 2, unit: "pcs", category: "alcohol" },
    ],
  },
  {
    id: "wine",
    name: "Вино (неделя)",
    items: [{ name: "Вино", qty: 2, unit: "pcs", category: "alcohol" }],
  },
  {
    id: "dairy",
    name: "Молочка базовая",
    items: [
      { name: "Молоко", qty: 2, unit: "l" },
      { name: "Творог", qty: 400, unit: "g" },
      { name: "Яйца", qty: 10, unit: "pcs" },
    ],
  },
];

const QUICK = [
  ["chicken_cheap", 1000],
  ["egg", 10],
  ["potato", 2000],
  ["milk", 1000],
  ["tvorog", 400],
  ["buckwheat", 800],
  ["mince_cheap", 500],
  ["pollock", 500],
];

const ZONE_LABEL = { fridge: "Холодильник", freezer: "Морозилка", pantry: "Кладовка" };

function uid(prefix = "i") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
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

  function allProducts() {
    return Object.values(state.cat.products);
  }

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
    if (!Array.isArray(state.settings.customProducts)) state.settings.customProducts = [];
    if (!state.settings.basketPick) {
      state.settings.basketPick = {
        days: state.plan.map((_, i) => i),
        meals: { breakfast: true, lunch: true, dinner: true },
      };
    }
    return state.settings.shoppingList;
  }

  function categoryOptions() {
    return [...new Set(allProducts().map((p) => p.category).filter(Boolean))].sort();
  }

  function setProductMeta(id, patch) {
    if (!state.settings.productMeta) state.settings.productMeta = {};
    state.settings.productMeta[id] = { ...(state.settings.productMeta[id] || {}), ...patch };
    const p = state.cat.products[id];
    if (p) Object.assign(p, patch);
    const custom = state.settings.customProducts?.find((x) => x.id === id);
    if (custom) Object.assign(custom, patch);
  }

  function registerCustomProduct({ name, unit, brand, photo, category }) {
    const id = `custom_${name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "_").slice(0, 40)}_${Math.random().toString(36).slice(2, 5)}`;
    const base = inferBaseUnit(unit) || "g";
    const product = {
      id,
      name: name.trim(),
      unit: base,
      price: 0,
      store: "ashan",
      category: category || "своё",
      kcal: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
      shelfDays: 14,
      defaultZone: "pantry",
      brand: brand || "",
      photo: photo || "",
      custom: true,
    };
    state.settings.customProducts.push(product);
    state.cat.products[id] = product;
    if (!state.data.products.find((p) => p.id === id)) state.data.products.push(product);
    return product;
  }

  /* ——— PRODUCT MODAL ——— */
  function openProductModal(productId, mode = "edit") {
    const p = state.cat.products[productId];
    if (!p && mode !== "restock-new") return;
    const lot = productId ? state.inventory[productId] || {} : {};
    const amt = productId ? invAmount(state.inventory, productId) : 0;
    const disp = amt ? fromBaseAmount(amt, p) : { qty: "", unit: unitOptions(p)[0]?.value || "g" };

    const cats = categoryOptions();
    const curCat = p?.category || state.settings.productMeta?.[productId]?.category || "";
    $("#productModalTitle").textContent = mode === "restock" || mode === "restock-new" ? "Пополнить запас" : p?.name || "Продукт";
    $("#productModalBody").innerHTML = `
      ${p ? `<div class="sk-row" style="align-items:center;margin-bottom:10px"><span class="prod-ico" style="width:52px;height:52px;font-size:1.6rem">${productIcon(p)}</span>
        <div><b>${p.name}</b>${p.brand ? `<div class="sk-meta">${p.brand}</div>` : ""}<div class="sk-meta">сейчас ${amt ? formatAmount(amt, p) : "нет"}</div></div></div>` : ""}
      ${p ? kbjuTable(p, amt || (p.unit === "pcs" ? 1 : 100)) : ""}
      <div class="sk-plan-form" style="margin-top:12px">
        ${!p ? `<label class="sk-field span-2">Название нового продукта<input class="sk-input" id="pm-name" placeholder="например: рисовая лапша" /></label>` : ""}
        <label class="sk-field span-2">Категория
          <input class="sk-input" id="pm-cat" list="pm-cat-list" value="${(curCat || "").replace(/"/g, "&quot;")}" placeholder="молочка, мясо, алкоголь…" />
          <datalist id="pm-cat-list">${cats.map((c) => `<option value="${c.replace(/"/g, "&quot;")}"></option>`).join("")}</datalist>
        </label>
        <label class="sk-field">Количество<input class="sk-input" type="number" min="0" step="any" id="pm-qty" value="${mode.startsWith("restock") ? "" : disp.qty}" placeholder="число" /></label>
        <label class="sk-field">Единица
          <select class="sk-select" id="pm-unit">${(p ? unitOptions(p) : ALL_UNITS).map((u) => `<option value="${u.value}" ${u.value === disp.unit ? "selected" : ""}>${u.label}</option>`).join("")}</select>
        </label>
        <label class="sk-field">Зона
          <select class="sk-select" id="pm-zone">${Object.entries(ZONE_LABEL).map(([k, lab]) => `<option value="${k}" ${(lot.zone || p?.defaultZone || "pantry") === k ? "selected" : ""}>${lab}</option>`).join("")}</select>
        </label>
        <label class="sk-field">Купили<input class="sk-input" type="date" id="pm-bought" value="${lot.boughtAt || new Date().toISOString().slice(0, 10)}" /></label>
        <label class="sk-field span-2">Годен до (необяз.)<input class="sk-input" type="date" id="pm-exp" value="${lot.expiresAt || ""}" /></label>
        <label class="sk-field span-2">Бренд (необяз.)<input class="sk-input" id="pm-brand" value="${(p?.brand || lot.brand || "").replace(/"/g, "&quot;")}" placeholder="Простоквашино…" /></label>
        <label class="sk-field span-2">Фото (необяз.)<input class="sk-input" type="file" id="pm-photo" accept="image/*" /></label>
        <label class="sk-field span-2">Комментарий<input class="sk-input" id="pm-note" value="${(lot.note || "").replace(/"/g, "&quot;")}" /></label>
      </div>
      <div class="sk-row" style="margin-top:12px">
        <button class="sk-btn sk-btn-primary" id="pm-save">${mode.startsWith("restock") ? "Добавить в запас" : "Сохранить"}</button>
        ${p && !mode.startsWith("restock") ? `<button class="sk-btn sk-btn-ghost" id="pm-del">Убрать из запасов</button>` : ""}
      </div>`;

    let photoData = p?.photo || "";
    $("#pm-photo")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 600000) return toast("Фото до ~600 КБ");
      const reader = new FileReader();
      reader.onload = () => {
        photoData = reader.result;
        toast("Фото прикреплено");
      };
      reader.readAsDataURL(file);
    });

    $("#pm-save").onclick = async () => {
      let prod = p;
      const catVal = ($("#pm-cat")?.value || "").trim() || "своё";
      const brandVal = $("#pm-brand").value.trim();
      if (!prod) {
        const name = $("#pm-name").value.trim();
        if (!name) return toast("Укажите название");
        prod = registerCustomProduct({
          name,
          unit: $("#pm-unit").value,
          brand: brandVal,
          photo: photoData,
          category: catVal,
        });
      }
      const addAmt = toBaseAmount(+$("#pm-qty").value || 0, $("#pm-unit").value, prod);
      if (!addAmt && mode.startsWith("restock")) return toast("Укажите количество");
      const zone = $("#pm-zone").value;
      if (!state.settings.invZones) state.settings.invZones = {};
      state.settings.invZones[prod.id] = zone;
      const metaPatch = { category: catVal, brand: brandVal };
      if (photoData) metaPatch.photo = photoData;
      setProductMeta(prod.id, metaPatch);
      const patch = {
        zone,
        boughtAt: $("#pm-bought").value || null,
        expiresAt: $("#pm-exp").value || null,
        note: $("#pm-note").value.trim(),
        brand: brandVal,
      };
      if (mode.startsWith("restock")) {
        state.inventory = addInvAmount(state.inventory, prod.id, addAmt, patch);
      } else {
        state.inventory = setInvAmount(state.inventory, prod.id, addAmt || 0, patch);
      }
      await saveInventoryAndSync();
      closeProductModal();
      toast(mode.startsWith("restock") ? "Пополнили запас" : "Сохранено");
      renderInventory();
    };
    $("#pm-del")?.addEventListener("click", async () => {
      state.inventory = setInvAmount(state.inventory, p.id, 0);
      await saveInventoryAndSync();
      closeProductModal();
      renderInventory();
    });
    $("#productModal")?.classList.add("show");
  }

  function closeProductModal() {
    $("#productModal")?.classList.remove("show");
  }

  function openVisionDraft(items, unknown) {
    $("#productModalTitle").textContent = "Черновик с фото";
    $("#productModalBody").innerHTML = `
      <p class="sk-meta">Проверьте позиции и отметьте, что добавить в запас. Неопознанное можно завести вручную.</p>
      ${unknown?.length ? `<div class="sk-note">Неясно: ${unknown.join(", ")}</div>` : ""}
      <div id="vis-list" style="margin-top:10px"></div>
      <div class="sk-row" style="margin-top:12px">
        <button class="sk-btn sk-btn-primary" id="vis-apply">Добавить отмеченные</button>
        <button class="sk-btn sk-btn-ghost" id="vis-cancel">Закрыть</button>
      </div>`;
    const list = $("#vis-list");
    items.forEach((it, idx) => {
      const row = document.createElement("div");
      row.className = "shop-item";
      row.innerHTML = `
        <input type="checkbox" data-on ${it.confidence >= 0.5 ? "checked" : ""} />
        <div style="flex:1">
          <input class="sk-input" data-name value="${(it.nameGuess || "").replace(/"/g, "&quot;")}" />
          <div class="sk-row" style="margin-top:6px;gap:6px">
            <input class="sk-input" type="number" min="0" step="any" data-qty value="${it.qty || 1}" style="max-width:90px" />
            <select class="sk-select" data-unit style="max-width:90px">${ALL_UNITS.map((u) => `<option value="${u.value}" ${u.value === (it.unit || "pcs") ? "selected" : ""}>${u.label}</option>`).join("")}</select>
            <span class="sk-meta">${it.productId ? "в каталоге" : "новый"} · ${Math.round((it.confidence || 0) * 100)}%</span>
          </div>
        </div>`;
      row.dataset.idx = String(idx);
      row._it = it;
      list.appendChild(row);
    });
    $("#vis-cancel").onclick = () => closeProductModal();
    $("#vis-apply").onclick = async () => {
      let n = 0;
      [...list.children].forEach((row) => {
        if (!row.querySelector("[data-on]")?.checked) return;
        const name = row.querySelector("[data-name]").value.trim();
        const qty = +row.querySelector("[data-qty]").value || 0;
        const unit = row.querySelector("[data-unit]").value;
        if (!name || !qty) return;
        let p = row._it.productId ? state.cat.products[row._it.productId] : null;
        if (!p) {
          p = allProducts().find((x) => x.name.toLowerCase() === name.toLowerCase());
        }
        if (!p) p = registerCustomProduct({ name, unit });
        const amount = toBaseAmount(qty, unit, p);
        state.inventory = addInvAmount(state.inventory, p.id, amount, {
          zone: p.defaultZone || "pantry",
          boughtAt: new Date().toISOString().slice(0, 10),
        });
        n += 1;
      });
      await saveInventoryAndSync();
      closeProductModal();
      toast(n ? `В запас +${n}` : "Ничего не отмечено");
      renderInventory();
    };
  }

  function openRestockFlow() {
    $("#productModalTitle").textContent = "Пополнить";
    $("#productModalBody").innerHTML = `
      <p class="sk-meta">Что появилось дома в обход списка покупок — выберите из каталога, создайте новое или сфотографируйте полку.</p>
      <div class="sk-row" style="margin-bottom:12px">
        <label class="sk-btn sk-btn-accent" style="cursor:pointer">С фото
          <input type="file" id="rs-photo" accept="image/*" capture="environment" hidden />
        </label>
        <span class="sk-meta" id="rs-ai-quota"></span>
      </div>
      <div class="shop-ac" style="margin-bottom:12px">
        <input class="sk-input sk-input-lg" id="rs-q" placeholder="Начните вводить название…" />
        <div class="shop-ac-list" id="rs-ac" style="display:none"></div>
      </div>
      <button class="sk-btn sk-btn-ghost sk-btn-block" id="rs-new">Создать новый продукт</button>`;
    aiQuota().then((q) => {
      if (q && $("#rs-ai-quota")) {
        $("#rs-ai-quota").textContent = q.gemini
          ? `фото сегодня ${q.vision}/${q.visionLimit}`
          : "vision: нужен GEMINI_API_KEY на Worker";
      }
    });
    $("#rs-photo")?.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      try {
        toast("Распознаём…");
        const { dataUrl, mimeType } = await compressImageFile(file);
        const knownProducts = allProducts().map((p) => ({ id: p.id, name: p.name, unit: p.unit }));
        const res = await aiVision({ image: dataUrl, mimeType, knownProducts });
        if (!res.items?.length) {
          toast(res.unknown?.length ? "Ничего не распознали" : "Пусто");
          return;
        }
        openVisionDraft(res.items, res.unknown);
      } catch (err) {
        toast(err.message || "Vision ошибка");
      }
    });
    const ac = $("#rs-ac");
    const rsQ = $("#rs-q");
    rsQ.oninput = () => {
      const q = rsQ.value.trim().toLowerCase();
      if (q.length < 1) {
        ac.style.display = "none";
        ac.innerHTML = "";
        return;
      }
      const hits = allProducts().filter((p) => p.name.toLowerCase().includes(q)).slice(0, 12);
      ac.style.display = hits.length ? "block" : "none";
      ac.innerHTML = hits
        .map((p) => `<button type="button" data-id="${p.id}">${productIcon(p)} ${p.name} <span class="sk-meta">${p.category || ""}</span></button>`)
        .join("");
      ac.querySelectorAll("button").forEach((b) => {
        b.onmousedown = (ev) => ev.preventDefault();
        b.onclick = () => openProductModal(b.dataset.id, "restock");
      });
    };
    $("#rs-new").onclick = () => openProductModal(null, "restock-new");
    $("#productModal")?.classList.add("show");
  }

  /* ——— INVENTORY ——— */
  function renderInventory() {
    const root = $("#screen-inventory");
    const tab = state._invTab || "products";
    const meals = state.settings.mealStock || [];
    root.innerHTML = `
      <div class="sk-row" style="margin-bottom:10px">
        <button class="sk-btn sk-btn-accent" id="btn-restock">Пополнить</button>
      </div>
      <div class="sk-seg sk-seg-wide" id="inv-tabs">
        <button type="button" data-tab="products" class="${tab === "products" ? "active" : ""}">Продукты</button>
        <button type="button" data-tab="meals" class="${tab === "meals" ? "active" : ""}">Блюда (${meals.length})</button>
      </div>
      <div id="inv-body"></div>`;
    $("#btn-restock").onclick = () => openRestockFlow();
    $$("#inv-tabs [data-tab]").forEach((b) => {
      b.onclick = () => {
        state._invTab = b.dataset.tab;
        renderInventory();
      };
    });
    if (tab === "meals") return renderMeals($("#inv-body"));
    renderProducts($("#inv-body"));
  }

  function filteredProducts() {
    const filter = state._invFilter || "have";
    const zoneF = state._invZone || "all";
    const q = (state._invQ || "").trim().toLowerCase();
    let list = allProducts().slice();
    if (filter === "have") list = list.filter((p) => invAmount(state.inventory, p.id) > 0);
    else if (filter === "expiring") list = list.filter((p) => expiringIds().has(p.id));
    else if (filter !== "all") list = list.filter((p) => p.category === filter);
    if (zoneF !== "all") list = list.filter((p) => guessZone(p) === zoneF);
    if (q) list = list.filter((p) => p.name.toLowerCase().includes(q) || (p.brand || "").toLowerCase().includes(q) || (p.category || "").toLowerCase().includes(q));
    return list;
  }

  function invSelected() {
    if (!state._invSelected) state._invSelected = new Set();
    return state._invSelected;
  }

  function updateInvBulkBar() {
    const bar = $("#inv-bulk");
    if (!bar) return;
    const n = invSelected().size;
    bar.style.display = n ? "flex" : "none";
    const lab = $("#inv-bulk-n");
    if (lab) lab.textContent = `Выбрано: ${n}`;
  }

  function paintInvRows() {
    const tb = $("#inv-tb");
    if (!tb) return;
    tb.innerHTML = "";
    const sel = invSelected();
    filteredProducts().forEach((p) => {
      const amt = invAmount(state.inventory, p.id);
      const lot = state.inventory[p.id] || {};
      const st = expiryStatus(lot.expiresAt);
      const tr = document.createElement("tr");
      tr.className = `inv-row ${amt ? "has" : ""} exp-${st}`;
      tr.innerHTML = `<td><input type="checkbox" data-sel ${sel.has(p.id) ? "checked" : ""} /></td>
        <td>${p.photo ? `<img src="${p.photo}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:10px" />` : `<span class="prod-ico">${productIcon(p)}</span>`}</td>
        <td style="cursor:pointer" data-open><b>${p.name}</b>${p.brand ? `<div class="sk-meta">${p.brand}</div>` : ""}<div class="sk-meta">${p.category || ""}</div></td>
        <td>${amt ? formatAmount(amt, p) : "—"}</td>
        <td>${ZONE_LABEL[guessZone(p)]}</td>
        <td>${lot.expiresAt || "—"}</td>`;
      tr.querySelector("[data-sel]").onclick = (e) => e.stopPropagation();
      tr.querySelector("[data-sel]").onchange = (e) => {
        if (e.target.checked) sel.add(p.id);
        else sel.delete(p.id);
        updateInvBulkBar();
      };
      tr.querySelector("[data-open]").onclick = () => openProductModal(p.id, "edit");
      tb.appendChild(tr);
    });
    updateInvBulkBar();
  }

  function renderCookFromExpiring(body) {
    const exp = expiringIds(3);
    if (!exp.size) return;
    const matches = matchFromInventory(state.data.dishes, state.cat.products, amounts(), state.settings, {
      minServings: 2,
      mode: "almost",
      maxMissingRub: 200,
    }).filter((m) => (m.dish.ingredients || []).some((ing) => exp.has(ing.id))).slice(0, 6);
    if (!matches.length) return;
    const card = document.createElement("div");
    card.className = "sk-card";
    card.style.marginBottom = "12px";
    card.innerHTML = `<h3 style="margin-top:0">Из того, что истекает</h3><p class="sk-meta">Блюда, которые спасут продукты со сроком</p><div class="sk-chip-row" id="exp-cook"></div>`;
    body.prepend(card);
    matches.forEach((m) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-chip";
      b.textContent = `${m.dish.name} · ${Math.round(m.coverage * 100)}%`;
      b.onclick = () => openRecipe(m.dish.id);
      card.querySelector("#exp-cook").appendChild(b);
    });
  }

  function renderProducts(body) {
    const filter = state._invFilter || "have";
    const zoneF = state._invZone || "all";
    const cats = categoryOptions();

    body.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:12px">
        <div class="sk-chip-row" id="quick"></div>
        <div class="sk-row">
          <label class="sk-field" style="flex:1;min-width:160px">Поиск<input class="sk-input" id="inv-q" value="${(state._invQ || "").replace(/"/g, "&quot;")}" autocomplete="off" /></label>
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
      <div class="sk-row inv-bulk" id="inv-bulk" style="display:none;margin-bottom:10px;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="sk-meta" id="inv-bulk-n">Выбрано: 0</span>
        <button class="sk-btn sk-btn-ghost" id="inv-sel-all" style="min-height:40px">Все на экране</button>
        <button class="sk-btn sk-btn-ghost" id="inv-sel-none" style="min-height:40px">Снять</button>
        <select class="sk-select" id="inv-bulk-zone" style="max-width:140px">
          ${Object.entries(ZONE_LABEL).map(([k, lab]) => `<option value="${k}">${lab}</option>`).join("")}
        </select>
        <button class="sk-btn sk-btn-ghost" id="inv-bulk-zone-go" style="min-height:40px">Зона</button>
        <button class="sk-btn sk-btn-accent" id="inv-bulk-clear" style="min-height:40px">Обнулить запас</button>
      </div>
      <div class="inv-table-wrap"><table class="sk-table inv-table"><thead><tr><th></th><th></th><th>Продукт</th><th>Кол-во</th><th>Зона</th><th>Срок</th></tr></thead><tbody id="inv-tb"></tbody></table></div>`;

    QUICK.forEach(([id]) => {
      const p = state.cat.products[id];
      if (!p) return;
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-chip";
      b.textContent = `${productIcon(p)} + ${p.name}`;
      b.onclick = () => openProductModal(id, "restock");
      $("#quick").appendChild(b);
    });

    paintInvRows();
    renderCookFromExpiring(body);

    $("#inv-q").oninput = (e) => {
      state._invQ = e.target.value;
      clearTimeout(state._invQTimer);
      state._invQTimer = setTimeout(() => paintInvRows(), 120);
    };
    $("#inv-cat").onchange = (e) => {
      state._invFilter = e.target.value;
      paintInvRows();
    };
    $("#inv-zone").onchange = (e) => {
      state._invZone = e.target.value;
      paintInvRows();
    };
    $("#inv-sel-all").onclick = () => {
      const sel = invSelected();
      filteredProducts().forEach((p) => sel.add(p.id));
      paintInvRows();
    };
    $("#inv-sel-none").onclick = () => {
      invSelected().clear();
      paintInvRows();
    };
    $("#inv-bulk-zone-go").onclick = async () => {
      const zone = $("#inv-bulk-zone").value;
      const sel = [...invSelected()];
      if (!sel.length) return;
      if (!state.settings.invZones) state.settings.invZones = {};
      sel.forEach((id) => {
        state.settings.invZones[id] = zone;
        if (state.inventory[id]) state.inventory[id].zone = zone;
      });
      await saveInventoryAndSync();
      toast(`Зона → ${ZONE_LABEL[zone]} · ${sel.length}`);
      paintInvRows();
    };
    $("#inv-bulk-clear").onclick = async () => {
      const sel = [...invSelected()];
      if (!sel.length) return;
      if (!confirm(`Обнулить запас у ${sel.length} поз.?`)) return;
      sel.forEach((id) => {
        state.inventory = setInvAmount(state.inventory, id, 0);
      });
      invSelected().clear();
      await saveInventoryAndSync();
      toast("Обнулили");
      paintInvRows();
    };
  }

  function renderMeals(body) {
    const meals = state.settings.mealStock || [];
    body.innerHTML = `<div class="shop-list" id="meal-list"></div>`;
    const box = $("#meal-list");
    if (!meals.length) box.innerHTML = `<div class="sk-note">Нет готовых блюд. В рецепте нажмите «Приготовил» и подтвердите списание.</div>`;
    meals.forEach((m) => {
      const st = expiryStatus(m.expiresAt);
      const row = document.createElement("div");
      row.className = `shop-item exp-${st}`;
      row.innerHTML = `<div style="flex:1;min-width:0"><b>${m.name}</b><div class="sk-meta">${m.portions} порц · до ${m.expiresAt || "—"}</div></div>
        <div class="sk-row" style="gap:6px;align-items:center;flex-wrap:wrap">
          ${m.recipeId ? `<button type="button" class="sk-btn sk-btn-ghost" data-cook style="min-height:40px">Приготовил</button>` : ""}
          <input class="sk-input" type="number" min="1" max="${Math.max(1, m.portions)}" value="1" data-n style="max-width:64px" />
          <button type="button" class="sk-btn sk-btn-accent" data-eat style="min-height:40px">Съел</button>
          <button type="button" class="shop-del" data-del>×</button>
        </div>`;
      row.querySelector("[data-cook]")?.addEventListener("click", () => openRecipe(m.recipeId));
      row.querySelector("[data-eat]").onclick = async () => {
        const n = Math.max(1, Math.min(m.portions || 1, +row.querySelector("[data-n]").value || 1));
        m.portions -= n;
        if (m.portions <= 0) state.settings.mealStock = state.settings.mealStock.filter((x) => x.id !== m.id);
        await persistLocal();
        toast(n === 1 ? "Съели 1 порцию" : `Съели ${n} порц.`);
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

  /* ——— SHOPPING ——— */
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
        const p = state.cat.products[l.id];
        const disp = fromBaseAmount(l.buy, p);
        if (exists) {
          exists.amount = (exists.amount || 0) + l.buy;
          exists.qty = fromBaseAmount(exists.amount, p).qty;
          exists.unit = fromBaseAmount(exists.amount, p).unit;
          exists.text = `${l.name} — ${formatAmount(exists.amount, p)}`;
        } else {
          list.push({
            id: uid(),
            text: `${l.name} — ${formatAmount(l.buy, p)}`,
            productId: l.id,
            amount: l.buy,
            qty: disp.qty,
            unit: disp.unit,
            category: p?.category || "",
            comment: "",
            brand: "",
            photo: "",
            done: false,
            price: null,
            priceMode: "total",
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
        <div class="sk-stat"><span class="sk-meta">По чекам</span><b>${rub(done.reduce((s, x) => s + (x.price || 0), 0))}</b></div>
      </div>
      <div class="sk-card tone" style="margin-bottom:12px">
        <div class="sk-meta" style="margin-bottom:8px">Дни плана → в список</div>
        <div class="sk-chip-row" id="pick-days"></div>
        <div class="sk-chip-row" id="pick-meals"></div>
        <button class="sk-btn sk-btn-accent" id="from-plan" style="margin-top:8px">Добавить нужное из плана</button>
      </div>
      <div class="sk-card" style="margin-bottom:12px">
        <div class="sk-meta" style="margin-bottom:6px">Шаблоны</div>
        <div class="sk-chip-row" id="shop-templates"></div>
      </div>
      <div class="sk-card" style="margin-bottom:12px">
        <div class="shop-add" style="align-items:stretch">
          <div class="shop-ac" style="flex:2">
            <input class="sk-input sk-input-lg" id="shop-text" placeholder="Продукт (новый сохранится в каталог)" autocomplete="off" />
            <div class="shop-ac-list" id="shop-ac" style="display:none"></div>
          </div>
          <input class="sk-input" id="shop-qty" type="number" min="0" step="any" placeholder="число" style="max-width:100px" />
          <select class="sk-select" id="shop-unit" style="max-width:100px">${ALL_UNITS.map((u) => `<option value="${u.value}">${u.label}</option>`).join("")}</select>
        </div>
        <div class="sk-row" style="margin-top:8px">
          <input class="sk-input" id="shop-brand" placeholder="Бренд (необяз.)" style="flex:1" />
          <input class="sk-input" id="shop-comment" placeholder="Комментарий" style="flex:1" />
          <button class="sk-btn sk-btn-primary" id="shop-add">Добавить</button>
        </div>
        <label class="sk-meta" style="display:block;margin-top:8px">Фото (необяз.) <input type="file" id="shop-photo" accept="image/*" /></label>
        <div class="sk-meta" id="shop-price-hist" style="margin-top:6px"></div>
      </div>
      <div class="sk-row shop-bulk" id="shop-bulk" style="display:none;margin-bottom:10px;gap:8px;flex-wrap:wrap;align-items:center">
        <span class="sk-meta" id="shop-bulk-n">Выбрано: 0</span>
        <button class="sk-btn sk-btn-ghost" id="shop-sel-all" style="min-height:40px">Все к покупке</button>
        <button class="sk-btn sk-btn-ghost" id="shop-sel-none" style="min-height:40px">Снять</button>
        <button class="sk-btn sk-btn-accent" id="shop-bulk-buy" style="min-height:40px">Куплено (без цены)</button>
        <button class="sk-btn sk-btn-ghost" id="shop-bulk-share" style="min-height:40px">Поделиться выбранным</button>
        <button class="sk-btn sk-btn-ghost" id="shop-bulk-del" style="min-height:40px">Удалить</button>
      </div>
      <div class="shop-list" id="shop-open"></div>
      <h3 style="margin:16px 0 8px">Куплено</h3>
      <div class="shop-list" id="shop-done"></div>
      <div class="sk-row" style="margin-top:12px">
        <button class="sk-btn sk-btn-accent" id="shop-share">Поделиться</button>
        <button class="sk-btn sk-btn-ghost" id="shop-copy">Скопировать</button>
        <button class="sk-btn sk-btn-ghost" id="shop-clear-done">Очистить купленное</button>
      </div>`;

    SHOP_TEMPLATES.forEach((tpl) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "sk-chip";
      b.textContent = tpl.name;
      b.onclick = async () => {
        const list = ensureList();
        let n = 0;
        for (const it of tpl.items) {
          let p = allProducts().find((x) => x.name.toLowerCase() === it.name.toLowerCase());
          if (!p) {
            p = registerCustomProduct({ name: it.name, unit: it.unit, category: it.category === "alcohol" ? "алкоголь" : it.category === "treats" ? "вкусняшки" : "своё" });
          }
          const amount = toBaseAmount(it.qty, it.unit, p);
          list.unshift({
            id: uid(),
            text: `${p.name} — ${it.qty} ${ALL_UNITS.find((u) => u.value === it.unit)?.label || it.unit}`,
            productId: p.id,
            amount,
            qty: it.qty,
            unit: it.unit,
            category: p.category || "",
            comment: tpl.name,
            brand: "",
            photo: "",
            done: false,
            price: null,
            priceMode: "total",
            spendCategory: it.category || "cooking",
            source: "template",
            at: new Date().toISOString(),
          });
          n += 1;
        }
        await persistLocal();
        toast(`+${n} из «${tpl.name}»`);
        renderBasket();
      };
      $("#shop-templates").appendChild(b);
    });

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
      toast(n ? `+${n} из плана` : "Уже в списке / всё есть");
      renderBasket();
    };

    let pickedProd = null;
    let photoData = "";
    const ac = $("#shop-ac");
    const shopText = $("#shop-text");
    shopText.oninput = () => {
      const q = shopText.value.trim().toLowerCase();
      pickedProd = null;
      if (q.length < 1) {
        ac.style.display = "none";
        ac.innerHTML = "";
        return;
      }
      const hits = allProducts().filter((p) => p.name.toLowerCase().includes(q)).slice(0, 10);
      ac.style.display = hits.length ? "block" : "none";
      ac.innerHTML = hits
        .map((p) => `<button type="button" data-id="${p.id}">${productIcon(p)} ${p.name}</button>`)
        .join("");
      ac.querySelectorAll("button").forEach((b) => {
        b.onmousedown = (e) => e.preventDefault();
        b.onclick = () => {
          pickedProd = state.cat.products[b.dataset.id];
          shopText.value = pickedProd.name;
          const opts = unitOptions(pickedProd);
          $("#shop-unit").innerHTML = opts.map((u) => `<option value="${u.value}">${u.label}</option>`).join("");
          ac.style.display = "none";
          shopText.focus();
          const hist = priceHistory(state.events, pickedProd.id, 3);
          $("#shop-price-hist").textContent = hist.length
            ? `Было: ${hist.map((h) => `${rub(h.cost)} (${new Date(h.at).toLocaleDateString("ru-RU")})`).join(" · ")}`
            : "Истории цены пока нет";
        };
      });
    };
    shopText.onblur = () => {
      setTimeout(() => {
        if (!ac.contains(document.activeElement)) ac.style.display = "none";
      }, 180);
    };
    $("#shop-photo")?.addEventListener("change", (e) => {
      const file = e.target.files?.[0];
      if (!file) return;
      if (file.size > 600000) return toast("Фото до ~600 КБ");
      const reader = new FileReader();
      reader.onload = () => {
        photoData = reader.result;
        toast("Фото ок");
      };
      reader.readAsDataURL(file);
    });

    const addItem = async () => {
      const textRaw = $("#shop-text").value.trim();
      if (!textRaw) return toast("Название");
      const qty = +$("#shop-qty").value || 0;
      const unit = $("#shop-unit").value;
      if (!qty) return toast("Укажите число и единицу");
      let p =
        pickedProd ||
        allProducts().find((x) => x.name.toLowerCase() === textRaw.toLowerCase());
      if (!p) {
        p = registerCustomProduct({
          name: textRaw,
          unit,
          brand: $("#shop-brand").value.trim(),
          photo: photoData,
        });
        toast(`Новый продукт «${p.name}» сохранён`);
      }
      const amount = toBaseAmount(qty, unit, p);
      ensureList().unshift({
        id: uid(),
        text: `${p.name} — ${qty} ${ALL_UNITS.find((u) => u.value === unit)?.label || unit}`,
        productId: p.id,
        amount,
        qty,
        unit,
        category: p.category || "",
        comment: $("#shop-comment").value.trim(),
        brand: $("#shop-brand").value.trim() || p.brand || "",
        photo: photoData || p.photo || "",
        done: false,
        price: null,
        priceMode: "total",
        source: "manual",
        at: new Date().toISOString(),
      });
      $("#shop-text").value = "";
      $("#shop-qty").value = "";
      $("#shop-comment").value = "";
      $("#shop-brand").value = "";
      photoData = "";
      pickedProd = null;
      await persistLocal();
      renderBasket();
    };
    $("#shop-add").onclick = addItem;
    $("#shop-text").onkeydown = (e) => e.key === "Enter" && addItem();

    if (!state._shopSelected) state._shopSelected = new Set();
    const shopSel = state._shopSelected;
    const updateShopBulk = () => {
      const bar = $("#shop-bulk");
      if (!bar) return;
      const n = shopSel.size;
      bar.style.display = n ? "flex" : "none";
      const lab = $("#shop-bulk-n");
      if (lab) lab.textContent = `Выбрано: ${n}`;
    };

    const paint = (box, items) => {
      if (!items.length) {
        box.innerHTML = `<div class="sk-note">Пусто</div>`;
        return;
      }
      items.forEach((it) => {
        const p = it.productId ? state.cat.products[it.productId] : null;
        const fromPlan = it.source === "plan";
        const qtyLocked = !!it.done;
        const row = document.createElement("div");
        row.className = `shop-item ${it.done ? "done" : ""}`;
        const unitSel = (p ? unitOptions(p) : ALL_UNITS)
          .map((u) => `<option value="${u.value}" ${u.value === (it.unit || "g") ? "selected" : ""}>${u.label}</option>`)
          .join("");
        const guessed = guessSpendCategory(p, it.text);
        row.innerHTML = `
          ${!it.done ? `<input type="checkbox" data-bulk ${shopSel.has(it.id) ? "checked" : ""} style="width:20px;height:20px;margin:4px 4px 0 0" />` : ""}
          <button type="button" class="shop-check">${it.done ? "✓" : ""}</button>
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
              ${it.photo ? `<img src="${it.photo}" alt="" style="width:36px;height:36px;object-fit:cover;border-radius:8px" />` : p ? `<span class="prod-ico">${productIcon(p)}</span>` : ""}
              <input class="shop-edit" value="${(it.text || "").replace(/"/g, "&quot;")}" style="flex:1;min-width:120px" />
              ${fromPlan ? `<span class="sk-meta">из плана</span>` : ""}
            </div>
            <div class="sk-row" style="margin-top:6px;gap:6px">
              <input class="sk-input" type="number" min="0" step="any" data-qty value="${it.qty ?? ""}" style="max-width:90px" ${qtyLocked ? "disabled" : ""} />
              <select class="sk-select" data-unit style="max-width:90px" ${qtyLocked ? "disabled" : ""}>${unitSel}</select>
              ${it.brand ? `<span class="sk-meta">${it.brand}</span>` : ""}
              ${it.price != null ? `<b>${rub(it.price)}</b>` : ""}
            </div>
            <input class="sk-input" data-comment placeholder="комментарий" value="${(it.comment || "").replace(/"/g, "&quot;")}" style="margin-top:6px;width:100%;min-height:40px" />
            <div class="price-pop" data-price-row style="display:none;margin-top:8px;flex-direction:column;align-items:stretch">
              <div class="sk-seg" data-pmode>
                <button type="button" data-m="total" class="active">за всё</button>
                <button type="button" data-m="per_pcs">за шт</button>
                <button type="button" data-m="per_100g">за 100г</button>
                <button type="button" data-m="per_kg">за кг</button>
              </div>
              <div class="sk-row" style="gap:6px;align-items:center">
                <input class="sk-input" type="number" min="0" data-price placeholder="₽" style="max-width:110px" />
                <span class="sk-meta" data-total-hint></span>
              </div>
              <div class="sk-seg" data-scat>
                ${["cooking", "alcohol", "treats", "sweet", "other"]
                  .map(
                    (k) =>
                      `<button type="button" data-c="${k}" class="${k === guessed ? "active" : ""}">${SPEND_LABELS[k]}</button>`
                  )
                  .join("")}
              </div>
              <button class="sk-btn sk-btn-accent" data-price-ok style="min-height:40px;align-self:flex-start">Готово</button>
            </div>
          </div>
          <button type="button" class="shop-del">×</button>`;

        const syncAmount = async () => {
          const qty = +row.querySelector("[data-qty]").value || 0;
          const unit = row.querySelector("[data-unit]").value;
          it.qty = qty;
          it.unit = unit;
          it.amount = toBaseAmount(qty, unit, p || { unit: inferBaseUnit(unit) });
          const label = ALL_UNITS.find((u) => u.value === unit)?.label || unit;
          const name = p?.name || it.text.split("—")[0].trim();
          it.text = `${name} — ${qty} ${label}`;
          row.querySelector(".shop-edit").value = it.text;
          await persistLocal();
        };
        row.querySelector("[data-qty]")?.addEventListener("change", syncAmount);
        row.querySelector("[data-unit]")?.addEventListener("change", syncAmount);
        row.querySelector("[data-bulk]")?.addEventListener("change", (e) => {
          if (e.target.checked) shopSel.add(it.id);
          else shopSel.delete(it.id);
          updateShopBulk();
        });

        row.querySelector(".shop-check").onclick = () => {
          if (it.done) return;
          const pop = row.querySelector("[data-price-row]");
          pop.style.display = "flex";
          let mode = it.priceMode || "total";
          let cat = it.spendCategory || guessed;
          const updateHint = () => {
            const raw = +row.querySelector("[data-price]").value || 0;
            const total = priceToTotal(raw, mode, it.amount, p);
            row.querySelector("[data-total-hint]").textContent = raw ? `= ${rub(total)}` : "";
          };
          row.querySelectorAll("[data-pmode] button").forEach((b) => {
            b.classList.toggle("active", b.dataset.m === mode);
            b.onclick = () => {
              mode = b.dataset.m;
              row.querySelectorAll("[data-pmode] button").forEach((x) => x.classList.toggle("active", x.dataset.m === mode));
              updateHint();
            };
          });
          row.querySelectorAll("[data-scat] button").forEach((b) => {
            b.classList.toggle("active", b.dataset.c === cat);
            b.onclick = () => {
              cat = b.dataset.c;
              row.querySelectorAll("[data-scat] button").forEach((x) => x.classList.toggle("active", x.dataset.c === cat));
            };
          });
          row.querySelector("[data-price]").oninput = updateHint;
          row.querySelector("[data-price-ok]").onclick = async () => {
            const raw = +row.querySelector("[data-price]").value || 0;
            const total = priceToTotal(raw, mode, it.amount, p);
            it.priceMode = mode;
            it.spendCategory = cat;
            await markBought(it, total, cat);
          };
        };

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

    async function markBought(it, price, spendCat = "cooking", opts = {}) {
      it.done = true;
      it.price = price || 0;
      it.boughtAt = new Date().toISOString();
      const cat = spendCat || it.spendCategory || "cooking";
      if (it.productId && it.amount) {
        const p = state.cat.products[it.productId];
        const exp = new Date();
        exp.setDate(exp.getDate() + (p?.shelfDays || 14));
        state.inventory = addInvAmount(state.inventory, it.productId, it.amount, {
          zone: p?.defaultZone || "pantry",
          boughtAt: new Date().toISOString().slice(0, 10),
          expiresAt: exp.toISOString().slice(0, 10),
          brand: it.brand || "",
        });
        if (it.photo && p) p.photo = it.photo;
      }
      if (price > 0) {
        state.events.push(
          makeEvent({
            type: "spend",
            category: cat,
            total: price,
            items: [{ id: it.productId, name: it.text, amount: it.amount, cost: price }],
          })
        );
        const ledgerKey =
          cat === "alcohol"
            ? "alcoholSpent"
            : cat === "treats"
              ? "treatsSpent"
              : cat === "sweet"
                ? "sweetSpent"
                : "cookingSpent";
        state.budget[ledgerKey] = (state.budget[ledgerKey] || 0) + price;
      }
      if (opts.silent) return;
      await persistLocal();
      toast(price ? `Куплено · ${rub(price)}` : "Куплено");
      renderBasket();
    }

    paint($("#shop-open"), open);
    paint($("#shop-done"), done);
    updateShopBulk();
    $("#shop-sel-all").onclick = () => {
      open.forEach((x) => shopSel.add(x.id));
      renderBasket();
    };
    $("#shop-sel-none").onclick = () => {
      shopSel.clear();
      renderBasket();
    };
    $("#shop-bulk-del").onclick = async () => {
      const ids = [...shopSel];
      if (!ids.length) return;
      state.settings.shoppingList = state.settings.shoppingList.filter((x) => !ids.includes(x.id));
      shopSel.clear();
      await persistLocal();
      toast(`Удалено ${ids.length}`);
      renderBasket();
    };
    $("#shop-bulk-buy").onclick = async () => {
      const ids = [...shopSel];
      if (!ids.length) return;
      let n = 0;
      for (const id of ids) {
        const it = ensureList().find((x) => x.id === id && !x.done);
        if (it) {
          await markBought(it, 0, it.spendCategory || "cooking", { silent: true });
          n += 1;
        }
      }
      shopSel.clear();
      await persistLocal();
      toast(`Куплено ${n} (без цены)`);
      renderBasket();
    };
    $("#shop-bulk-share").onclick = async () => {
      const items = open.filter((x) => shopSel.has(x.id));
      const text = `Покупки\n${(items.length ? items : open).map((x) => `• ${x.text}`).join("\n")}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Покупки", text });
          return;
        } catch {}
      }
      try {
        await navigator.clipboard.writeText(text);
        toast("Скопировано");
      } catch {
        prompt("Скопируйте:", text);
      }
    };
    $("#shop-clear-done").onclick = async () => {
      state.settings.shoppingList = state.settings.shoppingList.filter((x) => !x.done);
      await persistLocal();
      renderBasket();
    };
    const listText = () => open.map((x) => `• ${x.text}${x.comment ? ` (${x.comment})` : ""}`).join("\n") || "Список пуст";
    $("#shop-copy").onclick = async () => {
      const text = listText();
      try {
        await navigator.clipboard.writeText(text);
        toast("Скопировано");
      } catch {
        prompt("Скопируйте:", text);
      }
    };
    $("#shop-share").onclick = async () => {
      const text = `Покупки · Семейная кухня\n${listText()}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Покупки", text });
          return;
        } catch {
          /* cancelled */
        }
      }
      try {
        await navigator.clipboard.writeText(text);
        toast("Скопировано — вставьте в Telegram");
      } catch {
        prompt("Скопируйте:", text);
      }
    };
  }

  /* ——— PERIOD ——— */
  function renderPeriod() {
    const root = $("#screen-period");
    const per = state.settings.period || {};
    const start = state._periodStart || new Date().toISOString().slice(0, 10);
    const avg = avgUnitPrices(state.events);
    const amt = amounts();
    const exp = expiringIds(3);

    root.innerHTML = `
      <div class="sk-card tone" style="margin-bottom:14px">
        <div class="sk-plan-form">
          <label class="sk-field">Старт<input class="sk-input" type="date" id="per-start" value="${start}" /></label>
          <label class="sk-field">Дней<input class="sk-input" type="number" min="1" max="90" id="per-days" value="${per.days || 7}" /></label>
          <label class="sk-field">Взрослых<input class="sk-input" type="number" min="0" id="per-adults" value="${per.adults ?? 2}" /></label>
          <label class="sk-field">Детских порций<input class="sk-input" type="number" min="0" id="per-child" value="${per.childPortions ?? 1}" /></label>
          <label class="sk-field">Лимит ₽ (0 = без лимита)<input class="sk-input" type="number" min="0" id="per-cap" value="${per.budgetCap || 0}" placeholder="например 7000" /></label>
          <label class="sk-field">Режим
            <select class="sk-select" id="per-mode">
              <option value="recipes">Разнообразие</option>
              <option value="batch">Batch / меньше варок</option>
              <option value="products">От запасов</option>
              <option value="loved">Любимое</option>
            </select>
          </label>
        </div>
        <p class="sk-meta">Оценка ₽: из ваших покупок, иначе каталог. Batch = блюда на 2+ дня и подсказки «варка / разогрев».</p>
        <div class="sk-row">
          <button class="sk-btn sk-btn-accent" id="per-build">Собрать</button>
          <button class="sk-btn sk-btn-primary" id="per-apply">В план</button>
        </div>
      </div>
      <div id="per-out"></div>`;
    $("#per-mode").value = per.mode || "recipes";

    const draw = (plan, cost) => {
      const bal = proteinBalance(plan, state.cat.dishes);
      const cookDays = plan.filter((d) => d.isCookDay).length || Math.ceil(plan.length / 3);
      $("#per-out").innerHTML = `<div class="sk-forecast"><div><div class="sk-meta">Оценка периода</div><div class="sk-kpi">${rub(cost)}</div></div>
        <div><div class="sk-meta">Дней / варок</div><div class="sk-kpi" style="font-size:1.2rem">${plan.length} / ~${cookDays}</div></div>
        <div><div class="sk-meta">Белок</div><div class="sk-meta">кур ${bal.chicken} · свин ${bal.pork} · гов ${bal.beef} · рыб ${bal.fish}</div></div></div>
        <div class="sk-grid" id="per-grid"></div>`;
      plan.forEach((day) => {
        const col = document.createElement("div");
        col.className = "sk-col-4";
        let html = `<div class="sk-card"><h3 style="margin:0 0 8px;font-size:1.05rem">${day.label}</h3><p class="sk-meta">${day.cookHint || ""}</p>`;
        ["breakfast", "lunch", "dinner"].forEach((key) => {
          const d = state.cat.dishes[day[key]];
          if (!d) return;
          const hint = recipeStockHint(d, amt, state.cat.products, exp);
          const dc = estimateDishCost(d, state.cat.products, avg);
          const labels = { breakfast: "Завтрак", lunch: "Обед", dinner: "Ужин" };
          html += `<div class="sk-meal ${hint.coverage > 0.7 ? "stock-ok" : "stock-mid"}" data-rid="${d.id}" style="margin-top:6px"><b>${labels[key]}</b><div><div style="font-weight:750">${d.name}</div><div class="sk-meta">~${rub(dc)} · запасы ${Math.round(hint.coverage * 100)}% · ${daysRu(d.batchDays)}</div></div></div>`;
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

    if (state._periodDraft?.length) {
      draw(state._periodDraft, estimatePlanCostSmart(state._periodDraft, state.cat.dishes, state.cat.products, avg));
    }

    $("#per-build").onclick = () => {
      const cap = +$("#per-cap").value || 0;
      const opts = {
        startDate: $("#per-start").value,
        days: +$("#per-days").value || 7,
        adults: +$("#per-adults").value || 0,
        childPortions: +$("#per-child").value || 0,
        childAge: 1.5,
        mode: $("#per-mode").value,
        budgetCap: cap,
        events: state.events,
        seed: Date.now() ^ Math.floor(Math.random() * 1e9),
      };
      let plan = buildPeriodPlan(state.data, state.settings, opts);
      if (opts.mode === "batch") {
        const batchPool = state.data.dishes.filter((d) => (d.batchDays || 1) >= 2 && d.type === "main" && !state.settings.disliked?.includes(d.id));
        const breakfasts = state.data.dishes.filter((d) => d.type === "breakfast");
        const soups = state.data.dishes.filter((d) => d.type === "soup");
        plan = plan.map((day, i) => {
          const dinner = batchPool[Math.floor(i / 3) % Math.max(1, batchPool.length)];
          return {
            ...day,
            breakfast: breakfasts[i % Math.max(1, breakfasts.length)]?.id || day.breakfast,
            lunch: soups[i % Math.max(1, soups.length)]?.id || day.lunch,
            dinner: dinner?.id || day.dinner,
          };
        });
      }
      if (opts.mode === "products") {
        const matches = matchFromInventory(state.data.dishes, state.cat.products, amt, state.settings, {
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
      if (opts.mode === "loved") {
        const loved = (state.settings.loved || []).map((id) => state.cat.dishes[id]).filter(Boolean);
        if (loved.length) {
          const byType = {
            breakfast: loved.filter((d) => d.type === "breakfast"),
            soup: loved.filter((d) => d.type === "soup"),
            main: loved.filter((d) => d.type === "main"),
          };
          plan = plan.map((day, i) => ({
            ...day,
            breakfast: byType.breakfast[i % Math.max(1, byType.breakfast.length)]?.id || day.breakfast,
            lunch: byType.soup[i % Math.max(1, byType.soup.length)]?.id || day.lunch,
            dinner: byType.main[i % Math.max(1, byType.main.length)]?.id || day.dinner,
          }));
        }
      }
      plan = markBatchHints(plan, state.cat.dishes);
      // budget filter: swap expensive dinners for cheaper alternatives
      if (cap > 0) {
        let cost = estimatePlanCostSmart(plan, state.cat.dishes, state.cat.products, avg);
        let guard = 0;
        while (cost > cap && guard++ < 40) {
          let worstIdx = 0;
          let worstCost = 0;
          plan.forEach((day, i) => {
            const d = state.cat.dishes[day.dinner];
            const c = d ? estimateDishCost(d, state.cat.products, avg) : 0;
            if (c > worstCost) {
              worstCost = c;
              worstIdx = i;
            }
          });
          const cur = state.cat.dishes[plan[worstIdx].dinner];
          const cheaper = state.data.dishes
            .filter((d) => d.type === "main" && d.id !== cur?.id && !state.settings.disliked?.includes(d.id))
            .map((d) => ({ d, c: estimateDishCost(d, state.cat.products, avg) }))
            .filter((x) => x.c < worstCost * 0.85)
            .sort((a, b) => a.c - b.c)[0];
          if (!cheaper) break;
          plan[worstIdx] = { ...plan[worstIdx], dinner: cheaper.d.id };
          cost = estimatePlanCostSmart(plan, state.cat.dishes, state.cat.products, avg);
        }
      }
      state._periodStart = opts.startDate;
      state.settings.period = {
        days: opts.days,
        adults: opts.adults,
        childPortions: opts.childPortions,
        childAge: opts.childAge,
        mode: opts.mode,
        budgetCap: opts.budgetCap,
      };
      const cost = estimatePlanCostSmart(plan, state.cat.dishes, state.cat.products, avg);
      draw(plan, cost);
      toast(cap && cost > cap ? `Собрали, но оценка ${rub(cost)} выше лимита` : "Готово");
    };

    $("#per-apply").onclick = async () => {
      if (!state._periodDraft?.length) return toast("Сначала соберите");
      state.plan = state._periodDraft;
      await persistLocal();
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
    openProductModal,
    closeProductModal,
    openRestockFlow,
    onCooked,
    amounts,
  };
}
