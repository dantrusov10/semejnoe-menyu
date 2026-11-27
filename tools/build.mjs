/**
 * Генератор семейного меню: data/*.js + index.html
 * Семья: 2 взрослых + ребёнок 1.5; batch 2–7 дней; бюджет готовки ~28–35к
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const dataDir = path.join(root, "data");
fs.mkdirSync(dataDir, { recursive: true });

const STORES = {
  ashan: { name: "Ашан", tip: "Доставка / самовывоз, база и акции" },
  pyat: { name: "Пятёрочка", tip: "Раз в неделю: вкусняшки + добор" },
  parnoe: {
    name: "Парное мясо",
    tip: "Самовывоз Молоково, ул. Ленина 57 · parnoemjaso.ru",
    url: "https://parnoemjaso.ru/",
  },
};

/** Ориентиры цен ₽ за единицу (г/мл/шт как указано). Обновлять по чекам. */
const products = [
  // База Ашан
  { id: "potato", name: "Картофель", unit: "g", price: 0.04, store: "ashan" },
  { id: "cabbage", name: "Капуста белокочанная", unit: "g", price: 0.055, store: "ashan" },
  { id: "carrot", name: "Морковь", unit: "g", price: 0.05, store: "ashan" },
  { id: "onion", name: "Лук репчатый", unit: "g", price: 0.055, store: "ashan" },
  { id: "beet", name: "Свёкла", unit: "g", price: 0.06, store: "ashan" },
  { id: "tomato", name: "Помидоры", unit: "g", price: 0.28, store: "ashan" },
  { id: "cucumber", name: "Огурцы", unit: "g", price: 0.22, store: "ashan" },
  { id: "pepper", name: "Перец болгарский", unit: "g", price: 0.35, store: "ashan" },
  { id: "zucchini", name: "Кабачок", unit: "g", price: 0.12, store: "ashan" },
  { id: "pumpkin", name: "Тыква", unit: "g", price: 0.08, store: "ashan" },
  { id: "broccoli", name: "Брокколи зам.", unit: "g", price: 0.18, store: "ashan" },
  { id: "beans_green", name: "Стручковая фасоль зам.", unit: "g", price: 0.2, store: "ashan" },
  { id: "peas", name: "Горошек зам.", unit: "g", price: 0.15, store: "ashan" },
  { id: "corn", name: "Кукуруза зам./банк.", unit: "g", price: 0.18, store: "ashan" },
  { id: "garlic", name: "Чеснок", unit: "g", price: 0.4, store: "ashan" },
  { id: "apple", name: "Яблоки", unit: "g", price: 0.14, store: "ashan" },
  { id: "banana", name: "Бананы", unit: "g", price: 0.13, store: "ashan" },
  { id: "pear", name: "Груши", unit: "g", price: 0.18, store: "ashan" },
  { id: "orange", name: "Апельсины", unit: "g", price: 0.16, store: "ashan" },
  { id: "lemon", name: "Лимон", unit: "g", price: 0.25, store: "ashan" },
  { id: "berries", name: "Ягоды зам.", unit: "g", price: 0.35, store: "ashan" },
  { id: "buckwheat", name: "Гречка", unit: "g", price: 0.08, store: "ashan" },
  { id: "rice", name: "Рис", unit: "g", price: 0.1, store: "ashan" },
  { id: "oats", name: "Овсянка", unit: "g", price: 0.07, store: "ashan" },
  { id: "millet", name: "Пшено", unit: "g", price: 0.07, store: "ashan" },
  { id: "semolina", name: "Манка", unit: "g", price: 0.06, store: "ashan" },
  { id: "pasta", name: "Макароны", unit: "g", price: 0.09, store: "ashan" },
  { id: "lentils", name: "Чечевица", unit: "g", price: 0.12, store: "ashan" },
  { id: "beans_dry", name: "Фасоль сухая", unit: "g", price: 0.11, store: "ashan" },
  { id: "chickpeas", name: "Нут", unit: "g", price: 0.14, store: "ashan" },
  { id: "flour", name: "Мука", unit: "g", price: 0.05, store: "ashan" },
  { id: "bread", name: "Хлеб", unit: "g", price: 0.1, store: "ashan" },
  { id: "oil", name: "Масло подсолнечное", unit: "ml", price: 0.12, store: "ashan" },
  { id: "butter", name: "Масло сливочное", unit: "g", price: 1.2, store: "ashan" },
  { id: "milk", name: "Молоко 2.5–3.2%", unit: "ml", price: 0.075, store: "ashan" },
  { id: "kefir", name: "Кефир", unit: "ml", price: 0.09, store: "ashan" },
  { id: "sourcream", name: "Сметана", unit: "g", price: 0.35, store: "ashan" },
  { id: "tvorog", name: "Творог 5–9%", unit: "g", price: 0.45, store: "ashan" },
  { id: "yogurt", name: "Йогурт натур. без сахара", unit: "g", price: 0.28, store: "ashan" },
  { id: "cheese", name: "Сыр полутвёрдый", unit: "g", price: 0.9, store: "ashan" },
  { id: "egg", name: "Яйцо куриное", unit: "pcs", price: 11, store: "ashan" },
  { id: "tomato_paste", name: "Томатная паста", unit: "g", price: 0.25, store: "ashan" },
  { id: "bay", name: "Лавровый лист", unit: "g", price: 2, store: "ashan" },
  { id: "salt", name: "Соль", unit: "g", price: 0.02, store: "ashan" },
  { id: "pepper_black", name: "Перец чёрный", unit: "g", price: 1.5, store: "ashan" },
  { id: "paprika", name: "Паприка", unit: "g", price: 1.2, store: "ashan" },
  { id: "dill", name: "Укроп/зелень", unit: "g", price: 0.8, store: "ashan" },
  { id: "mayo", name: "Майонез", unit: "g", price: 0.3, store: "ashan" },
  { id: "mustard", name: "Горчица", unit: "g", price: 0.4, store: "ashan" },
  { id: "soy", name: "Соевый соус", unit: "ml", price: 0.2, store: "ashan" },
  { id: "honey_adult", name: "Мёд (только взрослым)", unit: "g", price: 0.6, store: "ashan" },
  { id: "sugar", name: "Сахар (взрослым)", unit: "g", price: 0.07, store: "ashan" },
  // Птица/мясо — Парное мясо (ориентир сайта) + дешёвая птица Ашан
  { id: "chicken_whole", name: "Курица домашняя", unit: "g", price: 0.56, store: "parnoe" },
  { id: "chicken_leg", name: "Окорочка куриные", unit: "g", price: 0.37, store: "parnoe" },
  { id: "chicken_thigh", name: "Бедро куриное", unit: "g", price: 0.38, store: "parnoe" },
  { id: "chicken_breast", name: "Грудка куриная", unit: "g", price: 0.37, store: "parnoe" },
  { id: "chicken_fillet", name: "Филе куриное", unit: "g", price: 0.68, store: "parnoe" },
  { id: "chicken_wing", name: "Крылышки", unit: "g", price: 0.45, store: "parnoe" },
  { id: "chicken_liver", name: "Печень куриная", unit: "g", price: 0.35, store: "parnoe" },
  { id: "chicken_cheap", name: "Курица/бёдра Ашан", unit: "g", price: 0.18, store: "ashan" },
  { id: "turkey_fillet", name: "Индейка филе", unit: "g", price: 0.95, store: "parnoe" },
  { id: "mince_home", name: "Фарш дом. гов+св", unit: "g", price: 0.7, store: "parnoe" },
  { id: "mince_beef", name: "Фарш говяжий", unit: "g", price: 0.8, store: "parnoe" },
  { id: "mince_chicken", name: "Фарш куриный", unit: "g", price: 0.45, store: "ashan" },
  { id: "mince_cheap", name: "Фарш свино-гов. Ашан", unit: "g", price: 0.42, store: "ashan" },
  { id: "pork_shoulder", name: "Свинина лопатка б/к", unit: "g", price: 0.45, store: "parnoe" },
  { id: "pork_carbonade", name: "Свинина карбонад", unit: "g", price: 0.6, store: "parnoe" },
  { id: "pork_ribs", name: "Свинина рёбра", unit: "g", price: 0.55, store: "parnoe" },
  { id: "pork_broth", name: "Свинина бульонка", unit: "g", price: 0.23, store: "parnoe" },
  { id: "beef_stew", name: "Говядина на тушение/бульонка", unit: "g", price: 0.7, store: "parnoe" },
  { id: "beef_liver", name: "Печень говяжья", unit: "g", price: 0.4, store: "ashan" },
  { id: "pollock", name: "Филе минтая с/м", unit: "g", price: 0.37, store: "parnoe" },
  { id: "sole", name: "Филе морской язык с/м", unit: "g", price: 0.36, store: "parnoe" },
  { id: "tilapia", name: "Филе тилапии с/м", unit: "g", price: 0.82, store: "parnoe" },
  { id: "salmon_pink", name: "Горбуша", unit: "g", price: 0.55, store: "ashan" },
  { id: "herring_fillet", name: "Сельдь филе", unit: "g", price: 0.5, store: "ashan" },
];

const byId = Object.fromEntries(products.map((p) => [p.id, p]));

function ing(list) {
  return list.map(([id, amount]) => ({ id, amount }));
}

function costOf(ingredients) {
  return Math.round(
    ingredients.reduce((s, i) => s + (byId[i.id]?.price || 0) * i.amount, 0)
  );
}

function dish(d) {
  const ingredients = ing(d.ing);
  return {
    id: d.id,
    name: d.name,
    type: d.type,
    batchDays: d.batchDays ?? 1,
    servings: d.servings ?? 6,
    timeMin: d.timeMin ?? 40,
    child: d.child ?? "Без сахара/мёда/орехов; соль умеренно; специи минимально на детскую порцию.",
    tags: d.tags ?? [],
    steps: d.steps,
    ingredients,
    costBatch: costOf(ingredients),
    stores: [...new Set(ingredients.map((i) => byId[i.id]?.store).filter(Boolean))],
  };
}

