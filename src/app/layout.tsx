import type { Metadata } from "next";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

export const metadata: Metadata = {
  title: "Tse Technical Analysis — تحلیل تکنیکال بورس ایران",
  description: "تحلیل تکنیکال جامع سهام بورس ایران با اندیکاتورها، حمایت و مقاومت، و گراف تصمیم VDss",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <body
        className="antialiased"
        style={{ fontFamily: 'Vazirmatn, sans-serif', backgroundColor: '#ffffff', color: '#1a1a1a' }}
        suppressHydrationWarning
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
