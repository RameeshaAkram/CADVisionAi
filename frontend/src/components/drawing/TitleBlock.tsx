
interface TitleBlockProps {
  titleBlock?: any;
  createdAt?: string;
  theme?: 'blueprint' | 'paper';
  units?: string;
}

export default function TitleBlock({ titleBlock, createdAt, theme = 'paper', units }: TitleBlockProps) {
  const isBlueprint = theme === 'blueprint';
  const effectiveUnits = units || titleBlock?.units || 'mm';

  return (
    <div className={`absolute bottom-4 right-4 border z-20 font-data text-[11px] shadow-lg pointer-events-none select-none transition-colors duration-150 ${
      isBlueprint
        ? 'bg-[rgba(14,22,26,0.92)] border-[rgba(56,189,248,0.4)] text-[var(--g-200)]'
        : 'bg-[rgba(255,255,255,0.95)] border-[var(--g-700)] text-[var(--g-100)]'
    } w-[240px] p-3`}>
      {/* Header */}
      <div className={`border-b pb-1.5 mb-2 flex justify-between items-baseline ${
        isBlueprint ? 'border-[rgba(56,189,248,0.25)]' : 'border-[var(--g-700)]'
      }`}>
        <span className="font-bold uppercase tracking-wider text-[12px] text-[var(--cyan-500)]">
          {titleBlock?.title || 'CADVision AI'}
        </span>
        <span className="text-[10px] text-[var(--g-400)]">ISO 7200</span>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-2 gap-y-1 gap-x-2 text-[11px]">
        <div>
          <span className="text-[var(--g-400)] block text-[9px] uppercase tracking-wider">Projection</span>
          <span className="font-medium">1st Angle Ortho</span>
        </div>
        <div>
          <span className="text-[var(--g-400)] block text-[9px] uppercase tracking-wider">Units</span>
          <span className="font-semibold text-[var(--cyan-500)] uppercase">{effectiveUnits}</span>
        </div>
        <div>
          <span className="text-[var(--g-400)] block text-[9px] uppercase tracking-wider">Format</span>
          <span>AutoCAD R2018</span>
        </div>
        <div>
          <span className="text-[var(--g-400)] block text-[9px] uppercase tracking-wider">Date</span>
          <span>{createdAt ? new Date(createdAt).toLocaleDateString() : new Date().toLocaleDateString()}</span>
        </div>
      </div>

      {/* Footer Note */}
      <div className={`mt-2 pt-1.5 border-t text-[9px] leading-tight ${
        isBlueprint ? 'border-[rgba(56,189,248,0.2)] text-[var(--g-400)]' : 'border-[var(--g-700)] text-[var(--g-400)]'
      }`}>
        {titleBlock?.note || 'AI-assisted reconstruction. Verify critical dimensions before CNC/laser cutting.'}
      </div>
    </div>
  );
}
