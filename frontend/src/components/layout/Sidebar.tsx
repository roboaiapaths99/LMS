'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import { useState } from 'react';

interface NavItem {
  label: string;
  href: string;
  icon: string;
  section?: string;
}

const adminNav: NavItem[] = [
  { label: 'Dashboard', href: '/admin', icon: 'fa-gauge-high' },
  { label: 'Courses', href: '/admin/courses', icon: 'fa-graduation-cap', section: 'Content' },
  { label: 'Bundles', href: '/admin/bundles', icon: 'fa-box' },
  { label: 'Users', href: '/admin/users', icon: 'fa-users', section: 'Management' },
  { label: 'Orders', href: '/admin/orders', icon: 'fa-receipt' },
  { label: 'Device Requests', href: '/admin/devices', icon: 'fa-mobile-screen' },
  { label: 'Coupons', href: '/admin/coupons', icon: 'fa-ticket' },
  { label: 'Live Sessions', href: '/admin/sessions', icon: 'fa-video', section: 'Live & AI' },
  { label: 'Revenue Reports', href: '/admin/reports', icon: 'fa-chart-line', section: 'Analytics' },
  { label: 'Notifications', href: '/admin/notifications', icon: 'fa-bell' },
];

const studentNav: NavItem[] = [
  { label: 'Dashboard', href: '/student', icon: 'fa-house' },
  { label: 'Browse Courses', href: '/student/courses', icon: 'fa-compass', section: 'Learning' },
  { label: 'My Library', href: '/student/library', icon: 'fa-book-open' },
  { label: 'Progress', href: '/student/progress', icon: 'fa-chart-simple' },
  { label: 'Live Sessions', href: '/student/sessions', icon: 'fa-video', section: 'Live & AI' },
  { label: 'Bookmarks', href: '/student/bookmarks', icon: 'fa-bookmark', section: 'Tools' },
  { label: 'Notes', href: '/student/notes', icon: 'fa-note-sticky' },
  { label: 'Orders', href: '/student/orders', icon: 'fa-receipt', section: 'Account' },
  { label: 'Profile', href: '/student/profile', icon: 'fa-user' },
];

const instructorNav: NavItem[] = [
  { label: 'Dashboard', href: '/instructor', icon: 'fa-house' },
  { label: 'Catalogue', href: '/instructor/catalogue', icon: 'fa-store', section: 'Content' },
  { label: 'My Library', href: '/instructor/library', icon: 'fa-book-open' },
  { label: 'Live Sessions', href: '/instructor/sessions', icon: 'fa-video', section: 'Teaching' },
  { label: 'Purchases', href: '/instructor/purchases', icon: 'fa-receipt', section: 'Account' },
  { label: 'Profile', href: '/instructor/profile', icon: 'fa-user' },
];

export default function Sidebar({ role }: { role: 'ADMIN' | 'STUDENT' | 'INSTRUCTOR' }) {
  const pathname = usePathname();
  const { user, logout } = useAuthStore();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = role === 'ADMIN' ? adminNav : role === 'INSTRUCTOR' ? instructorNav : studentNav;

  let lastSection = '';

  return (
    <>
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="modal-overlay"
          style={{ zIndex: 99 }}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Mobile toggle button */}
      <button
        className="btn btn-icon btn-secondary"
        onClick={() => setMobileOpen(!mobileOpen)}
        style={{
          position: 'fixed',
          top: 16,
          left: 16,
          zIndex: 101,
          display: 'none',
        }}
        id="mobile-menu-toggle"
      >
        <i className={`fa-solid ${mobileOpen ? 'fa-xmark' : 'fa-bars'}`} />
      </button>

      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 20px', overflow: 'hidden' }}>
          <img 
            src="/logo.jpg" 
            alt="RoboAIPaths Logo" 
            style={{ 
              height: '48px', 
              width: 'auto', 
              maxWidth: '100%', 
              objectFit: 'contain', 
              borderRadius: '8px'
            }} 
          />
        </div>

        {/* Navigation */}
        <nav className="sidebar-nav">
          {navItems.map((item) => {
            const showSection = item.section && item.section !== lastSection;
            if (item.section) lastSection = item.section;

            const isActive = pathname === item.href || 
              (item.href !== `/${role.toLowerCase()}` && pathname.startsWith(item.href));

            return (
              <div key={item.href}>
                {showSection && (
                  <div className="sidebar-section">{item.section}</div>
                )}
                <Link
                  href={item.href}
                  className={`sidebar-link ${isActive ? 'active' : ''}`}
                  onClick={() => setMobileOpen(false)}
                >
                  <span className="icon">
                    <i className={`fa-solid ${item.icon}`} />
                  </span>
                  {item.label}
                </Link>
              </div>
            );
          })}
        </nav>

        {/* Footer user info */}
        <div className="sidebar-footer">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 16px' }}>
            <div className="avatar avatar-sm">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#fff' }} className="truncate">
                {user?.name || 'User'}
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'rgba(255,255,255,0.4)' }}>
                {user?.role}
              </div>
            </div>
            <button
              onClick={logout}
              className="btn btn-icon"
              style={{ color: 'rgba(255,255,255,0.4)' }}
              title="Logout"
            >
              <i className="fa-solid fa-right-from-bracket" />
            </button>
          </div>
        </div>
      </aside>

      <style jsx>{`
        @media (max-width: 1024px) {
          #mobile-menu-toggle {
            display: flex !important;
          }
        }
      `}</style>
    </>
  );
}
