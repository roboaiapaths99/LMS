'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Course {
  _id: string;
  title: string;
}

interface Bundle {
  _id: string;
  name: string;
  type: string;
  priceInr: number;
}

interface Coupon {
  _id: string;
  code: string;
  bundleId: {
    _id: string;
    name: string;
    courseId?: {
      _id: string;
      title: string;
    };
  };
  discountType: 'FLAT' | 'PERCENT';
  discountValue: number;
  expiresAt?: string;
  maxUses: number;
  usedCount: number;
}

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<Coupon | null>(null);

  // Form State
  const [code, setCode] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedBundleId, setSelectedBundleId] = useState('');
  const [discountType, setDiscountType] = useState<'FLAT' | 'PERCENT'>('PERCENT');
  const [discountValue, setDiscountValue] = useState<number>(10);
  const [expiresAt, setExpiresAt] = useState('');
  const [maxUses, setMaxUses] = useState<number>(0);

  useEffect(() => {
    fetchCoupons();
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchBundles(selectedCourseId);
    } else {
      setBundles([]);
    }
  }, [selectedCourseId]);

  const fetchCoupons = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/coupons');
      setCoupons(data.coupons || []);
    } catch (err: any) {
      toast.error('Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      setCourses(data.courses || data || []);
    } catch (err: any) {
      toast.error('Failed to load courses');
    }
  };

  const fetchBundles = async (courseId: string) => {
    try {
      const { data } = await api.get(`/bundles/${courseId}`);
      setBundles(data.bundles || []);
    } catch (err: any) {
      toast.error('Failed to load bundles for the selected course');
    }
  };

  const handleOpenCreateModal = () => {
    setEditingCoupon(null);
    setCode('');
    setSelectedCourseId('');
    setSelectedBundleId('');
    setDiscountType('PERCENT');
    setDiscountValue(10);
    setExpiresAt('');
    setMaxUses(0);
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (coupon: Coupon) => {
    setEditingCoupon(coupon);
    setCode(coupon.code);
    setSelectedCourseId(coupon.bundleId?.courseId?._id || '');
    setSelectedBundleId(coupon.bundleId?._id || '');
    setDiscountType(coupon.discountType);
    setDiscountValue(coupon.discountValue);
    setExpiresAt(coupon.expiresAt ? coupon.expiresAt.split('T')[0] : '');
    setMaxUses(coupon.maxUses);
    setIsModalOpen(true);
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedBundleId) {
      toast.error('Please select a course bundle');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        discountType,
        discountValue,
        expiresAt: expiresAt || undefined,
        maxUses,
        ...(editingCoupon
          ? {}
          : {
              code: code.toUpperCase().trim(),
              bundleId: selectedBundleId,
            }),
      };

      if (editingCoupon) {
        await api.put(`/admin/coupons/${editingCoupon._id}`, payload);
        toast.success('Coupon updated successfully');
      } else {
        await api.post('/admin/coupons', payload);
        toast.success('Coupon created successfully');
      }

      setIsModalOpen(false);
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCoupon = async (id: string) => {
    if (!confirm('Are you sure you want to deactivate/delete this coupon?')) return;

    try {
      await api.delete(`/admin/coupons/${id}`);
      toast.success('Coupon deleted successfully');
      fetchCoupons();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete coupon');
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return 'Never';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });
  };

  const isExpired = (expiresAtStr?: string) => {
    if (!expiresAtStr) return false;
    return new Date(expiresAtStr) < new Date();
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Coupon Management</h1>
          <p>Create and manage discount coupons for courses and combo bundles</p>
        </div>
        <button className="btn btn-primary" onClick={handleOpenCreateModal}>
          <i className="fa-solid fa-plus" /> Create Coupon
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : coupons.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-ticket-simple" />
          </div>
          <h3>No coupons available</h3>
          <p>Create discount campaigns for RoboAIAPaths combo or single bundles here.</p>
          <button className="btn btn-primary mt-md" onClick={handleOpenCreateModal}>
            Create First Coupon
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Code</th>
                <th>Applicable Course / Bundle</th>
                <th>Discount</th>
                <th>Expiry</th>
                <th>Usage</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => {
                const expired = isExpired(coupon.expiresAt);
                const limitReached = coupon.maxUses > 0 && coupon.usedCount >= coupon.maxUses;
                const active = !expired && !limitReached;

                return (
                  <tr key={coupon._id}>
                    <td>
                      <span
                        style={{
                          fontFamily: 'monospace',
                          fontSize: '1rem',
                          fontWeight: 700,
                          letterSpacing: '0.05em',
                          color: active ? 'var(--tech-blue)' : 'var(--text-secondary)',
                          background: 'rgba(0, 110, 255, 0.06)',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px dashed rgba(0, 110, 255, 0.2)',
                        }}
                      >
                        {coupon.code}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>
                        {coupon.bundleId?.courseId?.title || 'Unknown Course'}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Bundle: {coupon.bundleId?.name || 'Bundle'}
                      </div>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      {coupon.discountType === 'PERCENT' ? (
                        <span style={{ color: 'var(--success)' }}>{coupon.discountValue}% OFF</span>
                      ) : (
                        <span>₹{coupon.discountValue} FLAT</span>
                      )}
                    </td>
                    <td className={expired ? 'text-danger' : 'text-muted'}>
                      {formatDate(coupon.expiresAt)}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500 }}>
                        {coupon.usedCount} used
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        Max uses: {coupon.maxUses === 0 ? 'Unlimited' : coupon.maxUses}
                      </div>
                    </td>
                    <td>
                      <span className={`badge ${active ? 'badge-success' : 'badge-neutral'}`}>
                        {expired ? 'Expired' : limitReached ? 'Limit Reached' : 'Active'}
                      </span>
                    </td>
                    <td>
                      <div className="flex gap-sm justify-end">
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => handleOpenEditModal(coupon)}
                          title="Edit Coupon"
                        >
                          <i className="fa-solid fa-pen-to-square" />
                        </button>
                        <button
                          className="btn btn-ghost btn-sm text-danger"
                          onClick={() => handleDeleteCoupon(coupon._id)}
                          title="Deactivate Coupon"
                        >
                          <i className="fa-solid fa-trash-can" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal Dialog */}
      {isModalOpen && (
        <>
          <div className="modal-overlay" onClick={() => setIsModalOpen(false)} style={{ zIndex: 100 }} />
          <div
            className="modal card"
            style={{
              zIndex: 101,
              maxWidth: '520px',
              padding: '28px',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div className="flex items-center justify-between mb-lg">
              <h4 style={{ margin: 0 }}>
                {editingCoupon ? 'Edit Coupon Campaign' : 'Create New Coupon'}
              </h4>
              <button className="btn btn-icon btn-ghost" onClick={() => setIsModalOpen(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleFormSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              
              {!editingCoupon && (
                <>
                  <div className="input-group">
                    <label>Coupon Code</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. LAUNCH50"
                      value={code}
                      onChange={(e) => setCode(e.target.value.toUpperCase())}
                      required
                    />
                  </div>

                  <div className="input-group">
                    <label>Select Course</label>
                    <select
                      className="input"
                      value={selectedCourseId}
                      onChange={(e) => setSelectedCourseId(e.target.value)}
                      required
                    >
                      <option value="">-- Choose Course --</option>
                      {courses.map((course) => (
                        <option key={course._id} value={course._id}>
                          {course.title}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="input-group">
                    <label>Select Bundle</label>
                    <select
                      className="input"
                      value={selectedBundleId}
                      onChange={(e) => setSelectedBundleId(e.target.value)}
                      required
                      disabled={!selectedCourseId}
                    >
                      <option value="">-- Choose Pricing Bundle --</option>
                      {bundles.map((bundle) => (
                        <option key={bundle._id} value={bundle._id}>
                          {bundle.name} ({bundle.type}) - ₹{bundle.priceInr}
                        </option>
                      ))}
                    </select>
                  </div>
                </>
              )}

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Discount Type</label>
                  <select
                    className="input"
                    value={discountType}
                    onChange={(e) => setDiscountType(e.target.value as any)}
                    required
                  >
                    <option value="PERCENT">Percentage (%)</option>
                    <option value="FLAT">Flat Amount (INR)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Discount Value</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    value={discountValue}
                    onChange={(e) => setDiscountValue(Number(e.target.value))}
                    required
                  />
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Expiry Date (Optional)</label>
                  <input
                    type="date"
                    className="input"
                    value={expiresAt}
                    onChange={(e) => setExpiresAt(e.target.value)}
                  />
                </div>

                <div className="input-group">
                  <label>Max Usage Limit</label>
                  <input
                    type="number"
                    className="input"
                    min={0}
                    placeholder="0 for Unlimited"
                    value={maxUses}
                    onChange={(e) => setMaxUses(Number(e.target.value))}
                    required
                  />
                  <div className="input-help">Use 0 for no limit</div>
                </div>
              </div>

              <div className="flex justify-end gap-sm" style={{ marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <div className="spinner spinner-sm" /> : 'Save Coupon'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}
    </div>
  );
}
