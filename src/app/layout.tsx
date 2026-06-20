import type { Metadata, Viewport } from 'next';
import './globals.css';
import { SupabaseConfigProvider } from '@/lib/supabase-config-inject';
import { APP_NAME } from '@/lib/constants';

export const metadata: Metadata = {
  title: {
    default: APP_NAME,
    template: `%s | ${APP_NAME}`,
  },
  description: '家长录入作业，学生自行安排做作业并设置倒计时',
  keywords: ['作业管理', '家庭教育', '倒计时', '学习管理'],
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  viewportFit: 'cover',
  themeColor: '#F5E6D3',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased bg-[#FFFBF5]">
        <SupabaseConfigProvider>{children}</SupabaseConfigProvider>
      </body>
    </html>
  );
}
