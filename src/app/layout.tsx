import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import { Toaster } from "@/components/ui/sonner";
import { Providers } from "@/components/providers";
import TelegramFloatingWidget from "@/components/TelegramFloatingWidget";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
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
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <Providers>
          {children}
        </Providers>
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
      </body>
    </html>
  );
}
