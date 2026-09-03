import React from 'react';
import DimensionLine from './DimensionLine';

interface OrthoViewProps {
  view: any;
}

export default function OrthoView({ view }: OrthoViewProps) {
  const getStrokeStyle = (role: string) => {
    switch (role) {
      case 'hidden':
        return { stroke: '#4A4642', strokeWidth: 1, strokeDasharray: '4 4' };
      case 'center':
        return { stroke: '#1B1917', strokeWidth: 0.75, strokeDasharray: '6 2 2 2' };
      case 'outline':
      default:
        return { stroke: '#1B1917', strokeWidth: 1.5 };
    }
  };

  return (
    <g>
      {/* Lines */}
      {view.lines && view.lines.map((line: any, i: number) => (
        <line 
          key={`line-${i}`}
          x1={line.x1} 
          y1={line.y1} 
          x2={line.x2} 
          y2={line.y2} 
          {...getStrokeStyle(line.role)}
          fill="none"
        />
      ))}

      {/* Circles */}
      {view.circles && view.circles.map((circle: any, i: number) => (
        <circle 
          key={`circle-${i}`}
          cx={circle.cx} 
          cy={circle.cy} 
          r={circle.r} 
          {...getStrokeStyle(circle.role)}
          fill="none"
        />
      ))}

      {/* Dimensions */}
      {view.dimensions && view.dimensions.map((dim: any, i: number) => {
        if (dim.level === 'low') return null;
        return <DimensionLine key={`dim-${i}`} dim={dim} />;
      })}
    </g>
  );
}
