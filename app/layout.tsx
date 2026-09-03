import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import localFont from "next/font/local";
import { headers } from "next/headers";
import { DemoIdentitySwitcher } from "../components/auth/DemoIdentitySwitcher";
import { isDemoMode } from "../features/identity/demo-auth";
import { canonicalMetadataOrigin } from "../lib/site-origin";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });
const sourceHanSerif = localFont({ src:"./fonts/SourceHanSerifSC-SemiBold.woff2", weight:"600", variable:"--font-source-han-serif", display:"swap" });

const siteTitle = "广州 AI 共创社｜共建者与 AI 社群地图";
const siteDescription = "看见广东高校共建者，发现正在行动的 AI 社群与共创网络。";

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
