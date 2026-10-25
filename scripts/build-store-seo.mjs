#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_INPUT = "scripts/fixtures/store-seo-snapshot.json";
const DEFAULT_OUTPUT = ".store-seo-preview";
const DEFAULT_SITE_URL = "https://hiddenroom.mx";
const PUBLIC_SITE_ROUTES = ["/", "/studio/", "/store/", "/store/beat_store/", "/media/", "/academia/", "/eventos/", "/tickets/", "/empresas/", "/empresas/jingles/"];

export function slugify(value) {
  const raw = String(value ?? "").trim();
  if (raw === "." || raw === ".." || raw.includes("..")) throw new Error(`Slug inválido o inseguro: ${JSON.stringify(value)}`);
  const slug = raw.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120).replace(/-+$/g, "");
  if (!slug || slug === "." || slug === ".." || slug.includes("..")) throw new Error(`Slug inválido o inseguro: ${JSON.stringify(value)}`);
  return slug;
}

const escapeHtml = (value) => String(value ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
const escapeJson = (value) => JSON.stringify(value).replaceAll("</", "<\\/");
const baseUrl = (siteUrl) => siteUrl.replace(/\/$/, "");
const beatUrl = (siteUrl, slug) => `${baseUrl(siteUrl)}/beats/${encodeURIComponent(slug)}/`;
const storeUrl = (siteUrl, slug) => `${baseUrl(siteUrl)}/store/beat_store/?q=${encodeURIComponent(slug)}`;

function cleanUrl(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  const url = new URL(raw);
  if (!["http:", "https:"].includes(url.protocol)) throw new Error(`URL pública inválida: ${raw}`);
  return url.href;
}

function normalizedSnapshotBeat(beat) {
  if (!beat || typeof beat !== "object" || Array.isArray(beat)) throw new Error("Cada beat del snapshot debe ser un objeto.");
  if ("category" in beat || "is_active" in beat) throw new Error("El prerender sólo acepta el snapshot sanitizado, no el dataset de origen.");
  const name = String(beat.name ?? "").trim();
  if (!name) throw new Error("Un beat del snapshot no tiene name.");
  if (!String(beat.slug ?? "").trim()) throw new Error(`El beat ${name} no tiene slug.`);
  const price = beat.price === null || beat.price === undefined || beat.price === "" ? null : Number(beat.price);
  const currency = String(beat.currency ?? "").trim();
  if (price !== null && (!Number.isFinite(price) || price < 0 || !currency)) throw new Error(`Precio/moneda inválidos para ${beat.slug}.`);
  return {
    slug: slugify(beat.slug), name,
    producer: String(beat.producer ?? "").trim(), artwork_url: cleanUrl(beat.artwork_url),
    genre: String(beat.genre ?? "").trim(), bpm: beat.bpm ?? null, key: String(beat.key ?? "").trim(),
    description: String(beat.description ?? "").trim(), price, currency,
  };
}

export function selectPublicBeats(dataset) {
  if (!Array.isArray(dataset) || dataset.length === 0) throw new Error("El snapshot SEO está vacío o no es un arreglo.");
  const selected = dataset.map(normalizedSnapshotBeat);
  const seen = new Set();
  for (const beat of selected) {
    if (seen.has(beat.slug)) throw new Error(`Slug duplicado después de normalizar: ${beat.slug}`);
    seen.add(beat.slug);
  }
  return selected.sort((a, b) => a.slug.localeCompare(b.slug));
}

function beatPage(beat, siteUrl, { noindex = false } = {}) {
  const canonical = beatUrl(siteUrl, beat.slug);
  const description = beat.description || `${beat.name}${beat.producer ? ` de ${beat.producer}` : ""} en Hidden Room Beat Store.`;
  const fields = [beat.producer && `<div><dt>Productor</dt><dd>${escapeHtml(beat.producer)}</dd></div>`, beat.genre && `<div><dt>Género</dt><dd>${escapeHtml(beat.genre)}</dd></div>`, beat.bpm !== null && beat.bpm !== "" && `<div><dt>BPM</dt><dd>${escapeHtml(beat.bpm)}</dd></div>`, beat.key && `<div><dt>Tonalidad</dt><dd>${escapeHtml(beat.key)}</dd></div>`, beat.price !== null && `<div><dt>Precio base publicado</dt><dd>${escapeHtml(beat.price)} ${escapeHtml(beat.currency)}</dd></div>`].filter(Boolean).join("\n");
  const productData = { "@context": "https://schema.org", "@type": "Product", name: beat.name, url: canonical, ...(beat.description ? { description: beat.description } : {}), ...(beat.artwork_url ? { image: [beat.artwork_url] } : {}), ...(beat.price !== null ? { offers: { "@type": "Offer", price: beat.price, priceCurrency: beat.currency, url: storeUrl(siteUrl, beat.slug) } } : {}) };
  const robots = noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow">';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${escapeHtml(beat.name)} | Hidden Room Beat Store</title><meta name="description" content="${escapeHtml(description)}"><link rel="canonical" href="${escapeHtml(canonical)}"><meta property="og:type" content="product"><meta property="og:title" content="${escapeHtml(beat.name)} | Hidden Room Beat Store"><meta property="og:description" content="${escapeHtml(description)}"><meta property="og:url" content="${escapeHtml(canonical)}">${beat.artwork_url ? `<meta property="og:image" content="${escapeHtml(beat.artwork_url)}">` : ""}<meta name="twitter:card" content="${beat.artwork_url ? "summary_large_image" : "summary"}"><meta name="twitter:title" content="${escapeHtml(beat.name)} | Hidden Room Beat Store"><meta name="twitter:description" content="${escapeHtml(description)}">${beat.artwork_url ? `<meta name="twitter:image" content="${escapeHtml(beat.artwork_url)}">` : ""}${robots}<link rel="stylesheet" href="/styles.css"><link rel="stylesheet" href="/store/beat_store/bs.css"><script type="application/ld+json">${escapeJson(productData)}</script></head><body class="store-page beat-seo-page" data-hr-chrome data-hr-context="store"><div id="hr-global-nav"></div><main><article class="hr-container hr-section beat-seo-card"><p class="eyebrow hr-eyebrow">Hidden Room Beat Store</p><h1>${escapeHtml(beat.name)}</h1>${beat.artwork_url ? `<img src="${escapeHtml(beat.artwork_url)}" alt="Portada de ${escapeHtml(beat.name)}" loading="lazy">` : ""}${beat.description ? `<p>${escapeHtml(beat.description)}</p>` : ""}${fields ? `<dl>${fields}</dl>` : ""}<p><a class="primary-button" href="${escapeHtml(storeUrl(siteUrl, beat.slug))}">Ver licencias y comprar en Beat Store</a></p></article></main><script src="/site.js"></script></body></html>`;
}

function beatsIndex(beats, siteUrl, { noindex = false } = {}) {
  const robots = noindex ? '<meta name="robots" content="noindex, follow">' : '<meta name="robots" content="index, follow">';
  return `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Beats | Hidden Room Beat Store</title><meta name="description" content="Beats públicos de Hidden Room Beat Store."><link rel="canonical" href="${escapeHtml(`${baseUrl(siteUrl)}/beats/`)}">${robots}<link rel="stylesheet" href="/styles.css"></head><body class="store-page"><main class="hr-container hr-section"><h1>Beats</h1><nav aria-label="Beats públicos"><ul>${beats.map((beat) => `<li><a href="/beats/${escapeHtml(beat.slug)}/">${escapeHtml(beat.name)}</a></li>`).join("")}</ul></nav></main></body></html>`;
}

export async function buildStoreSeo({ input = DEFAULT_INPUT, output = DEFAULT_OUTPUT, siteUrl = DEFAULT_SITE_URL, noindex = false } = {}) {
  const beats = selectPublicBeats(JSON.parse(await fs.readFile(input, "utf8")));
  const root = path.resolve(output);
  await fs.rm(root, { recursive: true, force: true });
  await fs.mkdir(path.join(root, "beats"), { recursive: true });
  await fs.writeFile(path.join(root, "beats", "index.html"), beatsIndex(beats, siteUrl, { noindex }), "utf8");
  for (const beat of beats) { const dir = path.join(root, "beats", beat.slug); await fs.mkdir(dir, { recursive: true }); await fs.writeFile(path.join(dir, "index.html"), beatPage(beat, siteUrl, { noindex }), "utf8"); }
  const urls = [...PUBLIC_SITE_ROUTES.map((route) => `${baseUrl(siteUrl)}${route}`), `${baseUrl(siteUrl)}/beats/`, ...beats.map((beat) => beatUrl(siteUrl, beat.slug))];
  await fs.writeFile(path.join(root, "sitemap.xml"), `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map((url) => `<url><loc>${escapeHtml(url)}</loc></url>`).join("")}</urlset>\n`, "utf8");
  await fs.writeFile(path.join(root, "robots.txt"), `User-agent: *\nAllow: /store/beat_store/\nAllow: /beats/\nSitemap: ${baseUrl(siteUrl)}/sitemap.xml\n`, "utf8");
  return { output: root, beats: beats.map((beat) => beat.slug), files: beats.length + 4 };
}

function cliArgs(argv) { const args = { input: DEFAULT_INPUT, output: DEFAULT_OUTPUT, siteUrl: DEFAULT_SITE_URL, noindex: false }; for (let i = 0; i < argv.length; i += 1) { if (argv[i] === "--input") args.input = argv[++i]; else if (argv[i] === "--output") args.output = argv[++i]; else if (argv[i] === "--site-url") args.siteUrl = argv[++i]; else if (argv[i] === "--noindex") args.noindex = true; else if (argv[i] === "--help") return null; else throw new Error(`Argumento desconocido: ${argv[i]}`); } return args; }
if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) { try { const args = cliArgs(process.argv.slice(2)); if (!args) { console.log("Uso: node scripts/build-store-seo.mjs [--input snapshot.json] [--output carpeta] [--site-url URL] [--noindex]"); process.exit(0); } const result = await buildStoreSeo(args); console.log(`Beat SEO generado: ${result.beats.length} beats en ${result.output}`); } catch (error) { console.error(error.message); process.exitCode = 1; } }
