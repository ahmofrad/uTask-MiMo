import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/tokens.css";
import { Vazirmatn, Inter } from "next/font/google";
import { getLocale } from "next-intl/server";
import { PwaRegister } from "@/components/pwa/register";

const vazirmatn = Vazirmatn({
  subsets: ["arabic", "latin"],
  variable: "--font-vazirmatn",
  display: "swap",
});

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "uTask",
  description: "Enterprise task management platform",
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const dir = locale === "fa-IR" ? "rtl" : "ltr";

  return (
    <html lang={locale} dir={dir} className={`${vazirmatn.variable} ${inter.variable}`}>
      <head>
        <link rel="manifest" href="/manifest.webmanifest" />
        <meta name="theme-color" content="#4f46e5" />
        <script dangerouslySetInnerHTML={{ __html: `(() => { try { const m=document.querySelector('meta[name=theme-color]'); const v=getComputedStyle(document.documentElement).getPropertyValue('--accent'); if(m&&v.trim())m.content=v.trim(); } catch {} })();` }} />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
      </head>
      <body className="bg-bg-primary text-fg font-sans antialiased overflow-x-clip">
        {children}
        <PwaRegister />
      </body>
    </html>
  );
}
