'use client';

import { useState } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function AdminCreateCoursePage() {
  const router = useRouter();
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: '',
    visibility: 'STUDENT',
  });
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.title.trim()) {
      toast.error('Course title is required');
      return;
    }

    setSubmitting(true);
    try {
      const { data } = await api.post('/courses', form);
      toast.success('Course created successfully!');
      const courseId = data.course?._id || data.course?.id || data.id || data._id;
      router.push(courseId ? `/admin/courses/${courseId}` : '/admin/courses');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create course');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-md mb-sm">
          <Link href="/admin/courses" className="btn btn-ghost btn-icon">
            <i className="fa-solid fa-arrow-left" />
          </Link>
          <div>
            <h1>Create Course</h1>
            <p>Add a new course to your platform</p>
          </div>
        </div>
      </div>

      <div className="card-flat" style={{ maxWidth: '720px', padding: '32px' }}>
        <form onSubmit={handleSubmit}>
          <div className="input-group mb-lg">
            <label htmlFor="title">Course Title *</label>
            <input
              type="text"
              id="title"
              name="title"
              className="input"
              placeholder="Enter course title"
              value={form.title}
              onChange={handleChange}
              required
            />
          </div>

          <div className="input-group mb-lg">
            <label htmlFor="description">Description</label>
            <textarea
              id="description"
              name="description"
              className="input"
              placeholder="Enter course description"
              value={form.description}
              onChange={handleChange}
              rows={5}
            />
          </div>

          <div className="flex gap-lg" style={{ flexWrap: 'wrap' }}>
            <div className="input-group mb-lg" style={{ flex: '1 1 250px' }}>
              <label htmlFor="category">Category</label>
              <input
                type="text"
                id="category"
                name="category"
                className="input"
                placeholder="e.g. Robotics, AI, IoT"
                value={form.category}
                onChange={handleChange}
              />
            </div>

            <div className="input-group mb-lg" style={{ flex: '1 1 250px' }}>
              <label htmlFor="visibility">Visibility</label>
              <select
                id="visibility"
                name="visibility"
                className="input"
                value={form.visibility}
                onChange={handleChange}
              >
                <option value="STUDENT">Student Only</option>
                <option value="INSTRUCTOR">Instructor Only</option>
                <option value="BOTH">Both Roles</option>
              </select>
            </div>
          </div>

          <div className="flex gap-md" style={{ marginTop: '8px' }}>
            <button type="submit" className="btn btn-primary btn-lg" disabled={submitting}>
              {submitting ? (
                <><div className="spinner spinner-sm" /> Creating...</>
              ) : (
                <><i className="fa-solid fa-plus" /> Create Course</>
              )}
            </button>
            <Link href="/admin/courses" className="btn btn-secondary btn-lg">
              Cancel
            </Link>
          </div>
        </form>
      </div>
    </div>
  );
}
