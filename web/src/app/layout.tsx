import "@fontsource-variable/inter/wght.css";
import "@fontsource-variable/noto-sans-bengali/wght.css";
import "@fontsource-variable/noto-sans-devanagari/wght.css";
import "@fontsource-variable/noto-sans-thai/wght.css";
import "./globals.css";
import type { Metadata } from "next";
import { viewer } from "@/auth/session";
import { Header } from "@/components/Header";

export const metadata: Metadata = {
  title: { default: "AI for Social Good", template: "%s · AI for Social Good" },
  description: "AI deployments in South and Southeast Asia, with the evidence behind them, extracted from public sources and reviewed by experts.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const v = await viewer();
  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <Header viewer={v} />
        <main className="wrap w-full flex-1 py-6">{children}</main>
        <footer className="border-t border-line mt-8">
          <div className="wrap py-5 note flex flex-wrap gap-x-6 gap-y-1 justify-between">
            <span>AI for Social Good · evidence extracted by AI from public sources, checked by experts.</span>
            <a href="/about">Methods and limits</a>
          </div>
        </footer>
      </body>
    </html>
  );
}
