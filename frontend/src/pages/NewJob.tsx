import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { createJob, startProcessing, type KnownDimension } from '../api/jobs';
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
  Check,
  Ruler,
  Trash2,
  RefreshCw,
  Cpu,
  Layers,
  HelpCircle,
  Sliders
} from 'lucide-react';

interface UIFile {
  file: File;
  preview: string;
  status: 'usable' | 'warning' | 'rejected';
  width?: number;
  height?: number;
}

interface BenchmarkSample {
  name: string;
  label: string;
  sublabel: string;
  url: string;
  dimLabel: string;
  dimValue: number;
  units: string;
  thickness: number;
}

const BENCHMARK_SAMPLES: BenchmarkSample[] = [
  {
    name: 'test_mixed_hole_sizes.png',
    label: '4-Hole Plate',
    sublabel: '140 × 90 mm (4 variable holes)',
    url: '/samples/test_mixed_hole_sizes.png',
    dimLabel: 'Overall width',
    dimValue: 140,
    units: 'mm',
    thickness: 3.0,
  },
  {
    name: 'bracket.png',
    label: 'Angle Bracket',
    sublabel: '100 × 50 mm (Mounting bracket)',
    url: '/samples/bracket.png',
    dimLabel: 'Overall width',
    dimValue: 100,
    units: 'mm',
    thickness: 3.0,
  },
  {
    name: 'mounting_plate.png',
    label: 'Mounting Plate',
    sublabel: '120 × 80 mm (Dual-mount)',
    url: '/samples/mounting_plate.png',
    dimLabel: 'Overall width',
    dimValue: 120,
    units: 'mm',
    thickness: 4.0,
  },
];

