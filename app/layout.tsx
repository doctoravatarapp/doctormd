import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "APolloMD | Cuidado que continua",
  description: "Uma experiência conversacional segura para aproximar médicos e pacientes.",
};

export const viewport: Viewport = {
  colorScheme: "light",
  themeColor: "#f5f7f5",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
