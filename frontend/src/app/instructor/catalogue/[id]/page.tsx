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

export default function InstructorCourseDetail({ params }: { params: Promise<{ id: string }> | any }) {
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

  // PayU Simulation Modal
  const [showPayUModal, setShowPayUModal] = useState(false);
  const [payUParams, setPayUParams] = useState<any>(null);

  useEffect(() => {
    fetchCourseDetails();
  }, [courseId]);

  const fetchCourseDetails = async () => {
    setLoading(true);
    try {
      // 1. Fetch Course and Lessons
      const { data: detailData } = await api.get(`/courses/${courseId}`);
      setCourse(detailData.course);
      setLessons(detailData.lessons || []);

      // 2. Fetch Bundles and enforce pricing rules for instructors
      // Instructors are only allowed to purchase PDF_ONLY or COMBO bundles. VIDEO_ONLY is forbidden.
      const { data: bundlesData } = await api.get(`/bundles/${courseId}`);
      const filteredInstructorBundles = (bundlesData.bundles || []).filter(
        (b: Bundle) => b.isActive && b.type !== 'VIDEO_ONLY'
      );
      setBundles(filteredInstructorBundles);
      if (filteredInstructorBundles.length > 0) {
        setSelectedBundle(filteredInstructorBundles[0]);
      }

      // 3. Fetch orders to check if instructor already purchased this course
      const { data: ordersData } = await api.get('/orders');
      const successfulOrders = (ordersData.orders || []).filter(
        (o: any) => o.status === 'SUCCESS' && o.bundleId?.courseId?._id === courseId
      );
      if (successfulOrders.length > 0) {
        setHasAccess(true);
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

  const handleSimulatePayment = async (status: 'success' | 'failed') => {
    if (!payUParams) return;
    setSubmitting(true);

    try {
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
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(amount);
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
        <p>The syllabus pathway requested could not be loaded.</p>
        <Link href="/instructor/catalogue" className="btn btn-primary mt-md">
          Back to Catalogue
        </Link>
      </div>
    );
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 32, alignItems: 'start' }}>
        {/* Course Main Details */}
        <div>
          <div className="course-hero" style={{ background: 'linear-gradient(135deg, var(--dark-navy) 0%, #1e293b 100%)' }}>
            <h1 className="course-hero-title" style={{ fontSize: '2rem', fontWeight: 800 }}>{course.title}</h1>
            <div className="course-hero-meta" style={{ display: 'flex', gap: 20, marginTop: 12, fontSize: '0.875rem', opacity: 0.85 }}>
              <span>
                <i className="fa-solid fa-tags" style={{ marginRight: 6 }} /> {course.category || 'Robotics Syllabus'}
              </span>
              <span>
                <i className="fa-solid fa-graduation-cap" style={{ marginRight: 6 }} /> {lessons.length} Syllabus Topics
              </span>
              <span>
                <i className="fa-solid fa-user-tie" style={{ marginRight: 6 }} /> By {course.createdBy?.name || 'RoboAIPaths Faculty'}
              </span>
            </div>
          </div>

          <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 32, border: '1px solid var(--border-light)', marginBottom: 32 }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 12 }}>Syllabus Blueprint & Objectives</h3>
            <p style={{ whiteSpace: 'pre-wrap', color: 'var(--text-secondary)', lineHeight: 1.7 }}>
              {course.description || 'Dive into advanced training in robotics and artificial intelligence. Our pathways combine mathematical theory and simulated/hardware laboratory applications to accelerate professional growth.'}
            </p>
          </div>

          {/* Curriculum */}
          <div style={{ background: 'var(--bg-card)', borderRadius: 24, padding: 32, border: '1px solid var(--border-light)' }}>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 20 }}>Syllabus Curriculum</h3>
            {lessons.length === 0 ? (
              <p style={{ color: 'var(--text-muted)' }}>No lectures uploaded to this syllabus yet.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                {lessons.map((lesson) => (
                  <div
                    key={lesson._id}
                    className="card-flat"
                    style={{
                      padding: '16px 24px',
                      border: '1px solid var(--border-default)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      borderRadius: 12,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <i className={lesson.type === 'VIDEO' ? 'fa-solid fa-circle-play' : 'fa-solid fa-file-pdf'} style={{ color: 'var(--tech-blue)' }} />
                      <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{lesson.title}</span>
                    </div>
                    <span className="badge" style={{ background: 'var(--bg-input)', color: 'var(--text-secondary)', fontSize: '0.6875rem' }}>
                      {lesson.type}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Pricing & Checkout Sidebar */}
        <div>
          {hasAccess ? (
            <div className="card-flat" style={{ padding: 32, border: '1px solid var(--border-light)', background: 'var(--bg-card)', borderRadius: 24 }}>
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success)', display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
                <i className="fa-solid fa-circle-check" /> Syllabus Unlocked
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 24 }}>
                You have been granted full teaching access to this pathway.
              </p>
              <Link href={`/instructor/library/${course._id}`} className="btn btn-primary" style={{ width: '100%', display: 'block', textAlign: 'center' }}>
                Open Player Library <i className="fa-solid fa-circle-right" style={{ marginLeft: 6 }} />
              </Link>
            </div>
          ) : bundles.length === 0 ? (
            <div className="card-flat" style={{ padding: 32, border: '1px solid var(--border-light)', background: 'var(--bg-card)', borderRadius: 24, textAlign: 'center' }}>
              <h4 style={{ fontWeight: 700 }}>Pricing Unlisted</h4>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 8 }}>
                No instructor-specific purchase bundles are currently configured for this pathway.
              </p>
            </div>
          ) : (
            <div className="card-flat" style={{ padding: 32, border: '1px solid var(--border-light)', background: 'var(--bg-card)', borderRadius: 24 }}>
              <div style={{ marginBottom: 24 }}>
                <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--tech-blue)' }}>
                  {validatedCoupon
                    ? formatCurrency(validatedCoupon.finalAmount)
                    : selectedBundle
                    ? formatCurrency(selectedBundle.priceInr)
                    : '—'}
                  {validatedCoupon && (
                    <span style={{ fontSize: '1rem', textDecoration: 'line-through', color: 'var(--text-muted)', marginLeft: 8, fontWeight: 400 }}>
                      {selectedBundle ? formatCurrency(selectedBundle.priceInr) : ''}
                    </span>
                  )}
                </div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 4 }}>
                  Unlock teaching guides and course pathways.
                </p>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                {/* Bundle list */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Select Instructor Bundle:
                  </div>
                  {bundles.map((bundle) => (
                    <div
                      key={bundle._id}
                      style={{
                        padding: 16,
                        borderRadius: 12,
                        border: '2px solid',
                        borderColor: selectedBundle?._id === bundle._id ? 'var(--tech-blue)' : 'var(--border-default)',
                        background: selectedBundle?._id === bundle._id ? 'var(--tech-blue-light)' : 'transparent',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        transition: 'var(--transition)',
                      }}
                      onClick={() => {
                        setSelectedBundle(bundle);
                        setValidatedCoupon(null);
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '0.875rem' }}>{bundle.name}</div>
                        <span style={{ display: 'block', fontSize: '0.6875rem', color: 'var(--text-muted)', textTransform: 'capitalize', marginTop: 2 }}>
                          {bundle.type.replace('_', ' ').toLowerCase()}
                        </span>
                      </div>
                      <div style={{ fontWeight: 800, color: selectedBundle?._id === bundle._id ? 'var(--tech-blue)' : 'var(--text-primary)' }}>
                        {formatCurrency(bundle.priceInr)}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Coupon validate */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    Coupon Code:
                  </div>
                  <div style={{ display: 'flex', gap: 8 }}>
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
                </div>

                {/* Checkout Trigger */}
                <button
                  className="btn btn-primary"
                  style={{ width: '100%', marginTop: 8 }}
                  onClick={handleInitiateOrder}
                  disabled={submitting}
                >
                  {submitting ? 'Initiating...' : 'Unlock Teaching Blueprint'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Simulated PayU Modal */}
      {showPayUModal && payUParams && (
        <div className="modal-overlay" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="card-flat" style={{ width: 440, padding: 32, background: 'var(--bg-card)', zIndex: 1001, boxShadow: 'var(--shadow-xl)', border: '1px solid var(--border-light)', borderRadius: 24 }}>
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <h2 style={{ fontSize: '1.5rem', fontWeight: 800, color: '#f59e0b' }}>
                <i className="fa-solid fa-credit-card" /> Pay<span>U</span> Sandbox
              </h2>
              <p className="text-muted" style={{ fontSize: '0.8125rem', marginTop: 4 }}>
                Simulating payments for account: {payUParams.firstname}
              </p>
            </div>

            <div style={{ background: 'var(--bg-input)', padding: 16, borderRadius: 12, fontSize: '0.875rem', marginBottom: 24, display: 'flex', flexDirection: 'column', gap: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Transaction Reference:</span>
                <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{payUParams.txnid}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span className="text-muted">Syllabus Title:</span>
                <span style={{ fontWeight: 600 }}>{payUParams.productinfo}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-default)', paddingTop: 8, marginTop: 8 }}>
                <span style={{ fontWeight: 700 }}>Total Chargeable:</span>
                <span style={{ fontWeight: 800, color: 'var(--tech-blue)' }}>
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
                Approve Payment Flow
              </button>
              <button
                className="btn btn-outline"
                style={{ color: 'var(--danger)', borderColor: 'var(--danger)' }}
                onClick={() => handleSimulatePayment('failed')}
                disabled={submitting}
              >
                Decline / Simulate Reject
              </button>
              <button
                className="btn btn-ghost"
                onClick={() => setShowPayUModal(false)}
                disabled={submitting}
              >
                Cancel Sandbox Checkout
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
