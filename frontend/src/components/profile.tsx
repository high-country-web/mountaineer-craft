import type { ReactNode } from "react";
import Head from "next/head";
import NextLink from "next/link";
import { Avatar, Badge, Box, Button, Card, Flex, Grid, Heading, Link, Text } from "@chakra-ui/react";
import { FaDiscord } from "react-icons/fa";
import { LuArrowLeft, LuArrowUpRight, LuBookOpen, LuLogOut, LuMap, LuUserRound } from "react-icons/lu";

export type ProfileUser = {
  id: string;
  username: string;
  email: string | null;
  avatar?: string | null;
};

const gold = "#ffcc00";
const border = "#ffffff16";

export function ProfileLayout({ children }: { children: ReactNode }) {
  return (
    <Box as="main" bg="#090909" color="#f5f5f5" minH="calc(100dvh - 94px)" fontFamily="Arial, Helvetica, sans-serif" css={{ "& a:focus-visible, & button:focus-visible": { outline: `3px solid ${gold}`, outlineOffset: "4px" } }}>
      <Head><title>Your Profile — Mountaineer Craft</title><meta name="robots" content="noindex, nofollow" /></Head>
      <Box maxW="1280px" mx="auto" px={{ base: "20px", md: "28px", lg: "48px" }} py={{ base: 8, md: 12 }}>
        <Link asChild color="#aaaaaa" fontSize="14px" mb={8} _hover={{ color: gold }}><NextLink href="/"><LuArrowLeft />Back to the server</NextLink></Link>
        <Text color={gold} fontSize="12px" fontWeight="700" letterSpacing="2px" mb={3}>YOUR CORNER OF MOUNTAINEER CRAFT</Text>
        <Heading as="h1" fontSize={{ base: "36px", md: "46px" }} fontWeight="600" lineHeight="1.2" mb={3}>Your profile</Heading>
        <Text color="#aaaaaa" fontSize="17px" lineHeight="1.7" mb={{ base: 7, md: 9 }}>Your account details and a few shortcuts back to the community.</Text>
        {children}
      </Box>
    </Box>
  );
}

export default function Profile({ user }: { user: ProfileUser }) {
  const details = [
    { label: "Discord username", value: user.username },
    { label: "Email address", value: user.email || "No email provided" },
    { label: "Discord user ID", value: user.id },
  ];

  return (
    <ProfileLayout>
      <Grid templateColumns={{ base: "1fr", lg: "320px minmax(0, 1fr)" }} gap={6} alignItems="start">
        <Card.Root bg="linear-gradient(155deg, #1c1c1c, #111111)" color="inherit" borderColor={border} rounded="xl" overflow="hidden">
          <Box h="5px" bg={gold} />
          <Card.Body p={{ base: 6, md: 8 }} alignItems="center" textAlign="center" gap={0}>
            <Avatar.Root size="2xl" w="96px" h="96px" border="1px solid #ffcc0050" bg="#ffcc0010" color={gold} mb={5}>
              <Avatar.Fallback name={user.username} />
              {user.avatar && <Avatar.Image src={`https://cdn.discordapp.com/avatars/${encodeURIComponent(user.id)}/${encodeURIComponent(user.avatar)}.png?size=256`} alt={`${user.username}’s Discord avatar`} />}
            </Avatar.Root>
            <Heading as="h2" fontSize="25px" lineHeight="1.3" overflowWrap="anywhere" maxW="full" mb={3}>{user.username}</Heading>
            <Badge bg="#ffcc0010" color={gold} px={3} py={1} rounded="full" fontSize="12px"><FaDiscord />Discord server member</Badge>
            <Text color="#aaaaaa" fontSize="14px" lineHeight="1.8" mt={5}>Good to have you here.<br />Your next adventure is waiting.</Text>
            <Box w="full" h="1px" bg={border} my={6} />
            <Button asChild variant="outline" borderColor="#ffffff25" color="#cccccc" w="full" fontSize="15px" _hover={{ bg: "#ffffff08", color: "white" }}><NextLink href="/logout"><LuLogOut />Sign out</NextLink></Button>
          </Card.Body>
        </Card.Root>

        <Box minW={0}>
          <Card.Root bg="#151515" color="inherit" borderColor={border} rounded="xl">
            <Card.Body p={{ base: 6, md: 8 }} gap={0}>
              <Flex align="center" gap={3} mb={2}><Box color={gold} fontSize="21px"><LuUserRound /></Box><Heading as="h2" fontSize="23px">Account details</Heading></Flex>
              <Text color="#aaaaaa" fontSize="15px" lineHeight="1.7" mb={6}>The information associated with your Discord sign-in.</Text>
              <Box as="dl">
                {details.map(({ label, value }, index) => (
                  <Grid key={label} templateColumns={{ base: "1fr", md: "165px minmax(0, 1fr)" }} gap={{ base: 2, md: 5 }} py={5} borderTop={index ? `1px solid ${border}` : undefined}>
                    <Text as="dt" color="#aaaaaa" fontSize="14px">{label}</Text>
                    <Text as="dd" fontSize="16px" lineHeight="1.6" overflowWrap="anywhere" fontFamily={label === "Discord user ID" ? "monospace" : undefined} userSelect="text">{value}</Text>
                  </Grid>
                ))}
              </Box>
            </Card.Body>
          </Card.Root>

          <Heading as="h2" fontSize="20px" mt={8} mb={4}>Stay connected</Heading>
          <Grid templateColumns={{ base: "1fr", md: "repeat(3, minmax(0, 1fr))" }} gap={3}>
            {[
              { label: "Server wiki", description: "Guides & commands", href: "/wiki", icon: LuBookOpen, external: false },
              { label: "Live map", description: "Explore the world", href: "https://links.mountaineercraft.net/map", icon: LuMap, external: true },
              { label: "Discord", description: "Meet the community", href: "https://links.mountaineercraft.net/discord", icon: FaDiscord, external: true },
            ].map(({ label, description, href, icon: ResourceIcon, external }) => (
              <Link asChild key={href} display="flex" flexDirection="column" alignItems="flex-start" gap={3} p={5} bg="#131313" border={`1px solid ${border}`} rounded="lg" color="inherit" textDecoration="none" _hover={{ borderColor: "#ffcc0060", bg: "#1a1a1a" }}>
                <NextLink href={href} target={external ? "_blank" : undefined} rel={external ? "noopener noreferrer" : undefined}>
                  <Flex w="full" align="center" justify="space-between" color={gold}><ResourceIcon size={20} /><LuArrowUpRight size={16} /></Flex>
                  <Box><Text fontSize="15px" fontWeight="600" mb={1}>{label}</Text><Text fontSize="13px" color="#aaaaaa" lineHeight="1.6">{description}</Text></Box>
                </NextLink>
              </Link>
            ))}
          </Grid>
        </Box>
      </Grid>
    </ProfileLayout>
  );
}
