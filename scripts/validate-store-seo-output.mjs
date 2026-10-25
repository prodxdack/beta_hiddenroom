#!/usr/bin/env node

import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const DEFAULT_OUTPUT = ".store-seo-preview";
const DEFAULT_SITE_URL = "https://hiddenroom.mx";

function args(argv) {
  const result = { output: DEFAULT_OUTPUT, siteUrl: DEFAULT_SITE_URL, noindex: false };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === "--output") result.output = argv[++i];
    else if (argv[i] === "--site-url") result.siteUrl = argv[++i];
    else if (argv[i] === "--noindex") result.noindex = true;
    else if (argv[i] === "--help") return null;
    else throw new Error(`Argumento desconocido: ${argv[i]}`);
  }
  return result;
}

const read = (file) => fs.readFile(file, "utf8");
const baseUrl = (siteUrl) => siteUrl.replace(/\/$/, "");

export async function validateStoreSeoOutput({ output = DEFAULT_OUTPUT, siteUrl = DEFAULT_SITE_URL, noindex = false } = {}) {
  const root = path.resolve(output);
  const beatsRoot = path.join(root, "beats");
  const [index, sitemap, robots] = await Promise.all([read(path.join(beatsRoot, "index.html")), read(path.join(root, "sitemap.xml")), read(path.join(root, "robots.txt"))]);
  const entries = await fs.readdir(beatsRoot, { withFileTypes: true });
  const slugs = entries.filter((entry) => entry.isDirectory()).map((entry) => entry.name).sort();
  if (!slugs.length) throw new Error("El output SEO no contiene páginas de beats.");
  if (!sitemap.includes("<urlset") || !robots.includes(`Sitemap: ${baseUrl(siteUrl)}/sitemap.xml`)) throw new Error("sitemap.xml o robots.txt inválido.");
  if (!index.includes("<title>") || !index.includes("/beats/")) throw new Error("El índice SEO no contiene metadata o enlaces de beats.");
  const pages = await Promise.all(slugs.map(async (slug) => ({ slug, html: await read(path.join(beatsRoot, slug, "index.html")) })));
  for (const { slug, html } of pages) {
    if (slug.includes("..") || slug.includes("/") || !html.includes("<title>") || !html.includes('rel="canonical"') || !html.includes('property="og:title"') || !html.includes("<h1>") || !html.includes("/store/beat_store/")) throw new Error(`Página SEO inválida: ${slug}`);
    if (noindex && !/<meta[^>]+name="robots"[^>]+content="noindex, follow"/i.test(html)) throw new Error(`Falta noindex, follow en página Beta: ${slug}`);
    if (/\b(?:is_active|category|user_id|producer_user_id|email|phone|payment_token|service_role)\b/i.test(html)) throw new Error(`Campo sensible o administrativo en HTML: ${slug}`);
    if (!sitemap.includes(`${baseUrl(siteUrl)}/beats/${slug}/`)) throw new Error(`Falta ${slug} en sitemap.xml.`);
  }
  return { output: root, pages: slugs.length };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replaceAll("\\", "/")}`).href) {
  try {
    const options = args(process.argv.slice(2));
    if (!options) { console.log("Uso: node scripts/validate-store-seo-output.mjs [--output carpeta] [--site-url URL] [--noindex]"); process.exit(0); }
    const result = await validateStoreSeoOutput(options);
    console.log(`Output SEO validado: ${result.pages} páginas en ${result.output}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
