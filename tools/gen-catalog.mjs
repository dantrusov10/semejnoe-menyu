/**
 * Обогащение продуктов (категории, КБЖУ, срок) + генератор рецептов.
 * Цель релиза: ~800–1000 блюд; дальше наращивать теми же шаблонами.
 */

export const PRODUCT_META = {
  potato: { cat: "овощи", kcal: 77, p: 2, f: 0.1, c: 17, shelf: 30, zone: "pantry" },
  cabbage: { cat: "овощи", kcal: 27, p: 1.8, f: 0.1, c: 6, shelf: 14, zone: "fridge" },
  carrot: { cat: "овощи", kcal: 41, p: 0.9, f: 0.2, c: 10, shelf: 21, zone: "fridge" },
  onion: { cat: "овощи", kcal: 40, p: 1.1, f: 0.1, c: 9, shelf: 30, zone: "pantry" },
  beet: { cat: "овощи", kcal: 43, p: 1.6, f: 0.2, c: 10, shelf: 21, zone: "fridge" },
  tomato: { cat: "овощи", kcal: 18, p: 0.9, f: 0.2, c: 3.9, shelf: 7, zone: "fridge" },
  cucumber: { cat: "овощи", kcal: 15, p: 0.8, f: 0.1, c: 3.6, shelf: 7, zone: "fridge" },
  pepper: { cat: "овощи", kcal: 27, p: 1.3, f: 0.3, c: 6, shelf: 10, zone: "fridge" },
  zucchini: { cat: "овощи", kcal: 17, p: 1.2, f: 0.3, c: 3.1, shelf: 10, zone: "fridge" },
  pumpkin: { cat: "овощи", kcal: 26, p: 1, f: 0.1, c: 7, shelf: 30, zone: "pantry" },
  broccoli: { cat: "овощи", kcal: 34, p: 2.8, f: 0.4, c: 7, shelf: 90, zone: "freezer" },
  beans_green: { cat: "овощи", kcal: 31, p: 1.8, f: 0.1, c: 7, shelf: 90, zone: "freezer" },
  peas: { cat: "овощи", kcal: 69, p: 5, f: 0.4, c: 12, shelf: 90, zone: "freezer" },
  corn: { cat: "овощи", kcal: 86, p: 3.3, f: 1.2, c: 19, shelf: 90, zone: "freezer" },
  garlic: { cat: "овощи", kcal: 149, p: 6.4, f: 0.5, c: 33, shelf: 60, zone: "pantry" },
  apple: { cat: "фрукты", kcal: 52, p: 0.3, f: 0.2, c: 14, shelf: 21, zone: "fridge" },
  banana: { cat: "фрукты", kcal: 89, p: 1.1, f: 0.3, c: 23, shelf: 5, zone: "pantry" },
  pear: { cat: "фрукты", kcal: 57, p: 0.4, f: 0.1, c: 15, shelf: 10, zone: "fridge" },
  orange: { cat: "фрукты", kcal: 47, p: 0.9, f: 0.1, c: 12, shelf: 14, zone: "fridge" },
  lemon: { cat: "фрукты", kcal: 29, p: 1.1, f: 0.3, c: 9, shelf: 21, zone: "fridge" },
  berries: { cat: "фрукты", kcal: 43, p: 0.7, f: 0.4, c: 10, shelf: 120, zone: "freezer" },
  buckwheat: { cat: "крупы", kcal: 343, p: 13, f: 3.4, c: 72, shelf: 365, zone: "pantry" },
  rice: { cat: "крупы", kcal: 344, p: 7, f: 0.7, c: 78, shelf: 365, zone: "pantry" },
  oats: { cat: "крупы", kcal: 389, p: 17, f: 7, c: 66, shelf: 365, zone: "pantry" },
  millet: { cat: "крупы", kcal: 348, p: 11, f: 3.3, c: 69, shelf: 365, zone: "pantry" },
  semolina: { cat: "крупы", kcal: 333, p: 10, f: 1, c: 73, shelf: 365, zone: "pantry" },
  pasta: { cat: "крупы", kcal: 344, p: 10, f: 1.1, c: 71, shelf: 365, zone: "pantry" },
  lentils: { cat: "бобовые", kcal: 352, p: 25, f: 1.1, c: 60, shelf: 365, zone: "pantry" },
  beans_dry: { cat: "бобовые", kcal: 333, p: 21, f: 2, c: 60, shelf: 365, zone: "pantry" },
  chickpeas: { cat: "бобовые", kcal: 364, p: 19, f: 6, c: 61, shelf: 365, zone: "pantry" },
  flour: { cat: "выпечка", kcal: 364, p: 10, f: 1, c: 76, shelf: 180, zone: "pantry" },
  bread: { cat: "выпечка", kcal: 265, p: 9, f: 3.2, c: 49, shelf: 5, zone: "pantry" },
  oil: { cat: "масло", kcal: 884, p: 0, f: 100, c: 0, shelf: 365, zone: "pantry" },
  butter: { cat: "масло", kcal: 748, p: 0.5, f: 82, c: 0.8, shelf: 45, zone: "fridge" },
  milk: { cat: "молочка", kcal: 52, p: 2.8, f: 2.5, c: 4.7, shelf: 7, zone: "fridge" },
  kefir: { cat: "молочка", kcal: 41, p: 3, f: 1, c: 4, shelf: 7, zone: "fridge" },
  sourcream: { cat: "молочка", kcal: 206, p: 2.8, f: 20, c: 3.2, shelf: 10, zone: "fridge" },
  tvorog: { cat: "молочка", kcal: 159, p: 16, f: 9, c: 2, shelf: 7, zone: "fridge" },
  yogurt: { cat: "молочка", kcal: 66, p: 5, f: 3.2, c: 4, shelf: 14, zone: "fridge" },
  cheese: { cat: "молочка", kcal: 350, p: 25, f: 27, c: 0, shelf: 30, zone: "fridge" },
  egg: { cat: "яйца", kcal: 157, p: 13, f: 11, c: 1.1, shelf: 21, zone: "fridge" },
  tomato_paste: { cat: "бакалея", kcal: 82, p: 4, f: 0.3, c: 19, shelf: 365, zone: "pantry" },
  bay: { cat: "специи", kcal: 313, p: 8, f: 8, c: 75, shelf: 730, zone: "pantry" },
  salt: { cat: "специи", kcal: 0, p: 0, f: 0, c: 0, shelf: 1825, zone: "pantry" },
  pepper_black: { cat: "специи", kcal: 251, p: 10, f: 3, c: 64, shelf: 730, zone: "pantry" },
  paprika: { cat: "специи", kcal: 282, p: 14, f: 13, c: 54, shelf: 730, zone: "pantry" },
  dill: { cat: "зелень", kcal: 43, p: 3.5, f: 1.1, c: 7, shelf: 5, zone: "fridge" },
  mayo: { cat: "соусы", kcal: 680, p: 1, f: 75, c: 2.6, shelf: 60, zone: "fridge" },
  mustard: { cat: "соусы", kcal: 162, p: 7, f: 9, c: 11, shelf: 180, zone: "fridge" },
  soy: { cat: "соусы", kcal: 53, p: 8, f: 0, c: 5, shelf: 365, zone: "pantry" },
  honey_adult: { cat: "сладкое", kcal: 304, p: 0.3, f: 0, c: 82, shelf: 730, zone: "pantry" },
  sugar: { cat: "сладкое", kcal: 387, p: 0, f: 0, c: 100, shelf: 730, zone: "pantry" },
  chicken_whole: { cat: "птица", kcal: 190, p: 18, f: 13, c: 0, shelf: 90, zone: "freezer" },
  chicken_leg: { cat: "птица", kcal: 185, p: 18, f: 12, c: 0, shelf: 90, zone: "freezer" },
  chicken_thigh: { cat: "птица", kcal: 177, p: 18, f: 11, c: 0, shelf: 90, zone: "freezer" },
  chicken_breast: { cat: "птица", kcal: 113, p: 24, f: 1.9, c: 0, shelf: 90, zone: "freezer" },
  chicken_fillet: { cat: "птица", kcal: 110, p: 23, f: 1.2, c: 0, shelf: 90, zone: "freezer" },
  chicken_wing: { cat: "птица", kcal: 186, p: 17, f: 12, c: 0, shelf: 90, zone: "freezer" },
  chicken_liver: { cat: "субпродукты", kcal: 136, p: 20, f: 5.9, c: 0.7, shelf: 60, zone: "freezer" },
  chicken_cheap: { cat: "птица", kcal: 170, p: 18, f: 10, c: 0, shelf: 90, zone: "freezer" },
  turkey_fillet: { cat: "птица", kcal: 104, p: 22, f: 1.5, c: 0, shelf: 90, zone: "freezer" },
  mince_home: { cat: "фарш", kcal: 250, p: 17, f: 20, c: 0, shelf: 60, zone: "freezer" },
  mince_beef: { cat: "фарш", kcal: 230, p: 18, f: 17, c: 0, shelf: 60, zone: "freezer" },
  mince_chicken: { cat: "фарш", kcal: 143, p: 17, f: 8, c: 0, shelf: 60, zone: "freezer" },
  mince_cheap: { cat: "фарш", kcal: 240, p: 16, f: 19, c: 0, shelf: 60, zone: "freezer" },
  pork_shoulder: { cat: "мясо", kcal: 236, p: 16, f: 19, c: 0, shelf: 90, zone: "freezer" },
  pork_carbonade: { cat: "мясо", kcal: 210, p: 18, f: 15, c: 0, shelf: 90, zone: "freezer" },
  pork_ribs: { cat: "мясо", kcal: 290, p: 15, f: 25, c: 0, shelf: 90, zone: "freezer" },
  pork_broth: { cat: "мясо", kcal: 180, p: 15, f: 13, c: 0, shelf: 90, zone: "freezer" },
  beef_stew: { cat: "мясо", kcal: 180, p: 20, f: 10, c: 0, shelf: 90, zone: "freezer" },
  beef_liver: { cat: "субпродукты", kcal: 127, p: 20, f: 3.8, c: 4, shelf: 60, zone: "freezer" },
  pollock: { cat: "рыба", kcal: 72, p: 16, f: 0.7, c: 0, shelf: 90, zone: "freezer" },
  sole: { cat: "рыба", kcal: 83, p: 17, f: 1.5, c: 0, shelf: 90, zone: "freezer" },
  tilapia: { cat: "рыба", kcal: 96, p: 20, f: 1.7, c: 0, shelf: 90, zone: "freezer" },
  salmon_pink: { cat: "рыба", kcal: 140, p: 20, f: 6, c: 0, shelf: 90, zone: "freezer" },
  herring_fillet: { cat: "рыба", kcal: 160, p: 17, f: 10, c: 0, shelf: 14, zone: "fridge" },
};

