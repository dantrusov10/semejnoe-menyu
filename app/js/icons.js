/** Простые визуальные маркеры продуктов (реестр emoji/символов). */
const BY_ID = {
  potato: "🥔", cabbage: "🥬", carrot: "🥕", onion: "🧅", beet: "🟣", tomato: "🍅",
  cucumber: "🥒", pepper: "🫑", zucchini: "🟢", pumpkin: "🎃", broccoli: "🥦",
  apple: "🍎", banana: "🍌", pear: "🍐", orange: "🍊", lemon: "🍋", berries: "🫐",
  buckwheat: "🌾", rice: "🍚", oats: "🥣", pasta: "🍝", bread: "🍞", flour: "🥖",
  milk: "🥛", kefir: "🥛", sourcream: "🤍", tvorog: "🧀", yogurt: "🥛", cheese: "🧀",
  egg: "🥚", butter: "🧈", oil: "🫒",
  chicken_cheap: "🍗", chicken_fillet: "🍗", chicken_thigh: "🍗", chicken_liver: "🫀",
  turkey_fillet: "🦃", mince_cheap: "🥩", mince_beef: "🥩", mince_chicken: "🍗",
  pork_shoulder: "🥩", beef_stew: "🥩", pollock: "🐟", sole: "🐟", tilapia: "🐟",
  salmon_pink: "🐟", herring_fillet: "🐟", mushroom: "🍄",
};

const BY_CAT = {
  овощи: "🥕", фрукты: "🍎", крупы: "🌾", бобовые: "🫘", молочка: "🥛", яйца: "🥚",
  птица: "🍗", мясо: "🥩", фарш: "🥩", рыба: "🐟", субпродукты: "🫀", выпечка: "🍞",
  зелень: "🌿", специи: "🧂", соусы: "🫙", сладкое: "🍬", масло: "🫒", бакалея: "🛒",
  сухофрукты: "🍇", прочее: "📦",
};

export function productIcon(product) {
  if (!product) return "📦";
  return BY_ID[product.id] || BY_CAT[product.category] || "📦";
}

export function dishIcon(dish) {
  if (!dish) return "🍽️";
  if (dish.type === "breakfast") return "🌅";
  if (dish.type === "soup") return "🍲";
  if (dish.type === "dessert") return "🍰";
  if (dish.type === "snack") return "🍪";
  if (dish.protein === "рыба") return "🐟";
  if (dish.protein === "птица") return "🍗";
  if (dish.protein === "мясо" || dish.protein === "фарш") return "🥩";
  if (dish.protein === "без мяса") return "🥗";
  return "🍽️";
}
