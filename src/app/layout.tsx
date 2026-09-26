import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import CookieConsent from '@/components/CookieConsent';
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SupabaseConfigLoader } from "@/components/supabase-config-loader";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL('https://luxtradee.web.id'),
  title: "LuxTradee - AI Trading Journal Indonesia | Catat Trade, Deteksi Kesalahan, Naikkan Win Rate",
  description: "Trading journal dengan AI untuk trader Indonesia. Screenshot trade dari MT4/MT5, AI auto-extract data & deteksi pola kesalahan berulang. Equity curve, analisis psikologi trading, risk calculator. Gratis 10 trade/bulan.",
  keywords: ["trading journal", "jurnal trading", "trading journal Indonesia", "AI trading journal", "jurnal trading AI", "catat trade", "analisis trading", "forex journal", "jurnal forex", "equity curve", "deteksi kesalahan trading", "trading psikologi", "risk calculator forex", "MT4 journal", "MT5 journal", "luxtrade"],
  authors: [{ name: "LuxTradee" }],
  manifest: '/manifest.webmanifest',
  icons: {
    icon: [
      { url: '/favicon-32x32.png', sizes: '32x32', type: 'image/png' },
      { url: '/icon-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icon-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon-1024x1024.png', sizes: '1024x1024', type: 'image/png' },
    ],
    apple: [
      { url: '/apple-icon.png', sizes: '180x180', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'LuxTradee',
    startupImage: ['/icon-512x512.png'],
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "LuxTradee - AI Trading Journal Indonesia | Catat Trade, Deteksi Kesalahan, Naikkan Win Rate",
    description: "Trading journal dengan AI untuk trader Indonesia. Screenshot trade dari MT4/MT5, AI auto-extract data & deteksi pola kesalahan berulang. Gratis 10 trade/bulan.",
    type: "website",
    siteName: "LuxTradee",
    locale: "id_ID",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "LuxTradee - AI Trading Journal Indonesia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LuxTradee - AI Trading Journal Indonesia",
    description: "Trading journal dengan AI untuk trader Indonesia. Catat trade, deteksi kesalahan, naikkan win rate.",
    images: ["/logo.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" suppressHydrationWarning className="dark">
      <head>
        <meta name="theme-color" content="#050507" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* WebView Performance Optimization for Android TWA/PWA */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        {/* Preconnect to critical origins for faster loading */}
        <link rel="preconnect" href="https://klxkdrfsfcoankbaoejn.supabase.co" />
        <link rel="dns-prefetch" href="https://klxkdrfsfcoankbaoejn.supabase.co" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="dns-prefetch" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* Splash screen background color for instant paint */}
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('luxtrade-theme');
                  if (theme === 'light') {
                    document.documentElement.classList.remove('dark');
                    document.documentElement.classList.add('light');
                  }
                } catch(e) {}
              })();
            `,
          }}
        />
      </head>
      <body
        className={`${inter.variable} ${lexend.variable} antialiased font-sans`}
      >
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:bg-blue-600 focus:text-white focus:px-4 focus:py-2 focus:rounded-md"
        >
          Skip to main content
        </a>
        <GlobalErrorBoundary>
          <LanguageProvider>
            <SupabaseConfigLoader />
            <Providers>
              <CookieConsent />
              {children}
            </Providers>
          </LanguageProvider>
          <Toaster position="top-right" />
          <PWAInstallPrompt />
          <ServiceWorkerRegistration />

          {/* Page View Tracker (non-blocking, deferred) */}
          <Script
            id="page-view-tracker"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  try {
                    var data = {
                      path: window.location.pathname,
                      referrer: document.referrer,
                      userAgent: navigator.userAgent,
                      screenWidth: screen.width
                    };
                    if(navigator.sendBeacon){
                      navigator.sendBeacon('/api/track', new Blob([JSON.stringify(data)],{type:'application/json'}));
                    }else{
                      fetch('/api/track', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(data),
                        keepalive: true
                      }).catch(function(){});
                    }
                  } catch(e) {}
                })();
              `,
            }}
          />

        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
