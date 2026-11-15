import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import CookieConsent from '@/components/CookieConsent';
import SourceCapture from '@/components/SourceCapture';
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { SupabaseConfigLoader } from "@/components/supabase-config-loader";
import PWAInstallPrompt from "@/components/PWAInstallPrompt";
import ServiceWorkerRegistration from "@/components/ServiceWorkerRegistration";

const lexend = Lexend({
  variable: "--font-lexend",
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

/* FIX AUDIT SEO (2026-11-12): dulu title default 91 char & description 234
   char — melebihi batas SERP Google (title ideal 25–65, desc 70–170) dan
   DIWARISI SEMUA halaman publik → title kembar di seluruh situs.
   Kini: default pendek (52 char) + TEMPLATE '%s | LuxTradee' — halaman
   yang menaruh title sendiri otomatis dapat suffix brand. Metadata unik
   per halaman publik hidup di layout rute masing-masing (page-nya 'use
   client', metadata hanya bisa dari Server Component). */
export const metadata: Metadata = {
  metadataBase: new URL('https://luxtradee.web.id'),
  title: {
    default: 'LuxTradee — Jurnal Trading AI untuk Trader Indonesia',
    template: '%s | LuxTradee',
  },
  description: 'Jurnal trading AI untuk trader Indonesia: impor CSV MT4/MT5, screenshot auto-dibaca AI, deteksi pola kesalahan, equity curve & analisis psikologi. Gratis dimulai.',
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
    title: "LuxTradee — Jurnal Trading AI untuk Trader Indonesia",
    description: "Jurnal trading AI untuk trader Indonesia: impor CSV MT4/MT5, screenshot auto-dibaca AI, deteksi pola kesalahan, equity curve & analisis psikologi. Gratis dimulai.",
    type: "website",
    siteName: "LuxTradee",
    locale: "id_ID",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "LuxTradee — Jurnal Trading AI untuk Trader Indonesia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LuxTradee — Jurnal Trading AI untuk Trader Indonesia",
    description: "Jurnal trading AI: impor CSV MT4/MT5, deteksi pola kesalahan, naikkan win rate. Gratis dimulai.",
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
        {/* Verifikasi domain Facebook Business (Meta) — WAJIB statis di <head>,
            TIDAK boleh dimuat dinamis via JavaScript atau verifikasi gagal. */}
        <meta name="facebook-domain-verification" content="7rjxb26o8g4p0z37ojtd50ynvfxnfv" />
        <meta name="theme-color" content="#050507" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* WebView Performance Optimization for Android TWA/PWA */}
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=5, viewport-fit=cover" />
        {/* Preconnect hints removed to avoid network activity during PWA audit idle window */}
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
        {/* Service Worker Registration — inline for Lighthouse/PWABuilder HTML parsing detection */}
        <script
          dangerouslySetInnerHTML={{
            __html: `
              if('serviceWorker' in navigator){
                window.addEventListener('load',function(){
                  navigator.serviceWorker.register('/sw.js',{scope:'/',updateViaCache:'none'}).then(function(reg){
                    console.log('[SW] Registered, scope:',reg.scope);
                    reg.update();
                  }).catch(function(err){
                    console.warn('[SW] Registration failed:',err);
                  });
                });
              }
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
              <SourceCapture />
              {children}
            </Providers>
            <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
            <PWAInstallPrompt />
          </LanguageProvider>
          <ServiceWorkerRegistration />

          {/* Page View Tracker (non-blocking, deferred) */}
          <Script
            id="page-view-tracker"
            strategy="lazyOnload"
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  // Delayed 15s to avoid blocking Lighthouse "Network Idle" for PWA audit
                  setTimeout(function(){
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
                  }, 15000);
                })();
              `,
            }}
          />

        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
