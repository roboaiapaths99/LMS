'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Course {
  id: string;
  _id: string;
  title: string;
}

interface Bundle {
  id: string;
  _id: string;
  name: string;
  type: 'VIDEO_ONLY' | 'PDF_ONLY' | 'COMBO';
  priceInr: number;
  isActive: boolean;
}

export default function AdminBundlesPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<string>('');
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [loadingCourses, setLoadingCourses] = useState(true);
  const [loadingBundles, setLoadingBundles] = useState(false);
  
  // Modal states
  const [showModal, setShowModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [form, setForm] = useState({
    name: '',
    type: 'COMBO',
    priceInr: 0,
  });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchBundles(selectedCourseId);
    } else {
      setBundles([]);
    }
  }, [selectedCourseId]);

  const fetchCourses = async () => {
    setLoadingCourses(true);
    try {
      const { data } = await api.get('/courses');
      const list = data.courses || data || [];
      setCourses(list);
      if (list.length > 0) {
        setSelectedCourseId(list[0].id || list[0]._id);
      }
    } catch (err: any) {
      toast.error('Failed to fetch courses');
    } finally {
      setLoadingCourses(false);
    }
  };

  const fetchBundles = async (courseId: string) => {
    setLoadingBundles(true);
    try {
      const { data } = await api.get(`/bundles/${courseId}`);
      setBundles(data.bundles || []);
    } catch (err: any) {
      toast.error('Failed to fetch bundles');
    } finally {
      setLoadingBundles(false);
    }
  };

  const handleOpenCreate = () => {
    setEditingBundle(null);
    setForm({
      name: '',
      type: 'COMBO',
      priceInr: 0,
    });
    setShowModal(true);
  };

  const handleOpenEdit = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setForm({
      name: bundle.name,
      type: bundle.type,
      priceInr: bundle.priceInr,
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) {
      toast.error('Name is required');
      return;
    }
    if (form.priceInr < 0) {
      toast.error('Price cannot be negative');
      return;
    }

    setSaving(true);
    try {
      if (editingBundle) {
        await api.put(`/bundles/${editingBundle.id || editingBundle._id}`, form);
        toast.success('Bundle updated successfully');
      } else {
        await api.post('/bundles', {
          courseId: selectedCourseId,
          ...form,
        });
        toast.success('Bundle created successfully');
      }
      setShowModal(false);
      fetchBundles(selectedCourseId);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to save bundle');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleActive = async (bundle: Bundle) => {
    try {
      const activeState = !bundle.isActive;
      await api.put(`/bundles/${bundle.id || bundle._id}`, {
        isActive: activeState,
      });
      toast.success(`Bundle ${activeState ? 'activated' : 'deactivated'} successfully`);
      fetchBundles(selectedCourseId);
    } catch (err: any) {
      toast.error('Failed to toggle bundle status');
    }
  };

  const getBundleTypeBadge = (type: string) => {
    switch (type) {
      case 'VIDEO_ONLY':
        return 'badge badge-primary';
      case 'PDF_ONLY':
        return 'badge badge-warning';
      case 'COMBO':
      default:
        return 'badge badge-success';
    }
  };

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Bundle Management</h1>
          <p>Configure pricing bundles (Video, PDF, or Combo) for your courses</p>
        </div>
        {selectedCourseId && (
          <button className="btn btn-primary" onClick={handleOpenCreate}>
            <i className="fa-solid fa-plus" /> Create Bundle
          </button>
        )}
      </div>

      <div className="card-flat" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div className="input-group" style={{ maxWidth: '400px' }}>
          <label htmlFor="course-select">Select Course</label>
          <select
            id="course-select"
            className="input"
            value={selectedCourseId}
            onChange={(e) => setSelectedCourseId(e.target.value)}
            disabled={loadingCourses}
          >
            {loadingCourses ? (
              <option>Loading courses...</option>
            ) : courses.length === 0 ? (
              <option>No courses available</option>
            ) : (
              courses.map((c) => (
                <option key={c.id || c._id} value={c.id || c._id}>
                  {c.title}
                </option>
              ))
            )}
          </select>
        </div>
      </div>

      {loadingBundles ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : !selectedCourseId ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <h3>Select a course</h3>
          <p>Please select a course to manage its bundles.</p>
        </div>
      ) : bundles.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-box" />
          </div>
          <h3>No bundles configured</h3>
          <p>There are no active bundles for this course. Click "Create Bundle" to set one up.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Bundle Name</th>
                <th>Type</th>
                <th>Price (INR)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {bundles.map((bundle) => (
                <tr key={bundle.id || bundle._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{bundle.name}</div>
                  </td>
                  <td>
                    <span className={getBundleTypeBadge(bundle.type)}>{bundle.type}</span>
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    ₹{new Intl.NumberFormat('en-IN').format(bundle.priceInr)}
                  </td>
                  <td>
                    <span className={`badge ${bundle.isActive ? 'badge-success' : 'badge-neutral'}`}>
                      {bundle.isActive ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-sm">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => handleOpenEdit(bundle)}
                        title="Edit"
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      <button
                        className={`btn btn-ghost btn-sm ${bundle.isActive ? 'text-danger' : 'text-success'}`}
                        onClick={() => handleToggleActive(bundle)}
                        title={bundle.isActive ? 'Deactivate' : 'Activate'}
                      >
                        <i className={`fa-solid ${bundle.isActive ? 'fa-ban' : 'fa-circle-check'}`} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="modal-overlay" onClick={() => !saving && setShowModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{editingBundle ? 'Edit Bundle' : 'Create Bundle'}</h3>
              <button className="modal-close" onClick={() => setShowModal(false)} disabled={saving}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="input-group mb-lg">
                <label htmlFor="name">Bundle Name *</label>
                <input
                  type="text"
                  id="name"
                  className="input"
                  placeholder="e.g. Complete Combo Pack"
                  value={form.name}
                  onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                  required
                />
              </div>

              <div className="input-group mb-lg">
                <label htmlFor="type">Bundle Content Type *</label>
                <select
                  id="type"
                  className="input"
                  value={form.type}
                  onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value }))}
                >
                  <option value="COMBO">Video + PDF (Combo)</option>
                  <option value="VIDEO_ONLY">Video Only</option>
                  <option value="PDF_ONLY">PDF Only</option>
                </select>
              </div>

              <div className="input-group mb-lg">
                <label htmlFor="priceInr">Price (INR) *</label>
                <input
                  type="number"
                  id="priceInr"
                  className="input"
                  value={form.priceInr}
                  onChange={(e) => setForm((prev) => ({ ...prev, priceInr: Number(e.target.value) }))}
                  min={0}
                  required
                />
              </div>

              <div className="modal-footer">
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setShowModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={saving}>
                  {saving ? (
                    <><div className="spinner spinner-sm" /> Saving...</>
                  ) : (
                    <><i className="fa-solid fa-floppy-disk" /> Save Bundle</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
