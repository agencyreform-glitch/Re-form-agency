// CRM API (zaštićen sa ADMIN_KEY): lista, izmena, ručno dodavanje i brisanje prijava.
import { store, json, isAdmin, clean, newId } from "../lib/crm.mjs";

const STATUSI = ["nova", "u radu", "poslato", "kupio", "odbijeno"];
const POLJA = ["ime", "firma", "telefon", "email", "sajt", "cilj", "paket", "beleske", "izvor", "utm_source", "utm_campaign"];

export default async (req) => {
  if (!isAdmin(req)) return json({ ok: false, error: "Neispravan ključ" }, 401);
  const s = store("prijave");
  const url = new URL(req.url);

  if (req.method === "GET") {
    const { blobs } = await s.list();
    const items = (await Promise.all(blobs.map((b) => s.get(b.key, { type: "json" })))).filter(Boolean);
    items.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
    return json({ ok: true, items, statusi: STATUSI });
  }

  if (req.method === "POST") {
    const d = await req.json().catch(() => ({}));
    const now = new Date().toISOString();

    // ručno dodavanje (npr. neko je pozvao direktno)
    if (!d.id) {
      if (!d.ime && !d.telefon) return json({ ok: false, error: "Upiši bar ime ili telefon" }, 400);
      const lead = { id: newId(), createdAt: d.createdAt || now, izvor: "ručno", utm_source: "direktno", status: "nova", beleske: "", vrednost: 0, odgovori: {}, istorija: [{ t: now, s: "nova" }] };
      for (const k of POLJA) if (d[k] !== undefined) lead[k] = clean(d[k], k === "beleske" ? 5000 : 300);
      if (d.izvor) lead.izvor = clean(d.izvor, 30);
      if (d.vrednost !== undefined) lead.vrednost = Math.max(0, Number(d.vrednost) || 0);
      if (STATUSI.includes(d.status)) lead.status = d.status;
      await s.setJSON(lead.id, lead);
      return json({ ok: true, item: lead });
    }

    const lead = await s.get(d.id, { type: "json" });
    if (!lead) return json({ ok: false, error: "Prijava nije pronađena" }, 404);
    for (const k of POLJA) if (d[k] !== undefined) lead[k] = clean(d[k], k === "beleske" ? 5000 : 300);
    if (d.vrednost !== undefined) lead.vrednost = Math.max(0, Number(d.vrednost) || 0);
    if (d.status !== undefined && STATUSI.includes(d.status) && d.status !== lead.status) {
      lead.status = d.status;
      (lead.istorija ||= []).push({ t: now, s: d.status });
      if (d.status === "kupio" && !lead.kupljeno) lead.kupljeno = now;
    }
    if (d.kontakt) (lead.kontakti ||= []).push({ t: now, tip: clean(d.kontakt, 20) }); // poziv / wa / mejl
    lead.updatedAt = now;
    await s.setJSON(d.id, lead);
    return json({ ok: true, item: lead });
  }

  if (req.method === "DELETE") {
    const id = url.searchParams.get("id");
    if (!id) return json({ ok: false, error: "Nedostaje id" }, 400);
    await s.delete(id);
    return json({ ok: true });
  }
  return json({ ok: false, error: "Method not allowed" }, 405);
};

export const config = { path: "/.netlify/functions/leads" };
