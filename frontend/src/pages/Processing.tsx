import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { addPhotos, getJobStatus, startProcessing, type JobStatusResponse } from '../api/jobs';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';
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
  ChevronUp
} from 'lucide-react';

interface PipelineStageDef {
  id: string;
  name: string;
  desc: string;
}

const PIPELINE_STAGES: PipelineStageDef[] = [
  { id: 'prepare_images', name: 'Image Normalization', desc: 'Color space equalization & pixel orientation alignment' },
  { id: 'view_analysis', name: 'Quality & Contrast Analysis', desc: 'Sharpness Laplacian score & white-background gate verification' },
  { id: 'object_detection', name: 'Boundary Localization', desc: 'Adaptive Otsu thresholding & component bounding box isolation' },
  { id: 'feature_detection', name: 'Contour & Hole Extraction', desc: 'External perimeter tracing & topological hole hierarchy' },
  { id: 'scale_calibration', name: 'Scale Calibration', desc: 'Reference dimension ratio & sub-pixel metric calibration' },
  { id: 'drawing_generation', name: '2D Vector CAD Generation', desc: 'Orthographic projection & closed polyline vectorization' },
  { id: 'validation', name: 'Geometry Verification & Export', desc: 'Watertightness audit, DXF R2018 export & STL solid mesh generation' },
];

