import { useEffect, useState } from "react";
import Head from "next/head";
import { Box, Button, Flex, Grid, Heading, Spinner, Text } from "@chakra-ui/react";
import {
  LuActivity,
  LuArrowDownLeft,
  LuArrowUpRight,
  LuClock,
  LuCpu,
  LuHardDrive,
  LuMemoryStick,
  LuRefreshCw,
} from "react-icons/lu";
import {
  formatBytes,
  formatUptime,
  isServerStats,
  networkRate,
  type ServerStats,
} from "@/lib/server-stats";

const gold = "#ffcc00";
const panel = { bg: "#151515", border: "1px solid #ffffff16", rounded: "xl" };

function Trend({
  samples,
  metric,
  label,
  color,
}: {
  samples: ServerStats[];
  metric: "cpu_percent" | "memory_bytes";
  label: string;
  color: string;
}) {
  const readings = samples.map((sample) => ({
    x: Date.parse(sample.updated_at),
    y: sample[metric],
  }));
  const valid = readings.filter(
    (reading): reading is { x: number; y: number } => reading.y !== null,
  );
  const max = Math.max(1, ...valid.map((reading) => reading.y));
  const start = readings[0]?.x ?? 0;
  const span = Math.max(1, (readings.at(-1)?.x ?? 0) - start);
  const points = readings.map((reading) =>
    reading.y === null
      ? null
      : `${20 + ((reading.x - start) / span) * 560},${140 - (reading.y / max) * 110}`,
  );
  const segments: string[][] = [[]];
  points.forEach((point) => {
    if (point === null) segments.push([]);
    else segments[segments.length - 1].push(point);
  });
  const format = (value: number) =>
    metric === "cpu_percent" ? `${value.toFixed(1)}%` : formatBytes(value);
  return (
    <Box {...panel} p={{ base: 5, md: 7 }} minW={0}>
      <Flex align="center" justify="space-between" gap={3} mb={1}>
        <Heading as="h2" fontSize="18px">
          {label}
        </Heading>
        <Text color={color} fontSize="13px">
          {valid.length ? format(valid.at(-1)!.y) : "Unavailable"}
        </Text>
      </Flex>
      <Text color="#999999" fontSize="12px" mb={4}>
        Recent readings while this page is open
      </Text>
      {valid.length < 2 ? (
        <Flex
          minH="174px"
          align="center"
          justify="center"
          color="#999999"
          textAlign="center"
          fontSize="14px"
        >
          Waiting for two readings to draw the chart.
        </Flex>
      ) : (
        <>
          <Flex justify="space-between" color="#999999" fontSize="11px">
            <Text>{format(max)}</Text>
            <Text>Scale adjusts to readings</Text>
          </Flex>
          <svg
            viewBox="0 0 600 160"
            width="100%"
            role="img"
            aria-label={`${label}: ${valid.length} readings, latest ${format(valid.at(-1)!.y)}`}
          >
            {[30, 85, 140].map((y) => (
              <line key={y} x1="20" x2="580" y1={y} y2={y} stroke="#ffffff12" />
            ))}
            {segments
              .filter((segment) => segment.length > 1)
              .map((segment, index) => (
                <polyline
                  key={index}
                  points={segment.join(" ")}
                  fill="none"
                  stroke={color}
                  strokeWidth="3"
                  strokeLinejoin="round"
                  strokeLinecap="round"
                />
              ))}
            {points.map(
              (point, index) =>
                point && (
                  <circle
                    key={index}
                    cx={point.split(",")[0]}
                    cy={point.split(",")[1]}
                    r="3"
                    fill={color}
                  />
                ),
            )}
          </svg>
          <Flex justify="space-between" color="#999999" fontSize="11px">
            <Text>
              {new Date(start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
            </Text>
            <Text>
              {new Date(readings.at(-1)!.x).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </Text>
          </Flex>
        </>
      )}
    </Box>
  );
}

export default function StatsPage() {
  const [samples, setSamples] = useState<ServerStats[]>([]);
  const [error, setError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refresh, setRefresh] = useState(0);
  useEffect(() => {
    let disposed = false;
    let busy = false;
    let timer: ReturnType<typeof setTimeout>;
    let controller: AbortController;
    async function load() {
      if (busy || disposed) return;
      if (document.hidden) {
        timer = setTimeout(load, 30000);
        return;
      }
      busy = true;
      setLoading(true);
      controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch("/api/server/stats", {
          cache: "no-store",
          signal: controller.signal,
        });
        const data: unknown = await response.json();
        if (!response.ok || !isServerStats(data)) throw new Error("Unavailable");
        if (!disposed) {
          setSamples((previous) =>
            previous.at(-1)?.updated_at === data.updated_at
              ? previous
              : [...previous, data].slice(-30),
          );
          setError(false);
        }
      } catch {
        if (!disposed) setError(true);
      } finally {
        clearTimeout(timeout);
        busy = false;
        if (!disposed) {
          setLoading(false);
          timer = setTimeout(load, 30000);
        }
      }
    }
    function onVisible() {
      if (!document.hidden) {
        clearTimeout(timer);
        void load();
      }
    }
    void load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      disposed = true;
      clearTimeout(timer);
      controller?.abort();
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [refresh]);

  const stats = samples.at(-1);
  const previous = samples.at(-2);
  const rx = networkRate(previous, stats, "network_rx_bytes");
  const tx = networkRate(previous, stats, "network_tx_bytes");
  const metric = (value: string) => (!stats ? (loading ? "Loading…" : "Unavailable") : value);
  const cards = [
    {
      label: "Current uptime",
      value: metric(formatUptime(stats?.uptime_ms ?? null)),
      note: "Time since the current server start",
      icon: LuClock,
    },
    {
      label: "Memory usage",
      value: metric(formatBytes(stats?.memory_bytes ?? null)),
      note: "Memory used by the server container",
      icon: LuMemoryStick,
    },
    {
      label: "CPU usage",
      value: metric(
        stats?.cpu_percent == null
          ? "Unavailable"
          : `${stats.cpu_percent.toLocaleString("en-US", { maximumFractionDigits: 1 })}%`,
      ),
      note: "100% represents one CPU core",
      icon: LuCpu,
    },
    {
      label: "Disk usage",
      value: metric(formatBytes(stats?.disk_bytes ?? null)),
      note: "Storage used by the Minecraft server",
      icon: LuHardDrive,
    },
    {
      label: "Network received",
      value: metric(formatBytes(stats?.network_rx_bytes ?? null)),
      note:
        rx === null
          ? "Average rate available after two running readings"
          : `${formatBytes(rx)}/s average since the previous reading`,
      icon: LuArrowDownLeft,
    },
    {
      label: "Network sent",
      value: metric(formatBytes(stats?.network_tx_bytes ?? null)),
      note:
        tx === null
          ? "Average rate available after two running readings"
          : `${formatBytes(tx)}/s average since the previous reading`,
      icon: LuArrowUpRight,
    },
  ];

  return (
    <Box
      as="main"
      bg="#090909"
      color="#f5f5f5"
      minH="calc(100dvh - 94px)"
      fontFamily="Arial, Helvetica, sans-serif"
    >
      <Head>
        <title>Server Stats - Mountaineer Craft</title>
        <meta
          name="description"
          content="Current Mountaineer Craft server uptime, memory, CPU, disk, and network activity."
        />
      </Head>
      <Box
        maxW="1280px"
        mx="auto"
        px={{ base: "16px", sm: "20px", md: "28px", lg: "48px" }}
        py={{ base: 8, md: 12 }}
      >
        <Text color={gold} fontSize="12px" fontWeight="700" letterSpacing="2px" mb={3}>
          BEHIND THE BLOCKS
        </Text>
        <Flex
          direction={{ base: "column", md: "row" }}
          justify="space-between"
          align={{ base: "start", md: "center" }}
          gap={5}
          mb={7}
        >
          <Box>
            <Heading
              as="h1"
              fontFamily="Georgia, serif"
              fontWeight="400"
              fontSize={{ base: "38px", md: "52px" }}
              mb={3}
            >
              Server stats.
            </Heading>
            <Text color="#aaaaaa" lineHeight="1.8" maxW="620px">
              A look at the resources powering our world. Current readings from the Minecraft
              server, refreshed every 30 seconds.
            </Text>
          </Box>
          <Button
            variant="outline"
            borderColor="#ffffff30"
            color={gold}
            disabled={loading}
            onClick={() => setRefresh((value) => value + 1)}
          >
            <LuRefreshCw />
            {loading ? "Updating…" : "Refresh stats"}
          </Button>
        </Flex>
        <Flex
          {...panel}
          p={5}
          align="center"
          justify="space-between"
          wrap="wrap"
          gap={3}
          mb={6}
          role="status"
          aria-live="polite"
        >
          <Flex align="center" gap={3}>
            <LuActivity
              color={error ? "#ffbd70" : stats?.state === "running" ? "#8de6a5" : gold}
              size={20}
            />
            <Text fontWeight="600" textTransform="capitalize">
              {stats
                ? `${error ? "Last known state: " : ""}${stats.state}`
                : loading
                  ? "Checking server"
                  : "Stats unavailable"}
            </Text>
            {loading && <Spinner size="xs" color={gold} />}
          </Flex>
          <Text color="#aaaaaa" fontSize="12px">
            {stats
              ? `Last reading: ${new Date(stats.updated_at).toLocaleString()}`
              : "Waiting for a server reading"}
          </Text>
        </Flex>
        {error && (
          <Box role="alert" p={5} mb={6} border="1px solid #ffbd7040" bg="#ffbd7009" rounded="lg">
            <Text color="#ffcf96">
              We couldn&apos;t retrieve the latest stats.{" "}
              {stats
                ? "The values below are from the last successful reading."
                : "Please try again shortly."}{" "}
              Updates retry automatically.
            </Text>
          </Box>
        )}
        <Grid
          templateColumns={{
            base: "1fr",
            sm: "repeat(2, minmax(0, 1fr))",
            lg: "repeat(3, minmax(0, 1fr))",
          }}
          gap={4}
          mb={6}
        >
          {cards.map(({ label, value, note, icon: Icon }) => (
            <Box key={label} {...panel} p={{ base: 5, md: 6 }} minW={0}>
              <Flex align="center" gap={3} color="#aaaaaa" mb={4}>
                <Icon color={gold} size={19} />
                <Heading as="h2" fontSize="14px" fontWeight="500">
                  {label}
                </Heading>
              </Flex>
              <Text
                fontSize={{ base: "25px", md: "29px" }}
                fontWeight="600"
                letterSpacing="-0.5px"
                overflowWrap="anywhere"
                mb={2}
              >
                {value}
              </Text>
              <Text color="#999999" fontSize="12px" lineHeight="1.7">
                {note}
              </Text>
            </Box>
          ))}
        </Grid>
        <Grid templateColumns={{ base: "1fr", md: "repeat(2, minmax(0, 1fr))" }} gap={4}>
          <Trend samples={samples} metric="memory_bytes" label="Memory over time" color={gold} />
          <Trend samples={samples} metric="cpu_percent" label="CPU over time" color="#8de6a5" />
        </Grid>
        <Text color="#888888" fontSize="12px" lineHeight="1.8" mt={6}>
          These readings describe the Minecraft server container. Network totals are cumulative
          counters and may reset when the container restarts. Charts keep the latest 30 readings in
          this tab; uptime is not a historical availability percentage.
        </Text>
      </Box>
    </Box>
  );
}
