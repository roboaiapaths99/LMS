'use client';

import { useState, useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

const PRESETS = [
  { name: 'AI Specialist', icon: 'fa-solid fa-brain', bg: 'linear-gradient(135deg, #006eff 0%, #7c3aed 100%)' },
  { name: 'Robotics Guru', icon: 'fa-solid fa-robot', bg: 'linear-gradient(135deg, #ef4444 0%, #f59e0b 100%)' },
  { name: 'Cyber Expert', icon: 'fa-solid fa-shield-halved', bg: 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)' },
  { name: 'Kinematics Lead', icon: 'fa-solid fa-gear', bg: 'linear-gradient(135deg, #db2777 0%, #7c3aed 100%)' }
];

export default function InstructorProfile() {
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
      toast.success('Instructor profile updated successfully!');
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
    if (!nameStr) return 'IN';
    return nameStr.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  };

  return (
    <div className="fade-in">
      <div className="welcome-card" style={{ background: 'linear-gradient(135deg, var(--dark-navy) 0%, var(--tech-blue) 100%)' }}>
        <h1>Instructor Profile Settings</h1>
        <p>Manage your professional profile, display avatar tokens, and audit your authenticated Device Shield bindings.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 32, alignItems: 'start' }}>
        
        {/* Profile Card & Form */}
        <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 32, border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-md)' }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 20, borderBottom: '1px solid var(--border-light)', paddingBottom: 24, marginBottom: 28 }}>
            <div 
              style={{ 
                width: 72,
                height: 72,
                borderRadius: '50%',
                background: avatar || 'linear-gradient(135deg, var(--tech-blue) 0%, #7c3aed 100%)', 
                border: '3px solid var(--border-light)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                fontSize: '1.5rem',
                fontWeight: 700,
                boxShadow: 'var(--shadow-sm)'
              }}
            >
              {avatar.includes('fa-') ? (
                <i className={PRESETS.find(p => p.bg === avatar)?.icon || 'fa-solid fa-chalkboard-user'} />
              ) : (
                getInitials(user?.name)
              )}
            </div>
            <div>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0 }}>{name || user?.name || 'RoboAI Instructor'}</h2>
              <p style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-muted)', marginTop: 4 }}>
                <span className="badge" style={{ background: 'var(--tech-blue-light)', color: 'var(--tech-blue)', textTransform: 'uppercase', fontSize: '0.6875rem', fontWeight: 700 }}>
                  {user?.role}
                </span>
                <span>• Instructor ID: {user?.id.slice(-6).toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleUpdate} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
            
            {/* Avatar Preset Selector */}
            <div>
              <label style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 12, display: 'block' }}>
                Select Instructor Avatar Theme
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

            {/* Inputs */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter full name"
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--bg-input)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                    fontSize: '0.9375rem',
                    color: 'var(--text-primary)',
                    fontWeight: 500,
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Mobile Number</label>
                <input
                  type="text"
                  value={user?.mobile || ''}
                  disabled
                  style={{
                    width: '100%',
                    padding: '12px 16px',
                    background: 'var(--border-light)',
                    border: '1px solid var(--border-default)',
                    borderRadius: 12,
                    fontSize: '0.9375rem',
                    color: 'var(--text-muted)',
                    fontWeight: 500,
                    cursor: 'not-allowed',
                  }}
                />
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <label style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Registered Email Address</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. instructor@roboaiapaths.com"
                style={{
                  width: '100%',
                  padding: '12px 16px',
                  background: 'var(--bg-input)',
                  border: '1px solid var(--border-default)',
                  borderRadius: 12,
                  fontSize: '0.9375rem',
                  color: 'var(--text-primary)',
                  fontWeight: 500,
                }}
              />
            </div>

            <button 
              type="submit" 
              className="btn btn-primary" 
              disabled={saving}
              style={{ width: 'fit-content', marginTop: 8 }}
            >
              {saving ? 'Saving changes...' : 'Save Profile Details'}
            </button>
          </form>
        </div>

        {/* Device Shield Card */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          
          <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 24, border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--text-primary)' }}>
              <i className="fa-solid fa-shield-halved" style={{ color: 'var(--tech-blue)' }} /> Device Shield
            </h3>
            
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5, marginBottom: 16 }}>
              Our anti-piracy shield tracks browser fingerprint signatures to enforce active licensing and restrict unauthorized video redistribution.
            </p>

            <div style={{ padding: 16, background: 'var(--bg-input)', borderRadius: '12px', marginBottom: 16 }}>
              <div style={{ fontSize: '0.6875rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 700, marginBottom: 4 }}>
                Active Hardware ID
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
                HARDWARE GUARANTEED
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 24, border: '1px solid var(--border-light)', boxShadow: 'var(--shadow-sm)' }}>
            <h4 style={{ fontSize: '0.875rem', fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
              <i className="fa-solid fa-circle-question" style={{ color: 'var(--tech-blue)' }} /> Verification Overrides
            </h4>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              If you replace your primary teaching computer or undergo dual-boot modifications, log in through the primary web portal. The system automatically prompts an OTP confirmation trigger to seamlessly re-bind your credentials.
            </p>
          </div>

        </div>

      </div>
    </div>
  );
}
