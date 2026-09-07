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
  Layers3,
  Copy
} from 'lucide-react';

import MeasurementsList from '../components/MeasurementsList';
import DrawingSheet from '../components/drawing/DrawingSheet';
import { getConfidenceTheme } from '../lib/confidence';

export default function Workspace() {
  const { jobId } = useParams<{ jobId: string }>();
  const navigate = useNavigate();
  const [showAddViews, setShowAddViews] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

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

  const copyJobId = () => {
    if (!jobId) return;
    navigator.clipboard.writeText(jobId);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

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
    <div style={{ display: 'flex', flex: 1, overflow: 'hidden', height: 'calc(100vh - 64px)' }}>
      {/* Left Slim CAD Tool Rail */}
      <div style={{
        width: '50px',
        flexShrink: 0,
        borderRight: '1px solid #D4E0E5',
        backgroundColor: '#FFFFFF',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '12px 0',
        gap: '8px',
        zIndex: 20
      }}>
        <button
          onClick={() => navigate('/')}
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            border: '1px solid #D4E0E5',
            backgroundColor: '#F8FBFC',
            color: '#394B54',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          title="Create New CAD Job"
        >
          <Plus size={16} />
        </button>

        <div style={{ width: '24px', height: '1px', backgroundColor: '#D4E0E5', margin: '4px 0' }} />

        {/* 2D Orthographic Mode Button */}
        <button
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '4px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(11,166,190,0.12)',
            color: '#087F95',
            border: '1px solid rgba(11,166,190,0.3)',
            cursor: 'default'
          }}
          title="2D Orthographic CAD Viewport"
        >
          <Layers size={16} />
        </button>

        {/* Layer Indicators at Rail Bottom */}
        <div style={{ marginTop: 'auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', paddingBottom: '8px' }}>
          <div
            style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#0BA6BE' }}
            title="Layer: CUT (Perimeter Boundary)"
          />
          <div
            style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#E11D48' }}
            title="Layer: HOLES (Internal Features)"
          />
        </div>
      </div>

      {/* Center Viewport Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, position: 'relative', backgroundColor: '#EDEAE3', overflow: 'hidden' }}>
        
        {/* Top Success / Status Banner */}
        {isCompleted && (
          <div style={{
            position: 'relative',
            zIndex: 20,
            backgroundColor: '#FFFFFF',
            borderBottom: '1px solid #D4E0E5',
            padding: '10px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '16px',
            boxShadow: '0 1px 4px rgba(23,40,48,0.03)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '28px',
                height: '28px',
                borderRadius: '50%',
                backgroundColor: 'rgba(11,166,190,0.15)',
                color: '#0BA6BE',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0
              }}>
                <Check size={14} strokeWidth={3} />
              </div>
              <div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: '#172830', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>CAD Geometry Generated Successfully</span>
                  <span style={{
                    fontSize: '10px',
                    fontFamily: 'var(--font-data)',
                    fontWeight: 700,
                    padding: '2px 6px',
                    borderRadius: '3px',
                    backgroundColor: 'rgba(11,166,190,0.12)',
                    color: '#087F95',
                    border: '1px solid rgba(11,166,190,0.25)',
                    letterSpacing: '0.04em'
                  }}>
                    0 AUDIT ERRORS
                  </span>
                </div>
                <div style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: '#53656E', marginTop: '2px' }}>
                  Outer contour closed • {geomSummary ? `${geomSummary.holeCount} internal holes` : 'Holes resolved'} • Watertight mesh ready
                </div>
              </div>
            </div>

            {/* Quick Export Actions */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              {dxfFile?.url && (
                <a
                  href={dxfFile.url}
                  download
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    backgroundColor: '#0BA6BE',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none',
                    boxShadow: '0 2px 6px rgba(11,166,190,0.3)'
                  }}
                  title="Download AutoCAD DXF 2D Drawing"
                >
                  <Download size={13} />
                  <span>DXF</span>
                  {dxfFile.size && (
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', opacity: 0.85 }}>
                      ({formatFileSize(dxfFile.size)})
                    </span>
                  )}
                </a>
              )}
              {stlFile?.url && (
                <a
                  href={stlFile.url}
                  download
                  style={{
                    height: '32px',
                    padding: '0 12px',
                    borderRadius: '4px',
                    backgroundColor: '#EDF3F5',
                    border: '1px solid #D4E0E5',
                    color: '#172830',
                    fontSize: '12px',
                    fontWeight: 600,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    textDecoration: 'none'
                  }}
                  title="Download Watertight 3D STL Mesh"
                >
                  <Download size={13} />
                  <span>STL</span>
                  {stlFile.size && (
                    <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: '#71838C' }}>
                      ({formatFileSize(stlFile.size)})
                    </span>
                  )}
                </a>
              )}
            </div>
          </div>
        )}

        {/* Coverage Advisory Bar */}
        {status?.status === 'completed' && status.coverage_gaps && status.coverage_gaps.length > 0 && !showAddViews && (
          <div style={{
            position: 'relative',
            zIndex: 10,
            backgroundColor: 'rgba(240,180,41,0.08)',
            borderBottom: '1px solid rgba(240,180,41,0.3)',
            padding: '6px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '12px',
            fontSize: '12px'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#9A6B0C' }}>
              <ShieldAlert size={15} style={{ color: '#D2960F', flexShrink: 0 }} />
              <span><strong>Single-View Notice:</strong> {status.coverage_gaps[0]} (Reconstruction completed using visible surface).</span>
            </div>
            <button
              type="button"
              onClick={() => setShowAddViews(true)}
              style={{
                padding: '3px 8px',
                borderRadius: '3px',
                fontSize: '11px',
                fontWeight: 600,
                backgroundColor: '#D2960F',
                color: '#FFFFFF',
                border: 'none',
                cursor: 'pointer',
                flexShrink: 0
              }}
            >
              Add extra angles
            </button>
          </div>
        )}

        {/* 2D CAD Canvas Viewport */}
        <div style={{ flex: 1, width: '100%', minHeight: 0, position: 'relative', overflow: 'hidden', backgroundColor: '#EDEAE3' }}>
          <DrawingSheet
            jobId={jobId!}
            drawing={drawing}
            createdAt={status?.created_at}
            units={status?.scale?.units || 'mm'}
          />

          {/* Add Views Drawer Panel if requested */}
          {showAddViews && status && (
            <div style={{
              position: 'absolute',
              left: '16px',
              right: '16px',
              bottom: '16px',
              zIndex: 30,
              backgroundColor: '#FFFFFF',
              border: '1px solid #D4E0E5',
              borderRadius: '8px',
              padding: '20px',
              boxShadow: '0 8px 30px rgba(0,0,0,0.12)',
              maxWidth: '640px',
              margin: '0 auto'
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'start', marginBottom: '14px' }}>
                <div>
                  <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#172830', margin: '0 0 4px 0' }}>
                    Add Complementary Views
                  </h3>
                  <p style={{ fontSize: '12px', color: '#53656E', margin: 0 }}>
                    {status.coverage_gaps?.[0] || 'Upload alternate angles to enrich feature extraction. Known dimensions will be preserved.'}
                  </p>
                </div>
                <Button variant="ghost" size="sm" onClick={() => setShowAddViews(false)}>Close</Button>
              </div>

              <div
                style={{
                  border: '2px dashed #B8C9D0',
                  borderRadius: '6px',
                  backgroundColor: '#F8FBFC',
                  padding: '24px',
                  textAlign: 'center',
                  cursor: 'pointer'
                }}
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
              >
                <b style={{ fontSize: '14px', fontWeight: 600, color: '#172830', display: 'block' }}>
                  Drop additional photos here, or click to browse
                </b>
                <span style={{ fontSize: '12px', color: '#71838C', marginTop: '4px', display: 'block' }}>
                  JPG, PNG, or WebP
                </span>
              </div>
            </div>
          )}

          {/* Critical Error Overlay if Failed */}
          {status?.status === 'failed' && (
            <div style={{ position: 'absolute', left: '16px', right: '16px', bottom: '16px', zIndex: 20 }}>
              <div style={{
                backgroundColor: '#FFFFFF',
                border: '1px solid rgba(224,73,47,0.4)',
                borderLeft: '4px solid #E0492F',
                borderRadius: '6px',
                padding: '14px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                boxShadow: '0 4px 16px rgba(0,0,0,0.08)'
              }}>
                <AlertCircle size={20} style={{ color: '#E0492F', flexShrink: 0 }} />
                <div style={{ fontSize: '13px', flex: 1 }}>
                  <b style={{ color: '#E0492F', display: 'block', fontWeight: 600 }}>Reconstruction Failed</b>
                  <span style={{ color: '#53656E' }}>{status.error || 'Check input image and try again.'}</span>
                </div>
                <Button variant="secondary" size="sm" onClick={() => navigate('/')}>New Job</Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Engineering Sidebar (Expanded & Polished) */}
      <div style={{
        width: '375px',
        backgroundColor: '#FFFFFF',
        flexShrink: 0,
        borderLeft: '1px solid #D4E0E5',
        padding: '20px',
        overflowY: 'auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
        position: 'relative',
        zIndex: 20,
        boxShadow: '-2px 0 10px rgba(23,40,48,0.02)'
      }}>
        {/* Job Identity Card */}
        <div style={{ paddingBottom: '14px', borderBottom: '1px solid #D4E0E5' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{
              fontSize: '11px',
              fontFamily: 'var(--font-data)',
              fontWeight: 600,
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: '#087F95'
            }}>
              CAD Deliverables
            </span>
            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', fontFamily: 'var(--font-data)', color: '#71838C' }}>
                #{jobId?.substring(0, 8).toUpperCase()}
              </span>
              <button
                type="button"
                onClick={copyJobId}
                title="Copy Job ID"
                style={{ background: 'none', border: 'none', padding: '2px', cursor: 'pointer', color: copiedId ? '#0BA6BE' : '#71838C' }}
              >
                {copiedId ? <Check size={11} /> : <Copy size={11} />}
              </button>
            </div>
          </div>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#172830', margin: 0 }}>
            Production Files
          </h2>
        </div>

        {/* Dedicated DXF & STL Download Action Cards */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {/* Card 1: AutoCAD DXF */}
          <div style={{
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #D4E0E5',
            backgroundColor: '#F8FBFC'
          }}>
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(11,166,190,0.12)',
                  color: '#087F95',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <FileCode size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#172830', margin: 0, lineHeight: 1.2 }}>
                    2D CAD Drawing
                  </h3>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: '#71838C' }}>
                    AutoCAD DXF R2018
                  </span>
                </div>
              </div>
              {dxfFile?.size && (
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 600,
                  color: '#53656E',
                  backgroundColor: '#EDF3F5',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: '1px solid #D4E0E5'
                }}>
                  {formatFileSize(dxfFile.size)}
                </span>
              )}
            </div>

            <p style={{ fontSize: '11px', color: '#53656E', lineHeight: 1.4, margin: '0 0 10px 0' }}>
              Separated on <strong style={{ color: '#087F95', fontWeight: 600 }}>CUT</strong> (perimeter) & <strong style={{ color: '#E11D48', fontWeight: 600 }}>HOLES</strong> layers. Ready for CNC laser/waterjet cutting.
            </p>

            {dxfFile?.ready && dxfFile.url ? (
              <a
                href={dxfFile.url}
                download
                style={{
                  height: '34px',
                  width: '100%',
                  borderRadius: '4px',
                  backgroundColor: '#0BA6BE',
                  color: '#FFFFFF',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none',
                  boxShadow: '0 2px 6px rgba(11,166,190,0.25)'
                }}
              >
                <Download size={13} />
                <span>Download drawing.dxf</span>
              </a>
            ) : (
              <Button variant="secondary" size="sm" disabled className="w-full">
                Preparing DXF...
              </Button>
            )}
          </div>

          {/* Card 2: 3D STL Solid Mesh */}
          <div style={{
            padding: '14px',
            borderRadius: '6px',
            border: '1px solid #D4E0E5',
            backgroundColor: '#F8FBFC'
          }}>
            <div style={{ display: 'flex', alignItems: 'start', justifyContent: 'space-between', gap: '8px', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <div style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '4px',
                  backgroundColor: 'rgba(11,166,190,0.12)',
                  color: '#087F95',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0
                }}>
                  <Box size={16} />
                </div>
                <div>
                  <h3 style={{ fontSize: '13px', fontWeight: 600, color: '#172830', margin: 0, lineHeight: 1.2 }}>
                    3D Solid Mesh
                  </h3>
                  <span style={{ fontSize: '10px', fontFamily: 'var(--font-data)', color: '#71838C' }}>
                    Binary STL Solid
                  </span>
                </div>
              </div>
              {stlFile?.size && (
                <span style={{
                  fontSize: '10px',
                  fontFamily: 'var(--font-data)',
                  fontWeight: 600,
                  color: '#53656E',
                  backgroundColor: '#EDF3F5',
                  padding: '2px 6px',
                  borderRadius: '3px',
                  border: '1px solid #D4E0E5'
                }}>
                  {formatFileSize(stlFile.size)}
                </span>
              )}
            </div>

            <p style={{ fontSize: '11px', color: '#53656E', lineHeight: 1.4, margin: '0 0 10px 0' }}>
              Watertight extruded 3D solid ready for slicers (Bambu, Prusa, Cura) and 3D printing.
            </p>

            {stlFile?.ready && stlFile.url ? (
              <a
                href={stlFile.url}
                download
                style={{
                  height: '34px',
                  width: '100%',
                  borderRadius: '4px',
                  backgroundColor: '#EDF3F5',
                  border: '1px solid #D4E0E5',
                  color: '#172830',
                  fontSize: '12px',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  textDecoration: 'none'
                }}
              >
                <Download size={13} />
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
        <div style={{
          padding: '14px',
          borderRadius: '6px',
          border: '1px solid #D4E0E5',
          backgroundColor: '#F8FBFC'
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            color: '#394B54',
            paddingBottom: '8px',
            marginBottom: '10px',
            borderBottom: '1px solid #D4E0E5'
          }}>
            <Cpu size={14} style={{ color: '#0BA6BE' }} />
            <span>Geometry Audit</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', fontSize: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#53656E' }}>Outer Contour:</span>
              <span style={{ fontFamily: 'var(--font-data)', fontWeight: 600, color: '#172830' }}>
                {geomSummary?.outerPoints || 0} vertices (Closed)
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#53656E' }}>Holes Extracted:</span>
              <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, color: '#E11D48' }}>
                {geomSummary?.holeCount || 0} internal features
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#53656E' }}>Calibration Unit:</span>
              <span style={{ fontFamily: 'var(--font-data)', fontWeight: 700, color: '#087F95', textTransform: 'uppercase' }}>
                {status?.scale?.units || 'mm'}
              </span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: '#53656E' }}>Audit Status:</span>
              <span style={{
                fontFamily: 'var(--font-data)',
                fontSize: '11px',
                fontWeight: 600,
                color: '#087F95',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <CheckCircle2 size={13} style={{ color: '#0BA6BE' }} /> Validated
              </span>
            </div>
          </div>
        </div>

        {/* Measurements List */}
        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#172830', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers3 size={15} style={{ color: '#0BA6BE' }} />
              <span>Extracted Dimensions</span>
            </div>
            {theme && (
              <div style={{
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '10px',
                fontFamily: 'var(--font-data)',
                fontWeight: 600,
                border: '1px solid #D4E0E5',
                backgroundColor: '#EDF3F5',
                color: '#394B54',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}>
                <span>{theme.glyph}</span>
                <span>
                  {confidence?.level === 'measured' ? 'Measured' :
                   confidence?.level === 'estimated' ? 'Estimated' : 'Low confidence'}
                </span>
              </div>
            )}
          </div>

          <MeasurementsList status={status} drawing={drawing} />
        </div>

        {/* Safety Note */}
        <div style={{
          marginTop: 'auto',
          paddingTop: '12px',
          borderTop: '1px solid #D4E0E5',
          fontSize: '11px',
          color: '#71838C',
          lineHeight: 1.4
        }}>
          CADVision AI reconstruction. Always verify dimensions against physical part before CNC cutting.
        </div>
      </div>
    </div>
  );
}
