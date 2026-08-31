import type { Metadata } from "next";
import { Geist, Geist_Mono, Noto_Serif_SC } from "next/font/google";
import { headers } from "next/headers";
import { DemoIdentitySwitcher } from "../components/auth/DemoIdentitySwitcher";
import { isDemoMode } from "../features/identity/demo-auth";
import { canonicalMetadataOrigin } from "../lib/site-origin";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceHanSerif = Noto_Serif_SC({ variable: "--font-source-han-serif", weight: "600", subsets: ["latin"], display: "swap" });

const siteTitle = "广东高校共建者地图｜广州AI共创社";
const siteDescription = "看见广东不同学校与城市中愿意分享、愿意行动的青年共建者。";

export async function generateMetadata(): Promise<Metadata> {
  const origin = canonicalMetadataOrigin(await headers());
  const socialImage = origin ? new URL("/og.png", origin) : undefined;
  return {
    title: siteTitle,
    description: siteDescription,
    icons: { icon: "/logo.png", shortcut: "/logo.png" },
    openGraph: {
      type: "website",
      locale: "zh_CN",
      title: siteTitle,
      description: siteDescription,
      ...(origin ? { url: origin } : {}),
      ...(socialImage ? { images: [{ url: socialImage, width: 1200, height: 630, alt: "广东高校共建者地图的发光校园节点" }] } : {}),
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      ...(socialImage ? { images: [socialImage] } : {}),
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} ${sourceHanSerif.variable} antialiased`}>
        {isDemoMode() ? <DemoIdentitySwitcher /> : null}
        {children}
      </body>
    </html>
  );
}
