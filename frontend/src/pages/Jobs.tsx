import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getJobs } from '../api/jobs';
import { formatDistanceToNow } from 'date-fns';
import { 
  Box, 
  Plus, 
  Search, 
  CheckCircle2, 
  Clock, 
  AlertTriangle, 
  XCircle, 
  Layers, 
  ArrowRight, 
  Copy, 
  Check, 
  RefreshCw,
  FileCode2,
  Boxes,
  Eye,
  SlidersHorizontal,
  X
} from 'lucide-react';

export const Jobs: React.FC = () => {
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'processing' | 'failed'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const navigate = useNavigate();

  const fetchJobs = () => {
    setLoading(true);
    getJobs().then((data) => {
      setJobs(data.jobs || []);
      setLoading(false);
    }).catch((err) => {
      console.error(err);
      setLoading(false);
    });
  };

  useEffect(() => {
    fetchJobs();
  }, []);

  const handleRowClick = (job: any) => {
    if (job.status === 'processing') {
      navigate(`/jobs/${job.job_id}`);
    } else {
      navigate(`/jobs/${job.job_id}/view`);
    }
  };

  const copyJobId = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered jobs
  const filteredJobs = useMemo(() => {
    return jobs.filter((job) => {
      if (statusFilter !== 'all' && job.status !== statusFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const idMatch = job.job_id?.toLowerCase().includes(q);
        const fileMatch = job.files?.some((f: any) => f.filename?.toLowerCase().includes(q));
        const dimMatch = job.known_dimensions?.some((d: any) => d.label?.toLowerCase().includes(q) || String(d.value).includes(q));
        const unitMatch = job.units?.toLowerCase().includes(q);
        return idMatch || fileMatch || dimMatch || unitMatch;
      }
      return true;
    });
  }, [jobs, statusFilter, searchQuery]);

  // KPIs
  const stats = useMemo(() => {
    const total = jobs.length;
    const completed = jobs.filter(j => j.status === 'completed').length;
    const processing = jobs.filter(j => j.status === 'processing').length;
    const failed = jobs.filter(j => j.status === 'failed').length;
    return { total, completed, processing, failed };
  }, [jobs]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 500,
              backgroundColor: 'rgba(11,166,190,0.12)',
              color: '#087F95',
              border: '1px solid rgba(11,166,190,0.3)'
            }}
          >
            <CheckCircle2 size={12} style={{ color: '#0BA6BE', flexShrink: 0 }} />
            <span>Completed</span>
          </span>
        );
      case 'processing':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 500,
              backgroundColor: 'rgba(240,180,41,0.12)',
              color: '#D2960F',
              border: '1px solid rgba(240,180,41,0.3)'
            }}
          >
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#D2960F' }} className="animate-pulse" />
            <span>Processing</span>
          </span>
        );
      case 'needs_more_views':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 500,
              backgroundColor: 'rgba(240,180,41,0.12)',
              color: '#D2960F',
              border: '1px solid rgba(240,180,41,0.3)'
            }}
          >
            <AlertTriangle size={12} style={{ color: '#D2960F', flexShrink: 0 }} />
            <span>Needs Views</span>
          </span>
        );
      case 'failed':
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 500,
              backgroundColor: 'rgba(224,73,47,0.12)',
              color: '#E0492F',
              border: '1px solid rgba(224,73,47,0.3)'
            }}
          >
            <XCircle size={12} style={{ color: '#E0492F', flexShrink: 0 }} />
            <span>Failed</span>
          </span>
        );
      default:
        return (
          <span 
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 8px',
              borderRadius: '4px',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 500,
              backgroundColor: '#EDF3F5',
              color: '#53656E',
              border: '1px solid #D4E0E5'
            }}
          >
            <Clock size={12} style={{ flexShrink: 0 }} />
            <span className="capitalize">{status}</span>
          </span>
        );
    }
  };

  return (
    <div className="flex-1 max-w-[1240px] mx-auto w-full px-4 sm:px-6 md:px-8 py-8 md:py-10">
      
      {/* Top Header & New Job Action */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-8">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[var(--cyan-ghost)] border border-[rgba(44,192,212,0.25)] text-[11px] font-data text-[var(--cyan-400)] uppercase tracking-wider mb-2.5">
            <Layers size={13} />
            <span>CAD Workspace / Projects</span>
          </div>
          <h1 className="text-[32px] sm:text-[38px] font-bold text-[var(--g-100)] tracking-tight leading-tight">
            Reconstruction Jobs
          </h1>
          <p className="text-[14px] text-[var(--g-400)] mt-1.5 max-w-xl">
            Inspect generated 2D orthographic vector drawings, verify hole primitives, and download CNC-ready AutoCAD DXF and 3D STL deliverables.
          </p>
        </div>

        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={fetchJobs}
            title="Refresh library"
            style={{
              padding: '8px',
              borderRadius: '6px',
              border: '1px solid #D4E0E5',
              backgroundColor: '#FFFFFF',
              color: '#394B54',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
            className="hover:bg-[#EDF3F5] transition-colors"
          >
            <RefreshCw size={15} className={loading ? 'animate-spin' : ''} />
          </button>
          <button
            onClick={() => navigate('/')}
            className="btn btn-primary flex items-center gap-2 shadow-sm px-4 py-2 text-[13px] font-medium"
          >
            <Plus size={15} />
            <span>New Job</span>
          </button>
        </div>
      </div>

      {/* KPI Stats Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71838C', marginBottom: '6px' }}>Total Jobs</div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#172830', lineHeight: 1 }}>{stats.total}</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#087F95', marginBottom: '6px' }}>Completed CAD</div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#0BA6BE', lineHeight: 1 }}>{stats.completed}</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#D2960F', marginBottom: '6px' }}>Processing</div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#D2960F', lineHeight: 1 }}>{stats.processing}</div>
        </div>
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '16px 20px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
          <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#71838C', marginBottom: '6px' }}>Success Rate</div>
          <div style={{ fontSize: '28px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#394B54', lineHeight: 1 }}>
            {stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : '—'}
          </div>
        </div>
      </div>

      {/* Search & Filter Toolbar */}
      <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
        {/* Search input */}
        <div style={{ position: 'relative', flex: 1, minWidth: '240px', maxWidth: '420px' }}>
          <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#71838C', pointerEvents: 'none' }} />
          <input
            type="text"
            placeholder="Search by Job ID, part image, or dimension..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              paddingLeft: '36px',
              paddingRight: '32px',
              paddingTop: '7px',
              paddingBottom: '7px',
              borderRadius: '6px',
              border: '1px solid #D4E0E5',
              backgroundColor: '#F8FBFC',
              fontSize: '13px',
              color: '#172830',
              outline: 'none',
              boxSizing: 'border-box'
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#71838C' }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {/* Status Filter Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflowX: 'auto' }}>
          {[
            { key: 'all', label: 'All Jobs', count: stats.total },
            { key: 'completed', label: 'Completed', count: stats.completed },
            { key: 'processing', label: 'Active', count: stats.processing },
            { key: 'failed', label: 'Failed', count: stats.failed },
          ].map((tab) => {
            const active = statusFilter === tab.key;
            return (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key as any)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '6px 12px',
                  borderRadius: '5px',
                  fontSize: '12px',
                  fontWeight: active ? 600 : 500,
                  cursor: 'pointer',
                  border: active ? '1px solid rgba(44,192,212,0.35)' : '1px solid transparent',
                  backgroundColor: active ? 'rgba(44,192,212,0.12)' : 'transparent',
                  color: active ? '#087F95' : '#53656E',
                  transition: 'all 0.15s'
                }}
                className={!active ? 'hover:bg-[#EDF3F5] hover:text-[#172830]' : ''}
              >
                <span>{tab.label}</span>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  padding: '1px 6px',
                  borderRadius: '10px',
                  backgroundColor: active ? 'rgba(11,166,190,0.2)' : '#EDF3F5',
                  color: active ? '#087F95' : '#71838C'
                }}>
                  {tab.count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Main Jobs Table Container */}
      {loading ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '12px' }}>
          <div className="w-6 h-6 border-2 border-[var(--cyan-500)] border-t-transparent rounded-full animate-spin" />
          <span style={{ fontSize: '13px', color: '#53656E', fontFamily: 'var(--font-data)' }}>Loading CAD reconstructions...</span>
        </div>
      ) : filteredJobs.length === 0 ? (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', padding: '60px 20px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', backgroundColor: '#EDF3F5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#71838C', marginBottom: '14px' }}>
            <SlidersHorizontal size={22} />
          </div>
          <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#172830', marginBottom: '4px' }}>No matching reconstructions</h3>
          <p style={{ fontSize: '13px', color: '#53656E', maxWidth: '340px', marginBottom: '16px' }}>
            {searchQuery 
              ? `No jobs match "${searchQuery}". Try searching with a different term.`
              : 'There are no jobs in this category.'}
          </p>
          {searchQuery ? (
            <button
              onClick={() => { setSearchQuery(''); setStatusFilter('all'); }}
              className="btn btn-secondary btn-sm"
            >
              Reset Search
            </button>
          ) : (
            <button
              onClick={() => navigate('/')}
              className="btn btn-primary btn-sm flex items-center gap-1.5"
            >
              <Plus size={14} />
              <span>Create First Job</span>
            </button>
          )}
        </div>
      ) : (
        <div style={{ backgroundColor: '#FFFFFF', border: '1px solid #D4E0E5', borderRadius: '8px', overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead style={{ backgroundColor: '#F8FBFC', borderBottom: '1px solid #D4E0E5' }}>
                <tr style={{ fontSize: '11px', fontFamily: 'var(--font-data)', fontWeight: 600, color: '#53656E', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  <th style={{ padding: '12px 16px', width: '56px' }}>Part</th>
                  <th style={{ padding: '12px 16px', minWidth: '180px' }}>Job ID & Name</th>
                  <th style={{ padding: '12px 16px', width: '130px' }}>Status</th>
                  <th style={{ padding: '12px 16px', minWidth: '180px' }}>Known Reference</th>
                  <th style={{ padding: '12px 16px', width: '130px' }}>Deliverables</th>
                  <th style={{ padding: '12px 16px', width: '120px' }}>Created</th>
                  <th style={{ padding: '12px 16px', textAlign: 'right', width: '110px' }}>Action</th>
                </tr>
              </thead>
              <tbody style={{ fontSize: '13px' }}>
                {filteredJobs.map((job) => {
                  const primaryFile = job.files?.[0];
                  const primaryDim = job.known_dimensions?.[0];
                  const isCompleted = job.status === 'completed';

                  return (
                    <tr
                      key={job.job_id}
                      onClick={() => handleRowClick(job)}
                      style={{ borderBottom: '1px solid #EDF3F5', cursor: 'pointer', transition: 'background-color 0.15s' }}
                      className="hover:bg-[#F4F8FA] group"
                    >
                      {/* Fixed Thumbnail */}
                      <td style={{ padding: '10px 16px' }}>
                        <div 
                          style={{
                            width: '44px',
                            height: '44px',
                            minWidth: '44px',
                            minHeight: '44px',
                            borderRadius: '5px',
                            border: '1px solid #D4E0E5',
                            backgroundColor: '#EDF3F5',
                            overflow: 'hidden',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                        >
                          {job.thumbnail_url ? (
                            <img
                              src={job.thumbnail_url}
                              alt={primaryFile?.filename || 'Job preview'}
                              style={{ width: '44px', height: '44px', objectFit: 'cover', display: 'block' }}
                              loading="lazy"
                            />
                          ) : (
                            <Box size={18} style={{ color: '#71838C' }} />
                          )}
                        </div>
                      </td>

                      {/* Job ID & Source File */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                            <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600, fontSize: '13px', color: '#172830' }}>
                              #{job.job_id.substring(0, 8).toUpperCase()}
                            </span>
                            <button
                              onClick={(e) => copyJobId(e, job.job_id)}
                              title="Copy full Job ID"
                              style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', padding: 0, background: 'none', border: 'none', cursor: 'pointer', color: '#71838C' }}
                            >
                              {copiedId === job.job_id ? (
                                <Check size={12} style={{ color: '#0BA6BE' }} />
                              ) : (
                                <Copy size={12} />
                              )}
                            </button>
                          </div>
                          <span style={{ fontSize: '12px', color: '#71838C', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={primaryFile?.filename}>
                            {primaryFile?.filename || 'Uploaded Part'}
                          </span>
                        </div>
                      </td>

                      {/* Status Badge */}
                      <td style={{ padding: '10px 16px' }}>
                        {getStatusBadge(job.status)}
                      </td>

                      {/* Reference Dimension & Thickness */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          {primaryDim ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontFamily: 'var(--font-data)', fontSize: '13px' }}>
                              <span style={{ fontWeight: 600, color: '#172830' }}>
                                {primaryDim.value} {job.units}
                              </span>
                              <span style={{ fontSize: '11px', color: '#71838C' }}>
                                ({primaryDim.label})
                              </span>
                            </div>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#71838C', fontStyle: 'italic' }}>Uncalibrated</span>
                          )}
                          <span style={{ fontSize: '11px', color: '#53656E', fontFamily: 'var(--font-data)' }}>
                            Thickness: {job.thickness || 3.0} {job.units}
                          </span>
                        </div>
                      </td>

                      {/* Deliverables Badges */}
                      <td style={{ padding: '10px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          {isCompleted ? (
                            <>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-data)', fontWeight: 600, backgroundColor: 'rgba(11,166,190,0.12)', color: '#087F95', border: '1px solid rgba(11,166,190,0.25)' }} title="AutoCAD 2018 DXF Ready">
                                <FileCode2 size={11} />
                                <span>DXF</span>
                              </span>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 6px', borderRadius: '3px', fontSize: '10px', fontFamily: 'var(--font-data)', fontWeight: 600, backgroundColor: '#EDF3F5', color: '#394B54', border: '1px solid #D4E0E5' }} title="3D Watertight STL Solid Ready">
                                <Boxes size={11} />
                                <span>STL</span>
                              </span>
                            </>
                          ) : (
                            <span style={{ fontSize: '12px', color: '#71838C' }}>—</span>
                          )}
                        </div>
                      </td>

                      {/* Created Date */}
                      <td style={{ padding: '10px 16px', fontSize: '12px', color: '#53656E', fontFamily: 'var(--font-data)', whiteSpace: 'nowrap' }}>
                        {job.created_at ? (
                          formatDistanceToNow(new Date(job.created_at), { addSuffix: true })
                        ) : (
                          'Recently'
                        )}
                      </td>

                      {/* Action Button */}
                      <td style={{ padding: '10px 16px', textAlign: 'right' }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRowClick(job);
                          }}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            padding: '6px 12px',
                            borderRadius: '5px',
                            fontSize: '12px',
                            fontWeight: 500,
                            border: '1px solid #D4E0E5',
                            backgroundColor: '#F8FBFC',
                            color: '#172830',
                            cursor: 'pointer',
                            transition: 'all 0.15s'
                          }}
                          className="hover:border-[var(--cyan-500)] hover:text-[var(--cyan-500)] hover:bg-[#E2F2F5]"
                        >
                          <Eye size={12} />
                          <span>{job.status === 'processing' ? 'Track' : 'Open'}</span>
                          <ArrowRight size={11} />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Footer Count Bar */}
          <div style={{ padding: '10px 16px', backgroundColor: '#F8FBFC', borderTop: '1px solid #D4E0E5', display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '11px', fontFamily: 'var(--font-data)', color: '#53656E' }}>
            <span>Showing {filteredJobs.length} of {jobs.length} total projects</span>
            <span>Local file storage</span>
          </div>
        </div>
      )}
    </div>
  );
};
