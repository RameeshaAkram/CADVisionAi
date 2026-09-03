export type ConfidenceLevel = 'measured' | 'estimated' | 'low';

export interface ConfidenceTheme {
  glyph: string;
  className: string; // from tokens.css: .c-meas, .c-est, .c-low
  colorValue: string; // for explicit use
}

export const getConfidenceLevel = (score: number | undefined): ConfidenceLevel => {
  if (score === undefined || score >= 0.9) return 'measured';
  if (score >= 0.5) return 'estimated';
  return 'low';
};

export const getConfidenceTheme = (level: ConfidenceLevel): ConfidenceTheme => {
  switch (level) {
    case 'measured':
      return { glyph: '●', className: 'chip-measured', colorValue: 'var(--cyan-400)' };
    case 'estimated':
      return { glyph: '◐', className: 'chip-estimated', colorValue: 'var(--amber-400)' };
    case 'low':
      return { glyph: '○', className: 'chip-low', colorValue: 'var(--red-400)' };
  }
};

export const formatMeasured = (value: number, unit: string): string => {
  return `${value.toFixed(2)} ${unit}`;
};

export const formatEstimated = (value: number, tol: number, unit: string): string => {
  return `${value.toFixed(1)} ${unit} ±${tol.toFixed(1)}`;
};

export const formatLow = (min: number, max: number, unit: string): string => {
  return `${min.toFixed(1)}–${max.toFixed(1)} ${unit}`;
};

export const formatByConfidence = (
  level: ConfidenceLevel,
  value: number,
  unit: string,
  tol: number = 0,
  min?: number,
  max?: number
): string => {
  if (level === 'measured') return formatMeasured(value, unit);
  if (level === 'estimated') return formatEstimated(value, tol, unit);
  if (min !== undefined && max !== undefined) return formatLow(min, max, unit);
  
  // fallback for low if min/max not provided
  return formatLow(value * 0.8, value * 1.2, unit); 
};
