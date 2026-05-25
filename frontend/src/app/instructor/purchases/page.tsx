'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Order {
  _id: string;
  payuTxnId: string;
  amountInr: number;
  status: string;
  createdAt: string;
  bundleId?: {
    name: string;
    type: string;
    courseId?: {
      _id: string;
      title: string;
    };
  };
}

export default function InstructorPurchases() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders || []);
    } catch (err: any) {
      toast.error('Failed to load orders history');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/orders/${orderId}/invoice`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Invoice unavailable');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error('Invoice PDF download failed.');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="welcome-card" style={{ background: 'linear-gradient(135deg, var(--dark-navy) 0%, #3b82f6 100%)' }}>
        <h1>Purchases & Billing Log</h1>
        <p>View your unlocked course path bills, sandbox logs, and download standard GST-compliant PDF invoice receipts.</p>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 32, border: '1px solid var(--border-light)' }}>
        {orders.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px 0' }}>
            <div className="empty-state-icon">
              <i className="fa-solid fa-receipt" />
            </div>
            <h3>No purchases found</h3>
            <p>You haven't initiated any payment transactions yet.</p>
            <Link href="/instructor/catalogue" className="btn btn-primary mt-md">
              Browse Catalogue
            </Link>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="table" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-default)' }}>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Syllabus / Product</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Transaction ID</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Date</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Amount</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600 }}>Status</th>
                  <th style={{ padding: '16px 20px', color: 'var(--text-muted)', fontSize: '0.8125rem', fontWeight: 600, textAlign: 'right' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id} style={{ borderBottom: '1px solid var(--border-light)' }}>
                    <td style={{ padding: '20px' }}>
                      <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>
                        {order.bundleId?.courseId?.title || 'Syllabus Course'}
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Bundle: {order.bundleId?.name || 'Instructor Guide'} ({order.bundleId?.type.replace('_', ' ')})
                      </span>
                    </td>
                    <td style={{ padding: '20px', fontFamily: 'monospace', fontSize: '0.75rem' }}>{order.payuTxnId}</td>
                    <td style={{ padding: '20px', fontSize: '0.8125rem' }}>{formatDate(order.createdAt)}</td>
                    <td style={{ padding: '20px', fontWeight: 700, fontSize: '0.875rem' }}>₹{order.amountInr}</td>
                    <td style={{ padding: '20px' }}>
                      <span
                        className="badge"
                        style={{
                          fontSize: '0.6875rem',
                          background:
                            order.status === 'SUCCESS'
                              ? 'var(--success-light)'
                              : order.status === 'PENDING'
                              ? 'var(--warning-light)'
                              : 'var(--danger-light)',
                          color:
                            order.status === 'SUCCESS'
                              ? 'var(--success)'
                              : order.status === 'PENDING'
                              ? 'var(--warning)'
                              : 'var(--danger)',
                          textTransform: 'uppercase'
                        }}
                      >
                        {order.status}
                      </span>
                    </td>
                    <td style={{ padding: '20px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
                        {order.status === 'SUCCESS' ? (
                          <>
                            <button
                              className="btn btn-secondary btn-sm"
                              onClick={() => handleDownloadInvoice(order._id)}
                              title="Download Invoice"
                            >
                              <i className="fa-solid fa-file-arrow-down" /> Invoice
                            </button>
                            <Link
                              href={`/instructor/library/${order.bundleId?.courseId?._id}`}
                              className="btn btn-primary btn-sm"
                            >
                              Classroom
                            </Link>
                          </>
                        ) : (
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>—</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
