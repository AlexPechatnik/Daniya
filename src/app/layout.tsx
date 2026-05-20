import type { Metadata, Viewport } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin", "cyrillic"], variable: "--font-inter", display: "swap" });
const mono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "PrintCare — заправка и ремонт принтеров в СПб", template: "%s · PrintCare СПб" },
  description: "Выездной сервис принтеров и картриджей в Санкт-Петербурге. Заправка, замена, диагностика, ремонт. Гарантия, прозрачные цены, выезд от 30 минут.",
  keywords: ["заправка картриджей СПб", "ремонт принтеров СПб", "замена картриджей", "диагностика принтера"],
  openGraph: { type: "website", locale: "ru_RU" },
};

export const viewport: Viewport = {
  themeColor: "#080d18",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ru" className={`${inter.variable} ${mono.variable} dark`}>
      <body>{children}</body>
    </html>
  );
}
