import type { Metadata, Viewport } from "next";
import "./globals.css";
import Shell from "@/components/Shell";

export const metadata: Metadata = {
  title: "BTC AI Trading",
  description: "Système multi-agents de trading BTC sur Hyperliquid — paper / testnet / live",
};

export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#07090d" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="font-sans">
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
