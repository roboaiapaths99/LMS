'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface LiveSession {
  _id: string;
  title: string;
  description?: string;
  scheduledAt: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  type: 'INVITE' | 'OPEN';
  inviteToken?: string;
  aiSummary?: string;
  courseId?: {
    title: string;
  };
}

export default function InstructorSessions() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchSessions();
  }, []);

  const fetchSessions = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions || []);
    } catch (err: any) {
      toast.error('Failed to load live sessions planner');
    } finally {
      setLoading(false);
    }
  };

  const handleStartSession = async (sessionId: string) => {
    try {
      await api.post(`/sessions/${sessionId}/start`);
      toast.success('Live Webcast broadcast channel is active!');
      fetchSessions();
    } catch (err) {
      toast.error('Failed to initiate live broadcast room');
    }
  };

  const handleEndSession = async (sessionId: string) => {
    try {
      await api.post(`/sessions/${sessionId}/end`);
      toast.success('Live Broadcast has been shut down successfully!');
      fetchSessions();
    } catch (err) {
      toast.error('Failed to shut down broadcast channel');
    }
  };

  const formatDateTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  const liveSessions = sessions.filter((s) => s.status === 'LIVE');
  const scheduledSessions = sessions.filter((s) => s.status === 'SCHEDULED');
  const endedSessions = sessions.filter((s) => s.status === 'ENDED');

  return (
    <div className="fade-in">
      {/* Welcome Hero */}
      <div className="welcome-card" style={{ background: 'linear-gradient(135deg, var(--dark-navy) 0%, var(--danger) 100%)' }}>
        <h1>Interactive Webinar & Broadcaster Room</h1>
        <p>Coordinate real-time interactive lectures, screen shares, and evaluate dynamic AI post-session summary transcripts.</p>
      </div>

      <div className="section-header" style={{ marginBottom: 32 }}>
        <h2>Live Webcast Schedules</h2>
        <Link href="/instructor/sessions/create" className="btn btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <i className="fa-solid fa-square-plus" /> Schedule Live Webinar
        </Link>
      </div>

      {/* 1. Live Now Section */}
      {liveSessions.length > 0 && (
        <div style={{ marginBottom: 40 }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 700, color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <span className="live-dot live" style={{ width: 12, height: 12, borderRadius: '50%', background: 'var(--danger)', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            Active Webinars (Broadcast Live)
          </h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {liveSessions.map((s) => (
              <div key={s._id} className="card-flat session-card" style={{ border: '2px solid var(--danger)', padding: 24, borderRadius: 20 }}>
                <div className="session-card-icon live">
                  <i className="fa-solid fa-satellite-dish fa-pulse" />
                </div>
                <div className="session-card-body">
                  <h3 className="session-card-title" style={{ fontSize: '1.25rem' }}>{s.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    Course Pathway: <strong>{s.courseId?.title || 'Robotics Syllabus'}</strong>
                  </p>
                  <div className="session-card-meta" style={{ marginBottom: 16 }}>
                    <span><i className="fa-regular fa-clock" /> Started: {formatDateTime(s.scheduledAt)}</span>
                    <span style={{ textTransform: 'uppercase' }}><i className="fa-solid fa-lock-open" /> {s.type} ACCESS</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <Link href={`/live/${s._id}`} className="btn btn-danger btn-sm">
                      <i className="fa-solid fa-satellite-dish" style={{ marginRight: 6 }} /> Join Broadcast Room
                    </Link>
                    <button className="btn btn-outline btn-sm" onClick={() => handleEndSession(s._id)} style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}>
                      <i className="fa-solid fa-power-off" style={{ marginRight: 6 }} /> Shut Down Stream
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 2. Upcoming Scheduled Sessions */}
      <div style={{ marginBottom: 40 }}>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>Upcoming Scheduled Webinars</h3>
        {scheduledSessions.length === 0 ? (
          <div className="card-flat" style={{ padding: 32, textAlign: 'center', border: '1px solid var(--border-light)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No upcoming sessions scheduled.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {scheduledSessions.map((s) => (
              <div key={s._id} className="card-flat session-card" style={{ padding: 24, borderRadius: 20 }}>
                <div className="session-card-icon upcoming">
                  <i className="fa-solid fa-video" />
                </div>
                <div className="session-card-body">
                  <h3 className="session-card-title">{s.title}</h3>
                  <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
                    Course Pathway: {s.courseId?.title || 'Robotics Syllabus'}
                  </p>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                    {s.description || 'Interactive instruction session.'}
                  </p>
                  <div className="session-card-meta" style={{ marginBottom: 16 }}>
                    <span><i className="fa-regular fa-calendar-days" /> Scheduled: {formatDateTime(s.scheduledAt)}</span>
                    <span><i className="fa-solid fa-link" /> Type: {s.type}</span>
                    {s.type === 'INVITE' && s.inviteToken && (
                      <span><i className="fa-solid fa-key" /> Invite Token: <code style={{ color: 'var(--tech-blue)' }}>{s.inviteToken}</code></span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 12 }}>
                    <button className="btn btn-primary btn-sm" onClick={() => handleStartSession(s._id)}>
                      <i className="fa-solid fa-circle-play" style={{ marginRight: 6 }} /> Start Broadcast Feed
                    </button>
                    <Link href={`/live/${s._id}`} className="btn btn-secondary btn-sm">
                      Check Broadcaster Binds
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 3. Ended Sessions & AI Summaries */}
      <div>
        <h3 style={{ fontSize: '1.125rem', fontWeight: 700, marginBottom: 16 }}>Historical Session Summary Logs</h3>
        {endedSessions.length === 0 ? (
          <div className="card-flat" style={{ padding: 32, textAlign: 'center', border: '1px solid var(--border-light)' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No past session records found.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {endedSessions.map((s) => (
              <div key={s._id} className="card-flat" style={{ padding: 28, borderRadius: 20, border: '1px solid var(--border-default)', background: 'var(--bg-card)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12, borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 16 }}>
                  <div>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0 }}>{s.title}</h4>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                      Completed on: {formatDateTime(s.scheduledAt)} • Syllabus: {s.courseId?.title}
                    </span>
                  </div>
                  <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)' }}>
                    ARCHIVED
                  </span>
                </div>

                {s.aiSummary && (
                  <div>
                    <h5 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8, color: 'var(--tech-blue)' }}>
                      <i className="fa-solid fa-wand-magic-sparkles" /> AI discussion Summary Highlights
                    </h5>
                    <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 12, fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>
                      {s.aiSummary}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <style jsx global>{`
        @keyframes pulse {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 8px rgba(239, 68, 68, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
        }
      `}</style>
    </div>
  );
}
