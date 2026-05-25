'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';
import { useAuthStore } from '@/stores/authStore';

interface Course {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
}

interface LiveSession {
  _id: string;
  title: string;
  scheduledAt: string;
  status: string;
  courseId?: { title: string };
}

export default function InstructorDashboard() {
  const { user } = useAuthStore();
  const [courses, setCourses] = useState<Course[]>([]);
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const [coursesRes, sessionsRes, featuredRes] = await Promise.all([
        api.get('/courses'),
        api.get('/sessions'),
        api.get('/courses?featured=true')
      ]);

      setCourses(coursesRes.data.courses || []);
      setSessions(sessionsRes.data.sessions || []);
      setFeaturedCourses(featuredRes.data.courses || []);
    } catch (err: any) {
      toast.error('Failed to load instructor dashboard data');
    } finally {
      setLoading(false);
    }
  };

  // Find the next upcoming/active live class
  const getNextSession = () => {
    if (sessions.length === 0) return null;
    const sorted = [...sessions].sort((a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime());
    
    // Prioritize LIVE session first
    const active = sorted.find(s => s.status === 'LIVE');
    if (active) return active;

    // Otherwise next scheduled session in the future
    const now = new Date().getTime();
    return sorted.find(s => new Date(s.scheduledAt).getTime() > now && s.status === 'SCHEDULED');
  };

  const nextSession = getNextSession();

  const handleStartSession = async (sessionId: string) => {
    try {
      await api.post(`/sessions/${sessionId}/start`);
      toast.success('Live Session started!');
      // Refresh dashboard data
      fetchDashboardData();
    } catch (err) {
      toast.error('Failed to start session');
    }
  };

  const formatDateTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleString('en-IN', {
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

  return (
    <div className="fade-in">
      {/* Welcome Banner */}
      <div className="welcome-card">
        <h1>Welcome Back, Captain {user?.name || 'Instructor'}!</h1>
        <p>Manage your assigned syllabus pathways, coordinate interactive webinars, and review learner activity feeds.</p>
      </div>

      {/* Stats Widgets */}
      <div className="stats-grid mb-lg" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 24, marginBottom: 32 }}>
        <div className="stat-card card-flat" style={{ padding: 24, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--tech-blue)' }}>{courses.length}</span>
            <div className="stat-card-icon" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--tech-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--tech-blue)', textAlign: 'center', lineHeight: '44px' }}>
              <i className="fa-solid fa-graduation-cap" style={{ display: 'block', margin: '14px auto' }} />
            </div>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Assigned Syllabus Pathways</span>
        </div>

        <div className="stat-card card-flat" style={{ padding: 24, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success)' }}>
              {sessions.filter(s => s.status === 'LIVE').length}
            </span>
            <div className="stat-card-icon" style={{ width: 44, height: 44, borderRadius: '50%', background: 'var(--success-light)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--success)', textAlign: 'center', lineHeight: '44px' }}>
              <i className="fa-solid fa-video" style={{ display: 'block', margin: '14px auto' }} />
            </div>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Webinars Currently Live</span>
        </div>

        <div className="stat-card card-flat" style={{ padding: 24, border: '1px solid var(--border-light)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '2rem', fontWeight: 800, color: '#7c3aed' }}>
              {sessions.filter(s => s.status === 'SCHEDULED').length}
            </span>
            <div className="stat-card-icon" style={{ width: 44, height: 44, borderRadius: '50%', background: 'rgba(124, 58, 237, 0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#7c3aed', textAlign: 'center', lineHeight: '44px' }}>
              <i className="fa-regular fa-calendar-days" style={{ display: 'block', margin: '14px auto' }} />
            </div>
          </div>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Scheduled Interactive Sessions</span>
        </div>
      </div>

      {/* Featured Courses Grid */}
      {featuredCourses.length > 0 && (
        <div className="mb-lg">
          <div className="section-header">
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#a78bfa' }} />
              Promoted & Featured Pathways
            </h2>
          </div>
          <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {featuredCourses.map((course) => (
              <div 
                key={course._id} 
                className="library-card" 
                style={{ 
                  border: '1px solid rgba(124, 58, 237, 0.25)', 
                  boxShadow: '0 8px 30px rgba(124, 58, 237, 0.08)',
                  background: 'linear-gradient(135deg, rgba(15, 23, 42, 0.9) 0%, rgba(30, 41, 59, 0.8) 100%)',
                  position: 'relative',
                  overflow: 'hidden'
                }}
              >
                {/* Glowing border badge */}
                <div style={{
                  position: 'absolute',
                  top: '12px',
                  right: '12px',
                  background: 'linear-gradient(90deg, #7c3aed, var(--tech-blue))',
                  color: '#fff',
                  fontSize: '0.6875rem',
                  fontWeight: 700,
                  padding: '4px 10px',
                  borderRadius: '12px',
                  boxShadow: '0 2px 8px rgba(124, 58, 237, 0.4)',
                  zIndex: 2,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px'
                }}>
                  Promoted
                </div>

                <div className="library-card-thumb" style={{ height: '180px', position: 'relative' }}>
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <i className="fa-solid fa-microchip" style={{ fontSize: '3rem', color: 'rgba(167, 139, 250, 0.3)' }} />
                    </div>
                  )}
                </div>
                <div className="library-card-body">
                  <span className="discount-badge mb-xs" style={{ background: 'rgba(167, 139, 250, 0.1)', color: '#c084fc', border: '1px solid rgba(167, 139, 250, 0.2)' }}>
                    {course.category || 'Robotics & AI'}
                  </span>
                  <h4 style={{ minHeight: 48, margin: '8px 0 12px', color: '#fff' }}>{course.title}</h4>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', minHeight: '36px' }}>
                    {course.description || 'Assigned pathway promoted to active students globally.'}
                  </p>
                </div>
                <div className="library-card-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.1)', display: 'flex', gap: '8px' }}>
                  <Link href={`/instructor/catalogue`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    View Catalogue
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Main Grid: Next Webinar & Session Control */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start', marginBottom: 32 }}>
        
        {/* Next Live Class Indicator */}
        <div>
          <div className="section-header">
            <h2>Next Scheduled Live Session</h2>
            <Link href="/instructor/sessions/create" className="btn btn-primary btn-sm" style={{ gap: 6, display: 'flex', alignItems: 'center' }}>
              <i className="fa-solid fa-square-plus" /> Schedule Class
            </Link>
          </div>

          {nextSession ? (
            <div className="card-flat session-card" style={{ padding: 28, border: '1px solid var(--border-light)', background: 'var(--bg-card)' }}>
              <div className={`session-card-icon ${nextSession.status === 'LIVE' ? 'live' : 'upcoming'}`}>
                <i className={nextSession.status === 'LIVE' ? "fa-solid fa-satellite-dish fa-pulse" : "fa-solid fa-video"} />
              </div>
              <div className="session-card-body">
                <span className="badge badge-success mb-xs" style={{ background: nextSession.status === 'LIVE' ? 'var(--danger-light)' : 'var(--tech-blue-light)', color: nextSession.status === 'LIVE' ? 'var(--danger)' : 'var(--tech-blue)', textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                  {nextSession.status === 'LIVE' ? 'LIVE NOW' : 'SCHEDULED'}
                </span>
                <h3 className="session-card-title" style={{ fontSize: '1.25rem', marginTop: 6, fontWeight: 700 }}>{nextSession.title}</h3>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 12 }}>
                  Course Syllabus: <strong style={{ color: 'var(--text-primary)' }}>{nextSession.courseId?.title || 'Robotics Syllabus'}</strong>
                </p>

                <div className="session-card-meta" style={{ display: 'flex', gap: 16, color: 'var(--text-muted)', fontSize: '0.8125rem', marginBottom: 16 }}>
                  <span><i className="fa-regular fa-clock" /> {formatDateTime(nextSession.scheduledAt)}</span>
                  <span><i className="fa-solid fa-globe" /> India Standard Time (IST)</span>
                </div>

                <div style={{ display: 'flex', gap: 12 }}>
                  {nextSession.status === 'LIVE' ? (
                    <Link href={`/live/${nextSession._id}`} className="btn btn-danger btn-sm">
                      <i className="fa-solid fa-satellite-dish" style={{ marginRight: 6 }} /> Join Classroom
                    </Link>
                  ) : (
                    <>
                      <button className="btn btn-primary btn-sm" onClick={() => handleStartSession(nextSession._id)}>
                        <i className="fa-solid fa-circle-play" style={{ marginRight: 6 }} /> Start Broadcast
                      </button>
                      <Link href={`/live/${nextSession._id}`} className="btn btn-secondary btn-sm">
                        Curriculum
                      </Link>
                    </>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="card-flat" style={{ padding: 48, textAlign: 'center', border: '1px solid var(--border-light)' }}>
              <div style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: 12 }}>
                <i className="fa-solid fa-video-slash" />
              </div>
              <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 4 }}>No Live Sessions Scheduled</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
                Schedule interactive Q&A webinars or live coding exercises for your students.
              </p>
              <Link href="/instructor/sessions/create" className="btn btn-primary btn-sm">
                Schedule First Session
              </Link>
            </div>
          )}
        </div>

        {/* Live List sidebar */}
        <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-light)' }}>
          <h3 style={{ fontSize: '0.9375rem', fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <i className="fa-regular fa-calendar-days" style={{ color: 'var(--tech-blue)' }} /> Scheduled Classes
          </h3>
          {sessions.length === 0 ? (
            <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>No other classes scheduled.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {sessions.slice(0, 4).map((s) => (
                <div key={s._id} style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 12, borderBottom: '1px solid var(--border-light)' }}>
                  <h4 style={{ fontSize: '0.8125rem', fontWeight: 700, margin: 0, textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>{s.title}</h4>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    {formatDateTime(s.scheduledAt)}
                  </span>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 4 }}>
                    <span className="badge" style={{ fontSize: '0.625rem', padding: '2px 6px', background: s.status === 'LIVE' ? 'var(--danger-light)' : 'var(--bg-input)', color: s.status === 'LIVE' ? 'var(--danger)' : 'var(--text-secondary)' }}>
                      {s.status}
                    </span>
                    <Link href={`/instructor/sessions`} style={{ fontSize: '0.75rem', color: 'var(--tech-blue)', fontWeight: 600 }}>
                      Manage
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Course Assignments Panel */}
      <div>
        <div className="section-header">
          <h2>Assigned Curriculums & Pathways</h2>
          <Link href="/instructor/catalogue" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--tech-blue)' }}>
            Browse Catalog
          </Link>
        </div>

        {courses.length === 0 ? (
          <div className="empty-state card-flat" style={{ padding: 48, textAlign: 'center', border: '1px solid var(--border-light)' }}>
            <i className="fa-solid fa-graduation-cap" style={{ fontSize: '2.5rem', color: 'var(--text-muted)', marginBottom: 12 }} />
            <h3>No assigned pathways found</h3>
            <p>You have not been assigned to any learning syllabus yet.</p>
          </div>
        ) : (
          <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
            {courses.map((course) => (
              <div key={course._id} className="library-card" style={{ background: 'var(--bg-card)', borderRadius: 16, overflow: 'hidden', border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
                <div className="library-card-thumb" style={{ height: 140, background: 'linear-gradient(135deg, var(--dark-navy) 0%, var(--tech-blue) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '2.5rem' }}>
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="fa-solid fa-microchip" />
                  )}
                </div>
                <div style={{ padding: 20 }}>
                  <span className="discount-badge" style={{ background: 'var(--tech-blue-light)', color: 'var(--tech-blue)', fontSize: '0.6875rem' }}>
                    {course.category || 'Robotics & AI'}
                  </span>
                  <h4 style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '8px 0 16px', minHeight: 40, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {course.title}
                  </h4>
                  
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
                    <Link href={`/instructor/catalogue/${course._id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center', padding: '6px 12px', fontSize: '0.8125rem' }}>
                      Syllabus
                    </Link>
                    <Link href={`/instructor/library`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center', padding: '6px 12px', fontSize: '0.8125rem' }}>
                      Library
                    </Link>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
