import Head from "next/head";
import NextLink from "next/link";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { Box, Heading, Link, Text } from "@chakra-ui/react";
import type { SystemStyleObject } from "@chakra-ui/react";
import { LuPencil } from "react-icons/lu";
import WikiLayout from "@/components/wiki/layout";
import { getWikiArticle, getWikiArticles } from "@/lib/wiki";
import type { WikiArticle } from "@/lib/wiki";

const articleStyles: SystemStyleObject = {
  fontSize: { base: "15px", sm: "16px", md: "17px" },
  lineHeight: "1.85",
  color: "#d0d0d0",
  overflowWrap: "anywhere",
  "& p, & ul, & ol, & pre, & blockquote": { mb: "1.1em" },
  "& h2, & h3, & h4, & h5, & h6": {
    color: "#f5f5f5",
    fontWeight: "600",
    lineHeight: "1.35",
    mt: "1.6em",
    mb: ".6em",
  },
  "& h2": { fontSize: { base: "24px", md: "28px" } },
  "& h3": { fontSize: { base: "20px", md: "23px" } },
  "& ul": { listStyleType: "disc", pl: "1.5em" },
  "& ol": { listStyleType: "decimal", pl: "1.5em" },
  "& li + li": { mt: ".4em" },
  "& a": { color: "#ffcc00", textDecoration: "underline", textUnderlineOffset: "3px" },
  "& code": {
    bg: "#ffffff0b",
    color: "#ffcc00",
    px: ".35em",
    py: ".15em",
    borderRadius: "4px",
    fontSize: ".9em",
  },
  "& pre": {
    bg: "#151515",
    border: "1px solid #ffffff16",
    p: { base: "14px", sm: "20px" },
    borderRadius: "8px",
    overflowX: "auto",
  },
  "& pre code": { bg: "transparent", p: 0 },
  "& blockquote": { borderLeft: "3px solid #ffcc00", pl: "20px", color: "#aaaaaa" },
  "& hr": { borderColor: "#ffffff20", my: "32px" },
  "& img": { maxW: "full", h: "auto", borderRadius: "6px" },
  "& table": {
    width: "full",
    borderCollapse: "collapse",
    my: "1.5em",
    fontSize: "15px",
  },
  "& th, & td": {
    border: "1px solid #ffffff24",
    px: { base: 3, sm: 4 },
    py: 2,
    textAlign: "left",
    verticalAlign: "top",
  },
  "& th": { bg: "#ffffff0b", color: "#f5f5f5", fontWeight: "600" },
  "& tr:nth-of-type(even) td": { bg: "#ffffff04" },
};

type Props = {
  article: NonNullable<Awaited<ReturnType<typeof getWikiArticle>>>;
  articles: WikiArticle[];
};

export const getServerSideProps: GetServerSideProps<Props> = async ({ params, res }) => {
  res.setHeader("Cache-Control", "private, no-store");
  if (!Array.isArray(params?.slug)) return { notFound: true };
  const article = await getWikiArticle(params.slug);
  if (!article) return { notFound: true };
  return { props: { article, articles: await getWikiArticles() } };
};

export default function WikiArticlePage({
  article,
  articles,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <WikiLayout articles={articles} currentHref={article.href}>
      <Head>
        <title>{article.title} — Mountaineer Craft Wiki</title>
        <meta
          name="description"
          content={article.description || `${article.title} in the Mountaineer Craft server wiki.`}
        />
      </Head>
      <Link asChild color="#aaaaaa" fontSize="14px" mb={5}>
        <NextLink href="/wiki">Wiki / {article.group}</NextLink>
      </Link>
      <Heading
        as="h1"
        fontSize={{ base: "34px", md: "44px" }}
        fontWeight="600"
        lineHeight="1.2"
        mb={4}
      >
        {article.title}
      </Heading>
      <Link
        href={`https://github.com/high-country-web/mountaineer-craft/edit/main/wiki/${article.slug
          .map(encodeURIComponent)
          .join("/")}.md`}
        target="_blank"
        rel="noopener noreferrer"
        display="inline-flex"
        alignItems="center"
        gap={2}
        color="#ffcc00"
        fontSize="14px"
        mb={6}
        _hover={{ color: "#ffe066" }}
      >
        <LuPencil aria-hidden="true" />
        Edit this page on GitHub
      </Link>
      {article.description && (
        <Text fontSize="18px" lineHeight="1.7" color="#aaaaaa" mb={8}>
          {article.description}
        </Text>
      )}
      <Box as="article" maxW="800px" css={articleStyles}>
        {article.empty ? (
          <Text>
            This article is awaiting content. Need a hand?{" "}
            <Link
              href="https://links.mountaineercraft.net/discord"
              target="_blank"
              rel="noopener noreferrer"
            >
              Ask the community on Discord.
            </Link>
          </Text>
        ) : (
          <Box dangerouslySetInnerHTML={{ __html: article.html }} />
        )}
      </Box>
    </WikiLayout>
  );
}
