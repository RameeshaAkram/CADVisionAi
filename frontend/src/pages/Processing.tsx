import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { addPhotos, getJobStatus, startProcessing, type JobStatusResponse } from '../api/jobs';
import { Button } from '../components/ui/Button';
import {
  CheckCircle2,
  Loader2,
  AlertCircle,
  Circle,
  RotateCw,
  Crosshair,
  Layers,
  Cpu,
  UploadCloud,
  ArrowRight,
  ShieldAlert,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Layers3,
  Copy,
  Check
} from 'lucide-react';

interface PipelineStageDef {
  id: string;
  name: string;
  desc: string;
}

const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: 'prepare_images', name: 'Image Normalization', desc: 'Color space equalization & pixel orientation alignment' },
  { id: 'view_analysis', name: 'Quality & Contrast Analysis', desc: 'Sharpness Laplacian score & background contrast verification' },
  { id: 'object_detection', name: 'Boundary Localization', desc: 'Adaptive Otsu thresholding & component bounding box isolation' },
  { id: 'feature_detection', name: 'Contour & Hole Extraction', desc: 'External perimeter tracing & topological hole hierarchy' },
  { id: 'scale_calibration', name: 'Scale Calibration', desc: 'Reference dimension ratio & sub-pixel metric calibration' },
  { id: 'drawing_generation', name: '2D Vector CAD Generation', desc: 'Orthographic projection & closed polyline vectorization' },
  { id: 'validation', name: 'Geometry Verification & Export', desc: 'Watertightness audit, DXF R2000+ CAM & STL mesh generation' },
];

