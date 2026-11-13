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
  const s = store("analitika-v3"); // reset analitike 13. 11. 2026 (drugi put)
  const { blobs } = await s.list({ prefix: "dan/" });
  const days = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);

  days.sort((a, b) => a.datum.localeCompare(b.datum));
  return json({ ok: true, days });
};

export const config = { path: "/api/stats" };
