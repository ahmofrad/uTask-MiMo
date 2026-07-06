import type { Metadata } from "next";
import "@/styles/globals.css";
import "@/styles/tokens.css";
import { Vazirmatn, Inter } from "next/font/google";

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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="fa-IR" dir="rtl" className={`${vazirmatn.variable} ${inter.variable}`}>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var locale = document.cookie.match(/NEXT_LOCALE=([^;]+)/);
                  if (locale) {
                    var l = locale[1];
                    document.documentElement.lang = l;
                    document.documentElement.dir = l === 'fa-IR' ? 'rtl' : 'ltr';
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body className="bg-bg-primary text-fg font-sans antialiased overflow-x-clip">{children}</body>
    </html>
  );
}
