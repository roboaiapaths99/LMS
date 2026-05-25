'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
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

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function AdminUsersPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('');
  const [page, setPage] = useState(1);

  useEffect(() => {
    fetchUsers();
  }, [page, role]);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/users', {
        params: {
          search: search || undefined,
          role: role || undefined,
          page,
          limit: 10,
        },
      });
      setUsers(data.users || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, pages: 1 });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch users');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchUsers();
  };

  const handleToggleStatus = async (user: User) => {
    try {
      const newStatus = !user.isActive;
      await api.put(`/users/${user.id || user._id}/status`, { isActive: newStatus });
      toast.success(`User ${newStatus ? 'activated' : 'deactivated'} successfully`);
      setUsers(prev => prev.map(u => (u._id === user._id || u.id === user.id ? { ...u, isActive: newStatus } : u)));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update user status');
    }
  };

  const getRoleBadge = (roleStr: string) => {
    switch (roleStr) {
      case 'ADMIN':
        return 'badge badge-danger';
      case 'INSTRUCTOR':
        return 'badge badge-warning';
      case 'STUDENT':
      default:
        return 'badge badge-primary';
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>User Management</h1>
          <p>View profiles, update roles, manage devices, and configure access settings</p>
        </div>
        <a href="/api/v1/admin/export/users" className="btn btn-secondary" target="_blank" download>
          <i className="fa-solid fa-file-csv" /> Export CSV
        </a>
      </div>

      {/* Filters bar */}
      <div className="card-flat" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <form onSubmit={handleSearchSubmit} className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px' }}>
            <input
              type="text"
              className="input"
              placeholder="Search by name, email, or mobile..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input"
            style={{ width: '180px', flex: '0 0 auto' }}
            value={role}
            onChange={(e) => {
              setRole(e.target.value);
              setPage(1);
            }}
          >
            <option value="">All Roles</option>
            <option value="ADMIN">Admin</option>
            <option value="INSTRUCTOR">Instructor</option>
            <option value="STUDENT">Student</option>
          </select>
          <button type="submit" className="btn btn-primary">
            <i className="fa-solid fa-magnifying-glass" /> Search
          </button>
        </form>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : users.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-users-slash" />
          </div>
          <h3>No users found</h3>
          <p>Try refining your search terms or filters.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Mobile</th>
                  <th>Email</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Joined</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id || user._id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{user.name || '—'}</div>
                    </td>
                    <td>+91 {user.mobile}</td>
                    <td>{user.email || '—'}</td>
                    <td>
                      <span className={getRoleBadge(user.role)}>{user.role}</span>
                    </td>
                    <td>
                      <span className={`badge ${user.isActive ? 'badge-success' : 'badge-neutral'}`}>
                        {user.isActive ? 'Active' : 'Suspended'}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(user.createdAt)}</td>
                    <td>
                      <div className="flex gap-sm">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => router.push(`/admin/users/${user.id || user._id}`)}
                          title="View Details"
                        >
                          <i className="fa-solid fa-user-gear" />
                        </button>
                        <button
                          className={`btn btn-ghost btn-sm ${user.isActive ? 'text-danger' : 'text-success'}`}
                          onClick={() => handleToggleStatus(user)}
                          title={user.isActive ? 'Suspend' : 'Activate'}
                        >
                          <i className={`fa-solid ${user.isActive ? 'fa-user-slash' : 'fa-user-check'}`} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {pagination.pages > 1 && (
            <div className="pagination">
              <button
                className="pagination-btn"
                onClick={() => setPage(prev => Math.max(prev - 1, 1))}
                disabled={page === 1}
              >
                <i className="fa-solid fa-chevron-left" />
              </button>
              {Array.from({ length: pagination.pages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  className={`pagination-btn ${page === p ? 'active' : ''}`}
                  onClick={() => setPage(p)}
                >
                  {p}
                </button>
              ))}
              <button
                className="pagination-btn"
                onClick={() => setPage(prev => Math.min(prev + 1, pagination.pages))}
                disabled={page === pagination.pages}
              >
                <i className="fa-solid fa-chevron-right" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
