import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import GlobalErrorGuard from "@/components/global-error-guard";

export const metadata: Metadata = {
  title: "Tse Technical Analysis — تحلیل تکنیکال بورس ایران",
  description: "تحلیل تکنیکال جامع سهام بورس ایران با اندیکاتورها، گراف تصمیم و توضیح‌دهنده تصویری",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `window.addEventListener('unhandledrejection',function(e){var r=e.reason;if(r!==null&&typeof r==='object'&&!Array.isArray(r)&&!(r instanceof Error)){e.preventDefault();return;}var m=r instanceof Error?r.message:String(r);if(m==='Failed to fetch'||m==='Load failed'||m.includes('ResizeObserver')){e.preventDefault();}});`,
          }}
        />
      </head>
      <body
        className="antialiased"
        style={{ fontFamily: 'Vazirmatn, sans-serif', backgroundColor: '#ffffff', color: '#1a1a1a' }}
        suppressHydrationWarning
      >
        <GlobalErrorGuard>
          {children}
        </GlobalErrorGuard>
        <Toaster />
      </body>
    </html>
  );
}
