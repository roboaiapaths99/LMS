'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import Link from 'next/link';
import toast from 'react-hot-toast';

interface Instructor {
  _id: string;
  name: string;
  avatarUrl?: string;
}

interface Course {
  _id: string;
  title: string;
}

interface LiveSession {
  _id: string;
  title: string;
  description?: string;
  instructorId: Instructor;
  courseId: Course;
  type: 'INVITE' | 'OPEN';
  inviteToken?: string;
  status: 'SCHEDULED' | 'LIVE' | 'ENDED';
  scheduledAt: string;
  startedAt?: string;
  endedAt?: string;
  aiSummary?: string;
}

export default function StudentSessionsPage() {
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeTab, setActiveTab] = useState<'all' | 'live' | 'upcoming' | 'past'>('all');
  const [selectedSummary, setSelectedSummary] = useState<LiveSession | null>(null);
  const [inviteSession, setInviteSession] = useState<LiveSession | null>(null);
  const [inviteToken, setInviteToken] = useState('');

  useEffect(() => {
    fetchSessions();
  }, []);

  async function fetchSessions() {
    setLoading(true);
    try {
      const { data } = await api.get('/sessions');
      setSessions(data.sessions || []);
    } catch (err: any) {
      toast.error('Failed to load live sessions');
    } finally {
      setLoading(false);
    }
  }

  // Filter and group sessions
  const filteredSessions = sessions.filter(session => {
    const matchesSearch = 
      session.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
      session.courseId?.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      session.instructorId?.name.toLowerCase().includes(searchQuery.toLowerCase());
    
    if (!matchesSearch) return false;
    if (activeTab === 'live') return session.status === 'LIVE';
    if (activeTab === 'upcoming') return session.status === 'SCHEDULED';
    if (activeTab === 'past') return session.status === 'ENDED';
    return true;
  });

  const liveSessions = sessions.filter(s => s.status === 'LIVE');
  const upcomingSessions = sessions.filter(s => s.status === 'SCHEDULED');
  const pastSessions = sessions.filter(s => s.status === 'ENDED');

  function handleJoinClick(session: LiveSession) {
    if (session.type === 'INVITE') {
      setInviteSession(session);
      setInviteToken('');
    } else {
      window.location.href = `/live/${session._id}`;
    }
  }

  function handleVerifyInvite() {
    if (!inviteToken.trim()) {
      toast.error('Please enter a valid invite token');
      return;
    }
    if (!inviteSession) return;

    if (inviteToken === inviteSession.inviteToken) {
      toast.success('Access Granted! Redirecting...');
      setTimeout(() => {
        window.location.href = `/live/${inviteSession._id}?invite=${inviteToken}`;
      }, 800);
    } else {
      toast.error('Invalid invite token. Access Denied.');
    }
  }

  // Format date in IST (Indian Standard Time)
  function formatIST(dateStr: string) {
    try {
      const options: Intl.DateTimeFormatOptions = {
        timeZone: 'Asia/Kolkata',
        weekday: 'short',
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      };
      return new Intl.DateTimeFormat('en-IN', options).format(new Date(dateStr)) + ' (IST)';
    } catch (err) {
      return new Date(dateStr).toLocaleString();
    }
  }

  return (
    <div style={{ paddingBottom: '40px' }}>
      {/* Welcome & Pulse Banner */}
      <div style={{
        background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)',
        borderRadius: '24px',
        padding: '36px 40px',
        color: '#fff',
        marginBottom: '32px',
        boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)',
        position: 'relative',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div style={{ position: 'relative', zIndex: 2 }}>
          <h1 style={{ fontSize: '1.75rem', fontWeight: 800, marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '12px' }}>
            Live Sessions Hub
            {liveSessions.length > 0 && (
              <span style={{
                background: 'rgba(239, 68, 68, 0.2)',
                color: '#ef4444',
                fontSize: '0.75rem',
                padding: '4px 10px',
                borderRadius: '999px',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                animation: 'pulse 2s infinite'
              }}>
                <span style={{ width: '6px', height: '6px', background: '#ef4444', borderRadius: '50%' }}></span>
                {liveSessions.length} LIVE NOW
              </span>
            )}
          </h1>
          <p style={{ fontSize: '0.9375rem', color: '#94a3b8', maxWidth: '560px', margin: 0 }}>
            Join live robotics kit demonstrations, interactive programming webinars, and explore deep-dive post-class AI digests generated by Claude AI.
          </p>
        </div>
        <div style={{
          position: 'absolute',
          top: '-40px',
          right: '-40px',
          width: '240px',
          height: '240px',
          background: 'rgba(99, 102, 241, 0.04)',
          borderRadius: '50%',
          filter: 'blur(30px)'
        }}></div>
      </div>

      {/* Toolbar & Filters */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '28px',
        gap: '16px',
        flexWrap: 'wrap'
      }}>
        {/* Search */}
        <div style={{ position: 'relative', flex: '1', minWidth: '260px' }}>
          <i className="fa-solid fa-magnifying-glass" style={{
            position: 'absolute',
            left: '16px',
            top: '50%',
            transform: 'translateY(-50%)',
            color: '#64748b',
            fontSize: '0.875rem'
          }}></i>
          <input
            type="text"
            className="input"
            placeholder="Search by topic, course, or instructor..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '44px',
              height: '42px',
              borderRadius: '12px',
              border: '1px solid var(--border-default)',
              background: 'var(--bg-input)',
              fontSize: '0.875rem',
            }}
          />
        </div>

        {/* Tab Filters */}
        <div style={{
          display: 'flex',
          background: 'var(--bg-input)',
          padding: '4px',
          borderRadius: '12px',
          border: '1px solid var(--border-light)'
        }}>
          {(['all', 'live', 'upcoming', 'past'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              style={{
                padding: '6px 16px',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.8125rem',
                fontWeight: 600,
                textTransform: 'capitalize',
                background: activeTab === tab ? 'var(--bg-card)' : 'transparent',
                color: activeTab === tab ? 'var(--tech-blue)' : 'var(--text-secondary)',
                boxShadow: activeTab === tab ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              {tab === 'all' ? 'All Classes' : tab}
              {tab === 'live' && liveSessions.length > 0 && (
                <span style={{ marginLeft: '4px', background: '#ef4444', color: '#fff', fontSize: '0.6875rem', padding: '1px 5px', borderRadius: '50%' }}>
                  {liveSessions.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Sessions Grid */}
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '200px' }}>
          <i className="fa-solid fa-spinner fa-spin" style={{ fontSize: '1.5rem', color: 'var(--tech-blue)' }} />
        </div>
      ) : filteredSessions.length === 0 ? (
        <div style={{
          background: 'var(--bg-card)',
          borderRadius: '16px',
          padding: '48px 24px',
          textAlign: 'center',
          border: '1px solid var(--border-light)',
          color: 'var(--text-muted)'
        }}>
          <i className="fa-solid fa-video-slash" style={{ fontSize: '2rem', marginBottom: '12px', display: 'block', color: 'var(--text-muted)' }} />
          <div style={{ fontSize: '0.9375rem', fontWeight: 600 }}>No live sessions found</div>
          <div style={{ fontSize: '0.8125rem', marginTop: '4px' }}>Try switching tabs or adjusting your search criteria</div>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          gap: '24px'
        }}>
          {filteredSessions.map(session => {
            const isLive = session.status === 'LIVE';
            const isPast = session.status === 'ENDED';
            const isPrivate = session.type === 'INVITE';

            return (
              <div
                key={session._id}
                style={{
                  background: 'var(--bg-card)',
                  borderRadius: '16px',
                  border: isLive ? '1.5px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-light)',
                  padding: '24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  position: 'relative',
                  transition: 'all 0.2s ease',
                  boxShadow: isLive ? '0 10px 15px -3px rgba(239, 68, 68, 0.05)' : 'none'
                }}
              >
                {/* Badge Row */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    {isLive ? (
                      <span style={{
                        background: '#ef4444',
                        color: '#fff',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px'
                      }}>
                        <span style={{ width: '4px', height: '4px', background: '#fff', borderRadius: '50%', display: 'inline-block' }}></span>
                        LIVE NOW
                      </span>
                    ) : isPast ? (
                      <span style={{
                        background: 'var(--bg-input)',
                        color: 'var(--text-muted)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        COMPLETED
                      </span>
                    ) : (
                      <span style={{
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--tech-blue)',
                        fontSize: '0.6875rem',
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: '6px'
                      }}>
                        UPCOMING
                      </span>
                    )}

                    <span style={{
                      background: isPrivate ? 'rgba(245, 158, 11, 0.1)' : 'rgba(16, 185, 129, 0.1)',
                      color: isPrivate ? '#f59e0b' : '#10b981',
                      fontSize: '0.6875rem',
                      fontWeight: 700,
                      padding: '3px 8px',
                      borderRadius: '6px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}>
                      <i className={`fa-solid ${isPrivate ? 'fa-lock' : 'fa-globe'}`} style={{ fontSize: '0.625rem' }} />
                      {isPrivate ? 'Private Invite' : 'Open Broadcast'}
                    </span>
                  </div>

                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                    {session.courseId?.title || 'General'}
                  </span>
                </div>

                {/* Session Info */}
                <div style={{ flex: 1 }}>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '6px', color: 'var(--text-primary)' }}>
                    {session.title}
                  </h3>
                  <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', lineHeight: '1.4' }}>
                    {session.description || 'No additional description provided.'}
                  </p>
                </div>

                {/* Date & Host */}
                <div style={{
                  borderTop: '1px solid var(--border-light)',
                  paddingTop: '12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '8px',
                  fontSize: '0.75rem',
                  color: 'var(--text-secondary)'
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <i className="fa-solid fa-calendar" style={{ color: 'var(--text-muted)' }} />
                    <span>{formatIST(session.scheduledAt)}</span>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div className="avatar avatar-xs" style={{ width: '18px', height: '18px', fontSize: '0.55rem' }}>
                      {session.instructorId?.name?.charAt(0)?.toUpperCase() || 'I'}
                    </div>
                    <span>Hosted by {session.instructorId?.name || 'Instructor'}</span>
                  </div>
                </div>

                {/* CTA Row */}
                <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
                  {isLive && (
                    <button
                      onClick={() => handleJoinClick(session)}
                      className="btn btn-primary"
                      style={{
                        flex: 1,
                        background: '#ef4444',
                        borderColor: '#ef4444',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.8125rem',
                        height: '36px'
                      }}
                    >
                      <i className="fa-solid fa-right-to-bracket" />
                      Join Live Broadcast
                    </button>
                  )}

                  {!isLive && !isPast && (
                    <button
                      disabled
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.8125rem',
                        height: '36px',
                        opacity: 0.6,
                        cursor: 'not-allowed'
                      }}
                    >
                      <i className="fa-solid fa-clock" />
                      Waiting to Start
                    </button>
                  )}

                  {isPast && (
                    <button
                      onClick={() => setSelectedSummary(session)}
                      className="btn btn-secondary"
                      style={{
                        flex: 1,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                        fontSize: '0.8125rem',
                        height: '36px'
                      }}
                    >
                      <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--tech-blue)' }} />
                      View AI Digest
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* AI Digest Drawer / Modal */}
      {selectedSummary && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setSelectedSummary(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '560px',
              padding: '0',
              borderRadius: '20px',
              overflow: 'hidden',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-2xl)'
            }}
          >
            {/* Header */}
            <div style={{
              padding: '24px 28px',
              background: 'linear-gradient(135deg, #1e1b4b, #110e30)',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              position: 'relative',
              color: '#fff'
            }}>
              <button
                onClick={() => setSelectedSummary(null)}
                style={{
                  position: 'absolute',
                  top: '20px',
                  right: '20px',
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  color: '#fff',
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer'
                }}
              >
                <i className="fa-solid fa-xmark" />
              </button>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'rgba(255,255,255,0.6)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', marginBottom: '6px' }}>
                <i className="fa-solid fa-wand-magic-sparkles" style={{ color: '#818cf8' }} />
                Claude AI Generated Summary
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: 0, paddingRight: '20px' }}>
                {selectedSummary.title}
              </h3>
            </div>

            {/* Content Body */}
            <div style={{ padding: '28px', maxHeight: '420px', overflowY: 'auto' }}>
              {selectedSummary.aiSummary ? (
                <div
                  style={{
                    fontSize: '0.875rem',
                    color: 'var(--text-secondary)',
                    lineHeight: '1.7',
                    whiteSpace: 'pre-wrap'
                  }}
                >
                  {selectedSummary.aiSummary}
                </div>
              ) : (
                <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)' }}>
                  <i className="fa-solid fa-circle-question" style={{ fontSize: '1.5rem', marginBottom: '8px', display: 'block' }} />
                  AI summary is not available for this session.
                </div>
              )}
            </div>

            {/* Footer */}
            <div style={{
              padding: '16px 28px',
              borderTop: '1px solid var(--border-light)',
              display: 'flex',
              justifyContent: 'flex-end',
              background: 'var(--bg-input)'
            }}>
              <button onClick={() => setSelectedSummary(null)} className="btn btn-secondary btn-md">
                Close Digest
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Private Invite Modal */}
      {inviteSession && (
        <div className="modal-overlay" style={{ zIndex: 1000 }} onClick={() => setInviteSession(null)}>
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{
              maxWidth: '400px',
              padding: '24px',
              borderRadius: '16px',
              background: 'var(--bg-card)',
              border: '1px solid var(--border-default)',
              boxShadow: 'var(--shadow-2xl)'
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div style={{
                width: '48px',
                height: '48px',
                background: 'rgba(245, 158, 11, 0.1)',
                color: '#f59e0b',
                borderRadius: '50%',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: '12px'
              }}>
                <i className="fa-solid fa-lock" style={{ fontSize: '1.25rem' }} />
              </div>
              <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 6px 0' }}>Private Session Access</h3>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', margin: 0 }}>
                This is a private invite-only session. Please enter the invitation code provided to you.
              </p>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <input
                  type="text"
                  className="input"
                  placeholder="Enter Invitation Token"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value)}
                  style={{
                    textAlign: 'center',
                    fontWeight: 600,
                    letterSpacing: '1px',
                    height: '40px'
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                <button
                  onClick={() => setInviteSession(null)}
                  className="btn btn-secondary"
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem' }}
                >
                  Cancel
                </button>
                <button
                  onClick={handleVerifyInvite}
                  className="btn btn-primary"
                  style={{ flex: 1, height: '36px', fontSize: '0.8125rem', background: '#f59e0b', borderColor: '#f59e0b' }}
                >
                  Verify & Join
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Pulse Keyframe CSS */}
      <style jsx global>{`
        @keyframes pulse {
          0% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.4);
          }
          70% {
            box-shadow: 0 0 0 8px rgba(239, 68, 68, 0);
          }
          100% {
            box-shadow: 0 0 0 0 rgba(239, 68, 68, 0);
          }
        }
      `}</style>
    </div>
  );
}
