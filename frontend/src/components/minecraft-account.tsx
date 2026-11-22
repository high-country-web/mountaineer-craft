import { useEffect, useState } from "react";
import NextLink from "next/link";
import { Box, Button, Flex, Heading, Spinner, Text } from "@chakra-ui/react";
import { LuArrowRight, LuPickaxe } from "react-icons/lu";
import { PlayerSkin } from "@/components/players";
import { playtime, type Player } from "@/lib/players";

type Account =
  | { status: "linked"; uuid: string; player: Player | null }
  | { status: "not_linked" | "not_configured" | "unavailable" };

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
      ) : account.status === "linked" ? (
        <Flex direction={{ base: "column", sm: "row" }} gap={5} align="center">
          {account.player && (
            <Box w="120px" flexShrink={0}>
              <PlayerSkin player={account.player} />
            </Box>
          )}
          <Box minW={0} w="full">
            <Text color="#ffcc00" fontSize="12px" mb={2}>
              Verified Minecraft account
            </Text>
            <Heading as="h3" fontSize="24px" overflowWrap="anywhere" mb={3}>
              {account.player?.name || "Minecraft account linked"}
            </Heading>
            {account.player?.active_playtime != null && (
              <Text color="#aaaaaa" mb={2}>
                {playtime(account.player.active_playtime)} active playtime
              </Text>
            )}
            <Text color="#aaaaaa" fontSize="12px" overflowWrap="anywhere">
              {account.uuid}
            </Text>
            <Text color="#aaaaaa" fontSize="13px" lineHeight="1.7" mt={3}>
              Linked to your Discord account through the Minecraft server’s verification process.
              {!account.player &&
                " Your player stats are currently unavailable. Check again shortly."}
            </Text>
            {account.player && (
              <Button asChild mt={5} bg="#ffcc00" color="#090909" _hover={{ bg: "#ffdb4d" }}>
                <NextLink href={`/players/${account.uuid}`}>
                  View player profile <LuArrowRight />
                </NextLink>
              </Button>
            )}
            <Button
              variant="outline"
              color="#ffcc00"
              borderColor="#ffffff30"
              mt={5}
              ml={account.player ? 3 : 0}
              onClick={() => {
                setAccount(null);
                setRefresh((value) => value + 1);
              }}
            >
              Check again
            </Button>
          </Box>
        </Flex>
      ) : (
        <>
          <Text color="#aaaaaa" lineHeight="1.8">
            {account.status === "not_linked"
              ? "No Minecraft account is linked to this Discord account yet. Connect to the Minecraft server and submit its verification code in Discord, then check again here. Make sure you sign in with the same Discord account you used to verify."
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
