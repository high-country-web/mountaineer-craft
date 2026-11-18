import NextLink from "next/link";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { Badge, Box, Flex, Grid, Heading, Link, Text } from "@chakra-ui/react";
import { LuArrowLeft } from "react-icons/lu";
import { PlayersLayout, PlayerSkin, PlayersUnavailable } from "@/components/players";
import { isPlayerSlug, playerDate, playtime, type Player } from "@/lib/players";
import { fetchPlayers } from "@/lib/players-server";

export const getServerSideProps: GetServerSideProps<{
  player: Player | null;
  slug: string;
}> = async ({ params, res }) => {
  const slug = params?.slug;
  if (typeof slug !== "string" || !isPlayerSlug(slug)) return { notFound: true };
  const result = await fetchPlayers(slug);
  res.setHeader("Cache-Control", "no-store");
  if (result.notFound) return { notFound: true };
  if (result.unavailable) res.statusCode = 503;
  return { props: { player: result.players[0] ?? null, slug } };
};

export default function PlayerPage({
  player,
  slug,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const stats = player
    ? [
        { label: "Active playtime", value: playtime(player.active_playtime) },
        { label: "Sessions", value: player.sessions?.toLocaleString("en-US") ?? "Not available" },
        { label: "Deaths", value: player.deaths?.toLocaleString("en-US") ?? "Not available" },
        {
          label: "Mobs defeated",
          value: player.mob_kills?.toLocaleString("en-US") ?? "Not available",
        },
        {
          label: "Player kills",
          value: player.player_kills?.toLocaleString("en-US") ?? "Not available",
        },
      ]
    : [];
  return (
    <PlayersLayout
      title={player ? `${player.name}’s profile` : "Player profile"}
      description={
        player
          ? `Explore ${player.name}’s Minecraft skin and activity on Mountaineer Craft.`
          : "Player profiles on Mountaineer Craft."
      }
    >
      <Link asChild color="#aaaaaa" fontSize="14px" mb={8} _hover={{ color: "#ffcc00" }}>
        <NextLink href="/players">
          <LuArrowLeft />
          All players
        </NextLink>
      </Link>
      {!player ? (
        <PlayersUnavailable href={`/players/${slug}`} />
      ) : (
        <>
          <Text color="#ffcc00" fontSize="12px" fontWeight="700" letterSpacing="2px" mb={3}>
            PLAYER PROFILE
          </Text>
          <Heading
            as="h1"
            fontFamily="Georgia, serif"
            fontWeight="400"
            fontSize={{ base: "36px", md: "48px" }}
            overflowWrap="anywhere"
            mb={8}
          >
            {player.name}
          </Heading>
          <Grid
            templateColumns={{ base: "1fr", lg: "300px minmax(0, 1fr)" }}
            gap={6}
            alignItems="start"
          >
            <Box border="1px solid #ffffff16" bg="#151515" rounded="xl" overflow="hidden">
              <Box h="4px" bg="#ffcc00" />
              <PlayerSkin player={player} large />
              <Box px={6} pb={6} textAlign="center">
                <Badge
                  bg={player.online ? "#173426" : "#ffffff10"}
                  color={player.online ? "#86efac" : "#cccccc"}
                  px={3}
                  py={1}
                  rounded="full"
                >
                  {player.online === undefined
                    ? "Status unavailable"
                    : player.online
                      ? "Online now"
                      : "Offline"}
                </Badge>
              </Box>
            </Box>
            <Box minW={0}>
              <Heading as="h2" fontSize="23px" mb={4}>
                On the server
              </Heading>
              <Grid
                as="dl"
                templateColumns={{ base: "1fr", sm: "repeat(2, minmax(0, 1fr))" }}
                gap={4}
                mb={6}
              >
                {stats.map(({ label, value }) => (
                  <Box key={label} p={6} bg="#151515" border="1px solid #ffffff16" rounded="xl">
                    <Text as="dt" color="#aaaaaa" fontSize="13px" mb={3}>
                      {label}
                    </Text>
                    <Text as="dd" color="#ffcc00" fontSize="25px" fontWeight="600">
                      {value}
                    </Text>
                  </Box>
                ))}
              </Grid>
              <Box
                as="dl"
                p={{ base: 5, md: 7 }}
                bg="#151515"
                border="1px solid #ffffff16"
                rounded="xl"
              >
                {[
                  { label: "First joined", value: playerDate(player.registered) },
                  {
                    label: "Last seen (UTC)",
                    value: player.online ? "Playing now" : playerDate(player.last_seen),
                  },
                  { label: "Minecraft UUID", value: player.uuid },
                ].map(({ label, value }, i) => (
                  <Box
                    key={label}
                    pt={i ? 5 : 0}
                    mt={i ? 5 : 0}
                    borderTop={i ? "1px solid #ffffff16" : undefined}
                  >
                    <Text as="dt" fontSize="13px" color="#aaaaaa" mb={2}>
                      {label}
                    </Text>
                    <Text as="dd" fontSize="15px" overflowWrap="anywhere">
                      {value}
                    </Text>
                  </Box>
                ))}
              </Box>
              <Text color="#aaaaaa" fontSize="12px" lineHeight="1.7" mt={4}>
                Activity updates periodically. Dates are shown in UTC.
              </Text>
            </Box>
          </Grid>
        </>
      )}
    </PlayersLayout>
  );
}
