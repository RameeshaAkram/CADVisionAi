import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createJob, startProcessing, type KnownDimension } from '../api/jobs';
import { Button } from '../components/ui/Button';
import { Field, Label } from '../components/ui/Field';
import { Tabs, Tab } from '../components/ui/Tabs';
import { unitOptions } from '../lib/units';
import { X } from 'lucide-react';

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
  const [units, setUnits] = useState('ft');
  
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
      const resp = await createJob(mode, units, dimensions, validFiles);
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

  const canSubmit = uiFiles.filter(f => f.status !== 'rejected').length > 0 && dimensions.some(d => d.value > 0) && !!units;
  const isSubmitting = createMutation.isPending;

  return (
    <div className="max-w-[960px] mx-auto w-full p-4 md:p-8">
      <h1 className="text-[28px] font-semibold leading-[34px] tracking-[-0.02em] mb-3">New reconstruction</h1>
      <p className="text-[16px] leading-[25px] max-w-[70ch] mb-8 text-[var(--g-100)]">
        Upload photos or a video of the object, then tell us one real measurement so we can scale the model.
      </p>

      <Tabs className="mb-6">
        <Tab selected={mode === 'photo'} onClick={() => handleModeSwitch('photo')}>Photos</Tab>
        <Tab selected={mode === 'video'} onClick={() => handleModeSwitch('video')}>Video</Tab>
      </Tabs>

      <div 
        className="border border-dashed border-[var(--g-600)] rounded-[6px] bg-[var(--g-900)] p-[44px_20px] text-center transition-all duration-140 ease-out hover:border-[var(--cyan-500)] hover:bg-[rgba(44,192,212,0.04)] cursor-pointer mb-4"
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
        <b className="font-semibold text-[15px] leading-[22px] block text-[var(--g-100)]">
          {mode === 'photo' ? 'Drop photos here, or browse' : 'Drop a video here, or browse'}
        </b>
        <span className="font-normal text-[12px] leading-[18px] font-data text-[var(--g-500)] mt-1 block">
          {mode === 'photo' ? 'JPG, PNG, or WebP · as many views as you have' : 'MP4, MOV, or WebM · one clip from multiple angles'}
        </span>
      </div>
      
      <p className="text-[12px] leading-[18px] text-[var(--g-300)] text-center mb-8">
        Walk around the part and shoot the sides and top. One slow orbit video also works. Enter a height or width you can measure with a tape.
      </p>

      {uiFiles.length > 0 && (
        <div className="flex gap-2 mb-8 items-center flex-wrap">
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

      {errorMsg && (
        <div className="bg-[var(--g-850)] border border-[rgba(224,73,47,0.35)] border-l-[2px] border-l-[var(--red-400)] rounded-[4px] p-3 flex gap-2.5 items-start mb-8">
          <span className="text-[var(--red-400)] font-semibold text-[13px] leading-[17px]">○</span>
          <div>
            <b className="font-semibold text-[13px] leading-[17px] text-[var(--red-400)] block">{errorMsg}</b>
          </div>
        </div>
      )}

      <h2 className="text-[20px] font-semibold leading-[26px] tracking-[-0.012em] mt-8 mb-4">Known dimension</h2>
      
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

      <div className="flex items-center gap-3.5 mt-7">
        <Button 
          variant="primary" 
          onClick={() => createMutation.mutate()} 
          disabled={!canSubmit || isSubmitting}
          isLoading={isSubmitting}
          loadingText="Starting..."
          className="min-w-[140px]"
        >
          Start processing
        </Button>
        {!canSubmit && !isSubmitting && (
          <span className="text-[11px] leading-[14px] text-[var(--g-500)]">
            Add at least one {mode === 'photo' ? 'photo' : 'video'} and one known dimension &gt; 0
          </span>
        )}
      </div>
    </div>
  );
}
