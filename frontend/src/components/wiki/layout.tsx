import type { ReactNode } from "react";
import NextLink from "next/link";
import { Box, Flex, Heading, Link, Text } from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import type { WikiArticle } from "@/lib/wiki";

export default function WikiLayout({ articles, currentHref, children }: {
  articles: WikiArticle[];
  currentHref?: string;
  children: ReactNode;
}) {
  const groups = [...new Set(articles.map((article) => article.group))];
  return (
    <Box bg="#090909" color="#f5f5f5" minH="100vh" fontFamily="Arial, Helvetica, sans-serif" css={{ "& a:focus-visible, & button:focus-visible": { outline: "3px solid #ffcc00", outlineOffset: "4px" } }}>
      <Link href="#wiki-content" position="fixed" top="-80px" left="20px" p={3} bg="#ffcc00" color="black" zIndex={20} _focus={{ top: "10px" }}>Skip to content</Link>
      <Flex maxW="1280px" mx="auto" px={{ base: 5, md: 10 }} py={{ base: 8, md: 12 }} gap={{ base: 8, lg: 14 }} direction={{ base: "column", lg: "row" }} align="flex-start">
        <Box as="aside" w={{ base: "full", lg: "230px" }} flexShrink={0}>
          <Link asChild color="#aaaaaa" fontSize="14px" mb={6}><NextLink href="/"><LuArrowLeft />Back to the server</NextLink></Link>
          <Heading as="h2" fontSize="20px" mb={5}>Server wiki</Heading>
          <Box as="nav" aria-label="Wiki articles">
            {groups.map((group) => (
              <Box key={group} mb={5}>
                <Text fontSize="12px" color="#aaaaaa" fontWeight="700" letterSpacing="1.5px" textTransform="uppercase" mb={2}>{group}</Text>
                <Flex direction="column" gap={1}>
                  {articles.filter((article) => article.group === group).map((article) => (
                    <Link asChild key={article.href} aria-current={currentHref === article.href ? "page" : undefined} color={currentHref === article.href ? "#ffcc00" : "#cccccc"} bg={currentHref === article.href ? "#ffcc000d" : "transparent"} borderLeft="2px solid" borderColor={currentHref === article.href ? "#ffcc00" : "transparent"} px={3} py={2} fontSize="15px" _hover={{ color: "#ffcc00", bg: "#ffffff08" }}><NextLink href={article.href}>{article.title}</NextLink></Link>
                  ))}
                </Flex>
              </Box>
            ))}
          </Box>
        </Box>
        <Box as="main" id="wiki-content" flex={1} minW={0} w="full">{children}</Box>
      </Flex>
    </Box>
  );
}
