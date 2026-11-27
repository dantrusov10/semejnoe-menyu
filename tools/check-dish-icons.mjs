import { readFileSync } from "fs";

const src = readFileSync(new URL("../app/js/icons.js", import.meta.url), "utf8");
const block = src.slice(src.indexOf("const DISH_RULES"), src.indexOf("const ING_ICON"));
const DISH_RULES = [];
for (const line of block.split("\n")) {
  const mm = line.match(/\[(\/.*?\/[gimsuy]*),\s*"([^"]+)"\]/);
  if (mm) DISH_RULES.push([eval(mm[1]), mm[2]]);
}

const data = JSON.parse(readFileSync(new URL("../data/app-data.json", import.meta.url), "utf8"));

function match(text) {
  for (const [r, i] of DISH_RULES) if (r.test(text)) return i;
  return null;
}
function fallback(d) {
  if (d.type === "breakfast") return "fried-egg-dish";
  if (d.type === "soup") return "soup";
  if (d.type === "dessert") return "cake";
  if (d.type === "snack") return "apple";
  if (d.protein === "рыба") return "fish";
  if (d.protein === "птица") return "chicken";
  if (d.protein === "мясо") return "beef";
  if (d.protein === "фарш") return "meatball";
  if (d.protein === "без мяса") return "salad";
  return "pasta-dish";
}

const counts = {};
let matched = 0;
let fb = 0;
const fallbacks = [];
for (const d of data.dishes) {
  const hay = [d.name, d.category, ...(d.tags || [])].join(" ");
  let icon = match(hay);
  if (icon) matched++;
  else {
    icon = fallback(d);
    fb++;
    if (fallbacks.length < 40) fallbacks.push(`${d.type} | ${d.name} → ${icon}`);
  }
  counts[icon] = (counts[icon] || 0) + 1;
}

console.log(`matched ${matched} fallback ${fb} unique ${Object.keys(counts).length}`);
console.log(
  [...Object.entries(counts)]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k, v]) => `${v}\t${k}`)
    .join("\n")
);
console.log("\nfallback samples:\n" + fallbacks.join("\n"));
