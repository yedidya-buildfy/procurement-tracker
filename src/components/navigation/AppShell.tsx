'use client';

import AppSidebar from './AppSidebar';
import BreadcrumbHeader from './BreadcrumbHeader';

export default function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" dir="rtl">
      <AppSidebar />
      <div className="flex-1 mr-16 flex flex-col">
        <BreadcrumbHeader />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}