/** ——— ЗАВТРАКИ (28 уникальных) ——— */
const breakfasts = [
  dish({ id: "b01", name: "Овсянка на молоке с яблоком", type: "breakfast", batchDays: 1, servings: 3, timeMin: 15, ing: [["oats",120],["milk",600],["apple",200],["butter",10],["salt",1]], steps: ["Вскипятить молоко.", "Всыпать овсянку, варить 5–7 мин.", "Яблоко натереть/нарезать, вмешать в конце. Детской — без сахара."], tags: ["каша"] }),
  dish({ id: "b02", name: "Овсянка на воде с бананом", type: "breakfast", batchDays: 1, servings: 3, timeMin: 12, ing: [["oats",120],["banana",200],["butter",10],["salt",1]], steps: ["Сварить овсянку на воде.", "Размять банан и вмешать. Взрослым — капля мёда по желанию."], tags: ["каша","детское"] }),
  dish({ id: "b03", name: "Гречневая каша с молоком", type: "breakfast", batchDays: 2, servings: 4, timeMin: 25, ing: [["buckwheat",250],["milk",400],["butter",20],["salt",2]], steps: ["Гречку промыть, сварить до готовности.", "Подавать с горячим молоком и маслом."], tags: ["каша","batch"] }),
  dish({ id: "b04", name: "Пшённая каша с тыквой", type: "breakfast", batchDays: 2, servings: 5, timeMin: 40, ing: [["millet",200],["pumpkin",400],["milk",500],["butter",20],["salt",2]], steps: ["Тыкву кубиком, припустить.", "Добавить пшено и молоко, томить до мягкости."], tags: ["каша","batch"] }),
  dish({ id: "b05", name: "Манная каша", type: "breakfast", batchDays: 1, servings: 3, timeMin: 15, ing: [["semolina",80],["milk",700],["butter",15],["salt",1]], steps: ["Молоко вскипятить, тонкой струйкой всыпать манку, мешая.", "Варить 5 мин. Сахар — только взрослым."], tags: ["каша","детское"] }),
  dish({ id: "b06", name: "Творог с бананом и сметаной", type: "breakfast", batchDays: 1, servings: 3, timeMin: 5, ing: [["tvorog",400],["banana",200],["sourcream",80]], steps: ["Творог размять со сметаной.", "Бананы нарезать/размять для ребёнка."], tags: ["творог","быстро"] }),
  dish({ id: "b07", name: "Сырники в духовке/аэрогриле", type: "breakfast", batchDays: 2, servings: 6, timeMin: 35, ing: [["tvorog",500],["egg",2],["flour",80],["semolina",40],["oil",15],["salt",2]], steps: ["Смешать творог, яйца, муку, манку.", "Сформировать, запечь 180° 20–25 мин (без сахара для общей формы; взрослым посыпать отдельно)."], tags: ["творог","batch"] }),
  dish({ id: "b08", name: "Омлет с сыром", type: "breakfast", batchDays: 1, servings: 3, timeMin: 15, ing: [["egg",6],["milk",100],["cheese",60],["butter",15],["salt",2]], steps: ["Взбить яйца с молоком.", "Вылить на масло, посыпать сыром, накрыть."], tags: ["яйца"] }),
  dish({ id: "b09", name: "Яичница с помидорами", type: "breakfast", batchDays: 1, servings: 3, timeMin: 12, ing: [["egg",6],["tomato",250],["oil",15],["salt",2]], steps: ["Помидоры обжарить 2 мин.", "Вбить яйца, довести до готовности."], tags: ["яйца"] }),
  dish({ id: "b10", name: "Варёные яйца + хлеб + сыр", type: "breakfast", batchDays: 1, servings: 3, timeMin: 12, ing: [["egg",6],["bread",180],["cheese",90],["butter",20]], steps: ["Яйца сварить 8–9 мин.", "Хлеб с маслом и сыром."], tags: ["яйца","быстро"] }),
  dish({ id: "b11", name: "Тосты с творожным намазом и огурцом", type: "breakfast", batchDays: 1, servings: 3, timeMin: 10, ing: [["bread",200],["tvorog",200],["cucumber",150],["sourcream",40],["dill",10],["salt",1]], steps: ["Творог смешать со сметаной и укропом.", "Намазать на хлеб, сверху огурец."], tags: ["быстро"] }),
  dish({ id: "b12", name: "Рисовая молочная каша", type: "breakfast", batchDays: 2, servings: 5, timeMin: 35, ing: [["rice",200],["milk",800],["butter",20],["salt",2]], steps: ["Рис промыть, сварить почти до готовности на воде.", "Долить молоко, томить до мягкости."], tags: ["каша","batch"] }),
  dish({ id: "b13", name: "Запеканка творожная", type: "breakfast", batchDays: 3, servings: 8, timeMin: 50, ing: [["tvorog",700],["egg",3],["semolina",80],["milk",100],["butter",20],["apple",200]], steps: ["Смешать всё, яблоко натереть.", "Форма, 180° 35–40 мин. Хранится в холодильнике 2–3 дня."], tags: ["batch","творог"] }),
  dish({ id: "b14", name: "Блины тонкие (на 2 дня)", type: "breakfast", batchDays: 2, servings: 8, timeMin: 45, ing: [["flour",300],["milk",600],["egg",3],["oil",40],["salt",3]], steps: ["Замесить жидкое тесто.", "Жарить на среднем огне. Детской — без сладких начинок; взрослым — сметана/мёд."], tags: ["batch"] }),
  dish({ id: "b15", name: "Оладьи на кефире", type: "breakfast", batchDays: 1, servings: 4, timeMin: 30, ing: [["flour",250],["kefir",400],["egg",2],["oil",40],["salt",2]], steps: ["Смешать тесто, дать постоять 10 мин.", "Жарить под крышкой."], tags: [] }),
  dish({ id: "b16", name: "Гречка с яйцом всмятку", type: "breakfast", batchDays: 1, servings: 3, timeMin: 25, ing: [["buckwheat",180],["egg",6],["butter",15],["salt",2]], steps: ["Сварить гречку.", "Яйца всмятку 4–5 мин."], tags: [] }),
  dish({ id: "b17", name: "Творог с грушей", type: "breakfast", batchDays: 1, servings: 3, timeMin: 5, ing: [["tvorog",400],["pear",250],["yogurt",100]], steps: ["Грушу нарезать мягко для ребёнка.", "Смешать с творогом и йогуртом."], tags: ["быстро","детское"] }),
  dish({ id: "b18", name: "Овсяноблин с сыром", type: "breakfast", batchDays: 1, servings: 3, timeMin: 15, ing: [["oats",90],["egg",3],["milk",80],["cheese",60],["oil",10],["salt",1]], steps: ["Овсянку смолоть/залить, смешать с яйцом.", "Жарить блин, посыпать сыром."], tags: ["яйца"] }),
  dish({ id: "b19", name: "Пшёнка на молоке", type: "breakfast", batchDays: 2, servings: 5, timeMin: 35, ing: [["millet",200],["milk",700],["butter",20],["salt",2]], steps: ["Пшено промыть до прозрачной воды.", "Варить в молоке до мягкости."], tags: ["каша","batch"] }),
  dish({ id: "b20", name: "Бутерброды с варёной курицей и огурцом", type: "breakfast", batchDays: 1, servings: 3, timeMin: 10, ing: [["bread",200],["chicken_breast",150],["cucumber",120],["butter",20]], steps: ["Использовать курицу с ужина/запаса.", "Собрать бутерброды."], tags: ["быстро"] }),
  dish({ id: "b21", name: "Яичный соус на тостах (яйца+сметана)", type: "breakfast", batchDays: 1, servings: 3, timeMin: 15, ing: [["egg",5],["sourcream",80],["bread",180],["dill",10],["salt",2]], steps: ["Яйца сварить вкрутую, порубить со сметаной и укропом.", "На хлеб."], tags: [] }),
  dish({ id: "b22", name: "Тыквенная каша с рисом", type: "breakfast", batchDays: 2, servings: 5, timeMin: 40, ing: [["pumpkin",500],["rice",150],["milk",500],["butter",20],["salt",2]], steps: ["Тыкву и рис томить с молоком до пюре-подобной консистенции."], tags: ["batch","детское"] }),
  dish({ id: "b23", name: "Кефирные тосты с сыром в аэрогриле", type: "breakfast", batchDays: 1, servings: 3, timeMin: 12, ing: [["bread",200],["kefir",50],["cheese",100],["butter",10]], steps: ["Хлеб слегка смочить кефиром, сыр сверху.", "Аэрогриль 3–5 мин."], tags: ["быстро"] }),
  dish({ id: "b24", name: "Драники (картофельные)", type: "breakfast", batchDays: 1, servings: 4, timeMin: 35, ing: [["potato",700],["egg",2],["flour",40],["onion",80],["oil",50],["salt",3]], steps: ["Картофель и лук натереть, отжать.", "Смешать с яйцом и мукой, жарить."], tags: [] }),
  dish({ id: "b25", name: "Омлет с кабачком", type: "breakfast", batchDays: 1, servings: 3, timeMin: 18, ing: [["egg",6],["zucchini",250],["milk",80],["oil",15],["salt",2]], steps: ["Кабачок обжарить.", "Залить яйцами с молоком."], tags: ["яйца"] }),
  dish({ id: "b26", name: "Творог с ягодами зам.", type: "breakfast", batchDays: 1, servings: 3, timeMin: 5, ing: [["tvorog",400],["berries",150],["yogurt",100]], steps: ["Ягоды чуть разморозить.", "Смешать с творогом. Без сахара для ребёнка."], tags: ["быстро"] }),
  dish({ id: "b27", name: "Кукурузная каша на молоке", type: "breakfast", batchDays: 2, servings: 4, timeMin: 30, ing: [["corn",80],["semolina",40],["milk",700],["butter",15],["salt",2]], steps: ["Вариант: манка + кукуруза зам. как «жёлтая» каша; либо готовая кукурузная крупа если есть.", "Томить, помешивая."], tags: ["каша"] }),
  dish({ id: "b28", name: "Ленивые вареники", type: "breakfast", batchDays: 2, servings: 5, timeMin: 30, ing: [["tvorog",500],["egg",2],["flour",120],["butter",20],["salt",2]], steps: ["Замесить тесто, нарезать.", "Варить в кипятке 2–3 мин после всплытия. Со сметаной."], tags: ["batch","творог"] }),
];

