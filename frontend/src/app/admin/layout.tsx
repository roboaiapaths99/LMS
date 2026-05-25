'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={['ADMIN']}>
      <div className="layout-wrapper">
        <Sidebar role="ADMIN" />
        <main className="main-content">
          <Topbar />
          <div className="page-content">
            {children}
          </div>
        </main>
      </div>
    </AuthGuard>
  );
}
