import React from 'react';

interface OrthoViewProps {
  view: any;
}

export default function OrthoView({ view }: OrthoViewProps) {
  const getStrokeStyle = (role: string) => {
    switch (role) {
      case 'hole':
        return { stroke: '#E11D48', strokeWidth: 1.5 }; // Rose-600
      case 'outer':
      default:
        return { stroke: '#1B1917', strokeWidth: 2 }; // Dark stone
    }
  };

  return (
    <g>
      {/* Polylines */}
      {view.polylines && view.polylines.map((poly: any, i: number) => {
        if (!poly.points || poly.points.length === 0) return null;
        const d = poly.points.map((p: any, idx: number) => 
          `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ') + (poly.is_closed ? ' Z' : '');

        return (
          <path
            key={`poly-${i}`}
            d={d}
            {...getStrokeStyle(poly.role)}
            fill="none"
          />
        );
      })}
    </g>
  );
}