/** ——— СУПЫ (30 × ~3 дня) ——— */
const soups = [
  dish({ id: "s01", name: "Куриный суп с лапшой", type: "soup", batchDays: 3, servings: 8, timeMin: 60, ing: [["chicken_cheap",800],["pasta",120],["carrot",150],["onion",120],["potato",300],["dill",20],["salt",8],["bay",2]], steps: ["Сварить бульон из курицы 40 мин, снять пену.", "Добавить овощи, варить 15 мин.", "Лапшу — в конце 7 мин. Соль умеренно; детской порции меньше соли."], tags: ["batch","курица"] }),
  dish({ id: "s02", name: "Борщ на свиной бульонке", type: "soup", batchDays: 3, servings: 10, timeMin: 90, ing: [["pork_broth",700],["beet",300],["cabbage",400],["potato",400],["carrot",150],["onion",150],["tomato_paste",40],["sourcream",100],["salt",10],["bay",2],["oil",20]], steps: ["Бульон 1 ч.", "Свёклу и морковь пассеровать с томатной пастой.", "Капуста, картофель, заправка — до мягкости. Со сметаной."], tags: ["batch","свинина"] }),
  dish({ id: "s03", name: "Щи из свежей капусты", type: "soup", batchDays: 3, servings: 8, timeMin: 70, ing: [["chicken_cheap",600],["cabbage",500],["potato",350],["carrot",120],["onion",120],["tomato_paste",30],["salt",8],["sourcream",80]], steps: ["Бульон, затем овощи.", "Капусту не переваривать."], tags: ["batch"] }),
  dish({ id: "s04", name: "Гороховый суп со свининой", type: "soup", batchDays: 3, servings: 8, timeMin: 90, ing: [["beans_dry",300],["pork_shoulder",400],["carrot",120],["onion",120],["potato",250],["oil",15],["salt",8],["bay",2]], steps: ["Горох/фасоль замочить (или взять горох колотый — в данных фасоль как бобовая база; замените на горох в магазине).", "Варить с мясом до мягкости, добавить овощи."], tags: ["batch"] }),
  dish({ id: "s05", name: "Суп с фрикадельками", type: "soup", batchDays: 3, servings: 8, timeMin: 50, ing: [["mince_cheap",400],["egg",1],["rice",40],["potato",350],["carrot",120],["onion",150],["salt",8],["dill",15]], steps: ["Фарш + яйцо + рис → фрикадельки.", "В кипящий овощной бульон."], tags: ["batch","фарш"] }),
  dish({ id: "s06", name: "Уха из минтая (филе)", type: "soup", batchDays: 2, servings: 6, timeMin: 40, ing: [["pollock",500],["potato",400],["carrot",100],["onion",100],["dill",15],["salt",6],["bay",2],["oil",10]], steps: ["Овощи сварить 15 мин.", "Филе кубиком — 8–10 мин. Без мелких костей — проверять."], tags: ["рыба","детское"] }),
  dish({ id: "s07", name: "Тыквенный крем-суп", type: "soup", batchDays: 3, servings: 7, timeMin: 40, ing: [["pumpkin",800],["carrot",150],["onion",100],["cream_proxy",0],["milk",300],["oil",20],["salt",6],["bread",100]], steps: ["Овощи запечь/сварить, пробить блендером.", "Развести молоком. Гренки взрослым."], tags: ["batch","веге"] }),
  dish({ id: "s08", name: "Солянка сборная упрощённая", type: "soup", batchDays: 3, servings: 8, timeMin: 60, ing: [["mince_cheap",200],["chicken_cheap",400],["onion",150],["tomato_paste",50],["cucumber",150],["lemon",50],["sourcream",80],["salt",6],["oil",20],["bay",2]], steps: ["Обжарить лук, томат, солёные огурцы.", "Добавить бульон и мясо. Лимон и сметана при подаче."], tags: ["batch"] }),
  dish({ id: "s09", name: "Рассольник с рисом", type: "soup", batchDays: 3, servings: 8, timeMin: 70, ing: [["beef_stew",400],["rice",80],["carrot",100],["onion",100],["potato",300],["cucumber",200],["salt",5],["bay",2]], steps: ["Говядину сварить.", "Добавить рис, овощи, огурцы в конце."], tags: ["batch","говядина"] }),
  dish({ id: "s10", name: "Чечевичный суп", type: "soup", batchDays: 3, servings: 8, timeMin: 45, ing: [["lentils",300],["carrot",150],["onion",120],["tomato_paste",30],["oil",20],["salt",7],["paprika",3],["bread",150]], steps: ["Обжарить овощи, добавить чечевицу и воду.", "Варить 25–30 мин."], tags: ["batch","веге"] }),
  dish({ id: "s11", name: "Суп харчо упрощённый с рисом", type: "soup", batchDays: 3, servings: 8, timeMin: 70, ing: [["beef_stew",500],["rice",100],["onion",200],["tomato_paste",50],["garlic",20],["oil",20],["salt",7],["paprika",4]], steps: ["Мясо сварить.", "Лук пассеровать с томатом, соединить, рис до готовности. Специи взрослым сильнее."], tags: ["batch"] }),
  dish({ id: "s12", name: "Овощной суп с индейкой", type: "soup", batchDays: 3, servings: 7, timeMin: 55, ing: [["turkey_fillet",400],["potato",300],["carrot",120],["broccoli",200],["onion",100],["salt",6],["dill",15]], steps: ["Индейку отварить, нарезать.", "Овощи до мягкости. Брокколи в конце."], tags: ["batch"] }),
  dish({ id: "s13", name: "Крем-суп из брокколи", type: "soup", batchDays: 2, servings: 6, timeMin: 35, ing: [["broccoli",600],["potato",200],["onion",80],["milk",250],["butter",20],["salt",5]], steps: ["Сварить овощи, пробить.", "Молоко/масло, не кипятить сильно."], tags: ["веге","детское"] }),
  dish({ id: "s14", name: "Суп с куриной печенью и овощами", type: "soup", batchDays: 2, servings: 6, timeMin: 45, ing: [["chicken_liver",400],["potato",300],["carrot",100],["onion",100],["oil",15],["salt",6],["bay",1]], steps: ["Печень промыть, нарезать, коротко обжарить.", "В овощной бульон на 10 мин."], tags: ["печень"] }),
  dish({ id: "s15", name: "Минестроне с фасолью", type: "soup", batchDays: 3, servings: 8, timeMin: 55, ing: [["beans_dry",200],["pasta",80],["carrot",120],["zucchini",200],["tomato",200],["onion",100],["oil",20],["salt",7]], steps: ["Фасоль заранее замочить/сварить.", "Овощи, в конце макароны."], tags: ["batch","веге"] }),
  dish({ id: "s16", name: "Картофельный суп с мясными тефтелями", type: "soup", batchDays: 3, servings: 8, timeMin: 50, ing: [["mince_home",350],["potato",500],["carrot",100],["onion",120],["egg",1],["salt",7],["dill",15]], steps: ["Тефтели из фарша.", "Картофельный бульон + тефтели."], tags: ["batch"] }),
  dish({ id: "s17", name: "Суп-пюре из цветной/брокколи с гренками", type: "soup", batchDays: 2, servings: 6, timeMin: 35, ing: [["broccoli",500],["carrot",100],["onion",80],["milk",200],["bread",120],["butter",25],["salt",5]], steps: ["Как крем-суп брокколи; гренки на масле взрослым."], tags: ["веге"] }),
  dish({ id: "s18", name: "Щи зелёные со шпинатом/щавелем (зам. зелень)", type: "soup", batchDays: 2, servings: 6, timeMin: 40, ing: [["chicken_cheap",400],["potato",300],["egg",3],["dill",40],["onion",80],["sourcream",80],["salt",6]], steps: ["Бульон, картофель.", "Зелень в конце, яйцо лентой. Сметана."], tags: [] }),
  dish({ id: "s19", name: "Томатный суп с курицей и рисом", type: "soup", batchDays: 3, servings: 7, timeMin: 50, ing: [["chicken_thigh",500],["rice",100],["tomato_paste",60],["onion",120],["carrot",100],["oil",15],["salt",7]], steps: ["Обжарить заправку, бульон из бёдер, рис."], tags: ["batch"] }),
  dish({ id: "s20", name: "Суп с фрикадельками из индейки", type: "soup", batchDays: 3, servings: 7, timeMin: 45, ing: [["turkey_fillet",400],["egg",1],["potato",300],["carrot",100],["onion",100],["salt",6],["dill",10]], steps: ["Филе прокрутить/мелко порубить → фрикадельки.", "Овощной бульон."], tags: ["batch"] }),
  dish({ id: "s21", name: "Грибной суп на шампиньонах (магазин)", type: "soup", batchDays: 2, servings: 6, timeMin: 40, ing: [["onion",150],["potato",350],["carrot",100],["oil",25],["sourcream",80],["salt",6],["dill",15],["flour",20],["milk",100]], steps: ["Шампиньоны купить дополнительно (~300 г) — в чеке Ашан; обжарить с луком.", "Картофель, заправить."], tags: [] }),
  dish({ id: "s22", name: "Суп с перловкой и говядиной", type: "soup", batchDays: 3, servings: 8, timeMin: 90, ing: [["beef_stew",450],["buckwheat",0],["carrot",120],["onion",120],["potato",300],["salt",8],["bay",2],["oil",10]], steps: ["Перловку (купить, ~150 г) замочить.", "Варить с говядиной, затем овощи. (В прайсе перловка ≈ гречка по цене — заведите в закупке.)"], tags: ["batch"] }),
  dish({ id: "s23", name: "Капустняк со свининой", type: "soup", batchDays: 3, servings: 8, timeMin: 75, ing: [["pork_shoulder",400],["cabbage",500],["potato",300],["carrot",100],["tomato_paste",30],["salt",7],["oil",15]], steps: ["Мясо + капуста томить до мягкости."], tags: ["batch"] }),
  dish({ id: "s24", name: "Рыбный суп с горбушей", type: "soup", batchDays: 2, servings: 6, timeMin: 40, ing: [["salmon_pink",450],["potato",350],["carrot",100],["onion",100],["salt",6],["dill",15],["bay",2]], steps: ["Овощи, затем рыбу кусками 12 мин. Кости вынуть тщательно."], tags: ["рыба"] }),
  dish({ id: "s25", name: "Нутовый суп с курицей", type: "soup", batchDays: 3, servings: 8, timeMin: 70, ing: [["chickpeas",250],["chicken_leg",600],["carrot",120],["onion",120],["tomato_paste",30],["oil",15],["salt",7]], steps: ["Нут замочить на ночь.", "Варить с курицей до мягкости."], tags: ["batch"] }),
  dish({ id: "s26", name: "Свекольник тёплый", type: "soup", batchDays: 2, servings: 6, timeMin: 50, ing: [["beet",400],["potato",250],["carrot",100],["egg",3],["sourcream",100],["dill",15],["salt",5],["lemon",40]], steps: ["Свёклу и овощи сварить.", "Яйцо, сметана, лимон при подаче."], tags: ["веге"] }),
  dish({ id: "s27", name: "Суп с клёцками", type: "soup", batchDays: 2, servings: 6, timeMin: 45, ing: [["chicken_cheap",500],["flour",150],["egg",2],["potato",200],["carrot",80],["salt",6],["butter",20]], steps: ["Бульон.", "Клёцки из яйца+муки+масла — варить до всплытия."], tags: [] }),
  dish({ id: "s28", name: "Томлёный овощной суп с фаршем", type: "soup", batchDays: 3, servings: 8, timeMin: 50, ing: [["mince_cheap",350],["cabbage",300],["potato",300],["carrot",120],["onion",120],["tomato_paste",40],["oil",15],["salt",7]], steps: ["Фарш обжарить, овощи, вода — тушить как густой суп."], tags: ["batch"] }),
  dish({ id: "s29", name: "Куриный суп с гречкой", type: "soup", batchDays: 3, servings: 7, timeMin: 55, ing: [["chicken_leg",600],["buckwheat",120],["carrot",100],["onion",100],["salt",6],["dill",10]], steps: ["Бульон, гречка 20 мин."], tags: ["batch"] }),
  dish({ id: "s30", name: "Суп со сладким перцем и курицей", type: "soup", batchDays: 3, servings: 7, timeMin: 50, ing: [["chicken_thigh",500],["pepper",250],["potato",250],["carrot",100],["onion",100],["tomato_paste",30],["oil",15],["salt",6]], steps: ["Бульон, овощи, перец не переваривать."], tags: ["batch"] }),
];

