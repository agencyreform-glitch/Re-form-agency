// Prijava sa Re:Form landinga: čuva se u CRM (store "prijave") i šalje na Telegram.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
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

const L = {
  ime_prezime: "Ime i prezime", telefon: "Telefon", email: "Email",
  naziv_biznisa: "Biznis", vrsta_biznisa: "Vrsta biznisa", delatnost: "Delatnost", adresa: "Adresa",
  radno_vreme: "Radno vreme", telefon_za_kupce: "Telefon za kupce", email_za_kupce: "Email za kupce",
  instagram: "Instagram", facebook: "Facebook", drugi_linkovi: "Drugi linkovi", pib_mb: "PIB/MB",
  usluge_proizvodi: "Usluge/proizvodi", o_nama: "O nama", stranice: "Stranice", boje: "Boje", logo: "Logo",
  primer_sajta: "Primer sajta", ima_domen: "Ima domen", domen: "Domen", zeljeni_domen: "Željeni domen",
  broj_proizvoda: "Broj proizvoda", dostava: "Dostava", placanje: "Plaćanje", meni: "Meni", rezervacije: "Rezervacije",
  odrzavanje: "Održavanje", salje_slike: "Slike", dostupan_na: "Dostupan na", napomene: "Napomene",
};
const SKIP = new Set(["paket", "saglasnost_podaci", "saglasnost_privatnost", "izvor", "stranica", "vreme", "website_hp", "_vid", "_src", "_cmp"]);
const CENE = { START: 199, BUSINESS: 299, SHOP: 499 };
const esc = (v) => String(Array.isArray(v) ? v.join(", ") : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function poruka(d, id, origin) {
  let t = "🔥 <b>NOVA PRIJAVA — Re:Form</b>\n";
  if (d.paket) t += "📦 <b>" + esc(d.paket) + "</b>\n";
  if (d._src) t += "📣 Izvor: " + esc(d._src + (d._cmp ? " · " + d._cmp : "")) + "\n";
  t += "\n";
  for (const k of Object.keys(L)) if (d[k] != null && d[k] !== "") t += "<b>" + L[k] + ":</b> " + esc(d[k]) + "\n";
  for (const k of Object.keys(d)) if (!L[k] && !SKIP.has(k) && d[k] !== "") t += "<b>" + esc(k) + ":</b> " + esc(d[k]) + "\n";
  const tel = String(d.telefon || "").replace(/[^\d+]/g, "");
  if (tel) t += "\n💬 WhatsApp: https://wa.me/" + tel.replace(/^\+/, "").replace(/^0/, "381") + "\n";
  t += "🗂 CRM: " + origin + "/panel.html#" + id + "\n";
  return t.length > 4000 ? t.slice(0, 3990) + "…" : t;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  if (!d || typeof d !== "object" || d.website_hp) return json({ ok: true });
  if (!d.ime_prezime || !d.telefon) return json({ ok: false, error: "missing" }, 400);

  const odgovori = {};
  for (const [k, v] of Object.entries(d)) if (!SKIP.has(k) && v !== "") odgovori[k] = Array.isArray(v) ? v.map((x) => clean(x, 2000)) : clean(v, 4000);

  const paket = clean(d.paket, 20).toUpperCase();
  const lead = {
    id: newId(),
    createdAt: new Date().toISOString(),
    izvor: "landing",
    utm_source: clean(d._src, 40).toLowerCase() || "direktno",
    utm_campaign: clean(d._cmp, 60),
    vid: clean(d._vid, 40),
    ime: clean(d.ime_prezime, 120),
    firma: clean(d.naziv_biznisa, 160),
    telefon: clean(d.telefon, 40),
    email: clean(d.email, 160),
    sajt: clean(d.domen || d.zeljeni_domen, 160),
    cilj: clean(d.vrsta_biznisa || d.delatnost, 300),
    paket,
    vrednost: CENE[paket] || 0,
    status: "nova",
    beleske: "",
    odgovori,
    istorija: [{ t: new Date().toISOString(), s: "nova" }],
  };
  try { await store("prijave").setJSON(lead.id, lead); } catch (e) { console.log("[lead] blobs greška", e); }

  const token = Netlify.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Netlify.env.get("TELEGRAM_CHAT_ID");
  if (token && chatId) {
    const origin = new URL(req.url).origin;
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: poruka(d, lead.id, origin), parse_mode: "HTML", disable_web_page_preview: true }),
    }).then((x) => x.json()).catch((e) => ({ ok: false, e: String(e) }));
    if (!r.ok) console.log("[lead] Telegram greška", JSON.stringify(r));
  } else console.log("[lead] Telegram nije podešen");

  return json({ ok: true, id: lead.id });
};

export const config = { path: "/api/lead" };
