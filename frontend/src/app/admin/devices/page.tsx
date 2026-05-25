'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface UserInfo {
  _id: string;
  name?: string;
  mobile: string;
  email?: string;
}

interface DeviceRequest {
  _id: string;
  userId: UserInfo;
  deviceId: string;
  deviceName: string;
  status: 'PENDING' | 'ACTIVE' | 'REJECTED';
  requestedAt: string;
}

interface AuditLog {
  _id: string;
  userId?: { name?: string };
  action: string;
  entityType: string;
  entityId: string;
  ipAddress?: string;
  details?: any;
  createdAt: string;
}

export default function AdminDevicesPage() {
  const [requests, setRequests] = useState<DeviceRequest[]>([]);
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState<string | null>(null);

  // Rejection modal state
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [requestsRes, logsRes] = await Promise.allSettled([
        api.get('/devices/admin/devices/requests'),
        api.get('/devices/admin/devices/log'),
      ]);

      if (requestsRes.status === 'fulfilled') {
        setRequests(requestsRes.value.data.requests || []);
      } else {
        toast.error('Failed to load device requests');
      }

      if (logsRes.status === 'fulfilled') {
        setLogs(logsRes.value.data.logs || []);
      }
    } catch (err: any) {
      toast.error('Failed to load devices dashboard data');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    setSubmitting(id);
    try {
      await api.put(`/devices/admin/devices/${id}/approve`);
      toast.success('Device request approved successfully');
      // Refresh
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to approve request');
    } finally {
      setSubmitting(null);
    }
  };

  const handleOpenReject = (id: string) => {
    setRejectingId(id);
    setRejectReason('');
  };

  const handleRejectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectingId) return;

    setSubmitting(rejectingId);
    try {
      await api.put(`/devices/admin/devices/${rejectingId}/reject`, {
        reason: rejectReason || 'Rejected by Admin',
      });
      toast.success('Device request rejected');
      setRejectingId(null);
      fetchData();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reject request');
    } finally {
      setSubmitting(null);
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
      <div className="page-header">
        <h1>Device Requests</h1>
        <p>Approve or reject new device binding requests from students and view binding audit logs</p>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Pending Queue */}
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }} className="flex items-center gap-sm">
              <i className="fa-solid fa-clock-rotate-left" style={{ color: 'var(--tech-blue)' }} />
              Pending Requests ({requests.length})
            </h4>

            {requests.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <i className="fa-solid fa-laptop-medical" />
                </div>
                <h3>No pending requests</h3>
                <p>Everything is up to date! There are no device requests awaiting approval.</p>
              </div>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>User</th>
                      <th>Mobile</th>
                      <th>Device Name</th>
                      <th>Device ID</th>
                      <th>Requested At</th>
                      <th style={{ textAlign: 'right' }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {requests.map((req) => (
                      <tr key={req._id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{req.userId?.name || '—'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{req.userId?.email || '—'}</div>
                        </td>
                        <td>+91 {req.userId?.mobile}</td>
                        <td style={{ fontWeight: 500 }}>{req.deviceName || 'Unknown Device'}</td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{req.deviceId}</td>
                        <td className="text-muted">{formatDate(req.requestedAt)}</td>
                        <td>
                          <div className="flex gap-sm justify-end">
                            <button
                              className="btn btn-primary btn-sm"
                              onClick={() => handleApprove(req._id)}
                              disabled={submitting !== null}
                            >
                              {submitting === req._id ? (
                                <div className="spinner spinner-sm" />
                              ) : (
                                <><i className="fa-solid fa-check" /> Approve</>
                              )}
                            </button>
                            <button
                              className="btn btn-secondary btn-sm text-danger"
                              onClick={() => handleOpenReject(req._id)}
                              disabled={submitting !== null}
                            >
                              <i className="fa-solid fa-xmark" /> Reject
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Audit Logs */}
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }} className="flex items-center gap-sm">
              <i className="fa-solid fa-shield-halved" style={{ color: 'var(--tech-blue)' }} />
              Device Binding Audit Log
            </h4>

            {logs.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No audit logs recorded yet.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Operator</th>
                      <th>Action</th>
                      <th>Target ID</th>
                      <th>IP Address</th>
                      <th>Reason / Details</th>
                      <th>Timestamp</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs.map((log) => (
                      <tr key={log._id}>
                        <td style={{ fontWeight: 500 }}>{log.userId?.name || 'System / Admin'}</td>
                        <td>
                          <span
                            className={`badge ${
                              log.action === 'DEVICE_APPROVE'
                                ? 'badge-success'
                                : log.action === 'DEVICE_REJECT'
                                ? 'badge-danger'
                                : 'badge-neutral'
                            }`}
                          >
                            {log.action.replace('DEVICE_', '')}
                          </span>
                        </td>
                        <td style={{ fontFamily: 'monospace', fontSize: '0.8125rem' }}>{log.entityId}</td>
                        <td className="text-muted">{log.ipAddress || '—'}</td>
                        <td>
                          <span style={{ fontSize: '0.8125rem' }}>
                            {log.details?.reason || log.details?.rejectionReason || '—'}
                          </span>
                        </td>
                        <td className="text-muted">{formatDate(log.createdAt)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Rejection Modal */}
      {rejectingId && (
        <>
          <div className="modal-overlay" onClick={() => setRejectingId(null)} style={{ zIndex: 100 }} />
          <div className="modal card" style={{ zIndex: 101, maxWidth: '480px', padding: '24px', position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)' }}>
            <div className="flex items-center justify-between mb-md">
              <h4 style={{ margin: 0 }}>Reject Device Request</h4>
              <button className="btn btn-icon btn-ghost" onClick={() => setRejectingId(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleRejectSubmit}>
              <div className="input-group mb-md">
                <label>Rejection Reason</label>
                <textarea
                  className="input"
                  style={{ minHeight: '100px', resize: 'vertical' }}
                  placeholder="Provide a reason why this device binding is rejected (e.g. Student exceeds max devices limits)..."
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  required
                />
              </div>
              <div className="flex justify-end gap-sm">
                <button type="button" className="btn btn-secondary" onClick={() => setRejectingId(null)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-danger" disabled={submitting !== null}>
                  {submitting ? <div className="spinner spinner-sm" /> : 'Confirm Reject'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
