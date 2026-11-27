import dayjs from "https://cdn.jsdelivr.net/npm/dayjs@1.11.13/+esm";

/** Фильтр событий по периоду [from, to] inclusive (ISO dates or dayjs) */
export function filterEvents(events, from, to) {
  const a = dayjs(from).startOf("day");
  const b = dayjs(to).endOf("day");
  return (events || []).filter((e) => {
    const t = dayjs(e.at);
    return t.isAfter(a.subtract(1, "ms")) && t.isBefore(b.add(1, "ms"));
  });
}

/**
 * Популярные товары: из spend (basket lines) и cook (ingredient usage)
 * event types: spend | cook | adjust
 */
export function popularProducts(events, products, limit = 15) {
  const map = new Map();
  for (const e of events) {
    const items = e.items || [];
    for (const it of items) {
      const id = it.id;
      if (!id) continue;
      const cur = map.get(id) || { id, qty: 0, cost: 0, count: 0, name: products[id]?.name || it.name || id };
      cur.qty += it.amount || it.buy || 0;
      cur.cost += it.cost || 0;
      cur.count += 1;
      map.set(id, cur);
    }
  }
  return [...map.values()].sort((x, y) => y.count - x.count || y.cost - x.cost).slice(0, limit);
}

export function spendByCategory(events) {
  const out = { cooking: 0, wine: 0, gin: 0, treats: 0, other: 0 };
  for (const e of events) {
    if (e.type !== "spend") continue;
    const key = out[e.category] !== undefined ? e.category : "other";
    out[key] += e.total || 0;
  }
  return out;
}

export function spendTimeline(events, from, to) {
  const a = dayjs(from).startOf("day");
  const b = dayjs(to).startOf("day");
  const days = [];
  let cur = a;
  while (cur.isBefore(b) || cur.isSame(b, "day")) {
    days.push({ date: cur.format("YYYY-MM-DD"), label: cur.format("DD.MM"), total: 0 });
    cur = cur.add(1, "day");
  }
  const idx = Object.fromEntries(days.map((d, i) => [d.date, i]));
  for (const e of events) {
    if (e.type !== "spend") continue;
    const key = dayjs(e.at).format("YYYY-MM-DD");
    if (idx[key] === undefined) continue;
    days[idx[key]].total += e.total || 0;
  }
  return days;
}

export function totalSpend(events) {
  return events.filter((e) => e.type === "spend").reduce((s, e) => s + (e.total || 0), 0);
}

export { dayjs };
