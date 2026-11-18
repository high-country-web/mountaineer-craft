import { useState } from "react";
import NextLink from "next/link";
import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  Box,
  Button,
  Flex,
  Grid,
  Heading,
  Input,
  Link,
  NativeSelect,
  Text,
} from "@chakra-ui/react";
import { LuArrowRight } from "react-icons/lu";
import { PlayersLayout, PlayerSkin, PlayersUnavailable } from "@/components/players";
import { playerDate, playtime, sortPlayers, type Player, type PlayerSort } from "@/lib/players";
import { fetchPlayers } from "@/lib/players-server";

export const getServerSideProps: GetServerSideProps<{
  players: Player[];
  unavailable: boolean;
}> = async ({ res }) => {
  const { players, unavailable } = await fetchPlayers();
  res.setHeader("Cache-Control", "no-store");
  if (unavailable) res.statusCode = 503;
  return { props: { players, unavailable } };
};

export default function PlayersPage({
  players,
  unavailable,
}: InferGetServerSidePropsType<typeof getServerSideProps>) {
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(24);
  const [sort, setSort] = useState<PlayerSort>("recent");
  const filtered = sortPlayers(
    players.filter((player) => player.name.toLowerCase().includes(query.trim().toLowerCase())),
    sort,
  );
  return (
    <PlayersLayout
      title="Players"
      description="Meet the players of Mountaineer Craft. Browse Minecraft skins and explore player profiles and server activity."
    >
      <Text color="#ffcc00" fontSize="12px" fontWeight="700" letterSpacing="2px" mb={3}>
        THE PEOPLE BEHIND THE BLOCKS
      </Text>
      <Heading
        as="h1"
        fontFamily="Georgia, serif"
        fontWeight="400"
        fontSize={{ base: "38px", md: "52px" }}
        mb={4}
      >
        Our players.
      </Heading>
      <Text color="#aaaaaa" lineHeight="1.8" maxW="620px" mb={8}>
        Every adventure has a familiar face. Meet our community and select a player to see their
        time on Mountaineer Craft.
      </Text>
      {unavailable ? (
        <PlayersUnavailable href="/players" />
      ) : (
        <>
          <Flex
            direction={{ base: "column", md: "row" }}
            justify="space-between"
            align={{ base: "stretch", md: "center" }}
            gap={4}
            mb={6}
          >
            <Box maxW={{ md: "360px" }} w="full">
              <Text asChild display="block" fontSize="13px" color="#aaaaaa" mb={2}>
                <label htmlFor="player-search">Find a player</label>
              </Text>
              <Input
                id="player-search"
                type="search"
                placeholder="Search by Minecraft name…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setVisible(24);
                }}
                bg="#151515"
                borderColor="#ffffff25"
                color="inherit"
                size="lg"
              />
            </Box>
            <Box w={{ base: "full", md: "220px" }} flexShrink={0}>
              <Text asChild display="block" fontSize="13px" color="#aaaaaa" mb={2}>
                <label htmlFor="player-sort">Sort players</label>
              </Text>
              <NativeSelect.Root size="lg">
                <NativeSelect.Field
                  id="player-sort"
                  value={sort}
                  onChange={(event) => {
                    setSort(event.target.value as PlayerSort);
                    setVisible(24);
                  }}
                  bg="#151515"
                  borderColor="#ffffff25"
                  color="inherit"
                  css={{ "& option": { background: "#151515", color: "#f5f5f5" } }}
                >
                  <option value="recent">Recently active</option>
                  <option value="playtime">Most active playtime</option>
                  <option value="name">Name (A–Z)</option>
                </NativeSelect.Field>
                <NativeSelect.Indicator />
              </NativeSelect.Root>
            </Box>
            <Text role="status" aria-live="polite" color="#aaaaaa" fontSize="14px">
              {filtered.length.toLocaleString("en-US")}{" "}
              {filtered.length === 1 ? "player" : "players"}
              {query.trim() ? ` matching “${query.trim()}”` : " in our community"}
            </Text>
          </Flex>
          {filtered.length === 0 ? (
            <Box p={8} border="1px solid #ffffff16" bg="#151515" rounded="xl">
              <Heading as="h2" fontSize="22px" mb={3}>
                {players.length ? "No players found" : "The adventure is just beginning."}
              </Heading>
              <Text color="#aaaaaa">
                {players.length
                  ? "Try another Minecraft name."
                  : "Players will appear here after their first visit to the server."}
              </Text>
              {query && (
                <Button
                  mt={4}
                  variant="outline"
                  color="#ffcc00"
                  onClick={() => {
                    setQuery("");
                    setVisible(24);
                  }}
                >
                  Clear search
                </Button>
              )}
            </Box>
          ) : (
            <Grid
              templateColumns={{
                base: "1fr",
                sm: "repeat(2, minmax(0, 1fr))",
                md: "repeat(3, minmax(0, 1fr))",
                lg: "repeat(4, minmax(0, 1fr))",
              }}
              gap={5}
            >
              {filtered.slice(0, visible).map((player) => (
                <Link
                  asChild
                  key={player.uuid}
                  display="block"
                  minW={0}
                  color="inherit"
                  bg="#151515"
                  border="1px solid #ffffff16"
                  rounded="xl"
                  overflow="hidden"
                  _hover={{ borderColor: "#ffcc0080", bg: "#1c1c1c" }}
                >
                  <NextLink href={`/players/${player.uuid}`} prefetch={false}>
                    <PlayerSkin player={player} />
                    <Box p={5} borderTop="1px solid #ffffff0c">
                      <Heading as="h2" fontSize="20px" overflowWrap="anywhere" mb={3}>
                        {player.name}
                      </Heading>
                      <Text color="#aaaaaa" fontSize="13px" mb={2}>
                        {playtime(player.active_playtime)} active playtime
                      </Text>
                      <Text color="#aaaaaa" fontSize="12px">
                        Last seen: {playerDate(player.last_seen)}
                      </Text>
                      <Flex
                        color="#ffcc00"
                        fontSize="13px"
                        fontWeight="600"
                        align="center"
                        gap={2}
                        mt={5}
                      >
                        View profile <LuArrowRight />
                      </Flex>
                    </Box>
                  </NextLink>
                </Link>
              ))}
            </Grid>
          )}
          {filtered.length > visible && (
            <Flex justify="center" mt={8}>
              <Button
                variant="outline"
                color="#ffcc00"
                borderColor="#ffffff30"
                onClick={() => setVisible((count) => count + 24)}
              >
                Show more players
              </Button>
            </Flex>
          )}
        </>
      )}
    </PlayersLayout>
  );
}
