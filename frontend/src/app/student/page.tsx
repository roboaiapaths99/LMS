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
  createdBy?: { name?: string; avatarUrl?: string };
}

interface Order {
  _id: string;
  status: string;
  bundleId?: {
    _id: string;
    courseId?: {
      _id: string;
      title: string;
      thumbnailUrl?: string;
    };
  };
}

interface ProgressItem {
  courseId: string;
  progressPercent: number;
}

export default function StudentDashboard() {
  const { user } = useAuthStore();
  const [purchasedCourses, setPurchasedCourses] = useState<Course[]>([]);
  const [featuredCourses, setFeaturedCourses] = useState<Course[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, number>>({});
  const [lastLesson, setLastLesson] = useState<{ courseId: string; title: string; lessonId: string; courseTitle: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch Orders to find purchased courses
      const { data: ordersData } = await api.get('/orders');
      const orders: Order[] = ordersData.orders || [];

      // Filter successful orders and map to course objects
      const courseMap: Record<string, Course> = {};
      orders.forEach((order) => {
        if (order.status === 'SUCCESS' && order.bundleId?.courseId) {
          const course = order.bundleId.courseId as unknown as Course;
          courseMap[course._id] = course;
        }
      });
      const courses = Object.values(courseMap);
      setPurchasedCourses(courses);

      // 2. Fetch progress and last watched lesson details for each purchased course
      const progressPromises = courses.map((course) => api.get(`/progress/${course._id}`));
      const progressResults = await Promise.allSettled(progressPromises);

      const pMap: Record<string, number> = {};
      let mostRecentProgress: any = null;
      let mostRecentTime = 0;

      progressResults.forEach((res, idx) => {
        if (res.status === 'fulfilled') {
          const percent = res.value.data.progressPercent || 0;
          const courseId = courses[idx]._id;
          pMap[courseId] = percent;

          const history = res.value.data.history || [];
          // Find the most recently updated progress item across all courses to build "Continue Learning"
          history.forEach((hist: any) => {
            const updateTime = new Date(hist.updatedAt).getTime();
            if (updateTime > mostRecentTime) {
              mostRecentTime = updateTime;
              mostRecentProgress = {
                courseId,
                courseTitle: courses[idx].title,
                lessonId: hist.lessonId,
              };
            }
          });
        }
      });

      setProgressMap(pMap);

      // Fetch lesson title for the "Continue Learning" lesson if found
      if (mostRecentProgress) {
        try {
          const { data: courseDetail } = await api.get(`/courses/${mostRecentProgress.courseId}`);
          const lesson = courseDetail.lessons?.find((l: any) => l._id === mostRecentProgress.lessonId);
          if (lesson) {
            setLastLesson({
              courseId: mostRecentProgress.courseId,
              courseTitle: mostRecentProgress.courseTitle,
              lessonId: mostRecentProgress.lessonId,
              title: lesson.title,
            });
          }
        } catch (e) {
          // ignore
        }
      }

      // 3. Fetch Featured Courses
      const { data: featuredData } = await api.get('/courses?featured=true');
      setFeaturedCourses(featuredData.courses || []);
    } catch (err: any) {
      toast.error('Failed to load dashboard data');
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
      {/* Welcome Banner */}
      <div className="welcome-card">
        <h1>Welcome Back, {user?.name || 'Explorer'}!</h1>
        <p>Your robotics and artificial intelligence education journey continues. Explore your courses or dive straight back into your latest lesson.</p>
      </div>

      <div className="stats-grid mb-lg">
        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">{purchasedCourses.length}</div>
              <div className="stat-card-label">Enrolled Courses</div>
            </div>
            <div className="stat-card-icon blue">
              <i className="fa-solid fa-book-open" />
            </div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-card-header">
            <div>
              <div className="stat-card-value">
                {purchasedCourses.length > 0
                  ? Math.round(Object.values(progressMap).reduce((a, b) => a + b, 0) / purchasedCourses.length)
                  : 0}
                %
              </div>
              <div className="stat-card-label">Average Progress</div>
            </div>
            <div className="stat-card-icon green">
              <i className="fa-solid fa-chart-line" />
            </div>
          </div>
        </div>
      </div>

      {/* Featured Courses Promo Banner */}
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
                  Featured Pathway
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
                    {course.description || 'Embark on our specialized syllabus pathway integrating advanced robotics hardware simulation with generative Claude intelligence systems.'}
                  </p>
                </div>
                <div className="library-card-footer" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.05)', background: 'rgba(0,0,0,0.1)', display: 'flex', gap: '8px' }}>
                  <Link href={`/student/courses/${course._id}`} className="btn btn-secondary btn-sm" style={{ flex: 1, justifyContent: 'center' }}>
                    Syllabus
                  </Link>
                  <Link href={`/student/courses/${course._id}`} className="btn btn-primary btn-sm" style={{ flex: 1, justifyContent: 'center', background: 'linear-gradient(90deg, var(--tech-blue), #7c3aed)', border: 'none' }}>
                    Enroll
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Continue Learning */}
      {lastLesson && (
        <div className="mb-lg">
          <div className="section-header">
            <h2>Continue Learning</h2>
          </div>
          <Link href={`/student/courses/${lastLesson.courseId}/learn?lesson=${lastLesson.lessonId}`}>
            <div className="continue-card">
              <div className="continue-card-thumb">
                <i className="fa-solid fa-circle-play" />
              </div>
              <div className="continue-card-info">
                <h4>{lastLesson.courseTitle}</h4>
                <div className="lesson-name">Current Lesson: {lastLesson.title}</div>
                <div className="progress-label">
                  <span>Progress</span>
                  <span>{progressMap[lastLesson.courseId] || 0}%</span>
                </div>
                <div className="progress-bar-container" style={{ height: 6, borderRadius: 3, background: 'var(--border-default)', overflow: 'hidden' }}>
                  <div
                    className="progress-bar-fill"
                    style={{
                      height: '100%',
                      background: 'linear-gradient(90deg, var(--tech-blue), #7c3aed)',
                      width: `${progressMap[lastLesson.courseId] || 0}%`,
                    }}
                  />
                </div>
              </div>
              <div className="btn btn-primary btn-sm">
                Resume <i className="fa-solid fa-arrow-right" />
              </div>
            </div>
          </Link>
        </div>
      )}

      {/* My Enrolled Courses */}
      <div>
        <div className="section-header">
          <h2>My Enrolled Courses</h2>
          <Link href="/student/courses">Browse Catalog</Link>
        </div>

        {purchasedCourses.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">
              <i className="fa-solid fa-graduation-cap" />
            </div>
            <h3>No enrolled courses</h3>
            <p>You haven't purchased any courses yet. Browse our premium courses to start learning!</p>
            <Link href="/student/courses" className="btn btn-primary mt-md">
              Browse Catalog
            </Link>
          </div>
        ) : (
          <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
            {purchasedCourses.map((course) => {
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
                      Curriculum
                    </Link>
                    <Link href={`/student/courses/${course._id}/learn`} className="btn btn-primary btn-sm">
                      Go to Classroom
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
