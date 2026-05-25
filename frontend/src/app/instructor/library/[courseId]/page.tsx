'use client';

import { useState, useEffect, useRef } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/stores/authStore';
import Link from 'next/link';

interface Lesson {
  _id: string;
  title: string;
  type: 'VIDEO' | 'PDF';
  storagePath: string;
  orderIndex: number;
}

export default function InstructorPlayer({ params }: { params: { courseId: string } }) {
  const { user } = useAuthStore();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);

  // Video State
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // PDF State
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [pdfLoading, setPdfLoading] = useState(false);

  // Completed Map
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // AI Summary
  const [summarising, setSummarising] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // AI RAG Tutor
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // Bookmarking
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  // HTMLVideo reference
  const videoRef = useRef<HTMLVideoElement>(null);
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Watermark details
  const [watermarkTime, setWatermarkTime] = useState('');

  useEffect(() => {
    fetchCourseDetails();
    fetchBookmarks();

    const interval = setInterval(() => {
      setWatermarkTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    }, 1000);

    return () => {
      clearInterval(interval);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [params.courseId]);

  useEffect(() => {
    if (currentLesson) {
      setAiSummary(null);
      setAiAnswer(null);
      setVideoSrc('');
      setPdfUrl('');

      if (currentLesson.type === 'VIDEO') {
        loadProtectedVideo(currentLesson._id);
      } else {
        loadProtectedPDF(currentLesson._id);
      }
    }
  }, [currentLesson]);

  const fetchCourseDetails = async () => {
    try {
      const { data: detailData } = await api.get(`/courses/${params.courseId}`);
      setCourse(detailData.course);
      const sorted = detailData.lessons || [];
      setLessons(sorted);

      const { data: progressData } = await api.get(`/progress/${params.courseId}`);
      setCompletedLessons(progressData.completedLessons || []);

      if (sorted.length > 0) {
        setCurrentLesson(sorted[0]);
      }
    } catch (err: any) {
      toast.error('Failed to load course player curriculum');
    }
  };

  const fetchBookmarks = async () => {
    try {
      const { data } = await api.get('/bookmarks');
      const filtered = data.bookmarks?.filter((b: any) => b.lessonId?.courseId === params.courseId) || [];
      setBookmarks(filtered);
    } catch (e) {
      // ignore
    }
  };

  const loadProtectedVideo = async (lessonId: string) => {
    setVideoLoading(true);
    setDownloadProgress(0);

    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/courses/${params.courseId}/stream/${lessonId}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      if (!response.ok) throw new Error('Video stream fetch failed');

      const contentLength = response.headers.get('content-length');
      const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
      let loadedBytes = 0;

      const reader = response.body?.getReader();
      const chunks: Uint8Array[] = [];

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          chunks.push(value);
          loadedBytes += value.length;
          if (totalBytes > 0) {
            setDownloadProgress(Math.round((loadedBytes / totalBytes) * 100));
          }
        }
      }

      const blob = new Blob(chunks as any, { type: 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);
      setVideoSrc(blobUrl);

      // Save watch position progress
      setupProgressTracker(lessonId);
    } catch (err) {
      toast.error('Failed to stream secure instructor HLS source');
    } finally {
      setVideoLoading(false);
    }
  };

  const loadProtectedPDF = async (lessonId: string) => {
    setPdfLoading(true);
    try {
      const token = localStorage.getItem('accessToken');
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/courses/${params.courseId}/pdf/${lessonId}`,
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
    } catch (err) {
      toast.error('Failed to load secure watermarked PDF guide');
    } finally {
      setPdfLoading(false);
    }
  };

  const setupProgressTracker = (lessonId: string) => {
    if (progressTimerRef.current) clearInterval(progressTimerRef.current);

    progressTimerRef.current = setInterval(() => {
      const video = videoRef.current;
      if (video && !video.paused) {
        api.put(`/progress/${lessonId}`, {
          watchedSecs: Math.round(video.currentTime),
          totalSecs: Math.round(video.duration || 100),
          lastPosition: Math.round(video.currentTime)
        }).then(({ data }) => {
          if (data.progress?.completed && !completedLessons.includes(lessonId)) {
            setCompletedLessons(prev => [...prev, lessonId]);
            toast.success('Lecture marked completed!');
          }
        }).catch(() => {});
      }
    }, 5000);
  };

  const handleAddBookmark = async () => {
    const video = videoRef.current;
    if (!currentLesson) return;
    const timestamp = video ? Math.round(video.currentTime) : 0;

    try {
      await api.post('/bookmarks', {
        lessonId: currentLesson._id,
        timestampSecs: timestamp,
        note: bookmarkNote || 'Flagged syllabus reference'
      });
      setBookmarkNote('');
      toast.success('Flagged point saved successfully!');
      fetchBookmarks();
    } catch (err) {
      toast.error('Failed to save bookmark reference');
    }
  };

  const handleTriggerSummary = async () => {
    if (!currentLesson) return;
    setSummarising(true);
    setAiSummary(null);

    try {
      const { data } = await api.post(`/ai/summarise/${currentLesson._id}`);
      const jobId = data.jobId;

      const interval = setInterval(async () => {
        try {
          const { data: jobRes } = await api.get(`/ai/jobs/${jobId}`);
          if (jobRes.job?.status === 'DONE') {
            clearInterval(interval);
            setAiSummary(jobRes.job.result);
            setSummarising(false);
            toast.success('Syllabus summary generated!');
          } else if (jobRes.job?.status === 'FAILED') {
            clearInterval(interval);
            setSummarising(false);
            toast.error('Syllabus summary failed.');
          }
        } catch (e) {
          clearInterval(interval);
          setSummarising(false);
        }
      }, 3000);
    } catch (err) {
      setSummarising(false);
      toast.error('Failed to trigger summarizing agent');
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAiAnswer(null);

    try {
      const { data } = await api.post('/ai/ask', {
        courseId: params.courseId,
        question: question.trim()
      });
      setAiAnswer(data.answer);
      setQuestion('');
    } catch (err) {
      toast.error('AI Tutor is currently offline');
    } finally {
      setAsking(false);
    }
  };

  const formatTime = (secs: number) => {
    const minutes = Math.floor(secs / 60);
    const seconds = Math.floor(secs % 60);
    return `${minutes}:${seconds < 10 ? '0' : ''}${seconds}`;
  };

  return (
    <div className="fade-in player-layout">
      {/* Left side main player */}
      <div className="player-main">
        {/* Protected Viewport */}
        {currentLesson?.type === 'VIDEO' ? (
          <div className="player-video">
            {videoLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, color: '#fff' }}>
                <div className="spinner" />
                <div style={{ fontSize: '0.8125rem' }}>Loading secure pathway stream... {downloadProgress}%</div>
              </div>
            ) : videoSrc ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  controls
                  controlsList="nodownload"
                  style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                />

                {/* Floating Anti-Piracy Watermark Overlay */}
                <div
                  className="watermark-overlay"
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    pointerEvents: 'none',
                    zIndex: 10,
                    overflow: 'hidden'
                  }}
                >
                  <div
                    style={{
                      position: 'absolute',
                      color: 'rgba(255, 255, 255, 0.07)',
                      fontSize: '0.9375rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      transform: 'rotate(-45deg)',
                      animation: 'moveWatermark 14s linear infinite',
                    }}
                  >
                    INSTRUCTOR: {user?.name || 'Faculty'} ({user?.mobile}) | {watermarkTime} | RoboAIPaths Protected Stream
                  </div>
                </div>
              </div>
            ) : (
              <div style={{ color: '#fff', fontSize: '0.875rem' }}>Select a topic to start playing HLS streams.</div>
            )}
          </div>
        ) : (
          <div className="player-pdf">
            {pdfLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', gap: 12 }}>
                <div className="spinner" />
                <span>Loading watermarked study blueprint PDF...</span>
              </div>
            ) : pdfUrl ? (
              <iframe
                src={`${pdfUrl}#toolbar=0`}
                style={{ width: '100%', height: 600, border: 'none' }}
                title="Watermarked Instructor Study Guide"
              />
            ) : (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)' }}>
                Select a guide to open the watermarked PDF in-viewport.
              </div>
            )}
          </div>
        )}

        {/* Lesson Description */}
        <div className="player-lesson-info">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-light)', paddingBottom: 16, marginBottom: 16 }}>
            <div>
              <h2>{currentLesson?.title || 'Loading Lecture Content...'}</h2>
              <span className="badge" style={{ background: 'var(--tech-blue-light)', color: 'var(--tech-blue)', fontSize: '0.6875rem' }}>
                Syllabus Material: {currentLesson?.type || 'Blueprint'}
              </span>
            </div>
            <Link href="/instructor/library" className="btn btn-secondary btn-sm">
              <i className="fa-solid fa-circle-chevron-left" style={{ marginRight: 6 }} /> Back to Library
            </Link>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 24 }}>
            {/* Timestamp flagger */}
            <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-default)', borderRadius: 16 }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.875rem', fontWeight: 700 }}>
                <i className="fa-solid fa-flag" style={{ color: 'var(--tech-blue)' }} /> Flag Blueprint Segment
              </h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input input-sm"
                  placeholder="e.g. Core mechanics diagram..."
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                />
                <button className="btn btn-secondary btn-sm" onClick={handleAddBookmark}>
                  Flag
                </button>
              </div>
              <div style={{ marginTop: 14, maxHeight: 120, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookmarks.map((bm) => (
                  <div key={bm._id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 8, fontSize: '0.75rem' }}>
                    <span className="truncate" style={{ flex: 1, marginRight: 8 }}>{bm.note}</span>
                    <span style={{ fontWeight: 600, color: 'var(--tech-blue)' }}>{formatTime(bm.timestampSecs)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summary */}
            <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-default)', borderRadius: 16 }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.875rem', fontWeight: 700 }}>
                <i className="fa-solid fa-robot" style={{ color: 'var(--tech-blue)' }} /> Lesson AI Summary
              </h4>
              {aiSummary ? (
                <div style={{ background: 'var(--bg-input)', padding: 14, borderRadius: 12, maxHeight: 150, overflowY: 'auto', fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
                  {aiSummary}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: '12px 0' }}>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textAlign: 'center' }}>
                    Process the syllabus lecture transcripts using AI to generate high-quality outlines.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={handleTriggerSummary} disabled={summarising}>
                    {summarising ? 'Analyzing Feed...' : 'Summarise Guide'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RAG Q&A */}
          <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-default)', borderRadius: 16, marginTop: 24 }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, fontSize: '0.875rem', fontWeight: 700 }}>
              <i className="fa-solid fa-magnifying-glass-chart" style={{ color: 'var(--tech-blue)' }} /> Pathways AI Tutor
            </h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
              <input
                type="text"
                className="input"
                placeholder="Query anything about sensor calibration, control loops, or dynamic code structures..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              />
              <button className="btn btn-primary" onClick={handleAskQuestion} disabled={asking}>
                {asking ? 'Searching...' : 'Search'}
              </button>
            </div>
            {aiAnswer && (
              <div style={{ borderLeft: '4px solid var(--tech-blue)', background: 'var(--bg-input)', padding: '16px 20px', borderRadius: '0 12px 12px 0', fontSize: '0.8125rem' }}>
                <div style={{ fontWeight: 700, color: 'var(--tech-blue)', textTransform: 'uppercase', marginBottom: 4, fontSize: '0.6875rem' }}>
                  AI Blueprint Answer:
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{aiAnswer}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Right side lessons sidebar */}
      <aside className="lesson-sidebar">
        <div className="lesson-sidebar-header">
          Pathway Curriculum
          <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 400, marginTop: 4 }}>
            {lessons.length} Modules • {completedLessons.length} Reviewed
          </span>
        </div>
        <div className="lesson-sidebar-list">
          {lessons.map((lesson) => {
            const isActive = currentLesson?._id === lesson._id;
            const isCompleted = completedLessons.includes(lesson._id);

            return (
              <div
                key={lesson._id}
                className={`lesson-sidebar-item ${isActive ? 'active' : ''}`}
                onClick={() => setCurrentLesson(lesson)}
              >
                <i className={lesson.type === 'VIDEO' ? 'fa-solid fa-circle-play' : 'fa-solid fa-file-pdf'} />
                <div className="lesson-name" style={{ flex: 1 }}>
                  {lesson.title}
                </div>
                {isCompleted && (
                  <span style={{ color: 'var(--success)', fontSize: '0.8125rem' }}>
                    <i className="fa-solid fa-circle-check" />
                  </span>
                )}
              </div>
            );
          })}
        </div>
      </aside>

      <style jsx global>{`
        @keyframes moveWatermark {
          0% {
            top: 5%;
            left: -40%;
          }
          50% {
            top: 75%;
            left: 75%;
          }
          100% {
            top: 5%;
            left: -40%;
          }
        }
      `}</style>
    </div>
  );
}
