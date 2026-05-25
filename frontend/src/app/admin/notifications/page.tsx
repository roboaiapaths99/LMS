'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface User {
  _id: string;
  name?: string;
  mobile: string;
  email?: string;
  role: string;
}

export default function AdminNotificationsPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [targetType, setTargetType] = useState<'ALL' | 'ROLE' | 'USER'>('ALL');
  const [targetRole, setTargetRole] = useState<'ADMIN' | 'INSTRUCTOR' | 'STUDENT'>('STUDENT');
  const [targetUserId, setTargetUserId] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState<string>('INFO');

  useEffect(() => {
    if (targetType === 'USER') {
      fetchUsersList();
    }
  }, [targetType]);

  const fetchUsersList = async () => {
    setLoadingUsers(true);
    try {
      const { data } = await api.get('/users', { params: { limit: 100 } });
      setUsers(data.users || []);
    } catch (err: any) {
      toast.error('Failed to load user list for targeting');
    } finally {
      setLoadingUsers(false);
    }
  };

  const handleSendNotification = async (e: React.FormEvent) => {
    e.preventDefault();
    if (title.length < 3) {
      toast.error('Title must be at least 3 characters');
      return;
    }
    if (message.length < 5) {
      toast.error('Message must be at least 5 characters');
      return;
    }
    if (targetType === 'USER' && !targetUserId) {
      toast.error('Please select an individual user');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/notifications', {
        targetType,
        targetRole: targetType === 'ROLE' ? targetRole : undefined,
        targetUserId: targetType === 'USER' ? targetUserId : undefined,
        title,
        message,
        type,
      });

      toast.success('In-app notification alert dispatched successfully!');
      
      // Reset text inputs
      setTitle('');
      setMessage('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to dispatch notifications');
    } finally {
      setSubmitting(false);
    }
  };

  const getTargetSummary = () => {
    switch (targetType) {
      case 'ALL':
        return 'Dispatches alert globally to all registered students, instructors, and admins.';
      case 'ROLE':
        return `Dispatches alert to all active users matching the role: ${targetRole}.`;
      case 'USER':
        const matched = users.find((u) => u._id === targetUserId);
        return matched ? `Targets individual user: ${matched.name || 'Student'} (+91 ${matched.mobile})` : 'Select an individual below to target.';
      default:
        return '';
    }
  };

  return (
    <div>
      <div className="page-header">
        <h1>Broadcast Notifications</h1>
        <p>Dispatch real-time global, role-based, or targeted in-app alerts and notifications to platform members</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '32px', alignItems: 'start' }}>
        
        {/* Create Broadcast form card */}
        <div className="card-flat" style={{ padding: '32px' }}>
          <h4 style={{ marginBottom: '24px' }} className="flex items-center gap-sm">
            <i className="fa-solid fa-paper-plane" style={{ color: 'var(--tech-blue)' }} />
            New Notification Dispatch
          </h4>

          <form onSubmit={handleSendNotification} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              
              {/* Type Category */}
              <div className="input-group">
                <label>Category Style</label>
                <select className="input" value={type} onChange={(e) => setType(e.target.value)} required>
                  <option value="INFO">Info Alert (Tech-Blue)</option>
                  <option value="SUCCESS">Success Alert (Green)</option>
                  <option value="WARNING">Warning Alert (Yellow)</option>
                  <option value="DANGER">Danger Alert (Red)</option>
                </select>
              </div>

              {/* Target Type selection */}
              <div className="input-group">
                <label>Target Audience</label>
                <select
                  className="input"
                  value={targetType}
                  onChange={(e) => setTargetType(e.target.value as any)}
                  required
                >
                  <option value="ALL">All Active Users</option>
                  <option value="ROLE">Role Segment</option>
                  <option value="USER">Specific User</option>
                </select>
              </div>

            </div>

            {/* Dynamic Audience options */}
            {targetType === 'ROLE' && (
              <div className="input-group animate-slide-up">
                <label>Target Role Segment</label>
                <select
                  className="input"
                  value={targetRole}
                  onChange={(e) => setTargetRole(e.target.value as any)}
                  required
                >
                  <option value="STUDENT">Students Only</option>
                  <option value="INSTRUCTOR">Instructors Only</option>
                  <option value="ADMIN">Admins Only</option>
                </select>
              </div>
            )}

            {targetType === 'USER' && (
              <div className="input-group animate-slide-up">
                <label>Select Target Individual</label>
                {loadingUsers ? (
                  <div className="flex items-center gap-sm" style={{ padding: '8px 0' }}>
                    <div className="spinner spinner-sm" /> Loading user registry...
                  </div>
                ) : (
                  <select
                    className="input"
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose User --</option>
                    {users.map((u) => (
                      <option key={u._id} value={u._id}>
                        {u.name || 'User'} (+91 {u.mobile}) [{u.role}]
                      </option>
                    ))}
                  </select>
                )}
              </div>
            )}

            {/* Title */}
            <div className="input-group">
              <label>Alert Title</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. Schedule Update: Live Robotics Calibration"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                maxLength={80}
                required
              />
              <div className="input-help">{title.length}/80 characters maximum</div>
            </div>

            {/* Message Body */}
            <div className="input-group">
              <label>Notification Message Body</label>
              <textarea
                className="input"
                placeholder="Type the announcement contents here..."
                style={{ minHeight: '140px', resize: 'vertical' }}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>

            {/* Actions */}
            <div className="flex justify-end gap-sm" style={{ borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => {
                  setTitle('');
                  setMessage('');
                }}
              >
                Clear Form
              </button>
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                {submitting ? (
                  <><div className="spinner spinner-sm" /> Dispatching...</>
                ) : (
                  <><i className="fa-solid fa-bullhorn" /> Broadcast Alert</>
                )}
              </button>
            </div>

          </form>
        </div>

        {/* Live Segment Targeting Preview Helper (Right Card) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }}>Target Segment Summary</h4>
            <div
              style={{
                background: 'rgba(0, 110, 255, 0.04)',
                border: '1px solid rgba(0, 110, 255, 0.1)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '16px',
              }}
            >
              <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--tech-blue)', textTransform: 'uppercase', marginBottom: '4px' }}>
                Audience Scope
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', fontWeight: 500 }}>
                {getTargetSummary()}
              </p>
            </div>
            
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>
              Notifications dispatched here will appear instantly inside the targeted user&apos;s header bells. If users have push options active, it will sound a system toast notification instantly.
            </p>
          </div>

          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }}>Category Styles Preview</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-primary">INFO</span>
                <span style={{ fontSize: '0.8125rem' }}>Tech-Blue for newsletters & routine updates</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-success">SUCCESS</span>
                <span style={{ fontSize: '0.8125rem' }}>Green for completions or unlocking items</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-warning">WARNING</span>
                <span style={{ fontSize: '0.8125rem' }}>Yellow for scheduled outages or reminders</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span className="badge badge-danger">DANGER</span>
                <span style={{ fontSize: '0.8125rem' }}>Red for system-wide failures or session terminations</span>
              </div>
            </div>
          </div>

        </div>

      </div>
    </div>
  );
}
