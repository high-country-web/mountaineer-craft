import type { GetServerSideProps, InferGetServerSidePropsType } from "next";
import {
  API_BASE_URL,
  cookie,
  readCookie,
  RETURN_COOKIE,
  safeReturnTo,
  SESSION_COOKIE,
  STATE_COOKIE,
} from "@/lib/auth-server";
import { validOAuthState } from "@/lib/oauth-state";
import AccessScreen from "@/components/access-screen";
import { Button } from "@chakra-ui/react";
import NextLink from "next/link";
import { requiresMembership } from "@/lib/auth";

export const getServerSideProps: GetServerSideProps<{ failed: true }> = async ({
  req,
  res,
  query,
}) => {
  res.setHeader("Cache-Control", "no-store");
  const expected = readCookie(req.headers.cookie, STATE_COOKIE);
  const returnTo = safeReturnTo(readCookie(req.headers.cookie, RETURN_COOKIE));
  const cleared = [cookie(STATE_COOKIE, "", 0), cookie(RETURN_COOKIE, "", 0)];
  res.setHeader("Set-Cookie", cleared);
  if (!validOAuthState(expected, query.state)) {
    console.error(
      `[discord-oauth] Callback rejected: ${expected ? "state mismatch or missing state" : "state cookie missing"}`,
    );
    return { props: { failed: true } };
  }
  if (typeof query.code !== "string" || query.error) {
    console.error("[discord-oauth] Discord did not return a successful authorization code");
    return { props: { failed: true } };
  }
  try {
    const response = await fetch(`${API_BASE_URL}/auth/discord`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: query.code }),
      cache: "no-store",
      redirect: "manual",
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok) {
      const data: unknown = await response.json().catch(() => null);
      const knownErrors = new Set([
        "auth_not_configured",
        "missing_code",
        "discord_unavailable",
        "token_exchange_failed",
        "invalid_token_response",
        "discord_user_unavailable",
        "membership_check_unavailable",
        "session_unavailable",
      ]);
      const code =
        data &&
        typeof data === "object" &&
        "error" in data &&
        typeof data.error === "string" &&
        knownErrors.has(data.error)
          ? data.error
          : "unrecognized_response";
      console.error(`[discord-oauth] POST backend /auth/discord: HTTP ${response.status}, ${code}`);
      return { props: { failed: true } };
    }
    const session = await response.json();
    if (
      typeof session.token !== "string" ||
      !session.token ||
      typeof session.in_guild !== "boolean" ||
      !Number.isFinite(session.expires_in) ||
      session.expires_in <= 0
    ) {
      console.error("[discord-oauth] Backend returned an invalid session response");
      return { props: { failed: true } };
    }
    res.setHeader("Set-Cookie", [
      ...cleared,
      cookie(SESSION_COOKIE, session.token, Math.min(86400, Math.floor(session.expires_in))),
    ]);
    return {
      redirect: {
        destination:
          session.in_guild || !requiresMembership(returnTo)
            ? returnTo
            : `/join-discord?next=${encodeURIComponent(returnTo)}`,
        permanent: false,
      },
    };
  } catch (error) {
    console.error(
      "[discord-oauth] Backend sign-in request failed:",
      error instanceof Error && (error.name === "TimeoutError" || error.name === "AbortError")
        ? "timeout or abort"
        : "network, TLS, or invalid JSON response; check API_BASE_URL and backend availability",
    );
    return { props: { failed: true } };
  }
};

export default function OAuthDiscord(
  _props: InferGetServerSidePropsType<typeof getServerSideProps>,
) {
  return (
    <AccessScreen
      title="Sign-in didn’t finish"
      description="Your Discord sign-in expired, was cancelled, or couldn’t be completed. Please try again."
    >
      <Button asChild bg="#ffcc00" color="black">
        <NextLink href="/login">Try signing in again</NextLink>
      </Button>
    </AccessScreen>
  );
}
