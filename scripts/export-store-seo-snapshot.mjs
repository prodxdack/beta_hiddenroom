#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { slugify } from "./build-store-seo.mjs";

const DEFAULT_INPUT = "scripts/fixtures/store-seo-beats.json";
const DEFAULT_OUTPUT = "scripts/fixtures/store-seo-snapshot.json";

function cleanUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`URL pública inválida: ${raw}`);
  return url.href;
}

function validateSourceRecord(record, index) {
  if (!record || typeof record !== "object" || Array.isArray(record)) throw new Error(`Registro ${index + 1} inválido.`);
  for (const field of ["id", "slug", "name", "category", "is_active", "publication_status", "price", "currency"]) {
    if (!(field in record) || record[field] === null || record[field] === "") throw new Error(`Registro ${index + 1}: falta el campo obligatorio ${field}.`);
  }
  if (typeof record.id !== "string" || !record.id.trim()) throw new Error(`Registro ${index + 1}: id inválido.`);
  if (typeof record.slug !== "string" || !record.slug.trim()) throw new Error(`Registro ${index + 1}: slug inválido.`);
  if (typeof record.name !== "string" || !record.name.trim()) throw new Error(`Registro ${index + 1}: name inválido.`);
  if (typeof record.category !== "string") throw new Error(`Registro ${index + 1}: category inválida.`);
  if (typeof record.is_active !== "boolean") throw new Error(`Registro ${index + 1}: is_active debe ser booleano.`);
  if (!["draft", "pending_review", "published", "inactive"].includes(record.publication_status)) throw new Error(`Registro ${index + 1}: publication_status inválido.`);
  if (!Number.isFinite(Number(record.price)) || Number(record.price) < 0) throw new Error(`Registro ${index + 1}: price inválido.`);
  if (typeof record.currency !== "string" || !record.currency.trim()) throw new Error(`Registro ${index + 1}: currency inválida.`);
}

function publicSnapshotRecord(record) {
  return {
    slug: slugify(record.slug),
    name: record.name.trim(),
    producer: String(record.producer ?? "").trim(),
    artwork_url: cleanUrl(record.artwork_url ?? record.image_url ?? record.beat_cover_url),
    genre: String(record.genre ?? record.beat_genre ?? "").trim(),
    bpm: record.bpm ?? record.beat_bpm ?? null,
    key: String(record.key ?? record.beat_key ?? "").trim(),
    description: String(record.description ?? "").trim(),
    price: Number(record.price),
    currency: record.currency.trim(),
  };
}

export function sanitizeStoreSeoSource(dataset, { expectContent = true } = {}) {
  if (!Array.isArray(dataset)) throw new Error("El dataset de origen debe ser un arreglo.");
  if (!dataset.length) throw new Error("El dataset de origen está vacío.");
  dataset.forEach(validateSourceRecord);
  const ids = new Set();
  const slugs = new Set();
  for (const record of dataset) {
    if (ids.has(record.id)) throw new Error(`Identificador duplicado: ${record.id}`);
    ids.add(record.id);
    const normalizedSlug = slugify(record.slug);
    if (slugs.has(normalizedSlug)) throw new Error(`Slug duplicado después de normalizar: ${normalizedSlug}`);
    slugs.add(normalizedSlug);
  }
  const snapshot = dataset.filter((record) => record.category === "beats" && record.is_active === true && record.publication_status === "published").map(publicSnapshotRecord).sort((a, b) => a.slug.localeCompare(b.slug));
  if (expectContent && !snapshot.length) throw new Error("El dataset no contiene beats públicos.");
  return snapshot;
}

function stableJson(value) {
  return `${JSON.stringify(value, null, 2)}\n`;
}

export async function replaceAtomically(output, content) {
  const absolute = path.resolve(output);
  await fs.mkdir(path.dirname(absolute), { recursive: true });
  const tempDir = await fs.mkdtemp(path.join(path.dirname(absolute), ".store-seo-snapshot-"));
  const tempPath = path.join(tempDir, path.basename(absolute));
  const backupPath = `${absolute}.backup-${process.pid}`;
  let backedUp = false;
  try {
    await fs.writeFile(tempPath, content, { encoding: "utf8", flag: "wx" });
    try { await fs.rename(absolute, backupPath); backedUp = true; } catch (error) { if (error.code !== "ENOENT") throw error; }
    await fs.rename(tempPath, absolute);
    if (backedUp) await fs.rm(backupPath, { force: true });
  } catch (error) {
    await fs.rm(tempPath, { force: true }).catch(() => {});
    if (backedUp) {
      await fs.rm(absolute, { force: true }).catch(() => {});
      await fs.rename(backupPath, absolute).catch(() => {});
    }
    throw error;
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function exportStoreSeoSnapshot({ input = DEFAULT_INPUT, output = DEFAULT_OUTPUT, expectContent = true } = {}) {
  const dataset = JSON.parse(await fs.readFile(input, "utf8"));
  const snapshot = sanitizeStoreSeoSource(dataset, { expectContent });
  await replaceAtomically(output, stableJson(snapshot));
  return { output: path.resolve(output), beats: snapshot.length };
}

function cliArgs(argv) { const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, expectContent: true }; for (let i = 0; i < argv.length; i += 1) { if (argv[i] === "--input") args.input = argv[++i]; else if (argv[i] === "--output") args.output = argv[++i]; else if (argv[i] === "--allow-empty") args.expectContent = false; else if (argv[i] === "--help") return null; else throw new Error(`Argumento desconocido: ${argv[i]}`); } return args; }
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) { try { const args = cliArgs(process.argv.slice(2)); if (!args) { console.log("Uso: node scripts/export-store-seo-snapshot.mjs [--input origen.json] [--output snapshot.json] [--allow-empty]"); process.exit(0); } const result = await exportStoreSeoSnapshot(args); console.log(`Snapshot SEO generado: ${result.beats} beats en ${result.output}`); } catch (error) { console.error(error.message); process.exitCode = 1; } }
