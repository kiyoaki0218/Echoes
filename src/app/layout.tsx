import type { Metadata } from "next";
import { Noto_Serif_JP } from "next/font/google";
import "./globals.css";

const notoSerifJp = Noto_Serif_JP({
  weight: ["300", "400", "500", "700"],
  subsets: ["latin"],
  variable: "--font-noto-serif-jp",
});

export const metadata: Metadata = {
  title: "残響 - Echoes",
  description: "完全匿名のテキスト限定SNS。誰かに共鳴すれば長く生き残り、さもなくば泡沫のように消え去る。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja" className={`${notoSerifJp.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-neutral-950 text-neutral-100 font-serif">
        {children}
      </body>
    </html>
  );
}
