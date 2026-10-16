import Image from "next/image";
import NextLink from "next/link";
import { useRouter } from "next/router";
import { Box, Button, Flex, Link, Text } from "@chakra-ui/react";
import { FaDiscord } from "react-icons/fa";
import { LuArrowRight, LuLogIn } from "react-icons/lu";
import { useSession } from "@/components/auth-provider";

export default function Navbar() {
  const { pathname } = useRouter();
  const { user } = useSession();
  const inWiki = pathname === "/wiki" || pathname.startsWith("/wiki/");

  return (
    <Box as="header" bg="#090909" color="#f5f5f5" fontFamily="Arial, Helvetica, sans-serif" borderBottom="1px solid #ffffff16" css={{ "& a": { textDecoration: "none" }, "& a:focus-visible": { outline: "3px solid #ffcc00", outlineOffset: "5px" } }}>
      <Flex w="full" maxW="1280px" mx="auto" px={{ base: "20px", md: "28px", lg: "48px" }} h={{ base: "80px", md: "94px" }} align="center" justify="space-between" gap="12px">
        <Link asChild gap={{ base: "8px", md: "12px" }} fontSize={{ base: "10px", md: "13px" }} fontWeight="800" letterSpacing={{ base: "1px", md: "2px" }} lineHeight="1.4" color="inherit">
          <NextLink href="/" aria-label="Mountaineer Craft home" aria-current={pathname === "/" ? "page" : undefined}>
            <Box flexShrink={0} w={{ base: "36px", md: "44px" }}><Image src="/server-icon.png" alt="" width={44} height={44} priority /></Box>
            <Box as="span">MOUNTAINEER<Text as="span" display="block" color="#ffcc00" fontSize={{ base: "9px", md: "11px" }} letterSpacing={{ base: "3.5px", md: "5px" }}>CRAFT</Text></Box>
          </NextLink>
        </Link>
        <Flex as="nav" aria-label="Main navigation" align="center" gap={{ base: "12px", md: "24px", lg: "32px" }} fontSize="13px" fontWeight="600">
          <Link asChild color={inWiki ? "#ffcc00" : "#cccccc"} _hover={{ color: "#ffcc00" }}><NextLink href="/wiki" aria-current={inWiki ? "page" : undefined}>Wiki</NextLink></Link>
          <Link href="https://links.mountaineercraft.net/map" target="_blank" rel="noopener noreferrer" display={{ base: "none", md: "inline-flex" }} color="#cccccc" _hover={{ color: "#ffcc00" }}>Live map <LuArrowRight /></Link>
          <Link href="https://links.mountaineercraft.net/discord" target="_blank" rel="noopener noreferrer" display={{ base: "none", md: "inline-flex" }} color="#cccccc" _hover={{ color: "#ffcc00" }}>Discord <FaDiscord /></Link>
          <Button asChild variant="outline" color="inherit" borderColor="#ffffff30" fontSize={{ base: "12px", md: "13px" }} px={{ base: "12px", md: "18px" }} _hover={{ bg: "#ffffff10" }}><NextLink href={user ? "/me" : "/login"}><LuLogIn />{user ? "My profile" : "Log in"}</NextLink></Button>
        </Flex>
      </Flex>
    </Box>
  );
}
