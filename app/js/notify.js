/** Локальные напоминания PWA (без серверного push) */

const STORE_KEY = "sk_reminders";

export function reminderSettings(settings) {
  return {
    enabled: settings?.reminders?.enabled !== false,
    hour: settings?.reminders?.hour ?? 20,
    minute: settings?.reminders?.minute ?? 0,
  };
}

export async function ensureNotifyPermission() {
  if (!("Notification" in window)) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  if (Notification.permission === "denied") return "denied";
  try {
    return await Notification.requestPermission();
  } catch {
    return "denied";
  }
}

export async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return null;
  try {
    const reg = await navigator.serviceWorker.register("./sw.js", { scope: "./" });
    return reg;
  } catch {
    return null;
  }
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

function loadLocal() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY) || "{}");
  } catch {
    return {};
  }
}

function saveLocal(data) {
  localStorage.setItem(STORE_KEY, JSON.stringify(data));
}

/** Показать вечернее напоминание, если ещё не показывали сегодня */
export async function maybeEveningReminder(settings) {
  const cfg = reminderSettings(settings);
  if (!cfg.enabled) return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;
  const now = new Date();
  if (now.getHours() < cfg.hour) return false;
  if (now.getHours() === cfg.hour && now.getMinutes() < cfg.minute) return false;
  const store = loadLocal();
  if (store.lastEvening === todayKey()) return false;
  const title = "Семейная кухня";
  const body = "Не забудь обновить данные: запасы, покупки и что приготовили.";
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg?.showNotification) {
      await reg.showNotification(title, {
        body,
        tag: "sk-evening",
        renotify: true,
        data: { screen: "today" },
      });
    } else {
      new Notification(title, { body, tag: "sk-evening" });
    }
    store.lastEvening = todayKey();
    saveLocal(store);
    return true;
  } catch {
    return false;
  }
}

export async function initReminders(settings) {
  await registerServiceWorker();
  const cfg = reminderSettings(settings);
  if (!cfg.enabled) return;
  if (Notification.permission === "default") {
    // не спамим запросом — кнопка на экране Облако
    return;
  }
  await maybeEveningReminder(settings);
  setInterval(() => maybeEveningReminder(settings), 15 * 60 * 1000);
}
