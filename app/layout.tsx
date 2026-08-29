import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { headers } from "next/headers";
import { DemoIdentitySwitcher } from "../components/auth/DemoIdentitySwitcher";
import { isDemoMode } from "../features/identity/demo-auth";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const siteTitle = "广东高校共建者地图｜广州AI共创社";
const siteDescription = "看见广东不同学校与城市中愿意分享、愿意行动的青年共建者。";

function requestOrigin(requestHeaders: Headers): URL {
  const forwardedHost = requestHeaders.get("x-forwarded-host")?.split(",", 1)[0]?.trim();
  const host = forwardedHost || requestHeaders.get("host") || "localhost";
  const forwardedProtocol = requestHeaders.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  const protocol = forwardedProtocol === "http" || forwardedProtocol === "https"
    ? forwardedProtocol
    : host.startsWith("localhost") || host.startsWith("127.0.0.1") ? "http" : "https";
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return new URL("https://builder-map.invalid");
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = requestOrigin(await headers());
  const socialImage = new URL("/og.png", origin);
  return {
    title: siteTitle,
    description: siteDescription,
    icons: { icon: "/logo.png", shortcut: "/logo.png" },
    openGraph: {
      type: "website",
      url: origin,
      locale: "zh_CN",
      title: siteTitle,
      description: siteDescription,
      images: [{ url: socialImage, width: 1200, height: 630, alt: "广东高校共建者地图的发光校园节点" }],
    },
    twitter: {
      card: "summary_large_image",
      title: siteTitle,
      description: siteDescription,
      images: [socialImage],
    },
  };
}

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {isDemoMode() ? <DemoIdentitySwitcher /> : null}
        {children}
      </body>
    </html>
  );
}
