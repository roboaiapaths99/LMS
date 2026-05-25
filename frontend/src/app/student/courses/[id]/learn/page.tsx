'use client';

import { useState, useEffect, useRef, use } from 'react';
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

export default function CourseLearn({ params }: { params: Promise<{ id: string }> | any }) {
  const resolvedParams = use(params) as any;
  const courseId = resolvedParams.id;

  const { user } = useAuthStore();
  const [course, setCourse] = useState<any>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  
  // Video Blob URL & Loading
  const [videoSrc, setVideoSrc] = useState<string>('');
  const [videoLoading, setVideoLoading] = useState(false);
  const [downloadProgress, setDownloadProgress] = useState(0);

  // Lesson Completion Status Map
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);
  
  // AI summary
  const [summarising, setSummarising] = useState(false);
  const [aiSummary, setAiSummary] = useState<string | null>(null);

  // AI Q&A
  const [question, setQuestion] = useState('');
  const [asking, setAsking] = useState(false);
  const [aiAnswer, setAiAnswer] = useState<string | null>(null);

  // Bookmarking
  const [bookmarkNote, setBookmarkNote] = useState('');
  const [bookmarks, setBookmarks] = useState<any[]>([]);

  // HTML5 Video element reference
  const videoRef = useRef<HTMLVideoElement>(null);
  
  // Progress tracker timer
  const progressTimerRef = useRef<NodeJS.Timeout | null>(null);

  // Floating Watermark Timestamp State
  const [watermarkTime, setWatermarkTime] = useState('');

  useEffect(() => {
    fetchCourseAndProgress();
    fetchBookmarks();
    
    // Update watermark timestamp every second
    const interval = setInterval(() => {
      setWatermarkTime(new Date().toLocaleTimeString());
    }, 1000);
    return () => {
      clearInterval(interval);
      if (progressTimerRef.current) clearInterval(progressTimerRef.current);
    };
  }, [courseId]);

  useEffect(() => {
    if (currentLesson) {
      setAiSummary(null);
      setAiAnswer(null);
      if (currentLesson.type === 'VIDEO') {
        loadProtectedVideo(currentLesson._id);
      } else {
        setVideoSrc('');
      }
    }
  }, [currentLesson]);

  const fetchCourseAndProgress = async () => {
    try {
      const { data: detailData } = await api.get(`/courses/${courseId}`);
      setCourse(detailData.course);
      const sortedLessons = detailData.lessons || [];
      setLessons(sortedLessons);

      const { data: progressData } = await api.get(`/progress/${courseId}`);
      setCompletedLessons(progressData.completedLessons || []);

      // Auto-select first lesson, or the first uncompleted one
      if (sortedLessons.length > 0) {
        const firstUncompleted = sortedLessons.find(
          (l: Lesson) => !(progressData.completedLessons || []).includes(l._id)
        );
        setCurrentLesson(firstUncompleted || sortedLessons[0]);
      }
    } catch (err: any) {
      toast.error('Failed to load learn pathway.');
    }
  };

  const fetchBookmarks = async () => {
    try {
      const { data } = await api.get('/bookmarks');
      const filtered = data.bookmarks?.filter((b: any) => b.lessonId?.courseId === courseId) || [];
      setBookmarks(filtered);
    } catch (e) {
      // ignore
    }
  };

  const loadProtectedVideo = async (lessonId: string) => {
    setVideoLoading(true);
    setDownloadProgress(0);
    setVideoSrc('');

    try {
      const token = localStorage.getItem('accessToken');
      const streamUrl = `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/courses/${courseId}/stream/${lessonId}?token=${encodeURIComponent(token || '')}`;
      
      setVideoSrc(streamUrl);

      // Start saving progress once loaded
      setupProgressTracker(lessonId);
    } catch (err: any) {
      toast.error('Failed to load video stream');
    } finally {
      setVideoLoading(false);
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
    if (!video || !currentLesson) return;

    try {
      await api.post('/bookmarks', {
        lessonId: currentLesson._id,
        timestampSecs: Math.round(video.currentTime),
        note: bookmarkNote || 'Flagged video segment'
      });
      setBookmarkNote('');
      toast.success('Bookmark added at current timestamp!');
      fetchBookmarks();
    } catch (err) {
      toast.error('Failed to save bookmark');
    }
  };

  const handleTriggerSummary = async () => {
    if (!currentLesson) return;
    setSummarising(true);
    setAiSummary(null);

    try {
      const { data } = await api.post(`/ai/summarise/${currentLesson._id}`);
      const jobId = data.jobId;

      // Poll job status
      const interval = setInterval(async () => {
        try {
          const { data: jobRes } = await api.get(`/ai/jobs/${jobId}`);
          if (jobRes.job?.status === 'DONE') {
            clearInterval(interval);
            setAiSummary(jobRes.job.result);
            setSummarising(false);
            toast.success('AI summary generation complete!');
          } else if (jobRes.job?.status === 'FAILED') {
            clearInterval(interval);
            setSummarising(false);
            toast.error('AI summary generation failed.');
          }
        } catch (e) {
          clearInterval(interval);
          setSummarising(false);
        }
      }, 3000);
    } catch (err) {
      setSummarising(false);
      toast.error('Failed to trigger summary agent');
    }
  };

  const handleAskQuestion = async () => {
    if (!question.trim()) return;
    setAsking(true);
    setAiAnswer(null);

    try {
      const { data } = await api.post('/ai/ask', {
        courseId: courseId,
        question: question.trim()
      });
      setAiAnswer(data.answer);
      setQuestion('');
    } catch (err) {
      toast.error('AI Assistant did not respond.');
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
    <div className="learn-layout">
      {/* Video Viewport Area */}
      <div className="video-section">
        <div style={{ position: 'relative', width: '100%', aspectRatio: '16/9', background: '#000' }}>
          {currentLesson?.type === 'VIDEO' ? (
            videoLoading ? (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 12 }}>
                <div className="spinner" />
                <div style={{ fontSize: '0.875rem' }}>Loading protected HLS video feed... {downloadProgress}%</div>
              </div>
            ) : videoSrc ? (
              <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                <video
                  ref={videoRef}
                  src={videoSrc}
                  className="video-player"
                  controls
                  controlsList="nodownload"
                  style={{ width: '100%', height: '100%' }}
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
                      color: 'rgba(255, 255, 255, 0.08)',
                      fontSize: '1rem',
                      fontFamily: 'monospace',
                      whiteSpace: 'nowrap',
                      transform: 'rotate(-45deg)',
                      animation: 'moveWatermark 12s linear infinite',
                    }}
                  >
                    {user?.name || 'Student'} ({user?.mobile}) | {watermarkTime} | RoboAIPaths Protected Content
                  </div>
                </div>
              </div>
            ) : null
          ) : (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#fff', gap: 16 }}>
              <i className="fa-solid fa-file-pdf" style={{ fontSize: '3rem', color: 'var(--tech-blue)' }} />
              <h3>PDF Study Guide Unlocked</h3>
              <p className="text-muted" style={{ fontSize: '0.875rem' }}>Click below to read the watermarked PDF copy safely.</p>
              <Link href={`/student/courses/${courseId}/pdf?lesson=${currentLesson?._id}`} className="btn btn-primary btn-sm">
                Open Watermarked PDF Viewer <i className="fa-solid fa-up-right-from-square" />
              </Link>
            </div>
          )}
        </div>

        <div className="video-info">
          <h2>{currentLesson?.title || 'Loading Lecture...'}</h2>
          <p>RoboAIAPaths Educational Network — All Rights Reserved.</p>

          {/* AI and Bookmark Options */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginTop: 32 }}>
            {/* Bookmarks Section */}
            <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-default)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <i className="fa-regular fa-bookmark" style={{ color: 'var(--tech-blue)' }} /> Flag Timestamp
              </h4>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Important formula definition..."
                  value={bookmarkNote}
                  onChange={(e) => setBookmarkNote(e.target.value)}
                />
                <button className="btn btn-secondary" onClick={handleAddBookmark}>
                  Flag
                </button>
              </div>
              <div style={{ marginTop: 16, maxHeight: 150, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
                {bookmarks.map((bm) => (
                  <div key={bm._id} style={{ display: 'flex', justifyContent: 'space-between', background: 'var(--bg-input)', padding: '6px 12px', borderRadius: 'var(--radius-sm)', fontSize: '0.75rem' }}>
                    <span className="truncate" style={{ flex: 1, marginRight: 8 }}>{bm.note}</span>
                    <span style={{ fontFamily: 'monospace', fontWeight: 600, color: 'var(--tech-blue)' }}>{formatTime(bm.timestampSecs)}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* AI Summarize Section */}
            <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-default)' }}>
              <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <i className="fa-solid fa-wand-magic-sparkles" style={{ color: 'var(--tech-blue)' }} /> AI Summary Agent
              </h4>
              {aiSummary ? (
                <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--radius-md)', maxHeight: 200, overflowY: 'auto', fontSize: '0.8125rem', whiteSpace: 'pre-wrap' }}>
                  {aiSummary}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '16px 0', gap: 12 }}>
                  <p className="text-muted" style={{ fontSize: '0.75rem', textAlign: 'center' }}>
                    Generate structured highlights, core concepts, and formulas definitions using Claude AI.
                  </p>
                  <button className="btn btn-primary btn-sm" onClick={handleTriggerSummary} disabled={summarising}>
                    {summarising ? 'Generating Summary...' : 'Summarise Lecture'}
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* RAG Q&A Assistant */}
          <div className="card-flat" style={{ padding: 24, border: '1px solid var(--border-default)', marginTop: 24 }}>
            <h4 style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <i className="fa-solid fa-comments" style={{ color: 'var(--tech-blue)' }} /> Course AI Tutor
            </h4>
            <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
              <input
                type="text"
                className="input"
                placeholder="Ask anything about the robotics & AI curriculum context..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAskQuestion()}
              />
              <button className="btn btn-primary" onClick={handleAskQuestion} disabled={asking}>
                {asking ? 'Asking...' : 'Ask'}
              </button>
            </div>
            {aiAnswer && (
              <div style={{ borderLeft: '4px solid var(--tech-blue)', background: 'var(--bg-input)', padding: '16px 20px', borderRadius: '0 var(--radius-md) var(--radius-md) 0', fontSize: '0.875rem' }}>
                <div style={{ fontWeight: 700, fontSize: '0.75rem', color: 'var(--tech-blue)', textTransform: 'uppercase', marginBottom: 4 }}>
                  AI Tutor Response:
                </div>
                <div style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>{aiAnswer}</div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Lesson Sidebar */}
      <aside className="lesson-sidebar">
        <div className="lesson-sidebar-header">
          Course Syllabus
          <span>{lessons.length} topics • {completedLessons.length} completed</span>
        </div>
        <div className="lesson-list">
          {lessons.map((lesson) => {
            const isActive = currentLesson?._id === lesson._id;
            const isCompleted = completedLessons.includes(lesson._id);
            return (
              <div
                key={lesson._id}
                className={`lesson-item ${isActive ? 'active' : ''} ${isCompleted ? 'completed' : ''}`}
                onClick={() => setCurrentLesson(lesson)}
              >
                <div className="lesson-check">
                  {isCompleted && <i className="fa-solid fa-check" />}
                </div>
                <div className="lesson-item-info">
                  <div className="lesson-item-title">{lesson.title}</div>
                  <div className="lesson-item-duration">
                    <i className={lesson.type === 'VIDEO' ? 'fa-solid fa-circle-play' : 'fa-solid fa-file-pdf'} style={{ marginRight: 6 }} />
                    {lesson.type}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      <style jsx global>{`
        @keyframes moveWatermark {
          0% {
            top: 10%;
            left: -30%;
          }
          50% {
            top: 80%;
            left: 80%;
          }
          100% {
            top: 10%;
            left: -30%;
          }
        }
      `}</style>
    </div>
  );
}
