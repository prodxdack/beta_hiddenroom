import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fetchStoreSeoSource } from "./fetch-store-seo-source.mjs";

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "hiddenroom-store-fetch-"));
const output = path.join(temp, "source.json");
const config = { url: "https://example.supabase.co", key: "public-test-key" };
const row = (id, slug, extra = {}) => ({ id, slug, name: `Beat ${id}`, description: "Descripción pública", category: "beats", price: 499, currency: "MXN", image_url: null, beat_cover_path: null, beat_thumb_path: null, producer: "Productor público", beat_genre: "Trap", beat_bpm: 140, beat_key: "Cm", is_active: true, publication_status: "published", ...extra });
const response = (body, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body });

const requests = [];
let page = 0;
const pages = [[row("1", "uno", { email: "never-export@example.invalid", unknown: "ignore" }), row("2", "dos")], [row("3", "tres")], []];
await fetchStoreSeoSource({ config, output, pageSize: 2, fetchImpl: async (url, options) => { requests.push({ url: String(url), options }); return response(pages[page++]); } });
assert.equal(requests.length, 2);
assert.ok(requests[0].url.includes("category=eq.beats")); assert.ok(requests[0].url.includes("is_active=eq.true")); assert.ok(requests[0].url.includes("publication_status=eq.published")); assert.ok(requests[0].url.includes("limit=2")); assert.ok(requests[1].url.includes("offset=2"));
assert.ok(requests.every(({ options }) => options.method === "GET"));
const source = JSON.parse(await fs.readFile(output, "utf8"));
assert.deepEqual(source.map((item) => item.slug), ["dos", "tres", "uno"]);
assert.equal(source[2].email, undefined); assert.equal(source[2].unknown, undefined);
const previous = await fs.readFile(output, "utf8");

await assert.rejects(() => fetchStoreSeoSource({ config, output, fetchImpl: async () => response([], 200) }), /no devolvió beats públicos/);
assert.equal(await fs.readFile(output, "utf8"), previous);
await assert.rejects(() => fetchStoreSeoSource({ config, output, fetchImpl: async () => response({ code: "PGRST000", message: "error" }, 200) }), /arreglo JSON/);
assert.equal(await fs.readFile(output, "utf8"), previous);
await assert.rejects(() => fetchStoreSeoSource({ config, output, fetchImpl: async () => response([], 503) }), /HTTP 503/);
assert.equal(await fs.readFile(output, "utf8"), previous);
await assert.rejects(() => fetchStoreSeoSource({ config, output, fetchImpl: async () => response("not-json", 200) }), /arreglo JSON/);
assert.equal(await fs.readFile(output, "utf8"), previous);
await assert.rejects(() => fetchStoreSeoSource({ config, output, timeoutMs: 10, fetchImpl: (_, options) => new Promise((resolve, reject) => options.signal.addEventListener("abort", () => { const error = new Error("aborted"); error.name = "AbortError"; reject(error); })) }), /Timeout/);
assert.equal(await fs.readFile(output, "utf8"), previous);
await assert.rejects(() => fetchStoreSeoSource({ config, output, fetchImpl: async () => response([row("missing", "missing", { name: undefined })]) }), /identificador, slug o nombre/);
assert.equal(await fs.readFile(output, "utf8"), previous);
await assert.rejects(() => fetchStoreSeoSource({ config, output, pageSize: 1, maxPages: 1, fetchImpl: async () => response([row("1", "one")]) }), /maxPages/);
assert.equal(await fs.readFile(output, "utf8"), previous);
console.log("fetch-store-seo-source: PASS");
