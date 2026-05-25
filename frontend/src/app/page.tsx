'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

interface Course {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  status: string;
}

export default function LandingPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    loadPublicCourses();
  }, []);

  async function loadPublicCourses() {
    try {
      // Public endpoint - no auth needed
      const { data } = await api.get('/courses/categories');
      // Fetch public courses for the landing page
      try {
        const res = await api.get('/courses/public');
        setCourses(res.data.courses || []);
      } catch {
        setCourses([]);
      }
    } catch {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  }

  const categories = ['all', ...Array.from(new Set(courses.map(c => c.category).filter((c): c is string => !!c)))];
  const filteredCourses = filter === 'all' ? courses : courses.filter(c => c.category === filter);

  return (
    <div style={{ background: '#fff', minHeight: '100vh' }}>
      {/* ============ NAVBAR ============ */}
      <nav style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 72,
        background: '#ffffff',
        borderBottom: '1px solid rgba(0,0,0,0.05)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 48px',
        zIndex: 1000,
      }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img src="/logo.jpg" alt="RoboAIPaths Logo" style={{ height: '48px', objectFit: 'contain' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 32 }}>
          <a href="#courses" style={{ color: '#475569', fontWeight: 500, fontSize: '0.9375rem', position: 'relative' }}>
            Courses
          </a>
          <a href="#features" style={{ color: '#475569', fontWeight: 500, fontSize: '0.9375rem' }}>
            Features
          </a>
          <a href="#how-it-works" style={{ color: '#475569', fontWeight: 500, fontSize: '0.9375rem' }}>
            How It Works
          </a>
          <Link href="/login" className="btn btn-primary">
            <i className="fa-solid fa-right-to-bracket" /> Login
          </Link>
        </div>
      </nav>

      {/* ============ HERO ============ */}
      <section style={{
        paddingTop: 160,
        paddingBottom: 100,
        background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
        position: 'relative',
        overflow: 'hidden',
      }}>
        {/* Glowing orbs */}
        <div style={{ position: 'absolute', top: '10%', right: '20%', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,110,255,0.2), transparent)', filter: 'blur(80px)', pointerEvents: 'none' }} />
        <div style={{ position: 'absolute', bottom: '10%', left: '10%', width: 300, height: 300, borderRadius: '50%', background: 'radial-gradient(circle, rgba(124,58,237,0.15), transparent)', filter: 'blur(60px)', pointerEvents: 'none' }} />

        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '0 32px', textAlign: 'center', position: 'relative', zIndex: 1 }}>
          <div className="badge badge-primary" style={{ marginBottom: 20, padding: '8px 20px', fontSize: '0.8125rem' }}>
            <i className="fa-solid fa-rocket" style={{ marginRight: 6 }} /> India&apos;s Premier Robotics & AI Learning Platform
          </div>
          <h1 style={{ color: '#fff', fontSize: '3.5rem', fontWeight: 800, lineHeight: 1.15, marginBottom: 24, maxWidth: 800, margin: '0 auto 24px' }}>
            Master <span style={{ color: '#006eff' }}>Robotics</span> & <span style={{ color: '#7c3aed' }}>AI</span> with Expert-Led Courses
          </h1>
          <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: '1.25rem', maxWidth: 640, margin: '0 auto 40px', lineHeight: 1.6 }}>
            Learn from industry experts, build real robots, and master cutting-edge AI — with live sessions, AI-powered notes, and watermarked content protection.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <a href="#courses" className="btn btn-primary btn-xl" style={{ fontSize: '1rem' }}>
              <i className="fa-solid fa-compass" /> Browse Courses
            </a>
            <Link href="/login" className="btn btn-outline btn-xl" style={{ borderColor: 'rgba(255,255,255,0.3)', color: '#fff', fontSize: '1rem' }}>
              <i className="fa-solid fa-user" /> Get Started Free
            </Link>
          </div>

          {/* Stats bar */}
          <div style={{
            display: 'flex',
            justifyContent: 'center',
            gap: 64,
            marginTop: 72,
            paddingTop: 40,
            borderTop: '1px solid rgba(255,255,255,0.08)',
          }}>
            {[
              { value: '500+', label: 'Students' },
              { value: '20+', label: 'Expert Courses' },
              { value: '50+', label: 'Live Sessions' },
              { value: '98%', label: 'Completion Rate' },
            ].map((stat, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '2rem', fontWeight: 800, color: '#fff' }}>{stat.value}</div>
                <div style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ FEATURES ============ */}
      <section id="features" style={{ padding: '100px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 64 }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: 16 }}>
            Why Learn with <span className="text-gradient">RoboAIAPaths?</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: '1.125rem', maxWidth: 600, margin: '0 auto' }}>
            A premium learning experience with enterprise-grade features
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            { icon: 'fa-robot', color: '#006eff', title: 'AI-Powered Learning', desc: 'Smart summaries, topic Q&A, and AI-polished study notes to accelerate your learning.' },
            { icon: 'fa-video', color: '#7c3aed', title: 'Live Expert Sessions', desc: 'Real-time classes with industry professionals via LiveKit video conferencing.' },
            { icon: 'fa-shield-halved', color: '#10b981', title: 'Content Protection', desc: 'Device binding, watermarked PDFs, and secure video streaming to protect content.' },
            { icon: 'fa-graduation-cap', color: '#f59e0b', title: 'Structured Curriculum', desc: 'Step-by-step learning paths from beginner to advanced in robotics and AI.' },
            { icon: 'fa-note-sticky', color: '#ef4444', title: 'Smart Notes & Mindmaps', desc: 'Take notes, generate AI mindmaps, and export your knowledge in PDF format.' },
            { icon: 'fa-mobile-screen', color: '#06b6d4', title: 'Learn Anywhere', desc: 'Responsive platform that works perfectly on desktop, tablet, and mobile.' },
          ].map((feat, i) => (
            <div key={i} className="card" style={{ padding: 32, border: '1px solid var(--border-light)' }}>
              <div style={{
                width: 56,
                height: 56,
                borderRadius: 16,
                background: `${feat.color}15`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 20,
              }}>
                <i className={`fa-solid ${feat.icon}`} style={{ fontSize: '1.5rem', color: feat.color }} />
              </div>
              <h4 style={{ marginBottom: 8, fontSize: '1.125rem' }}>{feat.title}</h4>
              <p style={{ color: '#64748b', fontSize: '0.9375rem', lineHeight: 1.6 }}>{feat.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ============ HOW IT WORKS ============ */}
      <section id="how-it-works" style={{ padding: '80px 32px', background: '#f8fafc' }}>
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: 16 }}>
              How It Works
            </h2>
            <p style={{ color: '#64748b', fontSize: '1.125rem' }}>
              Start learning in 4 simple steps
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 32 }}>
            {[
              { step: '01', icon: 'fa-compass', title: 'Browse Courses', desc: 'Explore our curated catalogue of robotics and AI courses.' },
              { step: '02', icon: 'fa-cart-shopping', title: 'Purchase Access', desc: 'Choose Video, PDF, or Combo bundles. Apply coupon codes for discounts.' },
              { step: '03', icon: 'fa-play', title: 'Start Learning', desc: 'Watch HD videos, read watermarked PDFs, and take AI-powered notes.' },
              { step: '04', icon: 'fa-trophy', title: 'Master Skills', desc: 'Track progress, join live sessions, and build your robotics portfolio.' },
            ].map((item, i) => (
              <div key={i} style={{ textAlign: 'center', padding: 24 }}>
                <div style={{
                  width: 72,
                  height: 72,
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg, #006eff, #7c3aed)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 20px',
                  boxShadow: '0 8px 24px rgba(0,110,255,0.3)',
                }}>
                  <i className={`fa-solid ${item.icon}`} style={{ fontSize: '1.5rem', color: '#fff' }} />
                </div>
                <div style={{ fontSize: '0.75rem', fontWeight: 800, color: '#006eff', marginBottom: 8, letterSpacing: '0.1em' }}>
                  STEP {item.step}
                </div>
                <h4 style={{ marginBottom: 8 }}>{item.title}</h4>
                <p style={{ color: '#64748b', fontSize: '0.9375rem' }}>{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ============ COURSES CATALOGUE ============ */}
      <section id="courses" style={{ padding: '100px 32px', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: '2.25rem', fontWeight: 800, marginBottom: 16 }}>
            Explore Our <span className="text-gradient">Courses</span>
          </h2>
          <p style={{ color: '#64748b', fontSize: '1.125rem' }}>
            Handpicked courses designed by industry experts
          </p>
        </div>

        {/* Category filters */}
        {categories.length > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
            {categories.map((cat) => (
              <button
                key={cat}
                className={`btn ${filter === cat ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setFilter(cat)}
                style={{ textTransform: 'capitalize' }}
              >
                {cat === 'all' ? 'All Courses' : cat}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="course-grid">
            {[1, 2, 3].map(i => (
              <div key={i} className="skeleton-card" />
            ))}
          </div>
        ) : filteredCourses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-graduation-cap" />
            </div>
            <h3>Courses Coming Soon!</h3>
            <p>Our expert instructors are preparing amazing content. Check back soon!</p>
          </div>
        ) : (
          <div className="course-grid">
            {filteredCourses.map((course) => (
              <div key={course._id} className="course-card">
                <div className="course-card-thumb" style={{
                  background: `linear-gradient(135deg, #0f172a, ${['#006eff', '#7c3aed', '#10b981', '#f59e0b'][Math.floor(Math.random() * 4)]})`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}>
                  <i className="fa-solid fa-graduation-cap" style={{ fontSize: '3rem', color: 'rgba(255,255,255,0.2)' }} />
                </div>
                <div className="course-card-body">
                  {course.category && (
                    <span className="course-card-category">{course.category}</span>
                  )}
                  <h4 className="course-card-title">{course.title}</h4>
                  <p style={{ color: '#64748b', fontSize: '0.8125rem', lineHeight: 1.5, marginBottom: 12 }}>
                    {course.description?.substring(0, 100) || 'Learn cutting-edge skills with this comprehensive course.'}
                  </p>
                </div>
                <div className="course-card-footer">
                  <Link href="/login" className="btn btn-primary btn-sm">
                    <i className="fa-solid fa-arrow-right" /> View Course
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* ============ CTA ============ */}
      <section style={{
        padding: '80px 32px',
        background: 'linear-gradient(135deg, #006eff, #7c3aed)',
        textAlign: 'center',
      }}>
        <h2 style={{ color: '#fff', fontSize: '2.5rem', fontWeight: 800, marginBottom: 16 }}>
          Ready to Start Your AI Journey?
        </h2>
        <p style={{ color: 'rgba(255,255,255,0.8)', fontSize: '1.125rem', marginBottom: 32, maxWidth: 500, margin: '0 auto 32px' }}>
          Join thousands of students mastering robotics and artificial intelligence with RoboAIAPaths.
        </p>
        <Link href="/login" className="btn btn-xl" style={{
          background: '#fff',
          color: '#006eff',
          fontWeight: 700,
          boxShadow: '0 8px 24px rgba(0,0,0,0.2)',
        }}>
          <i className="fa-solid fa-rocket" /> Get Started Free
        </Link>
      </section>

      {/* ============ FOOTER ============ */}
      <footer style={{
        background: '#0f172a',
        color: 'rgba(255,255,255,0.5)',
        padding: '48px 32px',
      }}>
        <div style={{ maxWidth: 1200, margin: '0 auto', display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 32 }}>
          <div>
            <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#fff', marginBottom: 12 }}>
              Robo<span style={{ color: '#006eff' }}>AI</span>Paths
            </div>
            <p style={{ fontSize: '0.875rem', maxWidth: 300, lineHeight: 1.6 }}>
              India&apos;s premier platform for learning Robotics, AI, and emerging technologies.
            </p>
          </div>
          <div>
            <h5 style={{ color: '#fff', marginBottom: 12, fontSize: '0.9375rem' }}>Quick Links</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <a href="#courses" style={{ fontSize: '0.875rem' }}>Courses</a>
              <a href="#features" style={{ fontSize: '0.875rem' }}>Features</a>
              <Link href="/login" style={{ fontSize: '0.875rem' }}>Login</Link>
            </div>
          </div>
          <div>
            <h5 style={{ color: '#fff', marginBottom: 12, fontSize: '0.9375rem' }}>Contact</h5>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.875rem' }}>
              <span><i className="fa-solid fa-envelope" style={{ marginRight: 8 }} />info@roboaiapaths.com</span>
              <span><i className="fa-solid fa-globe" style={{ marginRight: 8 }} />roboaiapaths.com</span>
            </div>
          </div>
        </div>
        <div style={{ maxWidth: 1200, margin: '32px auto 0', paddingTop: 24, borderTop: '1px solid rgba(255,255,255,0.06)', textAlign: 'center', fontSize: '0.8125rem' }}>
          © {new Date().getFullYear()} RoboAIAPaths. All rights reserved.
        </div>
      </footer>
    </div>
  );
}
