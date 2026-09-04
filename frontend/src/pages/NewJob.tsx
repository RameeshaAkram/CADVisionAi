import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createJob, startProcessing, type KnownDimension } from '../api/jobs';
import { Button } from '../components/ui/Button';
import { unitOptions } from '../lib/units';
import {
  UploadCloud,
  Layers3,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  FileCode,
  Box,
  Sparkles,
  Check
} from 'lucide-react';

interface UIFile {
  file: File;
  preview: string;
  status: 'usable' | 'warning' | 'rejected';
  width?: number;
  height?: number;
}

export default function NewJob() {
  const navigate = useNavigate();
  const [mode] = useState<'photo'>('photo');
  const [uiFiles, setUiFiles] = useState<UIFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);

  // Single clear reference dimension
  const [dimLabel, setDimLabel] = useState('Overall width');
  const [dimValue, setDimValue] = useState<number | ''>(100);
  const [units, setUnits] = useState('mm');
  const [thickness, setThickness] = useState<number | ''>(3.0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      uiFiles.forEach(f => URL.revokeObjectURL(f.preview));
    };
  }, [uiFiles]);

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setErrorMsg(null);
    const filesArray = Array.from(newFiles);
    if (filesArray.length === 0) return;

    const toAdd: UIFile[] = [];
    let rejectedCount = 0;

    filesArray.forEach(f => {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(f.type)) {
        rejectedCount++;
        return;
      }
      const previewUrl = URL.createObjectURL(f);
      const fileObj: UIFile = {
        file: f,
        preview: previewUrl,
        status: f.size > 20 * 1024 * 1024 ? 'warning' : 'usable',
      };

      // Load natural dimensions
      const img = new Image();
      img.onload = () => {
        setUiFiles(prev => prev.map(item => item.preview === previewUrl ? { ...item, width: img.naturalWidth, height: img.naturalHeight } : item));
      };
      img.src = previewUrl;

      toAdd.push(fileObj);
    });

    if (rejectedCount > 0) {
      setErrorMsg('Accepted formats: PNG, JPG, or WebP. Non-image files were skipped.');
    }

    if (toAdd.length > 0) {
      // Primary workflow: one primary image for 2D CAD reconstruction
      setUiFiles(toAdd);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const validFiles = uiFiles.filter(f => f.status !== 'rejected').map(f => f.file);
      if (validFiles.length === 0) throw new Error('Please select a part image.');
      const numValue = typeof dimValue === 'number' ? dimValue : parseFloat(String(dimValue));
      if (!numValue || numValue <= 0) throw new Error('Please enter a valid known dimension (> 0).');
      const numThickness = typeof thickness === 'number' ? thickness : (parseFloat(String(thickness)) || 1.0);

      const dims: KnownDimension[] = [{ label: dimLabel, value: numValue }];
      const resp = await createJob(mode, units, dims, numThickness, validFiles);
      await startProcessing(resp.job_id);
      return resp.job_id;
    },
    onSuccess: (jobId) => {
      navigate(`/jobs/${jobId}`);
    },
    onError: (err: any) => {
      setErrorMsg(err.message || 'An error occurred during submission.');
    }
  });

  const selectedFile = uiFiles[0];
  const hasValidFile = uiFiles.length > 0 && uiFiles[0].status !== 'rejected';
  const hasValidDimension = typeof dimValue === 'number' ? dimValue > 0 : (parseFloat(String(dimValue)) > 0);
  const hasValidThickness = typeof thickness === 'number' ? thickness > 0 : (parseFloat(String(thickness)) > 0);
  const canSubmit = hasValidFile && hasValidDimension && hasValidThickness && !createMutation.isPending;

  return (
    <div className="flex-1 w-full max-w-[1240px] mx-auto px-4 sm:px-6 md:px-10 py-8 md:py-12">

      {/* Hero Header */}
      <div className="mb-8 md:mb-10">
        <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-[4px] bg-[var(--cyan-ghost)] border border-[rgba(44,192,212,0.25)] text-[11px] font-data text-[var(--cyan-400)] uppercase tracking-wider mb-3">
          <Sparkles className="w-3 h-3" />
          <span>AI-Powered Reverse Engineering</span>
        </div>
        <h1 className="text-[32px] sm:text-[40px] md:text-[44px] font-bold tracking-tight text-[var(--g-100)] leading-[1.08] mb-3">
          Turn a part image into <span className="text-[var(--cyan-400)]">CAD-ready geometry</span>.
        </h1>
        <p className="text-[15px] sm:text-[16px] text-[var(--g-300)] max-w-[720px] leading-relaxed">
          Upload a mechanical part image, provide one known dimension, and generate a scaled CAD drawing with exact closed contours and detected internal holes.
        </p>
      </div>

      {/* Workflow Explainer Banner */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-8">
        {[
          { step: '01', title: 'Upload Image', desc: 'Flat mechanical part photo or CAD drawing' },
          { step: '02', title: 'Known Dimension', desc: 'Single reference measurement for scaling' },
          { step: '03', title: 'Generate CAD', desc: 'Autonomous contour and hole extraction' },
          { step: '04', title: 'Export Outputs', desc: 'Standard 2D DXF and 3D STL files' },
        ].map((item, idx) => (
          <div
            key={idx}
            className="p-3.5 rounded-[6px] bg-[var(--surface)] border border-[var(--g-700)] flex flex-col justify-between shadow-sm relative overflow-hidden"
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-data font-bold text-[var(--cyan-400)]">{item.step}</span>
              <div className="w-1.5 h-1.5 rounded-full bg-[var(--g-600)]" />
            </div>
            <div>
              <div className="text-[13px] font-semibold text-[var(--g-100)] leading-snug">{item.title}</div>
              <div className="text-[11px] text-[var(--g-400)] mt-0.5 leading-snug">{item.desc}</div>
            </div>
          </div>
        ))}
      </div>

      {/* Main Grid: Upload & Controls + Live Summary Card */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-6 items-start">

        {/* Left Column: Form Steps */}
        <div className="flex flex-col gap-6">

          {/* Error Banner */}
          {errorMsg && (
            <div className="p-3.5 rounded-[6px] bg-[var(--surface)] border border-[rgba(244,112,94,0.4)] border-l-4 border-l-[var(--red-400)] flex items-start gap-3 shadow-sm">
              <AlertCircle className="w-5 h-5 text-[var(--red-400)] shrink-0 mt-0.5" />
              <div className="text-[13px] text-[var(--g-200)] flex-1 leading-snug">
                <strong className="block text-[var(--red-400)] font-semibold mb-0.5">Input Requirement</strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Step 1: Upload Part Image */}
          <section className="p-5 sm:p-6 rounded-[8px] bg-[var(--surface)] border border-[var(--g-700)] shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-[var(--cyan-500)] text-[var(--cyan-ink)] font-data font-bold text-[12px] flex items-center justify-center">
                  1
                </span>
                <div>
                  <h2 className="text-[17px] font-semibold text-[var(--g-100)]">Part Image</h2>
                  <p className="text-[12px] text-[var(--g-400)]">Upload a flat-lay photo or white CAD fixture</p>
                </div>
              </div>
              {hasValidFile && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-[4px] bg-[var(--cyan-ghost)] text-[var(--cyan-400)] text-[11px] font-data font-medium border border-[rgba(44,192,212,0.3)]">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Ready
                </span>
              )}
            </div>

            {/* Dropzone or Preview */}
            {!selectedFile ? (
              <div
                className={`dropzone cursor-pointer p-8 transition-all relative rounded-[6px] ${
                  isDragOver ? 'border-[var(--cyan-400)] bg-[var(--cyan-ghost)]' : ''
                }`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
              >
                <input
                  type="file"
                  hidden
                  ref={fileInputRef}
                  onChange={(e) => handleFiles(e.target.files)}
                  accept="image/jpeg,image/png,image/webp"
                />
                <div className="w-12 h-12 rounded-full bg-[var(--cyan-ghost)] border border-[rgba(44,192,212,0.3)] flex items-center justify-center text-[var(--cyan-400)] mb-3">
                  <UploadCloud className="w-6 h-6" />
                </div>
                <div className="text-[15px] font-semibold text-[var(--g-100)] text-center mb-1">
                  Drag & drop your part image here
                </div>
                <p className="text-[12px] text-[var(--g-400)] text-center mb-4">
                  Supports PNG, JPG, or WebP up to 20MB
                </p>
                <button
                  type="button"
                  className="px-4 py-2 rounded-[4px] bg-[var(--g-800)] hover:bg-[var(--g-700)] text-[var(--g-100)] text-[13px] font-medium border border-[var(--g-600)] transition-colors shadow-sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    fileInputRef.current?.click();
                  }}
                >
                  Browse Image
                </button>
              </div>
            ) : (
              <div className="border border-[var(--g-700)] rounded-[6px] p-4 bg-[var(--g-850)] flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
                <div className="flex items-center gap-3.5 min-w-0">
                  <div className="w-16 h-16 rounded-[4px] border border-[var(--g-700)] overflow-hidden bg-white shrink-0 flex items-center justify-center">
                    <img
                      src={selectedFile.preview}
                      alt="Part preview"
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="font-semibold text-[14px] text-[var(--g-100)] truncate">
                      {selectedFile.file.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[11px] font-data text-[var(--g-400)]">
                      <span>{(selectedFile.file.size / 1024).toFixed(1)} KB</span>
                      {selectedFile.width && selectedFile.height && (
                        <>
                          <span>•</span>
                          <span className="text-[var(--cyan-400)]">{selectedFile.width} × {selectedFile.height} px</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="px-3 py-1.5 rounded-[4px] bg-[var(--g-800)] hover:bg-[var(--g-700)] text-[var(--g-100)] text-[12px] font-medium border border-[var(--g-600)] transition-colors"
                  >
                    Change Image
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUiFiles([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    className="px-3 py-1.5 rounded-[4px] text-[var(--red-400)] hover:bg-[var(--red-ghost)] text-[12px] font-medium transition-colors"
                  >
                    Remove
                  </button>
                </div>
              </div>
            )}

            <div className="mt-3 flex items-center gap-2 text-[11px] text-[var(--g-400)] font-data">
              <span className="text-[var(--cyan-400)] font-bold">PRO TIP:</span>
              <span>For highest accuracy, use a flat part on a solid white or contrasting background.</span>
            </div>
          </section>

          {/* Step 2: Reference Dimension & Material */}
          <section className="p-5 sm:p-6 rounded-[8px] bg-[var(--surface)] border border-[var(--g-700)] shadow-sm">
            <div className="flex items-center gap-3 mb-4">
              <span className="w-7 h-7 rounded-full bg-[var(--cyan-500)] text-[var(--cyan-ink)] font-data font-bold text-[12px] flex items-center justify-center">
                2
              </span>
              <div>
                <h2 className="text-[17px] font-semibold text-[var(--g-100)]">Known Dimension</h2>
                <p className="text-[12px] text-[var(--g-400)]">
                  Enter one real-world measurement to calibrate pixel scale to engineering units
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="sm:col-span-1">
                <label className="block text-[12px] font-medium text-[var(--g-300)] mb-1.5">
                  Measurement Type
                </label>
                <select
                  value={dimLabel}
                  onChange={(e) => setDimLabel(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[4px] text-[13px] text-[var(--g-100)] focus:border-[var(--cyan-500)] focus:outline-none transition-colors"
                >
                  <option value="Overall width">Overall width</option>
                  <option value="Overall height">Overall height</option>
                  <option value="Overall length">Overall length</option>
                  <option value="Feature dimension">Feature dimension</option>
                </select>
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[12px] font-medium text-[var(--g-300)] mb-1.5">
                  Dimension Value <span className="text-[var(--cyan-400)]">*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={dimValue}
                  onChange={(e) => setDimValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 100"
                  className="w-full h-10 px-3 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[4px] text-[14px] font-data text-[var(--g-100)] text-right focus:border-[var(--cyan-500)] focus:outline-none transition-colors"
                />
              </div>

              <div className="sm:col-span-1">
                <label className="block text-[12px] font-medium text-[var(--g-300)] mb-1.5">
                  Unit
                </label>
                <select
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  className="w-full h-10 px-3 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[4px] text-[13px] font-data text-[var(--g-100)] focus:border-[var(--cyan-500)] focus:outline-none transition-colors"
                >
                  {unitOptions.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Thickness input */}
            <div className="pt-3 border-t border-[var(--g-700)] mt-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="text-[13px] font-medium text-[var(--g-100)]">
                    Extrusion Thickness ({units})
                  </div>
                  <div className="text-[11px] text-[var(--g-400)]">
                    Depth used to extrude the solid 3D STL model
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {[1.0, 3.0, 5.0].map((tVal) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setThickness(tVal)}
                      className={`px-2.5 py-1 rounded-[3px] text-[11px] font-data border transition-colors ${
                        thickness === tVal
                          ? 'bg-[var(--cyan-ghost)] text-[var(--cyan-400)] border-[rgba(44,192,212,0.4)] font-bold'
                          : 'bg-[var(--g-800)] text-[var(--g-300)] border-[var(--g-700)] hover:text-[var(--g-100)]'
                      }`}
                    >
                      {tVal} {units}
                    </button>
                  ))}
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    value={thickness}
                    onChange={(e) => setThickness(e.target.value === '' ? '' : parseFloat(e.target.value))}
                    className="w-20 h-8 px-2 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[4px] text-[12px] font-data text-[var(--g-100)] text-right focus:border-[var(--cyan-500)] focus:outline-none"
                  />
                </div>
              </div>
            </div>
          </section>

          {/* Step 3: Main Call To Action */}
          <section className="p-5 rounded-[8px] bg-[var(--surface)] border border-[var(--g-700)] shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <div className="text-[14px] font-semibold text-[var(--g-100)]">
                Ready to Generate CAD
              </div>
              <div className="text-[12px] text-[var(--g-400)] mt-0.5">
                Produces DXF (2D drawing with CUT/HOLES) & STL (watertight mesh)
              </div>
            </div>

            <Button
              variant="primary"
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit}
              isLoading={createMutation.isPending}
              loadingText="Initializing..."
              className="min-w-[180px] h-11 px-6 text-[14px] font-semibold shadow-md flex items-center justify-center gap-2"
            >
              <span>Generate CAD Drawing</span>
              <ArrowRight className="w-4 h-4" />
            </Button>
          </section>

        </div>

        {/* Right Column: CAD Output Spec Preview */}
        <aside className="p-5 rounded-[8px] bg-[var(--surface)] border border-[var(--g-700)] shadow-sm lg:sticky lg:top-20 flex flex-col gap-5">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--g-700)]">
            <Layers3 className="w-4 h-4 text-[var(--cyan-400)]" />
            <h3 className="font-semibold text-[14px] text-[var(--g-100)]">Export Deliverables</h3>
          </div>

          {/* Deliverables List */}
          <div className="space-y-3 text-[13px]">
            <div className="p-3 rounded-[6px] bg-[var(--g-850)] border border-[var(--g-700)]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[var(--g-100)] flex items-center gap-1.5">
                  <FileCode className="w-4 h-4 text-[var(--cyan-400)]" /> DXF 2D Drawing
                </span>
                <span className="text-[10px] font-data px-1.5 py-0.5 rounded bg-[var(--cyan-ghost)] text-[var(--cyan-400)] border border-[rgba(44,192,212,0.2)]">
                  CAM Ready
                </span>
              </div>
              <p className="text-[11px] text-[var(--g-400)] leading-normal">
                Layered vector profile: <code className="text-[var(--g-300)]">CUT</code> (outer loop) & <code className="text-[var(--g-300)]">HOLES</code> (internal features).
              </p>
            </div>

            <div className="p-3 rounded-[6px] bg-[var(--g-850)] border border-[var(--g-700)]">
              <div className="flex items-center justify-between mb-1">
                <span className="font-semibold text-[var(--g-100)] flex items-center gap-1.5">
                  <Box className="w-4 h-4 text-[var(--cyan-400)]" /> STL 3D Model
                </span>
                <span className="text-[10px] font-data px-1.5 py-0.5 rounded bg-[var(--g-800)] text-[var(--g-300)] border border-[var(--g-700)]">
                  3D Print
                </span>
              </div>
              <p className="text-[11px] text-[var(--g-400)] leading-normal">
                Watertight extruded solid with subtractive hole geometry.
              </p>
            </div>
          </div>

          {/* Validation Checklist */}
          <div className="pt-2 border-t border-[var(--g-700)] space-y-2">
            <div className="text-[11px] font-data uppercase tracking-wider text-[var(--g-400)] mb-1">
              Readiness Checklist
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              {hasValidFile ? (
                <Check className="w-3.5 h-3.5 text-[var(--cyan-400)]" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-[var(--g-600)]" />
              )}
              <span className={hasValidFile ? 'text-[var(--g-200)]' : 'text-[var(--g-500)]'}>
                Part image uploaded
              </span>
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              {hasValidDimension ? (
                <Check className="w-3.5 h-3.5 text-[var(--cyan-400)]" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-[var(--g-600)]" />
              )}
              <span className={hasValidDimension ? 'text-[var(--g-200)]' : 'text-[var(--g-500)]'}>
                Reference scale dimension set ({dimValue || 0} {units})
              </span>
            </div>

            <div className="flex items-center gap-2 text-[12px]">
              {hasValidThickness ? (
                <Check className="w-3.5 h-3.5 text-[var(--cyan-400)]" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-[var(--g-600)]" />
              )}
              <span className={hasValidThickness ? 'text-[var(--g-200)]' : 'text-[var(--g-500)]'}>
                Extrusion thickness set ({thickness || 0} {units})
              </span>
            </div>
          </div>

          <div className="p-3 rounded-[4px] bg-[var(--g-850)] border border-[var(--g-700)] text-[11px] text-[var(--g-400)] leading-relaxed">
            <strong className="text-[var(--g-200)] block mb-0.5">Engineering Note</strong>
            CADVision extracts contours using classical computer vision. Verify critical tolerances before machining.
          </div>
        </aside>

      </div>
    </div>
  );
}
