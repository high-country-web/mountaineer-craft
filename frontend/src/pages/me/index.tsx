import Profile from "@/components/profile";
import { useSession } from "@/components/auth-provider";

export default function MePage() {
  const { user } = useSession();
  // The shared gate verifies membership before this page can render.
  return user ? <Profile user={user} /> : null;
}
