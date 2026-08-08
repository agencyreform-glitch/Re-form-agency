import { getStore } from "@netlify/blobs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const auth = (req) => {
  const key = process.env.ADMIN_KEY;
  if (!key) return false;
  const given = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("key");
  return given === key;
};

export default async (req) => {
  if (!auth(req)) return json({ ok: false, error: "Neispravan ključ" }, 401);

  const store = getStore("prijave");

  if (req.method === "GET") {
    const { blobs } = await store.list();
    const items = await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })));
    items.sort((a, b) => (b?.createdAt || "").localeCompare(a?.createdAt || ""));
    return json({ ok: true, items: items.filter(Boolean) });
  }

  if (req.method === "POST") {
    const { id, status, beleske } = await req.json();
    if (!id) return json({ ok: false, error: "Nedostaje id" }, 400);
    const lead = await store.get(id, { type: "json" });
    if (!lead) return json({ ok: false, error: "Prijava nije pronađena" }, 404);
    if (status !== undefined) lead.status = status;
    if (beleske !== undefined) lead.beleske = beleske;
    lead.updatedAt = new Date().toISOString();
    await store.setJSON(id, lead);
    return json({ ok: true, item: lead });
  }

  if (req.method === "DELETE") {
    const id = new URL(req.url).searchParams.get("id");
    if (!id) return json({ ok: false, error: "Nedostaje id" }, 400);
    await store.delete(id);
    return json({ ok: true });
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
};

export const config = { path: "/.netlify/functions/leads" };
