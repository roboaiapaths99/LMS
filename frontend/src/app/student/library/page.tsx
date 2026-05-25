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
}

export default function StudentLibrary() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLibraryData();
  }, []);

  const fetchLibraryData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders to find purchased courses
      const { data: ordersData } = await api.get('/orders');
      const orders = ordersData.orders || [];

      const courseMap: Record<string, Course> = {};
      orders.forEach((order: any) => {
        if (order.status === 'SUCCESS' && order.bundleId?.courseId) {
          const c = order.bundleId.courseId as Course;
          courseMap[c._id] = c;
        }
      });
      const list = Object.values(courseMap);
      setCourses(list);

      // 2. Fetch progress percentages
      const progressPromises = list.map((c) => api.get(`/progress/${c._id}`));
      const progressResults = await Promise.allSettled(progressPromises);

      const pMap: Record<string, number> = {};
      progressResults.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          pMap[list[idx]._id] = res.value.data.progressPercent || 0;
        }
      });
      setProgressMap(pMap);
    } catch (err: any) {
      toast.error('Failed to load library data');
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
      <div className="page-header">
        <h1>My Library</h1>
        <p>Access your custom robotics & AI learning pathways and track study progress.</p>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state card-flat" style={{ padding: 48 }}>
          <div className="empty-state-icon">
            <i className="fa-solid fa-book-open" />
          </div>
          <h3>Your library is empty</h3>
          <p>You haven't unlocked any courses yet. Purchase a course bundle to get started!</p>
          <Link href="/student/courses" className="btn btn-primary mt-md">
            Explore Courses Catalog
          </Link>
        </div>
      ) : (
        <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {courses.map((course) => {
            const progress = progressMap[course._id] || 0;
            return (
              <div key={course._id} className="library-card">
                <div className="library-card-thumb">
                  {course.thumbnailUrl ? (
                    <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  ) : (
                    <i className="fa-solid fa-graduation-cap" />
                  )}
                </div>
                <div className="library-card-body">
                  <span className="discount-badge mb-xs" style={{ background: 'var(--tech-blue-light)', color: 'var(--tech-blue)' }}>
                    {course.category || 'Robotics & AI'}
                  </span>
                  <h4 style={{ minHeight: 48, margin: '8px 0 12px' }}>{course.title}</h4>
                  
                  <div className="progress-label">
                    <span>Course Progress</span>
                    <span>{progress}%</span>
                  </div>
                  <div className="progress-bar-container" style={{ height: 6, borderRadius: 3, background: 'var(--border-default)', overflow: 'hidden', marginBottom: 8 }}>
                    <div
                      className="progress-bar-fill"
                      style={{
                        height: '100%',
                        background: 'var(--tech-blue)',
                        width: `${progress}%`,
                      }}
                    />
                  </div>
                </div>
                <div className="library-card-footer">
                  <Link href={`/student/courses/${course._id}`} className="btn btn-secondary btn-sm">
                    Syllabus
                  </Link>
                  <Link href={`/student/courses/${course._id}/learn`} className="btn btn-primary btn-sm">
                    Enter Classroom
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
