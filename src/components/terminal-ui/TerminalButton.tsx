import React, { forwardRef } from 'react';
import { motion, HTMLMotionProps } from 'framer-motion';

type ButtonVariant = 'primary' | 'danger' | 'amber' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface TerminalButtonProps extends Omit<HTMLMotionProps<'button'>, 'size'> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  iconPosition?: 'left' | 'right';
  fullWidth?: boolean;
}

const variantStyles: Record<ButtonVariant, string> = {
  primary: `
    border-lumon-cyan-dim text-lumon-cyan
    hover:bg-lumon-cyan hover:text-lumon-void
    hover:shadow-glow-cyan
  `,
  danger: `
    border-lumon-danger-dim text-lumon-danger
    hover:bg-lumon-danger hover:text-lumon-void
    hover:shadow-glow-danger
  `,
  amber: `
    border-lumon-amber-dim text-lumon-amber
    hover:bg-lumon-amber hover:text-lumon-void
    hover:shadow-glow-amber
  `,
  ghost: `
    border-transparent text-lumon-text-dim
    hover:border-lumon-cyan-dim hover:text-lumon-cyan
  `,
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: 'px-2 py-1 text-terminal-xs',
  md: 'px-4 py-2 text-terminal-sm',
  lg: 'px-6 py-3 text-terminal-base',
};

export const TerminalButton = forwardRef<HTMLButtonElement, TerminalButtonProps>(
  (
    {
      variant = 'primary',
      size = 'md',
      loading = false,
      icon,
      iconPosition = 'left',
      fullWidth = false,
      className = '',
      children,
      disabled,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      font-terminal uppercase tracking-wide-tech
      border bg-transparent cursor-pointer
      transition-all duration-150 ease-terminal
      inline-flex items-center justify-center gap-2
      disabled:border-lumon-text-muted disabled:text-lumon-text-muted
      disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:shadow-none
    `;

    return (
      <motion.button
        ref={ref}
        className={`
          ${baseStyles}
          ${variantStyles[variant]}
          ${sizeStyles[size]}
          ${fullWidth ? 'w-full' : ''}
          ${className}
        `}
        style={{ borderRadius: 0 }}
        disabled={disabled || loading}
        whileTap={!disabled && !loading ? { x: 1, y: 1 } : undefined}
        {...props}
      >
        {loading ? (
          <>
            <LoadingSpinner />
            <span>PROCESSING...</span>
          </>
        ) : (
          <>
            {icon && iconPosition === 'left' && <span className="flex-shrink-0">{icon}</span>}
            {children}
            {icon && iconPosition === 'right' && <span className="flex-shrink-0">{icon}</span>}
          </>
        )}
      </motion.button>
    );
  }
);

TerminalButton.displayName = 'TerminalButton';

const LoadingSpinner = () => (
  <svg
    className="animate-spin h-4 w-4"
    xmlns="http://www.w3.org/2000/svg"
    fill="none"
    viewBox="0 0 24 24"
  >
    <circle
      className="opacity-25"
      cx="12"
      cy="12"
      r="10"
      stroke="currentColor"
      strokeWidth="4"
    />
    <path
      className="opacity-75"
      fill="currentColor"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
    />
  </svg>
);

export default TerminalButton;
