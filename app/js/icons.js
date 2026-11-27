/**
 * Иконки: Iconito Food (цветные food SVG, MIT) через Iconify.
 * Блюда — по названию/тегам/ингредиентам (белок раньше гарнира).
 */
const I = (name) =>
  `<iconify-icon class="sk-ico" icon="iconito:${name}" width="1.35em" height="1.35em" aria-hidden="true"></iconify-icon>`;

const BY_ID = {
  potato: "potato",
  cabbage: "lettuce",
  carrot: "carrot",
  onion: "onion",
  beet: "tomato",
  tomato: "tomato",
  cucumber: "cucumber",
  pepper: "bell-pepper",
  zucchini: "zucchini",
  pumpkin: "orange",
  broccoli: "broccoli",
  apple: "apple",
  banana: "banana",
  pear: "apple",
  orange: "orange",
  lemon: "lemon",
  berries: "blueberry",
  buckwheat: "quinoa",
  rice: "rice",
  oats: "oats",
  pasta: "pasta",
  bread: "bread",
  flour: "flour",
  milk: "milk",
  kefir: "yogurt",
  sourcream: "cream",
  tvorog: "cheese",
  yogurt: "yogurt",
  cheese: "cheese",
  egg: "egg",
  butter: "butter",
  oil: "olive-oil",
  chicken_cheap: "chicken",
  chicken_fillet: "chicken",
  chicken_thigh: "chicken-wing",
  chicken_liver: "chicken",
  turkey_fillet: "turkey",
  mince_cheap: "meatball",
  mince_beef: "beef",
  mince_chicken: "chicken",
  pork_shoulder: "pork",
  beef_stew: "stew",
  pollock: "fish",
  sole: "fish",
  tilapia: "fish",
  salmon_pink: "salmon",
  herring_fillet: "fish",
  mushroom: "mushroom",
};

const BY_CAT = {
  овощи: "carrot",
  фрукты: "apple",
  крупы: "rice",
  бобовые: "bean",
  молочка: "milk",
  яйца: "egg",
  птица: "chicken",
  мясо: "beef",
  фарш: "meatball",
  рыба: "fish",
  субпродукты: "chicken",
  выпечка: "croissant",
  зелень: "spinach",
  специи: "garlic",
  соусы: "mayonnaise",
  сладкое: "cookie",
  масло: "butter",
  бакалея: "flour",
  сухофрукты: "grape",
  вкусняшки: "candy",
  алкоголь: "wine",
  прочее: "rice-bowl",
  своё: "rice-bowl",
};

/** Порядок: белок/сигнатура → супы/завтраки → гарнир как блюдо → прочее. */
const DISH_RULES = [
  // десерты
  [/шарлотк|яблок.*(кекс|выпеч|запеч)|запеч[её]нн?[а-яё]* яблок/i, "apple"],
  [/морковн.*(кекс|торт|пирог)/i, "carrot"],
  [/брауни|шоколад/i, "chocolate-cake"],
  [/чизкейк|творожн.*запеканк.*какао/i, "cheesecake"],
  [/кекс|капкейк/i, "cupcake"],
  [/печенье/i, "cookie"],
  [/пончик/i, "donut"],
  [/мороженое/i, "ice-cream"],
  [/вафл/i, "waffle"],
  [/блинчик|блин|оладь|овсяноблин/i, "pancake"],

  // супы
  [/уха|рыбн[а-яё]* суп|суп.*(?:горбуш|минтай|лосос|рыб)/i, "fish"],
  [/грибн[а-яё]* суп|суп.*шампинь/i, "mushroom"],
  [/суп.*брокколи|брокколи.*суп/i, "broccoli"],
  [/горохов|чечевиц|нутов|нут\b|фасол|минестрон|свекольник|клёцк|клецк/i, "lentil"],
  [/фрикаделк|тефтел.*суп|суп.*тефтел/i, "meatball"],
  [/куриный суп|суп курин|суп.*куриц|куриц.*суп|суп.*индейк|суп.*лапш/i, "chicken"],
  [/солянка|харчо|рассольник|жаркое/i, "stew"],
  [/борщ|щи|капустняк|крем-?суп|суп-?пюре|тыквенн[а-яё]* суп|\bсуп\b/i, "soup"],

  // белок раньше гарниров
  [/котлет|тефтел|фрикадел|фарш|подлив[а-яё]* из фарш/i, "meatball"],
  [/фаршированн[а-яё]* перец|перец.*фарш/i, "bell-pepper"],
  [/голубц/i, "lettuce"],
  [/крылышк|бёдра|бедр/i, "chicken-wing"],
  [/куриц|цыпл|чахохбил|терияки|су-вид/i, "chicken"],
  [/индейк|утк/i, "turkey"],
  [/печен/i, "chicken"],
  [/свинин|рёбр|шашлык/i, "pork"],
  [/говяд|телятин|бефстроган|гуляш|стейк|кролик/i, "beef"],
  [/лосос|семг|горбуш|форел/i, "salmon"],
  [/минтай|тилап|треск|тун[еац]|морской язык|рыб/i, "fish"],
  [/кревет/i, "shrimp"],
  [/бекон|грудинк/i, "bacon"],
  [/сосис|сардел|колбас/i, "sausage"],
  [/рагу|туш[её]н/i, "stew"],

  // named dishes
  [/пицц/i, "pizza"],
  [/лазань/i, "lasagna"],
  [/суши|роллы/i, "sushi"],
  [/бургер|гамбург/i, "burger"],
  [/тако|буррито|энчилада/i, "taco"],
  [/рамен|лапш|удон|пад.?тай|нокл/i, "ramen"],
  [/плов/i, "rice-bowl"],
  [/спагет|пенне|фетучин|паст[аыу]\b|болоньез|макарон[а-яё]* (?:подлив|болон)/i, "pasta-dish"],
  [/пельмен|вареник(?!.*ленив)/i, "dumpling"],
  [/карри/i, "curry"],
  [/тофу/i, "tofu"],
  [/салат/i, "salad"],
  [/смузи/i, "smoothie"],

  // завтраки / каши как блюдо
  [/овсян/i, "oats"],
  [/гречневая каша|каша.*гречк|гречк[а-яё]* каш/i, "quinoa"],
  [/рисов[а-яё]* (?:каш|молоч)|молочн[а-яё]* рис/i, "rice"],
  [/пш[её]н|манк|манн|кукурузн[а-яё]* каш/i, "oats"],
  [/\bкаша\b|\bкаш[еи]\b/i, "oats"],
  [/сырник|ленив[а-яё]* вареник/i, "cheese"],
  [/творог/i, "yogurt"],
  [/омлет|яичниц|яйц/i, "fried-egg-dish"],
  [/драник|картофел[а-яё]* (?:запекан|оладь|суп)|айдахо|пюре|тыквенн|рататуй/i, "potato"],
  [/тост|бутерброд|хлебц|хлеб с /i, "sandwich"],
  [/багет/i, "baguette"],
  [/круассан/i, "croissant"],
  [/запеканк/i, "pie"],
  [/пирог/i, "pie"],

  // перекусы / низкий приоритет
  [/какао|кофе/i, "coffee"],
  [/йогурт/i, "yogurt"],
  [/кефир/i, "yogurt"],
  [/банан/i, "banana"],
  [/ягод|черник|клубник|малин|чернослив/i, "blueberry"],
  [/апельсин/i, "orange"],
  [/лимон/i, "lemon"],
  [/яблок/i, "apple"],
  [/груш/i, "apple"],
  [/морков/i, "carrot"],
  [/огурец|овощн[а-яё]* палоч/i, "cucumber"],
  [/кабачк|цукини/i, "zucchini"],
  [/брокколи/i, "broccoli"],
  [/гриб|шампинь/i, "mushroom"],
  [/картоф/i, "potato"],
  [/гречк|гречне/i, "quinoa"],
  [/макарон/i, "pasta-dish"],
  [/\bрис\b|рисом|булгур|кускус|перловк/i, "rice"],
];

