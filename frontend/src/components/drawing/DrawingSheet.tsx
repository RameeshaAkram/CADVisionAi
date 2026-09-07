import React, { useRef, useState, useEffect, useMemo, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJobDrawing } from '../../api/exports';
import OrthoView from './OrthoView';
import TitleBlock from './TitleBlock';
import {
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCcw,
  Layers,
  Sparkles,
  MousePointer,
  HelpCircle,
  Ruler
} from 'lucide-react';

interface DrawingSheetProps {
  jobId: string;
  drawing?: any;
  createdAt?: string;
  units?: string;
}

export default function DrawingSheet({ jobId, drawing: drawingProp, createdAt, units = 'mm' }: DrawingSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  const [scale, setScale] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [initialState, setInitialState] = useState<{ scale: number; pan: { x: number; y: number } } | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const [theme, setTheme] = useState<'paper' | 'blueprint'>('paper');
  const [cursorCad, setCursorCad] = useState<{ x: number; y: number } | null>(null);
  const [showPoints, setShowPoints] = useState(false);
  const [showDimensions, setShowDimensions] = useState(true);

  const { data: drawingQuery, isLoading, error } = useQuery({
    queryKey: ['jobDrawing', jobId],
    queryFn: () => getJobDrawing(jobId),
    enabled: !drawingProp && !!jobId,
    retry: false
  });

  const drawing = drawingProp || drawingQuery;

  // Calculate Geometry Bounding Box & Centroid
  const geomMetrics = useMemo(() => {
    if (!drawing?.views) return null;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let pointCount = 0;
    let outerCount = 0;
    let holeCount = 0;

    Object.values(drawing.views).forEach((v: any) => {
      v.polylines?.forEach((poly: any) => {
        if (poly.role === 'hole') {
          holeCount++;
        } else {
          outerCount += poly.points?.length || 0;
        }

        poly.points?.forEach((p: any) => {
          minX = Math.min(minX, p.x);
          maxX = Math.max(maxX, p.x);
          minY = Math.min(minY, p.y);
          maxY = Math.max(maxY, p.y);
          pointCount++;
        });
      });

      v.circles?.forEach((c: any) => {
        holeCount++;
        const r = c.r || 0;
        minX = Math.min(minX, c.cx - r);
        maxX = Math.max(maxX, c.cx + r);
        minY = Math.min(minY, c.cy - r);
        maxY = Math.max(maxY, c.cy + r);
        pointCount++;
      });
    });

    if (pointCount === 0 || !isFinite(minX)) {
      return null;
    }

    const width = maxX - minX;
    const height = maxY - minY;
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;

    return {
      minX,
      maxX,
      minY,
      maxY,
      width: Math.max(width, 0.01),
      height: Math.max(height, 0.01),
      cx,
      cy,
      outerCount,
      holeCount,
      totalPoints: pointCount
    };
  }, [drawing]);

  // Auto-fit function
  const fitToScreen = useCallback((overrideW?: number, overrideH?: number) => {
    if (!geomMetrics) return;
    const containerW = overrideW ?? containerRef.current?.clientWidth ?? 0;
    const containerH = overrideH ?? containerRef.current?.clientHeight ?? 0;

    // Use sensible fallback if container hasn't measured yet
    const effectiveW = containerW > 50 ? containerW : 800;
    const effectiveH = containerH > 50 ? containerH : 600;

    const pad = 60; // Clean margin around part and dimensions
    const availW = Math.max(effectiveW - pad * 2, 100);
    const availH = Math.max(effectiveH - pad * 2, 100);

    const fitScale = Math.min(availW / geomMetrics.width, availH / geomMetrics.height);
    const clampedScale = Math.max(0.2, Math.min(fitScale, 1500));

    setScale(clampedScale);
    setPan({ x: 0, y: 0 });
    setInitialState({ scale: clampedScale, pan: { x: 0, y: 0 } });
  }, [geomMetrics]);

  // Initial Auto-fit and dynamic ResizeObserver
  useEffect(() => {
    const el = containerRef.current;
    if (!el || !geomMetrics) return;

    // Run initial fit
    fitToScreen(el.clientWidth, el.clientHeight);

    // Watch for size changes to keep drawing centered and scaled
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 50 && entry.contentRect.height > 50) {
          fitToScreen(entry.contentRect.width, entry.contentRect.height);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [geomMetrics, fitToScreen]);

  // Mouse Wheel Zooming
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const zoomFactor = e.deltaY < 0 ? 1.15 : 0.87;
      setScale(prev => Math.max(0.1, Math.min(prev * zoomFactor, 20000)));
    };

    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // Mouse Drag Panning
  const handleMouseDown = (e: React.MouseEvent) => {
    // Only pan on primary click
    if (e.button !== 0) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    // Update pan if dragging
    if (isDragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }

    // Compute CAD coordinates under cursor
    if (containerRef.current && geomMetrics) {
      const rect = containerRef.current.getBoundingClientRect();
      const mouseX = e.clientX - rect.left;
      const mouseY = e.clientY - rect.top;

      const originX = rect.width / 2 + pan.x;
      const originY = rect.height / 2 + pan.y;

      const cadX = geomMetrics.cx + (mouseX - originX) / scale;
      const cadY = geomMetrics.cy + (mouseY - originY) / scale;

      setCursorCad({ x: cadX, y: cadY });
    }
  };

  const handleMouseUp = () => setIsDragging(false);

  const handleReset = () => {
    if (initialState) {
      setScale(initialState.scale);
      setPan(initialState.pan);
    } else {
      fitToScreen();
    }
  };

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper)] text-[var(--g-400)] font-data text-[13px] gap-2">
        <div className="w-5 h-5 border-2 border-[var(--cyan-500)] border-t-transparent rounded-full animate-spin" />
        <span>Loading orthographic vector geometry...</span>
      </div>
    );
  }

  if (error || !drawing) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--paper)] text-[var(--g-400)] font-data text-[13px] p-6 text-center">
        <HelpCircle className="w-8 h-8 text-[var(--g-400)] mb-2" />
        <span className="font-semibold text-[var(--g-300)]">Vector Drawing Not Available</span>
        <span className="text-[12px] text-[var(--g-500)] max-w-[40ch] mt-1">
          The 2D drawing will become interactive once the CAD pipeline finishes feature extraction.
        </span>
      </div>
    );
  }

  const isBlueprint = theme === 'blueprint';
  const effectiveUnits = units || drawing.title_block?.units || 'mm';

  return (
    <div
      ref={containerRef}
      className={`w-full h-full relative overflow-hidden select-none transition-colors duration-150 ${
        isBlueprint ? 'bg-[#0A1014] text-[#E0F2FE]' : 'bg-[#EDEAE3] text-[#1B1917]'
      }`}
      style={{
        cursor: isDragging ? 'grabbing' : 'grab'
      }}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={() => {
        handleMouseUp();
        setCursorCad(null);
      }}
    >
      {/* Background Engineering Grid */}
      <div
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: isBlueprint
            ? `
              linear-gradient(to right, rgba(56, 189, 248, 0.12) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(56, 189, 248, 0.12) 1px, transparent 1px)
            `
            : `
              linear-gradient(to right, #DAD5CB 1px, transparent 1px),
              linear-gradient(to bottom, #DAD5CB 1px, transparent 1px)
            `,
          backgroundSize: `${Math.max(10, Math.min(scale * 10, 100))}px ${Math.max(10, Math.min(scale * 10, 100))}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          opacity: isBlueprint ? 0.7 : 0.6
        }}
      />

      {/* Top Left: Geometry HUD Legend */}
      {geomMetrics && (
        <div
          style={{
            position: 'absolute',
            top: '12px',
            left: '14px',
            zIndex: 20,
            display: 'flex',
            flexDirection: 'column',
            gap: '4px',
            padding: '8px 12px',
            borderRadius: '6px',
            backgroundColor: isBlueprint ? 'rgba(14,22,26,0.92)' : 'rgba(255,255,255,0.95)',
            border: isBlueprint ? '1px solid rgba(56,189,248,0.3)' : '1px solid #D4E0E5',
            boxShadow: '0 2px 8px rgba(23,40,48,0.06)',
            pointerEvents: 'none',
            fontSize: '11px',
            fontFamily: 'var(--font-data)'
          }}
        >
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 700,
            paddingBottom: '4px',
            borderBottom: isBlueprint ? '1px solid rgba(56,189,248,0.2)' : '1px solid #EDF3F5',
            textTransform: 'uppercase',
            letterSpacing: '0.06em',
            fontSize: '10px',
            color: '#087F95'
          }}>
            <Layers size={13} style={{ color: '#0BA6BE' }} />
            <span>Extracted Geometry</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ color: '#53656E' }}>Extents:</span>
            <span style={{ fontWeight: 600, color: isBlueprint ? '#E0F2FE' : '#172830' }}>
              {geomMetrics.width.toFixed(2)} × {geomMetrics.height.toFixed(2)} {effectiveUnits}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#53656E' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: isBlueprint ? '#38BDF8' : '#172830' }} />
              Outer Boundary:
            </span>
            <span style={{ fontWeight: 600, color: isBlueprint ? '#E0F2FE' : '#172830' }}>
              {geomMetrics.outerCount} vertices
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#53656E' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#E11D48' }} />
              Internal Holes:
            </span>
            <span style={{ fontWeight: 700, color: '#E11D48' }}>
              {geomMetrics.holeCount} detected
            </span>
          </div>
        </div>
      )}

      {/* Top Right: Interactive CAD Floating Toolbar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          right: '14px',
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '4px 8px',
          borderRadius: '6px',
          backgroundColor: isBlueprint ? 'rgba(14,22,26,0.92)' : '#FFFFFF',
          border: isBlueprint ? '1px solid rgba(56,189,248,0.3)' : '1px solid #D4E0E5',
          boxShadow: '0 2px 8px rgba(23,40,48,0.08)'
        }}
      >
        {/* Zoom Out */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setScale(prev => Math.max(0.1, prev * 0.8));
          }}
          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#53656E' }}
          title="Zoom Out"
        >
          <ZoomOut size={14} />
        </button>

        {/* Zoom Reset / Current Scale */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          style={{ height: '28px', padding: '0 8px', fontFamily: 'var(--font-data)', fontSize: '11px', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#172830' }}
          title="Reset Zoom to Fit"
        >
          {initialState ? `${Math.round((scale / initialState.scale) * 100)}%` : '100%'}
        </button>

        {/* Zoom In */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setScale(prev => Math.min(20000, prev * 1.25));
          }}
          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#53656E' }}
          title="Zoom In"
        >
          <ZoomIn size={14} />
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: '#D4E0E5', margin: '0 2px' }} />

        {/* Fit to Screen */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            fitToScreen();
          }}
          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#53656E' }}
          title="Fit to Screen"
        >
          <Maximize2 size={14} />
        </button>

        {/* Reset Pan */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            handleReset();
          }}
          style={{ width: '28px', height: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '4px', border: 'none', background: 'none', cursor: 'pointer', color: '#53656E' }}
          title="Center Drawing"
        >
          <RotateCcw size={14} />
        </button>

        <div style={{ width: '1px', height: '16px', backgroundColor: '#D4E0E5', margin: '0 2px' }} />

        {/* Toggle Vertex Points */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowPoints(!showPoints);
          }}
          style={{
            height: '28px',
            padding: '0 8px',
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderRadius: '4px',
            border: showPoints ? '1px solid rgba(11,166,190,0.4)' : '1px solid transparent',
            backgroundColor: showPoints ? 'rgba(11,166,190,0.12)' : 'transparent',
            color: showPoints ? '#087F95' : '#53656E',
            cursor: 'pointer'
          }}
          title="Toggle Contour Points"
        >
          <Sparkles size={12} />
          <span>Vertices</span>
        </button>

        {/* Toggle Dimensions */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setShowDimensions(!showDimensions);
          }}
          style={{
            height: '28px',
            padding: '0 8px',
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderRadius: '4px',
            border: showDimensions ? '1px solid rgba(11,166,190,0.4)' : '1px solid transparent',
            backgroundColor: showDimensions ? 'rgba(11,166,190,0.12)' : 'transparent',
            color: showDimensions ? '#087F95' : '#53656E',
            cursor: 'pointer'
          }}
          title="Toggle Dimensions"
        >
          <Ruler size={12} />
          <span>Dims</span>
        </button>

        {/* Theme Toggle: Blueprint vs Paper */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setTheme(prev => prev === 'paper' ? 'blueprint' : 'paper');
          }}
          style={{
            height: '28px',
            padding: '0 8px',
            fontFamily: 'var(--font-data)',
            fontSize: '11px',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            borderRadius: '4px',
            border: '1px solid #D4E0E5',
            backgroundColor: isBlueprint ? 'rgba(56,189,248,0.15)' : '#EDF3F5',
            color: isBlueprint ? '#38BDF8' : '#394B54',
            cursor: 'pointer'
          }}
          title="Toggle Blueprint / Paper Mode"
        >
          <span>{isBlueprint ? 'Blueprint' : 'Paper'}</span>
        </button>
      </div>

      {/* Bottom Left: Live Cursor CAD Coordinates Readout */}
      <div
        style={{
          position: 'absolute',
          bottom: '12px',
          left: '14px',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          padding: '6px 12px',
          borderRadius: '4px',
          backgroundColor: isBlueprint ? 'rgba(14,22,26,0.92)' : 'rgba(255,255,255,0.95)',
          border: isBlueprint ? '1px solid rgba(56,189,248,0.3)' : '1px solid #D4E0E5',
          boxShadow: '0 2px 8px rgba(23,40,48,0.06)',
          pointerEvents: 'none',
          fontSize: '11px',
          fontFamily: 'var(--font-data)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '10px', color: '#71838C', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
          <MousePointer size={12} />
          <span>Cursor:</span>
        </div>
        {cursorCad ? (
          <div style={{ fontWeight: 600, color: isBlueprint ? '#38BDF8' : '#172830', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span>X: {cursorCad.x.toFixed(2)} {effectiveUnits}</span>
            <span style={{ opacity: 0.3 }}>|</span>
            <span>Y: {cursorCad.y.toFixed(2)} {effectiveUnits}</span>
          </div>
        ) : (
          <span style={{ color: '#71838C', fontStyle: 'italic' }}>Hover canvas to inspect</span>
        )}
      </div>

      {/* Centered Scaled Vector Canvas */}
      <div
        className="absolute origin-center transition-transform duration-75 ease-out pointer-events-none"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          left: '50%',
          top: '50%',
          width: 0,
          height: 0
        }}
      >
        <svg style={{ overflow: 'visible' }}>
          {/* Centering wrapper: shifts drawing centroid to (0, 0) */}
          <g transform={geomMetrics ? `translate(${-geomMetrics.cx}, ${-geomMetrics.cy})` : ''}>
            {drawing.views && Object.entries(drawing.views).map(([name, view]: [string, any]) => (
              <OrthoView
                key={name}
                view={view}
                theme={theme}
                showPoints={showPoints}
                showDimensions={showDimensions}
                units={effectiveUnits}
                geomMetrics={geomMetrics || undefined}
              />
            ))}
          </g>
        </svg>
      </div>

      {/* ISO Engineering Title Block */}
      <TitleBlock
        titleBlock={drawing.title_block}
        createdAt={createdAt}
        theme={theme}
        units={effectiveUnits}
      />
    </div>
  );
}
