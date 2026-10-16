import type { ReactNode } from "react";
import Head from "next/head";
import { Box, Card, Flex, Heading, Text } from "@chakra-ui/react";
import { FaDiscord } from "react-icons/fa";

export default function AccessScreen({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <Flex as="main" minH="calc(100dvh - 94px)" bg="#090909" color="#f5f5f5" align="center" justify="center" px={5} py={12} fontFamily="Arial, Helvetica, sans-serif">
      <Head><title>{title} — Mountaineer Craft</title><meta name="robots" content="noindex, nofollow" /></Head>
      <Card.Root w="full" maxW="540px" bg="#151515" color="inherit" borderColor="#ffffff16" rounded="xl">
        <Card.Body p={{ base: 6, md: 10 }} gap={5}>
          <Box color="#ffcc00" fontSize="34px"><FaDiscord aria-hidden="true" /></Box>
          <Text color="#ffcc00" fontSize="12px" letterSpacing="2px" fontWeight="700">MOUNTAINEER CRAFT</Text>
          <Heading as="h1" fontSize={{ base: "30px", md: "36px" }} lineHeight="1.2">{title}</Heading>
          <Text color="#bbbbbb" fontSize="17px" lineHeight="1.8">{description}</Text>
          <Flex direction="column" align="stretch" gap={3} mt={2} css={{ "& a:focus-visible, & button:focus-visible": { outline: "3px solid #ffcc00", outlineOffset: "4px" } }}>{children}</Flex>
        </Card.Body>
      </Card.Root>
    </Flex>
  );
}
