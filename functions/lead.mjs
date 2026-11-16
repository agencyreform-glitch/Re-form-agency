// Prijava sa Re:Form landinga: čuva se u CRM (store "prijave") i šalje na Telegram.
// Tok: čim upišu ispravan telefon u kratku formu (ime, telefon, čime se bave), lead se pravi sam,
// i bez klika na dugme. Telegram poruka stiže odmah i sama se dopunjuje dok kucaju (ime, delatnost).
// Ostatak upitnika dopunjuje ISTI lead (po _id + _tok); kad pošalju ceo upitnik stiže druga poruka.
// _faza: "auto" (sačuvano dok kucaju), "kontakt" (klik na dugme kratke forme),
//        "korak" (tiho čuvanje usput), "kraj" (poslat ceo upitnik).
// _novi: id i token je napravila sama stranica; ako lead još ne postoji, pravi se pod tim id-jem.
// Env: TELEGRAM_BOT_TOKEN, TELEGRAM_CHAT_ID
import { getStore } from "@netlify/blobs";
import { randomUUID } from "node:crypto";

const store = (name) => getStore({ name, consistency: "strong" });

const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });

const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const newTok = () => randomUUID().replace(/-/g, "");
const okId = (v) => /^[a-z0-9]{8,24}$/.test(String(v || ""));
const okTok = (v) => /^[a-f0-9]{32}$/.test(String(v || ""));
const telOk = (v) => String(v || "").replace(/[^\d+]/g, "").replace(/^\+/, "").length >= 8;

