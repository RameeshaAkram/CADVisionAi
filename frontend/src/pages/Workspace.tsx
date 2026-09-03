import { useState } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { getJobStatus, startProcessing } from '../api/jobs';
import { Tabs, Tab } from '../components/ui/Tabs';
import { Button } from '../components/ui/Button';
import { RotateCcw, BoxSelect, Maximize, Hash } from 'lucide-react';

import MeasurementsList from '../components/MeasurementsList';
import DrawingSheet from '../components/drawing/DrawingSheet';
import ExportPopover from '../components/results/ExportPopover';
import { getConfidenceTheme } from '../lib/confidence';

export default function Workspace() {
  const { jobId } = useParams<{ jobId: string }>();
  const [activeTab, setActiveTab] = useState<'2D'>('2D');
  const [showDimensions, setShowDimensions] = useState(true);
  const [showAddViews, setShowAddViews] = useState(false);

  const { data: status, refetch } = useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
  });

  const retryMutation = useMutation({
    mutationFn: () => startProcessing(jobId!),
    onSuccess: () => refetch(),
  });

  const getSeverityBorder = (sev: string) => {
    return sev === 'vermilion' ? 'border-[var(--red-400)]' : 'border-[var(--amber-400)]';
  };
  const getSeverityColor = (sev: string) => {
    return sev === 'vermilion' ? 'text-[var(--red-400)]' : 'text-[var(--amber-400)]';
  };

  const confidence = status?.confidence;
  const theme = confidence?.level ? getConfidenceTheme(confidence.level as any) : null;

  return (
    <div className="flex flex-1 overflow-hidden">
      {/* Left Rail */}
      <div className="flex shrink-0 border-r border-[var(--border)] bg-[var(--bg)] z-20 relative h-full">
        {/* Tools */}
        <div className="w-[56px] flex flex-col items-center py-4 gap-4 border-r border-[var(--border)]">
          <button disabled className="w-8 h-8 flex items-center justify-center text-[var(--g-500)] cursor-not-allowed">
            <div className="w-4 h-4 border-2 border-current rounded-sm"></div>
          </button>
          <button disabled className="w-8 h-8 flex items-center justify-center text-[var(--g-500)] cursor-not-allowed">
            <div className="w-4 h-4 border-2 border-current rounded-full"></div>
          </button>
          <button disabled className="w-8 h-8 flex items-center justify-center text-[var(--g-500)] cursor-not-allowed">
            <div className="w-4 h-[2px] bg-current"></div>
          </button>
        </div>


      </div>

      {/* Center Viewport */}
      <div className={`flex-1 flex flex-col min-w-0 relative ${activeTab === '2D' ? 'paper-scope' : 'bg-[var(--bg)]'}`}>
        <div className="px-3 pt-2 z-20 relative bg-inherit">
          <Tabs>
            <Tab selected={true} onClick={() => setActiveTab('2D')}>2D drawing</Tab>
          </Tabs>
        </div>

        <div className="flex-1 m-3 border border-[var(--g-700)] rounded-none viewport relative overflow-hidden flex items-center justify-center">
          
          <div className="absolute top-2.5 right-2.5 flex gap-1 bg-[var(--g-850)] border border-[var(--g-700)] rounded-[6px] p-[3px] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] z-20">
            <Button variant="ghost" className="w-[28px] h-[28px] p-0"><RotateCcw className="w-4 h-4" /></Button>
            <Button 
              variant={showDimensions ? "accent" : "ghost"} 
              className="w-[28px] h-[28px] p-0" 
              aria-pressed={showDimensions}
              onClick={() => setShowDimensions(!showDimensions)}
            >
              <Hash className="w-4 h-4" />
            </Button>
            <Button variant="ghost" className="w-[28px] h-[28px] p-0"><BoxSelect className="w-4 h-4" /></Button>
            <Button variant="ghost" className="w-[28px] h-[28px] p-0"><Maximize className="w-4 h-4" /></Button>
          </div>

            <DrawingSheet jobId={jobId!} createdAt={status?.created_at} />

          {/* Add Views Panel */}
          {showAddViews && status && (
            <div className="absolute bottom-2.5 left-2.5 right-2.5 z-30 bg-[var(--surface)] border border-[var(--g-700)] rounded-[8px] p-4 shadow-xl flex flex-col gap-4">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-[16px] text-white">Add views to this reconstruction</h3>
                  <p className="text-[14px] text-[var(--g-300)] mt-1">
                    {status.coverage_gaps?.[0] || 'Add the sides or top that are missing, then process again. The known dimension is kept.'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAddViews(false)}>Cancel</Button>
              </div>

              <div className="flex flex-wrap gap-2">
                {status.files?.map((f: any, idx: number) => (
                  <div key={idx} className="w-[52px] h-[52px] bg-[var(--g-800)] border border-[var(--g-700)] rounded-[3px] flex items-center justify-center shrink-0 text-[10px] text-[var(--g-400)] overflow-hidden text-center relative group">
                    {f.kind === 'image' ? <img src={`http://localhost:8000/api/jobs/${jobId}/files/${f.filename}`} className="w-full h-full object-cover opacity-60" alt="" /> : 'Video'}
                  </div>
                ))}
              </div>

              <div className="border border-dashed border-[var(--g-600)] rounded-[6px] bg-[var(--g-900)] p-[24px_16px] text-center hover:border-[var(--cyan-500)] cursor-pointer" onClick={() => {
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
                <b className="font-semibold text-[14px] text-[var(--g-100)] block">Drop photos here, or browse</b>
                <span className="text-[12px] text-[var(--g-500)]">JPG, PNG, or WebP</span>
              </div>
            </div>
          )}

          {/* Banners */}
          <div className="absolute bottom-2.5 left-2.5 right-2.5 z-20 flex flex-col gap-2">
            {status?.status === 'failed' && (
              <div className="bg-[var(--g-850)] border border-[rgba(255,255,255,0.1)] border-l-[2px] border-l-[var(--red-400)] rounded-[4px] p-[10px_12px] flex gap-2.5 items-start shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[var(--red-400)] font-semibold text-[13px] leading-[17px]">⚠</div>
                <div className="text-[12px] leading-[17px] flex-1">
                  <b className="text-[var(--red-400)] block font-semibold mb-0.5">Reconstruction Failed</b>
                  <span className="text-[var(--g-300)]">{status.error || 'Check your photos and try again.'}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => window.location.href = '/'}>New Job</Button>
              </div>
            )}
            
            {status?.status === 'completed' && status.coverage_gaps && status.coverage_gaps.length > 0 && !showAddViews && (
              <div className="bg-[var(--g-850)] border border-[rgba(255,255,255,0.1)] border-l-[2px] border-l-[var(--amber-400)] rounded-[4px] p-[10px_12px] flex gap-2.5 items-center shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
                <div className="text-[var(--amber-400)] font-semibold text-[13px] leading-[17px]">⚠</div>
                <div className="text-[12px] leading-[17px] flex-1">
                  <b className="text-[var(--amber-400)] block font-semibold mb-0.5">Hidden surfaces inferred</b>
                  <span className="text-[var(--g-300)]">{status.coverage_gaps[0]}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => setShowAddViews(true)}>Add views</Button>
              </div>
            )}

            {!showAddViews && confidence?.warnings && confidence.warnings.length > 0 && (
              <>
                {confidence.warnings.slice(0, 2).sort((a: any, b: any) => a.severity === 'vermilion' ? -1 : 1).map((w: any, idx: number) => (
                  <div key={idx} className={`bg-[var(--g-850)] border border-[rgba(255,255,255,0.1)] border-l-[2px] ${getSeverityBorder(w.severity)} rounded-[4px] p-[10px_12px] flex gap-2.5 items-start shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]`}>
                    <div className={`${getSeverityColor(w.severity)} font-semibold text-[13px] leading-[17px]`}>⚠</div>
                    <div className="text-[12px] leading-[17px]">
                      <b className={`${getSeverityColor(w.severity)} block font-semibold mb-0.5`}>{w.message}</b>
                      <span className="text-[var(--g-300)]">{w.action}</span>
                    </div>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Right Panel */}
      <div className="w-[320px] bg-[var(--surface)] shrink-0 border-l border-[var(--border)] p-5 overflow-y-auto flex flex-col relative z-20">
        <div className="flex justify-between items-center mb-2">
          <div className="font-semibold text-[13px] leading-[18px] text-[var(--g-300)]">Measurements</div>
          {theme && (
            <div className={`px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] ${theme.className} bg-[var(--g-800)] flex items-center gap-1`}>
              <span>{theme.glyph}</span> 
              {confidence.level === 'measured' ? 'Measured model' : 
               confidence.level === 'estimated' ? 'Estimated model' : 'Low confidence'}
            </div>
          )}
        </div>
        
        <MeasurementsList status={status} />

        <div className="mt-auto pt-6 w-full">
          {status?.status === 'completed' && confidence?.ok !== false ? (
            <ExportPopover jobId={jobId!} />
          ) : (
            <>
              <Button variant="primary" disabled className="w-full">Export</Button>
              <div className="text-[11px] leading-[14px] text-[var(--g-500)] mt-2 text-center">
                {confidence?.ok === false ? 'Export disabled (Validation failed).' : 'Available once CAD conversion finishes.'}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
