'use client';

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import toast from 'react-hot-toast';

interface SummaryData {
  totalRevenue: number;
  totalOrders: number;
}

interface DailyRecord {
  _id: string; // YYYY-MM-DD
  revenue: number;
  count: number;
}

export default function AdminReportsPage() {
  const [summary, setSummary] = useState<SummaryData>({ totalRevenue: 0, totalOrders: 0 });
  const [dailyData, setDailyData] = useState<DailyRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [hoveredBar, setHoveredBar] = useState<DailyRecord | null>(null);

  useEffect(() => {
    fetchRevenueData();
  }, []);

  const fetchRevenueData = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/revenue');
      setSummary(data.summary || { totalRevenue: 0, totalOrders: 0 });
      setDailyData(data.daily || []);
    } catch (err: any) {
      toast.error('Failed to load revenue analytics');
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
    });
  };

  // Find max revenue for scaling chart bars
  const maxRevenue = dailyData.length > 0 ? Math.max(...dailyData.map((d) => d.revenue), 1000) : 1000;

  // Average Order Value
  const aov = summary.totalOrders > 0 ? summary.totalRevenue / summary.totalOrders : 0;

  return (
    <div>
      <div className="page-header flex items-center justify-between">
        <div>
          <h1>Financial Reports & Analytics</h1>
          <p>Track business health, analyze daily and monthly sales metrics, and export raw data</p>
        </div>
        <div className="flex gap-sm">
          <a
            href="http://localhost:4000/api/v1/admin/export/orders"
            className="btn btn-secondary"
            target="_blank"
            download
          >
            <i className="fa-solid fa-file-csv" /> Export Orders CSV
          </a>
          <a
            href="http://localhost:4000/api/v1/admin/export/users"
            className="btn btn-ghost"
            target="_blank"
            download
          >
            <i className="fa-solid fa-file-csv" /> Export Users CSV
          </a>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center" style={{ padding: '64px 0' }}>
          <div className="spinner spinner-lg" />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
          
          {/* Analytics Summary Grid */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-card-header">
                <div>
                  <div className="stat-card-value" style={{ color: 'var(--tech-blue)' }}>
                    {formatCurrency(summary.totalRevenue)}
                  </div>
                  <div className="stat-card-label">Gross Revenue</div>
                </div>
                <div className="stat-card-icon blue">
                  <i className="fa-solid fa-chart-line" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div>
                  <div className="stat-card-value">{summary.totalOrders}</div>
                  <div className="stat-card-label">Total Sales Volume</div>
                </div>
                <div className="stat-card-icon green">
                  <i className="fa-solid fa-bag-shopping" />
                </div>
              </div>
            </div>

            <div className="stat-card">
              <div className="stat-card-header">
                <div>
                  <div className="stat-card-value">{formatCurrency(aov)}</div>
                  <div className="stat-card-label">Average Order Value</div>
                </div>
                <div className="stat-card-icon orange">
                  <i className="fa-solid fa-calculator" />
                </div>
              </div>
            </div>
          </div>

          {/* Graphical Analytics Chart */}
          <div className="card-flat" style={{ padding: '28px' }}>
            <h4 style={{ marginBottom: '24px' }}>
              <i className="fa-solid fa-chart-bar" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
              Revenue Trends (Last 30 Days)
            </h4>

            {dailyData.length === 0 ? (
              <div
                style={{
                  height: '240px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'var(--text-muted)',
                  background: 'rgba(0, 0, 0, 0.02)',
                  borderRadius: '12px',
                  border: '1.5px dashed var(--border-default)',
                }}
              >
                No successful transactions logged in the past 30 days to build metrics.
              </div>
            ) : (
              <div>
                {/* Custom Responsive SVG & CSS Graph Grid */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'flex-end',
                    height: '260px',
                    gap: '8px',
                    paddingBottom: '16px',
                    borderBottom: '2px solid var(--border-default)',
                    position: 'relative',
                  }}
                >
                  {/* Tooltip Overlay */}
                  {hoveredBar && (
                    <div
                      style={{
                        position: 'absolute',
                        top: '10px',
                        left: '50%',
                        transform: 'translateX(-50%)',
                        background: 'var(--dark-navy)',
                        color: '#fff',
                        padding: '8px 16px',
                        borderRadius: '8px',
                        fontSize: '0.8125rem',
                        boxShadow: 'var(--shadow-xl)',
                        zIndex: 10,
                        border: '1px solid rgba(255, 255, 255, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        gap: '2px',
                      }}
                    >
                      <div style={{ fontWeight: 600, color: 'var(--tech-blue)' }}>
                        {formatCurrency(hoveredBar.revenue)}
                      </div>
                      <div style={{ fontSize: '0.6875rem', opacity: 0.8 }}>
                        {hoveredBar.count} orders on {formatDate(hoveredBar._id)}
                      </div>
                    </div>
                  )}

                  {/* Graph Columns */}
                  {dailyData.map((day) => {
                    const heightPercent = (day.revenue / maxRevenue) * 100;
                    return (
                      <div
                        key={day._id}
                        style={{
                          flex: 1,
                          height: `${Math.max(heightPercent, 4)}%`,
                          background:
                            hoveredBar?._id === day._id
                              ? 'linear-gradient(180deg, #7c3aed 0%, var(--tech-blue) 100%)'
                              : 'linear-gradient(180deg, var(--tech-blue) 0%, rgba(0, 110, 255, 0.4) 100%)',
                          borderRadius: '4px 4px 0 0',
                          cursor: 'pointer',
                          transition: 'var(--transition-fast)',
                          boxShadow: hoveredBar?._id === day._id ? '0px 0px 12px var(--tech-blue-glow)' : 'none',
                        }}
                        onMouseEnter={() => setHoveredBar(day)}
                        onMouseLeave={() => setHoveredBar(null)}
                      />
                    );
                  })}
                </div>

                {/* Graph Axis Dates labels */}
                <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 4px 0 4px', fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  <span>{formatDate(dailyData[0]._id)}</span>
                  <span>{formatDate(dailyData[Math.floor(dailyData.length / 2)]._id)}</span>
                  <span>{formatDate(dailyData[dailyData.length - 1]._id)}</span>
                </div>
              </div>
            )}
          </div>

          {/* Daily Table Metrics */}
          <div className="card-flat" style={{ padding: '24px' }}>
            <h4 style={{ marginBottom: '16px' }}>
              <i className="fa-solid fa-table" style={{ marginRight: '8px', color: 'var(--tech-blue)' }} />
              Daily Summary Metrics
            </h4>

            {dailyData.length === 0 ? (
              <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>No transaction history to display.</p>
            ) : (
              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Gross Revenue</th>
                      <th>Sales Count</th>
                      <th>Average Transaction Value</th>
                    </tr>
                  </thead>
                  <tbody>
                    {dailyData.map((day) => (
                      <tr key={day._id}>
                        <td style={{ fontWeight: 600 }}>
                          {new Date(day._id).toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}
                        </td>
                        <td style={{ fontWeight: 600, color: 'var(--success)' }}>
                          {formatCurrency(day.revenue)}
                        </td>
                        <td style={{ fontWeight: 500 }}>{day.count} orders</td>
                        <td className="text-muted">
                          {formatCurrency(day.revenue / (day.count || 1))}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
