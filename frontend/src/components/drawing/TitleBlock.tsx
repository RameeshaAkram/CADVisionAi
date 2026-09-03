import React from 'react';

interface TitleBlockProps {
  titleBlock: any;
  createdAt?: string;
}

export default function TitleBlock({ titleBlock, createdAt }: TitleBlockProps) {
  return (
    <div className="absolute bottom-4 right-4 bg-white border-2 border-black p-4 w-64 font-data text-xs shadow-md">
      <div className="border-b border-black pb-2 mb-2">
        <div className="font-bold uppercase tracking-wider">{titleBlock?.project || 'CAD AI'}</div>
        <div className="text-gray-600">{titleBlock?.part || 'Part 1'}</div>
      </div>
      <div className="flex justify-between mb-2">
        <span>Scale: {titleBlock?.scale || '1:1'}</span>
        <span>Units: {titleBlock?.units || 'mm'}</span>
      </div>
      {createdAt && (
        <div className="mb-2">
          Date: {new Date(createdAt).toLocaleDateString()}
        </div>
      )}
      <div className="text-[10px] text-gray-500 italic mt-2 border-t border-black pt-2">
        AI-assisted reconstruction — not a metrology record
      </div>
    </div>
  );
}
