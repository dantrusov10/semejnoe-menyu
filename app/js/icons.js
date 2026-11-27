/**
 * Иконки: Iconito Food (цветные food SVG, MIT) через Iconify.
 * 120 глифов специально под продукты и блюда.
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

export function productIcon(product) {
  const name = (product && (BY_ID[product.id] || BY_CAT[product.category])) || "rice-bowl";
  return I(name);
}

export function dishIcon(dish) {
  if (!dish) return I("pasta-dish");
  if (dish.type === "breakfast") return I("fried-egg-dish");
  if (dish.type === "soup") return I("soup");
  if (dish.type === "dessert") return I("cake");
  if (dish.type === "snack") return I("sandwich");
  if (dish.protein === "рыба") return I("salmon");
  if (dish.protein === "птица") return I("chicken");
  if (dish.protein === "мясо") return I("stew");
  if (dish.protein === "фарш") return I("meatball");
  if (dish.protein === "без мяса") return I("salad");
  return I("pasta-dish");
}
