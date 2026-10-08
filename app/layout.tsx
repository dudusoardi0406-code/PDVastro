import type { Metadata } from "next";
import { Anton, Archivo, Lilita_One, Rubik_Dirt } from "next/font/google";
import "./globals.css";

const archivo = Archivo({ variable: "--font-archivo", subsets: ["latin"] });
// fontes de destaque dos temas do totem
const lilita = Lilita_One({ variable: "--font-lilita", weight: "400", subsets: ["latin"] });
const rubikDirt = Rubik_Dirt({ variable: "--font-dirt", weight: "400", subsets: ["latin"] });
const anton = Anton({ variable: "--font-anton", weight: "400", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "PDVastro", template: "%s · PDVastro" },
  description: "Totem de autoatendimento com Pix para eventos",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="pt-BR"
      className={`${archivo.variable} ${lilita.variable} ${rubikDirt.variable} ${anton.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
