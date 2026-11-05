import type { Metadata, Viewport } from "next";
import { AppShell } from "@/components/layout/app-shell";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Entre Nosotros ❤️ — Un poquito más cerca", template: "%s · Entre Nosotros" },
  description: "Un juego de conexión en pareja. Preguntas, recuerdos y nuevas maneras de seguir eligiéndonos.",
  robots: { index: false, follow: false },
  appleWebApp: { title: "Entre Nosotros", capable: true, statusBarStyle: "default" },
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: [{ media: "(prefers-color-scheme: light)", color: "#fcf8f4" }, { media: "(prefers-color-scheme: dark)", color: "#20191e" }] };

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="es"><body><AppShell>{children}</AppShell></body></html>;
}
