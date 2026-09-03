import React from 'react';
import { cn } from '../../lib/utils';

export interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  numeric?: boolean;
}

export const Field = React.forwardRef<HTMLInputElement, FieldProps>(
  ({ className, numeric, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn('field', numeric && 'field-numeric', className)}
        {...props}
      />
    );
  }
);
Field.displayName = 'Field';

export const Label = React.forwardRef<HTMLLabelElement, React.LabelHTMLAttributes<HTMLLabelElement>>(
  ({ className, ...props }, ref) => (
    <label ref={ref} className={cn('lbl', className)} {...props} />
  )
);
Label.displayName = 'Label';
