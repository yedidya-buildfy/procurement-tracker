import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';
import ConvexClientProvider from '@/components/ConvexClientProvider';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
});

export const metadata: Metadata = {
  title: 'מעקב רכש בינלאומי',
  description: 'מערכת לניהול הזמנות רכש מספקים בינלאומיים',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased bg-gray-50`}>
        <ConvexClientProvider>
          <ToastProvider>{children}</ToastProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
