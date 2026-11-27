/**
 * Иконки: Lucide + цвет по продукту/категории.
 */
const I = (name, color) =>
  `<iconify-icon class="sk-ico" icon="lucide:${name}" width="1.15em" height="1.15em" stroke-width="1.85" style="color:${color}" aria-hidden="true"></iconify-icon>`;

const BY_ID = {
  potato: "cuboid",
  cabbage: "leafy-green",
  carrot: "carrot",
  onion: "sprout",
  beet: "cherry",
  tomato: "cherry",
  cucumber: "salad",
  pepper: "flame",
  zucchini: "leafy-green",
  pumpkin: "citrus",
  broccoli: "broccoli",
  apple: "apple",
  banana: "banana",
  pear: "apple",
  orange: "citrus",
  lemon: "citrus",
  berries: "grape",
  buckwheat: "wheat",
  rice: "soup",
  oats: "wheat",
  pasta: "utensils",
  bread: "sandwich",
  flour: "wheat",
  milk: "milk",
  kefir: "milk",
  sourcream: "droplet",
  tvorog: "milk",
  yogurt: "milk",
  cheese: "pizza",
  egg: "egg",
  butter: "droplet",
  oil: "droplets",
  chicken_cheap: "drumstick",
  chicken_fillet: "drumstick",
  chicken_thigh: "drumstick",
  chicken_liver: "heart",
  turkey_fillet: "drumstick",
  mince_cheap: "beef",
  mince_beef: "beef",
  mince_chicken: "drumstick",
  pork_shoulder: "ham",
  beef_stew: "beef",
  pollock: "fish",
  sole: "fish",
  tilapia: "fish",
  salmon_pink: "fish-symbol",
  herring_fillet: "fish",
  mushroom: "shell",
};

const BY_CAT = {
  овощи: "carrot",
  фрукты: "apple",
  крупы: "wheat",
  бобовые: "bean",
  молочка: "milk",
  яйца: "egg",
  птица: "drumstick",
  мясо: "beef",
  фарш: "beef",
  рыба: "fish",
  субпродукты: "heart",
  выпечка: "croissant",
  зелень: "leafy-green",
  специи: "flame",
  соусы: "droplet",
  сладкое: "cookie",
  масло: "droplet",
  бакалея: "shopping-basket",
  сухофрукты: "grape",
  вкусняшки: "candy",
  алкоголь: "wine",
  прочее: "package",
  своё: "tag",
};

/** Насыщенные цвета «как у еды», не серые outline. */
const COLOR_ID = {
  potato: "#c4a35a",
  cabbage: "#3f8f4a",
  carrot: "#e67a22",
  onion: "#c9a66b",
  beet: "#a12d5a",
  tomato: "#d6453d",
  cucumber: "#3a9b5c",
  pepper: "#d94b3a",
  zucchini: "#5aa86a",
  pumpkin: "#e08a22",
  broccoli: "#2f8a4e",
  apple: "#c0392b",
  banana: "#e6b422",
  pear: "#7aa832",
  orange: "#e07a1a",
  lemon: "#d4b017",
  berries: "#7b2d8e",
  buckwheat: "#8b6914",
  rice: "#a89b78",
  oats: "#b8954a",
  pasta: "#c9a227",
  bread: "#c48a3a",
  flour: "#b8a878",
  milk: "#4a90c8",
  kefir: "#5a9ec9",
  sourcream: "#6aa8c8",
  tvorog: "#7aafc4",
  yogurt: "#5b9ec7",
  cheese: "#e0a825",
  egg: "#d4a017",
  butter: "#e8c547",
  oil: "#c9a227",
  chicken_cheap: "#d4893a",
  chicken_fillet: "#d4893a",
  chicken_thigh: "#c97830",
  chicken_liver: "#a84545",
  turkey_fillet: "#c97830",
  mince_cheap: "#a84a3a",
  mince_beef: "#8f3a2e",
  mince_chicken: "#d4893a",
  pork_shoulder: "#c46a6a",
  beef_stew: "#8f3a2e",
  pollock: "#3a7eb8",
  sole: "#4a8ec4",
  tilapia: "#3a7eb8",
  salmon_pink: "#e07a5a",
  herring_fillet: "#4a7ea8",
  mushroom: "#8b7355",
};

const COLOR_CAT = {
  овощи: "#3f9a4e",
  фрукты: "#d14b3a",
  крупы: "#b8954a",
  бобовые: "#7a9b3a",
  молочка: "#4a90c8",
  яйца: "#d4a017",
  птица: "#d4893a",
  мясо: "#8f3a2e",
  фарш: "#a84a3a",
  рыба: "#3a7eb8",
  субпродукты: "#a84545",
  выпечка: "#c48a3a",
  зелень: "#2f8a4e",
  специи: "#c45a22",
  соусы: "#b85a3a",
  сладкое: "#c45a8a",
  масло: "#e0a825",
  бакалея: "#6b7c8f",
  сухофрукты: "#a85a2a",
  вкусняшки: "#c45a8a",
  алкоголь: "#7a3a5a",
  прочее: "#6b7c8f",
  своё: "#5c6673",
};

const COLOR_DISH = {
  breakfast: "#d4a017",
  soup: "#c8892a",
  dessert: "#c45a8a",
  snack: "#b8954a",
  рыба: "#3a7eb8",
  птица: "#d4893a",
  мясо: "#8f3a2e",
  фарш: "#a84a3a",
  "без мяса": "#3f9a4e",
  default: "#1f3a56",
};

function resolveColor(product) {
  if (!product) return COLOR_CAT.прочее;
  return COLOR_ID[product.id] || COLOR_CAT[product.category] || COLOR_CAT.прочее;
}

export function productIcon(product) {
  const name = (product && (BY_ID[product.id] || BY_CAT[product.category])) || "package";
  return I(name, resolveColor(product));
}

export function dishIcon(dish) {
  if (!dish) return I("utensils-crossed", COLOR_DISH.default);
  if (dish.type === "breakfast") return I("egg-fried", COLOR_DISH.breakfast);
  if (dish.type === "soup") return I("soup", COLOR_DISH.soup);
  if (dish.type === "dessert") return I("cake-slice", COLOR_DISH.dessert);
  if (dish.type === "snack") return I("cookie", COLOR_DISH.snack);
  if (dish.protein === "рыба") return I("fish", COLOR_DISH.рыба);
  if (dish.protein === "птица") return I("drumstick", COLOR_DISH.птица);
  if (dish.protein === "мясо" || dish.protein === "фарш") return I("beef", COLOR_DISH[dish.protein] || COLOR_DISH.мясо);
  if (dish.protein === "без мяса") return I("salad", COLOR_DISH["без мяса"]);
  return I("utensils-crossed", COLOR_DISH.default);
}
