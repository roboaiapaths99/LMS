'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Course {
  _id: string;
  title: string;
}

export default function CreateSession() {
  const router = useRouter();
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingCourses, setFetchingCourses] = useState(true);

  const [formData, setFormData] = useState({
    courseId: '',
    title: '',
    description: '',
    type: 'OPEN',
    scheduledAt: '',
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      setFetchingCourses(true);
      const { data } = await api.get('/courses');
      setCourses(data.courses || []);
      if (data.courses && data.courses.length > 0) {
        setFormData((prev) => ({ ...prev, courseId: data.courses[0]._id }));
      }
    } catch (err: any) {
      toast.error('Failed to load available course paths');
    } finally {
      setFetchingCourses(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.courseId) {
      toast.error('Please select a course pathway');
      return;
    }
    if (!formData.title || formData.title.length < 3) {
      toast.error('Session title must be at least 3 characters long');
      return;
    }
    if (!formData.scheduledAt) {
      toast.error('Please specify a scheduled date and time');
      return;
    }

    setLoading(true);
    try {
      await api.post('/sessions', formData);
      toast.success('Live Webcast scheduled successfully!');
      router.push('/instructor/sessions');
    } catch (err: any) {
      const msg = err.response?.data?.message || 'Failed to schedule live webinar';
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header and Back navigation */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 24 }}>
        <Link href="/instructor/sessions" className="btn btn-icon btn-secondary" style={{ borderRadius: '50%' }}>
          <i className="fa-solid fa-arrow-left" />
        </Link>
        <div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            Live Broadcaster Planner
          </span>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 800, margin: 0 }}>Schedule Live Webinar</h1>
        </div>
      </div>

      <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 36, border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)' }}>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          {/* Associated Course */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Course Pathway / Class Bundle <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            {fetchingCourses ? (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem', padding: '12px 16px', background: 'var(--bg-input)', borderRadius: 12 }}>
                Loading course syllabi...
              </div>
            ) : courses.length === 0 ? (
              <div style={{ border: '1px solid var(--danger-light)', background: 'var(--danger-light)', color: 'var(--danger)', borderRadius: 12, padding: '12px 16px', fontSize: '0.875rem' }}>
                <i className="fa-solid fa-circle-exclamation" style={{ marginRight: 8 }} />
                No courses found in library. You must unlock a course pathway before scheduling live webinars.
              </div>
            ) : (
              <select
                name="courseId"
                value={formData.courseId}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 12,
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}
              >
                {courses.map((course) => (
                  <option key={course._id} value={course._id}>
                    {course.title}
                  </option>
                ))}
              </select>
            )}
          </div>

          {/* Session Title */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Webinar Broadcast Title <span style={{ color: 'var(--danger)' }}>*</span>
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleChange}
              placeholder="e.g. Robot Calibration & Real-time Sensor Kinematics"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                fontSize: '0.9375rem',
                color: 'var(--text-primary)',
                fontWeight: 500,
              }}
            />
          </div>

          {/* Description */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Webinar Syllabus / Description
            </label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="Describe the lecture curriculum, target learning goals, and necessary calibrations..."
              rows={4}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: 'var(--bg-input)',
                border: '1px solid var(--border-default)',
                borderRadius: 12,
                fontSize: '0.9375rem',
                color: 'var(--text-primary)',
                fontWeight: 500,
                resize: 'vertical',
                lineHeight: 1.6,
              }}
            />
          </div>

          {/* Type & Scheduled At (Two Column) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
            {/* Access Type */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Access Mode <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <select
                name="type"
                value={formData.type}
                onChange={handleChange}
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 12,
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  cursor: 'pointer',
                }}
              >
                <option value="OPEN">OPEN (All Path Subscribers)</option>
                <option value="INVITE">INVITE (Invite Token Required)</option>
              </select>
            </div>

            {/* Scheduled At */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Scheduled Time (IST) <span style={{ color: 'var(--danger)' }}>*</span>
              </label>
              <input
                type="datetime-local"
                name="scheduledAt"
                value={formData.scheduledAt}
                onChange={handleChange}
                required
                style={{
                  width: '100%',
                  padding: '14px 16px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 12,
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                  cursor: 'text',
                }}
              />
            </div>
          </div>

          {/* Form Actions */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 16, borderTop: '1px solid var(--border-light)', paddingTop: 24, marginTop: 12 }}>
            <Link href="/instructor/sessions" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              disabled={loading || courses.length === 0}
              className="btn btn-primary"
              style={{
                minWidth: 160,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
              }}
            >
              {loading ? (
                <>
                  <i className="fa-solid fa-spinner fa-spin" /> Scheduling...
                </>
              ) : (
                <>
                  <i className="fa-regular fa-calendar-check" /> Schedule Live
                </>
              )}
            </button>
          </div>

        </form>
      </div>
    </div>
  );
}
