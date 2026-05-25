'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface User {
  id: string;
  _id: string;
  mobile: string;
  name?: string;
  email?: string;
  role: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT';
  isActive: boolean;
  createdAt: string;
}

interface Order {
  _id: string;
  amountInr: number;
  status: string;
  createdAt: string;
  bundleId?: {
    name: string;
  };
}

interface Device {
  _id: string;
  deviceId: string;
  deviceName: string;
  status: string;
  requestedAt: string;
}

interface CourseAccess {
  _id: string;
  accessType: string;
  grantedAt: string;
  courseId?: {
    title: string;
  };
}

export default function AdminUserDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [courseAccesses, setCourseAccesses] = useState<CourseAccess[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingRole, setUpdatingRole] = useState(false);
  const [resettingOtp, setResettingOtp] = useState(false);

  useEffect(() => {
    fetchUserDetails();
  }, [id]);

  const fetchUserDetails = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/users/${id}`);
      setUser(data.user);
      setOrders(data.orders || []);
      setDevices(data.devices || []);
      setCourseAccesses(data.courseAccess || []);
    } catch (err: any) {
      toast.error('Failed to load user details');
    } finally {
      setLoading(false);
    }
  };

  const handleRoleChange = async (newRole: 'ADMIN' | 'INSTRUCTOR' | 'STUDENT') => {
    setUpdatingRole(true);
    try {
      await api.put(`/users/${id}/role`, { role: newRole });
      toast.success('User role updated successfully');
      setUser(prev => (prev ? { ...prev, role: newRole } : null));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update user role');
    } finally {
      setUpdatingRole(false);
    }
  };

  const handleToggleStatus = async () => {
    if (!user) return;
    try {
      const newStatus = !user.isActive;
      await api.put(`/users/${id}/status`, { isActive: newStatus });
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      setUser(prev => (prev ? { ...prev, isActive: newStatus } : null));
    } catch (err: any) {
      toast.error('Failed to toggle user status');
    }
  };

  const handleResetOtp = async () => {
    setResettingOtp(true);
    try {
      await api.put(`/users/${id}/reset-otp`);
      toast.success('OTP attempts and block reset successfully');
    } catch (err: any) {
      toast.error('Failed to reset OTP limits');
    } finally {
      setResettingOtp(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
      case 'ACTIVE':
      case 'APPROVED':
        return 'badge badge-success';
      case 'PENDING':
        return 'badge badge-warning';
      case 'FAILED':
      case 'REJECTED':
      case 'REFUNDED':
        return 'badge badge-danger';
      default:
        return 'badge badge-neutral';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div>
        <div className="skeleton skeleton-title" style={{ width: '300px', height: '40px', marginBottom: '24px' }} />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px' }}>
          <div className="skeleton skeleton-card" style={{ height: '350px' }} />
          <div className="skeleton skeleton-card" style={{ height: '500px' }} />
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><i className="fa-solid fa-circle-exclamation" /></div>
        <h3>User not found</h3>
        <Link href="/admin/users" className="btn btn-primary mt-md">Back to Users</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-md">
          <Link href="/admin/users" className="btn btn-ghost btn-icon">
            <i className="fa-solid fa-arrow-left" />
          </Link>
          <div>
            <h1>User Details</h1>
            <p>Manage {user.name || 'Student'}&apos;s profile, role, device binding and curriculum access</p>
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '24px', alignItems: 'start' }}>
        {/* Profile Details (Left Card) */}
        <div className="card-flat" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', marginBottom: '24px' }}>
            <div className="avatar avatar-lg" style={{ width: '80px', height: '80px', fontSize: '2.5rem', marginBottom: '16px' }}>
              {user.name?.charAt(0)?.toUpperCase() || 'U'}
            </div>
            <h4 style={{ margin: 0 }}>{user.name || 'User'}</h4>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>Joined {new Date(user.createdAt).toLocaleDateString()}</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', borderTop: '1px solid var(--border-light)', paddingTop: '20px' }}>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>MOBILE</div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>+91 {user.mobile}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>EMAIL</div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{user.email || '—'}</div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ROLE</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '4px' }}>
                <select
                  className="input"
                  style={{ padding: '6px 12px', fontSize: '0.8125rem' }}
                  value={user.role}
                  onChange={(e) => handleRoleChange(e.target.value as any)}
                  disabled={updatingRole}
                >
                  <option value="STUDENT">Student</option>
                  <option value="INSTRUCTOR">Instructor</option>
                  <option value="ADMIN">Admin</option>
                </select>
              </div>
            </div>
            <div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>ACCOUNT STATUS</div>
              <div style={{ display: 'flex', gap: '8px', marginTop: '6px' }}>
                <span className={`badge ${user.isActive ? 'badge-success' : 'badge-neutral'}`}>
                  {user.isActive ? 'Active' : 'Suspended'}
                </span>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ padding: '2px 8px', fontSize: '0.75rem', color: user.isActive ? 'var(--danger)' : 'var(--success)' }}
                  onClick={handleToggleStatus}
                >
                  {user.isActive ? 'Suspend' : 'Activate'}
                </button>
              </div>
            </div>
          </div>

          <div style={{ borderTop: '1px solid var(--border-light)', marginTop: '24px', paddingTop: '20px' }}>
            <button
              className="btn btn-outline btn-sm w-full"
              onClick={handleResetOtp}
              disabled={resettingOtp}
            >
              {resettingOtp ? (
                <><div className="spinner spinner-sm" /> Resetting...</>
              ) : (
                <><i className="fa-solid fa-rotate-left" /> Reset OTP Block</>
              )}
            </button>
          </div>
        </div>

        {/* Tabular Lists (Right Section) */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          {/* Enrolled Courses */}
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-book-open" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
              Active Course Access ({courseAccesses.length})
            </h4>
            {courseAccesses.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No courses unlocked yet.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Course</th>
                      <th>Type</th>
                      <th>Granted Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {courseAccesses.map((access) => (
                      <tr key={access._id}>
                        <td style={{ fontWeight: 600 }}>{access.courseId?.title || 'Course'}</td>
                        <td>
                          <span className="badge badge-primary">{access.accessType}</span>
                        </td>
                        <td className="text-muted">{formatDate(access.grantedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Registered Devices */}
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-mobile-screen" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
              Registered Devices ({devices.length})
            </h4>
            {devices.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No devices registered for OTP binding.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Device ID</th>
                      <th>Device Name</th>
                      <th>Status</th>
                      <th>Registered</th>
                    </tr>
                  </thead>
                  <tbody>
                    {devices.map((device) => (
                      <tr key={device._id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{device.deviceId}</td>
                        <td style={{ fontWeight: 500 }}>{device.deviceName}</td>
                        <td>
                          <span className={getStatusBadge(device.status)}>{device.status}</span>
                        </td>
                        <td className="text-muted">{formatDate(device.requestedAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Purchase History */}
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-receipt" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
              Order History ({orders.length})
            </h4>
            {orders.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No purchases made by this user.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order ID</th>
                      <th>Bundle Name</th>
                      <th>Amount</th>
                      <th>Status</th>
                      <th>Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.map((order) => (
                      <tr key={order._id}>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{order._id.slice(0, 8)}...</td>
                        <td style={{ fontWeight: 500 }}>{order.bundleId?.name || 'Bundle'}</td>
                        <td style={{ fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(order.amountInr)}</td>
                        <td>
                          <span className={getStatusBadge(order.status)}>{order.status}</span>
                        </td>
                        <td className="text-muted">{formatDate(order.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
