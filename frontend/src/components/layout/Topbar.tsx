'use client';

import { useAuthStore } from '@/stores/authStore';
import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface Notification {
  _id: string;
  title: string;
  message: string;
  type: string;
  isRead: boolean;
  createdAt: string;
}

// Dynamically synthesize a premium chime sound using the browser's Web Audio API
function playChime() {
  try {
    const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    const now = ctx.currentTime;
    
    // First Note: D5 -> A5 glide (Sine Osc)
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    osc1.type = 'sine';
    osc1.frequency.setValueAtTime(587.33, now); // D5
    osc1.frequency.exponentialRampToValueAtTime(880.00, now + 0.15); // A5
    gain1.gain.setValueAtTime(0.15, now);
    gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.6);
    
    osc1.connect(gain1);
    gain1.connect(ctx.destination);
    
    // Second Note: D4 -> A4 glide (Triangle Osc for warmth)
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    osc2.type = 'triangle';
    osc2.frequency.setValueAtTime(293.66, now); // D4
    osc2.frequency.exponentialRampToValueAtTime(440.00, now + 0.2); // A4
    gain2.gain.setValueAtTime(0.08, now);
    gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    
    osc2.connect(gain2);
    gain2.connect(ctx.destination);
    
    osc1.start(now);
    osc1.stop(now + 0.6);
    osc2.start(now);
    osc2.stop(now + 0.8);
  } catch (err) {
    console.error('Failed to play notification chime:', err);
  }
}

export default function Topbar() {
  const { user } = useAuthStore();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showNotifs, setShowNotifs] = useState(false);

  useEffect(() => {
    loadNotifications();

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    let ws: WebSocket;
    let reconnectTimeout: any;

    function connectWS() {
      const wsUrl = `ws://${window.location.hostname}:4000/api/v1/notifications/ws?token=${token}`;
      ws = new WebSocket(wsUrl);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === 'NOTIFICATION_RECEIVED') {
            const notif = data.notification;
            setNotifications(prev => [notif, ...prev]);
            playChime();
            
            toast.custom((t) => (
              <div
                className={`${
                  t.visible ? 'animate-enter' : 'animate-leave'
                } pointer-events-auto flex`}
                style={{
                  background: 'rgba(15, 23, 42, 0.9)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '16px',
                  padding: '16px',
                  color: '#fff',
                  boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.3), 0 10px 10px -5px rgb(0 0 0 / 0.3)',
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: '12px',
                  width: '320px',
                }}
              >
                <div style={{
                  background: 'rgba(59, 130, 246, 0.15)',
                  color: '#3b82f6',
                  width: '36px',
                  height: '36px',
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}>
                  <i className="fa-solid fa-bell" style={{ fontSize: '1rem' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: '4px' }}>
                    {notif.title}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#94a3b8', lineHeight: '1.4' }}>
                    {notif.message}
                  </div>
                </div>
                <button
                  onClick={() => toast.dismiss(t.id)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#64748b',
                    cursor: 'pointer',
                    padding: '4px',
                    fontSize: '0.75rem',
                  }}
                >
                  <i className="fa-solid fa-xmark" />
                </button>
              </div>
            ));
          }
        } catch (err) {
          console.error('Error handling websocket notification:', err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(() => {
          connectWS();
        }, 5000);
      };

      ws.onerror = (err) => {
        ws.close();
      };
    }

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  async function loadNotifications() {
    try {
      const { data } = await api.get('/notifications');
      setNotifications(data.notifications || []);
    } catch (err) {
      // silently fail
    }
  }

  async function markAllRead() {
    try {
      await api.put('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    } catch (err) {}
  }

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <div className="topbar">
      <div className="topbar-left" style={{ display: 'flex', alignItems: 'center' }}>
        <img src="/logo.jpg" alt="RoboAIPaths Logo" style={{ height: '48px', objectFit: 'contain' }} />
      </div>

      <div className="topbar-right">
        {/* Notification Bell */}
        <div style={{ position: 'relative' }}>
          <button
            className="btn btn-icon btn-ghost"
            onClick={() => setShowNotifs(!showNotifs)}
            style={{ position: 'relative' }}
          >
            <i className="fa-solid fa-bell" style={{ fontSize: '1.125rem' }} />
            {unreadCount > 0 && (
              <span style={{
                position: 'absolute',
                top: 2,
                right: 2,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: 'var(--danger)',
                color: '#fff',
                fontSize: '0.625rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}>
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {/* Notification dropdown */}
          {showNotifs && (
            <div style={{
              position: 'absolute',
              top: '100%',
              right: 0,
              width: 360,
              maxHeight: 400,
              background: 'var(--bg-card)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-xl)',
              border: '1px solid var(--border-default)',
              overflow: 'hidden',
              zIndex: 200,
              animation: 'slideDown 0.2s ease',
            }}>
              <div style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}>
                <h5 style={{ fontSize: '0.9375rem' }}>Notifications</h5>
                {unreadCount > 0 && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={markAllRead}
                    style={{ fontSize: '0.75rem' }}
                  >
                    Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: 32, textAlign: 'center', color: 'var(--text-muted)' }}>
                    <i className="fa-solid fa-bell-slash" style={{ fontSize: '1.5rem', marginBottom: 8, display: 'block' }} />
                    No notifications yet
                  </div>
                ) : (
                  notifications.slice(0, 10).map(n => (
                    <div
                      key={n._id}
                      style={{
                        padding: '12px 20px',
                        borderBottom: '1px solid var(--border-light)',
                        background: n.isRead ? 'transparent' : 'var(--tech-blue-light)',
                        cursor: 'pointer',
                        transition: 'var(--transition-fast)',
                      }}
                    >
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 2 }}>
                        {n.title}
                      </div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                        {n.message}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 4 }}>
                        {new Date(n.createdAt).toLocaleDateString()}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Avatar */}
        <div className="avatar avatar-md" title={user?.name || 'User'}>
          {user?.name?.charAt(0)?.toUpperCase() || 'U'}
        </div>
      </div>
    </div>
  );
}
