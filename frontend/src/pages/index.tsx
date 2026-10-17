import Head from "next/head";
import ServerActivity from "@/components/server-status";
import { useEffect, useState } from "react";
import { LuArrowDown, LuArrowRight, LuChartNoAxesCombined, LuCheck, LuCopy, LuMap, LuPickaxe } from "react-icons/lu";
import { FaDiscord } from "react-icons/fa";
import { Box, Button, Card, Code, Flex, Grid, Heading, Link, Text } from "@chakra-ui/react";
import type { SystemStyleObject } from "@chakra-ui/react";

const JAVA_ADDRESS = "play.mountaineercraft.net";
const BEDROCK_ADDRESS = "bedrock.mountaineercraft.net";
const BEDROCK_PORT = "19132";

const gold = "#ffcc00";
const muted = "#aaaaaa";
const line = "#ffffff16";
const pageWidth = { w: "full", maxW: "1280px", mx: "auto", px: { base: "20px", md: "28px", lg: "48px" } } as const;
const sectionLabel = { display: "block", fontSize: "9px", letterSpacing: "2px", fontWeight: "700", color: gold, mb: "12px" } as const;
const sectionHeading = { fontFamily: "Georgia, 'Times New Roman', serif", fontSize: { base: "27px", md: "29px" }, fontWeight: "400", lineHeight: "1.25", letterSpacing: "-.5px" } as const;
const actionButton = { h: "auto", minW: { base: "222px", md: "auto" }, px: { base: "18px", md: "21px" }, py: { base: "14px", md: "16px" }, gap: "12px", fontSize: "13px", fontWeight: "700", borderRadius: "5px" } as const;
const pageStyles: SystemStyleObject = {
  "& a": { textDecoration: "none" },
  "& a:focus-visible, & button:focus-visible": { outline: `3px solid ${gold}`, outlineOffset: "5px" },
  "& a, & button": { WebkitTapHighlightColor: "transparent" },
  "@media (prefers-reduced-motion: reduce)": { "& *": { transition: "none !important" } },
};

const resources = [
  { href: "https://links.mountaineercraft.net/map", icon: LuMap, title: "The world, at a glance", description: "Find your bearings on our live server map." },
  { href: "https://links.mountaineercraft.net/discord", icon: FaDiscord, title: "Good company starts here", description: "Say hello and keep up with the community on Discord." },
  { href: "https://links.mountaineercraft.net/analytics", icon: LuChartNoAxesCombined, title: "A look behind the adventure", description: "Explore server activity on our analytics dashboard." },
];

