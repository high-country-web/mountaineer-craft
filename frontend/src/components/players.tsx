import { useState, type ReactNode } from "react";
import Head from "next/head";
import Image from "next/image";
import { Box, Button, Flex, Heading, Text } from "@chakra-ui/react";
import { LuUserRound } from "react-icons/lu";
import type { Player } from "@/lib/players";

export function PlayersLayout({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <Box
      as="main"
      bg="#090909"
      color="#f5f5f5"
      minH="70vh"
      fontFamily="Arial, Helvetica, sans-serif"
      css={{
        "& a": { textDecoration: "none" },
        "& a:focus-visible, & button:focus-visible, & input:focus-visible": {
          outline: "3px solid #ffcc00",
          outlineOffset: "4px",
        },
      }}
    >
      <Head>
        <title>{title} — Mountaineer Craft</title>
        <meta name="description" content={description} />
      </Head>
      <Box
        maxW="1280px"
        mx="auto"
        px={{ base: "16px", sm: "20px", md: "28px", lg: "48px" }}
        py={{ base: 8, md: 12 }}
      >
        {children}
      </Box>
    </Box>
  );
}

export function PlayerSkin({ player, large = false }: { player: Player; large?: boolean }) {
  const [failedSource, setFailedSource] = useState<string | null>(null);
  const src = `https://crafthead.net/armor/body/${encodeURIComponent(player.uuid)}`;
  return (
    <Flex
      h={large ? "360px" : "220px"}
      align="center"
      justify="center"
      bg="radial-gradient(ellipse at center, #ffcc0012, transparent 70%)"
      w="full"
    >
      {failedSource === src ? (
        <Flex direction="column" align="center" gap={3} color="#aaaaaa">
          <LuUserRound size={64} aria-hidden="true" />
          <Text fontSize="13px">Skin unavailable</Text>
        </Flex>
      ) : (
        <Image
          src={src}
          alt={`${player.name}’s Minecraft skin`}
          width={large ? 180 : 100}
          height={large ? 324 : 180}
          unoptimized
          onError={() => setFailedSource(src)}
          style={{
            objectFit: "contain",
            height: large ? 324 : 180,
            width: "auto",
            imageRendering: "pixelated",
          }}
        />
      )}
    </Flex>
  );
}

export function PlayersUnavailable({ href }: { href: string }) {
  return (
    <Box role="alert" p={{ base: 6, md: 9 }} border="1px solid #ffffff16" rounded="xl" bg="#151515">
      <Heading as="h2" fontSize="22px" mb={3}>
        Player information is taking a break.
      </Heading>
      <Text color="#aaaaaa" lineHeight="1.8" mb={5}>
        We couldn’t load the player information right now. Please try again in a moment.
      </Text>
      <Button asChild bg="#ffcc00" color="#090909" _hover={{ bg: "#ffdb4d" }}>
        <a href={href}>Try again</a>
      </Button>
    </Box>
  );
}
