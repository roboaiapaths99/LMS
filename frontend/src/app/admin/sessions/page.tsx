'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Course {
  _id: string;
  title: string;
}

interface Instructor {
  _id: string;
  name: string;
}

interface LiveSession {
  _id: string;
  instructorId: Instructor;
  courseId: Course;
  title: string;
  description?: string;
  type: 'INVITE' | 'OPEN';
  inviteToken?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  aiSummary?: string;
}

export default function AdminSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<string | null>(null);

  // Form State
  const [courseId, setCourseId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [type, setType] = useState<'INVITE' | 'OPEN'>('OPEN');
  const [scheduledAt, setScheduledAt] = useState('');

  useEffect(() => {
    fetchSessions();
    fetchCourses();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions || []);
    } catch (err: any) {
      toast.error('Failed to load live sessions');
    } finally {
      setLoading(false);
    }
  };

  const fetchCourses = async () => {
    try {
      const { data } = await api.get('/courses');
      setCourses(data.courses || data || []);
    } catch (err: any) {
      toast.error('Failed to load courses for scheduling');
    }
  };

  const handleCreateSession = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      toast.error('Please select a course');
      return;
    }

    setSubmitting(true);
    try {
      await api.post('/sessions', {
        courseId,
        title,
        description,
        type,
        scheduledAt: new Date(scheduledAt).toISOString(),
      });
      toast.success('Live session scheduled successfully');
      setIsModalOpen(false);
      fetchSessions();
      
      // Reset form
      setCourseId('');
      setTitle('');
      setDescription('');
      setType('OPEN');
      setScheduledAt('');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to schedule session');
    } finally {
      setSubmitting(false);
    }
  };

  const handleStartSession = async (id: string) => {
    try {
      await api.post(`/sessions/${id}/start`);
      toast.success('Live session started successfully!');
      fetchSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start session');
    }
  };

  const handleForceTerminate = async (id: string) => {
    if (!confirm('Are you sure you want to force terminate this active session? WebRTC connections will be cut.')) return;

    try {
      await api.post(`/sessions/admin/sessions/${id}/terminate`);
      toast.success('Session force terminated by administrator');
      fetchSessions();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to terminate session');
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
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
          <h1>Live Sessions</h1>
          <p>Schedule and monitor live classes, manage WebRTC streams, and review AI summaries</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <i className="fa-solid fa-calendar-plus" /> Schedule Live Session
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : sessions.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-video-slash" />
          </div>
          <h3>No live sessions scheduled</h3>
          <p>Schedule a live WebRTC session room for interactive student workshops.</p>
          <button className="btn btn-primary mt-md" onClick={() => setIsModalOpen(true)}>
            Schedule First Session
          </button>
        </div>
      ) : (
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th>Session Details</th>
                <th>Assigned Instructor</th>
                <th>Course</th>
                <th>Type</th>
                <th>Scheduled At</th>
                <th>Status</th>
                <th style={{ textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {sessions.map((sess) => (
                <tr key={sess._id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{sess.title}</div>
                    {sess.description && (
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }} className="truncate">
                        {sess.description}
                      </div>
                    )}
                  </td>
                  <td style={{ fontWeight: 500 }}>{sess.instructorId?.name || 'Admin'}</td>
                  <td>{sess.courseId?.title || '—'}</td>
                  <td>
                    <span className={`badge ${sess.type === 'INVITE' ? 'badge-neutral' : 'badge-primary'}`}>
                      {sess.type === 'INVITE' ? 'Invite Only' : 'Open Broadcast'}
                    </span>
                  </td>
                  <td className="text-muted">{formatDate(sess.scheduledAt)}</td>
                  <td>
                    <span
                      className={`badge ${
                        sess.status === 'LIVE'
                          ? 'badge-success animate-pulse'
                          : sess.status === 'SCHEDULED'
                          ? 'badge-warning'
                          : 'badge-neutral'
                      }`}
                    >
                      {sess.status === 'LIVE' && <i className="fa-solid fa-circle" style={{ fontSize: '6px', marginRight: '4px', color: '#ff4d4d' }} />}
                      {sess.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex gap-sm justify-end">
                      {sess.status === 'SCHEDULED' && (
                        <button
                          className="btn btn-primary btn-sm"
                          onClick={() => handleStartSession(sess._id)}
                        >
                          <i className="fa-solid fa-play" /> Start
                        </button>
                      )}
                      {sess.status === 'LIVE' && (
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleForceTerminate(sess._id)}
                        >
                          <i className="fa-solid fa-stop" /> Force End
                        </button>
                      )}
                      {sess.status === 'ENDED' && sess.aiSummary && (
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setSelectedSummary(sess.aiSummary || null)}
                        >
                          <i className="fa-solid fa-brain" /> AI Summary
                        </button>
                      )}
                      {sess.type === 'INVITE' && sess.inviteToken && sess.status !== 'ENDED' && (
                        <button
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            navigator.clipboard.writeText(`${window.location.origin}/live/${sess._id}?invite=${sess.inviteToken}`);
                            toast.success('Invite link copied!');
                          }}
                          title="Copy Private Invite Link"
                        >
                          <i className="fa-solid fa-link" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Schedule Modal */}
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
            }}
          >
            <div className="flex items-center justify-between mb-lg">
              <h4 style={{ margin: 0 }}>Schedule Live Session</h4>
              <button className="btn btn-icon btn-ghost" onClick={() => setIsModalOpen(false)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <form onSubmit={handleCreateSession} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div className="input-group">
                <label>Select Course</label>
                <select
                  className="input"
                  value={courseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  required
                >
                  <option value="">-- Choose Target Course --</option>
                  {courses.map((course) => (
                    <option key={course._id} value={course._id}>
                      {course.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="input-group">
                <label>Session Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Masterclass: Sensor Calibration"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>

              <div className="input-group">
                <label>Description</label>
                <textarea
                  className="input"
                  placeholder="Describe what will be covered in this live session room..."
                  style={{ minHeight: '80px', resize: 'vertical' }}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="input-group">
                  <label>Session Type</label>
                  <select
                    className="input"
                    value={type}
                    onChange={(e) => setType(e.target.value as any)}
                    required
                  >
                    <option value="OPEN">Open Broadcast (All unlocked)</option>
                    <option value="INVITE">Invite-Only (Token required)</option>
                  </select>
                </div>

                <div className="input-group">
                  <label>Date & Time</label>
                  <input
                    type="datetime-local"
                    className="input"
                    value={scheduledAt}
                    onChange={(e) => setScheduledAt(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-sm" style={{ marginTop: '12px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <div className="spinner spinner-sm" /> : 'Schedule'}
                </button>
              </div>
            </form>
          </div>
        </>
      )}

      {/* AI Summary Modal */}
      {selectedSummary && (
        <>
          <div className="modal-overlay" onClick={() => setSelectedSummary(null)} style={{ zIndex: 100 }} />
          <div
            className="modal card"
            style={{
              zIndex: 101,
              maxWidth: '600px',
              padding: '28px',
              position: 'fixed',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              maxHeight: '80vh',
              overflowY: 'auto',
            }}
          >
            <div className="flex items-center justify-between mb-lg">
              <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="fa-solid fa-brain" style={{ color: 'var(--tech-blue)' }} />
                AI Generated Session Summary
              </h4>
              <button className="btn btn-icon btn-ghost" onClick={() => setSelectedSummary(null)}>
                <i className="fa-solid fa-xmark" />
              </button>
            </div>

            <div style={{ whiteSpace: 'pre-line', fontSize: '0.9375rem', lineHeight: 1.7, color: 'var(--text-secondary)' }}>
              {selectedSummary}
            </div>

            <div className="flex justify-end mt-lg">
              <button className="btn btn-primary" onClick={() => setSelectedSummary(null)}>
                Close Summary
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
