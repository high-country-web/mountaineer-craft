import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import { API_BASE_URL, cookie, readCookie, RETURN_COOKIE, safeReturnTo, SESSION_COOKIE, STATE_COOKIE, validOAuthState } from "@/lib/auth-server";
import AccessScreen from "@/components/access-screen";
import { Button } from "@chakra-ui/react";
import NextLink from "next/link";
import { requiresMembership } from "@/lib/auth";

export const getServerSideProps: GetServerSideProps<{ failed: true }> = async ({ req, res, query }) => {
  res.setHeader("Cache-Control", "no-store");
  const expected = readCookie(req.headers.cookie, STATE_COOKIE);
  const returnTo = safeReturnTo(readCookie(req.headers.cookie, RETURN_COOKIE));
  const cleared = [cookie(STATE_COOKIE, "", 0), cookie(RETURN_COOKIE, "", 0)];
  res.setHeader("Set-Cookie", cleared);
  if (!validOAuthState(expected, query.state) || typeof query.code !== "string" || query.error) return { props: { failed: true } };
  try {
    const response = await fetch(`${API_BASE_URL}/auth/discord`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code: query.code }), cache: "no-store", signal: AbortSignal.timeout(30000) });
    if (!response.ok) return { props: { failed: true } };
    const session = await response.json();
    if (typeof session.token !== "string" || !session.token || typeof session.in_guild !== "boolean" || !Number.isFinite(session.expires_in) || session.expires_in <= 0) return { props: { failed: true } };
    res.setHeader("Set-Cookie", [...cleared, cookie(SESSION_COOKIE, session.token, Math.min(86400, Math.floor(session.expires_in)))]);
    return { redirect: { destination: session.in_guild || !requiresMembership(returnTo) ? returnTo : `/join-discord?next=${encodeURIComponent(returnTo)}`, permanent: false } };
  } catch {
    return { props: { failed: true } };
  }
};

export default function OAuthDiscord(_props: InferGetServerSidePropsType<typeof getServerSideProps>) {
  return <AccessScreen title="Sign-in didn’t finish" description="Your Discord sign-in expired, was cancelled, or couldn’t be completed. Please try again."><Button asChild bg="#ffcc00" color="black"><NextLink href="/login">Try signing in again</NextLink></Button></AccessScreen>;
}
