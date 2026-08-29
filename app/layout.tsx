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

function singleHeaderValue(value: string | null): string | undefined {
  if (value === null || value.includes(",")) return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function isValidHost(host: string): boolean {
  if (/[/\\@?#%\s]/u.test(host)) return false;
  try {
    const parsed = new URL(`https://${host}`);
    if (!parsed.hostname || parsed.username || parsed.password || parsed.pathname !== "/" || parsed.search || parsed.hash) {
      return false;
    }
    if (parsed.hostname.startsWith("[") && parsed.hostname.endsWith("]")) return true;
    return parsed.hostname.split(".").every((label) => (
      label.length > 0
      && label.length <= 63
      && /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/iu.test(label)
    ));
  } catch {
    return false;
  }
}

function requestOrigin(requestHeaders: Headers): URL | undefined {
  const forwardedHost = requestHeaders.get("x-forwarded-host");
  const host = singleHeaderValue(forwardedHost ?? requestHeaders.get("host"));
  if (!host || !isValidHost(host)) return undefined;

  const forwardedProtocol = requestHeaders.get("x-forwarded-proto");
  const providedProtocol = forwardedProtocol === null ? undefined : singleHeaderValue(forwardedProtocol);
  if (forwardedProtocol !== null && providedProtocol !== "http" && providedProtocol !== "https") return undefined;
  const hostname = new URL(`https://${host}`).hostname.toLowerCase();
  const protocol = providedProtocol
    ?? (hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]" ? "http" : "https");
  try {
    return new URL(`${protocol}://${host}`);
  } catch {
    return undefined;
  }
}

export async function generateMetadata(): Promise<Metadata> {
  const origin = requestOrigin(await headers());
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
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        {isDemoMode() ? <DemoIdentitySwitcher /> : null}
        {children}
      </body>
    </html>
  );
}
