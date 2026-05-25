'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/stores/authStore';
import api from '@/lib/api';
import toast from 'react-hot-toast';

export default function LoginPage() {
  const router = useRouter();
  const { login } = useAuthStore();
  
  const [step, setStep] = useState<'mobile' | 'otp'>('mobile');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [deviceId] = useState(() => {
    if (typeof window !== 'undefined') {
      let id = localStorage.getItem('deviceId');
      if (!id) {
        id = 'WEB_' + Math.random().toString(36).substring(2, 15);
        localStorage.setItem('deviceId', id);
      }
      return id;
    }
    return 'unknown';
  });

  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault();
    if (mobile.length < 10) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    
    setLoading(true);
    try {
      await api.post('/auth/otp/request', { mobile });
      toast.success('OTP sent successfully!');
      setStep('otp');
      setCountdown(30);
      setTimeout(() => otpRefs.current[0]?.focus(), 200);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  }

  function handleOtpChange(index: number, value: string) {
    if (value.length > 1) {
      // Handle paste
      const digits = value.replace(/\D/g, '').split('').slice(0, 6);
      const newOtp = [...otp];
      digits.forEach((d, i) => {
        if (index + i < 6) newOtp[index + i] = d;
      });
      setOtp(newOtp);
      const nextIndex = Math.min(index + digits.length, 5);
      otpRefs.current[nextIndex]?.focus();
      return;
    }
    
    if (!/^\d*$/.test(value)) return;
    
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);
    
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  }

  function handleOtpKeyDown(index: number, e: React.KeyboardEvent) {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  }

  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    const otpString = otp.join('');
    if (otpString.length !== 6) {
      toast.error('Please enter the complete 6-digit OTP');
      return;
    }

    setLoading(true);
    try {
      const { data } = await api.post('/auth/otp/verify', {
        mobile,
        otp: otpString,
        deviceId,
      });

      toast.success('Login successful!');
      login(data.accessToken, data.user);

      // Role-based redirect
      if (data.user.role === 'ADMIN') router.push('/admin');
      else if (data.user.role === 'INSTRUCTOR') router.push('/instructor');
      else router.push('/student');
    } catch (err: any) {
      const msg = err.response?.data?.message;
      if (msg === 'DEVICE_MISMATCH') {
        const deviceRequestToken = err.response?.data?.deviceRequestToken;
        if (deviceRequestToken) {
          try {
            toast.loading('Submitting device registration request...', { id: 'device-req' });
            await api.post('/devices/request', {
              deviceRequestToken,
              newDeviceId: deviceId,
              deviceName: `Web Browser (${typeof navigator !== 'undefined' ? navigator.appName || 'Chrome' : 'Standard Web'})`
            });
            toast.dismiss('device-req');
            toast.success('Device registration request sent! Please ask your administrator to approve this device.', { duration: 6000 });
          } catch (reqErr: any) {
            toast.dismiss('device-req');
            toast.error(reqErr.response?.data?.message || 'Failed to send device request');
          }
        } else {
          toast.error('This device is not registered. No request token provided.');
        }
      } else {
        toast.error(msg || 'Verification failed');
      }
      setOtp(['', '', '', '', '', '']);
      otpRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'radial-gradient(circle at center, #0f172a 0%, #020617 100%)',
      padding: 20,
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Secure Cryptographic Page CSS Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}} />

      {/* Dynamic blurred glow orbs */}
      <div style={{
        position: 'absolute',
        top: '15%',
        left: '15%',
        width: 350,
        height: 350,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(59, 130, 246, 0.25) 0%, transparent 70%)',
        filter: 'blur(80px)',
        pointerEvents: 'none',
      }} />
      <div style={{
        position: 'absolute',
        bottom: '15%',
        right: '15%',
        width: 400,
        height: 400,
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(139, 92, 246, 0.18) 0%, transparent 70%)',
        filter: 'blur(90px)',
        pointerEvents: 'none',
      }} />

      <div style={{
        background: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.08)',
        borderRadius: 28,
        padding: '54px 44px',
        maxWidth: 450,
        width: '100%',
        boxShadow: '0 30px 60px rgba(0, 0, 0, 0.5), inset 0 1px 1px rgba(255, 255, 255, 0.1)',
        position: 'relative',
        zIndex: 1,
      }}>
        {/* Dynamic header with safe-lock icon */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 60,
            height: 60,
            borderRadius: 18,
            background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(139, 92, 246, 0.1) 100%)',
            border: '1px solid rgba(59, 130, 246, 0.2)',
            marginBottom: 20,
            color: '#3b82f6',
            fontSize: '1.5rem',
            boxShadow: '0 8px 24px rgba(59, 130, 246, 0.15)',
          }}>
            <i className="fa-solid fa-shield-halved" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24, overflow: 'hidden' }}>
            <img src="/logo.jpg" alt="RoboAIPaths Logo" style={{ height: '72px', objectFit: 'contain', borderRadius: '12px' }} />
          </div>
          <p style={{ color: '#94a3b8', fontSize: '0.9375rem', lineHeight: 1.5 }}>
            {step === 'mobile' ? 'Secure Gateway Verification' : 'OTP Verification Sent'}
          </p>
        </div>

        {step === 'mobile' ? (
          <form onSubmit={handleRequestOTP}>
            <div className="input-group" style={{ marginBottom: 28 }}>
              <label style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: 10,
              }}>
                Mobile Number
              </label>
              <div style={{ display: 'flex', gap: 10 }}>
                <div style={{
                  padding: '14px 18px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: 14,
                  fontWeight: 700,
                  color: '#e2e8f0',
                  fontSize: '1rem',
                  display: 'flex',
                  alignItems: 'center',
                  userSelect: 'none',
                }}>
                  +91
                </div>
                <input
                  type="tel"
                  placeholder="Enter 10-digit mobile"
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                  maxLength={10}
                  autoFocus
                  id="mobile-input"
                  style={{
                    flex: 1,
                    padding: '14px 18px',
                    background: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid rgba(255, 255, 255, 0.08)',
                    borderRadius: 14,
                    color: '#ffffff',
                    fontSize: '1rem',
                    fontWeight: 600,
                    outline: 'none',
                    transition: 'all 0.2s ease',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = '#3b82f6';
                    e.target.style.background = 'rgba(255, 255, 255, 0.06)';
                    e.target.style.boxShadow = '0 0 0 4px rgba(59, 130, 246, 0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)';
                    e.target.style.background = 'rgba(255, 255, 255, 0.03)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || mobile.length < 10}
              id="request-otp-btn"
              style={{
                width: '100%',
                padding: '16px',
                background: mobile.length < 10 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: 14,
                color: mobile.length < 10 ? '#64748b' : '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: mobile.length < 10 ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: mobile.length < 10 ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.25)',
              }}
            >
              {loading ? (
                <><div style={{
                  width: 18,
                  height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} /> Sending OTP...</>
              ) : (
                <>Secure Authenticate <i className="fa-solid fa-arrow-right" /></>
              )}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOTP}>
            <div style={{ marginBottom: 28 }}>
              <label style={{
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#94a3b8',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                display: 'block',
                marginBottom: 16,
                textAlign: 'center',
              }}>
                Secure DLT OTP (6 Digits)
              </label>
              <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
                {otp.map((digit, index) => (
                  <input
                    key={index}
                    ref={(el) => { otpRefs.current[index] = el; }}
                    type="text"
                    inputMode="numeric"
                    maxLength={6}
                    value={digit}
                    onChange={(e) => handleOtpChange(index, e.target.value)}
                    onKeyDown={(e) => handleOtpKeyDown(index, e)}
                    id={`otp-input-${index}`}
                    style={{
                      width: 44,
                      height: 50,
                      textAlign: 'center',
                      fontSize: '1.5rem',
                      fontWeight: 700,
                      borderRadius: 12,
                      border: `1.5px solid ${digit ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)'}`,
                      background: digit ? 'rgba(59, 130, 246, 0.08)' : 'rgba(255, 255, 255, 0.02)',
                      color: '#ffffff',
                      transition: 'all 0.2s ease',
                      outline: 'none',
                    }}
                    onFocus={(e) => {
                      e.target.style.borderColor = '#3b82f6';
                      e.target.style.boxShadow = '0 0 0 3px rgba(59, 130, 246, 0.15)';
                    }}
                    onBlur={(e) => {
                      e.target.style.borderColor = digit ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)';
                      e.target.style.boxShadow = 'none';
                    }}
                  />
                ))}
              </div>
              <div style={{ textAlign: 'center', marginTop: 20 }}>
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Code sent to **+91 {mobile.slice(0, 3)}***{mobile.slice(7)}**{' '}
                  <button
                    type="button"
                    onClick={() => { setStep('mobile'); setOtp(['', '', '', '', '', '']); }}
                    style={{ color: '#3b82f6', fontWeight: 700, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                  >
                    Edit
                  </button>
                </span>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading || otp.join('').length < 6}
              id="verify-otp-btn"
              style={{
                width: '100%',
                padding: '16px',
                background: otp.join('').length < 6 ? 'rgba(255,255,255,0.05)' : 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)',
                border: 'none',
                borderRadius: 14,
                color: otp.join('').length < 6 ? '#64748b' : '#ffffff',
                fontSize: '1rem',
                fontWeight: 700,
                cursor: otp.join('').length < 6 ? 'not-allowed' : 'pointer',
                transition: 'all 0.25s ease',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                boxShadow: otp.join('').length < 6 ? 'none' : '0 10px 25px rgba(59, 130, 246, 0.25)',
              }}
            >
              {loading ? (
                <><div style={{
                  width: 18,
                  height: 18,
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: '#ffffff',
                  borderRadius: '50%',
                  animation: 'spin 0.8s linear infinite',
                }} /> Verifying...</>
              ) : (
                <>Secure Verify & Sign In <i className="fa-solid fa-circle-check" /></>
              )}
            </button>

            {/* Resend timer */}
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              {countdown > 0 ? (
                <span style={{ fontSize: '0.8125rem', color: '#64748b' }}>
                  Resend OTP in <span style={{ fontWeight: 700, color: '#3b82f6' }}>{countdown}s</span>
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleRequestOTP as any}
                  style={{
                    color: '#3b82f6',
                    fontWeight: 700,
                    fontSize: '0.8125rem',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                  }}
                >
                  <i className="fa-solid fa-rotate-right" /> Resend OTP
                </button>
              )}
            </div>
          </form>
        )}

        {/* Footer info & Home button */}
        <div style={{
          textAlign: 'center',
          marginTop: 36,
          paddingTop: 24,
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
        }}>
          <a
            href="/"
            style={{
              color: '#3b82f6',
              fontWeight: 700,
              fontSize: '0.875rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              transition: 'color 0.2s',
            }}
          >
            <i className="fa-solid fa-arrow-left" /> Return to Home
          </a>
          <span style={{ fontSize: '0.75rem', color: '#475569', display: 'flex', alignItems: 'center', gap: 6 }}>
            <i className="fa-solid fa-lock" /> End-to-End Cryptographic Encryption Enabled
          </span>
        </div>
      </div>
    </div>
  );
}
