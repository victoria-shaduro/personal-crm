import type { Metadata } from "next";
import { Cormorant_Garamond, JetBrains_Mono, Manrope } from "next/font/google";
import Link from "next/link";

import { LogoMark } from "@/components/icons";
import { Toaster } from "@/components/ui/sonner";

import "./globals.css";

// The landing's fonts; next/font serves them from our own domain
const manrope = Manrope({
  variable: "--font-manrope",
  subsets: ["latin", "cyrillic"],
  weight: ["400", "500", "600"],
});

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "600"],
});

const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin", "cyrillic"],
  weight: ["500", "700"],
});

export const metadata: Metadata = {
  title: {
    default: "Узелок",
    template: "%s — Узелок",
  },
  description: "Люди, которых я знаю лично, и контекст общения с ними",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="ru"
      // "dark" selects the dark variants of shadcn components: the app has only a dark theme
      className={`${manrope.variable} ${cormorant.variable} ${jetbrainsMono.variable} dark h-full antialiased`}
    >
      <body className="flex min-h-full flex-col">
        <header className="border-b">
          <div className="mx-auto flex w-full max-w-3xl items-center px-5 py-3 sm:px-6 sm:py-4">
            {/* min-h-11 keeps the logo link a 44px tap target */}
            <Link href="/" className="flex min-h-11 items-center gap-2.5 sm:gap-3">
              <LogoMark className="size-8.5 sm:size-10" />
              <span className="font-display text-title font-semibold tracking-slight">
                Узелок
              </span>
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-3xl flex-1 px-5 py-6 sm:px-6 sm:py-10">
          {children}
        </main>
        <Toaster theme="dark" position="bottom-center" />
      </body>
    </html>
  );
}
