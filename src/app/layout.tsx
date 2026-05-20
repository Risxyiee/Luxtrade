import type { Metadata } from "next";
import { Geist, Geist_Mono, Lexend, Inter } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import TelegramFloatingWidget from "@/components/TelegramFloatingWidget";
import GlobalErrorBoundary from "@/components/GlobalErrorBoundary";
import { LanguageProvider } from "@/contexts/LanguageContext";

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
  title: "LuxTrade - Trading Journal",
  description: "Professional trading journal with AI-powered insights. Track your trades, analyze performance, and improve your trading strategy.",
  keywords: ["Trading", "Journal", "Stocks", "Investment", "Portfolio", "Analytics", "AI"],
  authors: [{ name: "LuxTrade Team" }],
  icons: {
    icon: "/logo.png",
  },
  openGraph: {
    title: "LuxTrade - Trading Journal",
    description: "Professional trading journal with AI-powered insights",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${lexend.variable} ${inter.variable} antialiased font-sans`}
      >
        <GlobalErrorBoundary>
          <LanguageProvider>
            <Providers>
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

          {/* Telegram Floating Widget */}
          <TelegramFloatingWidget />

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


          {/* Chatbase Bubble Position Styles */}
          <style
            dangerouslySetInnerHTML={{
              __html: `
                #chatbase-bubble-button {
                  position: fixed !important;
                  bottom: 20px !important;
                  right: 20px !important;
                  z-index: 999999 !important;
                }
              `,
            }}
          />
        </GlobalErrorBoundary>
      </body>
    </html>
  );
}