// Fix s07 cream_proxy - remove invalid product
soups.forEach((s) => {
  s.ingredients = s.ingredients.filter((i) => i.id !== "cream_proxy" && byId[i.id]);
  s.costBatch = costOf(s.ingredients);
  s.stores = [...new Set(s.ingredients.map((i) => byId[i.id]?.store).filter(Boolean))];
});

/** ——— ОСНОВНЫЕ (45 × 2 дня) ——— */
const mains = [
  dish({ id: "m01", name: "Курица запечённая с картофелем", type: "main", batchDays: 2, servings: 6, timeMin: 70, ing: [["chicken_cheap",1200],["potato",1000],["onion",200],["oil",30],["paprika",4],["salt",10],["garlic",15]], steps: ["Картофель и курицу смешать с маслом и специями.", "Духовка 190° 55–65 мин."], tags: ["batch","духовка","курица"] }),
  dish({ id: "m02", name: "Подлива из фарша с макаронами", type: "main", batchDays: 2, servings: 6, timeMin: 40, ing: [["mince_cheap",600],["pasta",400],["onion",200],["carrot",150],["tomato_paste",50],["oil",20],["salt",8]], steps: ["Фарш с овощами и томатом — подлива.", "Макароны отдельно. Хранится 2 дня."], tags: ["batch","фарш"] }),
  dish({ id: "m03", name: "Тефтели в томатном соусе с рисом", type: "main", batchDays: 2, servings: 6, timeMin: 50, ing: [["mince_home",600],["rice",300],["egg",1],["onion",150],["tomato_paste",60],["sourcream",60],["oil",20],["salt",8]], steps: ["Тефтели слепить, тушить в соусе 25 мин.", "Рис гарниром."], tags: ["batch"] }),
  dish({ id: "m04", name: "Свинина тушёная с овощами", type: "main", batchDays: 3, servings: 7, timeMin: 80, ing: [["pork_shoulder",800],["carrot",200],["onion",200],["pepper",200],["tomato_paste",40],["oil",20],["salt",9],["bay",2]], steps: ["Мясо кубиком обжарить, тушить под крышкой 50–60 мин с овощами."], tags: ["batch","свинина"] }),
  dish({ id: "m05", name: "Голубцы ленивые", type: "main", batchDays: 3, servings: 8, timeMin: 60, ing: [["mince_cheap",500],["cabbage",600],["rice",150],["onion",150],["tomato_paste",50],["sourcream",80],["oil",20],["salt",8]], steps: ["Капусту нашинковать, смешать с фаршем и рисом.", "Тушить в соусе 40 мин."], tags: ["batch"] }),
  dish({ id: "m06", name: "Филе минтая в духовке с брокколи", type: "main", batchDays: 2, servings: 5, timeMin: 35, ing: [["pollock",700],["broccoli",400],["lemon",40],["oil",20],["salt",6]], steps: ["Филе на противень, рядом брокколи.", "180° 20–25 мин. Костей нет — удобно ребёнку."], tags: ["рыба","детское"] }),
  dish({ id: "m07", name: "Куриные бёдра в аэрогриле", type: "main", batchDays: 2, servings: 5, timeMin: 40, ing: [["chicken_thigh",900],["paprika",4],["garlic",15],["oil",20],["salt",8],["buckwheat",300]], steps: ["Маринад 15 мин.", "Аэрогриль 180° ~25–30 мин. Гречка гарниром."], tags: ["batch"] }),
  dish({ id: "m08", name: "Плов со свининой", type: "main", batchDays: 2, servings: 7, timeMin: 70, ing: [["pork_shoulder",600],["rice",400],["carrot",300],["onion",250],["oil",40],["garlic",20],["salt",10]], steps: ["Зирвак: мясо, лук, морковь.", "Рис, вода, чеснок зубчиками — томить."], tags: ["batch"] }),
  dish({ id: "m09", name: "Гуляш говяжий с гречкой", type: "main", batchDays: 3, servings: 6, timeMin: 90, ing: [["beef_stew",700],["onion",250],["tomato_paste",50],["flour",20],["oil",25],["salt",8],["bay",2],["buckwheat",300]], steps: ["Мясо тушить 1–1.5 ч до мягкости.", "Гречка отдельно."], tags: ["batch","говядина"] }),
  dish({ id: "m10", name: "Печень куриная тушёная со сметаной", type: "main", batchDays: 2, servings: 5, timeMin: 35, ing: [["chicken_liver",600],["onion",200],["sourcream",150],["oil",20],["salt",6],["pasta",300]], steps: ["Печень быстро обжарить, лук, сметана 10 мин.", "Не пересушивать. Макароны."], tags: ["печень","batch"] }),
  dish({ id: "m11", name: "Котлеты куриные с пюре", type: "main", batchDays: 2, servings: 6, timeMin: 50, ing: [["mince_chicken",600],["bread",80],["milk",80],["egg",1],["onion",100],["potato",1000],["butter",30],["oil",30],["salt",8]], steps: ["Котлеты обжарить/запечь.", "Пюре с маслом и молоком."], tags: ["batch"] }),
  dish({ id: "m12", name: "Рагу из индейки с кабачком", type: "main", batchDays: 2, servings: 6, timeMin: 45, ing: [["turkey_fillet",600],["zucchini",500],["tomato",200],["onion",150],["oil",20],["salt",7],["rice",250]], steps: ["Индейку обжарить, овощи тушить вместе."], tags: ["batch"] }),
  dish({ id: "m13", name: "Свиные рёбра запечённые", type: "main", batchDays: 2, servings: 5, timeMin: 80, ing: [["pork_ribs",1000],["mustard",30],["paprika",4],["garlic",15],["salt",8],["potato",800]], steps: ["Обмазать, запекать под фольгой 50 мин + без 20 мин.", "Картофель рядом."], tags: ["batch"] }),
  dish({ id: "m14", name: "Рыба в кляре (минтай) + салат", type: "main", batchDays: 1, servings: 4, timeMin: 35, ing: [["pollock",600],["egg",2],["flour",80],["oil",60],["cucumber",200],["tomato",200],["salt",6]], steps: ["Филе в кляре обжарить.", "Овощной салат."], tags: ["рыба"] }),
  dish({ id: "m15", name: "Чахохбили по-домашнему", type: "main", batchDays: 2, servings: 6, timeMin: 60, ing: [["chicken_thigh",1000],["tomato",400],["onion",300],["garlic",20],["oil",25],["salt",8],["paprika",4],["bread",200]], steps: ["Курицу обжарить, лук, томаты — тушить 30–40 мин."], tags: ["batch"] }),
  dish({ id: "m16", name: "Фаршированный перец", type: "main", batchDays: 2, servings: 6, timeMin: 70, ing: [["pepper",800],["mince_cheap",500],["rice",120],["onion",150],["tomato_paste",50],["sourcream",80],["oil",20],["salt",8]], steps: ["Начинка фарш+рис, запечь/тушить в соусе 40 мин."], tags: ["batch"] }),
  dish({ id: "m17", name: "Бефстроганов упрощённый с пюре", type: "main", batchDays: 2, servings: 5, timeMin: 50, ing: [["beef_stew",600],["onion",200],["sourcream",200],["flour",20],["oil",25],["salt",7],["potato",900],["butter",30]], steps: ["Мясо тонко, обжарить, сметанный соус.", "Пюре."], tags: ["batch"] }),
  dish({ id: "m18", name: "Курица терияки-лайт с рисом", type: "main", batchDays: 2, servings: 5, timeMin: 40, ing: [["chicken_fillet",700],["soy",40],["garlic",10],["oil",15],["rice",300],["broccoli",300],["salt",3]], steps: ["Филе обжарить, соевый соус в конце (взрослым больше).", "Рис и брокколи."], tags: ["batch"] }),
  dish({ id: "m19", name: "Запеканка картофельная с фаршем", type: "main", batchDays: 3, servings: 8, timeMin: 70, ing: [["potato",1200],["mince_cheap",500],["onion",150],["egg",2],["sourcream",100],["cheese",80],["oil",20],["salt",9]], steps: ["Слой картофеля, фарш, картофель, сметана+яйцо, сыр.", "180° 45 мин."], tags: ["batch","духовка"] }),
  dish({ id: "m20", name: "Морской язык запечённый с лимоном", type: "main", batchDays: 1, servings: 4, timeMin: 30, ing: [["sole",600],["lemon",60],["oil",15],["salt",5],["rice",250],["peas",200]], steps: ["Филе, лимон, 180° 18–20 мин.", "Рис с горошком."], tags: ["рыба","детское"] }),
  dish({ id: "m21", name: "Тушёная капуста с курицей", type: "main", batchDays: 3, servings: 7, timeMin: 55, ing: [["cabbage",900],["chicken_cheap",600],["onion",150],["carrot",150],["tomato_paste",40],["oil",25],["salt",8]], steps: ["Курицу обжарить, капусту тушить до мягкости 40 мин."], tags: ["batch"] }),
  dish({ id: "m22", name: "Шашлык-стиль свинина в духовке", type: "main", batchDays: 2, servings: 5, timeMin: 70, ing: [["pork_carbonade",800],["onion",300],["oil",20],["paprika",5],["salt",8],["bread",200]], steps: ["Маринад с луком ≥1 ч.", "Запечь на решётке/противне 40–50 мин."], tags: ["batch"] }),
  dish({ id: "m23", name: "Котлеты говяжьи с гречкой", type: "main", batchDays: 2, servings: 6, timeMin: 45, ing: [["mince_beef",600],["onion",120],["bread",70],["milk",70],["egg",1],["oil",35],["buckwheat",300],["salt",8]], steps: ["Котлеты, гречка."], tags: ["batch"] }),
  dish({ id: "m24", name: "Тилапия с овощами на пару/в фольге", type: "main", batchDays: 1, servings: 4, timeMin: 30, ing: [["tilapia",600],["zucchini",300],["carrot",150],["lemon",40],["oil",15],["salt",5]], steps: ["Фольга: рыба + овощи, 190° 20 мин."], tags: ["рыба"] }),
  dish({ id: "m25", name: "Куриные крылышки + картофель айдахо-лайт", type: "main", batchDays: 2, servings: 5, timeMin: 55, ing: [["chicken_wing",900],["potato",900],["oil",40],["paprika",5],["salt",9],["garlic",10]], steps: ["Всё в масле и паприке, 200° 40–45 мин."], tags: ["batch","духовка"] }),
  dish({ id: "m26", name: "Паста с курицей и сливочным соусом", type: "main", batchDays: 1, servings: 4, timeMin: 30, ing: [["pasta",350],["chicken_fillet",400],["sourcream",150],["garlic",10],["oil",15],["salt",6],["cheese",50]], steps: ["Филе кубиком, соус сметана+чеснок, паста."], tags: [] }),
  dish({ id: "m27", name: "Печень говяжья с луком и пюре", type: "main", batchDays: 2, servings: 5, timeMin: 40, ing: [["beef_liver",600],["onion",300],["milk",200],["oil",25],["salt",6],["potato",900],["butter",30]], steps: ["Печень вымочить в молоке 30 мин.", "Обжарить с луком быстро. Пюре."], tags: ["печень","batch"] }),
  dish({ id: "m28", name: "Рагу овощное с фасолью и фаршем", type: "main", batchDays: 3, servings: 7, timeMin: 50, ing: [["mince_cheap",400],["beans_dry",200],["carrot",150],["onion",150],["tomato_paste",40],["oil",20],["salt",8]], steps: ["Фасоль готова заранее.", "Фарш + овощи + фасоль тушить."], tags: ["batch"] }),
  dish({ id: "m29", name: "Курица целиком фаршированная гречкой", type: "main", batchDays: 3, servings: 8, timeMin: 100, ing: [["chicken_whole",1600],["buckwheat",250],["onion",150],["carrot",100],["oil",20],["salt",10],["garlic",15]], steps: ["Гречку полуготово, нафаршировать.", "Запечь 180° ~1.5 ч."], tags: ["batch","parnoe"] }),
  dish({ id: "m30", name: "Горбуша запечённая со сметаной", type: "main", batchDays: 2, servings: 5, timeMin: 45, ing: [["salmon_pink",800],["sourcream",120],["onion",150],["lemon",40],["salt",6],["potato",700]], steps: ["Рыбу проверить на кости.", "Сметана+лук сверху, 180° 30 мин."], tags: ["рыба","batch"] }),
  dish({ id: "m31", name: "Люля-лаваш-стиль из фарша в духовке", type: "main", batchDays: 2, servings: 5, timeMin: 40, ing: [["mince_home",700],["onion",200],["garlic",15],["salt",8],["paprika",4],["bread",250]], steps: ["Фарш отбить, колбаски на противне 200° 25 мин."], tags: ["batch"] }),
  dish({ id: "m32", name: "Овощное рагу с нутом", type: "main", batchDays: 3, servings: 6, timeMin: 55, ing: [["chickpeas",250],["zucchini",400],["tomato",250],["carrot",150],["onion",150],["oil",25],["salt",7],["paprika",3]], steps: ["Нут готов, тушить с овощами. Безмясной день."], tags: ["batch","веге"] }),
  dish({ id: "m33", name: "Отбивные свиные с гречкой", type: "main", batchDays: 2, servings: 5, timeMin: 40, ing: [["pork_carbonade",700],["egg",1],["flour",60],["oil",40],["buckwheat",300],["salt",7]], steps: ["Отбить, в яйце и муке, обжарить.", "Гречка."], tags: ["batch"] }),
  dish({ id: "m34", name: "Куриное филе су-вид лайт / в рукаве", type: "main", batchDays: 2, servings: 5, timeMin: 50, ing: [["chicken_fillet",800],["oil",15],["garlic",10],["salt",6],["beans_green",400],["rice",250]], steps: ["Филе в рукаве 180° 35 мин.", "Фасоль и рис."], tags: ["batch"] }),
  dish({ id: "m35", name: "Макароны по-флотски", type: "main", batchDays: 2, servings: 6, timeMin: 35, ing: [["pasta",400],["mince_cheap",500],["onion",200],["oil",20],["salt",8],["tomato_paste",30]], steps: ["Классика: фарш с луком + паста."], tags: ["batch","быстро"] }),
  dish({ id: "m36", name: "Рагу из свинины с картофелем в мультиварке", type: "main", batchDays: 3, servings: 7, timeMin: 90, ing: [["pork_shoulder",700],["potato",1000],["carrot",200],["onion",200],["oil",15],["salt",9],["bay",2]], steps: ["Режим тушение 1 ч или духовка под крышкой."], tags: ["batch","мультиварка"] }),
  dish({ id: "m37", name: "Рыбные котлеты из минтая", type: "main", batchDays: 2, servings: 5, timeMin: 40, ing: [["pollock",700],["onion",100],["egg",1],["bread",60],["milk",60],["oil",40],["salt",6],["potato",800]], steps: ["Филе измельчить, котлеты, пюре/картофель."], tags: ["рыба","batch","детское"] }),
  dish({ id: "m38", name: "Индейка запечённая куском", type: "main", batchDays: 2, servings: 5, timeMin: 55, ing: [["turkey_fillet",800],["mustard",25],["oil",15],["salt",6],["buckwheat",280],["cucumber",200]], steps: ["Обмазать горчицей, 180° 40 мин.", "Гречка, свежий огурец."], tags: ["batch"] }),
  dish({ id: "m39", name: "Кабачковая запеканка с фаршем", type: "main", batchDays: 2, servings: 6, timeMin: 55, ing: [["zucchini",800],["mince_cheap",400],["egg",3],["sourcream",100],["cheese",80],["salt",7],["oil",15]], steps: ["Слои кабачок/фарш, заливка, сыр, 180° 40 мин."], tags: ["batch"] }),
  dish({ id: "m40", name: "Жаркое в горшочках/форме", type: "main", batchDays: 2, servings: 6, timeMin: 80, ing: [["pork_shoulder",600],["potato",800],["carrot",150],["onion",150],["oil",20],["salt",8],["bay",2]], steps: ["Всё кубиком в форму, 180° 1 ч."], tags: ["batch"] }),
  dish({ id: "m41", name: "Курица карри-лайт с рисом", type: "main", batchDays: 2, servings: 5, timeMin: 45, ing: [["chicken_thigh",800],["onion",200],["carrot",150],["paprika",6],["sourcream",120],["oil",20],["salt",7],["rice",300]], steps: ["Тушить курицу с паприкой и сметаной (мягкие специи).", "Детской — без острого."], tags: ["batch"] }),
  dish({ id: "m42", name: "Сельдь филе + картошка отварная + яйцо", type: "main", batchDays: 1, servings: 4, timeMin: 30, ing: [["herring_fillet",350],["potato",800],["egg",4],["onion",100],["oil",15],["salt",4]], steps: ["Картофель и яйца сварить.", "Сельдь подать с луком. Ребёнку — картофель+яйцо отдельно."], tags: ["рыба"] }),
  dish({ id: "m43", name: "Фрикасе из курицы с овощами", type: "main", batchDays: 2, servings: 5, timeMin: 45, ing: [["chicken_fillet",700],["peas",200],["carrot",150],["onion",100],["sourcream",150],["flour",15],["oil",15],["salt",6],["rice",250]], steps: ["Филе + овощи в сметанном соусе."], tags: ["batch"] }),
  dish({ id: "m44", name: "Свинина с капустой в духовке", type: "main", batchDays: 3, servings: 7, timeMin: 90, ing: [["pork_shoulder",700],["cabbage",800],["onion",200],["oil",20],["salt",9],["tomato_paste",30]], steps: ["Слои капуста/мясо, тушить в духовке 1–1.5 ч."], tags: ["batch"] }),
  dish({ id: "m45", name: "Домашняя пицца на готовом/простом тесте", type: "main", batchDays: 1, servings: 5, timeMin: 40, ing: [["flour",350],["oil",30],["tomato_paste",50],["cheese",200],["chicken_fillet",200],["pepper",150],["salt",5]], steps: ["Быстрое тесто или готовая основа из Ашана.", "220° 12–15 мин. Раз в 2–3 недели как «праздник меню»."], tags: [] }),
];

