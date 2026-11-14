// Beleži posete, klikove i levak sa sajta.
// Osnovni događaji: pv (poseta), call, wa, form_start, cta.
// Levak: s:<sekcija> (dokle su stigli), f:vidi (videli upitnik), fp:<polje> (dotakli polje),
// fe:<polje> (greška u polju), k:<korak> (prešli na korak), lead:ok|err (kratka forma), sub:try|ok|err (ceo upitnik),
// x:<polje> / xk:<korak> (gde su izašli iz upitnika), c:<sekcija> (klik ka upitniku), pk:<paket>, dv:m|d (uređaj).
// Brojači se čuvaju po danu u storu "analitika-v3": ev = svi događaji, uq = jedinstveni posetioci.
import { getStore } from "@netlify/blobs";

const store = (name) => getStore({ name, consistency: "strong" });

const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });

// Datum po beogradskom vremenu (YYYY-MM-DD)
const day = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Belgrade" }).format(d);

const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

const BASE = new Set(["pv", "call", "wa", "form_start", "cta"]);
const NAMED = /^(s|f|fp|fe|k|sub|lead|x|xk|c|pk|dv):[a-z0-9_-]{1,40}$/i;
const okEvent = (e) => BASE.has(e) || NAMED.test(e);
const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|headless|lighthouse|pingdom|monitor/i;

// Čitanje i upis jednog zapisa (fn vraća null kad nema šta da se upiše)
async function update(s, key, fn, init) {
  const cur = await s.get(key, { type: "json" });
  const next = fn(cur || init());
  if (next !== null) await s.setJSON(key, next);
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  if (BOT.test(req.headers.get("user-agent") || "")) return json({ ok: true, bot: true });

  let d;
  try { d = JSON.parse(await req.text()); } catch { return json({ ok: false }, 400); }
  const list = (Array.isArray(d.evs) ? d.evs : [d.e]).slice(0, 40).map((e) => clean(e, 50)).filter(okEvent);
  const evs = [...new Set(list)];
  if (!evs.length) return json({ ok: false }, 400);

  const vid = clean(d.v, 40).replace(/[^a-z0-9]/gi, "") || "anon";
  const src = clean(d.src, 40).toLowerCase() || "direktno";
  const cmp = clean(d.cmp, 60);
  const today = day();
  const s = store("analitika-v3");

  // jedinstveni posetilac: šta je ovaj posetilac već uradio danas
  let fresh = [];
  await update(s, `vis/${today}/${vid}`, (cur) => {
    const seen = new Set(cur.e || []);
    fresh = evs.filter((e) => !seen.has(e));
    if (!fresh.length) return null;
    fresh.forEach((e) => seen.add(e));
    return { e: [...seen] };
  }, () => ({ e: [] }));

  const sk = cmp ? `${src} · ${cmp}` : src;
  await update(s, `dan/${today}`, (cur) => {
    cur.ev ||= {}; cur.uq ||= {}; cur.izvori ||= {};
    const iz = (cur.izvori[sk] ||= { ev: {}, uq: {} });
    for (const e of evs) { cur.ev[e] = (cur.ev[e] || 0) + 1; iz.ev[e] = (iz.ev[e] || 0) + 1; }
    for (const e of fresh) { cur.uq[e] = (cur.uq[e] || 0) + 1; iz.uq[e] = (iz.uq[e] || 0) + 1; }
    return cur;
  }, () => ({ datum: today, ev: {}, uq: {}, izvori: {} }));

  return json({ ok: true });
};

export const config = { path: "/api/track" };
