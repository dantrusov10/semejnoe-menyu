/**
 * Иконки: Lucide (outline) через Iconify.
 * Реальные food-glyphs вместо абстрактных duotone-фигур.
 */
const I = (name) =>
  `<iconify-icon class="sk-ico" icon="lucide:${name}" width="1.15em" height="1.15em" stroke-width="1.75" aria-hidden="true"></iconify-icon>`;

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

export function productIcon(product) {
  const name = (product && (BY_ID[product.id] || BY_CAT[product.category])) || "package";
  return I(name);
}

export function dishIcon(dish) {
  if (!dish) return I("utensils-crossed");
  if (dish.type === "breakfast") return I("egg-fried");
  if (dish.type === "soup") return I("soup");
  if (dish.type === "dessert") return I("cake-slice");
  if (dish.type === "snack") return I("cookie");
  if (dish.protein === "рыба") return I("fish");
  if (dish.protein === "птица") return I("drumstick");
  if (dish.protein === "мясо" || dish.protein === "фарш") return I("beef");
  if (dish.protein === "без мяса") return I("salad");
  return I("utensils-crossed");
}