/** ——— ПЕРЕКУСЫ ДЛЯ ДОЧКИ ——— */
const snacks = [
  dish({ id: "k01", name: "Банан + творог", type: "snack", batchDays: 1, servings: 2, timeMin: 3, ing: [["banana",100],["tvorog",80]], steps: ["Размять вместе."], tags: ["детское"] }),
  dish({ id: "k02", name: "Яблоко запечённое", type: "snack", batchDays: 1, servings: 2, timeMin: 25, ing: [["apple",200]], steps: ["Запечь до мягкости, размять."], tags: ["детское"] }),
  dish({ id: "k03", name: "Кефир тёплый", type: "snack", batchDays: 1, servings: 1, timeMin: 2, ing: [["kefir",200]], steps: ["Комнатная температура."], tags: ["детское"] }),
  dish({ id: "k04", name: "Йогурт натуральный + груша", type: "snack", batchDays: 1, servings: 2, timeMin: 3, ing: [["yogurt",120],["pear",100]], steps: ["Без сахара."], tags: ["детское"] }),
  dish({ id: "k05", name: "Овощные палочки (огурец/морковь)", type: "snack", batchDays: 1, servings: 2, timeMin: 5, ing: [["cucumber",80],["carrot",80]], steps: ["Морковь тонко/бланшировать если твёрдо."], tags: ["детское"] }),
  dish({ id: "k06", name: "Хлебцы/хлеб с маслом и сыром", type: "snack", batchDays: 1, servings: 2, timeMin: 3, ing: [["bread",40],["butter",10],["cheese",20]], steps: ["Маленький бутерброд."], tags: ["детское"] }),
  dish({ id: "k07", name: "Ягодное пюре из зам.", type: "snack", batchDays: 1, servings: 2, timeMin: 5, ing: [["berries",100]], steps: ["Разморозить, размять."], tags: ["детское"] }),
  dish({ id: "k08", name: "Рисовая каша-остаток тёплая", type: "snack", batchDays: 1, servings: 1, timeMin: 5, ing: [["rice",60],["milk",80]], steps: ["Разогреть остаток завтрака."], tags: ["детское"] }),
  dish({ id: "k09", name: "Яйцо всмятку", type: "snack", batchDays: 1, servings: 1, timeMin: 8, ing: [["egg",1],["bread",30]], steps: ["4–5 мин."], tags: ["детское"] }),
  dish({ id: "k10", name: "Тыквенное пюре", type: "snack", batchDays: 2, servings: 4, timeMin: 30, ing: [["pumpkin",300],["butter",5]], steps: ["Запечь/сварить, пробить. На 1–2 дня."], tags: ["детское","batch"] }),
  dish({ id: "k11", name: "Суп-пюре остаток", type: "snack", batchDays: 1, servings: 1, timeMin: 5, ing: [["potato",50],["carrot",30],["milk",40]], steps: ["Развести густой остаток супа молоком."], tags: ["детское"] }),
  dish({ id: "k12", name: "Апельсин дольками (взрослым+старше; ребёнку — мягко)", type: "snack", batchDays: 1, servings: 2, timeMin: 3, ing: [["orange",150]], steps: ["Плёнки убрать для ребёнка."], tags: [] }),
  dish({ id: "k13", name: "Сырники-остаток холодные/тёплые", type: "snack", batchDays: 1, servings: 1, timeMin: 3, ing: [["tvorog",50]], steps: ["Из запасной партии b07/b13."], tags: ["детское"] }),
  dish({ id: "k14", name: "Куриное пюре/мягкие кусочки", type: "snack", batchDays: 1, servings: 1, timeMin: 5, ing: [["chicken_breast",50],["zucchini",40]], steps: ["Из партии ужина, мелко."], tags: ["детское"] }),
];

