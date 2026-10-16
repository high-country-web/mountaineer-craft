import "@/styles/globals.css";
import type { AppProps } from "next/app";
import { Provider } from "@/components/ui/provider"
import Navbar from "@/components/navbar";
import Footer from "@/components/footer";
import { AuthProvider, MemberGate } from "@/components/auth-provider";

export default function App({ Component, pageProps }: AppProps) {
  return (
    <Provider>
      <AuthProvider>
        <Navbar />
        <MemberGate><Component {...pageProps} /></MemberGate>
        <Footer />
      </AuthProvider>
    </Provider>
  )
}
