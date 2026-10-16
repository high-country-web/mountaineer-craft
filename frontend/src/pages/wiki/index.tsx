import { Badge, Box, Grid, Heading, Link, Text } from "@chakra-ui/react";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import Head from "next/head";
import NextLink from "next/link";
import { LuArrowRight } from "react-icons/lu";
import WikiLayout from "@/components/wiki/layout";
import { getWikiArticles } from "@/lib/wiki";
import type { WikiArticle } from "@/lib/wiki";

export const getServerSideProps: GetServerSideProps<{ articles: WikiArticle[] }> = async ({ res }) => {
  res.setHeader("Cache-Control", "private, no-store");
  return { props: { articles: await getWikiArticles() } };
};

export default function WikiIndex({ articles }: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return (
    <WikiLayout articles={articles}>
      <Head><title>Wiki — Mountaineer Craft</title><meta name="description" content="Guides, server rules, and useful commands for the Mountaineer Craft community." /></Head>
      <Text color="#ffcc00" fontSize="12px" letterSpacing="2px" fontWeight="700" mb={3}>THE SERVER HANDBOOK</Text>
      <Heading as="h1" fontSize={{ base: "36px", md: "48px" }} fontWeight="600" mb={4}>Mountaineer Craft Wiki</Heading>
      <Text color="#aaaaaa" fontSize="18px" lineHeight="1.8" maxW="650px" mb={9}>Find your first steps, useful commands, and guides to making the most of your time on the server.</Text>
      <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap={5}>
        {articles.map((article) => (
          <Link asChild key={article.href} display="block" p={6} border="1px solid #ffffff16" borderRadius="8px" bg="#151515" color="inherit" textDecoration="none" _hover={{ borderColor: "#ffcc0070", bg: "#1b1b1b" }}>
            <NextLink href={article.href}>
              <Text fontSize="12px" color="#aaaaaa" mb={3}>{article.group}</Text>
              <Heading as="h2" fontSize="22px" mb={3}>{article.title}</Heading>
              <Text fontSize="15px" lineHeight="1.7" color="#aaaaaa" mb={5}>{article.description || (article.empty ? "This article is awaiting content." : "Read this article in the server wiki.")}</Text>
              <Box display="flex" alignItems="center" justifyContent="space-between" gap={3} color="#ffcc00" fontSize="14px">{article.empty ? <Badge bg="#ffcc0015" color="#ffcc00">Coming soon</Badge> : "Read article"}<LuArrowRight /></Box>
            </NextLink>
          </Link>
        ))}
      </Grid>
    </WikiLayout>
  );
}
