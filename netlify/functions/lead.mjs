// Prijava sa Re:Form forme -> Telegram poruka.
// Env: TELEGRAM_BOT_TOKEN (obavezno), TELEGRAM_CHAT_ID (posle /start).
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};
const json = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", ...CORS } });

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
const SKIP = new Set(["paket", "saglasnost_podaci", "saglasnost_privatnost", "izvor", "stranica", "vreme", "website_hp"]);
const esc = (v) => String(Array.isArray(v) ? v.join(", ") : v).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function poruka(d) {
  let t = "🔥 <b>NOVA PRIJAVA — Re:Form</b>\n";
  if (d.paket) t += "📦 <b>" + esc(d.paket) + "</b>\n";
  t += "\n";
  for (const k of Object.keys(L)) if (d[k] != null && d[k] !== "") t += "<b>" + L[k] + ":</b> " + esc(d[k]) + "\n";
  for (const k of Object.keys(d)) if (!L[k] && !SKIP.has(k) && d[k] !== "") t += "<b>" + esc(k) + ":</b> " + esc(d[k]) + "\n";
  const tel = String(d.telefon || "").replace(/[^\d+]/g, "");
  if (tel) t += "\n💬 WhatsApp: https://wa.me/" + tel.replace(/^\+/, "").replace(/^0/, "381") + "\n";
  return t.length > 4000 ? t.slice(0, 3990) + "…" : t;
}

export default async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  const token = Netlify.env.get("TELEGRAM_BOT_TOKEN");
  if (!token) return json({ ok: false, error: "no_token" }, 500);
  const api = (m, body) => fetch(`https://api.telegram.org/bot${token}/${m}`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}),
  }).then((r) => r.json());

  // Podešavanje: /api/lead?setup=1 vraća chat ID iz poslednjih poruka botu
  if (req.method === "GET") {
    if (new URL(req.url).searchParams.get("setup") !== "1") return json({ ok: true });
    const u = await api("getUpdates", { limit: 20 });
    const chats = [...new Map((u.result || []).map((x) => (x.message || x.edited_message || {}).chat).filter(Boolean).map((c) => [c.id, { id: c.id, ime: c.first_name || c.title || "", username: c.username || "" }])).values()];
    return json({ ok: true, chats });
  }

  if (req.method !== "POST") return json({ ok: false }, 405);
  let d;
  try { d = await req.json(); } catch { return json({ ok: false, error: "bad_json" }, 400); }
  if (!d || typeof d !== "object" || d.website_hp) return json({ ok: true });
  if (!d.ime_prezime || !d.telefon) return json({ ok: false, error: "missing" }, 400);

  let chatId = Netlify.env.get("TELEGRAM_CHAT_ID");
  if (!chatId) {
    // Rezerva dok TELEGRAM_CHAT_ID nije upisan: poslednji privatni chat koji je pisao botu
    const u = await api("getUpdates", { limit: 50 });
    const c = (u.result || []).map((x) => (x.message || {}).chat).filter((c) => c && c.type === "private").pop();
    if (c) chatId = String(c.id);
  }
  if (!chatId) { console.log("[lead] TELEGRAM_CHAT_ID nije podešen", JSON.stringify(d)); return json({ ok: false, error: "no_chat" }, 500); }
  const r = await api("sendMessage", { chat_id: chatId, text: poruka(d), parse_mode: "HTML", disable_web_page_preview: true });
  if (!r.ok) { console.log("[lead] Telegram greška", JSON.stringify(r), JSON.stringify(d)); return json({ ok: false, error: "telegram" }, 502); }
  return json({ ok: true });
};

export const config = { path: "/api/lead" };
