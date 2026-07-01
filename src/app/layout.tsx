import type { Metadata } from "next";
import { Geist, Geist_Mono, Lexend, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import CookieConsent from '@/components/CookieConsent';
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";
import { Analytics } from '@vercel/analytics/react';

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

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
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lexend.variable} ${inter.variable} antialiased font-sans`}
      >
        <GlobalErrorBoundary>
          <LanguageProvider>
            <Providers>
              <CookieConsent />
              {children}
            </Providers>
          </LanguageProvider>
          <Toaster position="top-right" />

          {/* AI Chat Widget - Chatbase */}
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
                  const onLoad=function(){
                    const script=document.createElement("script");
                    script.src="https://www.chatbase.co/embed.min.js";
                    script.id="g6SMFqtY0p-Vv9YdiGWZT";
                    script.domain="www.chatbase.co";
                    document.body.appendChild(script)
                  };
                  if(document.readyState==="complete"){
                    onLoad()
                  }else{
                    window.addEventListener("load",onLoad)
                  }
                })();
              `,
            }}
          />

          {/* Page View Tracker */}
          <Script
            id="page-view-tracker"
            strategy="afterInteractive"
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
                    fetch('/api/track', {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify(data)
                    }).catch(function(){});
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
