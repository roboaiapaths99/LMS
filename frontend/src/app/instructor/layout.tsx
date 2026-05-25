'use client';

import AuthGuard from '@/components/auth/AuthGuard';
import Sidebar from '@/components/layout/Sidebar';
import Topbar from '@/components/layout/Topbar';
import './instructor.css';

export default function InstructorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard allowedRoles={['INSTRUCTOR']}>
      <div className="layout-wrapper">
        <Sidebar role="INSTRUCTOR" />
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
