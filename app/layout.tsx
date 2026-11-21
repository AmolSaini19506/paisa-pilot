import "./globals.css";
import type { Metadata } from "next";
import { StoreProvider } from "@/lib/store";

export const metadata: Metadata = {
  title: "Paisa Pilot — your money, but make it make sense",
  description: "India-first AI money coach. Paste your bank SMS, get a living Money Twin, roast-or-hype coaching and what-if goal planning.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@600;800&family=Space+Grotesk:wght@400;500;600;700&display=swap" rel="stylesheet" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 100 100%22><rect width=%22100%22 height=%22100%22 rx=%2226%22 fill=%22%23d4ff3a%22/><text x=%2250%22 y=%2271%22 font-size=%2262%22 font-family=%22Arial,sans-serif%22 font-weight=%22800%22 text-anchor=%22middle%22 fill=%22%2308080a%22>₹</text></svg>" />
      </head>
      <body>
        <StoreProvider>{children}</StoreProvider>
      </body>
    </html>
  );
}