const L = {
  ime_prezime: "Ime i prezime", telefon: "Telefon", delatnost: "Čime se bavi", email: "Email",
  naziv_biznisa: "Biznis", vrsta_biznisa: "Vrsta biznisa", adresa: "Adresa",
  radno_vreme: "Radno vreme", telefon_za_kupce: "Telefon za kupce", email_za_kupce: "Email za kupce",
  instagram: "Instagram", facebook: "Facebook", drugi_linkovi: "Drugi linkovi", pib_mb: "PIB/MB",
  usluge_proizvodi: "Usluge/proizvodi", o_nama: "O nama", stranice: "Stranice", boje: "Boje", logo: "Logo",
  primer_sajta: "Primer sajta", ima_domen: "Ima domen", domen: "Domen", zeljeni_domen: "Željeni domen",
  broj_proizvoda: "Broj proizvoda", dostava: "Dostava", placanje: "Plaćanje", meni: "Meni", rezervacije: "Rezervacije",
  odrzavanje: "Održavanje", salje_slike: "Slike", dostupan_na: "Dostupan na", napomene: "Napomene",
};
const SKIP = new Set(["paket", "saglasnost_podaci", "saglasnost_privatnost", "izvor", "stranica", "vreme", "website_hp"]);
const CENE = { START: 199, BUSINESS: 299, SHOP: 499 };
const esc = (v) => String(Array.isArray(v) ? v.join(", ") : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

// odgovori iz forme, bez internih polja (_id, _tok, _src…)
const odgovoriIz = (d) => {
  const o = {};
  for (const [k, v] of Object.entries(d)) {
    if (SKIP.has(k) || k.startsWith("_") || v === "" || v == null) continue;
    o[clean(k, 40)] = Array.isArray(v) ? v.slice(0, 20).map((x) => clean(x, 2000)) : clean(v, 4000);
  }
  return o;
};

// glavna polja leada koja panel prikazuje u listi
function osnovno(lead, d) {
  if (d.ime_prezime) lead.ime = clean(d.ime_prezime, 120);
  if (d.telefon) lead.telefon = clean(d.telefon, 40);
  if (d.naziv_biznisa) lead.firma = clean(d.naziv_biznisa, 160);
  if (d.email) lead.email = clean(d.email, 160);
  if (d.domen || d.zeljeni_domen) lead.sajt = clean(d.domen || d.zeljeni_domen, 160);
  if (d.delatnost || d.vrsta_biznisa) lead.cilj = clean(d.delatnost || d.vrsta_biznisa, 300);
  const paket = clean(d.paket, 20).toUpperCase();
  if (paket) {
    lead.paket = paket;
    if (lead.status === "nova") lead.vrednost = CENE[paket] || 0;
  }
}

const waLink = (tel) => {
  const t = String(tel || "").replace(/[^\d+]/g, "");
  return t ? "https://wa.me/" + t.replace(/^\+/, "").replace(/^0/, "381") : "";
};

const glava = (d) => {
  let t = "";
  if (d.paket) t += "📦 <b>" + esc(d.paket) + "</b>\n";
  if (d._src) t += "📣 Izvor: " + esc(d._src + (d._cmp ? " · " + d._cmp : "")) + "\n";
  return t;
};
const rep = (lead, origin) => {
  const wa = waLink(lead.telefon);
  return "\n" + (wa ? "💬 WhatsApp: " + wa + "\n" : "") + "🗂 CRM: " + origin + "/panel.html#" + lead.id + "\n";
};

// kratka poruka: neko je ostavio kontakt (pravi se iz sačuvanog leada, pa može da se dopunjuje)
function porukaKontakt(lead, origin) {
  const o = lead.odgovori || {};
  let t = "🔥 <b>NOVI LEAD — Re:Form</b>\n" + glava({ paket: lead.paket, _src: lead.utm_source, _cmp: lead.utm_campaign }) + "\n";
  t += "<b>Ime:</b> " + esc(lead.ime || "—") + "\n";
  t += "<b>Telefon:</b> " + esc(lead.telefon || "—") + "\n";
  t += "<b>Čime se bavi:</b> " + esc(o.delatnost || "—") + "\n";
  t += rep(lead, origin);
  if (lead.upitnik && lead.upitnik.popunjen) t += "\n✅ Poslao ceo upitnik.";
  else if (lead.kontaktKlik === false) t += "\n✍️ Nije kliknuo dugme. Kontakt je sačuvan dok je kucao.";
  else t += "\n⏳ Ostatak upitnika još nije poslat.";
  return t;
}

// puna poruka: poslat ceo upitnik
function porukaPuna(lead, d, origin, naslov) {
  let t = naslov + "\n" + glava(d) + "\n";
  for (const k of Object.keys(L)) if (d[k] != null && d[k] !== "") t += "<b>" + L[k] + ":</b> " + esc(d[k]) + "\n";
  for (const k of Object.keys(d)) if (!L[k] && !SKIP.has(k) && !k.startsWith("_") && d[k] !== "") t += "<b>" + esc(k) + ":</b> " + esc(d[k]) + "\n";
  t += rep(lead, origin);
  return t.length > 4000 ? t.slice(0, 3990) + "…" : t;
}

async function tgApi(method, body) {
  const token = Netlify.env.get("TELEGRAM_BOT_TOKEN");
  const chatId = Netlify.env.get("TELEGRAM_CHAT_ID");
  if (!token || !chatId) { console.log("[lead] Telegram nije podešen"); return null; }
  const r = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, parse_mode: "HTML", disable_web_page_preview: true, ...body }),
  }).then((x) => x.json()).catch((e) => ({ ok: false, e: String(e) }));
  if (!r.ok) console.log("[lead] Telegram greška", method, JSON.stringify(r));
  return r;
}
const telegram = (text) => tgApi("sendMessage", { text });

// prva poruka o kontaktu; pamti se njen id da bi mogla da se dopuni
async function posaljiKontakt(lead, origin) {
  const text = porukaKontakt(lead, origin);
  const r = await telegram(text);
  if (r && r.ok && r.result) { lead.tg = { id: r.result.message_id, txt: text }; return true; }
  return false;
}
// dopuna iste poruke kad stigne novo ime, telefon, delatnost ili klik na dugme
async function dopuniKontakt(lead, origin) {
  if (!lead.tg || !lead.tg.id) return false;
  const text = porukaKontakt(lead, origin);
  if (text === lead.tg.txt) return false;
  const r = await tgApi("editMessageText", { message_id: lead.tg.id, text });
  if (r && r.ok) { lead.tg.txt = text; return true; }
  return false;
}

