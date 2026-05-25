'use client';

import { useState, useEffect, use } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface Lesson {
  _id: string;
  title: string;
  type: 'VIDEO' | 'PDF';
  orderIndex: number;
}

interface Bundle {
  _id: string;
  name: string;
  type: 'VIDEO_ONLY' | 'PDF_ONLY' | 'COMBO';
  priceInr: number;
  isActive: boolean;
}

interface CourseDetail {
  _id: string;
  title: string;
  description?: string;
  category?: string;
  thumbnailUrl?: string;
  createdBy?: { name?: string; avatarUrl?: string };
}

export default function CourseDetail({ params }: { params: Promise<{ id: string }> | any }) {
  const resolvedParams = use(params) as any;
  const courseId = resolvedParams.id;
  
  const router = useRouter();
  const [course, setCourse] = useState<CourseDetail | null>(null);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [selectedBundle, setSelectedBundle] = useState<Bundle | null>(null);
  
  // Coupon
  const [couponCode, setCouponCode] = useState('');
  const [validatedCoupon, setValidatedCoupon] = useState<{
    couponId: string;
    discountAmount: number;
    finalAmount: number;
  } | null>(null);

  // Access State
  const [hasAccess, setHasAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  
  // Progress State
  const [progressPercent, setProgressPercent] = useState<number>(0);
  const [completedLessons, setCompletedLessons] = useState<string[]>([]);

  // PayU Simulation Modal
  const [showPayUModal, setShowPayUModal] = useState(false);
  const [payUParams, setPayUParams] = useState<any>(null);

  useEffect(() => {
    if (courseId) {
      fetchCourseDetails();
    }
  }, [courseId]);

  const fetchCourseDetails = async () => {
    if (!courseId) return;
    setLoading(true);
    try {
      // 1. Fetch Course and Lessons
      const { data: detailData } = await api.get(`/courses/${courseId}`);
      setCourse(detailData.course);
      setLessons(detailData.lessons || []);

      // 2. Fetch Bundles
      const { data: bundlesData } = await api.get(`/bundles/${courseId}`);
      const activeBundles = (bundlesData.bundles || []).filter((b: Bundle) => b.isActive);
      setBundles(activeBundles);
      if (activeBundles.length > 0) {
        setSelectedBundle(activeBundles[0]);
      }

      // 3. Fetch orders to check if student already purchased this course
      const { data: ordersData } = await api.get('/orders');
      const successfulOrders = (ordersData.orders || []).filter(
        (o: any) => o.status === 'SUCCESS' && o.bundleId?.courseId?._id === courseId
      );
      if (successfulOrders.length > 0) {
        setHasAccess(true);
        // 4. Fetch Progress if access is granted
        try {
          const { data: progressData } = await api.get(`/progress/${courseId}`);
          setProgressPercent(progressData.progressPercent || 0);
          setCompletedLessons(progressData.completedLessons || []);
        } catch (e) {
          console.error('Failed to fetch progress', e);
        }
      }
    } catch (err: any) {
      toast.error('Failed to load course details');
    } finally {
      setLoading(false);
    }
  };

  const handleValidateCoupon = async () => {
    if (!selectedBundle) return;
    if (!couponCode.trim()) {
      toast.error('Please enter a coupon code');
      return;
    }

    try {
      const { data } = await api.post('/coupons/validate', {
        code: couponCode.trim(),
        bundleId: selectedBundle._id,
      });

      if (data.valid) {
        setValidatedCoupon(data);
        toast.success(`Coupon applied! Saved ₹${data.discountAmount}`);
      }
    } catch (err: any) {
      setValidatedCoupon(null);
      toast.error(err.response?.data?.message || 'Invalid coupon code');
    }
  };

  const handleInitiateOrder = async () => {
    if (!selectedBundle) return;
    setSubmitting(true);

    try {
      const { data } = await api.post('/orders/initiate', {
        bundleId: selectedBundle._id,
        couponCode: validatedCoupon ? couponCode.trim() : undefined,
      });

      setPayUParams(data.paymentParams);
      setShowPayUModal(true);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate checkout');
    } finally {
      setSubmitting(false);
    }
  };

  // Simulating the PayU standard processing screen
  const handleSimulatePayment = async (status: 'success' | 'failed') => {
    if (!payUParams) return;
    setSubmitting(true);

    try {
      // Direct post to backend webhook to complete the order flow locally
      const webhookPayload = {
        txnid: payUParams.txnid,
        amount: payUParams.amount,
        productinfo: payUParams.productinfo,
        firstname: payUParams.firstname,
        email: payUParams.email,
        status: status,
        hash: payUParams.hash,
      };

      await api.post('/webhooks/payu', webhookPayload);

      if (status === 'success') {
        toast.success('Payment simulated successfully! Course unlocked.');
        setHasAccess(true);
        setShowPayUModal(false);
        router.refresh();
      } else {
        toast.error('Payment simulation failed.');
        setShowPayUModal(false);
      }
    } catch (err: any) {
      toast.error('Failed to trigger order confirmation webhook');
    } finally {
      setSubmitting(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  if (loading) {
    return (
      <div className="page-loading">
        <div className="spinner" />
      </div>
    );
  }

  if (!course) {
    return (
      <div className="empty-state">
        <h3>Course not found</h3>
        <p>The course pathway requested could not be loaded.</p>
        <Link href="/student/courses" className="btn btn-primary mt-md">
          Back to Catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div className="course-detail-layout">
        {/* Main Content */}
        <div>
          <div className="course-detail-hero">
            {course.thumbnailUrl ? (
              <img
                src={course.thumbnailUrl}
                alt={course.title}
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 'var(--radius-xl)' }}
              />
            ) : (
              <i className="fa-solid fa-graduation-cap" />
            )}
          </div>

          <h1 className="course-detail-title">{course.title}</h1>
          <div className="course-detail-meta">
            <span>
              <i className="fa-solid fa-tags" /> {course.category || 'Robotics'}
            </span>
            <span>
              <i className="fa-solid fa-graduation-cap" /> {lessons.length} Lectures
            </span>
            <span>
              <i className="fa-solid fa-user-tie" /> By {course.createdBy?.name || 'RoboAIPaths Faculty'}
            </span>
          </div>

          <div className="course-detail-description">
            <h3>Description</h3>
            <p style={{ marginTop: 8, whiteSpace: 'pre-wrap', color: 'var(--text-secondary)' }}>
              {course.description || 'Dive into advanced training in robotics and artificial intelligence. Our pathways combine mathematical theory and simulated/hardware laboratory applications to accelerate professional growth.'}
            </p>
          </div>

          {hasAccess && (
            <div className="progress-section" style={{ marginTop: '2rem', background: 'var(--bg-input)', padding: '16px', borderRadius: 'var(--radius-lg)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Course Progress</span>
                <span style={{ fontWeight: 800, color: 'var(--tech-blue)', fontSize: '0.875rem' }}>{progressPercent}%</span>
              </div>
              <div style={{ width: '100%', height: '8px', background: 'var(--bg-card)', borderRadius: '4px', overflow: 'hidden' }}>
                <div style={{ width: `${progressPercent}%`, height: '100%', background: 'var(--tech-blue)', transition: 'width 0.5s ease' }} />
              </div>
            </div>
          )}

          {/* Curriculum */}
          <div className="curriculum-section">
            <h3>Syllabus Curriculum</h3>
            {lessons.length === 0 ? (
              <p className="text-muted">No lectures uploaded to this syllabus yet.</p>
            ) : (
              <div className="curriculum-list">
                {lessons.map((lesson) => (
                  <div key={lesson._id} className="curriculum-item" style={{ opacity: completedLessons.includes(lesson._id) ? 0.7 : 1 }}>
                    <i className={lesson.type === 'VIDEO' ? 'fa-solid fa-circle-play' : 'fa-solid fa-file-pdf'} style={{ color: completedLessons.includes(lesson._id) ? 'var(--success)' : 'inherit' }} />
                    <span style={{ textDecoration: completedLessons.includes(lesson._id) ? 'line-through' : 'none' }}>{lesson.title}</span>
                    <span className="duration badge badge-neutral" style={{ marginLeft: completedLessons.includes(lesson._id) ? '10px' : 'auto' }}>{lesson.type}</span>
                    {completedLessons.includes(lesson._id) && <i className="fa-solid fa-check-circle" style={{ color: 'var(--success)', marginLeft: 'auto' }} />}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Purchase Sidebar */}
        <div className="purchase-sidebar">
          {hasAccess ? (
            <div className="purchase-card">
              <div className="purchase-card-header">
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)' }}>
                  <i className="fa-solid fa-circle-check" /> Classroom Unlocked
                </div>
                <p className="text-muted mt-xs">You already own full access rights to this courses pathway.</p>
              </div>
              <div className="purchase-card-body">
                <Link href={`/student/courses/${course._id}/learn`} className="btn btn-primary" style={{ width: '100%' }}>
                  Go to Classroom <i className="fa-solid fa-circle-right" />
                </Link>
              </div>
            </div>
          ) : bundles.length === 0 ? (
            <div className="purchase-card">
              <div className="purchase-card-header">
                <h4>Pricing Unavailable</h4>
                <p className="text-muted mt-xs">No active purchase bundles listed for this course yet.</p>
              </div>
            </div>
          ) : (
            <div className="purchase-card">
              <div className="purchase-card-header">
                <div className="purchase-price">
                  {validatedCoupon
                    ? formatCurrency(validatedCoupon.finalAmount)
                    : selectedBundle
                    ? formatCurrency(selectedBundle.priceInr)
                    : '—'}
                  {validatedCoupon && (
                    <span className="original">
                      {selectedBundle ? formatCurrency(selectedBundle.priceInr) : ''}
                    </span>
                  )}
                </div>
                <p className="text-muted mt-xs">Unlock your custom robotics study bundle</p>
              </div>

              <div className="purchase-card-body">
                {/* Bundle Options Selector */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Select Study Bundle:
                  </div>
                  {bundles.map((bundle) => (
                    <div
                      key={bundle._id}
                      className={`bundle-option ${selectedBundle?._id === bundle._id ? 'selected' : ''}`}
                      onClick={() => {
                        setSelectedBundle(bundle);
                        setValidatedCoupon(null); // Clear coupon upon bundle change
                      }}
                    >
                      <div className="bundle-option-name">
                        {bundle.name}
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 400 }}>
                          {bundle.type.replace('_', ' ')}
                        </span>
                      </div>
                      <div className="bundle-option-price">{formatCurrency(bundle.priceInr)}</div>
                    </div>
                  ))}
                </div>

                {/* Coupon Code Row */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Apply Coupon Code:
                  </div>
                  <div className="coupon-row">
                    <input
                      type="text"
                      className="input"
                      placeholder="e.g. LAUNCH20"
                      value={couponCode}
                      onChange={(e) => setCouponCode(e.target.value)}
                      disabled={!!validatedCoupon}
                    />
                    {validatedCoupon ? (
                      <button
                        className="btn btn-secondary"
                        onClick={() => {
                          setValidatedCoupon(null);
                          setCouponCode('');
                        }}
                      >
                        Reset
                      </button>
                    ) : (
                      <button className="btn btn-outline" onClick={handleValidateCoupon}>
                        Apply
                      </button>
                    )}
                  </div>
                  {validatedCoupon && (
                    <span className="discount-badge" style={{ alignSelf: 'flex-start' }}>
                      Coupon Applied successfully! Saved {formatCurrency(validatedCoupon.discountAmount)}
                    </span>
                  )}
                </div>

                {/* Buy Button */}
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={handleInitiateOrder}
                  disabled={submitting}
                >
                  {submitting ? 'Initiating...' : 'Unlock Study Bundle Now'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated PayU Checkout Dialog */}
      {showPayUModal && payUParams && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-flat" style={{ width: 440, padding: 32, background: 'var(--bg-card)', zIndex: 1001, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-light)' }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                <i className="fa-solid fa-credit-card" /> Pay<span>U</span> Gateway
              </h2>
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                Sandbox payment gateway environment
              </p>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 'var(--radius-md)', fontSize: '0.875rem', marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">Transaction ID:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{payUParams.txnid}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">Customer Name:</span>
                <span style={{ fontWeight: 600 }}>{payUParams.firstname}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span className="text-muted">Bundle Product:</span>
                <span style={{ fontWeight: 600 }}>{payUParams.productinfo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: 8, marginTop: 8 }}>
                <span className="text-secondary" style={{ fontWeight: 700 }}>Total Payable:</span>
                <span style={{ fontWeight: 800, color: 'var(--tech-blue)', fontSize: '1.125rem' }}>
                  ₹{payUParams.amount}
                </span>
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button
                className="btn btn-primary"
                style={{ background: 'var(--success)' }}
                onClick={() => handleSimulatePayment('success')}
                disabled={submitting}
              >
                Simulate Successful Payment
              </button>
              <button
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => handleSimulatePayment('failed')}
                disabled={submitting}
              >
                Simulate Payment Mismatch/Failure
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowPayUModal(false)}
                disabled={submitting}
              >
                Cancel Transaction
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
