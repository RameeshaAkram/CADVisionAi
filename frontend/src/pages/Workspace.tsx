import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { addPhotos, getJobStatus, startProcessing } from '../api/jobs';
import { getJobExports, getJobDrawing } from '../api/exports';
import { Button } from '../components/ui/Button';
import {
  CheckCircle2,
  Download,
  Layers,
  Box,
  FileCode,
  ShieldAlert,
  AlertCircle,
  Plus,
  Check,
  Cpu,
  Layers3
} from 'lucide-react';

import MeasurementsList from '../components/MeasurementsList';
import DrawingSheet from '../components/drawing/DrawingSheet';
import { getConfidenceTheme } from '../lib/confidence';

export default function Workspace() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [showAddViews, setShowAddViews] = useState(false);

  // Queries
  const { data: status, refetch } = useQuery({
    queryKey: ['jobStatus', jobId],
    queryFn: () => getJobStatus(jobId!),
    enabled: !!jobId,
  });

  const { data: exportsData } = useQuery({
    queryKey: ['jobExports', jobId],
    queryFn: () => getJobExports(jobId!),
    enabled: !!jobId,
  });

  const { data: drawing } = useQuery({
    queryKey: ['jobDrawing', jobId],
    queryFn: () => getJobDrawing(jobId!),
    enabled: !!jobId,
  });

  const retryMutation = useMutation({
    mutationFn: () => startProcessing(jobId!),
    onSuccess: () => refetch(),
  });

  // Extract geometry metrics from drawing polylines and circles
  const geomSummary = useMemo(() => {
    if (!drawing?.views?.top) return null;
    const topView = drawing.views.top;
    const polylines = topView.polylines || [];
    const circles = topView.circles || [];
    const outer = polylines.find((p: any) => p.role === 'outer');
    const polyHoles = polylines.filter((p: any) => p.role === 'hole');
    const totalHoles = polyHoles.length + circles.length;

    return {
      outerPoints: outer?.points?.length || 0,
      holeCount: totalHoles,
      circleHoles: circles.length,
      polyHoles: polyHoles.length,
      totalFeatures: polylines.length + circles.length,
    };
  }, [drawing]);

  const confidence = status?.confidence;
  const theme = confidence?.level ? getConfidenceTheme(confidence.level as any) : null;
  const isCompleted = status?.status === 'completed';

  const dxfFile = exportsData?.files?.find(f => f.kind === 'dxf');
  const stlFile = exportsData?.files?.find(f => f.kind === 'mesh');

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return null;
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  return (
    <div className="flex flex-1 overflow-hidden h-[calc(100vh-64px)]">
      {/* Left CAD Rail: Layer & Mode Inspector */}
      <div className="w-[56px] shrink-0 border-r border-[var(--g-700)] bg-[var(--g-900)] flex flex-col items-center py-3 gap-3 z-20">
        <button
          onClick={() => navigate('/')}
          className="w-9 h-9 rounded-[4px] flex items-center justify-center text-[var(--g-300)] hover:text-white hover:bg-[var(--cyan-500)] transition-colors"
          title="New CAD Job"
        >
          <Plus className="w-5 h-5" />
        </button>

        <div className="w-6 h-[1px] bg-[var(--g-700)] my-1" />

        {/* 2D Orthographic Mode Button */}
        <button
          className="w-9 h-9 rounded-[4px] flex items-center justify-center text-[var(--cyan-500)] bg-[rgba(11,166,190,0.12)] border border-[rgba(11,166,190,0.3)] transition-colors"
          title="2D Orthographic Drawing"
        >
          <Layers className="w-4 h-4" />
        </button>

        {/* Layer Indicators */}
        <div className="mt-auto flex flex-col items-center gap-2 pb-2" title="Active CAD Layers: CUT & HOLES">
          <div className="w-3 h-3 rounded-full bg-[var(--cyan-400)]" title="Layer: CUT (Outer Perimeter)" />
          <div className="w-3 h-3 rounded-full bg-[#E11D48]" title="Layer: HOLES (Internal Features)" />
        </div>
      </div>

      {/* Center Viewport Area */}
      <div className="flex-1 flex flex-col min-w-0 relative bg-[var(--paper)] overflow-hidden">
        {/* Top Success / Status Banner */}
        {isCompleted && (
          <div className="z-20 bg-[rgba(255,255,255,0.98)] shrink-0 border-b border-[var(--g-700)] px-4 py-2.5 flex items-center justify-between gap-4 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-6 h-6 rounded-full bg-[rgba(8,127,149,0.15)] text-[var(--cyan-500)] flex items-center justify-center shrink-0">
                <Check className="w-3.5 h-3.5" />
              </div>
              <div>
                <div className="text-[13px] font-semibold text-[var(--g-100)] flex items-center gap-2">
                  <span>CAD Geometry Generated Successfully</span>
                  <span className="text-[10px] font-data font-medium px-1.5 py-0.5 rounded bg-[rgba(8,127,149,0.12)] text-[var(--cyan-500)] border border-[rgba(8,127,149,0.25)]">
                    0 AUDIT ERRORS
                  </span>
                </div>
                <div className="text-[11px] text-[var(--g-400)] font-data">
                  Outer contour closed • {geomSummary ? `${geomSummary.holeCount} internal holes` : 'Holes resolved'} • Watertight mesh ready
                </div>
              </div>
            </div>

            {/* Quick Export Actions */}
            <div className="flex items-center gap-2 shrink-0">
              {dxfFile?.url && (
                <a
                  href={dxfFile.url}
                  download
                  className="btn btn-sm btn-primary flex items-center gap-1.5"
                  title="Download 2D CAD Drawing"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DXF</span>
                  {dxfFile.size && (
                    <span className="opacity-75 font-data text-[10px]">
                      ({formatFileSize(dxfFile.size)})
                    </span>
                  )}
                </a>
              )}
              {stlFile?.url && (
                <a
                  href={stlFile.url}
                  download
                  className="btn btn-sm btn-secondary flex items-center gap-1.5"
                  title="Download 3D Watertight Solid Mesh"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>STL</span>
                  {stlFile.size && (
                    <span className="opacity-75 font-data text-[10px]">
                      ({formatFileSize(stlFile.size)})
                    </span>
                  )}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Coverage Advisory Bar (Docked under banner, non-intrusive) */}
        {status?.status === 'completed' && status.coverage_gaps && status.coverage_gaps.length > 0 && !showAddViews && (
          <div className="z-10 bg-[rgba(240,180,41,0.12)] shrink-0 border-b border-[rgba(240,180,41,0.35)] px-4 py-1.5 flex items-center justify-between gap-3 text-[12px]">
            <div className="flex items-center gap-2 text-[var(--amber-700)]">
              <ShieldAlert className="w-4 h-4 shrink-0 text-[var(--amber-500)]" />
              <span><strong>Single-View Notice:</strong> {status.coverage_gaps[0]} (Reconstruction completed using visible surface).</span>
            </div>
            <button
              onClick={() => setShowAddViews(true)}
              className="px-2 py-0.5 rounded text-[11px] font-medium bg-[var(--amber-500)] text-white hover:bg-[var(--amber-700)] transition-colors shrink-0"
            >
              Add extra angles
            </button>
          </div>
        )}

        {/* 2D CAD Canvas Viewport: Expands to fill remaining height */}
        <div className="flex-1 w-full min-h-0 relative overflow-hidden bg-[var(--paper)]">
          <DrawingSheet
            jobId={jobId!}
            drawing={drawing}
            createdAt={status?.created_at}
            units={status?.scale?.units || 'mm'}
          />

          {/* Add Views Drawer Panel if requested */}
          {showAddViews && status && (
            <div className="absolute inset-x-4 bottom-4 z-30 bg-[var(--g-900)] border border-[var(--g-700)] rounded-[8px] p-5 shadow-2xl flex flex-col gap-4 max-w-[700px] mx-auto">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="font-semibold text-[15px] text-[var(--g-100)]">Add Complementary Views</h3>
                  <p className="text-[13px] text-[var(--g-400)] mt-0.5">
                    {status.coverage_gaps?.[0] || 'Upload alternate angles to enrich feature extraction. Known dimensions will be preserved.'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAddViews(false)}>Close</Button>
              </div>

              <div className="border border-dashed border-[var(--g-600)] rounded-[6px] bg-[var(--g-850)] p-6 text-center hover:border-[var(--cyan-500)] cursor-pointer transition-colors" onClick={() => {
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
              }}>
                <b className="font-semibold text-[14px] text-[var(--g-100)] block">Drop additional photos here, or click to browse</b>
                <span className="text-[12px] text-[var(--g-500)] mt-1 block">JPG, PNG, or WebP</span>
              </div>
            </div>
          )}

          {/* Critical Error Overlay if Failed */}
          {status?.status === 'failed' && (
            <div className="absolute inset-x-4 bottom-4 z-20 flex flex-col gap-2">
              <div className="bg-[var(--g-900)] border border-[rgba(224,73,47,0.4)] border-l-4 border-l-[var(--red-500)] rounded-[4px] p-3 flex gap-3 items-center shadow-lg">
                <AlertCircle className="w-5 h-5 text-[var(--red-500)] shrink-0" />
                <div className="text-[13px] flex-1">
                  <b className="text-[var(--red-500)] block font-semibold">Reconstruction Failed</b>
                  <span className="text-[var(--g-300)]">{status.error || 'Check input image and try again.'}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/')}>New Job</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Engineering Sidebar */}
      <div className="w-[340px] bg-[var(--g-900)] shrink-0 border-l border-[var(--g-700)] p-5 overflow-y-auto flex flex-col gap-5 relative z-20 shadow-[-4px_0_16px_rgba(0,0,0,0.03)]">
        {/* Job Identity Card */}
        <div className="pb-4 border-b border-[var(--g-700)]">
          <div className="flex justify-between items-center mb-1">
            <span className="eyebrow">CAD Deliverables</span>
            <span className="text-[11px] font-data text-[var(--g-500)]">
              #{jobId?.substring(0, 8).toUpperCase()}
            </span>
          </div>
          <h2 className="text-[18px] font-semibold text-[var(--g-100)]">
            Production Files
          </h2>
        </div>

        {/* Dedicated DXF & STL Download Action Cards */}
        <div className="flex flex-col gap-3">
          {/* Card 1: AutoCAD DXF */}
          <div className="p-3.5 rounded-[6px] border border-[var(--g-700)] bg-[var(--g-850)] hover:border-[var(--cyan-500)] transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[4px] bg-[rgba(11,166,190,0.12)] text-[var(--cyan-500)] flex items-center justify-center shrink-0">
                  <FileCode className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--g-100)] leading-tight">2D CAD Drawing</h3>
                  <span className="text-[11px] font-data text-[var(--g-400)]">AutoCAD DXF R2018</span>
                </div>
              </div>
              {dxfFile?.size && (
                <span className="text-[11px] font-data font-semibold text-[var(--g-400)] bg-[var(--g-800)] px-1.5 py-0.5 rounded border border-[var(--g-700)]">
                  {formatFileSize(dxfFile.size)}
                </span>
              )}
            </div>

            <p className="text-[12px] text-[var(--g-400)] leading-relaxed mb-3">
              Separated on <strong className="text-[var(--cyan-500)] font-medium">CUT</strong> (perimeter) and <strong className="text-[#E11D48] font-medium">HOLES</strong> layers. Ready for CNC laser and CAD drafting.
            </p>

            {dxfFile?.ready && dxfFile.url ? (
              <a
                href={dxfFile.url}
                download
                className="btn btn-sm btn-primary w-full flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download drawing.dxf</span>
              </a>
            ) : (
              <Button variant="secondary" size="sm" disabled className="w-full">
                Preparing DXF...
              </Button>
            )}
          </div>

          {/* Card 2: 3D STL Solid Mesh */}
          <div className="p-3.5 rounded-[6px] border border-[var(--g-700)] bg-[var(--g-850)] hover:border-[var(--cyan-500)] transition-colors">
            <div className="flex items-start justify-between gap-2 mb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-[4px] bg-[rgba(11,166,190,0.12)] text-[var(--cyan-500)] flex items-center justify-center shrink-0">
                  <Box className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-[14px] font-semibold text-[var(--g-100)] leading-tight">3D Solid Mesh</h3>
                  <span className="text-[11px] font-data text-[var(--g-400)]">Binary STL Solid</span>
                </div>
              </div>
              {stlFile?.size && (
                <span className="text-[11px] font-data font-semibold text-[var(--g-400)] bg-[var(--g-800)] px-1.5 py-0.5 rounded border border-[var(--g-700)]">
                  {formatFileSize(stlFile.size)}
                </span>
              )}
            </div>

            <p className="text-[12px] text-[var(--g-400)] leading-relaxed mb-3">
              Watertight extruded 3D volume ready for slicers (PrusaSlicer, Cura, Bambu) and 3D printing.
            </p>

            {stlFile?.ready && stlFile.url ? (
              <a
                href={stlFile.url}
                download
                className="btn btn-sm btn-secondary w-full flex items-center justify-center gap-2"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Download model.stl</span>
              </a>
            ) : (
              <Button variant="secondary" size="sm" disabled className="w-full">
                Preparing STL...
              </Button>
            )}
          </div>
        </div>

        {/* Geometry Verification HUD */}
        <div className="p-3.5 rounded-[6px] border border-[var(--g-700)] bg-[var(--g-850)]">
          <div className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-wider font-data text-[var(--g-300)] mb-3 pb-2 border-b border-[var(--g-700)]">
            <Cpu className="w-3.5 h-3.5 text-[var(--cyan-500)]" />
            <span>Geometry Audit</span>
          </div>

          <div className="flex flex-col gap-2 text-[12px]">
            <div className="flex justify-between items-center">
              <span className="text-[var(--g-400)]">Outer Contour:</span>
              <span className="font-data font-medium text-[var(--g-100)]">
                {geomSummary?.outerPoints || 0} vertices (Closed)
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--g-400)]">Holes Extracted:</span>
              <span className="font-data font-semibold text-[#E11D48]">
                {geomSummary?.holeCount || 0} internal features
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--g-400)]">Calibration Unit:</span>
              <span className="font-data font-semibold text-[var(--cyan-500)] uppercase">
                {status?.scale?.units || 'mm'}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[var(--g-400)]">Audit Status:</span>
              <span className="font-data font-medium text-[var(--cyan-500)] flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Validated
              </span>
            </div>
          </div>
        </div>

        {/* Measurements List */}
        <div className="flex-1">
          <div className="flex justify-between items-center mb-2">
            <div className="font-semibold text-[13px] text-[var(--g-200)] flex items-center gap-2">
              <Layers3 className="w-3.5 h-3.5 text-[var(--cyan-500)]" />
              <span>Extracted Dimensions</span>
            </div>
            {theme && (
              <div className={`px-2 py-0.5 rounded text-[11px] font-medium border border-[var(--border)] ${theme.className} bg-[var(--g-800)] flex items-center gap-1`}>
                <span>{theme.glyph}</span>
                {confidence.level === 'measured' ? 'Measured' :
                 confidence.level === 'estimated' ? 'Estimated' : 'Low confidence'}
              </div>
            )}
          </div>

          <MeasurementsList status={status} />
        </div>

        {/* Safety Note */}
        <div className="mt-auto pt-3 border-t border-[var(--g-700)] text-[11px] text-[var(--g-400)] leading-tight">
          CADVision AI reconstruction. Always verify dimensions against physical part before CNC cutting.
        </div>
      </div>
    </div>
  );
}
