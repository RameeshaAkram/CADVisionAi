import { useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { formatByConfidence } from '../../lib/confidence';
import type { ConfidenceLevel } from '../../lib/confidence';

interface DimensionOverlayProps {
  measurements: any[];
  extents: { x: number, y: number, z: number };
  visible: boolean;
}

export default function DimensionOverlay({ measurements, extents, visible }: DimensionOverlayProps) {
  if (!visible || !measurements || measurements.length === 0) return null;

  const lines = useMemo(() => {
    const res = [];
    
    const w = extents.x;
    const h = extents.y;
    const d = extents.z;

    const findM = (labelStr: string) => measurements.find(m => m.id === labelStr);

    // Height (Y)
    const mHeight = findM('height');
    if (mHeight) {
      res.push({
        id: 'height',
        m: mHeight,
        points: [[w/2 + 0.1, 0, d/2], [w/2 + 0.1, h, d/2]] as [number, number, number][],
        mid: [w/2 + 0.1, h/2, d/2] as [number, number, number],
      });
    }

    // Width (X)
    const mWidth = findM('width');
    if (mWidth) {
      res.push({
        id: 'width',
        m: mWidth,
        points: [[-w/2, 0, d/2 + 0.1], [w/2, 0, d/2 + 0.1]] as [number, number, number][],
        mid: [0, 0, d/2 + 0.1] as [number, number, number],
      });
    }

    // Depth (Z)
    const mDepth = findM('depth');
    if (mDepth) {
      res.push({
        id: 'depth',
        m: mDepth,
        points: [[w/2 + 0.1, 0, -d/2], [w/2 + 0.1, 0, d/2]] as [number, number, number][],
        mid: [w/2 + 0.1, 0, 0] as [number, number, number],
      });
    }

    return res;
  }, [measurements, extents]);

  return (
    <group>
      {lines.map(line => {
        const { m, points, mid } = line;
        const level = m.level as ConfidenceLevel;
        
        let color = '#38bdf8'; // cyan-400
        if (level === 'estimated') color = '#fbbf24'; // amber-400
        if (level === 'low') color = '#f87171'; // red-400

        const dashed = level === 'estimated';
        const dotted = level === 'low';
        
        const dashSize = dashed ? 0.2 : (dotted ? 0.05 : 0);
        const gapSize = dashed ? 0.15 : (dotted ? 0.1 : 0);

        const valueText = formatByConfidence(level, m.value, m.units, m.tolerance, m.min, m.max);

        return (
          <group key={line.id}>
            <Line
              points={points}
              color={color}
              lineWidth={1.5}
              dashed={dashed || dotted}
              dashSize={dashSize}
              gapSize={gapSize}
            />
            <Html position={mid} center className="pointer-events-none">
              <div 
                className="px-1.5 py-0.5 rounded shadow-sm text-[11px] font-data whitespace-nowrap"
                style={{
                  backgroundColor: 'var(--g-850)',
                  border: `1px solid ${color}`,
                  color: 'white'
                }}
              >
                {level === 'low' && <span className="mr-1 text-red-400 font-bold">!</span>}
                {valueText}
                {level === 'measured' && <span className="ml-1.5 text-[9px] uppercase tracking-wider text-cyan-400">Known</span>}
              </div>
            </Html>
          </group>
        );
      })}
    </group>
  );
}
