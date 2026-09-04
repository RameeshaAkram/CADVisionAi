
interface OrthoViewProps {
  view: any;
  theme?: 'blueprint' | 'paper';
  showPoints?: boolean;
}

export default function OrthoView({ view, theme = 'paper', showPoints = false }: OrthoViewProps) {
  const isBlueprint = theme === 'blueprint';

  const getStrokeStyle = (role: string) => {
    if (role === 'hole') {
      return {
        stroke: isBlueprint ? '#F43F5E' : '#E11D48', // Rose/crimson
        strokeWidth: isBlueprint ? 2 : 1.75,
        strokeDasharray: isBlueprint ? 'none' : 'none',
      };
    }
    // Outer contour
    return {
      stroke: isBlueprint ? '#38BDF8' : '#1B1917', // Cyan / Dark Stone
      strokeWidth: isBlueprint ? 2.5 : 2,
    };
  };

  const getFillStyle = (role: string) => {
    if (role === 'hole') {
      return isBlueprint ? 'rgba(244, 63, 94, 0.08)' : 'rgba(225, 29, 72, 0.06)';
    }
    return isBlueprint ? 'rgba(56, 189, 248, 0.04)' : 'rgba(27, 25, 23, 0.02)';
  };

  return (
    <g>
      {/* Polylines */}
      {view.polylines && view.polylines.map((poly: any, i: number) => {
        if (!poly.points || poly.points.length === 0) return null;

        const d = poly.points.map((p: any, idx: number) =>
          `${idx === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
        ).join(' ') + (poly.is_closed ? ' Z' : '');

        const isHole = poly.role === 'hole';

        // Calculate centroid for holes to draw CAD center crosshair
        let centroidX = 0;
        let centroidY = 0;
        if (isHole && poly.points.length > 0) {
          poly.points.forEach((p: any) => {
            centroidX += p.x;
            centroidY += p.y;
          });
          centroidX /= poly.points.length;
          centroidY /= poly.points.length;
        }

        return (
          <g key={`poly-${i}`}>
            {/* Filled geometry with subtle tint */}
            <path
              d={d}
              {...getStrokeStyle(poly.role)}
              fill={getFillStyle(poly.role)}
              vectorEffect="non-scaling-stroke"
            />

            {/* Hole Center Crosshair (CAD standard) */}
            {isHole && (
              <g stroke={isBlueprint ? '#F43F5E' : '#E11D48'} strokeWidth={1} opacity={0.6}>
                <line
                  x1={centroidX - 2}
                  y1={centroidY}
                  x2={centroidX + 2}
                  y2={centroidY}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={centroidX}
                  y1={centroidY - 2}
                  x2={centroidX}
                  y2={centroidY + 2}
                  vectorEffect="non-scaling-stroke"
                />
              </g>
            )}

            {/* Optional Vertex Handles */}
            {showPoints && poly.points.map((p: any, pIdx: number) => (
              <circle
                key={`pt-${pIdx}`}
                cx={p.x}
                cy={p.y}
                r={2}
                fill={isHole ? '#F43F5E' : '#38BDF8'}
                stroke="#FFFFFF"
                strokeWidth={0.5}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        );
      })}
    </g>
  );
}
