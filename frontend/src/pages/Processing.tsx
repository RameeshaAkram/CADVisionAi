import { Fragment, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getJobStatus, startProcessing } from '../api/jobs';
import { Button } from '../components/ui/Button';
import { cn } from '../lib/utils';

const PHASE_MAPPING: Record<string, number> = {
  prepare_images: 0,
  view_analysis: 1,
  object_detection: 1,
  feature_detection: 1,
  reconstruction: 2,
  scale_calibration: 3,
  geometry_refine: 4,
  assembly: 4,
  cad_generation: 4,
  drawing_generation: 4,
  validation: 4,
};

const PHASE_LABELS = ['Prepared', 'Analyzed views', 'Reconstructing', 'Scale', 'CAD output'];

export default function Processing() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();

  const { data: status, error, refetch } = useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => getJobStatus(jobId!),
    refetchInterval: (query) => {
      const state = query.state.data;
      if (state && (state.status === 'completed' || state.status === 'failed' || state.status === 'needs_more_views')) {
        return false;
      }
      return 800;
    },
    enabled: !!jobId,
  });

  const retryMutation = useMutation({
    mutationFn: () => startProcessing(jobId!),
    onSuccess: () => refetch(),
  });

  useEffect(() => {
    if (status?.status === 'completed') {
      // Small delay for user to see 100% before jumping
      const t = setTimeout(() => {
        navigate(`/jobs/${jobId}/view`);
      }, 800);
      return () => clearTimeout(t);
    }
  }, [status?.status, jobId, navigate]);

  if (error) {
    return (
      <div className="p-8 max-w-[960px] mx-auto w-full">
        <div className="text-[var(--red-400)] font-semibold mb-2">Error loading job</div>
        <div className="text-[var(--g-300)]">{error.message}</div>
      </div>
    );
  }

  if (!status) return null;

  const currentPhaseIndex = status.current_stage ? PHASE_MAPPING[status.current_stage] ?? 0 : 5;
  const isFailed = status.status === 'failed';
  const isNeedsMoreViews = status.status === 'needs_more_views';
  const isDone = status.status === 'completed';

  const formatElapsed = () => {
    // Simple placeholder for elapsed time since we don't track start exactly, 
    // but we can fake it or just show 0:00. Backend doesn't provide elapsed directly.
    return "0:00"; 
  };

  const humanizeStage = (stage: string | null) => {
    if (!stage) return 'Done';
    return stage.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  };

  return (
    <div className="max-w-[960px] mx-auto w-full p-4 md:p-8">
      <div className="flex justify-between items-baseline mb-6">
        <h1 className="text-[20px] font-semibold leading-[26px] tracking-[-0.012em]">Reconstructing</h1>
        <div className="font-medium text-[12px] leading-[16px] font-data text-[var(--g-500)]">
          job {jobId?.substring(0, 6)} · ⏱ {formatElapsed()}
        </div>
      </div>

      {/* Stepper */}
      <div className="flex items-start gap-0 mt-2 mb-4 overflow-x-auto pb-4">
        {PHASE_LABELS.map((label, idx) => {
          const isCompleted = currentPhaseIndex > idx || isDone;
          const isActive = currentPhaseIndex === idx && !isDone && !isFailed && !isNeedsMoreViews;
          const isPhaseFailed = isFailed && currentPhaseIndex === idx;

          return (
            <Fragment key={label}>
              <div className="flex flex-col items-center gap-2.5 shrink-0 w-[104px] text-center">
                <div className={cn(
                  "w-[13px] h-[13px] rounded-full border-2 bg-[var(--g-950)] relative z-10",
                  isCompleted ? "bg-[var(--cyan-500)] border-[var(--cyan-500)]" :
                  isActive ? "border-[var(--cyan-400)] shadow-[0_0_0_4px_rgba(44,192,212,0.18)] animate-pulse" :
                  isPhaseFailed ? "bg-[var(--red-500)] border-[var(--red-500)]" :
                  "border-[var(--g-600)]"
                )} />
                <b className={cn("font-medium text-[11px] leading-[15px]", (isActive || isCompleted || isPhaseFailed) ? "text-[var(--g-100)]" : "text-[var(--g-400)]")}>
                  {label}
                </b>
              </div>
              {idx < PHASE_LABELS.length - 1 && (
                <div className={cn(
                  "flex-1 h-[2px] mt-[5.5px] min-w-[20px]",
                  isCompleted ? "bg-[var(--cyan-500)]" :
                  isActive ? "bg-[repeating-linear-gradient(90deg,var(--g-600)_0_4px,transparent_4px_8px)]" :
                  "bg-[var(--g-700)]"
                )} />
              )}
            </Fragment>
          );
        })}
      </div>

      <div className="font-normal text-[12px] leading-[18px] text-[var(--g-500)] mb-5">
        {isFailed ? `Failed at ${humanizeStage(status.current_stage)}` : humanizeStage(status.current_stage)}
      </div>

      {isNeedsMoreViews && (
        <div className="bg-[var(--g-850)] border border-[rgba(240,180,41,0.35)] border-l-[2px] border-l-[var(--amber-400)] rounded-[4px] p-4 flex flex-col gap-2 mb-6">
          <div className="font-semibold text-[16px] leading-[22px] text-[var(--amber-400)]">Not enough coverage to reconstruct</div>
          <div className="text-[14px] text-[var(--g-300)] max-w-[60ch]">
            {status.confidence?.warnings?.[0]?.message || (typeof status.warnings?.[0] === 'string' ? status.warnings[0] : status.warnings?.[0]?.message) || 'Please provide more viewpoints.'}
            {' '}
            {status.confidence?.warnings?.[0]?.action || status.warnings?.[0]?.action || ''}
          </div>
          <div className="mt-2">
            <Button variant="secondary" size="sm" onClick={() => {
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
                    const formData = new FormData();
                    validFiles.forEach(f => formData.append('files', f));
                    const res = await fetch(`http://localhost:8000/api/jobs/${jobId}/files`, {
                      method: 'POST',
                      body: formData,
                    });
                    if (res.ok) {
                      retryMutation.mutate();
                    } else {
                      alert('Failed to upload files.');
                    }
                  } catch (err) {
                    console.error(err);
                  }
                }
              };
              fileInput.click();
            }}>
              Add photos
            </Button>
          </div>
        </div>
      )}

      {isFailed && (
        <div className="bg-[var(--g-850)] border border-[rgba(224,73,47,0.35)] border-l-[2px] border-l-[var(--red-400)] rounded-[4px] p-4 flex flex-col gap-2 mb-6">
          <div className="font-semibold text-[16px] leading-[22px] text-[var(--red-400)]">Reconstruction stopped during {PHASE_LABELS[currentPhaseIndex]}</div>
          <div className="text-[14px] text-[var(--g-300)] max-w-[60ch]">
            {status.error || 'An unexpected error occurred.'}
          </div>
          <div className="mt-2 flex gap-2">
            <Button variant="secondary" size="sm" onClick={() => retryMutation.mutate()} isLoading={retryMutation.isPending}>Retry</Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 items-start">
        <div className="viewport h-[190px] rounded-none border border-[var(--g-700)] flex items-center justify-center text-[var(--g-500)] font-data text-[12px]">
          {/* Real point cloud or preview will go here in later segments */}
          Live preview bounds
        </div>
        
        <div className="bg-[var(--g-850)] border border-[var(--g-700)] rounded-[6px] p-5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
          <div className="flex justify-between items-center py-2.5 border-b border-[var(--g-800)]">
            <span className="text-[13px] leading-[18px] text-[var(--g-300)]">Views used</span>
            <span className="font-medium text-[13px] leading-[18px] font-data text-[var(--g-100)] tabular-nums">{status.usable_count !== undefined ? status.usable_count : status.normalized_count}</span>
          </div>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-[var(--g-800)]">
            <span className="text-[13px] leading-[18px] text-[var(--g-300)]">Features found</span>
            <span className="font-medium text-[13px] leading-[18px] font-data text-[var(--g-100)] tabular-nums">{status.feature_count ?? 0}</span>
          </div>
          <div className="flex justify-between items-center py-2.5">
            <span className="text-[13px] leading-[18px] text-[var(--g-300)]">Elapsed</span>
            <span className="font-medium text-[13px] leading-[18px] font-data text-[var(--g-100)] tabular-nums">{formatElapsed()}</span>
          </div>
        </div>
      </div>

      {status.warnings && status.warnings.length > 0 && !isNeedsMoreViews && !isFailed && (
        <div className="mt-6 bg-[var(--g-850)] border border-[rgba(240,180,41,0.35)] border-l-[2px] border-l-[var(--amber-400)] rounded-[4px] p-4 flex flex-col gap-2">
          <div className="font-semibold text-[16px] leading-[22px] text-[var(--amber-400)]">Warnings</div>
          <ul className="text-[14px] text-[var(--g-300)] max-w-[60ch] list-disc list-inside">
            {status.warnings.map((w: any, idx: number) => (
              <li key={idx}>{typeof w === 'string' ? w : w.message}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-5 flex justify-end">
        <Button variant="secondary" disabled>Cancel (Not available yet)</Button>
      </div>
    </div>
  );
}
