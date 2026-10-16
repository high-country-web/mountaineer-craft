import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { useRouter } from "next/router";
import { Flex, Spinner, Text } from "@chakra-ui/react";
import { publicPages, safeReturnTo } from "@/lib/auth";
import type { ProfileUser } from "@/components/profile";

type Session = { user: ProfileUser | null; checkedPath: string | null; loading: boolean };
const SessionContext = createContext<Session>({ user: null, checkedPath: null, loading: true });
export const useSession = () => useContext(SessionContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const router = useRouter();
  const [session, setSession] = useState<Session>({ user: null, checkedPath: null, loading: true });
  useEffect(() => {
    if (!router.isReady) return;
    if (publicPages.has(router.pathname)) {
      setSession({ user: null, checkedPath: router.asPath, loading: false });
      return;
    }
    let controller: AbortController | undefined;
    let active = true;
    async function verify() {
      controller?.abort();
      controller = new AbortController();
      const signal = controller.signal;
      setSession({ user: null, checkedPath: null, loading: true });
      const next = encodeURIComponent(safeReturnTo(router.asPath));
      try {
        const response = await fetch("/api/auth/session", { cache: "no-store", signal });
        if (!active || signal.aborted) return;
        if (response.status === 401) { await router.replace(`/login?next=${next}`); return; }
        if (response.status === 403) { await router.replace(`/join-discord?next=${next}`); return; }
        if (!response.ok) throw new Error("Membership check unavailable");
        const user = await response.json();
        if (user.in_guild !== true) throw new Error("Invalid membership response");
        if (active && !signal.aborted) setSession({ user, checkedPath: router.asPath, loading: false });
      } catch {
        if (active && !signal.aborted) await router.replace(`/access-unavailable?next=${next}`);
      }
    }
    void verify();
    const onFocus = () => { void verify(); };
    window.addEventListener("focus", onFocus);
    // Revalidate while a page remains open, as well as on navigation and focus.
    const interval = window.setInterval(() => { if (document.visibilityState === "visible") void verify(); }, 60000);
    return () => { active = false; controller?.abort(); window.removeEventListener("focus", onFocus); window.clearInterval(interval); };
  }, [router, router.isReady, router.pathname, router.asPath]);
  return <SessionContext.Provider value={session}>{children}</SessionContext.Provider>;
}

export function MemberGate({ children }: { children: ReactNode }) {
  const router = useRouter();
  const session = useSession();
  if (publicPages.has(router.pathname)) return children;
  if (!session.loading && session.user && session.checkedPath === router.asPath) return children;
  return <Flex as="main" role="status" aria-live="polite" minH="calc(100dvh - 94px)" align="center" justify="center" gap={4} bg="#090909" color="#cccccc" px={5}><Spinner color="#ffcc00" /><Text fontSize="16px">Checking your access…</Text></Flex>;
}
