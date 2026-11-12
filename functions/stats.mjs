// Analitika za panel (zaštićeno sa ADMIN_KEY): dnevni brojači poseta i klikova.
import { getStore } from "@netlify/blobs";

const store = (name) => getStore({ name, consistency: "strong" });

const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });

const isAdmin = (req) => {
  const key = Netlify.env.get("ADMIN_KEY");
  if (!key) return false;
  const given = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("key");
  return given === key;
};

// Datum po beogradskom vremenu (YYYY-MM-DD)
const day = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Belgrade" }).format(d);

const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export default async (req) => {
  if (!isAdmin(req)) return json({ ok: false, error: "Neispravan ključ" }, 401);
  const s = store("analitika");
  const { blobs } = await s.list({ prefix: "dan/" });
  const days = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);

  // stari brojač poseta (posete.js) za dane pre nove analitike
  try {
    const old = getStore("posete");
    const { blobs: ob } = await old.list();
    const have = new Set(days.map((d) => d.datum));
    for (const b of ob) {
      const d = await old.get(b.key, { type: "json" });
      if (d && d.datum && !have.has(d.datum)) days.push({ datum: d.datum, ev: { pv: d.broj || 0 }, uq: { pv: d.broj || 0 }, izvori: {}, staro: true });
    }
  } catch {}

  days.sort((a, b) => a.datum.localeCompare(b.datum));
  return json({ ok: true, days });
};

export const config = { path: "/api/stats" };
