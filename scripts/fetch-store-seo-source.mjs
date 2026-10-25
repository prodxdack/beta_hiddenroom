#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { replaceAtomically } from "./export-store-seo-snapshot.mjs";

const DEFAULT_CONFIG = "store/beat_store/bs.js";
const DEFAULT_OUTPUT = ".store-seo-source.json";
const DEFAULT_PAGE_SIZE = 100;
const DEFAULT_TIMEOUT_MS = 15000;
const QUERY_FIELDS = ["id", "slug", "name", "description", "category", "price", "currency", "image_url", "beat_cover_path", "beat_thumb_path", "producer", "beat_genre", "beat_bpm", "beat_key", "is_active", "publication_status"];
const OUTPUT_FIELDS = ["id", "slug", "name", "description", "category", "price", "currency", "artwork_url", "producer", "beat_genre", "beat_bpm", "beat_key", "is_active", "publication_status"];

function readFrontendConfig(text, configPath) {
  const read = (name) => {
    const match = text.match(new RegExp(`const\\s+${name}\\s*=\\s*[\\\"']([^\\\"']+)[\\\"']`));
    if (!match?.[1]) throw new Error(`No se encontró ${name} en ${configPath}.`);
    return match[1];
  };
  const cloudOrigin = text.match(/const\s+CLOUD_ORIGIN\s*=\s*[\"']([^\"']+)[\"']/)?.[1] || "";
  return { url: read("SUPABASE_URL"), key: read("SUPABASE_ANON_KEY"), cloudOrigin };
}

async function loadConfig(configPath, config) {
  if (config?.url && config?.key) return config;
  return readFrontendConfig(await fs.readFile(configPath, "utf8"), configPath);
}

function requestUrl(base, pageSize, offset) {
  const url = new URL("/rest/v1/store_products", base);
  url.searchParams.set("select", QUERY_FIELDS.join(","));
  url.searchParams.set("category", "eq.beats");
  url.searchParams.set("is_active", "eq.true");
  url.searchParams.set("publication_status", "eq.published");
  url.searchParams.set("order", "slug.asc,id.asc");
  url.searchParams.set("limit", String(pageSize));
  url.searchParams.set("offset", String(offset));
  return url;
}

function validateRow(row, index) {
  if (!row || typeof row !== "object" || Array.isArray(row)) throw new Error(`Respuesta: registro ${index + 1} inválido.`);
  for (const field of ["id", "slug", "name", "category", "is_active", "publication_status", "price", "currency"]) {
    if (!(field in row)) throw new Error(`Respuesta: falta la columna ${field} en el registro ${index + 1}.`);
  }
  if (typeof row.id !== "string" || !row.id.trim() || typeof row.slug !== "string" || !row.slug.trim() || typeof row.name !== "string" || !row.name.trim()) throw new Error(`Respuesta: identificador, slug o nombre inválido en el registro ${index + 1}.`);
  if (row.category !== "beats" || row.is_active !== true || row.publication_status !== "published") throw new Error(`Respuesta: el filtro público devolvió un registro no publicable en la posición ${index + 1}.`);
  if (!Number.isFinite(Number(row.price)) || typeof row.currency !== "string" || !row.currency.trim()) throw new Error(`Respuesta: precio o moneda inválidos en el registro ${index + 1}.`);
}

function publicArtworkUrl(row, cloudOrigin) {
  const raw = String(row.image_url || row.beat_cover_path || row.beat_thumb_path || "").trim();
  if (!raw) return "";
  if (/^https?:\/\//i.test(raw)) return raw;
  const clean = raw.replaceAll("\\", "/").replace(/^\/+/, "").replace(/^beats_store\//i, "");
  if (!clean || !/^covers\//i.test(clean) || clean.split("/").some((segment) => segment === "." || segment === "..") || !cloudOrigin) return "";
  const url = new URL("/api/beat-store/stream", cloudOrigin);
  url.searchParams.set("file", clean);
  return url.href;
}

function publicSourceRow(row, cloudOrigin) {
  return Object.fromEntries(OUTPUT_FIELDS.map((field) => [field, field === "artwork_url" ? publicArtworkUrl(row, cloudOrigin) : row[field] ?? null]));
}

function jsonResponse(response, url) {
  if (!response || typeof response.status !== "number" || !response.ok) throw new Error(`Supabase REST respondió HTTP ${response?.status ?? "desconocido"} en ${url.pathname}.`);
  return response.json().then((body) => {
    if (!Array.isArray(body)) throw new Error("Supabase REST no devolvió un arreglo JSON.");
    return body;
  }).catch((error) => {
    if (error.message === "Supabase REST no devolvió un arreglo JSON.") throw error;
    throw new Error("Respuesta JSON inválida de Supabase REST.");
  });
}

async function fetchPage(fetchImpl, url, key, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { method: "GET", headers: { apikey: key, Authorization: `Bearer ${key}`, Accept: "application/json" }, signal: controller.signal });
    return await jsonResponse(response, url);
  } catch (error) {
    if (error.name === "AbortError") throw new Error(`Timeout leyendo ${url.pathname}.`);
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function fetchStoreSeoSource({ configPath = DEFAULT_CONFIG, config, output = DEFAULT_OUTPUT, pageSize = DEFAULT_PAGE_SIZE, timeoutMs = DEFAULT_TIMEOUT_MS, maxPages = 1000, expectContent = true, fetchImpl = globalThis.fetch } = {}) {
  if (typeof fetchImpl !== "function") throw new Error("No existe un fetch disponible para la lectura read-only.");
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 1000) throw new Error("pageSize fuera de rango.");
  const resolved = await loadConfig(configPath, config);
  const base = new URL(resolved.url);
  const rows = [];
  for (let page = 0; page < maxPages; page += 1) {
    const offset = page * pageSize;
    const url = requestUrl(base, pageSize, offset);
    const batch = await fetchPage(fetchImpl, url, resolved.key, timeoutMs);
    batch.forEach((row, index) => validateRow(row, rows.length + index));
    rows.push(...batch.map((row) => publicSourceRow(row, resolved.cloudOrigin)));
    if (batch.length < pageSize) break;
    if (page === maxPages - 1) throw new Error("Se alcanzó maxPages; la paginación no se completó y no se truncará silenciosamente.");
  }
  if (expectContent && !rows.length) throw new Error("La fuente real no devolvió beats públicos.");
  const source = rows.sort((a, b) => a.slug.localeCompare(b.slug) || a.id.localeCompare(b.id));
  await replaceAtomically(output, `${JSON.stringify(source, null, 2)}\n`);
  console.log(`Fuente SEO read-only: ${rows.length} registros recibidos; ${rows.filter((row) => row.category === "beats" && row.is_active === true && row.publication_status === "published").length} pasan el filtro público.`);
  return { output: path.resolve(output), records: rows.length, publicBeats: rows.length };
}

function cliArgs(argv) { const args = { configPath: DEFAULT_CONFIG, output: DEFAULT_OUTPUT, pageSize: DEFAULT_PAGE_SIZE, timeoutMs: DEFAULT_TIMEOUT_MS, maxPages: 1000, expectContent: true }; for (let i = 0; i < argv.length; i += 1) { if (argv[i] === "--config") args.configPath = argv[++i]; else if (argv[i] === "--output") args.output = argv[++i]; else if (argv[i] === "--page-size") args.pageSize = Number(argv[++i]); else if (argv[i] === "--timeout-ms") args.timeoutMs = Number(argv[++i]); else if (argv[i] === "--max-pages") args.maxPages = Number(argv[++i]); else if (argv[i] === "--allow-empty") args.expectContent = false; else if (argv[i] === "--help") return null; else throw new Error(`Argumento desconocido: ${argv[i]}`); } return args; }
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) { try { const args = cliArgs(process.argv.slice(2)); if (!args) { console.log("Uso: node scripts/fetch-store-seo-source.mjs [--config bs.js] [--output source.json] [--page-size N]"); process.exit(0); } await fetchStoreSeoSource(args); } catch (error) { console.error(error.message); process.exitCode = 1; } }
