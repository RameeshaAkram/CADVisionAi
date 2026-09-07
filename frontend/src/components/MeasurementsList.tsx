import { useMemo } from 'react';
import { getConfidenceTheme, formatByConfidence } from '../lib/confidence';
import type { ConfidenceLevel } from '../lib/confidence';
import type { JobStatusResponse } from '../api/jobs';

interface MeasurementsListProps {
  status: JobStatusResponse | undefined;
  drawing?: any;
}

export default function MeasurementsList({ status, drawing }: MeasurementsListProps) {
  if (!status) return null;

  const measurements = status.measurements || [];
  const defaultUnit = status.scale?.units || 'mm';

  // Extract circular holes from 2D drawing data
  const circles: any[] = drawing?.views?.top?.circles || [];
  const sortedCircles = useMemo(() => {
    return [...circles].sort((a, b) => {
      // Top-to-bottom (image coordinate Y: top is smaller Y), then left-to-right
      if (Math.abs(a.cy - b.cy) > 8) {
        return a.cy - b.cy;
      }
      return a.cx - b.cx;
    });
  }, [circles]);

  // Non-circular polyline holes
  const polyHoles = useMemo(() => {
    return (drawing?.views?.top?.polylines || []).filter((p: any) => p.role === 'hole');
  }, [drawing]);
  
  if (measurements.length === 0 && sortedCircles.length === 0) {
    return (
      <div className="text-[13px] leading-[18px] text-[var(--g-400)] mt-4">
        {status.status === 'completed' 
          ? "No known dimension provided. The model is in relative units and can't be measured."
          : "Measurements appear after scale calibration."}
      </div>
    );
  }

  const statusHoles = measurements.filter(m => m.id.startsWith('hole_'));
  const mainDims = measurements.filter(m => !m.id.startsWith('hole_'));

  const renderRow = (m: any) => {
    const theme = getConfidenceTheme(m.level as ConfidenceLevel);
    const valueText = formatByConfidence(m.level as ConfidenceLevel, m.value, m.units || defaultUnit, m.tolerance, m.min, m.max);
    
    return (
      <div key={m.id} className="flex items-baseline justify-between py-1.5 border-b border-[var(--g-800)] last:border-0 group">
        <div className="flex items-center gap-2">
          <span className={`text-[12px] ${theme.className}`}>{theme.glyph}</span>
          <span className="text-[13px] text-[var(--g-200)] group-hover:text-white transition-colors">{m.label}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-data text-[13px] text-[var(--g-200)] group-hover:text-white transition-colors">
            {valueText}
          </span>
          {m.level === 'measured' && (
            <span className="text-[10px] uppercase font-bold tracking-wider text-[var(--cyan-400)] bg-[var(--cyan-950)] px-1.5 rounded-sm">
              Known
            </span>
          )}
          {m.level === 'low' && (
            <span className="text-[10px] font-bold text-[var(--red-400)] bg-[var(--red-950)] px-1 rounded-sm">
              !
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="mt-4">
      {/* Primary Part Dimensions */}
      <div className="flex flex-col">
        {mainDims.map(renderRow)}
      </div>

      {/* Detected Circular Holes with Diameter (Ø) */}
      {sortedCircles.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-400)] mb-2 flex items-center justify-between border-b border-[var(--g-800)] pb-1">
            <span>Detected Holes ({sortedCircles.length})</span>
            <span className="text-[10px] text-[var(--cyan-400)] font-data font-normal">Ø diameter</span>
          </div>
          <div className="flex flex-col">
            {sortedCircles.map((c, idx) => {
              const diameter = (c.r * 2).toFixed(1);
              return (
                <div key={idx} className="flex items-baseline justify-between py-1.5 border-b border-[var(--g-800)] last:border-0 group">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#E11D48] shrink-0" />
                    <span className="text-[13px] text-[var(--g-200)] group-hover:text-white transition-colors">
                      Hole {idx + 1}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-data font-semibold text-[13px] text-[var(--g-100)] group-hover:text-[var(--cyan-400)] transition-colors">
                      Ø{diameter} {defaultUnit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-circular Cutouts / Slots */}
      {sortedCircles.length === 0 && polyHoles.length > 0 && (
        <div className="mt-5">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-400)] mb-2 border-b border-[var(--g-800)] pb-1">
            Internal Cutouts ({polyHoles.length})
          </div>
          <div className="flex flex-col">
            {polyHoles.map((p: any, idx: number) => (
              <div key={idx} className="flex items-baseline justify-between py-1.5 border-b border-[var(--g-800)] last:border-0 group">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#E11D48] shrink-0" />
                  <span className="text-[13px] text-[var(--g-200)] group-hover:text-white transition-colors">
                    Feature {idx + 1}
                  </span>
                </div>
                <span className="font-data text-[12px] text-[var(--g-400)]">
                  {p.primitive_type || 'polygon'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Legacy status holes fallback */}
      {sortedCircles.length === 0 && polyHoles.length === 0 && statusHoles.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-500)] mb-2">
            Holes ({statusHoles.length})
          </div>
          <div className="flex flex-col">
            {statusHoles.map(renderRow)}
          </div>
        </div>
      )}
    </div>
  );
}
