import type { Metadata } from "next";
import { Inter, Vazirmatn } from "next/font/google";
import "@/styles/globals.css";
import "@/styles/tokens.css";

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
  title: "TaskApp",
  description: "Enterprise task management platform",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="fa-IR"
      dir="rtl"
      className={`${vazirmatn.variable} ${inter.variable}`}
    >
      <body className="bg-bg-app text-fg font-sans antialiased">{children}</body>
    </html>
  );
}
