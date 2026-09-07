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
      <div style={{ fontSize: '13px', color: '#53656E', marginTop: '12px' }}>
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
      <div
        key={m.id}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 0',
          borderBottom: '1px solid #EDF3F5',
          gap: '12px'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '11px', color: m.level === 'measured' ? '#0BA6BE' : '#D2960F' }}>
            {theme.glyph}
          </span>
          <span style={{ fontSize: '13px', fontWeight: 500, color: '#172830' }}>
            {m.label}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
          <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 600, color: '#172830' }}>
            {valueText}
          </span>
          {m.level === 'measured' && (
            <span style={{
              fontSize: '10px',
              fontFamily: 'var(--font-data)',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.04em',
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: 'rgba(11,166,190,0.12)',
              color: '#087F95',
              border: '1px solid rgba(11,166,190,0.25)'
            }}>
              KNOWN
            </span>
          )}
          {m.level === 'low' && (
            <span style={{
              fontSize: '10px',
              fontWeight: 700,
              padding: '2px 6px',
              borderRadius: '3px',
              backgroundColor: 'rgba(224,73,47,0.12)',
              color: '#E0492F'
            }}>
              !
            </span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ marginTop: '12px' }}>
      {/* Primary Part Dimensions */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {mainDims.map(renderRow)}
      </div>

      {/* Detected Circular Holes with Diameter (Ø) */}
      {sortedCircles.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#53656E',
            paddingBottom: '6px',
            marginBottom: '4px',
            borderBottom: '1px solid #D4E0E5',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between'
          }}>
            <span>Detected Holes ({sortedCircles.length})</span>
            <span style={{ fontSize: '10px', color: '#087F95', fontWeight: 500 }}>Ø DIAMETER</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {sortedCircles.map((c, idx) => {
              const diameter = (c.r * 2).toFixed(1);
              return (
                <div
                  key={idx}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '7px 0',
                    borderBottom: '1px solid #EDF3F5',
                    gap: '12px'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#E11D48', flexShrink: 0 }} />
                    <span style={{ fontSize: '13px', color: '#394B54' }}>
                      Hole {idx + 1}
                    </span>
                  </div>
                  <span style={{ fontFamily: 'var(--font-data)', fontSize: '13px', fontWeight: 600, color: '#172830' }}>
                    Ø{diameter} {defaultUnit}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non-circular Cutouts / Slots */}
      {sortedCircles.length === 0 && polyHoles.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            color: '#53656E',
            paddingBottom: '6px',
            marginBottom: '4px',
            borderBottom: '1px solid #D4E0E5'
          }}>
            Internal Cutouts ({polyHoles.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {polyHoles.map((p: any, idx: number) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '7px 0',
                  borderBottom: '1px solid #EDF3F5'
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: '#E11D48', flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', color: '#394B54' }}>
                    Feature {idx + 1}
                  </span>
                </div>
                <span style={{ fontFamily: 'var(--font-data)', fontSize: '12px', color: '#71838C' }}>
                  {p.primitive_type || 'polygon'}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Legacy status holes fallback */}
      {sortedCircles.length === 0 && polyHoles.length === 0 && statusHoles.length > 0 && (
        <div style={{ marginTop: '16px' }}>
          <div style={{
            fontSize: '11px',
            fontFamily: 'var(--font-data)',
            fontWeight: 700,
            textTransform: 'uppercase',
            color: '#71838C',
            marginBottom: '8px'
          }}>
            Holes ({statusHoles.length})
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {statusHoles.map(renderRow)}
          </div>
        </div>
      )}
    </div>
  );
}
