// Beleži posete i klikove sa sajta: pv (poseta), call, wa, form_start, cta.
// Brojači se čuvaju po danu u storu "analitika".
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

const EVENTS = new Set(["pv", "call", "wa", "form_start", "cta"]);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (BOT.test(req.headers.get("user-agent") || "")) return json({ ok: true, bot: true });

  let d;
  try { d = JSON.parse(await req.text()); } catch { return json({ ok: false }, 400); }
  const e = clean(d.e, 20);
  if (!EVENTS.has(e)) return json({ ok: false }, 400);

  const vid = clean(d.v, 40).replace(/[^a-z0-9]/gi, "") || "anon";
  const src = clean(d.src, 40).toLowerCase() || "direktno";
  const cmp = clean(d.cmp, 60);
  const today = day();
  const s = store("analitika");

  // jedinstveni posetilac / jedinstven događaj po danu
  const seenKey = `seen/${today}/${e}/${vid}`;
  const first = !(await s.get(seenKey));
  if (first) await s.set(seenKey, "1");

  const key = `dan/${today}`;
  const cur = (await s.get(key, { type: "json" })) || { datum: today, ev: {}, uq: {}, izvori: {} };
  cur.ev[e] = (cur.ev[e] || 0) + 1;
  if (first) cur.uq[e] = (cur.uq[e] || 0) + 1;
  const sk = cmp ? `${src} · ${cmp}` : src;
  const iz = (cur.izvori[sk] ||= { ev: {}, uq: {} });
  iz.ev[e] = (iz.ev[e] || 0) + 1;
  if (first) iz.uq[e] = (iz.uq[e] || 0) + 1;
  await s.setJSON(key, cur);

  return json({ ok: true });
};

export const config = { path: "/api/track" };
