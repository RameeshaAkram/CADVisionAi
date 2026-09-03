import React from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'accent' | 'danger' | 'danger-solid';
  size?: 'sm' | 'md' | 'lg';
  isLoading?: boolean;
  loadingText?: string;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'primary', size = 'md', isLoading, loadingText, children, disabled, ...props }, ref) => {
    
    // Map our tokens.css classes
    const variantClass = {
      'primary': 'btn-primary',
      'secondary': 'btn-secondary',
      'ghost': 'btn-ghost',
      'accent': 'btn-accent',
      'danger': 'btn-danger',
      'danger-solid': 'btn-danger-solid',
    }[variant];

    const sizeClass = {
      'sm': 'btn-sm',
      'md': '',
      'lg': 'btn-lg',
    }[size];

    return (
      <button
        ref={ref}
        disabled={disabled || isLoading}
        className={cn('btn', variantClass, sizeClass, className)}
        {...props}
      >
        {isLoading && <Loader2 className="w-4 h-4 animate-spin" />}
        {isLoading && loadingText ? loadingText : children}
      </button>
    );
  }
);
Button.displayName = 'Button';
