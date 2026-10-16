import { useRouter } from "next/router";
import { Button, Text } from "@chakra-ui/react";
import AccessScreen from "@/components/access-screen";
import { safeReturnTo } from "@/lib/auth";

export default function AccessUnavailable() {
  const router = useRouter();
  return <AccessScreen title="We couldn’t verify your access" description="Discord or our account service is temporarily unavailable. Your session hasn’t been cleared. Please try again in a moment."><Button asChild bg="#ffcc00" color="black" size="lg"><a href={safeReturnTo(router.query.next)}>Try again</a></Button><Text color="#999999" fontSize="14px">We’ll restore access once we can confirm your Discord membership.</Text></AccessScreen>;
}
