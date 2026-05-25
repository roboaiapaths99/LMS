'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const PRESETS = [
  { name: 'Alpha Bot', icon: 'fa-solid fa-robot', bg: 'linear-gradient(135deg, #3b82f6 0%, #06b6d4 100%)' },
  { name: 'Quantum Core', icon: 'fa-solid fa-atom', bg: 'linear-gradient(135deg, #7c3aed 0%, #db2777 100%)' },
  { name: 'Neural Link', icon: 'fa-solid fa-brain', bg: 'linear-gradient(135deg, #10b981 0%, #059669 100%)' },
  { name: 'Mech Commander', icon: 'fa-solid fa-gear', bg: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' },
  { name: 'Cyber Sentinel', icon: 'fa-solid fa-shield-halved', bg: 'linear-gradient(135deg, #64748b 0%, #475569 100%)' }
];

export default function StudentProfile() {
  const { user, updateProfile, fetchMe } = useAuthStore();
  
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState('');
  const [saving, setSaving] = useState(false);
  const [localDeviceId, setLocalDeviceId] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const id = localStorage.getItem('deviceId') || 'WEB_UNRESOLVED';
      setLocalDeviceId(id);
    }
  }, []);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setEmail(user.email || '');
      setAvatar(user.avatarUrl || '');
    }
  }, [user]);

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Name cannot be empty');
      return;
    }
    
    setSaving(true);
    try {
      await updateProfile({
        name: name.trim(),
        email: email.trim(),
        avatarUrl: avatar
      });
      toast.success('Profile updated successfully!');
      fetchMe(); // Refresh
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handlePresetSelect = (presetBg: string) => {
    setAvatar(presetBg);
  };

  const getInitials = (nameStr?: string) => {
    if (!nameStr) return 'R';
    return nameStr.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Profile Manager</h1>
        <p>Customize your learning identity and manage your anti-piracy hardware device bounds.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>
        {/* Profile Card & Form */}
        <div className="profile-card" style={{ width: '100%', maxWidth: 'none' }}>
          {/* Cover Header */}
          <div className="profile-card-header" style={{ position: 'relative' }}>
            <div 
              className="profile-avatar" 
              style={{ 
                background: avatar || 'linear-gradient(135deg, var(--tech-blue) 0%, #7c3aed 100%)', 
                border: '4px solid rgba(255, 255, 255, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              {avatar.includes('fa-') ? (
                <i className={PRESETS.find(p => p.bg === avatar)?.icon || 'fa-solid fa-robot'} style={{ fontSize: '2rem' }} />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div>
              <h2>{name || user?.name || 'RoboAI Explorer'}</h2>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span className="badge badge-success" style={{ textTransform: 'uppercase', fontSize: '0.6875rem' }}>
                  {user?.role}
                </span>
                <span>• Enrolled Student ID: {String(user?.id ?? '').slice(-6).toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Form */}
          <form className="profile-form" onSubmit={handleUpdate}>
            {/* Avatar Preset Selector */}
            <div>
              <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 8, display: 'block' }}>
                Select Robotic Avatar Tag
              </label>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                {PRESETS.map((p) => {
                  const isSelected = avatar === p.bg;
                  return (
                    <div 
                      key={p.name}
                      onClick={() => handlePresetSelect(p.bg)}
                      style={{
                        width: 48,
                        height: 48,
                        borderRadius: '50%',
                        background: p.bg,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#fff',
                        cursor: 'pointer',
                        border: isSelected ? '3px solid var(--tech-blue)' : '2px solid transparent',
                        transform: isSelected ? 'scale(1.1)' : 'none',
                        boxShadow: isSelected ? 'var(--shadow-md)' : 'none',
                        transition: 'var(--transition-fast)'
                      }}
                      title={p.name}
                    >
                      <i className={p.icon} style={{ fontSize: '1.25rem' }} />
                    </div>
                  );
                })}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div>
                <label className="label">Full Name</label>
                <input
                  type="text"
                  className="input"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                />
              </div>

              <div>
                <label className="label">Mobile Number (Login Identifier)</label>
                <input
                  type="text"
                  className="input"
                  value={user?.mobile || ''}
                  disabled
                  style={{ background: 'var(--border-light)', cursor: 'not-allowed', color: 'var(--text-muted)' }}
                />
              </div>
            </div>

            <div>
              <label className="label">Registered Email Address</label>
              <input
                type="email"
                className="input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. explorer@roboaiapaths.com"
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving}
              style={{ width: 'fit-content', marginTop: 12 }}
            >
              {saving ? 'Updating Profile...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Anti-Piracy Hardware binding card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
              <i className="fa-solid fa-shield-halved" style={{ color: 'var(--tech-blue)' }} /> Device Shield
            </h3>
            
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              RoboAIPaths LMS implements automated hardware binding to protect intellectual property and curb illegal sharing.
            </p>

            <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: '12px', marginBottom: 16 }}>
              <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                Current Browser Device ID
              </div>
              <div style={{ fontSize: '0.8125rem', fontFamily: 'monospace', fontWeight: 600, wordBreak: 'break-all', color: 'var(--text-primary)' }}>
                {localDeviceId}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div 
                style={{ 
                  width: 10, 
                  height: 10, 
                  borderRadius: '50%', 
                  background: 'var(--success)', 
                  boxShadow: '0 0 8px var(--success)' 
                }} 
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--success)' }}>
                DEVICE VERIFIED & BOUND
              </span>
            </div>
          </div>

          <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-light)', background: 'linear-gradient(135deg, rgba(0,110,255,0.02) 0%, rgba(124,58,237,0.02) 100%)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-circle-question" style={{ color: 'var(--tech-blue)' }} /> Change Devices?
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              Logging in on a new device or changing browsers will prompt a hardware verification screen. You can request a binding swap there which is reviewed by our administration within 2 hours.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
