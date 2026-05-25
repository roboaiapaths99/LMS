'use client';

import { useState, useEffect, use } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';

export default function StudentPDFViewer({ params }: { params: Promise<{ id: string }> | any }) {
  const resolvedParams = use(params) as any;
  const courseId = resolvedParams.id;
  const searchParams = useSearchParams();
  const lessonId = searchParams.get('lesson');

  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [course, setCourse] = useState<any>(null);
  const [lessonName, setLessonName] = useState<string>('');

  useEffect(() => {
    if (courseId && lessonId) {
      loadProtectedPDF();
    }
  }, [courseId, lessonId]);

  const loadProtectedPDF = async () => {
    setLoading(true);
    try {
      // Fetch course context to display info
      const { data: courseData } = await api.get(`/courses/${courseId}`);
      setCourse(courseData.course);
      const lesson = courseData.lessons?.find((l: any) => l._id === lessonId);
      if (lesson) {
        setLessonName(lesson.title);
      }

      // Fetch protected watermarked PDF as Blob
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/courses/${courseId}/pdf/${lessonId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('PDF request failed');

      const blob = await response.blob();
      const objectUrl = URL.createObjectURL(blob);
      setPdfUrl(objectUrl);

      // Mark PDF lesson as completed
      try {
        await api.put(`/progress/${lessonId}`, {
          watchedSecs: 100, // Dummy 100 for PDF
          totalSecs: 100,
          lastPosition: 100
        });
        toast.success('PDF study guide marked as read');
      } catch (e) {
        // Ignore progress fail
      }
    } catch (err: any) {
      toast.error('Failed to load protected watermarked PDF');
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
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 120px)' }}>
      {/* PDF Header Info */}
      <div className="flex items-center justify-between mb-md">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 800 }}>{lessonName || 'Study Guide'}</h2>
          <p className="text-muted" style={{ fontSize: '0.8125rem' }}>
            Course: {course?.title || 'Loading Course...'} • Anti-Piracy Watermark applied dynamically.
          </p>
        </div>
        <Link href={`/student/courses/${courseId}/learn`} className="btn btn-secondary btn-sm">
          <i className="fa-solid fa-arrow-left" /> Back to Classroom
        </Link>
      </div>

      {/* Protected Frame containing the watermarked PDF Blob URL */}
      <div style={{ flex: 1, border: '1px solid var(--border-default)', borderRadius: 'var(--radius-xl)', overflow: 'hidden', background: '#fff' }}>
        {pdfUrl ? (
          <iframe
            src={`${pdfUrl}#toolbar=0`}
            style={{ width: '100%', height: '100%', border: 'none' }}
            title="Watermarked Study Guide Viewer"
          />
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <p className="text-muted">Failed to stream PDF guide.</p>
          </div>
        )}
      </div>
    </div>
  );
}
