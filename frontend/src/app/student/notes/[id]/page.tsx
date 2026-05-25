'use client';

import { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import api from '@/lib/api';
import toast from 'react-hot-toast';
import Link from 'next/link';

interface Note {
  _id: string;
  title: string;
  content?: string;
  mindmapJson?: any;
  updatedAt: string;
  courseId?: { _id: string; title: string };
  lessonId?: { _id: string; title: string };
}

// Simple Tree node interface for local state interactive mindmap
interface MindmapNode {
  name: string;
  children?: MindmapNode[];
}

export default function StudentNoteEditor() {
  const params = useParams();
  const router = useRouter();
  const noteId = params.id as string;

  const [note, setNote] = useState<Note | null>(null);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mindmap, setMindmap] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Tabs: 'editor' | 'mindmap'
  const [activeTab, setActiveTab] = useState<'editor' | 'mindmap'>('editor');

  // AI & Exporter states
  const [polishing, setPolishing] = useState(false);
  const [generatingMindmap, setGeneratingMindmap] = useState(false);
  const [exportingFormat, setExportingFormat] = useState<string | null>(null);

  // SVG Mindmap Interactive Zoom / Pan State
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (noteId) {
      fetchNote();
    }
  }, [noteId]);

  const fetchNote = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/notes/${noteId}`);
      if (data.note) {
        setNote(data.note);
        setTitle(data.note.title || 'Untitled Note');
        setContent(data.note.content || '');
        setMindmap(data.note.mindmapJson || null);
      }
    } catch (err: any) {
      toast.error('Failed to load study note');
      router.push('/student/notes');
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async (silent = false) => {
    if (!title.trim()) {
      toast.error('Title cannot be empty');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.put(`/notes/${noteId}`, {
        title: title.trim(),
        content: content,
        mindmapJson: mindmap
      });
      if (data.note) {
        setNote(data.note);
        if (!silent) {
          toast.success('Study note saved successfully!');
        }
      }
    } catch (err) {
      toast.error('Failed to save study note');
    } finally {
      setSaving(false);
    }
  };

  const handleAiPolish = async () => {
    if (!content.trim() || content === 'Start writing your polished study notes here...') {
      toast.error('Please write some content first before asking Claude AI to polish');
      return;
    }
    setPolishing(true);
    try {
      toast.loading('Claude AI is formatting and polishing your notes...', { id: 'polish' });
      const { data } = await api.post('/ai/polish-notes', {
        noteId,
        rawText: content
      });
      toast.dismiss('polish');
      if (data.polishedText) {
        setContent(data.polishedText);
        toast.success('Notes polished and formatted by Claude!');
        // Refresh note from DB
        const { data: updatedNoteRes } = await api.get(`/notes/${noteId}`);
        if (updatedNoteRes.note) {
          setNote(updatedNoteRes.note);
        }
      }
    } catch (err) {
      toast.dismiss('polish');
      toast.error('AI Polish request failed');
    } finally {
      setPolishing(false);
    }
  };

  const handleGenerateMindmap = async () => {
    setGeneratingMindmap(true);
    try {
      toast.loading('Creating interactive mindmap visualization...', { id: 'mindmap-gen' });
      const { data } = await api.post('/ai/mindmap', {
        noteId,
        topic: title
      });
      toast.dismiss('mindmap-gen');
      if (data.mindmap) {
        setMindmap(data.mindmap);
        toast.success('Interactive mindmap generated!');
        // Refresh note
        const { data: updatedNoteRes } = await api.get(`/notes/${noteId}`);
        if (updatedNoteRes.note) {
          setNote(updatedNoteRes.note);
        }
      }
    } catch (err) {
      toast.dismiss('mindmap-gen');
      toast.error('Failed to generate mindmap');
    } finally {
      setGeneratingMindmap(false);
    }
  };

  const handleExport = async (format: 'pdf' | 'markdown') => {
    setExportingFormat(format);
    try {
      toast.loading(`Preparing ${format.toUpperCase()} export...`, { id: 'export' });
      const token = localStorage.getItem('accessToken');
      
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api/v1'}/notes/${noteId}/export?format=${format}`,
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      );

      toast.dismiss('export');
      if (!response.ok) throw new Error('Export failed');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '_')}_note.${format === 'pdf' ? 'pdf' : 'md'}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Note exported as ${format.toUpperCase()}!`);
    } catch (err) {
      toast.dismiss('export');
      toast.error('Failed to export study note');
    } finally {
      setExportingFormat(null);
    }
  };

  // SVG Pan/Zoom Mouse Handlers
  const handleMouseDown = (e: React.MouseEvent<SVGSVGElement>) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    if (!isDragging) return;
    setPan({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  const handleZoom = (factor: number) => {
    setZoom(prev => Math.max(0.5, Math.min(2.5, prev * factor)));
  };

  const handleResetZoom = () => {
    setPan({ x: 0, y: 0 });
    setZoom(1);
    setCollapsedNodes(new Set());
  };

  const toggleNodeCollapse = (nodePathId: string) => {
    const next = new Set(collapsedNodes);
    if (next.has(nodePathId)) {
      next.delete(nodePathId);
    } else {
      next.add(nodePathId);
    }
    setCollapsedNodes(next);
  };

  // Layout calculations for custom horizontal center-out SVG Tree
  const renderMindmapTree = () => {
    if (!mindmap) return null;

    const canvasWidth = 900;
    const canvasHeight = 600;
    const centerX = canvasWidth / 2;
    const centerY = canvasHeight / 2;

    const nodes: Array<{
      id: string;
      label: string;
      x: number;
      y: number;
      level: number;
      isLeft: boolean;
      hasChildren: boolean;
      collapsed: boolean;
    }> = [];

    const links: Array<{
      id: string;
      x1: number;
      y1: number;
      x2: number;
      y2: number;
      level: number;
    }> = [];

    // Main root
    const rootName = mindmap.name || title || "Syllabus Root";
    nodes.push({
      id: 'root',
      label: rootName,
      x: centerX,
      y: centerY,
      level: 0,
      isLeft: false,
      hasChildren: !!mindmap.children?.length,
      collapsed: collapsedNodes.has('root')
    });

    const level1Children = mindmap.children || [];
    if (level1Children.length > 0 && !collapsedNodes.has('root')) {
      // Split level 1 children: left vs right for organic balance
      const rightSide: any[] = [];
      const leftSide: any[] = [];
      level1Children.forEach((child: any, idx: number) => {
        if (idx % 2 === 0) {
          rightSide.push(child);
        } else {
          leftSide.push(child);
        }
      });

      const drawSide = (childrenList: any[], sideXOffset: number, isLeft: boolean) => {
        const totalCount = childrenList.length;
        const totalHeight = 420;
        const stepY = totalCount > 1 ? totalHeight / (totalCount - 1) : 0;
        const startY = totalCount > 1 ? centerY - totalHeight / 2 : centerY;

        childrenList.forEach((child, childIdx) => {
          const childId = `c_${isLeft ? 'l' : 'r'}_${childIdx}`;
          const childX = centerX + sideXOffset;
          const childY = totalCount > 1 ? startY + childIdx * stepY : centerY;
          const childCollapsed = collapsedNodes.has(childId);
          const grandchildren = child.children || [];

          nodes.push({
            id: childId,
            label: child.name,
            x: childX,
            y: childY,
            level: 1,
            isLeft,
            hasChildren: !!grandchildren.length,
            collapsed: childCollapsed
          });

          links.push({
            id: `link_root_${childId}`,
            x1: centerX,
            y1: centerY,
            x2: childX,
            y2: childY,
            level: 1
          });

          // Process grandchildren if not collapsed
          if (grandchildren.length > 0 && !childCollapsed) {
            const gcCount = grandchildren.length;
            const gcHeight = Math.min(220, gcCount * 45);
            const gcStepY = gcCount > 1 ? gcHeight / (gcCount - 1) : 0;
            const gcStartY = gcCount > 1 ? childY - gcHeight / 2 : childY;

            grandchildren.forEach((gc: any, gcIdx: number) => {
              const gcId = `${childId}_gc_${gcIdx}`;
              const gcX = childX + (isLeft ? -180 : 180);
              const gcY = gcCount > 1 ? gcStartY + gcIdx * gcStepY : childY;

              nodes.push({
                id: gcId,
                label: gc.name,
                x: gcX,
                y: gcY,
                level: 2,
                isLeft,
                hasChildren: false,
                collapsed: false
              });

              links.push({
                id: `link_${childId}_${gcId}`,
                x1: childX,
                y1: childY,
                x2: gcX,
                y2: gcY,
                level: 2
              });
            });
          }
        });
      };

      drawSide(rightSide, 200, false);
      drawSide(leftSide, -200, true);
    }

    return (
      <svg
        width="100%"
        height="600"
        style={{ background: '#0b0f19', borderRadius: '16px', cursor: isDragging ? 'grabbing' : 'grab', overflow: 'hidden' }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Gradients */}
        <defs>
          <linearGradient id="rootGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#006eff" />
            <stop offset="100%" stopColor="#7c3aed" />
          </linearGradient>
          <linearGradient id="nodeL1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#1e293b" />
            <stop offset="100%" stopColor="#0f172a" />
          </linearGradient>
        </defs>

        {/* Outer Grid for Visual Depth */}
        <g transform={`translate(${pan.x}, ${pan.y}) scale(${zoom})`}>
          <pattern id="gridPattern" width="40" height="40" patternUnits="userSpaceOnUse">
            <path d="M 40 0 L 0 0 0 40" fill="none" stroke="rgba(255,255,255,0.02)" strokeWidth="1" />
          </pattern>
          <rect x="-2000" y="-2000" width="6000" height="6000" fill="url(#gridPattern)" />

          {/* Links (Drawn behind nodes) */}
          {links.map((link) => {
            // Cubic Bezier curve coordinate calculation for beautiful smooth links
            const cpX1 = link.x1 + (link.x2 > link.x1 ? 70 : -70);
            const cpY1 = link.y1;
            const cpX2 = link.x2 + (link.x2 > link.x1 ? -70 : 70);
            const cpY2 = link.y2;
            const d = `M ${link.x1} ${link.y1} C ${cpX1} ${cpY1}, ${cpX2} ${cpY2}, ${link.x2} ${link.y2}`;

            return (
              <path
                key={link.id}
                d={d}
                fill="none"
                stroke={link.level === 1 ? 'rgba(0, 110, 255, 0.4)' : 'rgba(124, 58, 237, 0.3)'}
                strokeWidth={link.level === 1 ? 3 : 2}
                strokeDasharray={link.level === 2 ? '4 3' : 'none'}
              />
            );
          })}

          {/* Nodes */}
          {nodes.map((node) => {
            const isRoot = node.level === 0;
            const isL1 = node.level === 1;
            const rectW = isRoot ? 180 : isL1 ? 150 : 130;
            const rectH = isRoot ? 54 : isL1 ? 46 : 38;

            return (
              <g
                key={node.id}
                transform={`translate(${node.x - rectW / 2}, ${node.y - rectH / 2})`}
                onClick={(e) => {
                  e.stopPropagation();
                  if (node.hasChildren) {
                    toggleNodeCollapse(node.id);
                  }
                }}
                style={{ cursor: node.hasChildren ? 'pointer' : 'default' }}
              >
                {/* Node Box */}
                <rect
                  width={rectW}
                  height={rectH}
                  rx={isRoot ? 16 : isL1 ? 12 : 8}
                  fill={isRoot ? 'url(#rootGrad)' : 'url(#nodeL1Grad)'}
                  stroke={
                    isRoot 
                      ? 'none' 
                      : isL1 
                        ? 'rgba(0, 110, 255, 0.5)' 
                        : 'rgba(255, 255, 255, 0.1)'
                  }
                  strokeWidth={2}
                  style={{
                    filter: isRoot ? 'drop-shadow(0px 8px 16px rgba(0, 110, 255, 0.3))' : 'none',
                    transition: 'var(--transition)'
                  }}
                />

                {/* Node Label Text */}
                <text
                  x={rectW / 2}
                  y={rectH / 2 + 4}
                  fill="#ffffff"
                  fontSize={isRoot ? 12 : isL1 ? 11 : 10}
                  fontWeight={isRoot ? 700 : isL1 ? 600 : 500}
                  textAnchor="middle"
                  style={{ userSelect: 'none', fontFamily: 'var(--font-family)' }}
                >
                  {node.label.length > 20 ? `${node.label.substring(0, 18)}...` : node.label}
                </text>

                {/* Collapse / Expand Indicators */}
                {node.hasChildren && (
                  <circle
                    cx={node.isLeft ? 8 : rectW - 8}
                    cy={rectH / 2}
                    r={6}
                    fill={node.collapsed ? '#10b981' : '#006eff'}
                    style={{ transition: 'var(--transition)' }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>
    );
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
      {/* Page Header */}
      <div className="note-editor-header mb-md">
        <div className="flex flex-col gap-xs" style={{ flex: 1 }}>
          <div className="breadcrumbs" style={{ fontSize: '0.8125rem', color: 'var(--text-muted)', display: 'flex', gap: 6 }}>
            <Link href="/student/notes" style={{ color: 'var(--tech-blue)' }}>Notes Workspace</Link>
            <span>/</span>
            <span>Edit Study Note</span>
          </div>
          <input
            type="text"
            className="input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Name your study note..."
            style={{ 
              fontSize: '1.5rem', 
              fontWeight: 800, 
              background: 'transparent', 
              border: 'none', 
              borderBottom: '2px solid transparent',
              borderRadius: 0,
              padding: '6px 0', 
              color: 'var(--text-primary)',
              outline: 'none',
              width: '100%',
              maxWidth: 600
            }}
          />
        </div>

        {/* Header Actions */}
        <div className="note-editor-actions">
          <button 
            className="btn btn-secondary" 
            onClick={() => handleSaveNote()} 
            disabled={saving}
            style={{ gap: 8, display: 'flex', alignItems: 'center' }}
          >
            <i className={saving ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-floppy-disk"} />
            {saving ? 'Saving...' : 'Save Note'}
          </button>
          
          <button 
            className="btn btn-secondary" 
            onClick={() => handleExport('pdf')}
            disabled={exportingFormat !== null}
            style={{ gap: 6, display: 'flex', alignItems: 'center' }}
          >
            <i className="fa-solid fa-file-pdf" style={{ color: 'var(--danger)' }} />
            PDF
          </button>

          <button 
            className="btn btn-secondary" 
            onClick={() => handleExport('markdown')}
            disabled={exportingFormat !== null}
            style={{ gap: 6, display: 'flex', alignItems: 'center' }}
          >
            <i className="fa-solid fa-file-lines" style={{ color: 'var(--tech-blue)' }} />
            Markdown
          </button>
        </div>
      </div>

      {/* Tabs Menu */}
      <div className="tabs mb-md" style={{ display: 'flex', gap: 16, borderBottom: '1px solid var(--border-light)' }}>
        <button 
          className={`tab-btn ${activeTab === 'editor' ? 'active' : ''}`}
          onClick={() => setActiveTab('editor')}
          style={{ 
            padding: '12px 16px', 
            fontWeight: 600, 
            fontSize: '0.9375rem',
            borderBottom: activeTab === 'editor' ? '2.5px solid var(--tech-blue)' : '2.5px solid transparent',
            color: activeTab === 'editor' ? 'var(--tech-blue)' : 'var(--text-secondary)',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-pen-nib" style={{ marginRight: 8 }} />
          Study Notes Editor
        </button>
        <button 
          className={`tab-btn ${activeTab === 'mindmap' ? 'active' : ''}`}
          onClick={() => {
            setActiveTab('mindmap');
            handleResetZoom();
          }}
          style={{ 
            padding: '12px 16px', 
            fontWeight: 600, 
            fontSize: '0.9375rem',
            borderBottom: activeTab === 'mindmap' ? '2.5px solid var(--tech-blue)' : '2.5px solid transparent',
            color: activeTab === 'mindmap' ? 'var(--tech-blue)' : 'var(--text-secondary)',
            background: 'none',
            borderTop: 'none',
            borderLeft: 'none',
            borderRight: 'none',
            cursor: 'pointer'
          }}
        >
          <i className="fa-solid fa-diagram-project" style={{ marginRight: 8 }} />
          Interactive AI Mindmap
        </button>
      </div>

      {/* Main Container */}
      <div className="card-flat" style={{ border: '1px solid var(--border-light)', overflow: 'hidden' }}>
        
        {/* 1. EDITOR TAB */}
        {activeTab === 'editor' && (
          <div className="note-editor-layout" style={{ display: 'grid', gridTemplateColumns: '1fr', padding: 24, gap: 24 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div className="flex justify-between items-center">
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                  LINKED COURSE: {note?.courseId?.title || 'Robotics Syllabus'} • {note?.lessonId?.title || 'Lecture Note'}
                </span>
                
                {/* AI Polish Button */}
                <button
                  className="btn"
                  onClick={handleAiPolish}
                  disabled={polishing}
                  style={{
                    background: 'linear-gradient(135deg, #7c3aed 0%, var(--tech-blue) 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: '8px',
                    boxShadow: '0 4px 12px rgba(124, 58, 237, 0.2)'
                  }}
                >
                  <i className={polishing ? "fa-solid fa-wand-magic-sparkles fa-spin" : "fa-solid fa-wand-magic-sparkles"} />
                  {polishing ? 'Claude Polishing...' : 'AI Polish with Claude'}
                </button>
              </div>

              <textarea
                className="note-editor-textarea"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Start writing or paste your notes here..."
                style={{ minHeight: 450, padding: 24, fontSize: '0.9375rem', width: '100%', borderRadius: 16 }}
              />
            </div>
          </div>
        )}

        {/* 2. MINDMAP TAB */}
        {activeTab === 'mindmap' && (
          <div style={{ padding: 24, position: 'relative' }}>
            <div className="flex justify-between items-center mb-md" style={{ flexWrap: 'wrap', gap: 12 }}>
              <div>
                <h3 style={{ fontSize: '1.125rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <i className="fa-solid fa-brain" style={{ color: 'var(--tech-blue)' }} /> Topic: {title}
                </h3>
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-muted)' }}>
                  Drag to pan. Zoom with buttons or mousewheel. Click nodes to expand/collapse.
                </p>
              </div>

              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-secondary btn-sm" onClick={() => handleZoom(1.2)}>
                  <i className="fa-solid fa-magnifying-glass-plus" />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={() => handleZoom(0.8)}>
                  <i className="fa-solid fa-magnifying-glass-minus" />
                </button>
                <button className="btn btn-secondary btn-sm" onClick={handleResetZoom}>
                  <i className="fa-solid fa-arrows-to-eye" /> Reset
                </button>
                
                <button
                  className="btn"
                  onClick={handleGenerateMindmap}
                  disabled={generatingMindmap}
                  style={{
                    background: 'linear-gradient(135deg, #006eff 0%, #7c3aed 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    fontSize: '0.8125rem',
                    padding: '8px 16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: '8px'
                  }}
                >
                  <i className={generatingMindmap ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-rotate"} />
                  {mindmap ? 'Regenerate AI Mindmap' : 'Generate AI Mindmap'}
                </button>
              </div>
            </div>

            {mindmap ? (
              <div style={{ border: '1px solid var(--border-light)', borderRadius: 16, overflow: 'hidden', position: 'relative' }}>
                {renderMindmapTree()}
              </div>
            ) : (
              <div className="empty-state card-flat" style={{ padding: 64, textAlign: 'center', background: '#090d16', color: '#fff', borderRadius: 16 }}>
                <div style={{ fontSize: '3rem', color: 'rgba(0,110,255,0.4)', marginBottom: 16 }}>
                  <i className="fa-solid fa-network-wired" />
                </div>
                <h3 style={{ marginBottom: 8, fontWeight: 700 }}>No Mindmap Generated Yet</h3>
                <p style={{ color: 'var(--text-muted)', maxWidth: 480, margin: '0 auto 24px' }}>
                  Let Claude AI analyze your note title and synthesize an interactive SVG mindmap breakdown.
                </p>
                <button
                  className="btn"
                  onClick={handleGenerateMindmap}
                  disabled={generatingMindmap}
                  style={{
                    background: 'linear-gradient(135deg, #006eff 0%, #7c3aed 100%)',
                    color: '#fff',
                    border: 'none',
                    fontWeight: 600,
                    padding: '12px 24px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 8,
                    borderRadius: '12px'
                  }}
                >
                  <i className={generatingMindmap ? "fa-solid fa-spinner fa-spin" : "fa-solid fa-wand-magic-sparkles"} />
                  {generatingMindmap ? 'Generating Visualization...' : '✨ Generate AI Mindmap'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
