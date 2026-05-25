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

export default function StudentProgress() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [progressDetails, setProgressDetails] = useState<Record<string, { percent: number; completedCount: number; totalCount: number }>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchProgressData();
  }, []);

  const fetchProgressData = async () => {
    setLoading(true);
    try {
      // 1. Fetch orders to extract purchased courses
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

      // 2. Fetch syllabus details + progress info for each course
      const detailsMap: Record<string, { percent: number; completedCount: number; totalCount: number }> = {};
      
      const fetchDetailsPromises = list.map(async (c) => {
        try {
          const [courseDetailRes, progressRes] = await Promise.all([
            api.get(`/courses/${c._id}`),
            api.get(`/progress/${c._id}`)
          ]);

          const totalCount = courseDetailRes.data.lessons?.length || 0;
          const completedCount = progressRes.data.completedLessons?.length || 0;
          const percent = progressRes.data.progressPercent || 0;

          detailsMap[c._id] = { percent, completedCount, totalCount };
        } catch (e) {
          detailsMap[c._id] = { percent: 0, completedCount: 0, totalCount: 0 };
        }
      });

      await Promise.all(fetchDetailsPromises);
      setProgressDetails(detailsMap);
    } catch (err: any) {
      toast.error('Failed to load progress details');
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

  const totalEnrolled = courses.length;
  const averageProgress = totalEnrolled > 0 
    ? Math.round(Object.values(progressDetails).reduce((a, b) => a + b.percent, 0) / totalEnrolled)
    : 0;

  const totalLessonsCompleted = Object.values(progressDetails).reduce((a, b) => a + b.completedCount, 0);

  return (
    <div className="fade-in">
      <div className="page-header">
        <h1>Learning Progress</h1>
        <p>Analyze your syllabus completion rates and academic training milestones.</p>
      </div>

      <div className="stats-grid mb-lg">
        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{totalEnrolled}</div>
              <div className="stat-card-label">Enrolled Pathways</div>
            </div>
            <div className="stat-card-icon blue">
              <i className="fa-solid fa-graduation-cap" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{averageProgress}%</div>
              <div className="stat-card-label">Average Completion</div>
            </div>
            <div className="stat-card-icon green">
              <i className="fa-solid fa-gauge-high" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{totalLessonsCompleted}</div>
              <div className="stat-card-label">Lectures Completed</div>
            </div>
            <div className="stat-card-icon orange">
              <i className="fa-solid fa-circle-check" />
            </div>
          </div>
        </div>
      </div>

      {courses.length === 0 ? (
        <div className="empty-state card-flat" style={{ padding: 48 }}>
          <div className="empty-state-icon">
            <i className="fa-solid fa-chart-line" />
          </div>
          <h3>No progress logs</h3>
          <p>Once you purchase and watch lessons, your completion tracking metrics will be shown here.</p>
          <Link href="/student/courses" className="btn btn-primary mt-md">
            Explore Courses
          </Link>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          {courses.map((course) => {
            const stats = progressDetails[course._id] || { percent: 0, completedCount: 0, totalCount: 0 };
            return (
              <div key={course._id} className="card-flat" style={{ padding: 24, border: '1px solid var(--border-light)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
                  <div>
                    <h4 style={{ fontSize: '1.125rem', fontWeight: 700 }}>{course.title}</h4>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      Category: {course.category || 'Robotics'}
                    </span>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 800, color: 'var(--tech-blue)', fontSize: '1.25rem' }}>{stats.percent}%</div>
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>
                      {stats.completedCount} of {stats.totalCount} lessons completed
                    </span>
                  </div>
                </div>

                <div className="progress-bar-container" style={{ height: 8, borderRadius: 4, background: 'var(--border-default)', overflow: 'hidden', marginBottom: 20 }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--tech-blue) 0%, #7c3aed 100%)',
                      width: `${stats.percent}%`,
                    }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
                  <Link href={`/student/courses/${course._id}`} className="btn btn-secondary btn-sm">
                    View Syllabus
                  </Link>
                  <Link href={`/student/courses/${course._id}/learn`} className="btn btn-primary btn-sm">
                    Resume Studies <i className="fa-solid fa-play" style={{ fontSize: '0.6875rem' }} />
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