/** Доп. продукты для разнообразия каталога */
export const EXTRA_PRODUCTS = [
  { id: "mushroom", name: "Шампиньоны", unit: "g", price: 0.35, store: "ashan", cat: "овощи", kcal: 27, p: 4.3, f: 1, c: 1, shelf: 5, zone: "fridge" },
  { id: "spinach", name: "Шпинат зам.", unit: "g", price: 0.28, store: "ashan", cat: "зелень", kcal: 23, p: 2.9, f: 0.4, c: 3.6, shelf: 120, zone: "freezer" },
  { id: "cauliflower", name: "Цветная капуста зам.", unit: "g", price: 0.2, store: "ashan", cat: "овощи", kcal: 25, p: 1.9, f: 0.3, c: 5, shelf: 120, zone: "freezer" },
  { id: "eggplant", name: "Баклажан", unit: "g", price: 0.22, store: "ashan", cat: "овощи", kcal: 25, p: 1.2, f: 0.2, c: 6, shelf: 7, zone: "fridge" },
  { id: "celery", name: "Сельдерей стебель", unit: "g", price: 0.25, store: "ashan", cat: "овощи", kcal: 16, p: 0.7, f: 0.2, c: 3, shelf: 10, zone: "fridge" },
  { id: "barley", name: "Перловка", unit: "g", price: 0.06, store: "ashan", cat: "крупы", kcal: 320, p: 9, f: 1.1, c: 73, shelf: 365, zone: "pantry" },
  { id: "couscous", name: "Кускус", unit: "g", price: 0.18, store: "ashan", cat: "крупы", kcal: 376, p: 13, f: 0.6, c: 77, shelf: 365, zone: "pantry" },
  { id: "bulgur", name: "Булгур", unit: "g", price: 0.12, store: "ashan", cat: "крупы", kcal: 342, p: 12, f: 1.3, c: 76, shelf: 365, zone: "pantry" },
  { id: "cream", name: "Сливки 10–20%", unit: "ml", price: 0.2, store: "ashan", cat: "молочка", kcal: 193, p: 2.8, f: 20, c: 3.6, shelf: 10, zone: "fridge" },
  { id: "cottage_soft", name: "Творожный сыр", unit: "g", price: 0.55, store: "ashan", cat: "молочка", kcal: 220, p: 8, f: 20, c: 3, shelf: 14, zone: "fridge" },
  { id: "cocoa", name: "Какао порошок", unit: "g", price: 0.8, store: "ashan", cat: "сладкое", kcal: 228, p: 20, f: 14, c: 12, shelf: 365, zone: "pantry" },
  { id: "raisin", name: "Изюм", unit: "g", price: 0.4, store: "ashan", cat: "сухофрукты", kcal: 299, p: 3, f: 0.5, c: 79, shelf: 180, zone: "pantry" },
  { id: "prune", name: "Чернослив", unit: "g", price: 0.45, store: "ashan", cat: "сухофрукты", kcal: 240, p: 2.3, f: 0.7, c: 64, shelf: 180, zone: "pantry" },
  { id: "cod", name: "Филе трески с/м", unit: "g", price: 0.55, store: "ashan", cat: "рыба", kcal: 78, p: 18, f: 0.6, c: 0, shelf: 90, zone: "freezer" },
  { id: "hake", name: "Филе хека с/м", unit: "g", price: 0.4, store: "ashan", cat: "рыба", kcal: 86, p: 17, f: 2.2, c: 0, shelf: 90, zone: "freezer" },
  { id: "duck_leg", name: "Утка ножка", unit: "g", price: 0.7, store: "parnoe", cat: "птица", kcal: 250, p: 16, f: 20, c: 0, shelf: 90, zone: "freezer" },
  { id: "veal", name: "Телятина на тушение", unit: "g", price: 0.85, store: "parnoe", cat: "мясо", kcal: 160, p: 20, f: 8, c: 0, shelf: 90, zone: "freezer" },
  { id: "rabbit", name: "Кролик тушка/кусок", unit: "g", price: 0.75, store: "parnoe", cat: "мясо", kcal: 173, p: 21, f: 8, c: 0, shelf: 90, zone: "freezer" },
  { id: "baking_powder", name: "Разрыхлитель", unit: "g", price: 0.5, store: "ashan", cat: "выпечка", kcal: 53, p: 0, f: 0, c: 28, shelf: 365, zone: "pantry" },
  { id: "vanilla", name: "Ванилин", unit: "g", price: 2, store: "ashan", cat: "выпечка", kcal: 288, p: 0, f: 0, c: 0, shelf: 730, zone: "pantry" },
  { id: "kiwi", name: "Киви", unit: "g", price: 0.3, store: "ashan", cat: "фрукты", kcal: 61, p: 1.1, f: 0.5, c: 15, shelf: 10, zone: "fridge" },
  { id: "grape", name: "Виноград", unit: "g", price: 0.28, store: "ashan", cat: "фрукты", kcal: 69, p: 0.7, f: 0.2, c: 18, shelf: 7, zone: "fridge" },
  { id: "watermelon_proxy", name: "Арбуз/дыня сезон", unit: "g", price: 0.08, store: "ashan", cat: "фрукты", kcal: 30, p: 0.6, f: 0.2, c: 8, shelf: 5, zone: "fridge" },
];

