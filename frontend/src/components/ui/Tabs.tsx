import React from 'react';
import { cn } from '../../lib/utils';

interface TabsProps extends React.HTMLAttributes<HTMLDivElement> {}

export function Tabs({ className, ...props }: TabsProps) {
  return <div className={cn('tabs', className)} {...props} />;
}

interface TabProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean;
}

export function Tab({ className, selected, ...props }: TabProps) {
  return (
    <button
      className={cn('tab', selected && 'sel', className)}
      {...props}
    />
  );
}
