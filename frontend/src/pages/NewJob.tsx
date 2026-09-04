import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createJob, startProcessing, type KnownDimension } from '../api/jobs';
import { Button } from '../components/ui/Button';
import { Field, Label } from '../components/ui/Field';
import { Tabs, Tab } from '../components/ui/Tabs';
import { unitOptions } from '../lib/units';
import { X, UploadCloud, Ruler, Layers3, ArrowRight } from 'lucide-react';

interface UIFile {
  file: File;
  preview: string;
  status: 'usable' | 'warning' | 'rejected';
}

export default function NewJob() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<'photo' | 'video'>('photo');
  const [uiFiles, setUiFiles] = useState<UIFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const [dimensions, setDimensions] = useState<KnownDimension[]>([{ label: 'Overall height', value: 0 }]);
  const [units, setUnits] = useState('mm');
  const [thickness, setThickness] = useState(0);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    return () => {
      uiFiles.forEach(f => URL.revokeObjectURL(f.preview));
    };
  }, [uiFiles]);

  const validateFile = (file: File): 'usable' | 'warning' | 'rejected' => {
    if (mode === 'photo') {
      if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return 'rejected';
      if (file.size > 20 * 1024 * 1024) return 'warning'; // over 20MB is a warning/rejected? Prompt: "up to 20MB" 
      return 'usable';
    } else {
      if (!['video/mp4', 'video/quicktime', 'video/webm'].includes(file.type)) return 'rejected';
      return 'usable';
    }
  };

  const handleFiles = (newFiles: FileList | null) => {
    if (!newFiles) return;
    setErrorMsg(null);
    const filesArray = Array.from(newFiles);
    
    // Video mode allows exactly one video
    if (mode === 'video' && filesArray.length > 0) {
      const f = filesArray[0];
      const status = validateFile(f);
      if (status === 'rejected') {
        setErrorMsg('MP4, MOV, and WebM only.');
        return;
      }
      setUiFiles([{ file: f, preview: URL.createObjectURL(f), status }]);
      return;
    }

    // Photo mode
    const toAdd: UIFile[] = [];
    let rejectedCount = 0;
    filesArray.forEach(f => {
      const status = validateFile(f);
      if (status === 'rejected') {
        rejectedCount++;
      } else {
        toAdd.push({ file: f, preview: URL.createObjectURL(f), status });
      }
    });

    if (rejectedCount > 0) {
      setErrorMsg('PNG, JPG, and WebP only. Some files were not uploaded.');
    }
    setUiFiles(prev => [...prev, ...toAdd]);
  };

  const handleModeSwitch = (newMode: 'photo' | 'video') => {
    if (uiFiles.length > 0) {
      if (!window.confirm('Switching modes will clear your current files. Continue?')) return;
      setUiFiles([]);
    }
    setMode(newMode);
    setErrorMsg(null);
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const validFiles = uiFiles.filter(f => f.status !== 'rejected').map(f => f.file);
      const resp = await createJob(mode, units, dimensions, thickness, validFiles);
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

  const canSubmit = uiFiles.filter(f => f.status !== 'rejected').length > 0 && dimensions.some(d => d.value > 0) && thickness > 0 && !!units;
  const isSubmitting = createMutation.isPending;

  return (
    <div className="max-w-[1180px] mx-auto w-full px-5 py-8 md:px-10 md:py-12">
      <div className="page-intro mb-9">
        <div className="eyebrow mb-3">CADVision AI / New job</div>
        <h1 className="text-[34px] md:text-[42px] font-semibold leading-[1.05] tracking-[-0.03em] mb-4">Turn reference photos into a CAD starting point.</h1>
        <p className="text-[16px] leading-[25px] text-[var(--g-300)]">Upload a clean view, add a measured reference, and receive a scaled DXF profile plus an extruded STL for review.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-5 items-start">
        <div className="flex flex-col gap-4">
          <section className="step-card step-card-active p-5 md:p-6">
            <div className="flex items-start gap-3 mb-5"><span className="step-number">01</span><div><h2 className="text-[18px] font-semibold">Add reference media</h2><p className="text-[13px] text-[var(--g-400)] mt-1">Use photos for flat parts. Multiple angles improve the outline.</p></div></div>

      <Tabs className="mb-5">
        <Tab selected={mode === 'photo'} onClick={() => handleModeSwitch('photo')}>Photos</Tab>
        <Tab selected={mode === 'video'} onClick={() => handleModeSwitch('video')}>Video</Tab>
      </Tabs>

      <div 
        className="dropzone cursor-pointer"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => { e.preventDefault(); handleFiles(e.dataTransfer.files); }}
      >
        <input 
          type="file" 
          hidden 
          multiple={mode === 'photo'} 
          ref={fileInputRef} 
          onChange={(e) => handleFiles(e.target.files)} 
          accept={mode === 'photo' ? "image/jpeg,image/png,image/webp" : "video/mp4,video/quicktime,video/webm"}
        />
        <div className="dropzone-icon"><UploadCloud className="w-5 h-5" /></div>
        <b className="font-semibold text-[16px] leading-[22px] block text-[var(--g-100)]">
          {mode === 'photo' ? 'Drop photos here, or browse' : 'Drop a video here, or browse'}
        </b>
        <span className="font-normal text-[12px] leading-[18px] font-data text-[var(--g-400)] mt-2 block">
          {mode === 'photo' ? 'JPG, PNG, or WebP · as many views as you have' : 'MP4, MOV, or WebM · one clip from multiple angles'}
        </span>
      </div>
      
      <p className="text-[12px] leading-[18px] text-[var(--g-400)] text-center mt-3">Best results: even lighting, plain background, camera parallel to the part.</p>

      {uiFiles.length > 0 && (
        <div className="flex gap-3 mt-5 items-center flex-wrap">
          <div className="flex gap-1.5 flex-wrap">
            {uiFiles.map((uf, i) => (
              <div key={i} className="w-[52px] h-[52px] bg-[var(--g-800)] border border-[var(--g-700)] rounded-[3px] relative overflow-hidden flex-shrink-0 group">
                {mode === 'photo' ? (
                  <img src={uf.preview} alt="" className="w-full h-full object-cover opacity-80" />
                ) : (
                  <video src={uf.preview} className="w-full h-full object-cover opacity-80" />
                )}
                <div className="absolute bottom-[3px] right-[4px] text-[11px] font-data leading-none drop-shadow-md">
                  {uf.status === 'usable' && <span className="text-[var(--cyan-400)]">●</span>}
                  {uf.status === 'warning' && <span className="text-[var(--amber-400)]">◐</span>}
                  {uf.status === 'rejected' && <span className="text-[var(--red-400)]">○</span>}
                </div>
                <button 
                  onClick={(e) => { e.stopPropagation(); setUiFiles(uiFiles.filter((_, idx) => idx !== i)); }}
                  className="absolute inset-0 bg-black/50 text-white items-center justify-center hidden group-hover:flex"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
          <div className="ml-3 font-data text-[12px] leading-[19px] text-[var(--g-400)]">
            {uiFiles.length} file{uiFiles.length !== 1 && 's'} · 
            <span className="text-[var(--cyan-400)] ml-1">{uiFiles.filter(f => f.status === 'usable').length} usable</span>
            {uiFiles.some(f => f.status === 'warning') && <span className="text-[var(--amber-400)] ml-1">· {uiFiles.filter(f => f.status === 'warning').length} soft warning</span>}
            {uiFiles.some(f => f.status === 'rejected') && <span className="text-[var(--red-400)] ml-1">· {uiFiles.filter(f => f.status === 'rejected').length} rejected</span>}
          </div>
        </div>
      )}
          </section>

      {errorMsg && (
        <div className="bg-[var(--g-850)] border border-[rgba(224,73,47,0.35)] border-l-[2px] border-l-[var(--red-400)] rounded-[4px] p-3 flex gap-2.5 items-start mb-8">
          <span className="text-[var(--red-400)] font-semibold text-[13px] leading-[17px]">○</span>
          <div>
            <b className="font-semibold text-[13px] leading-[17px] text-[var(--red-400)] block">{errorMsg}</b>
          </div>
        </div>
      )}

          <section className="step-card p-5 md:p-6">
        <div className="flex items-start gap-3 mb-5"><span className="step-number">02</span><div><h2 className="text-[18px] font-semibold">Set scale and thickness</h2><p className="text-[13px] text-[var(--g-400)] mt-1">At least one measured dimension anchors the generated profile.</p></div></div>
      
      {dimensions.map((dim, idx) => (
        <div key={idx} className="grid grid-cols-1 sm:grid-cols-[1.4fr_0.8fr_0.8fr_auto] gap-2.5 items-end max-w-[640px] mb-3">
          <div>
            <Label>Measurement</Label>
            <select 
              className="field h-[36px] w-full px-2.5 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[3px] text-[var(--g-100)]"
              value={dim.label}
              onChange={e => {
                const newDims = [...dimensions];
                newDims[idx].label = e.target.value;
                setDimensions(newDims);
              }}
            >
              <option>Overall height</option>
              <option>Overall width</option>
              <option>Overall length</option>
              <option>Other</option>
            </select>
          </div>
          <div>
            <Label>Value</Label>
            <Field 
              numeric 
              type="number" 
              step="any"
              min="0"
              value={dim.value || ''}
              onChange={e => {
                const newDims = [...dimensions];
                newDims[idx].value = parseFloat(e.target.value) || 0;
                setDimensions(newDims);
              }}
            />
          </div>
          <div>
            <Label>Unit</Label>
            <select 
              className="field h-[36px] w-full px-2.5 bg-[var(--g-800)] border border-[var(--g-700)] rounded-[3px] text-[var(--g-100)]"
              value={units}
              onChange={e => setUnits(e.target.value)}
            >
              {unitOptions.map(u => (
                <option key={u.value} value={u.value}>{u.label}</option>
              ))}
            </select>
          </div>
          {idx === dimensions.length - 1 && (
            <Button variant="ghost" onClick={() => setDimensions([...dimensions, { label: 'Other', value: 0 }])}>
              + Add another
            </Button>
          )}
        </div>
      ))}
      <div className="text-[11px] leading-[14px] text-[var(--g-500)] mt-1.5 mb-7">
        One measurement is required. Two or more improves accuracy.
      </div>

      <div className="max-w-[220px] mb-7">
        <Label>Material thickness ({unitOptions.find(u => u.value === units)?.label || units})</Label>
        <Field
          numeric
          type="number"
          step="any"
          min="0"
          value={thickness || ''}
          onChange={e => setThickness(parseFloat(e.target.value) || 0)}
        />
        <div className="text-[11px] leading-[14px] text-[var(--g-500)] mt-1.5">
          Used to create the 3D STL extrusion.
        </div>
      </div>
          </section>

          <section className="step-card p-5 md:p-6 flex flex-col sm:flex-row sm:items-center gap-4 justify-between">
            <div><div className="eyebrow mb-1">03 / Generate</div><div className="text-[14px] text-[var(--g-300)]">Creates a reviewable DXF and STL from the visible profile.</div></div>
      <div className="flex items-center gap-3">
        <Button 
          variant="primary" 
          onClick={() => createMutation.mutate()} 
          disabled={!canSubmit || isSubmitting}
          isLoading={isSubmitting}
          loadingText="Starting..."
          className="min-w-[140px]"
        >
          Generate CAD <ArrowRight className="w-4 h-4" />
        </Button>
        {!canSubmit && !isSubmitting && (
          <span className="text-[11px] leading-[14px] text-[var(--g-500)]">
            Add an input file, dimension, and material thickness &gt; 0
          </span>
        )}
      </div>
          </section>
        </div>

        <aside className="step-card p-5 lg:sticky lg:top-6">
          <div className="flex items-center gap-2 mb-5"><Layers3 className="w-4 h-4 text-[var(--cyan-400)]" /><h2 className="font-semibold">Output preview</h2></div>
          <div className="border border-[var(--g-700)] bg-[var(--g-950)] p-4 mb-5">
            <div className="flex items-center justify-between mb-3"><span className="text-[12px] text-[var(--g-400)]">Profile status</span><span className="status-pill"><span className="status-dot text-[var(--g-500)]" /> Waiting for input</span></div>
            <div className="h-[112px] border border-dashed border-[var(--g-700)] flex items-center justify-center text-[var(--g-500)]"><Ruler className="w-5 h-5" /></div>
          </div>
          <div className="flex flex-col gap-3 text-[13px]">
            <div className="flex justify-between"><span className="text-[var(--g-400)]">2D profile</span><span className="font-data text-[var(--g-300)]">DXF</span></div>
            <div className="flex justify-between"><span className="text-[var(--g-400)]">Solid preview</span><span className="font-data text-[var(--g-300)]">STL</span></div>
            <div className="section-rule pt-3 text-[12px] leading-[18px] text-[var(--amber-400)]">Generated geometry is an approximation. Verify dimensions before fabrication.</div>
          </div>
        </aside>
      </div>
    </div>
  );
}