export default async (req) => {
  if (req.method !== "POST") return json({ ok: false }, 405);
  let d;
  try { d = JSON.parse(await req.text()); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  if (!d || typeof d !== "object" || d.website_hp) return json({ ok: true });

  const s = store("prijave");
  const origin = new URL(req.url).origin;
  const now = new Date().toISOString();
  const faza = ["auto", "kontakt", "korak", "kraj"].includes(d._faza) ? d._faza : "kraj";
  const korak = Math.min(4, Math.max(1, Number(d._korak) || 1));
  const kraj = faza === "kraj";

  // 1) dopuna postojećeg leada
  if (d._id && d._tok) {
    const lead = await s.get(clean(d._id, 40), { type: "json" }).catch(() => null);
    if (lead && lead.token && lead.token === String(d._tok)) {
      const vec = !!(lead.upitnik && lead.upitnik.popunjen);
      osnovno(lead, d);
      lead.odgovori = { ...(lead.odgovori || {}), ...odgovoriIz(d) };
      lead.upitnik = { korak: Math.max((lead.upitnik && lead.upitnik.korak) || 1, kraj ? 4 : korak), popunjen: vec || kraj };
      if (faza !== "auto" && lead.kontaktKlik === false) lead.kontaktKlik = true;
      if (kraj && !vec) lead.upitnikAt = now;
      lead.updatedAt = now;
      // Telegram poruka o kontaktu nije prošla kad je lead napravljen: šalje se sad
      if (lead.tgNeposlat && !lead.upitnik.popunjen) { if (await posaljiKontakt(lead, origin)) delete lead.tgNeposlat; }
      else if (!vec) await dopuniKontakt(lead, origin);
      try { await s.setJSON(lead.id, lead); } catch (e) { console.log("[lead] blobs greška", e); return json({ ok: false }, 500); }
      if (kraj && !vec) await telegram(porukaPuna(lead, d, origin, "✅ <b>POSLAT CEO UPITNIK — " + esc(lead.ime || "Re:Form") + "</b>"));
      return json({ ok: true, id: lead.id });
    }
    // lead nije nađen: tiho čuvanje i dopuna ne prave novi, a ostalo pravi (ako ima telefon)
    if (faza === "korak" || d._dopuna) return json({ ok: false, error: "nema" }, 404);
  }

  // 2) novi lead (za auto čuvanje dovoljan je ispravan telefon, za klik ime i telefon)
  if (!telOk(d.telefon) || (faza !== "auto" && !d.ime_prezime)) return json({ ok: false, error: "missing" }, 400);
  let id = newId(), token = newTok();
  if (d._novi && okId(d._id) && okTok(d._tok)) {
    const zauzet = await s.get(String(d._id), { type: "json" }).catch(() => null);
    if (!zauzet) { id = String(d._id); token = String(d._tok); }
  }
  const lead = {
    id,
    token,
    createdAt: now,
    izvor: "landing",
    utm_source: clean(d._src, 40).toLowerCase() || "direktno",
    utm_campaign: clean(d._cmp, 60),
    vid: clean(d._vid, 40),
    status: "nova",
    beleske: "",
    vrednost: 0,
    odgovori: odgovoriIz(d),
    upitnik: { korak: kraj ? 4 : korak, popunjen: kraj },
    kontaktKlik: faza !== "auto",
    istorija: [{ t: now, s: "nova" }],
  };
  osnovno(lead, d);
  if (kraj) lead.upitnikAt = now;
  // prvo upis, pa Telegram: drugi zahtev koji stigne u međuvremenu nalazi lead i samo ga dopunjuje
  try { await s.setJSON(lead.id, lead); } catch (e) { console.log("[lead] blobs greška", e); }
  if (kraj) await telegram(porukaPuna(lead, d, origin, "🔥 <b>NOVA PRIJAVA — Re:Form</b>"));
  else {
    if (!(await posaljiKontakt(lead, origin))) lead.tgNeposlat = true;
    try {
      // dopuna je možda stigla dok je išla poruka: ne briše se, samo se dodaje id poruke
      const sad = await s.get(lead.id, { type: "json" }).catch(() => null);
      const upis = sad && sad.token === lead.token ? { ...sad, tg: lead.tg, ...(lead.tgNeposlat ? { tgNeposlat: true } : {}) } : lead;
      await s.setJSON(lead.id, upis);
      if (upis !== lead && upis.tg) await dopuniKontakt(upis, origin).then((x) => x && s.setJSON(lead.id, upis));
    } catch (e) { console.log("[lead] blobs greška", e); }
  }

  return json({ ok: true, id: lead.id, tok: lead.token, novo: true });
};

export const config = { path: "/api/lead" };
