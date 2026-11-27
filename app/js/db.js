/** IndexedDB: семейное состояние (план, запасы, бюджет, настройки). */
const DB_NAME = "semejnoe-menyu";
const DB_VER = 1;
const STORE = "kv";

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VER);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbGet(key, fallback = null) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(key);
    req.onsuccess = () => resolve(req.result === undefined ? fallback : req.result);
    req.onerror = () => reject(req.error);
  });
}

export async function dbSet(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function dbExportAll() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAllKeys();
    req.onsuccess = async () => {
      const keys = req.result;
      const out = {};
      for (const k of keys) out[k] = await dbGet(k);
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

export async function dbImportAll(obj) {
  for (const [k, v] of Object.entries(obj || {})) await dbSet(k, v);
}

export function defaultSettings() {
  return {
    profile: "kitchen", // kitchen | command
    cookingBudget: 32000,
    alcoholBudget: 24000, // вино+джин вместе
    wineBudget: 8000, // legacy
    ginBudget: 16000, // legacy
    treatsBudget: 10000,
    sweetBudget: 4000,
    treatsWeekly: 2500,
    childRules: {
      noSugar: true,
      noHoney: true,
      noNuts: true,
      mildSalt: true,
      mildSpice: true,
      fishBonelessOnly: true,
    },
    proteinCaps: { chicken: 4, pork: 3, beef: 2, fish: 2, liver: 1 },
    disliked: [],
    loved: [],
    bannedUntil: {},
    shoppingList: [],
    treats: [],
    mealStock: [],
    customProducts: [],
    customDishes: [],
    productMeta: {},
    invZones: {},
    basketPick: { days: [0, 1, 2, 3, 4, 5, 6], meals: { breakfast: true, lunch: true, dinner: true } },
    period: { days: 7, adults: 2, childPortions: 1, childAge: 1.5, mode: "recipes", budgetCap: 0 },
    reminders: { enabled: true, hour: 20, minute: 0 },
    shopTemplatesUsed: [],
  };
}

export function defaultBudgetLedger() {
  return {
    month: new Date().toISOString().slice(0, 7),
    cookingSpent: 0,
    alcoholSpent: 0,
    wineSpent: 0, // legacy
    ginSpent: 0, // legacy
    treatsSpent: 0,
    sweetSpent: 0,
  };
}
