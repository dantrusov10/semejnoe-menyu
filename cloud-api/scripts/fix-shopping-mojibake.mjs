/** Чинит ??? в shoppingList / customProducts после битой кодировки PowerShell. */
const API = "https://semejnoe-menyu-api.jazzy-selenium.workers.dev";

const UNIT_LABEL = { pcs: "шт", pack: "уп", g: "г", kg: "кг", ml: "мл", l: "л" };

// сигнатуры из SHOP_TEMPLATES (qty+unit+spend) + паттерн id после порчи кириллицы
const KNOWN = [
  {
    idPattern: /^custom_\?{4}_\?{8}_/,
    name: "Фуэт / колбаски",
    unit: "pcs",
    qty: 1,
    category: "вкусняшки",
    spendCategory: "treats",
    comment: "Вкусняшки недели",
  },
  {
    idPattern: /^custom_\?{2}_\?{4}_\?{3}_/,
    name: "Твёрдый сыр",
    unit: "g",
    qty: 200,
    category: "вкусняшки",
    spendCategory: "treats",
    comment: "Вкусняшки недели",
  },
  {
    idPattern: /^custom_\?{5}_/,
    name: "Чипсы",
    unit: "pack",
    qty: 1,
    category: "вкусняшки",
    spendCategory: "treats",
    comment: "Вкусняшки недели",
  },
  {
    idPattern: /^custom_\?{8}_/,
    name: "Сухарики",
    unit: "pack",
    qty: 1,
    category: "вкусняшки",
    spendCategory: "treats",
    comment: "Вкусняшки недели",
  },
];

function broken(s) {
  return !s || /[?]{2,}|�/.test(String(s));
}

function slugId(name, suffix) {
  const slug = name
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^a-zа-я0-9]+/gi, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 40);
  return `custom_${slug}_${suffix}`;
}

const st = await (await fetch(`${API}/state`, { headers: { "X-Family-Key": "bogdaniha" } })).json();
st.settings = st.settings || {};
const list = Array.isArray(st.settings.shoppingList) ? st.settings.shoppingList : [];
const customs = Array.isArray(st.settings.customProducts) ? st.settings.customProducts : [];

const idMap = new Map();
let fixedProducts = 0;
const nextCustoms = [];

for (const p of customs) {
  const hit = KNOWN.find((k) => k.idPattern.test(p.id || ""));
  if (hit && (broken(p.name) || broken(p.category))) {
    const suffix = (p.id.split("_").pop() || "x").slice(0, 5);
    const newId = slugId(hit.name, suffix);
    idMap.set(p.id, newId);
    nextCustoms.push({
      ...p,
      id: newId,
      name: hit.name,
      unit: hit.unit === "pack" || hit.unit === "pcs" ? "pcs" : hit.unit === "g" ? "g" : p.unit,
      category: hit.category,
      custom: true,
    });
    fixedProducts += 1;
  } else if (!broken(p.name)) {
    nextCustoms.push(p);
  } else {
    // безнадёжный кастом без сигнатуры — дропаем
    fixedProducts += 1;
  }
}

let fixedLines = 0;
const nextList = list.map((it) => {
  const oldId = it.productId || "";
  let hit = KNOWN.find((k) => k.idPattern.test(oldId));
  if (!hit && broken(it.text)) {
    hit = KNOWN.find(
      (k) => k.qty === Number(it.qty) && k.unit === it.unit && k.spendCategory === it.spendCategory
    );
  }
  if (!hit) return it;
  const newId = idMap.get(oldId) || slugId(hit.name, (oldId.split("_").pop() || "x").slice(0, 5));
  if (!idMap.has(oldId)) {
    idMap.set(oldId, newId);
    if (!nextCustoms.some((p) => p.id === newId)) {
      nextCustoms.push({
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
  fixedLines += 1;
  return {
    ...it,
    productId: newId,
    text: `${hit.name} — ${it.qty ?? hit.qty} ${UNIT_LABEL[it.unit] || it.unit}`,
    category: hit.category,
    comment: broken(it.comment) ? hit.comment : it.comment,
  };
});

st.settings.customProducts = nextCustoms;
st.settings.shoppingList = nextList;

await fetch(`${API}/state`, {
  method: "PUT",
  headers: { "X-Family-Key": "bogdaniha", "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(st),
});

const check = await (await fetch(`${API}/state`, { headers: { "X-Family-Key": "bogdaniha" } })).json();
console.log(
  JSON.stringify(
    {
      fixedProducts,
      fixedLines,
      shopping: (check.settings.shoppingList || []).map((x) => x.text),
      customs: (check.settings.customProducts || []).map((x) => x.name),
    },
    null,
    2
  )
);
