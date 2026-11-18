import { useEffect, useState } from "react";
import NextLink from "next/link";
import { Box, Button, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import { LuArrowRight, LuPickaxe } from "react-icons/lu";
import { PlayerSkin } from "@/components/players";
import { playtime, type Player } from "@/lib/players";

type Account =
  | { status: "matched"; uuid: string; player: Player }
  | { status: "no_match" | "ambiguous" | "not_configured" | "unavailable" };

export default function MinecraftAccount({ discordId }: { discordId: string }) {
  const [account, setAccount] = useState<Account | null>(null);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    async function load() {
      try {
        const response = await fetch("/api/account/minecraft", {
          cache: "no-store",
          signal: controller.signal,
        });
        if (!response.ok) throw new Error("Account lookup unavailable");
        const data: Account = await response.json();
        if (!controller.signal.aborted) setAccount(data);
      } catch {
        if (!controller.signal.aborted) setAccount({ status: "unavailable" });
      }
    }
    void load();
    return () => controller.abort();
  }, [discordId, refresh]);

  return (
    <Box mb={6} p={{ base: 6, md: 8 }} bg="#151515" border="1px solid #ffffff16" rounded="xl">
      <Flex align="center" gap={3} mb={3}>
        <LuPickaxe color="#ffcc00" size={21} />
        <Heading as="h2" fontSize="23px">
          Your Minecraft account
        </Heading>
      </Flex>
      {!account ? (
        <Flex role="status" gap={3} align="center" color="#aaaaaa" py={4}>
          <Spinner size="sm" color="#ffcc00" />
          <Text>Finding your player profile…</Text>
        </Flex>
      ) : account.status === "matched" ? (
        <Flex direction={{ base: "column", sm: "row" }} gap={5} align="center">
          <Box w="120px" flexShrink={0}>
            <PlayerSkin player={account.player} />
          </Box>
          <Box minW={0} w="full">
            <Text color="#ffcc00" fontSize="12px" mb={2}>
              Suggested player profile
            </Text>
            <Heading as="h3" fontSize="24px" overflowWrap="anywhere" mb={3}>
              {account.player.name}
            </Heading>
            {account.player.active_playtime != null && (
              <Text color="#aaaaaa" mb={2}>
                {playtime(account.player.active_playtime)} active playtime
              </Text>
            )}
            <Text color="#aaaaaa" fontSize="12px" overflowWrap="anywhere">
              {account.uuid}
            </Text>
            <Text color="#aaaaaa" fontSize="13px" lineHeight="1.7" mt={3}>
              Matched to your Discord username in Plan. This is a suggestion, not a verified account
              link.
            </Text>
            <Button asChild mt={5} bg="#ffcc00" color="#090909" _hover={{ bg: "#ffdb4d" }}>
              <NextLink href={`/players/${account.uuid}`}>
                View player profile <LuArrowRight />
              </NextLink>
            </Button>
          </Box>
        </Flex>
      ) : (
        <>
          <Text color="#aaaaaa" lineHeight="1.8">
            {account.status === "no_match"
              ? "No player profile currently matches your Discord username in Plan. If you recently linked or renamed your account, Plan may need time to update. You can still find your profile in the player directory."
              : account.status === "ambiguous"
                ? "More than one player profile matches your Discord username. Choose your profile from the player directory."
                : account.status === "not_configured"
                  ? "Automatic Minecraft account lookup is coming soon. You can explore player profiles in the meantime."
                  : "We couldn’t check your Minecraft account right now. Your Discord sign-in is still active. Please try again in a moment."}
          </Text>
          <Flex wrap="wrap" gap={3} mt={5}>
            {account.status !== "not_configured" && (
              <Button
                variant="outline"
                color="#ffcc00"
                borderColor="#ffffff30"
                onClick={() => {
                  setAccount(null);
                  setRefresh((value) => value + 1);
                }}
              >
                Check again
              </Button>
            )}
            <Button asChild variant="outline" color="#cccccc" borderColor="#ffffff30">
              <NextLink href="/players">
                Browse players <LuArrowRight />
              </NextLink>
            </Button>
          </Flex>
        </>
      )}
    </Box>
  );
}
