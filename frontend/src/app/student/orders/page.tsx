'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Order {
  _id: string;
  amountInr: number;
  discountAmount: number;
  payuTxnId: string;
  status: string;
  createdAt: string;
  bundleId?: {
    name: string;
    courseId?: {
      title: string;
    };
  };
}

export default function StudentOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      setOrders(data.orders || []);
    } catch (err: any) {
      toast.error('Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadInvoice = async (orderId: string) => {
    setDownloadingId(orderId);
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

      if (!response.ok) throw new Error('Invoice download failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `invoice_${orderId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      toast.success('Invoice downloaded successfully!');
    } catch (err) {
      toast.error('Failed to download invoice PDF');
    } finally {
      setDownloadingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status?.toUpperCase()) {
      case 'SUCCESS':
      case 'PAID':
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
    <div className="fade-in orders-page">
      <div className="page-header">
        <h1>Purchase History</h1>
        <p>Review your learning pathway invoices and order details.</p>
      </div>

      {orders.length === 0 ? (
        <div className="empty-state card-flat" style={{ padding: 48 }}>
          <div className="empty-state-icon">
            <i className="fa-solid fa-receipt" />
          </div>
          <h3>No purchase history</h3>
          <p>You haven't made any purchases yet. Your billing orders will be displayed here.</p>
        </div>
      ) : (
        <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-light)' }}>
          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th>Transaction ID</th>
                  <th>Pathway Course</th>
                  <th>Bundle Name</th>
                  <th>Amount</th>
                  <th>Status</th>
                  <th>Date</th>
                  <th>Invoice</th>
                </tr>
              </thead>
              <tbody>
                {orders.map((order) => (
                  <tr key={order._id}>
                    <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>
                      {order.payuTxnId || order._id.slice(0, 10).toUpperCase()}
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {order.bundleId?.courseId?.title || 'Syllabus Pathway'}
                    </td>
                    <td>{order.bundleId?.name || 'Custom Bundle'}</td>
                    <td style={{ fontWeight: 700, color: 'var(--tech-blue)' }}>
                      {formatCurrency(order.amountInr)}
                    </td>
                    <td>
                      <span className={getStatusBadge(order.status)}>
                        {order.status}
                      </span>
                    </td>
                    <td className="text-muted">{formatDate(order.createdAt)}</td>
                    <td>
                      {order.status === 'SUCCESS' ? (
                        <button
                          onClick={() => handleDownloadInvoice(order._id)}
                          className="invoice-btn"
                          disabled={downloadingId === order._id}
                        >
                          <i className="fa-solid fa-file-pdf" />
                          {downloadingId === order._id ? 'Downloading...' : 'Invoice'}
                        </button>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.8125rem' }}>—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
