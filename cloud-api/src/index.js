/**
 * Семейное облако + free-tier AI (Gemini и/или Cloudflare Workers AI).
 * Секреты: GEMINI_API_KEY (wrangler secret). Binding AI — Workers AI.
 */

const SUGGEST_LIMIT = 40;
const VISION_LIMIT = 10;

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET,PUT,POST,OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, X-Family-Key",
};

function json(data, status = 200) {
  return Response.json(data, { status, headers: cors });
}

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

async function getQuota(env, family) {
  const key = `ai:quota:${family}:${todayKey()}`;
  const raw = await env.STORE.get(key);
  const q = raw ? JSON.parse(raw) : { suggest: 0, vision: 0 };
  return { key, suggest: q.suggest || 0, vision: q.vision || 0 };
}

async function bumpQuota(env, family, kind) {
  const { key, suggest, vision } = await getQuota(env, family);
  const next = { suggest, vision, [kind]: (kind === "suggest" ? suggest : vision) + 1 };
  await env.STORE.put(key, JSON.stringify(next), { expirationTtl: 172800 });
  return next;
}

function extractJson(text) {
  if (!text) return null;
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fence ? fence[1] : text;
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end < 0) return null;
  try {
    return JSON.parse(raw.slice(start, end + 1));
  } catch {
    return null;
  }
}

async function callGemini(env, { system, user, imageBase64, mimeType }) {
  const key = env.GEMINI_API_KEY;
  if (!key) return null;
  // 2.0/2.5 flash закрыты для новых ключей; 3.x flash часто 503 — берём lite + fallback.
  const models = imageBase64
    ? ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"]
    : ["gemini-3.5-flash-lite", "gemini-3.1-flash-lite", "gemini-flash-lite-latest", "gemini-3.8-flash"];
  const parts = [];
  if (system) parts.push({ text: system });
  if (imageBase64) {
    parts.push({
      inline_data: {
        mime_type: mimeType || "image/jpeg",
        data: imageBase64.replace(/^data:[^;]+;base64,/, ""),
      },
    });
  }
  parts.push({ text: typeof user === "string" ? user : JSON.stringify(user) });
  const payload = JSON.stringify({
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.2, maxOutputTokens: 1024 },
  });
  let lastErr = "Gemini unavailable";
  for (const model of models) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload,
    });
    if (!res.ok) {
      const err = await res.text();
      lastErr = `Gemini ${model} ${res.status}: ${err.slice(0, 160)}`;
      if (res.status === 404 || res.status === 503 || res.status === 429) continue;
      throw new Error(lastErr);
    }
    const data = await res.json();
    return data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("\n") || "";
  }
  throw new Error(lastErr);
}

async function callWorkersAi(env, prompt) {
  if (!env.AI) return null;
  try {
    const r = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: "Отвечай только валидным JSON без markdown." },
        { role: "user", content: prompt },
      ],
      max_tokens: 800,
    });
    return typeof r === "string" ? r : r?.response || JSON.stringify(r);
  } catch {
    return null;
  }
}

function validateSuggest(parsed, shortlist) {
  const allow = new Set((shortlist || []).map((x) => x.id));
  const ranked = [];
  for (const row of parsed?.ranked || []) {
    if (!row?.id || !allow.has(row.id)) continue;
    ranked.push({
      id: row.id,
      score: typeof row.score === "number" ? row.score : 0.5,
      reason: String(row.reason || "").slice(0, 140),
    });
  }
  if (!ranked.length) {
    return {
      ranked: (shortlist || []).slice(0, 5).map((s, i) => ({
        id: s.id,
        score: 1 - i * 0.05,
        reason: s.why || "локальный скорер",
      })),
      note: "AI не вернул валидный список — показан скорер",
      source: "local",
    };
  }
  return {
    ranked,
    avoid: (parsed?.avoid || []).filter((a) => allow.has(a?.id)).map((a) => ({
      id: a.id,
      reason: String(a.reason || "").slice(0, 120),
    })),
    note: String(parsed?.note || "").slice(0, 200),
    source: "ai",
  };
}

