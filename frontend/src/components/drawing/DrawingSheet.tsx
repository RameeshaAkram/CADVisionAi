import React, { useRef, useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJobDrawing } from '../../api/exports';
import OrthoView from './OrthoView';
import TitleBlock from './TitleBlock';

interface DrawingSheetProps {
  jobId: string;
  createdAt?: string;
}

export default function DrawingSheet({ jobId, createdAt }: DrawingSheetProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scale] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const { data: drawing, isLoading, error } = useQuery({
    queryKey: ['jobDrawing', jobId],
    queryFn: () => getJobDrawing(jobId),
    retry: false
  });

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };

  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const preventDefault = (e: WheelEvent) => e.preventDefault();
    el.addEventListener('wheel', preventDefault, { passive: false });
    return () => el.removeEventListener('wheel', preventDefault);
  }, []);

  if (isLoading) {
    return <div className="text-[var(--g-400)] font-data text-[13px]">Loading drawing...</div>;
  }

  if (error || !drawing) {
    return <div className="text-[var(--g-400)] font-data text-[13px]">Drawing is not ready yet.</div>;
  }

  return (
    <div 
      ref={containerRef}
      className="absolute inset-0 overflow-hidden bg-[var(--paper)]"
      style={{
        '--paper': '#EDEAE3',
        '--paper-line': '#DAD5CB'
      } as any}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
    >
      {/* Background grid */}
      <div 
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: `
            linear-gradient(to right, var(--paper-line) 1px, transparent 1px),
            linear-gradient(to bottom, var(--paper-line) 1px, transparent 1px)
          `,
          backgroundSize: `${20 * scale}px ${20 * scale}px`,
          backgroundPosition: `${pan.x}px ${pan.y}px`,
          opacity: 0.5
        }}
      />
      
      {/* SVG Canvas */}
      <div 
        className="absolute origin-center"
        style={{
          transform: `translate(${pan.x}px, ${pan.y}px) scale(${scale})`,
          left: '50%',
          top: '50%',
          width: 0,
          height: 0
        }}
      >
        <svg style={{ overflow: 'visible' }}>
          {drawing.views && Object.entries(drawing.views).map(([name, view]: [string, any]) => (
             <OrthoView key={name} view={view} />
          ))}
        </svg>
      </div>

      <TitleBlock titleBlock={drawing.title_block} createdAt={createdAt} />
    </div>
  );
}
