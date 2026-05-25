'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Note {
  _id: string;
  title: string;
  content?: string;
  updatedAt: string;
  courseId?: { _id: string; title: string };
  lessonId?: { _id: string; title: string };
}

interface Course {
  _id: string;
  title: string;
}

interface Lesson {
  _id: string;
  title: string;
}

export default function StudentNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [courses, setCourses] = useState<Course[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);

  // Note Creation Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [title, setTitle] = useState('');
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedLessonId, setSelectedLessonId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    fetchNotesAndCourses();
  }, []);

  useEffect(() => {
    if (selectedCourseId) {
      fetchLessons(selectedCourseId);
    } else {
      setLessons([]);
    }
  }, [selectedCourseId]);

  const fetchNotesAndCourses = async () => {
    setLoading(true);
    try {
      const [notesRes, ordersRes] = await Promise.all([
        api.get('/notes'),
        api.get('/orders')
      ]);
      setNotes(notesRes.data.notes || []);

      // Extract unique successful courses for note linkage
      const successfulCourses: Record<string, Course> = {};
      (ordersRes.data.orders || []).forEach((order: any) => {
        if (order.status === 'SUCCESS' && order.bundleId?.courseId) {
          const c = order.bundleId.courseId as Course;
          successfulCourses[c._id] = c;
        }
      });
      setCourses(Object.values(successfulCourses));
    } catch (err: any) {
      toast.error('Failed to load notes workspace');
    } finally {
      setLoading(false);
    }
  };

  const fetchLessons = async (courseId: string) => {
    try {
      const { data } = await api.get(`/courses/${courseId}`);
      setLessons(data.lessons || []);
      if (data.lessons?.length > 0) {
        setSelectedLessonId(data.lessons[0]._id);
      }
    } catch (e) {
      toast.error('Failed to load course lessons');
    }
  };

  const handleCreateNote = async () => {
    if (!title.trim() || !selectedCourseId || !selectedLessonId) {
      toast.error('Please complete all form fields');
      return;
    }
    setCreating(true);

    try {
      const { data } = await api.post('/notes', {
        courseId: selectedCourseId,
        lessonId: selectedLessonId,
        title: title.trim(),
        content: 'Start writing your polished study notes here...'
      });

      toast.success('Study Note created!');
      setShowCreateModal(false);
      setTitle('');
      setSelectedCourseId('');
      setSelectedLessonId('');
      
      // Refresh list
      fetchNotesAndCourses();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to create note');
    } finally {
      setCreating(false);
    }
  };

  const handleDeleteNote = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (!confirm('Are you sure you want to delete this study note?')) return;

    try {
      await api.delete(`/notes/${id}`);
      toast.success('Note deleted');
      setNotes(prev => prev.filter(n => n._id !== id));
    } catch (err) {
      toast.error('Failed to delete note');
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
        <h1>Notes Workspace</h1>
        <p>Review, format, and visualize your study notes with advanced Claude AI agents.</p>
      </div>

      <div className="notes-grid">
        {/* Create Dotted Card */}
        <div className="create-note-card" onClick={() => setShowCreateModal(true)}>
          <i className="fa-solid fa-square-plus" />
          <span>New Study Note</span>
        </div>

        {notes.map((note) => (
          <Link href={`/student/notes/${note._id}`} key={note._id}>
            <div className="note-card">
              <span className="note-card-course truncate">
                {note.courseId?.title || 'Robotics Syllabus'}
              </span>
              <h4 className="truncate">{note.title}</h4>
              <p className="note-card-preview">
                {note.content?.replace(/[#*`[\]\-]/g, '') || 'Empty study note. Write summary or generate mindmaps...'}
              </p>
              <div className="note-card-date flex justify-between items-center" style={{ width: '100%' }}>
                <span>Updated: {new Date(note.updatedAt).toLocaleDateString()}</span>
                <button
                  onClick={(e) => handleDeleteNote(note._id, e)}
                  style={{ color: 'var(--danger)', fontSize: '0.8125rem' }}
                >
                  <i className="fa-regular fa-trash-can" />
                </button>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Note Creation Modal */}
      {showCreateModal && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-flat" style={{ width: 480, padding: 32, background: 'var(--bg-card)', zIndex: 1001, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-light)' }}>
            <h3 style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 10 }}>
              <i className="fa-solid fa-file-signature" style={{ color: 'var(--tech-blue)' }} /> Create Study Note
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 24 }}>
              <div>
                <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Note Title</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. Kinematics Mathematical Formulations"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Enrolled Pathway</label>
                <select
                  className="select"
                  value={selectedCourseId}
                  onChange={(e) => setSelectedCourseId(e.target.value)}
                >
                  <option value="">Choose Course...</option>
                  {courses.map((c) => (
                    <option key={c._id} value={c._id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              {selectedCourseId && (
                <div>
                  <label className="label" style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Select Syllabus Topic</label>
                  <select
                    className="select"
                    value={selectedLessonId}
                    onChange={(e) => setSelectedLessonId(e.target.value)}
                  >
                    <option value="">Choose Lecture...</option>
                    {lessons.map((l) => (
                      <option key={l._id} value={l._id}>
                        {l.title}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12 }}>
              <button className="btn btn-secondary" onClick={() => setShowCreateModal(false)} disabled={creating}>
                Cancel
              </button>
              <button className="btn btn-primary" onClick={handleCreateNote} disabled={creating}>
                {creating ? 'Creating...' : 'Create Note'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
