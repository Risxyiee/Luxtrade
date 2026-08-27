import type { Metadata } from "next";
import { Inter, Lexend } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import CookieConsent from '@/components/CookieConsent';
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Analytics } from '@vercel/analytics/react';

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
  title: "LuxTrade - AI Trading Journal Indonesia | Catat Trade, Deteksi Kesalahan, Naikkan Win Rate",
  description: "Trading journal dengan AI untuk trader Indonesia. Screenshot trade dari MT4/MT5, AI auto-extract data & deteksi pola kesalahan berulang. Equity curve, analisis psikologi trading, risk calculator. Gratis 10 trade/bulan.",
  keywords: ["trading journal", "jurnal trading", "trading journal Indonesia", "AI trading journal", "jurnal trading AI", "catat trade", "analisis trading", "forex journal", "jurnal forex", "equity curve", "deteksi kesalahan trading", "trading psikologi", "risk calculator forex", "MT4 journal", "MT5 journal", "luxtrade"],
  authors: [{ name: "LuxTrade" }],
  icons: { icon: "/logo.png" },
  openGraph: {
    title: "LuxTrade - AI Trading Journal Indonesia | Catat Trade, Deteksi Kesalahan, Naikkan Win Rate",
    description: "Trading journal dengan AI untuk trader Indonesia. Screenshot trade dari MT4/MT5, AI auto-extract data & deteksi pola kesalahan berulang. Gratis 10 trade/bulan.",
    type: "website",
    siteName: "LuxTrade",
    locale: "id_ID",
    images: [{ url: "/logo.png", width: 1200, height: 630, alt: "LuxTrade - AI Trading Journal Indonesia" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "LuxTrade - AI Trading Journal Indonesia",
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
    <html lang="id" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                try {
                  var theme = localStorage.getItem('luxtrade-theme');
                  if (theme === 'light') {
                    document.documentElement.classList.add('light');
                  } else {
                    document.documentElement.classList.add('dark');
                  }
                } catch(e) {
                  document.documentElement.classList.add('dark');
                }
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
            <Providers>
              <CookieConsent />
              {children}
            </Providers>
          </LanguageProvider>
          <Toaster position="top-right" />

          {/* AI Chat Widget - Chatbase (deferred: load only after page is idle + 3s delay) */}
          <Script
            id="chatbase-widget"
            strategy="afterInteractive"
            dangerouslySetInnerHTML={{
              __html: `
                (function(){
                  if(!window.chatbase||window.chatbase("getState")!=="initialized"){
                    window.chatbase=(...arguments)=>{
                      if(!window.chatbase.q){window.chatbase.q=[]}
                      window.chatbase.q.push(arguments)
                    };
                    window.chatbase=new Proxy(window.chatbase,{
                      get(target,prop){
                        if(prop==="q"){return target.q}
                        return(...args)=>target(prop,...args)
                      }
                    })
                  }
                  // Delay 3s after page load to avoid blocking critical rendering
                  var loadChatbase=function(){
                    var script=document.createElement("script");
                    script.src="https://www.chatbase.co/embed.min.js";
                    script.id="g6SMFqtY0p-Vv9YdiGWZT";
                    script.domain="www.chatbase.co";
                    document.body.appendChild(script)
                  };
                  // Use requestIdleCallback if available, fallback to setTimeout
                  if("requestIdleCallback" in window){
                    requestIdleCallback(function(){setTimeout(loadChatbase,3000)})
                  }else{
                    window.addEventListener("load",function(){setTimeout(loadChatbase,3000)})
                  }
                })();
              `,
            }}
          />

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

          {/* Vercel Analytics */}
          <Analytics />
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
