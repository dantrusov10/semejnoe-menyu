/**
 * Семейное облако остатков — Cloudflare Worker + KV.
 * Работает 24/7 в облаке Cloudflare. Домашний ПК не нужен.
 */
export default {
  async fetch(request, env) {
    const cors = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET,PUT,OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, X-Family-Key",
    };
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });

    const key = (request.headers.get("X-Family-Key") || "bogdaniha").trim() || "bogdaniha";
    const family = `family:${key}`;
    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ ok: true, alwaysOn: true, needsPC: false }, { headers: cors });
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
      return Response.json(raw ? { ...empty, ...JSON.parse(raw) } : empty, { headers: cors });
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
      return Response.json({ ok: true, updatedAt: payload.updatedAt }, { headers: cors });
    }

    return new Response("Not found", { status: 404, headers: cors });
  },
};
