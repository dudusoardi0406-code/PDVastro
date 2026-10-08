import type { Metadata, Viewport } from "next";
import { TotemApp } from "../_components/totem-app";

export const metadata: Metadata = {
  title: "Totem (demonstração)",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

// /totem/demo?tema=pagode | underground — sem banco, sem Pix de verdade
export default function TotemDemoPage() {
  return <TotemApp />;
}