export function enrichProduct(p) {
  const m = PRODUCT_META[p.id] || {};
  return {
    ...p,
    category: p.cat || m.cat || "прочее",
    kcal: p.kcal ?? m.kcal ?? 0,
    protein: p.p ?? m.p ?? 0,
    fat: p.f ?? m.f ?? 0,
    carbs: p.c ?? m.c ?? 0,
    shelfDays: p.shelf ?? m.shelf ?? 14,
    defaultZone: p.zone || m.zone || "pantry",
  };
}

/**
 * Генерация вариаций поверх ручного ядра.
 * dishFn — та же функция dish() из build.mjs
 */
export function generateRecipes(dishFn, existingIds) {
  const out = [];
  const used = new Set(existingIds);
  const add = (raw) => {
    if (used.has(raw.id)) return;
    used.add(raw.id);
    out.push(dishFn(raw));
  };

  const sides = [
    { id: "buckwheat", name: "с гречкой", g: 280 },
    { id: "rice", name: "с рисом", g: 280 },
    { id: "pasta", name: "с макаронами", g: 320 },
    { id: "potato", name: "с картофелем", g: 800 },
    { id: "bulgur", name: "с булгуром", g: 250 },
    { id: "couscous", name: "с кускусом", g: 250 },
    { id: "barley", name: "с перловкой", g: 250 },
  ];

  const proteins = [
    { id: "chicken_thigh", name: "Курица (бедро)", tag: "курица", batch: 2, amt: 800 },
    { id: "chicken_fillet", name: "Куриное филе", tag: "курица", batch: 2, amt: 700 },
    { id: "chicken_cheap", name: "Курица", tag: "курица", batch: 2, amt: 1000 },
    { id: "turkey_fillet", name: "Индейка", tag: "птица", batch: 2, amt: 700 },
    { id: "pork_shoulder", name: "Свинина", tag: "свинина", batch: 3, amt: 700 },
    { id: "pork_carbonade", name: "Свиной карбонад", tag: "свинина", batch: 2, amt: 650 },
    { id: "beef_stew", name: "Говядина", tag: "говядина", batch: 3, amt: 650 },
    { id: "mince_cheap", name: "Фарш", tag: "фарш", batch: 2, amt: 600 },
    { id: "mince_chicken", name: "Куриный фарш", tag: "фарш", batch: 2, amt: 600 },
    { id: "mince_beef", name: "Говяжий фарш", tag: "фарш", batch: 2, amt: 600 },
    { id: "mince_home", name: "Домашний фарш", tag: "фарш", batch: 2, amt: 600 },
    { id: "pollock", name: "Минтай", tag: "рыба", batch: 1, amt: 650 },
    { id: "sole", name: "Морской язык", tag: "рыба", batch: 1, amt: 600 },
    { id: "tilapia", name: "Тилапия", tag: "рыба", batch: 1, amt: 600 },
    { id: "cod", name: "Треска", tag: "рыба", batch: 1, amt: 600 },
    { id: "hake", name: "Хек", tag: "рыба", batch: 1, amt: 600 },
    { id: "salmon_pink", name: "Горбуша", tag: "рыба", batch: 2, amt: 700 },
    { id: "chicken_liver", name: "Куриная печень", tag: "печень", batch: 2, amt: 550 },
    { id: "beef_liver", name: "Говяжья печень", tag: "печень", batch: 2, amt: 550 },
    { id: "duck_leg", name: "Утка", tag: "птица", batch: 2, amt: 800 },
    { id: "rabbit", name: "Кролик", tag: "мясо", batch: 2, amt: 800 },
    { id: "veal", name: "Телятина", tag: "мясо", batch: 3, amt: 650 },
  ];

  const methods = [
    {
      key: "stew",
      title: "тушёная",
      titleN: "тушёное",
      titleM: "тушёный",
      steps: (p) => [`Нарезать ${p.name.toLowerCase()}, обжарить с луком.`, "Добавить воду/бульон, тушить до мягкости под крышкой.", "Соль в конце; детской — меньше специй."],
      time: 55,
      need: [["onion", 180], ["carrot", 120], ["oil", 20], ["salt", 7], ["bay", 1]],
    },
    {
      key: "bake",
      title: "запечённая",
      titleN: "запечённое",
      titleM: "запечённый",
      steps: (p) => [`Смешать ${p.name.toLowerCase()} с маслом и специями.`, "Духовка 180–190° до готовности.", "Дать отдохнуть 5 мин."],
      time: 60,
      need: [["oil", 25], ["paprika", 4], ["garlic", 12], ["salt", 8]],
      tags: ["духовка"],
    },
    {
      key: "pan",
      title: "на сковороде",
      titleN: "на сковороде",
      titleM: "на сковороде",
      steps: (p) => [`Обжарить ${p.name.toLowerCase()} на среднем огне.`, "Не пересушивать; крышка по желанию.", "Подать сразу или остудить для хранения."],
      time: 35,
      need: [["oil", 30], ["onion", 100], ["salt", 6]],
    },
    {
      key: "sour",
      title: "в сметане",
      titleN: "в сметане",
      titleM: "в сметане",
      steps: (p) => [`Обжарить ${p.name.toLowerCase()}.`, "Влить сметану, томить 10–15 мин.", "Не кипятить сильно."],
      time: 40,
      need: [["sourcream", 150], ["onion", 150], ["oil", 15], ["salt", 6]],
    },
    {
      key: "tomato",
      title: "в томате",
      titleN: "в томате",
      titleM: "в томате",
      steps: (p) => [`Обжарить ${p.name.toLowerCase()} с луком.`, "Томатная паста + вода, тушить.", "Соль умеренно."],
      time: 45,
      need: [["tomato_paste", 50], ["onion", 180], ["oil", 20], ["salt", 7]],
    },
  ];

  let n = 0;
  for (const p of proteins) {
    for (const m of methods) {
      for (const s of sides) {
        // лёгкое прореживание (оставить ~2/3 комбинаций)
        if ((n + p.id.length + s.id.length) % 5 === 0) {
          n++;
          continue;
        }
        const id = `g_${m.key}_${p.id}_${s.id}`.slice(0, 48);
        const adj = /филе|фарш|минтай|язык|тилапия|треска|хек|горбуша|печень|карбонад/.test(p.name)
          ? m.titleN
          : /свинина|говядина|телятина|утка|кролик|курица|индейка/.test(p.name)
            ? m.title
            : m.titleM;
        add({
          id,
          name: `${p.name} ${adj} ${s.name}`,
          type: "main",
          batchDays: p.batch,
          servings: 6,
          timeMin: m.time + 10,
          ing: [[p.id, p.amt], [s.id, s.g], ...m.need],
          steps: [...m.steps(p), `Гарнир: отварить ${s.name.replace("с ", "")}.`],
          tags: [p.tag, "batch", ...(m.tags || [])],
          category: p.tag === "рыба" ? "рыба" : p.tag === "печень" ? "печень" : p.tag === "фарш" ? "фарш" : /курица|птица|индейка|утка/.test(p.tag) ? "птица" : "мясо",
        });
        n++;
      }
    }
  }

  // Супы-вариации
  const soupBases = [
    { protein: "chicken_cheap", amt: 700, name: "куриный" },
    { protein: "pork_broth", amt: 500, name: "на свинине" },
    { protein: "beef_stew", amt: 450, name: "на говядине" },
    { protein: "turkey_fillet", amt: 450, name: "с индейкой" },
    { protein: "pollock", amt: 450, name: "рыбный" },
    { protein: "mince_cheap", amt: 350, name: "с фрикадельками" },
    { protein: "lentils", amt: 280, name: "чечевичный" },
    { protein: "chickpeas", amt: 250, name: "нутовый" },
  ];
  const soupVeg = [
    { name: "с картофелем и морковью", ing: [["potato", 350], ["carrot", 120], ["onion", 100]] },
    { name: "с капустой", ing: [["cabbage", 400], ["potato", 250], ["carrot", 100]] },
    { name: "с брокколи", ing: [["broccoli", 300], ["potato", 200], ["onion", 80]] },
    { name: "с перцем и томатом", ing: [["pepper", 200], ["tomato_paste", 40], ["onion", 120]] },
    { name: "с сельдереем", ing: [["celery", 150], ["potato", 250], ["carrot", 100]] },
    { name: "с цветной капустой", ing: [["cauliflower", 350], ["carrot", 100], ["onion", 80]] },
  ];
  let si = 0;
  for (const b of soupBases) {
    for (const v of soupVeg) {
      si++;
      if (si % 5 === 0) continue;
      add({
        id: `gs_${b.protein}_${v.name.slice(0, 12).replace(/\s/g, "")}_${si}`,
        name: `Суп ${b.name} ${v.name}`,
        type: "soup",
        batchDays: 3,
        servings: 7,
        timeMin: 55,
        ing: [[b.protein, b.amt], ...v.ing, ["salt", 7], ["dill", 10], ["bay", 1]],
        steps: ["Собрать бульон/основу.", "Овощи по твёрдости.", "Соль в конце; детскую порцию отлить раньше."],
        tags: ["batch", "суп"],
        category: "супы",
      });
    }
  }

  // Завтраки
  const grains = [
    { id: "oats", name: "Овсянка", amt: 120 },
    { id: "millet", name: "Пшёнка", amt: 180 },
    { id: "rice", name: "Рисовая каша", amt: 160 },
    { id: "buckwheat", name: "Гречка молочная", amt: 180 },
    { id: "semolina", name: "Манка", amt: 80 },
    { id: "barley", name: "Перловка молочная", amt: 150 },
  ];
  const liquids = [
    { id: "milk", name: "на молоке", amt: 600 },
    { id: "water", name: "на воде", amt: 0 },
  ];
  const addins = [
    { id: "apple", name: "с яблоком", amt: 180 },
    { id: "banana", name: "с бананом", amt: 180 },
    { id: "pear", name: "с грушей", amt: 180 },
    { id: "pumpkin", name: "с тыквой", amt: 300 },
    { id: "berries", name: "с ягодами", amt: 120 },
    { id: "raisin", name: "с изюмом", amt: 40 },
  ];
  let bi = 0;
  for (const g of grains) {
    for (const a of addins) {
      const liquid = bi % 2 === 0 ? ["milk", 650] : null;
      bi++;
      add({
        id: `gb_${g.id}_${a.id}_${bi}`,
        name: `${g.name} ${a.name}${liquid ? " на молоке" : ""}`,
        type: "breakfast",
        batchDays: 1,
        servings: 3,
        timeMin: 20,
        ing: [[g.id, g.amt], [a.id, a.amt], ...(liquid ? [liquid] : []), ["butter", 15], ["salt", 1]],
        steps: ["Довести жидкость.", `Всыпать ${g.name.toLowerCase()}, варить до готовности.`, `${a.name}: добавить в конце.`],
        tags: ["каша", "завтраки"],
        category: "завтраки",
      });
    }
  }

  // Яичные / творог
  const eggDishes = [
    { id: "ge1", name: "Омлет с грибами", ing: [["egg", 6], ["mushroom", 200], ["milk", 80], ["oil", 15], ["salt", 2]], steps: ["Грибы обжарить.", "Залить яйцами."] },
    { id: "ge2", name: "Омлет со шпинатом", ing: [["egg", 6], ["spinach", 150], ["cheese", 50], ["oil", 10], ["salt", 2]], steps: ["Шпинат припустить.", "Яйца и сыр."] },
    { id: "ge3", name: "Яичница с баклажаном", ing: [["egg", 5], ["eggplant", 250], ["tomato", 150], ["oil", 20], ["salt", 2]], steps: ["Баклажан обжарить.", "Яйца."] },
    { id: "ge4", name: "Творог с киви", ing: [["tvorog", 350], ["kiwi", 150], ["yogurt", 80]], steps: ["Киви нарезать.", "Смешать с творогом."] },
    { id: "ge5", name: "Творог с виноградом", ing: [["tvorog", 350], ["grape", 150], ["sourcream", 60]], steps: ["Виноград разрезать для ребёнка.", "Смешать."] },
    { id: "ge6", name: "Сырники с изюмом", ing: [["tvorog", 500], ["raisin", 40], ["egg", 2], ["flour", 70], ["oil", 25], ["salt", 2]], steps: ["Замесить.", "Жарить/запечь."] },
    { id: "ge7", name: "Запеканка творожная с тыквой", ing: [["tvorog", 500], ["pumpkin", 300], ["egg", 2], ["semolina", 60], ["butter", 20]], steps: ["Смешать.", "180° 35 мин."], batch: 3 },
    { id: "ge8", name: "Овсяноблин с творогом", ing: [["oats", 80], ["egg", 2], ["tvorog", 120], ["milk", 50], ["oil", 10]], steps: ["Блин из овсянки.", "Начинка творог."] },
  ];
  for (const e of eggDishes) {
    add({
      id: e.id,
      name: e.name,
      type: "breakfast",
      batchDays: e.batch || 1,
      servings: e.batch ? 6 : 3,
      timeMin: 20,
      ing: e.ing,
      steps: e.steps,
      tags: ["завтраки"],
      category: "завтраки",
    });
  }

  // Салаты / гарниры-самостоятельные
  const salads = [
    { id: "sal1", name: "Салат овощной с маслом", type: "snack", ing: [["cucumber", 200], ["tomato", 200], ["oil", 15], ["salt", 2]], steps: ["Нарезать.", "Заправить."] },
    { id: "sal2", name: "Винегрет", type: "main", batch: 2, ing: [["beet", 300], ["potato", 250], ["carrot", 150], ["onion", 80], ["oil", 25], ["salt", 4]], steps: ["Сварить овощи.", "Нарезать, заправить."] },
    { id: "sal3", name: "Салат из капусты с морковью", type: "snack", ing: [["cabbage", 400], ["carrot", 150], ["oil", 20], ["salt", 3]], steps: ["Нашинковать.", "Помять с солью."] },
    { id: "sal4", name: "Греческий лайт без оливок", type: "main", ing: [["tomato", 300], ["cucumber", 200], ["pepper", 150], ["cheese", 120], ["oil", 25], ["salt", 3]], steps: ["Нарезать.", "Сыр кубиком."] },
    { id: "sal5", name: "Салат с курицей и огурцом", type: "main", ing: [["chicken_fillet", 300], ["cucumber", 200], ["sourcream", 80], ["dill", 10], ["salt", 3]], steps: ["Курицу отварить/остаток.", "Смешать."] },
    { id: "sal6", name: "Салат с тунцом-заменителем (горбуша)", type: "main", ing: [["salmon_pink", 250], ["egg", 3], ["cucumber", 150], ["mayo", 40], ["salt", 2]], steps: ["Рыбу размять.", "Смешать. Майонез — взрослым."] },
  ];
  for (const s of salads) {
    add({
      id: s.id,
      name: s.name,
      type: s.type,
      batchDays: s.batch || 1,
      servings: 4,
      timeMin: 20,
      ing: s.ing,
      steps: s.steps,
      tags: ["салат"],
      category: s.type === "snack" ? "перекусы" : "без мяса",
    });
  }

  // Выпечка / десерты (взрослым сахар отдельно)
  const bakes = [
    { id: "bk1", name: "Шарлотка с яблоками", type: "dessert", batch: 2, ing: [["apple", 600], ["egg", 3], ["flour", 180], ["sugar", 80], ["baking_powder", 5]], steps: ["Яблоки в форму.", "Заливка, 180° 35–40 мин. Сахар — общий корж; ребёнку маленькая доля без сиропа."] },
    { id: "bk2", name: "Кексы на кефире", type: "dessert", batch: 2, ing: [["flour", 250], ["kefir", 250], ["egg", 2], ["sugar", 60], ["oil", 40], ["baking_powder", 8]], steps: ["Смешать.", "Формы 180° 25 мин."] },
    { id: "bk3", name: "Блинчики с творогом", type: "dessert", batch: 2, ing: [["flour", 280], ["milk", 500], ["egg", 2], ["tvorog", 300], ["sourcream", 80], ["oil", 30], ["salt", 2]], steps: ["Блины.", "Начинка творог. Сахар взрослым."] },
    { id: "bk4", name: "Печенье простое", type: "dessert", batch: 3, ing: [["flour", 300], ["butter", 120], ["sugar", 80], ["egg", 1], ["vanilla", 1]], steps: ["Замесить.", "180° 12–15 мин."] },
    { id: "bk5", name: "Запечённые яблоки с творогом", type: "dessert", batch: 1, ing: [["apple", 400], ["tvorog", 200], ["raisin", 30]], steps: ["Вынуть середину.", "Начинка, запечь."] },
    { id: "bk6", name: "Тыквенные оладьи", type: "breakfast", batch: 1, ing: [["pumpkin", 400], ["flour", 120], ["egg", 2], ["oil", 40], ["salt", 2]], steps: ["Тыкву натереть.", "Жарить."] },
    { id: "bk7", name: "Морковный кекс", type: "dessert", batch: 2, ing: [["carrot", 250], ["flour", 200], ["egg", 2], ["oil", 60], ["sugar", 70], ["baking_powder", 7]], steps: ["Смешать.", "180° 40 мин."] },
    { id: "bk8", name: "Какао-напиток взрослым + банан ребёнку", type: "snack", batch: 1, ing: [["cocoa", 15], ["milk", 400], ["banana", 120], ["sugar", 15]], steps: ["Какао взрослым.", "Банан ребёнку отдельно."] },
    { id: "bk9", name: "Творожная запеканка с какао", type: "dessert", batch: 2, ing: [["tvorog", 500], ["egg", 2], ["semolina", 60], ["cocoa", 20], ["sugar", 50], ["butter", 15]], steps: ["Смешать.", "180° 35 мин."] },
    { id: "bk10", name: "Пирог с капустой", type: "main", batch: 2, ing: [["flour", 350], ["cabbage", 500], ["egg", 3], ["oil", 50], ["salt", 6], ["baking_powder", 6]], steps: ["Начинка капуста.", "Тесто, выпечка 180°."] },
    { id: "bk11", name: "Хачапури-лайт на твороге", type: "main", batch: 1, ing: [["flour", 300], ["tvorog", 250], ["cheese", 200], ["egg", 2], ["oil", 30], ["salt", 4]], steps: ["Тесто.", "Начинка сыр, 200° 20 мин."] },
    { id: "bk12", name: "Лепёшки на кефире", type: "snack", batch: 1, ing: [["flour", 300], ["kefir", 250], ["oil", 20], ["salt", 4], ["baking_powder", 5]], steps: ["Замесить.", "Жарить на сухой/масле."] },
  ];
  for (const b of bakes) {
    add({
      id: b.id,
      name: b.name,
      type: b.type === "dessert" ? "dessert" : b.type,
      batchDays: b.batch || 1,
      servings: 6,
      timeMin: 45,
      ing: b.ing,
      steps: b.steps,
      tags: b.type === "dessert" ? ["десерт", "выпечка"] : ["выпечка"],
      category: b.type === "dessert" ? "десерты" : b.type === "breakfast" ? "завтраки" : "выпечка",
    });
  }

  // Перекусы доп.
  const moreSnacks = [
    { id: "ks1", name: "Творог с черносливом", ing: [["tvorog", 150], ["prune", 40]] },
    { id: "ks2", name: "Яблоко + сыр", ing: [["apple", 120], ["cheese", 30]] },
    { id: "ks3", name: "Кефир с бананом", ing: [["kefir", 200], ["banana", 80]] },
    { id: "ks4", name: "Морковь + йогурт", ing: [["carrot", 80], ["yogurt", 80]] },
    { id: "ks5", name: "Хлеб с творожным сыром", ing: [["bread", 50], ["cottage_soft", 40]] },
    { id: "ks6", name: "Груша + йогурт", ing: [["pear", 120], ["yogurt", 100]] },
    { id: "ks7", name: "Ягодный кефирный смузи", ing: [["berries", 80], ["kefir", 150], ["banana", 50]] },
    { id: "ks8", name: "Огурец + варёное яйцо", ing: [["cucumber", 100], ["egg", 1]] },
  ];
  for (const s of moreSnacks) {
    add({
      id: s.id,
      name: s.name,
      type: "snack",
      batchDays: 1,
      servings: 1,
      timeMin: 5,
      ing: s.ing,
      steps: ["Собрать за 5 минут.", "Без сахара для ребёнка."],
      tags: ["детское", "перекусы"],
      category: "перекусы",
    });
  }

  // Вегетарианские основные
  const vegMains = [
    { id: "vm1", name: "Каша гречневая с грибами", ing: [["buckwheat", 300], ["mushroom", 300], ["onion", 150], ["oil", 25], ["salt", 6]], steps: ["Грибы с луком.", "Гречка."] },
    { id: "vm2", name: "Рататуй-лайт", ing: [["zucchini", 400], ["eggplant", 300], ["pepper", 200], ["tomato", 300], ["onion", 150], ["oil", 30], ["salt", 6]], steps: ["Овощи тушить/запечь слоями."] },
    { id: "vm3", name: "Картофель тушёный с грибами", ing: [["potato", 1000], ["mushroom", 300], ["onion", 150], ["oil", 25], ["salt", 7]], steps: ["Тушить под крышкой."] },
    { id: "vm4", name: "Чечевица с овощами", ing: [["lentils", 300], ["carrot", 150], ["onion", 150], ["tomato_paste", 40], ["oil", 20], ["salt", 6]], steps: ["Чечевица + овощи 25 мин."] },
    { id: "vm5", name: "Нут с паприкой и морковью", ing: [["chickpeas", 300], ["carrot", 200], ["onion", 150], ["paprika", 5], ["oil", 25], ["salt", 6]], steps: ["Нут готов, тушить с овощами."] },
    { id: "vm6", name: "Кабачковые котлеты", ing: [["zucchini", 700], ["egg", 2], ["flour", 80], ["oil", 40], ["salt", 5]], steps: ["Натереть, отжать.", "Жарить."] },
    { id: "vm7", name: "Картофельная запеканка с сыром", ing: [["potato", 1000], ["egg", 2], ["sourcream", 120], ["cheese", 100], ["salt", 6]], steps: ["Слои, 180° 40 мин."] },
    { id: "vm8", name: "Плов овощной с нутом", ing: [["rice", 350], ["chickpeas", 200], ["carrot", 250], ["onion", 200], ["oil", 35], ["salt", 7]], steps: ["Зирвак овощной.", "Рис."] },
  ];
  for (const v of vegMains) {
    add({
      id: v.id,
      name: v.name,
      type: "main",
      batchDays: 2,
      servings: 5,
      timeMin: 40,
      ing: v.ing,
      steps: v.steps,
      tags: ["веге", "batch"],
      category: "без мяса",
    });
  }

  return out;
}
