'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Lesson {
  id: string;
  title: string;
  type?: string;
  order?: number;
  duration?: number;
  videoUrl?: string;
  pdfUrl?: string;
}

interface CourseData {
  id: string;
  title: string;
  description?: string;
  category?: string;
  visibility?: string;
  status?: string;
  lessons?: Lesson[];
  isFeatured?: boolean;
}

export default function AdminCourseDetailPage() {
  const params = useParams();
  const id = params.id as string;

  const [course, setCourse] = useState<CourseData | null>(null);
  const [form, setForm] = useState({ title: '', description: '', category: '', visibility: 'STUDENT', isFeatured: false });
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [uploadingPdf, setUploadingPdf] = useState(false);
  const [reordering, setReordering] = useState(false);

  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState('');

  const videoInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef = useRef<HTMLInputElement>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);

  useEffect(() => {
    fetchCourse();
  }, [id]);

  const fetchCourse = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/courses/${id}`);
      const c = data.course || data;
      setCourse(c);
      setForm({
        title: c.title || '',
        description: c.description || '',
        category: c.category || '',
        visibility: c.visibility || 'STUDENT',
        isFeatured: !!c.isFeatured,
      });
      const rawLessons = data.lessons || c.lessons || [];
      const mappedLessons = rawLessons.map((l: any) => ({
        ...l,
        id: l._id || l.id
      }));
      setLessons(mappedLessons);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load course');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    setForm((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) {
      toast.error('Title is required');
      return;
    }
    setSaving(true);
    try {
      await api.put(`/courses/${id}`, form);
      toast.success('Course updated successfully');
      fetchCourse();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update course');
    } finally {
      setSaving(false);
    }
  };

  const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploadingVideo(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('video', files[i]);
        await api.post(`/courses/${id}/videos`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success(`${files.length} video(s) uploaded successfully`);
      fetchCourse();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Video upload failed');
    } finally {
      setUploadingVideo(false);
      if (videoInputRef.current) videoInputRef.current.value = '';
    }
  };

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files?.length) return;

    setUploadingPdf(true);
    try {
      for (let i = 0; i < files.length; i++) {
        const formData = new FormData();
        formData.append('pdf', files[i]);
        await api.post(`/courses/${id}/pdfs`, formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      }
      toast.success(`${files.length} PDF(s) uploaded successfully`);
      fetchCourse();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'PDF upload failed');
    } finally {
      setUploadingPdf(false);
      if (pdfInputRef.current) pdfInputRef.current.value = '';
    }
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === index) return;
    const updated = [...lessons];
    const [moved] = updated.splice(dragIndex, 1);
    updated.splice(index, 0, moved);
    setLessons(updated);
    setDragIndex(index);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
  };

  const handleReorder = async () => {
    setReordering(true);
    try {
      const lessonIds = lessons.map((l) => l.id);
      await api.put(`/courses/${id}/lessons/reorder`, { lessonIds });
      toast.success('Lesson order updated');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to reorder lessons');
    } finally {
      setReordering(false);
    }
  };

  const handleDeleteLesson = async (lessonId: string) => {
    if (!confirm('Are you sure you want to delete this lesson? This will permanently delete the uploaded file.')) {
      return;
    }
    try {
      await api.delete(`/courses/${id}/lessons/${lessonId}`);
      toast.success('Lesson deleted successfully');
      setLessons((prev) => prev.filter((l) => l.id !== lessonId));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete lesson');
    }
  };

  const handleRenameLesson = async (lessonId: string) => {
    if (!editingLessonTitle.trim()) return;
    try {
      await api.put(`/courses/${id}/lessons/${lessonId}`, { title: editingLessonTitle });
      toast.success('Lesson renamed successfully');
      setEditingLessonId(null);
      setLessons(prev => prev.map(l => l.id === lessonId ? { ...l, title: editingLessonTitle } : l));
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to rename lesson');
    }
  };

  if (loading) {
    return (
      <div>
        <div className="page-header">
          <div className="skeleton skeleton-title" />
        </div>
        <div className="skeleton skeleton-card" style={{ height: '300px', marginBottom: '24px' }} />
        <div className="skeleton skeleton-card" style={{ height: '200px' }} />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon"><i className="fa-solid fa-circle-exclamation" /></div>
        <h3>Course not found</h3>
        <Link href="/admin/courses" className="btn btn-primary mt-md">Back to Courses</Link>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <div className="flex items-center gap-md">
          <Link href="/admin/courses" className="btn btn-ghost btn-icon">
            <i className="fa-solid fa-arrow-left" />
          </Link>
          <div style={{ flex: 1 }}>
            <h1>{course.title}</h1>
            <p>Manage course details, lessons, and content</p>
          </div>
          <Link href="/admin/bundles" className="btn btn-secondary">
            <i className="fa-solid fa-tags" style={{ marginRight: 8 }} /> Manage Course Pricing
          </Link>
        </div>
      </div>

      {/* Edit Form */}
      <div className="card-flat" style={{ padding: '32px', marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '20px' }}>
          <i className="fa-solid fa-pen-to-square" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
          Course Details
        </h4>
        <form onSubmit={handleSave}>
          <div className="input-group mb-lg">
            <label htmlFor="title">Title *</label>
            <input type="text" id="title" name="title" className="input" value={form.title} onChange={handleChange} required />
          </div>
          <div className="input-group mb-lg">
            <label htmlFor="description">Description</label>
            <textarea id="description" name="description" className="input" value={form.description} onChange={handleChange} rows={4} />
          </div>
          <div className="flex gap-lg" style={{ flexWrap: 'wrap' }}>
            <div className="input-group mb-md" style={{ flex: '1 1 250px' }}>
              <label htmlFor="category">Category</label>
              <input type="text" id="category" name="category" className="input" value={form.category} onChange={handleChange} />
            </div>
            <div className="input-group mb-md" style={{ flex: '1 1 250px' }}>
              <label htmlFor="visibility">Visibility</label>
              <select id="visibility" name="visibility" className="input" value={form.visibility} onChange={handleChange}>
                <option value="STUDENT">Student Only</option>
                <option value="INSTRUCTOR">Instructor Only</option>
                <option value="BOTH">Both Roles</option>
              </select>
            </div>
          </div>
          <div className="input-group mb-lg" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', gap: '10px', marginTop: '12px', background: 'var(--bg-card-light)', padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--border-light)', width: 'fit-content' }}>
            <input 
              type="checkbox" 
              id="isFeatured" 
              name="isFeatured" 
              checked={form.isFeatured} 
              onChange={(e) => setForm(prev => ({ ...prev, isFeatured: e.target.checked }))} 
              style={{ width: '18px', height: '18px', cursor: 'pointer', accentColor: 'var(--tech-blue)' }}
            />
            <label htmlFor="isFeatured" style={{ margin: 0, cursor: 'pointer', fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>
              Feature this Course (Highlight on Student & Instructor Dashboard Homepages)
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? <><div className="spinner spinner-sm" /> Saving...</> : <><i className="fa-solid fa-floppy-disk" /> Save Changes</>}
          </button>
        </form>
      </div>

      {/* Upload Section */}
      <div className="card-flat" style={{ padding: '32px', marginBottom: '24px' }}>
        <h4 style={{ marginBottom: '20px' }}>
          <i className="fa-solid fa-cloud-arrow-up" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
          Upload Content
        </h4>
        <div className="flex gap-lg" style={{ flexWrap: 'wrap' }}>
          <div style={{ flex: '1 1 300px' }}>
            <p className="text-sm font-semibold mb-sm">Video Lessons</p>
            <p className="text-xs text-muted mb-md">Upload MP4, WebM or MOV files</p>
            <input
              type="file"
              ref={videoInputRef}
              accept="video/*"
              multiple
              onChange={handleVideoUpload}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-outline"
              onClick={() => videoInputRef.current?.click()}
              disabled={uploadingVideo}
            >
              {uploadingVideo ? <><div className="spinner spinner-sm" /> Uploading...</> : <><i className="fa-solid fa-video" /> Upload Videos</>}
            </button>
          </div>
          <div style={{ flex: '1 1 300px' }}>
            <p className="text-sm font-semibold mb-sm">PDF Materials</p>
            <p className="text-xs text-muted mb-md">Upload PDF documents</p>
            <input
              type="file"
              ref={pdfInputRef}
              accept=".pdf"
              multiple
              onChange={handlePdfUpload}
              style={{ display: 'none' }}
            />
            <button
              className="btn btn-outline"
              onClick={() => pdfInputRef.current?.click()}
              disabled={uploadingPdf}
            >
              {uploadingPdf ? <><div className="spinner spinner-sm" /> Uploading...</> : <><i className="fa-solid fa-file-pdf" /> Upload PDFs</>}
            </button>
          </div>
        </div>
      </div>

      {/* Curriculum / Lessons */}
      <div className="card-flat" style={{ padding: '32px' }}>
        <div className="flex items-center justify-between mb-md">
          <h4>
            <i className="fa-solid fa-list-ol" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
            Curriculum ({lessons.length} lessons)
          </h4>
          {lessons.length > 1 && (
            <button className="btn btn-primary btn-sm" onClick={handleReorder} disabled={reordering}>
              {reordering ? <><div className="spinner spinner-sm" /> Saving...</> : <><i className="fa-solid fa-arrows-up-down" /> Save Order</>}
            </button>
          )}
        </div>

        {lessons.length === 0 ? (
          <div className="empty-state" style={{ padding: '40px 20px' }}>
            <div className="empty-state-icon"><i className="fa-solid fa-film" /></div>
            <h3>No lessons yet</h3>
            <p>Upload videos or PDFs to create lessons.</p>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {lessons.map((lesson, index) => (
              <div
                key={lesson.id}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={(e) => handleDragOver(e, index)}
                onDragEnd={handleDragEnd}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '16px',
                  padding: '14px 16px',
                  background: dragIndex === index ? 'var(--tech-blue-light)' : 'var(--bg-input)',
                  borderRadius: 'var(--radius-sm)',
                  cursor: 'grab',
                  transition: 'var(--transition-fast)',
                }}
              >
                <i className="fa-solid fa-grip-vertical text-muted" />
                <span className="text-sm font-semibold" style={{ minWidth: '28px', color: 'var(--text-muted)' }}>
                  {index + 1}.
                </span>
                <i
                  className={`fa-solid ${lesson.type === 'PDF' ? 'fa-file-pdf' : 'fa-video'}`}
                  style={{ color: lesson.type === 'PDF' ? 'var(--danger)' : 'var(--tech-blue)' }}
                />
                <div style={{ flex: 1, display: 'flex', alignItems: 'center' }}>
                  {editingLessonId === lesson.id ? (
                    <input 
                      type="text" 
                      className="input" 
                      style={{ padding: '4px 8px', height: '32px', fontSize: '0.875rem', width: '100%', maxWidth: '300px' }}
                      value={editingLessonTitle}
                      onChange={(e) => setEditingLessonTitle(e.target.value)}
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.stopPropagation(); handleRenameLesson(lesson.id); } }}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                    />
                  ) : (
                    <span style={{ fontWeight: 500 }}>{lesson.title}</span>
                  )}
                </div>
                {lesson.duration && (
                  <span className="text-xs text-muted">
                    {Math.floor(lesson.duration / 60)}:{String(lesson.duration % 60).padStart(2, '0')}
                  </span>
                )}
                <span className={`badge ${lesson.type === 'PDF' ? 'badge-warning' : 'badge-primary'}`}>
                  {lesson.type || 'VIDEO'}
                </span>
                
                {editingLessonId === lesson.id ? (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRenameLesson(lesson.id);
                    }}
                    className="btn btn-icon btn-ghost"
                    style={{ color: 'var(--success)', padding: '6px', marginLeft: '8px' }}
                    title="Save Title"
                  >
                    <i className="fa-solid fa-check" />
                  </button>
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLessonId(lesson.id);
                      setEditingLessonTitle(lesson.title);
                    }}
                    className="btn btn-icon btn-ghost"
                    style={{ color: 'var(--tech-blue)', padding: '6px', marginLeft: '8px' }}
                    title="Edit Lesson Title"
                  >
                    <i className="fa-solid fa-pen" />
                  </button>
                )}

                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteLesson(lesson.id);
                  }}
                  className="btn btn-icon btn-ghost"
                  style={{ color: 'var(--danger)', padding: '6px', marginLeft: '4px' }}
                  title="Delete Lesson"
                >
                  <i className="fa-solid fa-trash-can" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
