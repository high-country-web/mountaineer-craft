import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

const wikiDirectory = path.resolve(process.cwd(), "../wiki");

export type WikiArticle = {
  slug: string[];
  href: string;
  title: string;
  description: string;
  group: string;
  empty: boolean;
};

type MarkdownNode = { type: string; url?: string; children?: MarkdownNode[] };

function humanize(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function markdownFiles(directory: string, segments: string[] = []): Promise<string[][]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = await Promise.all(entries.map(async (entry) => {
    if (entry.name.startsWith(".")) return [];
    if (entry.isDirectory()) return markdownFiles(path.join(directory, entry.name), [...segments, entry.name]);
    return entry.isFile() && entry.name.endsWith(".md")
      ? [[...segments, entry.name.slice(0, -3)]] : [];
  }));
  return files.flat();
}

async function loadArticles() {
  const slugs = await markdownFiles(wikiDirectory);
  const articles = await Promise.all(slugs.map(async (slug) => {
    const source = await readFile(path.join(wikiDirectory, ...slug) + ".md", "utf8");
    const { data, content } = matter(source);
    const heading = content.match(/^#\s+(.+)\r?$/m)?.[1]?.trim();
    const title = typeof data.title === "string" ? data.title : humanize(slug[slug.length - 1]);
    // The page supplies the article heading, so avoid repeating the Markdown H1.
    const body = content.replace(/^\s*#\s+[^\n]+\n?/, "").trim();
    return {
      slug,
      href: "/wiki/" + slug.map(encodeURIComponent).join("/"),
      title,
      description: typeof data.description === "string" ? data.description : (heading || ""),
      group: slug.length > 1 ? humanize(slug[0]) : "Essentials",
      empty: body.length === 0,
      body,
    };
  }));
  return articles.sort((a, b) => {
    if (a.href === "/wiki/getting-started") return -1;
    if (b.href === "/wiki/getting-started") return 1;
    return a.title.localeCompare(b.title);
  });
}

export async function getWikiArticles(): Promise<WikiArticle[]> {
  return (await loadArticles()).map(({ body: _body, ...article }) => article);
}

export async function getWikiArticle(slug: string[]) {
  // Resolve only discovered articles rather than reading an arbitrary URL path.
  const found = (await loadArticles()).find((article) => article.slug.join("/") === slug.join("/"));
  if (!found) return null;
  const { body, ...article } = found;
  // Rewrite repository-relative Markdown links to their public wiki routes.
  const processor = remark().use(() => (tree) => {
    function visit(node: MarkdownNode) {
      if (node.type === "link" && node.url && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(node.url)) {
        const match = node.url.match(/^([^?#]+)\.md([?#].*)?$/);
        if (match) {
          const target = path.posix.resolve("/wiki", ...slug.slice(0, -1), match[1]);
          if (target.startsWith("/wiki/")) node.url = target + (match[2] || "");
        }
      }
      node.children?.forEach(visit);
    }
    visit(tree);
  }).use(html, { sanitize: true });
  return { ...article, html: String(await processor.process(body)) };
}
