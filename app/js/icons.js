/**
 * Иконки: Phosphor Duotone через Iconify.
 * Двухтон под бренд (ink + saffron), без системных emoji.
 */
const I = (name) =>
  `<iconify-icon class="sk-ico" icon="ph:${name}-duotone" width="1.2em" height="1.2em" aria-hidden="true"></iconify-icon>`;

const BY_ID = {
  potato: "circles-three",
  cabbage: "leaf",
  carrot: "carrot",
  onion: "circles-three-plus",
  beet: "circle-half",
  tomato: "seal",
  cucumber: "plant",
  pepper: "pepper",
  zucchini: "plant",
  pumpkin: "orange",
  broccoli: "tree",
  apple: "apple-logo",
  banana: "orange",
  pear: "orange",
  orange: "orange",
  lemon: "orange",
  berries: "circles-four",
  buckwheat: "grains",
  rice: "bowl-steam",
  oats: "bowl-food",
  pasta: "spiral",
  bread: "bread",
  flour: "cooking-pot",
  milk: "pint-glass",
  kefir: "pint-glass",
  sourcream: "drop-half",
  tvorog: "cheese",
  yogurt: "pint-glass",
  cheese: "cheese",
  egg: "egg",
  butter: "drop",
  oil: "drop-half-bottom",
  chicken_cheap: "bird",
  chicken_fillet: "bird",
  chicken_thigh: "bird",
  chicken_liver: "heart",
  turkey_fillet: "bird",
  mince_cheap: "hamburger",
  mince_beef: "hamburger",
  mince_chicken: "hamburger",
  pork_shoulder: "knife",
  beef_stew: "cooking-pot",
  pollock: "fish",
  sole: "fish",
  tilapia: "fish",
  salmon_pink: "fish-simple",
  herring_fillet: "fish-simple",
  mushroom: "hexagon",
};

const BY_CAT = {
  овощи: "carrot",
  фрукты: "apple-logo",
  крупы: "grains",
  бобовые: "circles-three",
  молочка: "pint-glass",
  яйца: "egg",
  птица: "bird",
  мясо: "knife",
  фарш: "hamburger",
  рыба: "fish",
  субпродукты: "heart",
  выпечка: "bread",
  зелень: "leaf",
  специи: "flower-lotus",
  соусы: "drop-half",
  сладкое: "cookie",
  масло: "drop",
  бакалея: "basket",
  сухофрукты: "orange",
  вкусняшки: "cookie",
  алкоголь: "wine",
  прочее: "package",
  своё: "tag",
};

export function productIcon(product) {
  const name = (product && (BY_ID[product.id] || BY_CAT[product.category])) || "package";
  return I(name);
}

export function dishIcon(dish) {
  if (!dish) return I("fork-knife");
  if (dish.type === "breakfast") return I("sun-horizon");
  if (dish.type === "soup") return I("bowl-steam");
  if (dish.type === "dessert") return I("cake");
  if (dish.type === "snack") return I("cookie");
  if (dish.protein === "рыба") return I("fish");
  if (dish.protein === "птица") return I("bird");
  if (dish.protein === "мясо" || dish.protein === "фарш") return I("knife");
  if (dish.protein === "без мяса") return I("leaf");
  return I("fork-knife");
}