function matchProduct(nameGuess, known) {
  const q = String(nameGuess || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .trim();
  if (!q) return null;
  let best = null;
  let bestScore = 0;
  for (const p of known || []) {
    const n = String(p.name || "")
      .toLowerCase()
      .replace(/ё/g, "е");
    if (!n) continue;
    let score = 0;
    if (n === q) score = 1;
    else if (n.includes(q) || q.includes(n)) score = 0.85;
    else {
      const wt = q.split(/\s+/);
      const hit = wt.filter((w) => w.length > 2 && n.includes(w)).length;
      score = hit / Math.max(wt.length, 1) * 0.7;
    }
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }
  return bestScore >= 0.45 ? { ...best, _score: bestScore } : null;
}

async function handleSuggest(request, env, family) {
  const quota = await getQuota(env, family);
  if (quota.suggest >= SUGGEST_LIMIT) {
    return json({ error: "quota", message: "Лимит умных замен на сегодня", quota: { ...quota, suggestLimit: SUGGEST_LIMIT, visionLimit: VISION_LIMIT } }, 429);
  }
  const body = await request.json();
  const shortlist = Array.isArray(body.shortlist) ? body.shortlist.slice(0, 8) : [];
  if (!shortlist.length) return json({ error: "shortlist_empty" }, 400);

  const cacheKey = `ai:cache:suggest:${family}:${body.currentId || ""}:${shortlist.map((s) => s.id).join(",")}`;
  const cached = await env.STORE.get(cacheKey);
  if (cached) {
    return json({ ...JSON.parse(cached), cached: true, quota: { suggest: quota.suggest, vision: quota.vision, suggestLimit: SUGGEST_LIMIT, visionLimit: VISION_LIMIT } });
  }

  const system = `Ты помощник семейной кухни (Богданиха). Язык: русский.
Выбирай ТОЛЬКО id из shortlist. Не выдумывай блюд.
Учитывай: запасы, childRules (орехи/мёд/сахар/рыба без костей), budget.over, loved/disliked.
Ответ строго JSON:
{"ranked":[{"id":"...","score":0.9,"reason":"кратко"}],"avoid":[{"id":"...","reason":"..."}],"note":"одна фраза"}
reason ≤ 120 символов. Не читай нотаций про алкоголь/вкусняшки.`;

  const user = {
    mode: body.mode || "replace",
    currentId: body.currentId,
    meal: body.meal,
    shortlist,
    inventoryTop: (body.inventoryTop || []).slice(0, 25),
    expiringIds: (body.expiringIds || []).slice(0, 20),
    childRules: body.childRules || {},
    budgetPace: body.budgetPace || {},
    loved: (body.loved || []).slice(0, 30),
    disliked: (body.disliked || []).slice(0, 30),
  };

  let text = null;
  let provider = "none";
  try {
    text = await callGemini(env, { system, user: JSON.stringify(user) });
    if (text) provider = "gemini";
  } catch (e) {
    provider = `gemini_err`;
  }
  if (!text) {
    text = await callWorkersAi(env, `${system}\n\n${JSON.stringify(user)}`);
    if (text) provider = "workers_ai";
  }

  let result;
  if (!text) {
    result = validateSuggest(null, shortlist);
    result.note = "AI недоступен (нет ключа/binding) — локальный скорер";
    result.provider = provider;
  } else {
    result = validateSuggest(extractJson(text), shortlist);
    result.provider = provider;
  }

  if (result.source === "ai") {
    await bumpQuota(env, family, "suggest");
    await env.STORE.put(cacheKey, JSON.stringify(result), { expirationTtl: 604800 });
  }
  const q2 = await getQuota(env, family);
  return json({
    ...result,
    quota: { suggest: q2.suggest, vision: q2.vision, suggestLimit: SUGGEST_LIMIT, visionLimit: VISION_LIMIT },
  });
}

async function handleVision(request, env, family) {
  const quota = await getQuota(env, family);
  if (quota.vision >= VISION_LIMIT) {
    return json({ error: "quota", message: "Лимит фото на сегодня", quota: { ...quota, suggestLimit: SUGGEST_LIMIT, visionLimit: VISION_LIMIT } }, 429);
  }
  if (!env.GEMINI_API_KEY) {
    return json({ error: "no_vision", message: "Нужен GEMINI_API_KEY в Worker secrets" }, 501);
  }
  const body = await request.json();
  const image = body.image;
  if (!image || typeof image !== "string") return json({ error: "no_image" }, 400);
  if (image.length > 2_000_000) return json({ error: "image_too_large" }, 413);

  const known = Array.isArray(body.knownProducts) ? body.knownProducts.slice(0, 400) : [];
  const system = `Ты распознаёшь продукты на фото полки/холодильника для семейного приложения.
Верни ТОЛЬКО JSON:
{"items":[{"nameGuess":"...","qty":1,"unit":"pcs|g|kg|ml|l|pack","confidence":0.0,"notes":""}],"unknown":["..."]}
unit только: g,kg,ml,l,pcs,pack. Не выдумывай бренды без этикетки. Если не еда — items:[].`;

  let text;
  try {
    text = await callGemini(env, {
      system,
      user: `Каталог подсказок (имена): ${known
        .slice(0, 120)
        .map((p) => p.name)
        .join(", ")}`,
      imageBase64: image,
      mimeType: body.mimeType || "image/jpeg",
    });
  } catch (e) {
    return json({ error: "gemini", message: String(e.message || e) }, 502);
  }

  const parsed = extractJson(text) || { items: [], unknown: [] };
  const items = [];
  for (const it of parsed.items || []) {
    const hit = matchProduct(it.nameGuess, known);
    const unit = ["g", "kg", "ml", "l", "pcs", "pack"].includes(it.unit) ? it.unit : hit?.unit || "pcs";
    items.push({
      productId: hit?.id || null,
      nameGuess: String(it.nameGuess || hit?.name || "").slice(0, 80),
      qty: Math.max(0, +it.qty || 1),
      unit,
      confidence: Math.min(1, Math.max(0, +(it.confidence ?? hit?._score ?? 0.5))),
      notes: String(it.notes || "").slice(0, 80),
    });
  }

  await bumpQuota(env, family, "vision");
  const q2 = await getQuota(env, family);
  return json({
    items,
    unknown: (parsed.unknown || []).slice(0, 20).map(String),
    provider: "gemini",
    quota: { suggest: q2.suggest, vision: q2.vision, suggestLimit: SUGGEST_LIMIT, visionLimit: VISION_LIMIT },
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const key = (request.headers.get("X-Family-Key") || "bogdaniha").trim() || "bogdaniha";
    const family = `family:${key}`;
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return json({
        ok: true,
        alwaysOn: true,
        needsPC: false,
        ai: {
          gemini: !!env.GEMINI_API_KEY,
          workersAi: !!env.AI,
        },
      });
    }

    if (request.method === "GET" && url.pathname === "/ai/quota") {
      const q = await getQuota(env, family);
      return json({
        suggest: q.suggest,
        vision: q.vision,
        suggestLimit: SUGGEST_LIMIT,
        visionLimit: VISION_LIMIT,
        gemini: !!env.GEMINI_API_KEY,
        workersAi: !!env.AI,
      });
    }

    if (request.method === "POST" && url.pathname === "/ai/suggest") {
      try {
        return await handleSuggest(request, env, family);
      } catch (e) {
        return json({ error: "suggest_failed", message: String(e.message || e) }, 500);
      }
    }

    if (request.method === "POST" && url.pathname === "/ai/vision") {
      try {
        return await handleVision(request, env, family);
      } catch (e) {
        return json({ error: "vision_failed", message: String(e.message || e) }, 500);
      }
    }

    if (request.method === "GET" && url.pathname === "/state") {
      const raw = await env.STORE.get(family);
      const empty = {
        inventory: {},
        events: [],
        plan: null,
        settings: null,
        budget: null,
        weekNum: 1,
        updatedAt: null,
      };
      return json(raw ? { ...empty, ...JSON.parse(raw) } : empty);
    }

    if (request.method === "PUT" && url.pathname === "/state") {
      const body = await request.json();
      const payload = {
        inventory: body.inventory || {},
        events: (body.events || []).slice(-2000),
        plan: body.plan ?? null,
        settings: body.settings ?? null,
        budget: body.budget ?? null,
        weekNum: body.weekNum ?? 1,
        updatedAt: new Date().toISOString(),
      };
      await env.STORE.put(family, JSON.stringify(payload));
      return json({ ok: true, updatedAt: payload.updatedAt });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
