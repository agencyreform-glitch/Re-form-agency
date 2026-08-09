import { getStore } from "@netlify/blobs";

const json = (body, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });

const today = () => new Date().toISOString().slice(0, 10);

export default async (req) => {
  const store = getStore("posete");

  if (req.method === "POST") {
    const key = today();
    const cur = (await store.get(key, { type: "json" })) || { datum: key, broj: 0 };
    cur.broj = (cur.broj || 0) + 1;
    await store.setJSON(key, cur);
    return json({ ok: true });
  }

  if (req.method === "GET") {
    const adminKey = process.env.ADMIN_KEY;
    const given = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("key");
    if (!adminKey || given !== adminKey) return json({ ok: false, error: "Neispravan ključ" }, 401);
    const { blobs } = await store.list();
    const days = (await Promise.all(blobs.map((b) => store.get(b.key, { type: "json" })))).filter(Boolean);
    const ukupno = days.reduce((n, d) => n + (d.broj || 0), 0);
    const mesec = today().slice(0, 7);
    const ovajMesec = days.filter((d) => (d.datum || "").startsWith(mesec)).reduce((n, d) => n + (d.broj || 0), 0);
    const danas = (days.find((d) => d.datum === today()) || {}).broj || 0;
    return json({ ok: true, ukupno, ovajMesec, danas, days });
  }

  return json({ ok: false, error: "Method not allowed" }, 405);
};

export const config = { path: "/.netlify/functions/posete" };
