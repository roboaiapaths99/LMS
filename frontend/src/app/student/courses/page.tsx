'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Course {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  createdBy?: { name?: string; avatarUrl?: string };
}

export default function StudentCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCoursesAndCategories();
  }, []);

  const fetchCoursesAndCategories = async () => {
    setLoading(true);
    try {
      const [coursesRes, categoriesRes] = await Promise.all([
        api.get('/courses'),
        api.get('/courses/categories')
      ]);
      setCourses(coursesRes.data.courses || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (err: any) {
      toast.error('Failed to load courses catalogue');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesSearch = 
      course.title.toLowerCase().includes(search.toLowerCase()) || 
      (course.description || '').toLowerCase().includes(search.toLowerCase());
    const matchesCategory = selectedCategory ? course.category === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

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
        <h1>Course Catalogue</h1>
        <p>Unlock premium robotics and AI learning pathways designed by industry experts.</p>
      </div>

      {/* Catalogue Toolbar */}
      <div className="catalogue-toolbar">
        <div className="search-input-wrapper">
          <i className="fa-solid fa-magnifying-glass" />
          <input
            type="text"
            className="input"
            placeholder="Search robotics & AI courses..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          className="select filter-select"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
        >
          <option value="">All Categories</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Course Grid */}
      {filteredCourses.length === 0 ? (
        <div className="empty-state card-flat" style={{ padding: 48 }}>
          <div className="empty-state-icon">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <h3>No courses found</h3>
          <p>We couldn't find any courses matching your search query or category filters.</p>
          <button
            onClick={() => {
              setSearch('');
              setSelectedCategory('');
            }}
            className="btn btn-primary mt-md"
          >
            Clear Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {filteredCourses.map((course) => (
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
                <p className="text-muted" style={{ fontSize: '0.8125rem', lineBreak: 'anywhere', minHeight: 60, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.description || 'No description available for this courses pathway.'}
                </p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 12, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  <i className="fa-solid fa-user-tie" style={{ color: 'var(--tech-blue)' }} />
                  <span>By {course.createdBy?.name || 'RoboAIPaths Faculty'}</span>
                </div>
              </div>
              <div className="library-card-footer">
                <Link href={`/student/courses/${course._id}`} className="btn btn-secondary btn-sm" style={{ width: '100%' }}>
                  View Syllabus & Bundles <i className="fa-solid fa-arrow-right" style={{ fontSize: '0.75rem' }} />
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
