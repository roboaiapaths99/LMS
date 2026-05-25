'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Course {
  _id: string;
  title: string;
  category?: string;
  thumbnailUrl?: string;
  description?: string;
}

interface Order {
  _id: string;
  status: string;
  bundleId?: {
    courseId?: Course;
  };
}

export default function InstructorLibrary() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLibraryCourses();
  }, []);

  const fetchLibraryCourses = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/orders');
      const orders: Order[] = data.orders || [];

      // Extract unique courses from successful orders
      const courseMap: Record<string, Course> = {};
      orders.forEach((order) => {
        if (order.status === 'SUCCESS' && order.bundleId?.courseId) {
          const course = order.bundleId.courseId;
          courseMap[course._id] = course;
        }
      });

      setCourses(Object.values(courseMap));
    } catch (err: any) {
      toast.error('Failed to load library pathways');
    } finally {
      setLoading(false);
    }
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
      <div className="welcome-card" style={{ background: 'linear-gradient(135deg, var(--dark-navy) 0%, #10b981 100%)' }}>
        <h1>Unlocked Instructor Library</h1>
        <p>Access your fully licensed course pathways, teaching notes, laboratory codebases, and student review blueprints.</p>
      </div>

      <div className="section-header">
        <h2>My Unlocked Syllabus Pathways</h2>
        <Link href="/instructor/catalogue" className="btn btn-secondary btn-sm">
          Browse Catalog
        </Link>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-book-bookmark" />
          </div>
          <h3>Your library is empty</h3>
          <p>You haven't unlocked any syllabus guides yet. Head over to our catalog to acquire learning modules.</p>
          <Link href="/instructor/catalogue" className="btn btn-primary mt-md">
            Unlock First Syllabus
          </Link>
        </div>
      ) : (
        <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {courses.map((course) => (
            <div key={course._id} className="library-card" style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-light)', overflow: 'hidden', boxShadow: 'var(--shadow-sm)' }}>
              <div className="library-card-thumb" style={{ height: 160, background: 'linear-gradient(135deg, var(--dark-navy) 0%, var(--tech-blue) 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '3rem' }}>
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <i className="fa-solid fa-microchip" />
                )}
              </div>
              <div style={{ padding: 24 }}>
                <span className="discount-badge" style={{ background: 'var(--success-light)', color: 'var(--success)', fontSize: '0.6875rem', marginBottom: 8, display: 'inline-block' }}>
                  {course.category || 'Robotics'}
                </span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '8px 0 16px', minHeight: 48, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.title}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 20, minHeight: 48 }}>
                  {course.description || 'Access complete instructor assets, including lesson streams and watermarked student worksheets.'}
                </p>
                
                <div style={{ display: 'flex', gap: 12 }}>
                  <Link href={`/instructor/catalogue/${course._id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                    Syllabus Outline
                  </Link>
                  <Link href={`/instructor/library/${course._id}`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                    Open Classroom
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
