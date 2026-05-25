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

export default function InstructorCatalogue() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCatalogueData();
  }, []);

  const fetchCatalogueData = async () => {
    setLoading(true);
    try {
      const [coursesRes, categoriesRes] = await Promise.all([
        api.get('/courses'),
        api.get('/courses/categories').catch(() => ({ data: { categories: [] } }))
      ]);

      setCourses(coursesRes.data.courses || []);
      setCategories(categoriesRes.data.categories || []);
    } catch (err: any) {
      toast.error('Failed to load catalogue pathways');
    } finally {
      setLoading(false);
    }
  };

  const filteredCourses = courses.filter((course) => {
    const matchesCategory =
      selectedCategory === 'ALL' || course.category === selectedCategory;
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
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
      {/* Hero section */}
      <div className="welcome-card" style={{ background: 'linear-gradient(135deg, var(--dark-navy) 0%, var(--tech-blue) 100%)' }}>
        <h1>Syllabus Pathways & Catalog</h1>
        <p>Explore specialized curriculum guides, certified hardware designs, and AI pathway courses specifically structured for instructor instruction.</p>
      </div>

      {/* Filter and Search controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 16, justifyContent: 'space-between', alignItems: 'center', marginBottom: 32 }}>
        {/* Category Tabs */}
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
          <button
            className={`btn btn-sm ${selectedCategory === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setSelectedCategory('ALL')}
          >
            All Categories
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              className={`btn btn-sm ${selectedCategory === cat ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => setSelectedCategory(cat)}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ position: 'relative', width: '100%', maxWidth: 300 }}>
          <input
            type="text"
            className="input"
            placeholder="Search syllabus paths..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ paddingLeft: 36 }}
          />
          <i
            className="fa-solid fa-magnifying-glass"
            style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }}
          />
        </div>
      </div>

      {/* Grid List */}
      {filteredCourses.length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">
            <i className="fa-solid fa-graduation-cap" />
          </div>
          <h3>No pathways found</h3>
          <p>We couldn't find any learning paths matching your selected criteria.</p>
        </div>
      ) : (
        <div className="grid grid-3" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 24 }}>
          {filteredCourses.map((course) => (
            <div key={course._id} className="library-card" style={{ background: 'var(--bg-card)', borderRadius: 24, border: '1px solid var(--border-light)', overflow: 'hidden', transition: 'var(--transition)' }}>
              <div className="library-card-thumb" style={{ height: 160, background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '3rem', position: 'relative' }}>
                {course.thumbnailUrl ? (
                  <img src={course.thumbnailUrl} alt={course.title} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <i className="fa-solid fa-robot" />
                )}
              </div>
              <div style={{ padding: 24 }}>
                <span className="discount-badge" style={{ background: 'var(--tech-blue-light)', color: 'var(--tech-blue)', fontSize: '0.6875rem', marginBottom: 8, display: 'inline-block' }}>
                  {course.category || 'Robotics Syllabus'}
                </span>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '8px 0 12px', minHeight: 48, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {course.title}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden', marginBottom: 20, minHeight: 48 }}>
                  {course.description || 'Dive into advanced training in robotics and artificial intelligence. Our pathways combine mathematical theory and simulated/hardware laboratory applications to accelerate professional growth.'}
                </p>

                <div style={{ display: 'flex', gap: 12 }}>
                  <Link href={`/instructor/catalogue/${course._id}`} className="btn btn-primary btn-sm" style={{ flex: 1, textAlign: 'center' }}>
                    Syllabus Preview <i className="fa-solid fa-arrow-right" style={{ marginLeft: 6 }} />
                  </Link>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
