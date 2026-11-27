import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const API = "https://semejnoe-menyu-api.jazzy-selenium.workers.dev";
const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const raw = readFileSync(join(root, "data", "app-data.js"), "utf8");
const json = raw.replace(/^window\.APP_DATA\s*=\s*/, "").replace(/;\s*$/, "");
const data = JSON.parse(json);
const menuByKey = new Map(data.menu.map((m) => [`${m.week}:${m.day}`, m]));

const res = await fetch(`${API}/state`, { headers: { "X-Family-Key": "bogdaniha" } });
const st = await res.json();
let fixed = 0;
st.plan = (st.plan || []).map((day) => {
  const src = menuByKey.get(`${day.week || 1}:${day.day}`) || {};
  const next = {
    ...day,
    dayName: src.dayName || day.dayName,
    label: src.label || day.label,
    cookHint: src.cookHint || day.cookHint,
  };
  if (next.label !== day.label || next.dayName !== day.dayName || next.cookHint !== day.cookHint) fixed += 1;
  return next;
});

await fetch(`${API}/state`, {
  method: "PUT",
  headers: { "X-Family-Key": "bogdaniha", "Content-Type": "application/json; charset=utf-8" },
  body: JSON.stringify(st),
});
const check = await (await fetch(`${API}/state`, { headers: { "X-Family-Key": "bogdaniha" } })).json();
const sample = check.plan?.[0];
console.log(
  JSON.stringify(
    {
      fixed,
      sampleLabel: sample?.label,
      sampleHint: sample?.cookHint,
      hex: Buffer.from(sample?.label || "", "utf8").toString("hex"),
    },
    null,
    2
  )
);
