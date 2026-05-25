'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface OrderItem {
  _id: string;
  id?: string;
  userId: string;
  user?: { name?: string; mobile?: string };
  courseId?: string;
  course?: { title?: string };
  amount: number;
  status: string;
  createdAt: string;
}

export default function AdminDashboard() {
  const [totalUsers, setTotalUsers] = useState(0);
  const [activeCourses, setActiveCourses] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [pendingOrders, setPendingOrders] = useState(0);
  const [recentOrders, setRecentOrders] = useState<OrderItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [usersRes, coursesRes, ordersRes, revenueRes] = await Promise.allSettled([
        api.get('/admin/users'),
        api.get('/courses'),
        api.get('/admin/orders'),
        api.get('/admin/revenue'),
      ]);

      if (usersRes.status === 'fulfilled') {
        const users = usersRes.value.data.users || usersRes.value.data;
        setTotalUsers(Array.isArray(users) ? users.length : users.total || 0);
      }

      if (coursesRes.status === 'fulfilled') {
        const courses = coursesRes.value.data.courses || coursesRes.value.data;
        setActiveCourses(Array.isArray(courses) ? courses.length : 0);
      }

      if (ordersRes.status === 'fulfilled') {
        const orders = ordersRes.value.data.orders || ordersRes.value.data;
        if (Array.isArray(orders)) {
          setRecentOrders(orders.slice(0, 10));
          setPendingOrders(orders.filter((o: OrderItem) => o.status === 'PENDING').length);
        }
      }

      if (revenueRes.status === 'fulfilled') {
        const rev = revenueRes.value.data;
        setRevenue(rev.summary?.totalRevenue || rev.totalRevenue || rev.total || 0);
      }
    } catch (err: any) {
      toast.error('Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'COMPLETED':
      case 'PAID':
      case 'SUCCESS':
        return 'badge badge-success';
      case 'PENDING':
        return 'badge badge-warning';
      case 'FAILED':
      case 'REFUNDED':
        return 'badge badge-danger';
      default:
        return 'badge badge-neutral';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <h1>Dashboard</h1>
          <p>Overview of your LMS platform</p>
        </div>
        <div className="stats-grid">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="skeleton skeleton-card" style={{ height: '140px' }} />
          ))}
        </div>
        <div className="skeleton skeleton-card" style={{ height: '400px' }} />
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h1>Dashboard</h1>
        <p>Overview of your LMS platform</p>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{totalUsers}</div>
              <div className="stat-card-label">Total Users</div>
            </div>
            <div className="stat-card-icon blue">
              <i className="fa-solid fa-users" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{activeCourses}</div>
              <div className="stat-card-label">Active Courses</div>
            </div>
            <div className="stat-card-icon green">
              <i className="fa-solid fa-graduation-cap" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{formatCurrency(revenue)}</div>
              <div className="stat-card-label">Total Revenue</div>
            </div>
            <div className="stat-card-icon orange">
              <i className="fa-solid fa-indian-rupee-sign" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{pendingOrders}</div>
              <div className="stat-card-label">Pending Orders</div>
            </div>
            <div className="stat-card-icon red">
              <i className="fa-solid fa-clock" />
            </div>
          </div>
        </div>
      </div>

      {/* Recent Orders */}
      <div className="card-flat" style={{ padding: '24px' }}>
        <div className="flex items-center justify-between mb-md">
          <h4>Recent Orders</h4>
          <Link href="/admin/orders" className="btn btn-ghost btn-sm">
            View All <i className="fa-solid fa-arrow-right" />
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-receipt" />
            </div>
            <h3>No orders yet</h3>
            <p>Orders will appear here once customers make purchases.</p>
          </div>
        ) : (
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Course</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentOrders.map((order) => {
                  const orderId = order.id || order._id || '';
                  return (
                  <tr key={orderId}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {orderId.slice(0, 8)}...
                    </td>
                    <td>{order.user?.name || order.user?.mobile || '—'}</td>
                    <td>{order.course?.title || '—'}</td>
                    <td style={{ fontWeight: 600 }}>{formatCurrency(order.amount)}</td>
                    <td>
                      <span className={getStatusBadge(order.status)}>
                        {order.status}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(order.createdAt)}</td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
