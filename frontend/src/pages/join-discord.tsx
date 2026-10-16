import { useState } from "react";
import { useRouter } from "next/router";
import NextLink from "next/link";
import { Button, Link, Text } from "@chakra-ui/react";
import { FaDiscord } from "react-icons/fa";
import { LuRefreshCw } from "react-icons/lu";
import AccessScreen from "@/components/access-screen";
import { safeReturnTo } from "@/lib/auth";

export default function JoinDiscord() {
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  async function checkMembership() {
    setChecking(true);
    setMessage("");
    try {
      const response = await fetch("/api/auth/session", { cache: "no-store" });
      if (response.status === 401) { await router.replace(`/login?next=${encodeURIComponent(safeReturnTo(router.query.next))}`); return; }
      if (response.status === 403) { setMessage("We don’t see you in the server yet. Join with the same Discord account, then check again."); return; }
      if (!response.ok) throw new Error();
      const user = await response.json();
      if (user.in_guild !== true) throw new Error();
      await router.replace(safeReturnTo(router.query.next));
    } catch { setMessage("We couldn’t check Discord right now. Please try again in a moment."); }
    finally { setChecking(false); }
  }
  return (
    <AccessScreen title="Join the community to continue" description="You’re signed in, but your Discord account isn’t in the Mountaineer Craft server. Join us to unlock your profile and account features. You can still browse the rest of the site.">
      <Button asChild bg="#ffcc00" color="black" size="lg" _hover={{ bg: "#ffdb4d" }}><a href="https://links.mountaineercraft.net/discord" target="_blank" rel="noopener noreferrer"><FaDiscord />Join our Discord ↗</a></Button>
      <Button onClick={checkMembership} loading={checking} loadingText="Checking membership…" variant="outline" borderColor="#ffffff30" color="#f5f5f5" size="lg" _hover={{ bg: "#ffffff08" }}><LuRefreshCw />I’ve joined — check again</Button>
      <Text role="status" aria-live="polite" color="#cccccc" fontSize="15px" lineHeight="1.7">{message}</Text>
      <Link asChild color="#ffcc00" alignSelf="center" fontSize="15px"><NextLink href="/">Continue browsing</NextLink></Link>
      <Link asChild color="#aaaaaa" alignSelf="center" fontSize="14px"><NextLink href="/logout" prefetch={false}>Sign out or use a different account</NextLink></Link>
    </AccessScreen>
  );
}