const ING_ICON = {
  chicken_cheap: "chicken",
  chicken_fillet: "chicken",
  chicken_thigh: "chicken-wing",
  chicken_liver: "chicken",
  turkey_fillet: "turkey",
  mince_cheap: "meatball",
  mince_beef: "meatball",
  mince_chicken: "chicken",
  pork_shoulder: "pork",
  beef_stew: "beef",
  pollock: "fish",
  sole: "fish",
  tilapia: "fish",
  salmon_pink: "salmon",
  herring_fillet: "fish",
  potato: "potato",
  rice: "rice",
  pasta: "pasta-dish",
  buckwheat: "quinoa",
  oats: "oats",
  egg: "egg",
  tvorog: "cheese",
  cheese: "cheese",
  milk: "milk",
  yogurt: "yogurt",
  mushroom: "mushroom",
  broccoli: "broccoli",
  carrot: "carrot",
  tomato: "tomato",
  apple: "apple",
  banana: "banana",
  pepper: "bell-pepper",
  cabbage: "lettuce",
  zucchini: "zucchini",
};

function matchRules(text) {
  if (!text) return null;
  for (const [re, icon] of DISH_RULES) {
    if (re.test(text)) return icon;
  }
  return null;
}

function matchIngredients(dish) {
  const ings = dish?.ingredients;
  if (!Array.isArray(ings) || !ings.length) return null;
  const priority = [
    "mince_beef", "mince_cheap", "mince_chicken",
    "chicken_fillet", "chicken_thigh", "chicken_cheap", "chicken_liver", "turkey_fillet",
    "pork_shoulder", "beef_stew",
    "salmon_pink", "pollock", "sole", "tilapia", "herring_fillet",
    "egg", "tvorog", "cheese",
  ];
  const ids = ings.map((ing) => ing.id || ing.productId).filter(Boolean);
  for (const id of priority) {
    if (ids.includes(id) && ING_ICON[id]) return ING_ICON[id];
  }
  for (const id of ids) {
    if (ING_ICON[id]) return ING_ICON[id];
  }
  return null;
}

function fallbackType(dish) {
  if (dish.type === "breakfast") return "fried-egg-dish";
  if (dish.type === "soup") return "soup";
  if (dish.type === "dessert") return "cake";
  if (dish.type === "snack") return "apple";
  if (dish.protein === "рыба") return "fish";
  if (dish.protein === "птица") return "chicken";
  if (dish.protein === "мясо") return "beef";
  if (dish.protein === "фарш") return "meatball";
  if (dish.protein === "печень") return "chicken";
  if (dish.protein === "без мяса") return "salad";
  if (dish.protein === "другое") return "stew";
  return "stew";
}

export function productIcon(product) {
  const name = (product && (BY_ID[product.id] || BY_CAT[product.category])) || "rice-bowl";
  return I(name);
}

export function dishIcon(dish) {
  if (!dish) return I("pasta-dish");
  const hay = [dish.name, dish.category, ...(dish.tags || [])].filter(Boolean).join(" ");
  const icon = matchRules(hay) || matchIngredients(dish) || fallbackType(dish);
  return I(icon);
}