export default function Processing() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [showTechnicalDetails, setShowTechnicalDetails] = useState(false);

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
      }, 900);
      return () => clearTimeout(t);
    }
  }, [status?.status, jobId, navigate]);

  const stagesState = useMemo(() => {
    if (!status) return {};
    const map: Record<string, { status: 'pending' | 'running' | 'completed' | 'failed'; detail?: string }> = {};

    // Default from API status.stages if available
    if (status.stages && Array.isArray(status.stages)) {
      for (const s of status.stages) {
        map[s.name] = {
          status: s.status as any,
          detail: s.detail
        };
      }
    }

    // Fallback or override based on current_stage & job status
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
      <div className="max-w-[1020px] mx-auto w-full p-6 md:p-10">
        <div className="step-card p-6 border-[var(--red-400)] bg-[rgba(224,73,47,0.06)] flex items-start gap-4">
          <AlertCircle className="w-6 h-6 text-[var(--red-500)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h2 className="text-[17px] font-semibold text-[var(--red-500)]">Error Loading Job Status</h2>
            <p className="text-[14px] text-[var(--g-300)] mt-1 font-data">{(error as Error).message}</p>
            <div className="mt-4 flex gap-3">
              <Button variant="secondary" onClick={() => refetch()}>
                <RotateCw className="w-4 h-4 mr-2" /> Retry Connection
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
      <div className="max-w-[1020px] mx-auto w-full p-12 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="w-8 h-8 text-[var(--cyan-500)] animate-spin mb-4" />
        <p className="text-[14px] font-data text-[var(--g-400)]">Initializing CAD pipeline connection...</p>
      </div>
    );
  }

  const isFailed = status.status === 'failed';
  const isNeedsMoreViews = status.status === 'needs_more_views';
  const isCompleted = status.status === 'completed';

  const activeStage = PIPELINE_STAGES.find(s => stagesState[s.id]?.status === 'running') ||
    (isCompleted ? PIPELINE_STAGES[PIPELINE_STAGES.length - 1] : PIPELINE_STAGES[0]);

  return (
    <div className="max-w-[1100px] mx-auto w-full p-4 md:p-8">
      {/* Header bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[var(--g-700)]">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="eyebrow">CAD Engine Pipeline</span>
            <span className="text-[var(--g-500)] font-data text-[12px]">•</span>
            <span className="font-data text-[12px] text-[var(--g-400)] uppercase">
              JOB #{jobId?.substring(0, 8)}
            </span>
          </div>
          <h1 className="text-[26px] md:text-[30px] font-semibold tracking-[-0.02em] text-[var(--g-100)] flex items-center gap-3">
            {isCompleted ? 'Reconstruction Complete' : isFailed ? 'Reconstruction Interrupted' : 'Processing CAD Geometry'}
            {isCompleted && (
              <span className="text-[12px] font-medium font-data px-2.5 py-0.5 rounded-full bg-[rgba(8,127,149,0.15)] text-[var(--cyan-500)] border border-[rgba(8,127,149,0.3)]">
                READY FOR WORKSPACE
              </span>
            )}
          </h1>
        </div>

        <div className="flex items-center gap-3">
          {/* Status Badge */}
          <div className={cn(
            "flex items-center gap-2 px-3 py-1.5 rounded-full border text-[13px] font-data font-medium",
            isCompleted ? "bg-[rgba(8,127,149,0.1)] text-[var(--cyan-500)] border-[rgba(8,127,149,0.3)]" :
            isFailed ? "bg-[rgba(224,73,47,0.1)] text-[var(--red-500)] border-[rgba(224,73,47,0.3)]" :
            isNeedsMoreViews ? "bg-[rgba(240,180,41,0.1)] text-[var(--amber-500)] border-[rgba(240,180,41,0.3)]" :
            "bg-[rgba(11,166,190,0.08)] text-[var(--cyan-400)] border-[rgba(11,166,190,0.25)]"
          )}>
            {!isCompleted && !isFailed && !isNeedsMoreViews && (
              <span className="w-2 h-2 rounded-full bg-[var(--cyan-400)] animate-ping" />
            )}
            {isCompleted && <CheckCircle2 className="w-4 h-4 text-[var(--cyan-500)]" />}
            {isFailed && <AlertCircle className="w-4 h-4 text-[var(--red-500)]" />}
            {isNeedsMoreViews && <ShieldAlert className="w-4 h-4 text-[var(--amber-500)]" />}
            <span className="uppercase tracking-wide">
              {status.status.replace(/_/g, ' ')}
            </span>
          </div>

          {isCompleted && (
            <Button variant="primary" size="sm" onClick={() => navigate(`/jobs/${jobId}/view`)}>
              Open Workspace <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          )}
        </div>
      </div>

      {/* High-Precision Progress Bar */}
      <div className="mt-6 mb-8">
        <div className="flex justify-between items-center text-[12px] font-data text-[var(--g-400)] mb-2">
          <span className="flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-[var(--cyan-500)]" />
            <span>Active Stage: <strong className="text-[var(--g-100)] font-medium">{activeStage.name}</strong></span>
          </span>
          <span className="tabular-nums font-semibold text-[var(--g-200)]">
            {progressPercentage}%
          </span>
        </div>
        <div className="w-full h-[6px] bg-[var(--g-800)] border border-[var(--g-700)] rounded-full overflow-hidden relative">
          <div
            className="h-full bg-gradient-to-r from-[var(--cyan-600)] to-[var(--cyan-400)] transition-all duration-300 ease-out relative"
            style={{ width: `${progressPercentage}%` }}
          >
            {!isCompleted && !isFailed && (
              <div className="absolute top-0 bottom-0 right-0 w-8 bg-white/30 animate-pulse" />
            )}
          </div>
        </div>
      </div>

      {/* Needs More Views Notification */}
      {isNeedsMoreViews && (
        <div className="mb-8 step-card border-l-4 border-l-[var(--amber-500)] p-5 bg-[rgba(240,180,41,0.06)]">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-[rgba(240,180,41,0.15)] flex items-center justify-center shrink-0 text-[var(--amber-500)]">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[16px] text-[var(--g-100)]">Additional Views Required for Complete Coverage</h3>
              <p className="text-[13px] text-[var(--g-300)] mt-1 max-w-[70ch]">
                {status.coverage_gaps?.[0] || 'The geometric confidence gate detected unobserved surfaces. Please supply additional photos of the part from alternate angles to calibrate outer contours.'}
              </p>
              <div className="mt-4 flex items-center gap-3">
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
                  <UploadCloud className="w-4 h-4 mr-2" /> Upload Extra Angles
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
        <div className="mb-8 step-card border-l-4 border-l-[var(--red-500)] p-5 bg-[rgba(224,73,47,0.06)]">
          <div className="flex items-start gap-4">
            <div className="w-9 h-9 rounded-full bg-[rgba(224,73,47,0.15)] flex items-center justify-center shrink-0 text-[var(--red-500)]">
              <AlertCircle className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <h3 className="font-semibold text-[16px] text-[var(--red-500)]">Processing Halted</h3>
              <p className="text-[13px] text-[var(--g-300)] mt-1 font-data">
                {status.error || 'The CAD pipeline encountered an unexpected validation anomaly.'}
              </p>

              <div className="mt-4 flex items-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => retryMutation.mutate()}
                  isLoading={retryMutation.isPending}
                >
                  <RotateCw className="w-4 h-4 mr-2" /> Retry Processing
                </Button>
                <Button variant="ghost" size="sm" onClick={() => setShowTechnicalDetails(!showTechnicalDetails)}>
                  {showTechnicalDetails ? <ChevronUp className="w-4 h-4 mr-1" /> : <ChevronDown className="w-4 h-4 mr-1" />}
                  {showTechnicalDetails ? 'Hide Diagnostics' : 'Show Diagnostics'}
                </Button>
              </div>

              {showTechnicalDetails && (
                <div className="mt-3 p-3 bg-[var(--g-900)] border border-[var(--g-700)] rounded text-[12px] font-data text-[var(--g-400)] overflow-x-auto">
                  <div className="text-[var(--g-200)] font-medium mb-1">Diagnostic Context:</div>
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

      {/* Main Grid: Radar/Telemetry Visualizer on Left, Precision Stage Checklist on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Column: Visual Radar / Crosshair Scanner & Telemetry HUD */}
        <div className="lg:col-span-5 flex flex-col gap-4">
          <div className="step-card overflow-hidden border border-[var(--g-700)]">
            <div className="px-4 py-3 bg-[var(--g-850)] border-b border-[var(--g-700)] flex justify-between items-center">
              <div className="flex items-center gap-2 text-[12px] font-semibold font-data text-[var(--g-300)] uppercase tracking-wider">
                <Crosshair className="w-3.5 h-3.5 text-[var(--cyan-500)]" />
                <span>Feature Telemetry</span>
              </div>
              <span className="text-[11px] font-data text-[var(--g-500)]">LIVE HUD</span>
            </div>

            {/* Radar Viewport with Crosshairs */}
            <div className="relative h-[240px] bg-[#0E161A] overflow-hidden flex items-center justify-center">
              {/* Technical CAD Grid Pattern */}
              <div
                className="absolute inset-0 opacity-20 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, #2CC0D4 1px, transparent 1px),
                    linear-gradient(to bottom, #2CC0D4 1px, transparent 1px)
                  `,
                  backgroundSize: '24px 24px',
                }}
              />

              {/* Concentric Radar Rings */}
              <div className="absolute w-[180px] h-[180px] rounded-full border border-[rgba(44,192,212,0.15)] pointer-events-none" />
              <div className="absolute w-[120px] h-[120px] rounded-full border border-[rgba(44,192,212,0.25)] pointer-events-none" />
              <div className="absolute w-[60px] h-[60px] rounded-full border border-[rgba(44,192,212,0.4)] pointer-events-none" />

              {/* Center Crosshairs */}
              <div className="absolute w-full h-[1px] bg-[rgba(44,192,212,0.2)] pointer-events-none" />
              <div className="absolute h-full w-[1px] bg-[rgba(44,192,212,0.2)] pointer-events-none" />

              {/* Rotating Radar Sweep Line */}
              {!isCompleted && !isFailed && (
                <div
                  className="absolute w-[180px] h-[180px] rounded-full origin-center animate-spin pointer-events-none"
                  style={{
                    animationDuration: '3s',
                    background: 'conic-gradient(from 0deg at 50% 50%, rgba(44,192,212,0.28) 0deg, transparent 60deg, transparent 360deg)'
                  }}
                />
              )}

              {/* Reticle Target */}
              <div className="relative z-10 flex flex-col items-center">
                <div className={cn(
                  "w-12 h-12 rounded-full border-2 flex items-center justify-center shadow-lg transition-colors",
                  isCompleted ? "border-[var(--cyan-400)] bg-[rgba(8,127,149,0.2)] text-[var(--cyan-300)]" :
                  isFailed ? "border-[var(--red-400)] bg-[rgba(224,73,47,0.2)] text-[var(--red-300)]" :
                  "border-[var(--cyan-400)] bg-[rgba(11,166,190,0.15)] text-[var(--cyan-400)] animate-pulse"
                )}>
                  {isCompleted ? <CheckCircle2 className="w-6 h-6" /> :
                   isFailed ? <AlertCircle className="w-6 h-6" /> :
                   <Layers className="w-6 h-6" />}
                </div>

                <div className="mt-3 px-2.5 py-0.5 rounded bg-[rgba(14,22,26,0.85)] border border-[rgba(44,192,212,0.3)] font-data text-[11px] text-[var(--cyan-300)]">
                  {isCompleted ? 'GEOMETRY LOCKED' : isFailed ? 'DETECTION HALTED' : 'EXTRACTING VECTORS'}
                </div>
              </div>

              {/* Corner Coordinate Badges */}
              <div className="absolute top-2 left-2 text-[10px] font-data text-[rgba(44,192,212,0.6)]">
                X: +0.00 Y: +0.00
              </div>
              <div className="absolute bottom-2 right-2 text-[10px] font-data text-[rgba(44,192,212,0.6)]">
                RES: 2400 DPI
              </div>
            </div>

            {/* Live Metrics Counter */}
            <div className="p-4 grid grid-cols-3 gap-2 border-t border-[var(--g-700)] bg-[var(--g-900)]">
              <div>
                <div className="text-[10px] uppercase tracking-wider font-data text-[var(--g-500)]">Views</div>
                <div className="text-[16px] font-semibold font-data text-[var(--g-100)] tabular-nums">
                  {status.usable_count !== undefined ? status.usable_count : (status.normalized_count || 1)}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-data text-[var(--g-500)]">Features</div>
                <div className="text-[16px] font-semibold font-data text-[var(--cyan-500)] tabular-nums">
                  {status.feature_count ?? (isCompleted ? 'Active' : 'Scanning')}
                </div>
              </div>
              <div>
                <div className="text-[10px] uppercase tracking-wider font-data text-[var(--g-500)]">Boundary</div>
                <div className="text-[16px] font-semibold font-data text-[var(--g-100)]">
                  {status.object_found === false ? 'None' : 'Detected'}
                </div>
              </div>
            </div>
          </div>

          {/* Quick Notice */}
          <div className="p-3.5 bg-[var(--g-850)] border border-[var(--g-700)] rounded-[6px] text-[12px] text-[var(--g-400)] leading-relaxed">
            <span className="text-[var(--g-200)] font-medium">Auto-Pipeline:</span> Single photo is processed through sub-pixel morphological edge detection, Laplacian filtering, and watertight boundary closure.
          </div>
        </div>

        {/* Right Column: 7 Real Backend Pipeline Stages Checklist */}
        <div className="lg:col-span-7 flex flex-col gap-3">
          <div className="step-card p-5 border border-[var(--g-700)]">
            <div className="flex justify-between items-center mb-4 pb-2 border-b border-[var(--g-700)]">
              <h2 className="text-[14px] font-semibold uppercase tracking-wider font-data text-[var(--g-300)]">
                Pipeline Stages Execution
              </h2>
              <span className="text-[12px] font-data text-[var(--g-500)]">
                {PIPELINE_STAGES.filter(s => stagesState[s.id]?.status === 'completed').length} / {PIPELINE_STAGES.length} Completed
              </span>
            </div>

            <div className="flex flex-col gap-2.5">
              {PIPELINE_STAGES.map((stage) => {
                const state = stagesState[stage.id]?.status || 'pending';
                const detail = stagesState[stage.id]?.detail;
                const isRunning = state === 'running';
                const isStageDone = state === 'completed';
                const isStageFailed = state === 'failed';

                return (
                  <div
                    key={stage.id}
                    className={cn(
                      "flex items-start gap-3 p-3 rounded-[5px] border transition-all duration-200",
                      isRunning ? "bg-[rgba(11,166,190,0.06)] border-[rgba(11,166,190,0.35)] shadow-sm" :
                      isStageDone ? "bg-[var(--g-900)] border-[var(--g-700)]" :
                      isStageFailed ? "bg-[rgba(224,73,47,0.06)] border-[rgba(224,73,47,0.35)]" :
                      "bg-[var(--g-900)] border-[var(--g-700)] opacity-60"
                    )}
                  >
                    {/* Status Icon */}
                    <div className="mt-0.5 shrink-0">
                      {isStageDone ? (
                        <CheckCircle2 className="w-5 h-5 text-[var(--cyan-500)]" />
                      ) : isRunning ? (
                        <Loader2 className="w-5 h-5 text-[var(--cyan-400)] animate-spin" />
                      ) : isStageFailed ? (
                        <AlertCircle className="w-5 h-5 text-[var(--red-500)]" />
                      ) : (
                        <Circle className="w-5 h-5 text-[var(--g-600)]" />
                      )}
                    </div>

                    {/* Stage Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className={cn(
                          "text-[14px] font-medium leading-tight",
                          isRunning ? "text-[var(--cyan-500)] font-semibold" :
                          isStageDone ? "text-[var(--g-100)]" :
                          isStageFailed ? "text-[var(--red-500)] font-semibold" :
                          "text-[var(--g-400)]"
                        )}>
                          {stage.name}
                        </span>
                        <span className="text-[10px] font-data text-[var(--g-500)] uppercase tracking-wider shrink-0">
                          {isRunning ? 'RUNNING' : isStageDone ? 'PASS' : isStageFailed ? 'FAILED' : 'WAITING'}
                        </span>
                      </div>
                      <p className="text-[12px] text-[var(--g-400)] mt-0.5 leading-normal">
                        {stage.desc}
                      </p>
                      {detail && (
                        <div className="mt-1 text-[11px] font-data text-[var(--g-300)] bg-[var(--g-850)] px-2 py-0.5 rounded border border-[var(--g-700)] inline-block">
                          {detail}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Warnings Bar if Any */}
      {status.warnings && status.warnings.length > 0 && !isFailed && !isNeedsMoreViews && (
        <div className="mt-6 bg-[var(--g-850)] border border-[rgba(240,180,41,0.35)] border-l-[3px] border-l-[var(--amber-400)] rounded-[6px] p-4 flex flex-col gap-2">
          <div className="font-semibold text-[14px] leading-[20px] text-[var(--amber-500)] flex items-center gap-2">
            <ShieldAlert className="w-4 h-4" /> Pipeline Advisories
          </div>
          <ul className="text-[13px] text-[var(--g-300)] list-disc list-inside space-y-1">
            {status.warnings.map((w: any, idx: number) => (
              <li key={idx}>{typeof w === 'string' ? w : w.message}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
