import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getJobExports } from '../../api/exports';
import { Button } from '../ui/Button';

interface ExportPopoverProps {
  jobId: string;
}

export default function ExportPopover({ jobId }: ExportPopoverProps) {
  const [isOpen, setIsOpen] = useState(false);

  const { data: exportsData, isLoading } = useQuery({
    queryKey: ['jobExports', jobId],
    queryFn: () => getJobExports(jobId),
    enabled: isOpen
  });


  return (
    <div className="relative w-full">
      <Button 
        variant="primary" 
        className="w-full mt-6"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
      >
        Export
      </Button>
      
      {isOpen && (
        <div className="absolute bottom-full left-0 w-full mb-2 bg-[var(--g-850)] border border-[var(--g-700)] rounded-md shadow-lg p-4 z-50">
          <div className="font-semibold text-[14px] text-white mb-3">Export Files</div>
          
          {isLoading ? (
            <div className="text-[13px] text-[var(--g-400)]">Loading exports...</div>
          ) : (
            <div className="flex flex-col gap-3">
              {exportsData?.files.map((file, i) => (
                <div key={i} className="flex flex-col border-b border-[var(--g-700)] pb-3 last:border-0 last:pb-0">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-[13px] font-medium text-[var(--g-100)] uppercase">{file.kind}</span>
                    {file.ready ? (
                      <a 
                        href={file.url!} 
                        download
                        className="text-[12px] font-semibold text-[var(--cyan-400)] hover:text-[var(--cyan-300)]"
                      >
                        Download
                      </a>
                    ) : (
                      <span className="text-[12px] text-[var(--g-500)]">Not ready</span>
                    )}
                  </div>
                  <div className="text-[11px] text-[var(--g-400)]">{file.description}</div>
                  {file.size && (
                    <div className="text-[11px] font-data text-[var(--g-500)] mt-1">
                      {(file.size / 1024).toFixed(1)} KB
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
          
          <div className="mt-3 pt-3 border-t border-[var(--g-700)] text-[11px] text-[var(--amber-400)] leading-tight">
            Dimensions marked estimated are AI-derived. Verify against the physical part before manufacturing.
          </div>
        </div>
      )}
    </div>
  );
}
