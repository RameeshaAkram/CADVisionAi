
interface OrthoViewProps {
  view: any;
  theme?: 'blueprint' | 'paper';
  showPoints?: boolean;
  showDimensions?: boolean;
  units?: string;
  geomMetrics?: {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
    width: number;
    height: number;
    cx: number;
    cy: number;
  };
}

export default function OrthoView({
  view,
  theme = 'paper',
  showPoints = false,
  showDimensions = true,
  units = 'mm',
  geomMetrics
}: OrthoViewProps) {
  const isBlueprint = theme === 'blueprint';

  const getStrokeStyle = (role: string) => {
    if (role === 'hole') {
      return {
        stroke: isBlueprint ? '#F43F5E' : '#E11D48', // Rose / crimson
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

  const dimColor = isBlueprint ? '#38BDF8' : '#087F95';

  return (
    <g className="ortho-view-layer select-none">
      {/* 1. Polylines (Outer contours, slots, rectangular holes) */}
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
              <g stroke={getStrokeStyle('hole').stroke} strokeWidth={1} opacity={0.65}>
                <line
                  x1={centroidX - 3}
                  y1={centroidY}
                  x2={centroidX + 3}
                  y2={centroidY}
                  vectorEffect="non-scaling-stroke"
                />
                <line
                  x1={centroidX}
                  y1={centroidY - 3}
                  x2={centroidX}
                  y2={centroidY + 3}
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

      {/* 2. Circles (Circular holes from Phase 2/6 pipeline) */}
      {view.circles && view.circles.map((c: any, idx: number) => {
        const role = c.role || 'hole';
        const strokeStyle = getStrokeStyle(role);
        const fillStyle = getFillStyle(role);
        const ext = Math.max(c.r * 0.35, 2.5);

        return (
          <g key={`circle-${idx}`} className="cad-circle-entity">
            {/* Shaded Hole Circle following consistent theme role styling */}
            <circle
              cx={c.cx}
              cy={c.cy}
              r={c.r}
              {...strokeStyle}
              fill={fillStyle}
              vectorEffect="non-scaling-stroke"
            />

            {/* ISO CAD Center Crosshairs */}
            <g stroke={strokeStyle.stroke} strokeWidth={0.85} opacity={0.7}>
              {/* Horizontal centerline extending past hole radius */}
              <line
                x1={c.cx - c.r - ext}
                y1={c.cy}
                x2={c.cx + c.r + ext}
                y2={c.cy}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 1.5 1 1.5"
              />
              {/* Vertical centerline */}
              <line
                x1={c.cx}
                y1={c.cy - c.r - ext}
                x2={c.cx}
                y2={c.cy + c.r + ext}
                vectorEffect="non-scaling-stroke"
                strokeDasharray="4 1.5 1 1.5"
              />
              {/* Center mark point */}
              <circle
                cx={c.cx}
                cy={c.cy}
                r={1}
                fill={strokeStyle.stroke}
                stroke="none"
              />
            </g>

            {/* Quadrant handles when showPoints is enabled */}
            {showPoints && (
              <g fill={strokeStyle.stroke} stroke="#FFFFFF" strokeWidth={0.5}>
                <circle cx={c.cx - c.r} cy={c.cy} r={1.75} vectorEffect="non-scaling-stroke" />
                <circle cx={c.cx + c.r} cy={c.cy} r={1.75} vectorEffect="non-scaling-stroke" />
                <circle cx={c.cx} cy={c.cy - c.r} r={1.75} vectorEffect="non-scaling-stroke" />
                <circle cx={c.cx} cy={c.cy + c.r} r={1.75} vectorEffect="non-scaling-stroke" />
              </g>
            )}
          </g>
        );
      })}

      {/* 3. CAD Engineering Dimension Overlay */}
      {showDimensions && geomMetrics && (
        <g className="cad-dimensions-layer" opacity={0.95}>
          {/* Overall Width Dimension (Positioned along bottom of part) */}
          {(() => {
            const dimY = geomMetrics.maxY + 15;
            const extYStart = geomMetrics.maxY + 2;
            const extYEnd = dimY + 4;
            const tick = 3;

            return (
              <g key="dim-width">
                {/* Extension line Left */}
                <line
                  x1={geomMetrics.minX}
                  y1={extYStart}
                  x2={geomMetrics.minX}
                  y2={extYEnd}
                  stroke={dimColor}
                  strokeWidth={0.75}
                  opacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Extension line Right */}
                <line
                  x1={geomMetrics.maxX}
                  y1={extYStart}
                  x2={geomMetrics.maxX}
                  y2={extYEnd}
                  stroke={dimColor}
                  strokeWidth={0.75}
                  opacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Horizontal Dimension Line */}
                <line
                  x1={geomMetrics.minX}
                  y1={dimY}
                  x2={geomMetrics.maxX}
                  y2={dimY}
                  stroke={dimColor}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {/* CAD Oblique Ticks at Left */}
                <line
                  x1={geomMetrics.minX - tick}
                  y1={dimY + tick}
                  x2={geomMetrics.minX + tick}
                  y2={dimY - tick}
                  stroke={dimColor}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* CAD Oblique Ticks at Right */}
                <line
                  x1={geomMetrics.maxX - tick}
                  y1={dimY + tick}
                  x2={geomMetrics.maxX + tick}
                  y2={dimY - tick}
                  stroke={dimColor}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Dimension Text Label */}
                <text
                  x={geomMetrics.cx}
                  y={dimY + 8}
                  textAnchor="middle"
                  fill={dimColor}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="'IBM Plex Mono', monospace"
                  paintOrder="stroke"
                  stroke={isBlueprint ? '#0A1014' : '#EDEAE3'}
                  strokeWidth="4"
                  strokeLinejoin="round"
                >
                  {geomMetrics.width.toFixed(2)} {units}
                </text>
              </g>
            );
          })()}

          {/* Overall Height Dimension (Positioned along right of part) */}
          {(() => {
            const dimX = geomMetrics.maxX + 15;
            const extXStart = geomMetrics.maxX + 2;
            const extXEnd = dimX + 4;
            const tick = 3;

            return (
              <g key="dim-height">
                {/* Extension line Top */}
                <line
                  x1={extXStart}
                  y1={geomMetrics.minY}
                  x2={extXEnd}
                  y2={geomMetrics.minY}
                  stroke={dimColor}
                  strokeWidth={0.75}
                  opacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Extension line Bottom */}
                <line
                  x1={extXStart}
                  y1={geomMetrics.maxY}
                  x2={extXEnd}
                  y2={geomMetrics.maxY}
                  stroke={dimColor}
                  strokeWidth={0.75}
                  opacity={0.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Vertical Dimension Line */}
                <line
                  x1={dimX}
                  y1={geomMetrics.minY}
                  x2={dimX}
                  y2={geomMetrics.maxY}
                  stroke={dimColor}
                  strokeWidth={1}
                  vectorEffect="non-scaling-stroke"
                />
                {/* CAD Oblique Ticks at Top */}
                <line
                  x1={dimX - tick}
                  y1={geomMetrics.minY + tick}
                  x2={dimX + tick}
                  y2={geomMetrics.minY - tick}
                  stroke={dimColor}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* CAD Oblique Ticks at Bottom */}
                <line
                  x1={dimX - tick}
                  y1={geomMetrics.maxY + tick}
                  x2={dimX + tick}
                  y2={geomMetrics.maxY - tick}
                  stroke={dimColor}
                  strokeWidth={1.5}
                  vectorEffect="non-scaling-stroke"
                />
                {/* Dimension Text Label */}
                <text
                  x={dimX + 8}
                  y={geomMetrics.cy}
                  textAnchor="start"
                  dominantBaseline="middle"
                  fill={dimColor}
                  fontSize="11"
                  fontWeight="600"
                  fontFamily="'IBM Plex Mono', monospace"
                  paintOrder="stroke"
                  stroke={isBlueprint ? '#0A1014' : '#EDEAE3'}
                  strokeWidth="4"
                  strokeLinejoin="round"
                >
                  {geomMetrics.height.toFixed(2)} {units}
                </text>
              </g>
            );
          })()}
        </g>
      )}
    </g>
  );
}
