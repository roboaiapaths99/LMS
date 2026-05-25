'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import './student.css';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={['STUDENT']}>
      <div className="layout-wrapper">
        <Sidebar role="STUDENT" />
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
