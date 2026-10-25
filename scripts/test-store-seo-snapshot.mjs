import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { buildStoreSeo } from "./build-store-seo.mjs";
import { exportStoreSeoSnapshot, sanitizeStoreSeoSource } from "./export-store-seo-snapshot.mjs";

const temp = await fs.mkdtemp(path.join(os.tmpdir(), "hiddenroom-store-snapshot-"));
const sourcePath = path.join(temp, "source.json");
const snapshotPath = path.join(temp, "snapshot.json");
const repeatPath = path.join(temp, "snapshot-repeat.json");
const outputPath = path.join(temp, "seo-output");
const source = [
  { id: "beat-public-1", slug: "Luz de Neón", name: "Luz de Neón", description: "Descripción pública", producer: "Productor público", genre: "Trap", bpm: 140, key: "Cm", price: 499, currency: "MXN", category: "beats", is_active: true, publication_status: "published", email: "never@example.invalid", payment_token: "never-export", unknown_field: "ignore" },
  { id: "beat-inactive", slug: "inactivo", name: "Inactivo", price: 100, currency: "MXN", category: "beats", is_active: false, publication_status: "inactive", phone: "+52 5555555555" },
  { id: "merch-1", slug: "camiseta", name: "Camiseta", price: 250, currency: "MXN", category: "merch", is_active: true, publication_status: "published", internal_note: "ignore" },
];
await fs.writeFile(sourcePath, JSON.stringify(source));
const expected = [{ slug: "luz-de-neon", name: "Luz de Neón", producer: "Productor público", artwork_url: "", genre: "Trap", bpm: 140, key: "Cm", description: "Descripción pública", price: 499, currency: "MXN" }];
assert.deepEqual(sanitizeStoreSeoSource(source), expected);
await exportStoreSeoSnapshot({ input: sourcePath, output: snapshotPath });
await exportStoreSeoSnapshot({ input: sourcePath, output: repeatPath });
assert.equal(await fs.readFile(snapshotPath, "utf8"), await fs.readFile(repeatPath, "utf8"));
assert.deepEqual(JSON.parse(await fs.readFile(snapshotPath, "utf8")), expected);
const snapshotTextBeforeFailure = await fs.readFile(snapshotPath, "utf8");

const emptyPath = path.join(temp, "empty.json");
await fs.writeFile(emptyPath, "[]");
await assert.rejects(() => exportStoreSeoSnapshot({ input: emptyPath, output: snapshotPath }), /vacío/);
assert.equal(await fs.readFile(snapshotPath, "utf8"), snapshotTextBeforeFailure);

const missingPath = path.join(temp, "missing.json");
await fs.writeFile(missingPath, JSON.stringify([{ id: "missing-name", slug: "missing-name", price: 1, currency: "MXN", category: "beats", is_active: true }]));
await assert.rejects(() => exportStoreSeoSnapshot({ input: missingPath, output: snapshotPath }), /name/);
assert.equal(await fs.readFile(snapshotPath, "utf8"), snapshotTextBeforeFailure);

assert.throws(() => sanitizeStoreSeoSource([{ ...source[0], id: "duplicate" }, { ...source[1], id: "duplicate" }]), /Identificador duplicado/);
assert.throws(() => sanitizeStoreSeoSource([{ ...source[0], slug: "same" }, { ...source[1], slug: "SAME" }]), /Slug duplicado/);
assert.throws(() => sanitizeStoreSeoSource([{ ...source[0], category: "digital" }]), /beats públicos/);
await buildStoreSeo({ input: snapshotPath, output: outputPath, siteUrl: "https://hiddenroom.mx" });
assert.match(await fs.readFile(path.join(outputPath, "beats", "luz-de-neon", "index.html"), "utf8"), /Luz de Neón/);
assert.match(await fs.readFile(path.join(outputPath, "sitemap.xml"), "utf8"), /luz-de-neon/);
console.log("store-seo-snapshot: PASS");
