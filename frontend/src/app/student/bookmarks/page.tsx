'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Bookmark {
  _id: string;
  timestampSecs: number;
  note?: string;
  createdAt: string;
  lessonId?: {
    _id: string;
    title: string;
    courseId?: string;
  };
}

export default function StudentBookmarks() {
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBookmarks();
  }, []);

  const fetchBookmarks = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/bookmarks');
      setBookmarks(data.bookmarks || []);
    } catch (err: any) {
      toast.error('Failed to load bookmarks');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteBookmark = async (id: string) => {
    try {
      await api.delete(`/bookmarks/${id}`);
      toast.success('Bookmark removed');
      setBookmarks(prev => prev.filter(b => b._id !== id));
    } catch (err) {
      toast.error('Failed to remove bookmark');
    }
  };

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
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
        <h1>Bookmarked Segments</h1>
        <p>Review key timeline flags you captured during your syllabus lectures.</p>
      </div>

      {bookmarks.length === 0 ? (
        <div className="empty-state card-flat" style={{ padding: 48 }}>
          <div className="empty-state-icon">
            <i className="fa-solid fa-bookmark" />
          </div>
          <h3>No bookmarks saved</h3>
          <p>Click "Flag" while watching standard training lectures to save bookmarks here.</p>
          <Link href="/student/courses" className="btn btn-primary mt-md">
            Explore Courses
          </Link>
        </div>
      ) : (
        <div className="bookmark-list">
          {bookmarks.map((bm) => {
            const courseId = bm.lessonId?.courseId;
            const lessonId = bm.lessonId?._id;
            return (
              <div key={bm._id} className="bookmark-card">
                <div className="bookmark-icon">
                  <i className="fa-solid fa-flag" />
                </div>
                <div className="bookmark-info">
                  <h4 style={{ fontWeight: 700 }}>{bm.lessonId?.title || 'Lecture File'}</h4>
                  <div className="bookmark-meta">
                    <span>
                      <i className="fa-regular fa-clock" /> Flagged: {formatTime(bm.timestampSecs)}
                    </span>
                    <span>
                      Date: {new Date(bm.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  {bm.note && <div className="bookmark-note">"{bm.note}"</div>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {courseId && lessonId ? (
                    <Link
                      href={`/student/courses/${courseId}/learn?lesson=${lessonId}`}
                      className="btn btn-primary btn-sm"
                    >
                      Play Segment <i className="fa-solid fa-circle-play" style={{ fontSize: '0.6875rem' }} />
                    </Link>
                  ) : (
                    <span className="text-muted" style={{ fontSize: '0.75rem' }}>Course Unavailable</span>
                  )}
                  <button
                    onClick={() => handleDeleteBookmark(bm._id)}
                    className="btn btn-icon"
                    style={{ color: 'var(--danger)', padding: 8 }}
                    title="Remove Bookmark"
                  >
                    <i className="fa-regular fa-trash-can" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
