import { getStore } from "@netlify/blobs";

const esc = (t = "") => String(t).replace(/[<>&]/g, (c) => ({ "<": "&lt;", ">": "&gt;", "&": "&amp;" }[c]));

export default async (req) => {
  if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

  let d;
  try { d = await req.json(); } catch { return new Response("Bad JSON", { status: 400 }); }
  if (d.website) return new Response(JSON.stringify({ ok: true }), { status: 200 }); // honeypot

  const lead = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
    createdAt: new Date().toISOString(),
    sajt: (d.sajt || "").trim(),
    ime: (d.ime || "").trim(),
    firma: (d.firma || "").trim(),
    email: (d.email || "").trim(),
    telefon: (d.telefon || "").trim(),
    cilj: (d.cilj || "").trim(),
    status: "nova",
    beleske: ""
  };

  if (!lead.sajt || !lead.ime || !lead.email || !lead.telefon) {
    return new Response(JSON.stringify({ ok: false, error: "Nedostaju obavezna polja" }), { status: 400 });
  }

  // 1) trajno u bazu
  try {
    const store = getStore("prijave");
    await store.setJSON(lead.id, lead);
  } catch (e) {}

  // 2) obaveštenje na Telegram
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (token && chatId) {
    const text = [
      "🔔 <b>Nova prijava — Re:Form</b>",
      "",
      `<b>Firma:</b> ${esc(lead.firma)}`,
      `<b>Sajt:</b> ${esc(lead.sajt)}`,
      `<b>Ime:</b> ${esc(lead.ime)}`,
      `<b>Telefon:</b> ${esc(lead.telefon)}`,
      `<b>Email:</b> ${esc(lead.email)}`,
      lead.cilj ? `\n<b>Cilj sajta:</b>\n${esc(lead.cilj)}` : "",
      `\n<pre>#data ${esc(JSON.stringify(lead))}</pre>`
    ].filter(Boolean).join("\n");

    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: "HTML", disable_web_page_preview: true })
    }).catch(() => {});
  }

  return new Response(JSON.stringify({ ok: true, id: lead.id }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
};

export const config = { path: "/.netlify/functions/submit" };
