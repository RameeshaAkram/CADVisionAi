
interface DimensionLineProps {
  dim: any;
}

export default function DimensionLine({ dim }: DimensionLineProps) {
  const isEstimated = dim.level === 'estimated';
  
  const strokeColor = isEstimated ? '#9A6B0C' : '#14707E';
  const strokeWidth = 1.5;
  const strokeDasharray = isEstimated ? '4 2' : 'none';

  return (
    <g>
      {/* Dimension Line */}
      <line 
        x1={dim.x1} 
        y1={dim.y1} 
        x2={dim.x2} 
        y2={dim.y2} 
        stroke={strokeColor}
        strokeWidth={strokeWidth}
        strokeDasharray={strokeDasharray}
        fill="none"
      />
      
      {/* Ticks */}
      <circle 
        cx={dim.x1} 
        cy={dim.y1} 
        r={2} 
        stroke={strokeColor} 
        fill={isEstimated ? 'none' : strokeColor} 
        strokeWidth={1}
      />
      <circle 
        cx={dim.x2} 
        cy={dim.y2} 
        r={2} 
        stroke={strokeColor} 
        fill={isEstimated ? 'none' : strokeColor} 
        strokeWidth={1}
      />

      {/* Text Background (Optional for readability) */}
      <rect
        x={dim.text_x - 10}
        y={dim.text_y - 6}
        width={20}
        height={12}
        fill="var(--paper)"
      />

      {/* Text */}
      <text 
        x={dim.text_x} 
        y={dim.text_y} 
        fill={strokeColor}
        fontSize={12}
        fontFamily="IBM Plex Mono, monospace"
        textAnchor="middle"
        dominantBaseline="middle"
      >
        {dim.text}
      </text>
    </g>
  );
}
