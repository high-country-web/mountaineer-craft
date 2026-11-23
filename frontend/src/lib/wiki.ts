import path from "node:path";
import wikiSources from "@/generated/wiki.json";
import matter from "gray-matter";
import { remark } from "remark";
import html from "remark-html";

export type WikiArticle = {
  slug: string[];
  href: string;
  title: string;
  description: string;
  group: string;
  empty: boolean;
};

type MarkdownNode = {
  type: string;
  url?: string;
  value?: string;
  align?: ("left" | "right" | "center" | null)[];
  children?: MarkdownNode[];
};

function tableFromParagraph(node: MarkdownNode): MarkdownNode | null {
  if (node.type !== "paragraph" || node.children?.length !== 1) return null;
  const textNode = node.children[0];
  if (textNode.type !== "text" || !textNode.value?.includes("\n")) return null;

  const lines = textNode.value
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  if (
    lines.length < 2 ||
    !lines[0].includes("|") ||
    !/^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(lines[1])
  ) {
    return null;
  }

  const cells = (line: string) =>
    line
      .replace(/^\s*\|/, "")
      .replace(/\|\s*$/, "")
      .split(/(?<!\\)\|/)
      .map((cell) => cell.trim().replace(/\\\|/g, "|"));
  const headers = cells(lines[0]);
  const separators = cells(lines[1]);
  if (headers.length < 2 || separators.length !== headers.length) return null;

  const align = separators.map((separator) => {
    const left = separator.startsWith(":");
    const right = separator.endsWith(":");
    return left && right ? "center" : left ? "left" : right ? "right" : null;
  });
  const row = (values: string[]): MarkdownNode => ({
    type: "tableRow",
    children: values.map((value) => ({
      type: "tableCell",
      children: [{ type: "text", value }],
    })),
  });

  return {
    type: "table",
    align,
    children: [row(headers), ...lines.slice(2).map((line) => row(cells(line)))],
  };
}

function humanize(value: string) {
  return value.replace(/[-_]/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

async function loadArticles() {
  const articles = wikiSources.map(({ slug, source }) => {
    const { data, content } = matter(source);
    const heading = content.match(/^#\s+(.+)\r?$/m)?.[1]?.trim();
    const title = typeof data.title === "string" ? data.title : humanize(slug[slug.length - 1]);
    // The page supplies the article heading, so avoid repeating the Markdown H1.
    const body = content.replace(/^\s*#\s+[^\n]+\n?/, "").trim();
    return {
      slug,
      href: "/wiki/" + slug.map(encodeURIComponent).join("/"),
      title,
      description: typeof data.description === "string" ? data.description : heading || "",
      group: slug.length > 1 ? humanize(slug[0]) : "Essentials",
      empty: body.length === 0,
      body,
    };
  });
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
  const processor = remark()
    .use(() => (tree) => {
      const root = tree as unknown as { children: MarkdownNode[] };
      root.children = root.children.flatMap((node) => {
        const table = tableFromParagraph(node as MarkdownNode);
        return table ? [table] : [node];
      });
      function visit(node: { type?: string; url?: string; children?: MarkdownNode[] }) {
        if (node.type === "link" && node.url && !/^(?:[a-z][a-z\d+.-]*:|\/\/|#)/i.test(node.url)) {
          const match = node.url.match(/^([^?#]+)\.md([?#].*)?$/);
          if (match) {
            const target = path.posix.resolve("/wiki", ...slug.slice(0, -1), match[1]);
            if (target.startsWith("/wiki/")) node.url = target + (match[2] || "");
          }
        }
        node.children?.forEach(visit);
      }
      visit(root);
    })
    .use(html, { sanitize: true });
  return { ...article, html: String(await processor.process(body)) };
}