export default function Processing() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const { data: status, error, refetch } = useQuery<JobStatusResponse>({
    queryKey: ['jobStatus', jobId],
    queryFn: () => getJobStatus(jobId!),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (state && (state.status === 'completed' || state.status === 'failed' || state.status === 'needs_more_views')) {
        return false;
      }
      return 600;
    },
    enabled: !!jobId,
  });

  const retryMutation = useMutation({
    mutationFn: () => startProcessing(jobId!),
    onSuccess: () => refetch(),
  });

  useEffect(() => {
    if (status?.status === 'completed') {
      const t = setTimeout(() => {
        navigate(`/jobs/${jobId}/view`);
      }, 1200);
      return () => clearTimeout(t);
    }
  }, [status?.status, jobId, navigate]);

  const copyJobId = () => {
    if (!jobId) return;
    navigator.clipboard.writeText(jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const stagesState = useMemo(() => {
    if (!status) return {};
    const map: Record<string, { status: 'pending' | 'running' | 'completed' | 'failed'; detail?: string }> = {};

    if (status.stages && Array.isArray(status.stages)) {
      for (const s of status.stages) {
        map[s.name] = {
          status: s.status as any,
          detail: s.detail
        };
      }
    }

    const currentIdx = PIPELINE_STAGES.findIndex(s => s.id === status.current_stage);

    if (status.status === 'completed') {
      PIPELINE_STAGES.forEach(s => {
        map[s.id] = { status: 'completed' };
      });
    } else if (status.status === 'failed') {
      PIPELINE_STAGES.forEach((s, idx) => {
        if (currentIdx !== -1) {
          if (idx < currentIdx) map[s.id] = map[s.id] || { status: 'completed' };
          else if (idx === currentIdx) map[s.id] = { status: 'failed', detail: status.error || undefined };
          else map[s.id] = map[s.id] || { status: 'pending' };
        }
      });
    } else if (status.status === 'processing') {
      PIPELINE_STAGES.forEach((s, idx) => {
        if (currentIdx !== -1) {
          if (idx < currentIdx) {
            map[s.id] = map[s.id] || { status: 'completed' };
          } else if (idx === currentIdx) {
            map[s.id] = { status: 'running', detail: map[s.id]?.detail };
          } else {
            map[s.id] = map[s.id] || { status: 'pending' };
          }
        }
      });
    }

    return map;
  }, [status]);

  const progressPercentage = useMemo(() => {
    if (!status) return 0;
    if (status.status === 'completed') return 100;
    const completedCount = PIPELINE_STAGES.filter(s => stagesState[s.id]?.status === 'completed').length;
    const hasRunning = PIPELINE_STAGES.some(s => stagesState[s.id]?.status === 'running');
    const computed = Math.round((completedCount / PIPELINE_STAGES.length) * 100) + (hasRunning ? 6 : 0);
    return Math.min(Math.max(computed, status.progress || 5), 98);
  }, [status, stagesState]);

  if (error) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '40px 20px', width: '100%' }}>
        <div style={{
          padding: '24px',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(244,112,94,0.4)',
          borderLeft: '4px solid #F4705E',
          display: 'flex',
          alignItems: 'start',
          gap: '16px',
          boxShadow: '0 4px 16px rgba(23,40,48,0.06)'
        }}>
          <AlertCircle size={24} style={{ color: '#F4705E', flexShrink: 0, marginTop: '2px' }} />
          <div style={{ flex: 1 }}>
            <h2 style={{ fontSize: '18px', fontWeight: 600, color: '#F4705E', margin: '0 0 6px 0' }}>
              Error Loading Job Status
            </h2>
            <p style={{ fontSize: '13px', fontFamily: 'var(--font-data)', color: '#53656E', margin: '0 0 16px 0' }}>
              {(error as Error).message}
            </p>
            <div style={{ display: 'flex', gap: '12px' }}>
              <Button variant="secondary" onClick={() => refetch()}>
                <RotateCw size={14} className="mr-2" /> Retry Connection
              </Button>
              <Button variant="ghost" onClick={() => navigate('/')}>
                Back to New Job
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '60px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '400px' }}>
        <Loader2 size={32} style={{ color: '#0BA6BE', marginBottom: '16px' }} className="animate-spin" />
        <p style={{ fontSize: '14px', fontFamily: 'var(--font-data)', color: '#53656E' }}>
          Initializing CAD pipeline connection...
        </p>
      </div>
    );
  }

  const isFailed = status.status === 'failed';
  const isNeedsMoreViews = status.status === 'needs_more_views';
  const isCompleted = status.status === 'completed';

  const completedCount = PIPELINE_STAGES.filter(s => stagesState[s.id]?.status === 'completed').length;
  const activeStage = PIPELINE_STAGES.find(s => stagesState[s.id]?.status === 'running') ||
    (isCompleted ? PIPELINE_STAGES[PIPELINE_STAGES.length - 1] : PIPELINE_STAGES[0]);

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>

      {/* Header bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        paddingBottom: '24px',
        borderBottom: '1px solid #D4E0E5',
        marginBottom: '24px'
      }}>
        <div>
          {/* Eyebrow Breadcrumb */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#087F95',
              display: 'flex',
              alignItems: 'center',
              gap: '6px'
            }}>
              <Sparkles size={12} style={{ color: '#0BA6BE' }} />
              CAD ENGINE PIPELINE
            </span>
            <span style={{ color: '#B8C9D0', fontSize: '12px' }}>/</span>
            <div style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '4px',
              backgroundColor: '#F8FBFC',
              border: '1px solid #D4E0E5',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              color: '#172830'
            }}>
              <span style={{ fontWeight: 600 }}>#{jobId?.substring(0, 8).toUpperCase()}</span>
              <button
                type="button"
                onClick={copyJobId}
                title="Copy Job ID"
                style={{
                  background: 'none',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: copiedId ? '#0BA6BE' : '#71838C'
                }}
              >
                {copiedId ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          </div>

          <h1 style={{
            fontSize: '28px',
            fontWeight: 700,
            letterSpacing: '-0.02em',
            color: '#172830',
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            flexWrap: 'wrap'
          }}>
            {isCompleted ? 'Reconstruction Complete' : isFailed ? 'Reconstruction Interrupted' : 'Processing CAD Geometry'}
            {isCompleted && (
              <span style={{
                fontSize: '11px',
                fontFamily: 'var(--font-data)',
                fontWeight: 600,
                padding: '3px 10px',
                borderRadius: '999px',
                backgroundColor: 'rgba(11,166,190,0.12)',
                color: '#087F95',
                border: '1px solid rgba(11,166,190,0.3)'
              }}>
                READY FOR WORKSPACE
              </span>
            )}
          </h1>
        </div>

        {/* Status Pill & Action */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '6px 14px',
            borderRadius: '999px',
            fontSize: '12px',
            fontFamily: 'var(--font-data)',
            fontWeight: 600,
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            backgroundColor: isCompleted ? 'rgba(11,166,190,0.12)' : isFailed ? 'rgba(224,73,47,0.12)' : isNeedsMoreViews ? 'rgba(240,180,41,0.12)' : 'rgba(11,166,190,0.1)',
            color: isCompleted ? '#087F95' : isFailed ? '#E0492F' : isNeedsMoreViews ? '#D2960F' : '#087F95',
            border: `1px solid ${isCompleted ? 'rgba(11,166,190,0.3)' : isFailed ? 'rgba(224,73,47,0.3)' : isNeedsMoreViews ? 'rgba(240,180,41,0.3)' : 'rgba(11,166,190,0.3)'}`
          }}>
            {!isCompleted && !isFailed && !isNeedsMoreViews && (
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#0BA6BE' }} className="animate-ping" />
            )}
            {isCompleted && <CheckCircle2 size={15} style={{ color: '#0BA6BE' }} />}
            {isFailed && <AlertCircle size={15} style={{ color: '#E0492F' }} />}
            {isNeedsMoreViews && <ShieldAlert size={15} style={{ color: '#D2960F' }} />}
            <span>{status.status.replace(/_/g, ' ')}</span>
          </div>

          {isCompleted && (
            <button
              type="button"
              onClick={() => navigate(`/jobs/${jobId}/view`)}
              style={{
                height: '36px',
                padding: '0 16px',
                borderRadius: '4px',
                backgroundColor: '#0BA6BE',
                color: '#FFFFFF',
                fontSize: '13px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                border: 'none',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(11,166,190,0.3)'
              }}
            >
              <span>Open Workspace</span>
              <ArrowRight size={14} />
            </button>
          )}
        </div>
      </div>

      {/* High-Precision Progress Bar */}
      <div style={{
        padding: '16px 20px',
        borderRadius: '8px',
        backgroundColor: '#FFFFFF',
        border: '1px solid #D4E0E5',
        boxShadow: '0 2px 8px rgba(23,40,48,0.03)',
        marginBottom: '24px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '12px', fontFamily: 'var(--font-data)', color: '#53656E', marginBottom: '8px' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Cpu size={15} style={{ color: '#0BA6BE' }} />
            <span>Active Stage: <strong style={{ color: '#172830', fontWeight: 600 }}>{activeStage.name}</strong></span>
          </span>
          <span style={{ fontWeight: 700, color: '#087F95', fontSize: '14px' }}>
            {progressPercentage}%
          </span>
        </div>

        <div style={{
          width: '100%',
          height: '8px',
          backgroundColor: '#EDF3F5',
          border: '1px solid #D4E0E5',
          borderRadius: '999px',
          overflow: 'hidden',
          position: 'relative'
        }}>
          <div
            style={{
              height: '100%',
              width: `${progressPercentage}%`,
              background: 'linear-gradient(90deg, #087F95 0%, #0BA6BE 100%)',
              transition: 'width 0.3s ease-out',
              position: 'relative'
            }}
          >
            {!isCompleted && !isFailed && (
              <div
                style={{
                  position: 'absolute',
                  top: 0,
                  bottom: 0,
                  right: 0,
                  width: '24px',
                  backgroundColor: 'rgba(255,255,255,0.4)'
                }}
                className="animate-pulse"
              />
            )}
          </div>
        </div>
      </div>

      {/* Needs More Views Notification */}
      {isNeedsMoreViews && (
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(240,180,41,0.4)',
          borderLeft: '4px solid #D2960F',
          boxShadow: '0 4px 16px rgba(240,180,41,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(240,180,41,0.15)',
              color: '#D2960F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <ShieldAlert size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#172830', margin: '0 0 6px 0' }}>
                Additional Views Required for Complete Coverage
              </h3>
              <p style={{ fontSize: '13px', color: '#394B54', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                {status.coverage_gaps?.[0] || 'The geometric confidence gate detected unobserved surfaces. Please supply additional photos of the part from alternate angles to calibrate outer contours.'}
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => {
                    const fileInput = document.createElement('input');
                    fileInput.type = 'file';
                    fileInput.multiple = true;
                    fileInput.accept = 'image/jpeg,image/png,image/webp';
                    fileInput.onchange = async (e: any) => {
                      const files = e.target.files;
                      if (!files || files.length === 0) return;
                      const validFiles = Array.from(files).filter((f: any) =>
                        f.type === 'image/jpeg' || f.type === 'image/png' || f.type === 'image/webp'
                      ) as File[];
                      if (validFiles.length > 0) {
                        try {
                          await addPhotos(jobId!, validFiles);
                          retryMutation.mutate();
                        } catch (err) {
                          console.error(err);
                        }
                      }
                    };
                    fileInput.click();
                  }}
                  isLoading={retryMutation.isPending}
                >
                  <UploadCloud size={14} className="mr-2" /> Upload Extra Angles
                </Button>
                <Button variant="secondary" size="sm" onClick={() => retryMutation.mutate()}>
                  Re-evaluate Current Views
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Failed Notification */}
      {isFailed && (
        <div style={{
          marginBottom: '24px',
          padding: '20px',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          border: '1px solid rgba(224,73,47,0.4)',
          borderLeft: '4px solid #E0492F',
          boxShadow: '0 4px 16px rgba(224,73,47,0.08)'
        }}>
          <div style={{ display: 'flex', alignItems: 'start', gap: '16px' }}>
            <div style={{
              width: '36px',
              height: '36px',
              borderRadius: '50%',
              backgroundColor: 'rgba(224,73,47,0.15)',
              color: '#E0492F',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}>
              <AlertCircle size={20} />
            </div>
            <div style={{ flex: 1 }}>
              <h3 style={{ fontSize: '16px', fontWeight: 600, color: '#E0492F', margin: '0 0 6px 0' }}>
                Processing Halted
              </h3>
              <p style={{ fontSize: '13px', fontFamily: 'var(--font-data)', color: '#394B54', margin: '0 0 16px 0' }}>
                {status.error || 'The CAD pipeline encountered an unexpected validation anomaly.'}
              </p>

              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  isLoading={retryMutation.isPending}
                >
                  <RotateCw size={14} className="mr-2" /> Retry Processing
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}>
                  {showTechnicalDetails ? <ChevronUp size={14} className="mr-1" /> : <ChevronDown size={14} className="mr-1" />}
                  {showTechnicalDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
                </Button>
              </div>

              {showTechnicalDetails && (
                <div style={{
                  marginTop: '12px',
                  padding: '12px',
                  backgroundColor: '#F8FBFC',
                  border: '1px solid #D4E0E5',
                  borderRadius: '4px',
                  fontSize: '12px',
                  fontFamily: 'var(--font-data)',
                  color: '#53656E'
                }}>
                  <div style={{ color: '#172830', fontWeight: 600, marginBottom: '4px' }}>Diagnostic Context:</div>
                  <div>Job ID: {jobId}</div>
                  <div>Current Stage: {status.current_stage || 'Unknown'}</div>
                  <div>Normalized Count: {status.normalized_count}</div>
                  <div>Error Detail: {status.error}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Main Grid: Pipeline Stages (Left) + Real-time Telemetry & Architecture HUD (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.45fr) minmax(340px, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* Left Column: 7 Real Backend Pipeline Stages Checklist */}
        <div style={{
          padding: '24px',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D4E0E5',
          boxShadow: '0 2px 10px rgba(23,40,48,0.04)'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingBottom: '16px',
            borderBottom: '1px solid #D4E0E5',
            marginBottom: '16px'
          }}>
            <h2 style={{
              fontSize: '13px',
              fontFamily: 'var(--font-data)',
              fontWeight: 700,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#394B54',
              margin: 0
            }}>
              Pipeline Stages Execution
            </h2>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              padding: '3px 8px',
              borderRadius: '4px',
              backgroundColor: '#EDF3F5',
              color: '#087F95',
              fontWeight: 600,
              border: '1px solid #D4E0E5'
            }}>
              {completedCount} / {PIPELINE_STAGES.length} Completed
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {PIPELINE_STAGES.map((stage) => {
              const state = stagesState[stage.id]?.status || 'pending';
              const detail = stagesState[stage.id]?.detail;
              const isRunning = state === 'running';
              const isStageDone = state === 'completed';
              const isStageFailed = state === 'failed';

              return (
                <div
                  key={stage.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px',
                    padding: '12px 14px',
                    borderRadius: '6px',
                    border: isRunning
                      ? '1px solid rgba(11,166,190,0.45)'
                      : isStageDone
                      ? '1px solid #D4E0E5'
                      : isStageFailed
                      ? '1px solid rgba(224,73,47,0.45)'
                      : '1px solid #E8EEF1',
                    backgroundColor: isRunning
                      ? 'rgba(11,166,190,0.06)'
                      : isStageDone
                      ? '#FFFFFF'
                      : isStageFailed
                      ? 'rgba(224,73,47,0.06)'
                      : '#FAFCFD',
                    boxShadow: isRunning ? '0 2px 8px rgba(11,166,190,0.1)' : 'none',
                    transition: 'all 0.2s ease',
                    opacity: isRunning || isStageDone || isStageFailed ? 1 : 0.65
                  }}
                >
                  {/* Status Icon */}
                  <div style={{ marginTop: '2px', flexShrink: 0 }}>
                    {isStageDone ? (
                      <CheckCircle2 size={18} style={{ color: '#0BA6BE' }} />
                    ) : isRunning ? (
                      <Loader2 size={18} style={{ color: '#0BA6BE' }} className="animate-spin" />
                    ) : isStageFailed ? (
                      <AlertCircle size={18} style={{ color: '#E0492F' }} />
                    ) : (
                      <Circle size={18} style={{ color: '#B8C9D0' }} />
                    )}
                  </div>

                  {/* Stage Info */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
                      <span style={{
                        fontSize: '13px',
                        fontWeight: isRunning || isStageDone ? 600 : 500,
                        color: isRunning ? '#087F95' : isStageDone ? '#172830' : isStageFailed ? '#E0492F' : '#71838C'
                      }}>
                        {stage.name}
                      </span>
                      <span style={{
                        fontSize: '10px',
                        fontFamily: 'var(--font-data)',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontWeight: 600,
                        letterSpacing: '0.04em',
                        backgroundColor: isRunning ? 'rgba(11,166,190,0.12)' : isStageDone ? '#EDF3F5' : isStageFailed ? 'rgba(224,73,47,0.12)' : '#F4F8FA',
                        color: isRunning ? '#087F95' : isStageDone ? '#394B54' : isStageFailed ? '#E0492F' : '#71838C',
                        border: isRunning ? '1px solid rgba(11,166,190,0.25)' : '1px solid #D4E0E5'
                      }}>
                        {isRunning ? 'RUNNING' : isStageDone ? 'PASS' : isStageFailed ? 'FAILED' : 'WAITING'}
                      </span>
                    </div>
                    <p style={{ fontSize: '11px', color: '#53656E', margin: '3px 0 0 0', lineHeight: 1.4 }}>
                      {stage.desc}
                    </p>
                    {detail && (
                      <div style={{
                        marginTop: '4px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-data)',
                        color: '#087F95',
                        backgroundColor: '#F8FBFC',
                        padding: '2px 6px',
                        borderRadius: '3px',
                        border: '1px solid #D4E0E5',
                        display: 'inline-block'
                      }}>
                        {detail}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Column: Visual Radar / Crosshair Scanner & Telemetry HUD */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

          <div style={{
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #D4E0E5',
            boxShadow: '0 2px 10px rgba(23,40,48,0.04)',
            overflow: 'hidden'
          }}>
            <div style={{
              padding: '12px 16px',
              backgroundColor: '#F8FBFC',
              borderBottom: '1px solid #D4E0E5',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}>
              <div style={{
                fontSize: '12px',
                fontFamily: 'var(--font-data)',
                fontWeight: 600,
                color: '#394B54',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}>
                <Crosshair size={14} style={{ color: '#0BA6BE' }} />
                <span>Feature Telemetry</span>
              </div>
              <span style={{
                fontSize: '10px',
                fontFamily: 'var(--font-data)',
                padding: '2px 6px',
                borderRadius: '3px',
                backgroundColor: 'rgba(11,166,190,0.1)',
                color: '#087F95',
                border: '1px solid rgba(11,166,190,0.25)'
              }}>
                LIVE HUD
              </span>
            </div>

            {/* Radar Viewport with Crosshairs */}
            <div style={{
              position: 'relative',
              height: '210px',
              backgroundColor: '#0E161A',
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              {/* Technical CAD Grid Pattern */}
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  opacity: 0.18,
                  pointerEvents: 'none',
                  backgroundImage: `
                    linear-gradient(to right, #0BA6BE 1px, transparent 1px),
                    linear-gradient(to bottom, #0BA6BE 1px, transparent 1px)
                  `,
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Concentric Radar Rings */}
              <div style={{ position: 'absolute', width: '170px', height: '170px', borderRadius: '50%', border: '1px solid rgba(11,166,190,0.2)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '110px', height: '110px', borderRadius: '50%', border: '1px solid rgba(11,166,190,0.3)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', width: '50px', height: '50px', borderRadius: '50%', border: '1px solid rgba(11,166,190,0.45)', pointerEvents: 'none' }} />

              {/* Center Crosshairs */}
              <div style={{ position: 'absolute', width: '100%', height: '1px', backgroundColor: 'rgba(11,166,190,0.2)', pointerEvents: 'none' }} />
              <div style={{ position: 'absolute', height: '100%', width: '1px', backgroundColor: 'rgba(11,166,190,0.2)', pointerEvents: 'none' }} />

              {/* Rotating Radar Sweep Line */}
              {!isCompleted && !isFailed && (
                <div
                  style={{
                    position: 'absolute',
                    width: '170px',
                    height: '170px',
                    borderRadius: '50%',
                    pointerEvents: 'none',
                    background: 'conic-gradient(from 0deg at 50% 50%, rgba(11,166,190,0.35) 0deg, transparent 60deg, transparent 360deg)'
                  }}
                  className="animate-spin"
                />
              )}

              {/* Reticle Target */}
              <div style={{ position: 'relative', zIndex: 10, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{
                  width: '46px',
                  height: '46px',
                  borderRadius: '50%',
                  border: isCompleted ? '2px solid #0BA6BE' : isFailed ? '2px solid #E0492F' : '2px solid #0BA6BE',
                  backgroundColor: isCompleted ? 'rgba(11,166,190,0.2)' : isFailed ? 'rgba(224,73,47,0.2)' : 'rgba(11,166,190,0.15)',
                  color: isCompleted ? '#2CC0D4' : isFailed ? '#F4705E' : '#2CC0D4',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
                }}>
                  {isCompleted ? <CheckCircle2 size={22} /> : isFailed ? <AlertCircle size={22} /> : <Layers3 size={22} />}
                </div>

                <div style={{
                  marginTop: '10px',
                  padding: '3px 10px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(14,22,26,0.92)',
                  border: '1px solid rgba(11,166,190,0.35)',
                  fontFamily: 'var(--font-data)',
                  fontSize: '10px',
                  letterSpacing: '0.06em',
                  color: '#2CC0D4',
                  fontWeight: 600
                }}>
                  {isCompleted ? 'GEOMETRY LOCKED' : isFailed ? 'DETECTION HALTED' : 'EXTRACTING VECTORS'}
                </div>
              </div>

              {/* Corner Coordinate Badges */}
              <div style={{ position: 'absolute', top: '8px', left: '10px', fontSize: '9px', fontFamily: 'var(--font-data)', color: 'rgba(44,192,212,0.7)' }}>
                X: +0.00 Y: +0.00
              </div>
              <div style={{ position: 'absolute', bottom: '8px', right: '10px', fontSize: '9px', fontFamily: 'var(--font-data)', color: 'rgba(44,192,212,0.7)' }}>
                MODE: ORTHOGRAPHIC
              </div>
            </div>

            {/* Live Metrics Counter */}
            <div style={{
              padding: '16px',
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              borderTop: '1px solid #D4E0E5',
              backgroundColor: '#FFFFFF'
            }}>
              <div>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71838C', marginBottom: '2px' }}>
                  Views
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#172830' }}>
                  {status.usable_count !== undefined ? status.usable_count : (status.normalized_count || 1)}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71838C', marginBottom: '2px' }}>
                  Features
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#087F95' }}>
                  {status.feature_count ?? (isCompleted ? 'Active' : 'Scanning')}
                </div>
              </div>

              <div>
                <div style={{ fontSize: '10px', fontFamily: 'var(--font-data)', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#71838C', marginBottom: '2px' }}>
                  Boundary
                </div>
                <div style={{ fontSize: '16px', fontWeight: 700, fontFamily: 'var(--font-data)', color: '#172830' }}>
                  {status.object_found === false ? 'None' : 'Detected'}
                </div>
              </div>
            </div>
          </div>

          {/* Pipeline Explainer Card */}
          <div style={{
            padding: '16px',
            backgroundColor: '#F8FBFC',
            border: '1px solid #D4E0E5',
            borderRadius: '8px',
            fontSize: '12px',
            color: '#53656E',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#172830', fontWeight: 600, marginBottom: '4px' }}>
              <Layers size={13} style={{ color: '#0BA6BE' }} />
              <span>Auto-Pipeline Architecture</span>
            </div>
            Single image is processed through sub-pixel morphological edge detection, Laplacian filtering, and watertight boundary closure. Standard AutoCAD DXF layers (<code style={{ color: '#087F95' }}>CUT</code> & <code style={{ color: '#087F95' }}>HOLES</code>) and binary 3D STL meshes are generated automatically.
          </div>

        </div>

      </div>

      {/* Warnings Bar if Any */}
      {status.warnings && status.warnings.length > 0 && !isFailed && !isNeedsMoreViews && (
        <div style={{
          marginTop: '24px',
          backgroundColor: '#F8FBFC',
          border: '1px solid rgba(240,180,41,0.35)',
          borderLeft: '4px solid #D2960F',
          borderRadius: '8px',
          padding: '16px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ fontWeight: 600, fontSize: '14px', color: '#D2960F', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <ShieldAlert size={16} />
            <span>Pipeline Advisories</span>
          </div>
          <ul style={{ fontSize: '13px', color: '#394B54', margin: 0, paddingLeft: '20px' }}>
            {status.warnings.map((w: any, idx: number) => (
              <li key={idx}>{typeof w === 'string' ? w : w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
