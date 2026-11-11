// Zajedničke pomoćne funkcije za Re:Form CRM.
import { getStore } from "@netlify/blobs";

export const store = (name) => getStore({ name, consistency: "strong" });

export const json = (o, s = 200, extra = {}) =>
  new Response(JSON.stringify(o), { status: s, headers: { "Content-Type": "application/json", "Cache-Control": "no-store", ...extra } });

export const isAdmin = (req) => {
  const key = Netlify.env.get("ADMIN_KEY");
  if (!key) return false;
  const given = req.headers.get("x-admin-key") || new URL(req.url).searchParams.get("key");
  return given === key;
};

// Datum po beogradskom vremenu (YYYY-MM-DD)
export const day = (d = new Date()) =>
  new Intl.DateTimeFormat("sv-SE", { timeZone: "Europe/Belgrade" }).format(d);

export const clean = (v, max = 200) => String(v ?? "").trim().slice(0, max);

export const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
