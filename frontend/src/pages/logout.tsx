import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";
import { Button, Spinner, Text } from "@chakra-ui/react";
import AccessScreen from "@/components/access-screen";

export default function Logout() {
  const router = useRouter();
  const started = useRef(false);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    sessionStorage.removeItem("auth_token");
    sessionStorage.removeItem("user");
    sessionStorage.removeItem("discord_oauth_state");
    fetch("/api/auth/logout", { method: "POST" }).then((response) => {
      if (!response.ok) throw new Error();
      return router.replace("/login");
    }).catch(() => setFailed(true));
  }, [router]);
  return <AccessScreen title={failed ? "Sign-out didn’t finish" : "Signing you out"} description={failed ? "Please try again to end your session." : "We’re ending your Mountaineer Craft session."}>{failed ? <Button onClick={() => window.location.reload()} bg="#ffcc00" color="black">Try again</Button> : <><Spinner color="#ffcc00" /><Text role="status">Please wait…</Text></>}</AccessScreen>;
}
