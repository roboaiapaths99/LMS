'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface Course {
  id: string;
  title: string;
  category?: string;
  status?: string;
  visibility?: string;
  createdAt: string;
  thumbnailUrl?: string;
}

export default function AdminCoursesPage() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [filtered, setFiltered] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchCourses();
  }, []);

  useEffect(() => {
    let result = courses;
    if (search) {
      result = result.filter((c) =>
        c.title.toLowerCase().includes(search.toLowerCase())
      );
    }
    if (categoryFilter) {
      result = result.filter((c) => c.category === categoryFilter);
    }
    if (statusFilter) {
      result = result.filter((c) => c.status === statusFilter);
    }
    setFiltered(result);
  }, [courses, search, categoryFilter, statusFilter]);

  const fetchCourses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/courses');
      const rawList = data.courses || data || [];
      const list = rawList.map((c: any) => ({
        ...c,
        id: c._id || c.id
      }));
      setCourses(list);
      setFiltered(list);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to fetch courses');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteId) return;
    setDeleting(true);
    try {
      await api.delete(`/courses/${deleteId}`);
      toast.success('Course deleted successfully');
      setCourses((prev) => prev.filter((c) => c.id !== deleteId));
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete course');
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status?: string) => {
    switch (status?.toUpperCase()) {
      case 'PUBLISHED':
        return 'badge badge-success';
      case 'DRAFT':
        return 'badge badge-warning';
      case 'ARCHIVED':
        return 'badge badge-neutral';
      default:
        return 'badge badge-neutral';
    }
  };

  const getVisibilityBadge = (vis?: string) => {
    switch (vis?.toUpperCase()) {
      case 'STUDENT':
        return 'badge badge-info';
      case 'INSTRUCTOR':
        return 'badge badge-primary';
      case 'BOTH':
        return 'badge badge-success';
      default:
        return 'badge badge-neutral';
    }
  };

  const formatDate = (dateStr: string) =>
    new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    });

  const categories = [...new Set(courses.map((c) => c.category).filter(Boolean))];
  const statuses = [...new Set(courses.map((c) => c.status).filter(Boolean))];

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Courses</h1>
          <p>Manage all courses on your platform</p>
        </div>
        <Link href="/admin/courses/create" className="btn btn-primary">
          <i className="fa-solid fa-plus" /> Create Course
        </Link>
      </div>

      {/* Filters */}
      <div className="card-flat" style={{ padding: '16px 20px', marginBottom: '24px' }}>
        <div className="flex items-center gap-md" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 250px' }}>
            <input
              type="text"
              className="input"
              placeholder="Search courses..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <select
            className="input"
            style={{ width: '180px', flex: '0 0 auto' }}
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((cat) => (
              <option key={cat} value={cat!}>{cat}</option>
            ))}
          </select>
          <select
            className="input"
            style={{ width: '160px', flex: '0 0 auto' }}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Statuses</option>
            {statuses.map((s) => (
              <option key={s} value={s!}>{s}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-book-open" />
          </div>
          <h3>No courses found</h3>
          <p>Try adjusting your filters or create a new course.</p>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Category</th>
                <th>Status</th>
                <th>Visibility</th>
                <th>Created</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((course) => (
                <tr key={course.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{course.title}</div>
                  </td>
                  <td>
                    <span className="badge badge-primary">{course.category || '—'}</span>
                  </td>
                  <td>
                    <span className={getStatusBadge(course.status)}>
                      {course.status || 'DRAFT'}
                    </span>
                  </td>
                  <td>
                    <span className={getVisibilityBadge(course.visibility)}>
                      {course.visibility || 'PUBLIC'}
                    </span>
                  </td>
                  <td className="text-muted">{formatDate(course.createdAt)}</td>
                  <td>
                    <div className="flex gap-sm">
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => router.push(`/admin/courses/${course.id}`)}
                        title="Edit"
                      >
                        <i className="fa-solid fa-pen-to-square" />
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        onClick={() => setDeleteId(course.id)}
                        title="Delete"
                        style={{ color: 'var(--danger)' }}
                      >
                        <i className="fa-solid fa-trash" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteId && (
        <div className="modal-overlay" onClick={() => !deleting && setDeleteId(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>Delete Course</h3>
              <button className="modal-close" onClick={() => setDeleteId(null)} disabled={deleting}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>
            <p style={{ color: 'var(--text-secondary)', marginBottom: '8px' }}>
              Are you sure you want to delete this course? This action cannot be undone.
            </p>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setDeleteId(null)} disabled={deleting}>
                Cancel
              </button>
              <button className="btn btn-danger" onClick={handleDelete} disabled={deleting}>
                {deleting ? <><div className="spinner spinner-sm" /> Deleting...</> : <><i className="fa-solid fa-trash" /> Delete</>}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
