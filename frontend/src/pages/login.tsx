import { useRouter } from "next/router";
import { Button, Text } from "@chakra-ui/react";
import { FaDiscord } from "react-icons/fa";
import AccessScreen from "@/components/access-screen";
import { safeReturnTo } from "@/lib/auth";
import NextLink from "next/link";

export default function Login() {
  const router = useRouter();
  const next = safeReturnTo(router.query.next);
  return (
    <AccessScreen title="Your community starts here" description="Sign in with Discord to view your profile. Discord server membership is required for account features; you can browse the rest of the site without signing in.">
      <Button asChild bg="#ffcc00" color="black" size="lg" _hover={{ bg: "#ffdb4d" }}><a href={`/api/auth/login?next=${encodeURIComponent(next)}`}><FaDiscord />Sign in with Discord</a></Button>
      <Button asChild variant="outline" borderColor="#ffffff25" color="#f5f5f5" size="lg" _hover={{ bg: "#ffffff08" }}><a href="https://links.mountaineercraft.net/discord" target="_blank" rel="noopener noreferrer">Join our Discord ↗</a></Button>
      <Button asChild variant="plain" color="#cccccc"><NextLink href="/">Continue browsing</NextLink></Button>
      <Text color="#999999" fontSize="13px" lineHeight="1.7" textAlign="center">Use the same Discord account you use in our server.</Text>
    </AccessScreen>
  );
}
