import { getConfidenceTheme, formatByConfidence } from '../lib/confidence';
import type { ConfidenceLevel } from '../lib/confidence';
import type { JobStatusResponse } from '../api/jobs';

export default function MeasurementsList({ status }: { status: JobStatusResponse | undefined }) {
  if (!status) return null;

  const measurements = status.measurements || [];
  const defaultUnit = status.scale?.units || 'mm';
  
  if (measurements.length === 0) {
    return (
      <div className="text-[13px] leading-[18px] text-[var(--g-400)] mt-4">
        {status.status === 'completed' 
          ? "No known dimension provided. The model is in relative units and can't be measured."
          : "Measurements appear after scale calibration."}
      </div>
    );
  }

  const holes = measurements.filter(m => m.id.startsWith('hole_'));
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
      <div className="flex flex-col">
        {mainDims.map(renderRow)}
      </div>
      
      {holes.length > 0 && (
        <div className="mt-6">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[var(--g-500)] mb-2">
            Holes ({holes.length})
          </div>
          <div className="flex flex-col">
            {holes.map(renderRow)}
          </div>
        </div>
      )}
    </div>
  );
}
