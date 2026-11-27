import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const p = path.join(root, "app/js/app.js");
let s = fs.readFileSync(p, "utf8");
const start = s.indexOf("/* ——— INVENTORY ——— */");
const end = s.indexOf("/* ——— RECIPES ——— */");
if (start < 0 || end < 0) {
  console.error("markers", start, end);
  process.exit(1);
}
const insert = `/* ——— STOCK UI (inventory / basket / period) ——— */
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
function renderInventory() {
  ensureStockUi().renderInventory();
}
function renderBasket() {
  ensureStockUi().renderBasket();
}
function renderPeriod() {
  ensureStockUi().renderPeriod();
}

`;
s = s.slice(0, start) + insert + s.slice(end);
fs.writeFileSync(p, s);
console.log("ok, removed", end - start, "chars");