const allDishes = [...breakfasts, ...soups, ...mains, ...snacks];
const dishMap = Object.fromEntries(allDishes.map((d) => [d.id, d]));

/** Меню 12 недель: суп на 3 дня, основное на 2 дня, завтраки ротация без соседних повторов */
const DAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];
const menu = [];

for (let w = 0; w < 12; w++) {
  const soup = soups[w * 2];
  const soup2 = soups[w * 2 + 1] || soups[w];
  const mainA = mains[w * 3];
  const mainB = mains[w * 3 + 1];
  const mainC = mains[w * 3 + 2] || mains[(w * 3 + 2) % mains.length];
  // week uses 2 soups (3+4 days) and 3 mains (2+2+3)
  for (let d = 0; d < 7; d++) {
    const bIdx = (w * 7 + d) % breakfasts.length;
    const lunchSoup = d < 3 ? soup : soup2;
    let dinner;
    if (d < 2) dinner = mainA;
    else if (d < 4) dinner = mainB;
    else dinner = mainC;
    const snack = snacks[(w * 7 + d) % snacks.length];
    const snack2 = snacks[(w * 7 + d + 3) % snacks.length];
    menu.push({
      week: w + 1,
      day: d + 1,
      dayName: DAYS[d],
      label: `Неделя ${w + 1}, ${DAYS[d]}`,
      breakfast: breakfasts[bIdx].id,
      lunch: lunchSoup.id,
      dinner: dinner.id,
      snacks: [snack.id, snack2.id],
      cookHint:
        d === 0
          ? "Большая готовка: суп на 3 дня + основное A на 2 дня + крупа/овощи."
          : d === 3
            ? "Второй суп партии + основное B уже с вчера; подготовить основное C."
            : d === 4
              ? "Основное C на 3 дня (Сб–Пн след. или Пт–Вс)."
              : "Разогрев batch; завтрак с нуля 10–20 мин.",
    });
  }
}

// Recalculate costs for all
for (const d of allDishes) {
  d.ingredients = d.ingredients.filter((i) => byId[i.id]);
  d.costBatch = costOf(d.ingredients);
  d.costPerServing = Math.round(d.costBatch / Math.max(1, d.servings));
  d.stores = [...new Set(d.ingredients.map((i) => byId[i.id]?.store).filter(Boolean))];
}

/** Месячный ориентир бюджета */
const budget = {
  cookingTarget: 32000,
  wine: 8000,
  ginMax: 16000,
  tonicLemon: 2500,
  treatsWeekly: 2500,
  treatsMonthly: 10000,
  totalBand: "56–75 тыс. ₽",
};

const payload = { stores: STORES, products, dishes: allDishes, menu, budget, meta: {
  family: "2 взрослых + ребёнок 1.5",
  location: "Богданиха, Ленинский р-н, МО",
  rules: [
    "Субпродукты только печень",
    "Рыба — филе, без костей",
    "Ребёнку: без сахара/мёда/орехов, соль умеренно",
    "Алкоголь и вкусняшки — отдельной строкой",
  ],
}};

fs.writeFileSync(path.join(dataDir, "app-data.json"), JSON.stringify(payload, null, 2), "utf8");
fs.writeFileSync(
  path.join(dataDir, "app-data.js"),
  `window.APP_DATA = ${JSON.stringify(payload)};\n`,
  "utf8"
);

