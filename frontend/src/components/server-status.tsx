import { useEffect, useState } from "react";
import { Box, Flex, Text } from "@chakra-ui/react";
import { isServerStatus, type ServerStatus } from "@/lib/server-status";

export default function ServerActivity() {
  const [status, setStatus] = useState<ServerStatus | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let disposed = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function refresh() {
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch("/api/server/status", { signal: controller.signal, cache: "no-store" });
        const data: unknown = await response.json();
        if (!response.ok || !isServerStatus(data)) throw new Error("Unavailable");
        if (!disposed) setStatus(data);
      } catch {
        if (!disposed) setStatus(null);
      } finally {
        clearTimeout(timeout);
        if (!disposed) { setLoading(false); timer = setTimeout(refresh, 30000); }
      }
    }
    void refresh();
    return () => { disposed = true; clearTimeout(timer); controller?.abort(); };
  }, []);

  return (
    <Flex role="status" aria-live="polite" align="center" gap="12px" bg="#151515" border="1px solid #ffffff16" borderRadius="8px" px="20px" py="15px" flexShrink={0}>
      <Box aria-hidden="true" w="8px" h="8px" rounded="full" bg={status ? "#ffcc00" : "#888888"} />
      <Box>
        <Text fontSize="16px" fontWeight="600" color="#f5f5f5">
          {loading ? "Checking server activity…" : status ? status.players_online === 0 ? "No players online" : `${status.players_online} ${status.players_online === 1 ? "player" : "players"} online` : "Server status unavailable"}
        </Text>
        <Text fontSize="13px" color="#aaaaaa" mt="3px">
          {status ? "Live activity · Refreshes every 30 seconds" : loading ? "Fetching the latest player count" : "We’ll check again shortly"}
        </Text>
      </Box>
    </Flex>
  );
}
