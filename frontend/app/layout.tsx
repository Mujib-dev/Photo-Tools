import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { GeistMono } from "geist/font/mono";
import { GeistSans } from "geist/font/sans";

import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { AuthProvider } from "@/components/auth-provider";
import { QueryProvider } from "@/components/query-provider";
import { Toaster } from "@/components/ui/sonner";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { GlobalDropUpload } from "@/components/global-drop-upload";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" });

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#faf8ff" },
    { media: "(prefers-color-scheme: dark)", color: "#020617" },
  ],
};

export const metadata: Metadata = {
  title: {
    default: "PicTools by LynkZone — AI Photo, Document & Creative Suite",
    template: "%s | PicTools by LynkZone",
  },
  description: "Enterprise-grade photo, document, and audio tools engineered by LynkZone. 100% offline & local processing with zero cloud data leaks.",
  manifest: "/manifest.webmanifest",
  applicationName: "PicTools by LynkZone",
  authors: [{ name: "LynkZone" }],
  creator: "LynkZone",
  publisher: "LynkZone",
  appleWebApp: {
    capable: true,
    title: "PicTools by LynkZone",
    statusBarStyle: "default",
  },
  formatDetection: {
    telephone: false,
    email: false,
    address: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var clean = function() {
                    var els = document.querySelectorAll('[bis_skin_checked]');
                    for (var i = 0; i < els.length; i++) {
                      els[i].removeAttribute('bis_skin_checked');
                    }
                  };
                  if (typeof MutationObserver !== 'undefined') {
                    new MutationObserver(clean).observe(document.documentElement, {
                      attributes: true,
                      subtree: true,
                      attributeFilter: ['bis_skin_checked']
                    });
                  }

                  // Allow page scrolling even when Radix UI / react-remove-scroll dropdowns are open
                  var origPrevent = Event.prototype.preventDefault;
                  Event.prototype.preventDefault = function() {
                    if (this && this.type === 'wheel') {
                      var t = this.target;
                      if (t && t.closest && (t.closest('[data-radix-select-viewport]') || t.closest('.prevent-page-scroll'))) {
                        return origPrevent.apply(this, arguments);
                      }
                      return;
                    }
                    return origPrevent.apply(this, arguments);
                  };
                } catch (e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        suppressHydrationWarning
        className={`${inter.variable} ${GeistSans.variable} ${GeistMono.variable} font-sans`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
          <QueryProvider>
            <AuthProvider>
              <div className="flex min-h-screen flex-col" suppressHydrationWarning>
                <SiteHeader />
                <main id="main-content" tabIndex={-1} className="flex-1 outline-none relative z-0">
                  {children}
                </main>
                <GlobalDropUpload />
                <SiteFooter />
              </div>
              <Toaster position="top-right" richColors closeButton duration={3200} visibleToasts={1} expand={false} />
            </AuthProvider>
          </QueryProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