const html = `<!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>Семейное меню — 3 месяца</title>
<style>
:root {
  --bg: #f3efe6;
  --ink: #1c1914;
  --muted: #5c564c;
  --card: #fffdf8;
  --line: #ddd4c4;
  --accent: #2f5d50;
  --accent2: #b85c38;
  --chip: #e7efeB;
  --warn: #8a4b1f;
  --ok: #1f6b4a;
  --shadow: 0 10px 30px rgba(28,25,20,.08);
  --radius: 16px;
  --font: "Segoe UI", "Trebuchet MS", system-ui, sans-serif;
}
* { box-sizing: border-box; }
body {
  margin: 0; font-family: var(--font); color: var(--ink);
  background:
    radial-gradient(1000px 500px at 10% -10%, #e7f0ea 0%, transparent 50%),
    radial-gradient(800px 400px at 100% 0%, #f7e7dc 0%, transparent 45%),
    var(--bg);
  line-height: 1.45;
}
header {
  padding: 28px 20px 10px; max-width: 1100px; margin: 0 auto;
}
header h1 { margin: 0 0 6px; font-size: 1.75rem; letter-spacing: -.02em; }
header p { margin: 0; color: var(--muted); max-width: 60ch; }
.wrap { max-width: 1100px; margin: 0 auto; padding: 12px 20px 60px; }
.tabs { display: flex; flex-wrap: wrap; gap: 8px; margin: 18px 0; }
.tabs button {
  border: 1px solid var(--line); background: var(--card); color: var(--ink);
  padding: 10px 14px; border-radius: 999px; cursor: pointer; font-weight: 600;
}
.tabs button.active { background: var(--accent); color: #fff; border-color: var(--accent); }
.panel { display: none; }
.panel.active { display: block; }
.grid { display: grid; gap: 12px; }
.cards { grid-template-columns: repeat(auto-fill, minmax(260px, 1fr)); }
.card {
  background: var(--card); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 14px 16px; box-shadow: var(--shadow);
}
.card h3 { margin: 0 0 6px; font-size: 1.05rem; }
.meta { color: var(--muted); font-size: .86rem; }
.chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.chip { background: var(--chip); color: var(--accent); font-size: .75rem; padding: 3px 8px; border-radius: 999px; }
.row { display: flex; flex-wrap: wrap; gap: 10px; align-items: end; margin: 12px 0; }
label { display: flex; flex-direction: column; gap: 4px; font-size: .85rem; color: var(--muted); }
select, input, textarea {
  font: inherit; padding: 8px 10px; border-radius: 10px; border: 1px solid var(--line);
  background: #fff; min-width: 140px; color: var(--ink);
}
button.act {
  background: var(--accent2); color: #fff; border: 0; border-radius: 12px;
  padding: 10px 16px; font-weight: 700; cursor: pointer;
}
button.ghost { background: transparent; border: 1px solid var(--line); border-radius: 12px; padding: 8px 12px; cursor: pointer; }
.budget {
  display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 10px; margin: 14px 0 8px;
}
.budget .card { padding: 12px; }
.budget strong { display: block; font-size: 1.2rem; margin-top: 4px; }
.day-meals { display: grid; gap: 8px; margin-top: 8px; }
.meal {
  display: grid; grid-template-columns: 72px 1fr auto; gap: 8px; align-items: center;
  padding: 8px 10px; border-radius: 12px; background: #f7f3eb; cursor: pointer;
}
.meal:hover { background: #efe8da; }
.meal b { font-size: .78rem; color: var(--muted); text-transform: uppercase; letter-spacing: .04em; }
.price { font-weight: 700; color: var(--ok); white-space: nowrap; }
.recipe-layout { display: grid; grid-template-columns: 280px 1fr; gap: 16px; }
@media (max-width: 800px) { .recipe-layout { grid-template-columns: 1fr; } .meal { grid-template-columns: 64px 1fr; } .meal .price { grid-column: 2; } }
.list { max-height: 70vh; overflow: auto; border: 1px solid var(--line); border-radius: var(--radius); background: var(--card); }
.list button {
  display: block; width: 100%; text-align: left; border: 0; border-bottom: 1px solid var(--line);
  background: transparent; padding: 10px 12px; cursor: pointer;
}
.list button.active, .list button:hover { background: var(--chip); }
.ing-table { width: 100%; border-collapse: collapse; font-size: .92rem; }
.ing-table th, .ing-table td { border-bottom: 1px solid var(--line); padding: 8px 6px; text-align: left; }
.steps { padding-left: 18px; }
.steps li { margin: 6px 0; }
.note { background: #fff6e8; border-left: 3px solid var(--warn); padding: 10px 12px; border-radius: 8px; margin: 12px 0; }
.okbox { background: #eaf6f0; border-left: 3px solid var(--ok); padding: 10px 12px; border-radius: 8px; }
.inv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(220px, 1fr)); gap: 8px; }
.inv-item { display: grid; grid-template-columns: 1fr 88px; gap: 6px; align-items: center; background: var(--card); border: 1px solid var(--line); border-radius: 12px; padding: 8px; }
.muted { color: var(--muted); }
.footer-note { margin-top: 24px; font-size: .85rem; color: var(--muted); }
.search { flex: 1; min-width: 200px; }
</style>
</head>
<body>
<header>
  <h1>Семейное меню на 3 месяца</h1>
  <p>Домашняя еда без ВкусВилл · batch 2–7 дней · Ашан + Пятёрочка + Парное мясо (Молоково). Семья из трёх, Богданиха.</p>
</header>
<div class="wrap">
  <div class="budget" id="budgetCards"></div>
  <div class="tabs" id="tabs">
    <button data-tab="menu" class="active">Меню 12 недель</button>
    <button data-tab="recipes">Каталог рецептов</button>
    <button data-tab="inventory">Что есть → что готовить</button>
    <button data-tab="shop">Закупка / прайс</button>
  </div>

  <section class="panel active" id="tab-menu">
    <div class="row">
      <label>Неделя
        <select id="weekSelect"></select>
      </label>
      <label class="search">Поиск по блюдам дня
        <input id="menuSearch" placeholder="например: суп, минтай, сырники" />
      </label>
    </div>
    <div class="grid cards" id="menuGrid"></div>
  </section>

  <section class="panel" id="tab-recipes">
    <div class="row">
      <label>Тип
        <select id="typeFilter">
          <option value="all">Все</option>
          <option value="breakfast">Завтраки</option>
          <option value="soup">Супы</option>
          <option value="main">Основные</option>
          <option value="snack">Перекусы</option>
        </select>
      </label>
      <label class="search">Поиск
        <input id="recipeSearch" placeholder="название или продукт" />
      </label>
    </div>
    <div class="recipe-layout">
      <div class="list" id="recipeList"></div>
      <div class="card" id="recipeView"><p class="muted">Выберите блюдо слева</p></div>
    </div>
  </section>

  <section class="panel" id="tab-inventory">
    <p class="meta">Отметьте продукты и количество (г / мл / шт как в прайсе). Покажем блюда, на которые хватает, и сколько порций по самому узкому ингредиенту.</p>
    <div class="row">
      <button class="act" id="calcInv">Показать блюда</button>
      <button class="ghost" id="clearInv">Сбросить</button>
      <label>Только если хватает на ≥
        <input type="number" id="minServ" value="2" min="1" style="width:80px" /> порций
      </label>
    </div>
    <div class="inv-grid" id="invGrid"></div>
    <div class="grid cards" id="invResults" style="margin-top:16px"></div>
  </section>

  <section class="panel" id="tab-shop">
    <div class="card">
      <h3>Где что брать</h3>
      <ul>
        <li><b>Парное мясо</b> — мясо, птица, печень, филе рыбы; самовывоз Молоково. <a href="https://parnoemjaso.ru/" target="_blank" rel="noopener">parnoemjaso.ru</a></li>
        <li><b>Ашан</b> — крупы, овощи, молочка, яйца, дешёвая курица/фарш, фрукты.</li>
        <li><b>Пятёрочка</b> — раз в неделю вкусняшки (фуэт, сыры, чипсы) + добор.</li>
      </ul>
      <p class="meta">Цены — ориентиры для планирования, сверяйте с полкой/сайтом. Алкоголь в меню готовки не входит.</p>
    </div>
    <div class="row">
      <label>Магазин
        <select id="storeFilter">
          <option value="all">Все</option>
          <option value="parnoe">Парное мясо</option>
          <option value="ashan">Ашан</option>
          <option value="pyat">Пятёрочка</option>
        </select>
      </label>
      <label class="search">Поиск продукта
        <input id="prodSearch" placeholder="гречка, фарш…" />
      </label>
    </div>
    <div class="card" style="overflow:auto">
      <table class="ing-table" id="priceTable"></table>
    </div>
  </section>

  <p class="footer-note">Данные: <code>data/app-data.js</code>. Пересборка: <code>node tools/build.mjs</code>. Это старт: дальше можно уточнять цены по вашим чекам и расширять рецепты.</p>
</div>

<div id="modal" style="display:none; position:fixed; inset:0; background:rgba(0,0,0,.45); padding:20px; z-index:50; overflow:auto">
  <div class="card" style="max-width:720px; margin:40px auto; position:relative">
    <button class="ghost" id="closeModal" style="position:absolute; right:12px; top:12px">Закрыть</button>
    <div id="modalBody"></div>
  </div>
</div>

<script src="data/app-data.js"></script>
<script>
const DATA = window.APP_DATA;
const dishById = Object.fromEntries(DATA.dishes.map(d => [d.id, d]));
const prodById = Object.fromEntries(DATA.products.map(p => [p.id, p]));
const storeName = id => DATA.stores[id]?.name || id;

function rub(n){ return Math.round(n).toLocaleString("ru-RU") + " ₽"; }
function amountLabel(p, amount){
  if (!p) return amount;
  if (p.unit === "pcs") return amount + " шт";
  if (p.unit === "ml") return amount + " мл";
  return amount + " г";
}

document.getElementById("budgetCards").innerHTML = \`
  <div class="card"><span class="meta">Готовка / мес</span><strong>\${rub(DATA.budget.cookingTarget)}</strong></div>
  <div class="card"><span class="meta">Вино</span><strong>\${rub(DATA.budget.wine)}</strong></div>
  <div class="card"><span class="meta">Джин (потолок)</span><strong>\${rub(DATA.budget.ginMax)}</strong></div>
  <div class="card"><span class="meta">Вкусняшки</span><strong>\${rub(DATA.budget.treatsMonthly)}</strong></div>
  <div class="card"><span class="meta">Полный ориентир</span><strong>\${DATA.budget.totalBand}</strong></div>
\`;

document.querySelectorAll(".tabs button").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tabs button").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".panel").forEach(p => p.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById("tab-" + btn.dataset.tab).classList.add("active");
  });
});

const weekSelect = document.getElementById("weekSelect");
for (let w=1; w<=12; w++){
  const o = document.createElement("option");
  o.value = w; o.textContent = "Неделя " + w;
  weekSelect.appendChild(o);
}

function renderMenu(){
  const week = +weekSelect.value;
  const q = (document.getElementById("menuSearch").value || "").trim().toLowerCase();
  const days = DATA.menu.filter(m => m.week === week);
  const grid = document.getElementById("menuGrid");
  grid.innerHTML = "";
  days.forEach(day => {
    const meals = [
      ["Завтрак", day.breakfast],
      ["Обед", day.lunch],
      ["Ужин", day.dinner],
      ["Перекус", day.snacks[0]],
      ["Перекус 2", day.snacks[1]],
    ];
    const blob = meals.map(([_, id]) => dishById[id]?.name || "").join(" ").toLowerCase();
    if (q && !blob.includes(q) && !day.label.toLowerCase().includes(q)) return;
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = \`<h3>\${day.label}</h3><div class="meta">\${day.cookHint}</div><div class="day-meals"></div>\`;
    const box = el.querySelector(".day-meals");
    meals.forEach(([label, id]) => {
      const d = dishById[id];
      if (!d) return;
      const row = document.createElement("div");
      row.className = "meal";
      row.innerHTML = \`<b>\${label}</b><span>\${d.name}</span><span class="price">~\${rub(d.costPerServing)}/порц</span>\`;
      row.onclick = () => openDish(d.id);
      box.appendChild(row);
    });
    const dayCost = meals.reduce((s, [_, id]) => s + (dishById[id]?.costPerServing || 0) * (id.startsWith("k") ? 1 : 2), 0);
    const foot = document.createElement("div");
    foot.className = "meta";
    foot.style.marginTop = "8px";
    foot.textContent = "Ориентир дня на семью (грубо): ~" + rub(dayCost);
    el.appendChild(foot);
    grid.appendChild(el);
  });
}
weekSelect.addEventListener("change", renderMenu);
document.getElementById("menuSearch").addEventListener("input", renderMenu);

function dishHtml(d){
  const stores = d.stores.map(storeName).join(", ");
  const rows = d.ingredients.map(i => {
    const p = prodById[i.id];
    const line = (p?.price || 0) * i.amount;
    return \`<tr><td>\${p?.name || i.id}</td><td>\${amountLabel(p, i.amount)}</td><td>\${storeName(p?.store)}</td><td>\${rub(line)}</td></tr>\`;
  }).join("");
  return \`
    <h2 style="margin:0 0 8px">\${d.name}</h2>
    <div class="chips">
      <span class="chip">\${d.type}</span>
      <span class="chip">batch \${d.batchDays} дн</span>
      <span class="chip">\${d.servings} порц</span>
      <span class="chip">~\${d.timeMin} мин</span>
      <span class="chip">партия \${rub(d.costBatch)}</span>
    </div>
    <p class="meta">Где купить: \${stores || "—"}</p>
    <div class="note"><b>Дочка:</b> \${d.child}</div>
    <h3>Ингредиенты (на партию)</h3>
    <table class="ing-table"><thead><tr><th>Продукт</th><th>Кол-во</th><th>Магазин</th><th>₽</th></tr></thead><tbody>\${rows}</tbody></table>
    <h3>Как готовить</h3>
    <ol class="steps">\${d.steps.map(s => "<li>"+s+"</li>").join("")}</ol>
    <div class="okbox">На 1 порцию ориентир: <b>\${rub(d.costPerServing)}</b>. Партия рассчитана на разогрев \${d.batchDays} дн.</div>
  \`;
}

function openDish(id){
  const d = dishById[id];
  if (!d) return;
  document.getElementById("modalBody").innerHTML = dishHtml(d);
  document.getElementById("modal").style.display = "block";
  // sync recipe tab selection
  selectedRecipe = id;
  renderRecipeList();
  document.getElementById("recipeView").innerHTML = dishHtml(d);
}
document.getElementById("closeModal").onclick = () => document.getElementById("modal").style.display = "none";
document.getElementById("modal").addEventListener("click", e => { if (e.target.id === "modal") e.target.style.display = "none"; });

let selectedRecipe = DATA.dishes[0]?.id;
function renderRecipeList(){
  const type = document.getElementById("typeFilter").value;
  const q = (document.getElementById("recipeSearch").value || "").toLowerCase();
  const list = document.getElementById("recipeList");
  list.innerHTML = "";
  DATA.dishes.filter(d => {
    if (type !== "all" && d.type !== type) return false;
    if (!q) return true;
    const names = d.ingredients.map(i => prodById[i.id]?.name || "").join(" ");
    return (d.name + " " + names).toLowerCase().includes(q);
  }).forEach(d => {
    const b = document.createElement("button");
    b.textContent = d.name + " · " + rub(d.costBatch);
    if (d.id === selectedRecipe) b.classList.add("active");
    b.onclick = () => { selectedRecipe = d.id; document.getElementById("recipeView").innerHTML = dishHtml(d); renderRecipeList(); };
    list.appendChild(b);
  });
}
document.getElementById("typeFilter").addEventListener("change", renderRecipeList);
document.getElementById("recipeSearch").addEventListener("input", renderRecipeList);

function renderInvGrid(){
  const grid = document.getElementById("invGrid");
  grid.innerHTML = "";
  DATA.products.forEach(p => {
    const el = document.createElement("label");
    el.className = "inv-item";
    el.innerHTML = \`<span>\${p.name}<br><span class="meta">\${storeName(p.store)} · \${p.unit}</span></span>\`;
    const input = document.createElement("input");
    input.type = "number"; input.min = "0"; input.placeholder = "0"; input.dataset.pid = p.id;
    el.appendChild(input);
    grid.appendChild(el);
  });
}
function calcInventory(){
  const have = {};
  document.querySelectorAll("#invGrid input").forEach(inp => {
    const v = parseFloat(inp.value);
    if (v > 0) have[inp.dataset.pid] = v;
  });
  const minServ = +document.getElementById("minServ").value || 1;
  const results = [];
  DATA.dishes.forEach(d => {
    if (!d.ingredients.length) return;
    let portions = Infinity;
    let ok = true;
    for (const ing of d.ingredients) {
      const haveAmt = have[ing.id] || 0;
      if (haveAmt <= 0) { ok = false; break; }
      const perServing = ing.amount / d.servings;
      portions = Math.min(portions, haveAmt / perServing);
    }
    portions = Math.floor(portions * 10) / 10;
    if (ok && portions >= minServ) results.push({ d, portions });
  });
  results.sort((a,b) => b.portions - a.portions);
  const box = document.getElementById("invResults");
  box.innerHTML = results.length ? "" : "<div class='card muted'>Пока ни на одно блюдо не хватает. Введите запасы выше.</div>";
  results.slice(0, 40).forEach(({d, portions}) => {
    const el = document.createElement("div");
    el.className = "card";
    el.innerHTML = \`<h3>\${d.name}</h3><div class="meta">Хватит примерно на <b>\${portions}</b> порц. · партия обычно \${d.servings}</div>\`;
    el.onclick = () => openDish(d.id);
    el.style.cursor = "pointer";
    box.appendChild(el);
  });
}
document.getElementById("calcInv").onclick = calcInventory;
document.getElementById("clearInv").onclick = () => { document.querySelectorAll("#invGrid input").forEach(i => i.value=""); document.getElementById("invResults").innerHTML=""; };

function renderPrices(){
  const store = document.getElementById("storeFilter").value;
  const q = (document.getElementById("prodSearch").value || "").toLowerCase();
  const rows = DATA.products.filter(p => (store==="all"||p.store===store) && p.name.toLowerCase().includes(q));
  document.getElementById("priceTable").innerHTML = "<thead><tr><th>Продукт</th><th>Магазин</th><th>Цена</th><th>Ед.</th></tr></thead><tbody>" +
    rows.map(p => \`<tr><td>\${p.name}</td><td>\${storeName(p.store)}</td><td>\${p.price} ₽/\${p.unit==="pcs"?"шт":p.unit}</td><td>\${p.unit}</td></tr>\`).join("") + "</tbody>";
}
document.getElementById("storeFilter").addEventListener("change", renderPrices);
document.getElementById("prodSearch").addEventListener("input", renderPrices);

renderMenu();
renderRecipeList();
if (selectedRecipe) document.getElementById("recipeView").innerHTML = dishHtml(dishById[selectedRecipe]);
renderInvGrid();
renderPrices();
</script>
</body>
</html>
`;

fs.writeFileSync(path.join(root, "index.html"), html, "utf8");

const cookingSample = menu.slice(0, 30).reduce((s, day) => {
  return s + [day.breakfast, day.lunch, day.dinner, ...day.snacks].reduce((a, id) => a + (dishMap[id]?.costPerServing || 0), 0);
}, 0);

console.log("Dishes:", allDishes.length);
console.log("Menu days:", menu.length);
console.log("Products:", products.length);
console.log("Sample 30-day sum of per-serving lines (rough):", Math.round(cookingSample), "₽");
console.log("Wrote data/app-data.js, data/app-data.json, index.html");