export default function NewJob() {
  const navigate = useNavigate();
  const [mode] = useState<'photo'>('photo');
  const [uiFiles, setUiFiles] = useState<UIFile[]>([]);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isDragOver, setIsDragOver] = useState(false);
  const [isLoadingSample, setIsLoadingSample] = useState(false);

  // Single clear reference dimension
  const [dimLabel, setDimLabel] = useState('Overall width');
  const [dimValue, setDimValue] = useState<number | ''>(140);
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
      setUiFiles(toAdd);
    }
  };

  const handleLoadSample = async (sample: BenchmarkSample) => {
    try {
      setIsLoadingSample(true);
      setErrorMsg(null);
      const resp = await fetch(sample.url);
      if (!resp.ok) throw new Error(`Could not load sample from ${sample.url}`);
      const blob = await resp.blob();
      const file = new File([blob], sample.name, { type: 'image/png' });
      const previewUrl = URL.createObjectURL(file);

      const img = new Image();
      img.onload = () => {
        setUiFiles([{
          file,
          preview: previewUrl,
          status: 'usable',
          width: img.naturalWidth,
          height: img.naturalHeight,
        }]);
      };
      img.src = previewUrl;

      setDimLabel(sample.dimLabel);
      setDimValue(sample.dimValue);
      setUnits(sample.units);
      setThickness(sample.thickness);
    } catch (err: any) {
      setErrorMsg(`Failed to load benchmark sample: ${err.message}`);
    } finally {
      setIsLoadingSample(false);
    }
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const validFiles = uiFiles.filter(f => f.status !== 'rejected').map(f => f.file);
      if (validFiles.length === 0) throw new Error('Please upload or select a part image.');
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

  // Live scale calculation estimate
  const numericDim = typeof dimValue === 'number' ? dimValue : parseFloat(String(dimValue)) || 0;
  const targetPixelLength = selectedFile?.width && selectedFile?.height
    ? (dimLabel.toLowerCase().includes('height') ? selectedFile.height : selectedFile.width)
    : null;
  const estimatedScale = targetPixelLength && numericDim > 0
    ? (numericDim / targetPixelLength)
    : null;

  return (
    <div style={{ maxWidth: '1240px', margin: '0 auto', padding: '32px 24px', width: '100%' }}>

      {/* Hero Header Section */}
      <div style={{ marginBottom: '32px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '5px 14px',
            borderRadius: '999px',
            backgroundColor: 'rgba(11,166,190,0.1)',
            border: '1px solid rgba(11,166,190,0.3)',
            color: '#087F95',
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            fontWeight: 600,
            letterSpacing: '0.08em',
            textTransform: 'uppercase'
          }}>
            <Sparkles size={13} style={{ color: '#0BA6BE' }} />
            <span>AI-POWERED REVERSE ENGINEERING</span>
          </div>

          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '4px 10px',
            borderRadius: '4px',
            backgroundColor: '#F8FBFC',
            border: '1px solid #D4E0E5',
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            color: '#71838C'
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#0BA6BE' }} />
            <span>ENGINEERING SPEC R2024</span>
          </div>
        </div>

        <h1 style={{
          fontSize: '36px',
          fontWeight: 700,
          letterSpacing: '-0.025em',
          lineHeight: 1.15,
          color: '#172830',
          margin: '0 0 10px 0'
        }}>
          Turn a part image into <span style={{ color: '#0BA6BE' }}>CAD-ready geometry</span>.
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#53656E',
          maxWidth: '780px',
          lineHeight: 1.6,
          margin: 0
        }}>
          Upload an orthographic mechanical part image, specify one calibrated reference dimension, and autonomously generate scaled 2D AutoCAD DXF vector drawings with detected hole primitives and 3D STL solids.
        </p>
      </div>

      {/* Connected Linear Stepper / Pipeline Progress */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
        gap: '12px',
        marginBottom: '28px'
      }}>
        {[
          {
            step: '01',
            title: 'Upload Part',
            desc: hasValidFile ? `${selectedFile.file.name.slice(0, 18)}...` : 'Orthographic photo or drawing',
            active: true,
            done: hasValidFile,
            icon: UploadCloud,
          },
          {
            step: '02',
            title: 'Reference Scale',
            desc: hasValidDimension ? `${dimValue} ${units} (${dimLabel})` : 'Calibrate pixel-to-millimeter ratio',
            active: hasValidFile,
            done: hasValidFile && hasValidDimension,
            icon: Ruler,
          },
          {
            step: '03',
            title: 'CAD Generation',
            desc: 'Contour closure & hole circle fitting',
            active: hasValidFile && hasValidDimension,
            done: false,
            icon: Cpu,
          },
          {
            step: '04',
            title: 'CAM & 3D Deliverables',
            desc: 'AutoCAD DXF layers & STL watertight mesh',
            active: false,
            done: false,
            icon: Layers,
          },
        ].map((item, idx) => {
          const Icon = item.icon;
          return (
            <div
              key={idx}
              style={{
                padding: '16px',
                borderRadius: '8px',
                backgroundColor: item.done ? '#FFFFFF' : item.active ? '#FFFFFF' : '#F8FBFC',
                border: item.done ? '1px solid rgba(11,166,190,0.45)' : item.active ? '1px solid #B8C9D0' : '1px solid #D4E0E5',
                boxShadow: item.done || item.active ? '0 2px 8px rgba(23,40,48,0.04)' : 'none',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
                gap: '12px',
                position: 'relative'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  letterSpacing: '0.05em',
                  color: item.done || item.active ? '#0BA6BE' : '#71838C'
                }}>
                  STEP {item.step}
                </span>
                {item.done ? (
                  <div style={{
                    width: '22px',
                    height: '22px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(11,166,190,0.15)',
                    color: '#0BA6BE',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}>
                    <Check size={13} strokeWidth={3} />
                  </div>
                ) : (
                  <Icon size={16} style={{ color: item.active ? '#394B54' : '#71838C' }} />
                )}
              </div>
              <div>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#172830', marginBottom: '3px' }}>
                  {item.title}
                </div>
                <div style={{ fontSize: '12px', color: '#53656E', lineHeight: 1.4 }}>
                  {item.desc}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Main Layout: Form Steps (Left) + Engineering Spec Panel (Right) */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(0, 1.65fr) minmax(320px, 1fr)',
        gap: '24px',
        alignItems: 'start'
      }}>

        {/* Left Column: Interactive Setup Steps */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>

          {/* Error Banner */}
          {errorMsg && (
            <div style={{
              padding: '14px 16px',
              borderRadius: '8px',
              backgroundColor: '#FFFFFF',
              border: '1px solid rgba(244,112,94,0.4)',
              borderLeft: '4px solid #F4705E',
              display: 'flex',
              alignItems: 'start',
              gap: '12px',
              boxShadow: '0 2px 8px rgba(244,112,94,0.08)'
            }}>
              <AlertCircle size={18} style={{ color: '#F4705E', flexShrink: 0, marginTop: '2px' }} />
              <div style={{ fontSize: '13px', color: '#394B54', lineHeight: 1.5 }}>
                <strong style={{ display: 'block', color: '#F4705E', fontWeight: 600, marginBottom: '2px' }}>
                  Input Requirement
                </strong>
                {errorMsg}
              </div>
            </div>
          )}

          {/* Step 1: Upload Part Image */}
          <section style={{
            padding: '24px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #D4E0E5',
            boxShadow: '0 2px 10px rgba(23,40,48,0.04)',
            position: 'relative'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{
                  width: '28px',
                  height: '28px',
                  borderRadius: '50%',
                  backgroundColor: '#0BA6BE',
                  color: '#FFFFFF',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 700,
                  fontSize: '13px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 6px rgba(11,166,190,0.3)'
                }}>
                  1
                </div>
                <div>
                  <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#172830', margin: 0 }}>
                    Part Image
                  </h2>
                  <p style={{ fontSize: '12px', color: '#53656E', margin: '2px 0 0 0' }}>
                    Upload an orthographic photo, flat-lay scan, or mechanical diagram
                  </p>
                </div>
              </div>

              {hasValidFile && (
                <span style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(11,166,190,0.12)',
                  color: '#087F95',
                  fontSize: '11px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 500,
                  border: '1px solid rgba(11,166,190,0.3)'
                }}>
                  <CheckCircle2 size={12} /> Ready
                </span>
              )}
            </div>

            {/* Benchmark Quick Pick Buttons */}
            <div style={{
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: '#F8FBFC',
              border: '1px solid #D4E0E5',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px',
                marginBottom: '10px'
              }}>
                <span style={{
                  fontSize: '11px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 600,
                  color: '#394B54',
                  letterSpacing: '0.05em',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px'
                }}>
                  <Sparkles size={13} style={{ color: '#0BA6BE' }} />
                  TRY BENCHMARK PART:
                </span>
                <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: '#71838C' }}>
                  Instant 1-click test geometry
                </span>
              </div>
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
                gap: '8px'
              }}>
                {BENCHMARK_SAMPLES.map((sample) => (
                  <button
                    key={sample.name}
                    type="button"
                    disabled={isLoadingSample}
                    onClick={() => handleLoadSample(sample)}
                    style={{
                      padding: '10px 12px',
                      textAlign: 'left',
                      borderRadius: '6px',
                      backgroundColor: '#FFFFFF',
                      border: '1px solid #D4E0E5',
                      cursor: 'pointer',
                      transition: 'all 0.15s ease'
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.borderColor = '#0BA6BE';
                      e.currentTarget.style.backgroundColor = 'rgba(11,166,190,0.04)';
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.borderColor = '#D4E0E5';
                      e.currentTarget.style.backgroundColor = '#FFFFFF';
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 600, color: '#172830' }}>
                      <span>{sample.label}</span>
                      <ArrowRight size={11} style={{ color: '#0BA6BE' }} />
                    </div>
                    <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: '#53656E', marginTop: '3px' }}>
                      {sample.sublabel}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Dropzone or Loaded Inspection Card */}
            {!selectedFile ? (
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
                onDragLeave={() => setIsDragOver(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDragOver(false);
                  handleFiles(e.dataTransfer.files);
                }}
                style={{
                  position: 'relative',
                  borderRadius: '8px',
                  padding: '36px 20px',
                  border: isDragOver ? '2px dashed #0BA6BE' : '2px dashed #B8C9D0',
                  backgroundColor: isDragOver ? 'rgba(11,166,190,0.08)' : '#FAFCFD',
                  cursor: 'pointer',
                  textAlign: 'center',
                  transition: 'all 0.2s ease',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                <input
                  type="file"
                  hidden
                  ref={fileInputRef}
                  onChange={(e) => handleFiles(e.target.files)}
                  accept="image/jpeg,image/png,image/webp"
                />

                {/* Crosshairs at 4 corners */}
                <span style={{ position: 'absolute', top: '8px', left: '10px', fontSize: '12px', fontFamily: 'var(--font-data)', color: '#B8C9D0', userSelect: 'none' }}>+</span>
                <span style={{ position: 'absolute', top: '8px', right: '10px', fontSize: '12px', fontFamily: 'var(--font-data)', color: '#B8C9D0', userSelect: 'none' }}>+</span>
                <span style={{ position: 'absolute', bottom: '8px', left: '10px', fontSize: '12px', fontFamily: 'var(--font-data)', color: '#B8C9D0', userSelect: 'none' }}>+</span>
                <span style={{ position: 'absolute', bottom: '8px', right: '10px', fontSize: '12px', fontFamily: 'var(--font-data)', color: '#B8C9D0', userSelect: 'none' }}>+</span>

                <div style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(11,166,190,0.1)',
                  border: '1px solid rgba(11,166,190,0.25)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#0BA6BE',
                  marginBottom: '14px'
                }}>
                  <UploadCloud size={28} />
                </div>

                <div style={{ fontSize: '15px', fontWeight: 600, color: '#172830', marginBottom: '4px' }}>
                  Drag & drop your part image here
                </div>
                <p style={{ fontSize: '12px', color: '#53656E', maxWidth: '380px', lineHeight: 1.5, margin: '0 0 16px 0' }}>
                  High-contrast mechanical photos on solid or white backgrounds yield sub-millimeter contour precision.
                </p>

                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '8px 18px',
                  borderRadius: '4px',
                  backgroundColor: '#EDF3F5',
                  border: '1px solid #D4E0E5',
                  color: '#172830',
                  fontSize: '13px',
                  fontWeight: 500,
                  boxShadow: '0 1px 3px rgba(23,40,48,0.06)'
                }}>
                  <FileCode size={15} style={{ color: '#0BA6BE' }} />
                  <span>Browse From Computer</span>
                </div>

                <div style={{
                  marginTop: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  color: '#71838C',
                  letterSpacing: '0.06em',
                  textTransform: 'uppercase'
                }}>
                  <span>PNG</span>
                  <span>•</span>
                  <span>JPG</span>
                  <span>•</span>
                  <span>WEBP</span>
                  <span>•</span>
                  <span>UP TO 20 MB</span>
                </div>
              </div>
            ) : (
              <div style={{
                border: '1px solid #D4E0E5',
                borderRadius: '8px',
                padding: '16px',
                backgroundColor: '#F8FBFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '240px' }}>
                  <div style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '6px',
                    border: '1px solid #D4E0E5',
                    backgroundColor: '#FFFFFF',
                    overflow: 'hidden',
                    padding: '4px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0
                  }}>
                    <img
                      src={selectedFile.preview}
                      alt="Part preview"
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }}
                    />
                  </div>

                  <div>
                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#172830', display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <span>{selectedFile.file.name}</span>
                      <span style={{
                        padding: '2px 6px',
                        borderRadius: '3px',
                        fontSize: '10px',
                        fontFamily: 'var(--font-data)',
                        backgroundColor: 'rgba(11,166,190,0.12)',
                        color: '#087F95',
                        border: '1px solid rgba(11,166,190,0.25)'
                      }}>
                        LOADED
                      </span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px', fontSize: '11px', fontFamily: 'var(--font-data)', color: '#53656E' }}>
                      <span>{(selectedFile.file.size / 1024).toFixed(1)} KB</span>
                      {selectedFile.width && selectedFile.height && (
                        <>
                          <span>•</span>
                          <span style={{ color: '#172830', fontWeight: 500 }}>{selectedFile.width} × {selectedFile.height} px</span>
                          <span>•</span>
                          <span style={{ color: '#087F95' }}>{(selectedFile.width / selectedFile.height).toFixed(2)}:1 Ratio</span>
                        </>
                      )}
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '6px', fontSize: '11px', fontFamily: 'var(--font-data)', color: '#087F95' }}>
                      <CheckCircle2 size={13} style={{ color: '#0BA6BE' }} />
                      <span>Orthographic silhouette ready for contour extraction</span>
                    </div>
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      backgroundColor: '#EDF3F5',
                      border: '1px solid #D4E0E5',
                      color: '#172830',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    <RefreshCw size={12} />
                    <span>Change</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setUiFiles([]);
                      if (fileInputRef.current) fileInputRef.current.value = '';
                    }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 12px',
                      borderRadius: '4px',
                      backgroundColor: 'transparent',
                      border: '1px solid transparent',
                      color: '#F4705E',
                      fontSize: '12px',
                      fontWeight: 500,
                      cursor: 'pointer'
                    }}
                  >
                    <Trash2 size={12} />
                    <span>Remove</span>
                  </button>
                </div>
              </div>
            )}
          </section>

          {/* Step 2: Reference Dimension & Scale Calibration */}
          <section style={{
            padding: '24px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #D4E0E5',
            boxShadow: '0 2px 10px rgba(23,40,48,0.04)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: '#0BA6BE',
                color: '#FFFFFF',
                fontFamily: 'var(--font-data)',
                fontWeight: 700,
                fontSize: '13px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(11,166,190,0.3)'
              }}>
                2
              </div>
              <div>
                <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#172830', margin: 0 }}>
                  Known Reference Dimension
                </h2>
                <p style={{ fontSize: '12px', color: '#53656E', margin: '2px 0 0 0' }}>
                  Set one known real-world measurement to calibrate pixel coordinates to precise CNC units
                </p>
              </div>
            </div>

            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500, color: '#394B54', marginBottom: '6px' }}>
                  <span>Measurement Axis</span>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: '#71838C' }}>REQUIRED</span>
                </label>
                <select
                  value={dimLabel}
                  onChange={(e) => setDimLabel(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    backgroundColor: '#EDF3F5',
                    border: '1px solid #D4E0E5',
                    borderRadius: '4px',
                    fontSize: '13px',
                    color: '#172830',
                    outline: 'none'
                  }}
                >
                  <option value="Overall width">Overall width (X-axis)</option>
                  <option value="Overall height">Overall height (Y-axis)</option>
                  <option value="Overall length">Overall length</option>
                  <option value="Feature dimension">Feature dimension</option>
                </select>
              </div>

              <div>
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '12px', fontWeight: 500, color: '#394B54', marginBottom: '6px' }}>
                  <span>Dimension Value</span>
                  <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: '#087F95', fontWeight: 700 }}>*</span>
                </label>
                <input
                  type="number"
                  step="any"
                  min="0.001"
                  value={dimValue}
                  onChange={(e) => setDimValue(e.target.value === '' ? '' : parseFloat(e.target.value))}
                  placeholder="e.g. 140"
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    backgroundColor: '#EDF3F5',
                    border: '1px solid #D4E0E5',
                    borderRadius: '4px',
                    fontSize: '14px',
                    fontFamily: 'var(--font-data)',
                    color: '#172830',
                    textAlign: 'right',
                    outline: 'none'
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#394B54', marginBottom: '6px' }}>
                  Engineering Unit
                </label>
                <select
                  value={units}
                  onChange={(e) => setUnits(e.target.value)}
                  style={{
                    width: '100%',
                    height: '40px',
                    padding: '0 12px',
                    backgroundColor: '#EDF3F5',
                    border: '1px solid #D4E0E5',
                    borderRadius: '4px',
                    fontSize: '13px',
                    fontFamily: 'var(--font-data)',
                    color: '#172830',
                    outline: 'none'
                  }}
                >
                  {unitOptions.map(u => (
                    <option key={u.value} value={u.value}>{u.label}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Extrusion Thickness Section */}
            <div style={{
              paddingTop: '16px',
              borderTop: '1px solid #D4E0E5'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 500, color: '#172830', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Box size={14} style={{ color: '#0BA6BE' }} />
                    <span>Extrusion Thickness ({units})</span>
                  </div>
                  <div style={{ fontSize: '11px', color: '#53656E', marginTop: '2px' }}>
                    Solid Z-extrusion depth for the generated 3D STL mesh
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {[1.0, 2.0, 3.0, 5.0].map((tVal) => (
                    <button
                      key={tVal}
                      type="button"
                      onClick={() => setThickness(tVal)}
                      style={{
                        padding: '5px 10px',
                        borderRadius: '4px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-data)',
                        border: thickness === tVal ? '1px solid rgba(11,166,190,0.45)' : '1px solid #D4E0E5',
                        backgroundColor: thickness === tVal ? 'rgba(11,166,190,0.12)' : '#EDF3F5',
                        color: thickness === tVal ? '#087F95' : '#394B54',
                        fontWeight: thickness === tVal ? 700 : 500,
                        cursor: 'pointer'
                      }}
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
                    style={{
                      width: '70px',
                      height: '32px',
                      padding: '0 8px',
                      backgroundColor: '#EDF3F5',
                      border: '1px solid #D4E0E5',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontFamily: 'var(--font-data)',
                      color: '#172830',
                      textAlign: 'right',
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Live Scale Calibration Preview Feedback */}
            {selectedFile && estimatedScale && (
              <div style={{
                marginTop: '16px',
                padding: '12px 14px',
                borderRadius: '6px',
                backgroundColor: 'rgba(11,166,190,0.06)',
                border: '1px solid rgba(11,166,190,0.25)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '8px'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Sliders size={14} style={{ color: '#0BA6BE' }} />
                  <span style={{ fontSize: '12px', color: '#172830' }}>
                    Calculated Scale Factor:
                  </span>
                  <span style={{ fontSize: '13px', fontFamily: 'var(--font-data)', fontWeight: 700, color: '#087F95' }}>
                    1 px ≈ {estimatedScale.toFixed(4)} {units}
                  </span>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: '#53656E' }}>
                  {(1 / estimatedScale).toFixed(2)} px/{units} • Orthographic Projection
                </div>
              </div>
            )}
          </section>

          {/* Action Card: Generate CAD Drawing */}
          <div style={{
            padding: '20px 24px',
            borderRadius: '8px',
            backgroundColor: '#FFFFFF',
            border: '1px solid #D4E0E5',
            boxShadow: '0 2px 10px rgba(23,40,48,0.04)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            flexWrap: 'wrap'
          }}>
            <div>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#172830', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Sparkles size={16} style={{ color: '#0BA6BE' }} />
                <span>Ready for Geometric Reconstruction</span>
              </div>
              <div style={{ fontSize: '12px', color: '#53656E', marginTop: '4px' }}>
                Autonomous contour extraction (<code style={{ color: '#087F95', fontWeight: 600 }}>CUT</code>) and circle hole primitives (<code style={{ color: '#087F95', fontWeight: 600 }}>HOLES</code>).
              </div>
            </div>

            <button
              type="button"
              onClick={() => createMutation.mutate()}
              disabled={!canSubmit}
              style={{
                height: '44px',
                padding: '0 24px',
                borderRadius: '4px',
                fontSize: '14px',
                fontWeight: 600,
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '10px',
                backgroundColor: canSubmit ? '#0BA6BE' : '#D4E0E5',
                color: canSubmit ? '#FFFFFF' : '#71838C',
                border: 'none',
                cursor: canSubmit ? 'pointer' : 'not-allowed',
                boxShadow: canSubmit ? '0 4px 12px rgba(11,166,190,0.35)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              {createMutation.isPending ? (
                <>
                  <RefreshCw size={16} className="animate-spin" />
                  <span>Processing Geometry...</span>
                </>
              ) : (
                <>
                  <span>Generate CAD Drawing</span>
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>

        </div>

        {/* Right Column: Engineering Spec & Deliverables Panel */}
        <aside style={{
          padding: '24px',
          borderRadius: '8px',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D4E0E5',
          boxShadow: '0 2px 10px rgba(23,40,48,0.04)',
          position: 'sticky',
          top: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '20px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingBottom: '14px', borderBottom: '1px solid #D4E0E5' }}>
            <Layers3 size={16} style={{ color: '#0BA6BE' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#172830', margin: 0 }}>
              Production Deliverables
            </h3>
          </div>

          {/* Deliverables Cards */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <div style={{
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: '#F8FBFC',
              border: '1px solid #D4E0E5'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#172830', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <FileCode size={15} style={{ color: '#0BA6BE' }} />
                  <span>AutoCAD DXF Drawing</span>
                </span>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: 'rgba(11,166,190,0.1)',
                  color: '#087F95',
                  border: '1px solid rgba(11,166,190,0.25)'
                }}>
                  R2000+ CAM
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#53656E', lineHeight: 1.5, margin: 0 }}>
                Layer-separated vector entities: <span style={{ fontFamily: 'var(--font-data)', color: '#087F95', fontWeight: 600 }}>CUT</span> (outer polygon loop) & <span style={{ fontFamily: 'var(--font-data)', color: '#087F95', fontWeight: 600 }}>HOLES</span> (exact circle primitives with radius & center).
              </p>
            </div>

            <div style={{
              padding: '12px 14px',
              borderRadius: '6px',
              backgroundColor: '#F8FBFC',
              border: '1px solid #D4E0E5'
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: '#172830', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Box size={15} style={{ color: '#0BA6BE' }} />
                  <span>Watertight STL 3D Mesh</span>
                </span>
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  backgroundColor: '#EDF3F5',
                  color: '#53656E',
                  border: '1px solid #D4E0E5'
                }}>
                  3D PRINTING
                </span>
              </div>
              <p style={{ fontSize: '11px', color: '#53656E', lineHeight: 1.5, margin: 0 }}>
                Binary STL extrusion of the outer boundary with subtractive cylindrical hole cutouts at thickness {thickness || 0} {units}.
              </p>
            </div>
          </div>

          {/* Live Validation Checklist */}
          <div style={{
            paddingTop: '14px',
            borderTop: '1px solid #D4E0E5',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px'
          }}>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: '#53656E'
            }}>
              <span>Readiness Checklist</span>
              <span style={{ color: '#087F95', fontWeight: 700 }}>
                {[hasValidFile, hasValidDimension, hasValidThickness].filter(Boolean).length}/3 Ready
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
              {hasValidFile ? (
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(11,166,190,0.15)',
                  color: '#0BA6BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Check size={11} strokeWidth={3} />
                </div>
              ) : (
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #B8C9D0', flexShrink: 0 }} />
              )}
              <span style={{ color: hasValidFile ? '#172830' : '#71838C', fontWeight: hasValidFile ? 500 : 400 }}>
                {hasValidFile ? `Image: ${selectedFile.file.name}` : 'Upload part image'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
              {hasValidDimension ? (
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(11,166,190,0.15)',
                  color: '#0BA6BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Check size={11} strokeWidth={3} />
                </div>
              ) : (
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #B8C9D0', flexShrink: 0 }} />
              )}
              <span style={{ color: hasValidDimension ? '#172830' : '#71838C', fontWeight: hasValidDimension ? 500 : 400 }}>
                {hasValidDimension ? `Reference: ${dimValue} ${units} (${dimLabel})` : 'Set known dimension'}
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '12px' }}>
              {hasValidThickness ? (
                <div style={{
                  width: '18px',
                  height: '18px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(11,166,190,0.15)',
                  color: '#0BA6BE',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Check size={11} strokeWidth={3} />
                </div>
              ) : (
                <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: '1px solid #B8C9D0', flexShrink: 0 }} />
              )}
              <span style={{ color: hasValidThickness ? '#172830' : '#71838C', fontWeight: hasValidThickness ? 500 : 400 }}>
                {hasValidThickness ? `Thickness: ${thickness} ${units}` : 'Set extrusion thickness'}
              </span>
            </div>
          </div>

          {/* Engineering Note Card */}
          <div style={{
            padding: '12px 14px',
            borderRadius: '6px',
            backgroundColor: '#F8FBFC',
            border: '1px solid #D4E0E5',
            fontSize: '11px',
            color: '#53656E',
            lineHeight: 1.5
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#172830', fontWeight: 600, marginBottom: '4px' }}>
              <HelpCircle size={13} style={{ color: '#0BA6BE' }} />
              <span>Tolerance & Metrology</span>
            </div>
            CADVision AI uses contour subpixel fitting and Hough circle transform. For CNC tolerance verification, check critical hole centers on the CAD workspace canvas before sending to milling.
          </div>
        </aside>

      </div>
    </div>
  );
}
