import { put, head } from "@vercel/blob";
import { randomUUID, timingSafeEqual } from "node:crypto";

const FILE = "training-calendar/events.json";

const SEED = [
  ["MPAT","2027-01-04","2027-01-05"],["FTO","2027-01-18","2027-01-19"],["DT","2027-01-25","2027-01-29"],
  ["FLS","2027-02-08","2027-02-12"],["Ins Dev","2027-03-08","2027-03-12"],["MPAT","2027-04-06","2027-04-07"],
  ["Firearms","2027-04-26","2027-04-30"],["LEQ","2027-04-26","2027-04-30"],["DT","2027-04-26","2027-04-30"],
  ["SFST","2027-05-03","2027-05-07"],["Ins Dev","2027-05-10","2027-05-14"],["FLS","2027-05-31","2027-06-04"],
  ["Ins Dev","2027-08-09","2027-08-13"],["MPAT","2027-08-16","2027-08-17"],["LEQ","2027-08-16","2027-08-20"],
  ["SFST","2027-08-23","2027-08-27"],["FLS","2027-09-06","2027-09-10"],["Firearms","2027-09-06","2027-09-10"],
  ["DT","2027-09-06","2027-09-10"],["Coroner CE","2027-12-01","2027-12-03"],["Basic Coroner","2027-12-06","2027-12-10"],
].map(([title, start, end], i) => ({ id: "seed-" + i, title, start, end, notes: "" }));

const DATE = /^\d{4}-\d{2}-\d{2}$/;

async function load() {
  try {
    const meta = await head(FILE);
    const res = await fetch(meta.url + "?v=" + new Date(meta.uploadedAt).getTime(), { cache: "no-store" });
    if (!res.ok) throw new Error("read failed " + res.status);
    return await res.json();
  } catch (e) {
    if (e && (e.name === "BlobNotFoundError" || /not.?found/i.test(e.message || ""))) return SEED;
    throw e;
  }
}

async function store(list) {
  await put(FILE, JSON.stringify(list), {
    access: "public", addRandomSuffix: false, allowOverwrite: true,
    contentType: "application/json", cacheControlMaxAge: 60,
  });
}

function passOk(given) {
  const real = process.env.CALENDAR_PASSCODE || "";
  const a = Buffer.from(String(given || "")), b = Buffer.from(real);
  return real.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}

function clean(ev) {
  const title = String(ev.title || "").trim().slice(0, 80);
  const notes = String(ev.notes || "").trim().slice(0, 500);
  const { start, end } = ev;
  if (!title || !DATE.test(start) || !DATE.test(end) || end < start) return null;
  return { title, start, end, notes };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  if (!process.env.BLOB_READ_WRITE_TOKEN) {
    if (req.method === "GET") return res.status(200).json(SEED);
    return res.status(503).json({ error: "storage_missing", message: "Connect a Blob store to this project in Vercel." });
  }
  try {
    if (req.method === "GET") return res.status(200).json(await load());
    if (req.method !== "POST") return res.status(405).json({ error: "method" });

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (!passOk(body.passcode)) return res.status(401).json({ error: "passcode" });

    let list = await load();
    if (body.action === "check") return res.status(200).json(list);
    if (body.action === "delete") {
      list = list.filter(e => e.id !== body.id);
    } else if (body.action === "save") {
      const ev = clean(body.event || {});
      if (!ev) return res.status(400).json({ error: "invalid" });
      if (body.id) list = list.map(e => (e.id === body.id ? { ...ev, id: e.id } : e));
      else list = [...list, { ...ev, id: randomUUID() }];
    } else {
      return res.status(400).json({ error: "action" });
    }
    await store(list);
    return res.status(200).json(list);
  } catch (e) {
    console.error(e);
    return res.status(500).json({ error: "server" });
  }
}
