import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const p = path.join(path.dirname(fileURLToPath(import.meta.url)), "../app/js/app.js");
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("function renderRecipes() {");
const end = s.indexOf("function recipeHtml(");
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}
const insert = `function renderRecipes() {
  const root = $("#screen-recipes");
  const proteins = [...new Set(state.data.dishes.map((d) => d.protein))].sort();
  const cats = [...new Set(state.data.dishes.map((d) => d.category))].sort();
  root.innerHTML = \`
    <div class="sk-card" style="margin-bottom:14px">
      <div class="sk-row">
        <label class="sk-field" style="flex:1;min-width:180px">Поиск
          <input class="sk-input" id="recipe-q" placeholder="борщ, творог, минтай…" value="\${state._recipeQ || ""}" />
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
          <select class="sk-select" id="f-protein"><option value="all">Все</option>\${proteins.map((c) => \`<option value="\${c}">\${c}</option>\`).join("")}</select>
        </label>
        <label class="sk-field">Раздел
          <select class="sk-select" id="f-cat"><option value="all">Все</option>\${cats.map((c) => \`<option value="\${c}">\${c}</option>\`).join("")}</select>
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
    <div class="recipe-pick-grid" id="recipe-list"></div>\`;

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
    $("#recipe-count").textContent = \`Найдено: \${list.length}\`;
    const pane = $("#recipe-list");
    pane.innerHTML = "";
    if (!list.length) {
      pane.innerHTML = \`<div class="sk-note">Ничего не найдено — ослабьте фильтр «Раздел» или белок.</div>\`;
      return;
    }
    list.slice(0, 120).forEach((d) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = \`recipe-pick \${d.id === state.selectedRecipe ? "active" : ""}\`;
      b.innerHTML = \`<span class="ico">\${dishIcon(d)}</span><strong>\${d.name}</strong><span class="sk-meta">\${d.type} · \${d.protein} · \${d.timeMin} мин · \${rub(d.costBatch)}</span>\`;
      b.onclick = () => {
        state.selectedRecipe = d.id;
        openRecipe(d.id, true);
      };
      pane.appendChild(b);
    });
    if (list.length > 120) {
      const more = document.createElement("div");
      more.className = "sk-meta";
      more.textContent = \`Показаны 120 из \${list.length} — уточните поиск.\`;
      pane.appendChild(more);
    }
  };

  ["recipe-q", "f-type", "f-cat", "f-protein", "f-time", "f-batch"].forEach((id) => {
    $("#" + id).addEventListener("input", redraw);
    $("#" + id).addEventListener("change", redraw);
  });
  redraw();
}

`;
s = s.slice(0, start) + insert + s.slice(end);
fs.writeFileSync(p, s);
console.log("recipes spliced");
