import React from 'react';
import { cn } from '../../lib/utils';
import { type ConfidenceLevel, getConfidenceTheme } from '../../lib/confidence';

interface ChipProps extends React.HTMLAttributes<HTMLSpanElement> {
  level: ConfidenceLevel;
  label: string;
}

export function Chip({ level, label, className, ...props }: ChipProps) {
  const theme = getConfidenceTheme(level);

  return (
    <span className={cn('chip', theme.className, className)} {...props}>
      {theme.glyph} {label}
    </span>
  );
}
