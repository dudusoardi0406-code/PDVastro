import type { Metadata, Viewport } from "next";
import { TotemApp } from "./_components/totem-app";

export const metadata: Metadata = {
  title: "Totem",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: "#000000",
};

// Página estática: tudo o que é do evento (tema, cardápio, fichas) vem do heartbeat.
export default function TotemPage() {
  return <TotemApp />;
}
