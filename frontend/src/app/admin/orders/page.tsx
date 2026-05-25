'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Order {
  id: string;
  _id: string;
  amountInr: number;
  discountAmount: number;
  payuTxnId?: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED' | 'REFUNDED';
  createdAt: string;
  userId?: {
    name?: string;
    mobile: string;
    email?: string;
  };
  bundleId?: {
    name: string;
    courseId?: {
      title: string;
    };
  };
}

interface Pagination {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState<Pagination>({ total: 0, page: 1, limit: 10, pages: 1 });
  const [loading, setLoading] = useState(true);
  
  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, [page, statusFilter]);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/orders', {
        params: {
          status: statusFilter || undefined,
          page,
          limit: 10,
        },
      });
      setOrders(data.orders || []);
      setPagination(data.pagination || { total: 0, page: 1, limit: 10, pages: 1 });
    } catch (err: any) {
      toast.error('Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmOrder = async (orderId: string) => {
    setActionLoading(orderId);
    try {
      await api.post(`/admin/orders/${orderId}/confirm`);
      toast.success('Order payment confirmed manually');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to confirm order');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRefundOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to process a refund for this order? Course access will be revoked immediately.')) {
      return;
    }
    setActionLoading(orderId);
    try {
      await api.post(`/admin/orders/${orderId}/refund`);
      toast.success('Refund processed successfully');
      fetchOrders();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to process refund');
    } finally {
      setActionLoading(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
        return 'badge badge-success';
      case 'PENDING':
        return 'badge badge-warning';
      case 'FAILED':
        return 'badge badge-neutral';
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

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Order History</h1>
          <p>Track student transactions, manage refunds, and manually confirm payments</p>
        </div>
        <a href="/api/v1/admin/export/orders" className="btn btn-secondary" target="_blank" download>
          <i className="fa-solid fa-file-csv" /> Export Orders CSV
        </a>
      </div>

      {/* Filters */}
      <div className="card-flat" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div className="flex items-center gap-md">
          <div className="input-group" style={{ width: '200px' }}>
            <label htmlFor="status-select">Status Filter</label>
            <select
              id="status-select"
              className="input"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
            >
              <option value="">All Orders</option>
              <option value="SUCCESS">Success</option>
              <option value="PENDING">Pending</option>
              <option value="FAILED">Failed</option>
              <option value="REFUNDED">Refunded</option>
            </select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : orders.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-receipt" />
          </div>
          <h3>No orders found</h3>
          <p>There are no transactions matching your selection.</p>
        </div>
      ) : (
        <>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>Customer</th>
                  <th>Course Bundle</th>
                  <th>PayU ID / Txn</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order.id || order._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {order._id.slice(0, 8)}...
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{order.userId?.name || '—'}</div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>+91 {order.userId?.mobile}</div>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {order.bundleId?.courseId?.title || 'Unknown Course'}
                      </div>
                      <div className="text-muted" style={{ fontSize: '0.75rem' }}>
                        {order.bundleId?.name || 'Bundle'}
                      </div>
                    </td>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {order.payuTxnId || '—'}
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>₹{new Intl.NumberFormat('en-IN').format(order.amountInr)}</div>
                      {order.discountAmount > 0 && (
                        <div className="text-danger" style={{ fontSize: '0.75rem' }}>
                          -₹{new Intl.NumberFormat('en-IN').format(order.discountAmount)}
                        </div>
                      )}
                    </td>
                    <td>
                      <span className={getStatusBadge(order.status)}>{order.status}</span>
                    </td>
                    <td className="text-muted">{formatDate(order.createdAt)}</td>
                    <td>
                      <div className="flex gap-sm">
                        {order.status === 'PENDING' && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleConfirmOrder(order.id || order._id)}
                            disabled={actionLoading !== null}
                          >
                            {actionLoading === (order.id || order._id) ? (
                              <div className="spinner spinner-sm" />
                            ) : (
                              'Confirm'
                            )}
                          </button>
                        )}
                        {order.status === 'SUCCESS' && (
                          <button
                            className="btn btn-outline btn-sm text-danger"
                            onClick={() => handleRefundOrder(order.id || order._id)}
                            disabled={actionLoading !== null}
                            style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}
                          >
                            {actionLoading === (order.id || order._id) ? (
                              <div className="spinner spinner-sm" />
                            ) : (
                              'Refund'
                            )}
                          </button>
                        )}
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
                onClick={() => setPage((prev) => Math.max(prev - 1, 1))}
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
                onClick={() => setPage((prev) => Math.min(prev + 1, pagination.pages))}
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
