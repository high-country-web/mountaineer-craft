import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const wikiRoot = fileURLToPath(new URL("../../wiki/", import.meta.url));
const destination = fileURLToPath(new URL("../src/generated/wiki.json", import.meta.url));

async function collect(directory, prefix = []) {
  const entries = (await readdir(directory, { withFileTypes: true })).sort((a, b) => a.name.localeCompare(b.name));
  const articles = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const filename = path.join(directory, entry.name);
    if (entry.isDirectory()) articles.push(...await collect(filename, [...prefix, entry.name]));
    else if (entry.isFile() && entry.name.endsWith(".md")) articles.push({ slug: [...prefix, entry.name.slice(0, -3)], source: await readFile(filename, "utf8") });
  }
  return articles;
}

const articles = await collect(wikiRoot);
await mkdir(path.dirname(destination), { recursive: true });
await writeFile(destination, JSON.stringify(articles, null, 2) + "\n");
console.log(`Bundled ${articles.length} wiki articles for the website.`);
