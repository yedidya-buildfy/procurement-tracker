import type { Metadata } from 'next';
import { Heebo } from 'next/font/google';
import './globals.css';
import { ToastProvider } from '@/components/ui/Toast';

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo',
});

export const metadata: Metadata = {
  title: 'מעקב רכש בינלאומי',
  description: 'מערכת לניהול הזמנות רכש מספקים בינלאומיים',
  icons: {
    icon: '/Logo.png',
    apple: '/Logo.png',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${heebo.variable} font-sans antialiased bg-gray-50`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
