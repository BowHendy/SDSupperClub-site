import type { Metadata } from "next";
import { Cormorant_Garamond } from "next/font/google";
import { GeistSans } from "geist/font/sans";
import { CustomCursor } from "@/components/cursor/CustomCursor";
import { Navigation } from "@/components/nav/Navigation";
import { SiteContentProvider } from "@/components/providers/SiteContentProvider";
import { ContactFooter } from "@/components/sections/ContactFooter";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SDSupperClub — San Diego",
  description:
    "A private, invite-only dining club in San Diego. Ten seats. One chef. Someone's home. Once a month.",
  openGraph: {
    title: "SDSupperClub — San Diego",
    description:
      "A private, invite-only dining club in San Diego. Ten seats. One chef. Someone's home. Once a month.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${cormorant.variable} ${GeistSans.variable}`}>
      <body className="min-h-screen font-geist text-foreground antialiased">
        <SiteContentProvider>
          <CustomCursor />
          <Navigation />
          <main>{children}</main>
          <ContactFooter />
        </SiteContentProvider>
      </body>
    </html>
  );
}