export default function Home() {
  const [copied, setCopied] = useState<string | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(null), 2500);
    return () => window.clearTimeout(timer);
  }, [copied]);

  async function copyAddress(address: string) {
    try {
      await navigator.clipboard.writeText(address);
      setCopied(address);
      setCopyError(null);
    } catch {
      setCopyError("Couldn’t copy automatically. Select and copy the server address above.");
    }
  }

  return (
    <Box bg="#090909" color="#f5f5f5" fontFamily="Arial, Helvetica, sans-serif" minH="100vh" css={pageStyles}>
      <Head>
        <title>Mountaineer Craft — Your next adventure starts here</title>
        <meta name="description" content="Find your next adventure on Mountaineer Craft. Join our Minecraft community on Java or Bedrock, explore the live map, and connect on Discord." />
      </Head>
      <Link href="#main" position="fixed" top="-80px" left="20px" p="12px" bg={gold} color="#090909" zIndex={20} _focus={{ top: "10px" }}>Skip to content</Link>
      <Box as="main" id="main">
        <Flex as="section" aria-labelledby="hero-heading" minH={{ base: "610px", "2xl": "690px" }} align="center" borderBlock="1px solid" borderColor={line} bg="radial-gradient(ellipse at 80% 40%, #ffcc0009, transparent 60%), #090909">
          <Box {...pageWidth} pt={{ base: "62px", md: "80px" }} pb={{ base: "85px", md: "92px" }}>
            <Flex align="center" gap="9px" fontSize={{ base: "8px", md: "10px" }} letterSpacing={{ base: "1.6px", md: "2.3px" }} fontWeight="700" color={gold} mb="26px"><Box w="6px" h="6px" bg={gold} rounded="full" />YOUR NEXT CHAPTER STARTS HERE</Flex>
            <Heading as="h1" id="hero-heading" fontFamily="Georgia, 'Times New Roman', serif" fontSize={{ base: "47px", md: "clamp(46px, 5.2vw, 76px)" }} fontWeight="400" letterSpacing={{ base: "-1.8px", md: "-2.5px" }} lineHeight="1.08" mb="24px" maxW="760px" textWrap="balance">A little adventure.<br />A place to <Box as="em" color={gold}>belong.</Box></Heading>
            <Text fontSize={{ base: "14px", md: "16px" }} lineHeight="1.85" color="#c6c6c6" maxW="530px">Build something that’s yours. Explore what’s out there.<Box as="br" display={{ base: "none", md: "initial" }} /> Find your people on Mountaineer Craft.</Text>
            <Flex gap="12px" flexWrap="wrap" direction={{ base: "column", md: "row" }} align={{ base: "flex-start", md: "center" }} mt="32px" mb="25px">
              <Button asChild {...actionButton} bg={gold} color="#0a0a0a" _hover={{ bg: "#ffdb4d" }}><a href="#join"><LuPickaxe /> Join the server <LuArrowDown /></a></Button>
              <Button asChild {...actionButton} variant="outline" borderColor="#cccccc40" bg="#17171780" color="#f2f2f2" _hover={{ bg: "#282828" }}><a href="https://links.mountaineercraft.net/discord" target="_blank" rel="noopener noreferrer"><FaDiscord /> Meet the community</a></Button>
            </Flex>
            <Flex align="center" gap={{ base: "9px", md: "12px" }} fontSize={{ base: "9px", md: "11px" }} color="#b7b7b7"><Text fontSize={{ base: "8px", md: "9px" }} letterSpacing="1.3px" fontWeight="700">JAVA + BEDROCK</Text><Box h="12px" w="1px" bg="#aaaaaa55" />One community. Your way to play.</Flex>
          </Box>
        </Flex>
        <Box as="section" {...pageWidth} pt={{ base: "35px", md: "56px" }} id="join" aria-labelledby="join-heading" scrollMarginTop="24px">
          <Flex direction={{ base: "column", lg: "row" }} justify="space-between" align={{ base: "flex-start", lg: "flex-end" }} gap="24px" mb="27px">
            <Box><Text {...sectionLabel}>SEE YOU ON THE SERVER</Text><Heading as="h2" id="join-heading" {...sectionHeading}>Your adventure is one connection away.</Heading></Box>
            <ServerActivity />
          </Flex>
          <Grid templateColumns={{ base: "1fr", lg: "repeat(2, minmax(0, 1fr))" }} gap="18px">
            {[{ name: "Java Edition", description: "For Java players on PC, Mac & Linux", address: JAVA_ADDRESS, number: "01" }, { name: "Bedrock Edition", description: "For Bedrock players on PC & mobile", address: BEDROCK_ADDRESS, number: "02" }].map((server) => (
              <Card.Root key={server.name} p={{ base: "22px", lg: "25px" }} borderColor={line} borderRadius="8px" bg="linear-gradient(120deg, #1c1c1c, #131313)" color="inherit">
                <Flex justify="space-between" align="center" mb="22px" gap="12px"><Box><Heading as="h3" fontSize="21px" fontWeight="600" mb="6px">{server.name}</Heading><Text fontSize="14px" lineHeight="1.6" color={muted}>{server.description}</Text></Box><Text fontFamily="Georgia, serif" color="#aaaaaa44" fontSize="32px">{server.number}</Text></Flex>
                <Flex align="center" justify="space-between" flexWrap={{ base: "wrap", md: "nowrap" }} gap="12px" border="1px solid #ffffff0c" bg="#090909" rounded="5px" py="13px" px="14px">
                  <Code bg="transparent" p={0} fontSize={{ base: "14px", md: "16px" }} lineHeight="1.6" color={gold} overflowWrap="anywhere" userSelect="all" flexBasis={{ base: "100%", md: "auto" }}>{server.address}</Code>
                  <Button variant="plain" onClick={() => copyAddress(server.address)} aria-label={`Copy ${server.name} server address`} title="Copy server address" color="#d3d3d3" fontSize="14px" minH={{ base: "44px", md: "36px" }} h="auto" p="6px" flexShrink={0} ml={{ base: "auto", md: "0" }} gap="7px" _hover={{ color: gold }}>{copied === server.address ? <LuCheck /> : <LuCopy />}{copied === server.address ? "Copied!" : "Copy"}</Button>
                </Flex>
                <Flex wrap="wrap" align="center" gap="8px" color={muted} fontSize="13px" mt="15px" lineHeight="1.7" css={{ "& svg": { width: "13px" } }}>
                  {server.number === "01" ? <>Multiplayer <LuArrowRight /> Add Server <LuArrowRight /> You’re in.</> : <>Port <Text as="strong" fontWeight="400" color="#e2e2e2">{BEDROCK_PORT}</Text><Text as="span" flexBasis={{ base: "100%", md: "auto" }} ml={{ base: "0", md: "auto" }}>Console? Try <Link href="https://bedrocktogether.net/" target="_blank" rel="noopener noreferrer" color="#d8d8d8" css={{ textDecoration: "underline !important", textUnderlineOffset: "3px" }}>BedrockTogether ↗</Link></Text></>}
                </Flex>
              </Card.Root>
            ))}
          </Grid>
          <Text role="status" minH="18px" fontSize="12px" color={gold} mt="10px">{copyError || (copied ? "Server address copied. Ready to paste into Minecraft." : "")}</Text>
        </Box>
        <Grid as="section" {...pageWidth} aria-labelledby="explore-heading" templateColumns={{ base: "1fr", md: ".85fr 1.15fr" }} gap={{ base: "24px", md: "32px", lg: "70px" }} pt={{ base: "22px", md: "46px" }} pb={{ base: "40px", md: "64px" }}>
          <Box pt="18px"><Text {...sectionLabel}>BEYOND THE BLOCKS</Text><Heading as="h2" id="explore-heading" {...sectionHeading} fontSize={{ base: "32px", md: "36px" }} mb="14px">Stay connected.</Heading><Text color={muted} fontSize="13px" lineHeight="1.9" maxW={{ base: "full", md: "280px" }}>There’s more to explore, even when you’re away from the game.</Text></Box>
          <Box>
            {resources.map(({ href, icon: ResourceIcon, title, description }) => (
              <Link key={href} href={href} target="_blank" rel="noopener noreferrer" display="flex" alignItems="center" gap="18px" py="22px" borderBottom="1px solid" borderColor={line} color="inherit" _first={{ borderTop: `1px solid ${line}` }} _hover={{ color: gold }}>
                <Box color={gold} bg="#ffcc000a" border="1px solid #ffcc0015" rounded="7px" p="12px" fontSize="19px" flexShrink={0}><ResourceIcon /></Box>
                <Box><Heading as="h3" fontSize="14px" fontWeight="600" mb="6px">{title}</Heading><Text fontSize="11px" lineHeight="1.6" color={muted}>{description}</Text></Box><Box ml="auto" flexShrink={0} color={muted}><LuArrowRight /></Box>
              </Link>
            ))}
          </Box>
        </Grid>
      </Box>
    </Box>
  );
}
