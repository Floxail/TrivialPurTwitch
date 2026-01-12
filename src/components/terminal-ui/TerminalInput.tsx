import React, { InputHTMLAttributes, forwardRef, useState } from 'react';
import { motion } from 'framer-motion';

type InputVariant = 'underline' | 'box';

interface TerminalInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'size'> {
  variant?: InputVariant;
  label?: string;
  error?: string;
  hint?: string;
  showCursor?: boolean;
  fullWidth?: boolean;
}

export const TerminalInput = forwardRef<HTMLInputElement, TerminalInputProps>(
  (
    {
      variant = 'underline',
      label,
      error,
      hint,
      showCursor = false,
      fullWidth = true,
      className = '',
      ...props
    },
    ref
  ) => {
    const [isFocused, setIsFocused] = useState(false);

    const baseStyles = `
      font-terminal text-terminal-base text-lumon-text
      bg-transparent px-2 py-2 outline-none
      transition-all duration-150 ease-terminal
      placeholder:text-lumon-text-muted
    `;

    const variantStyles = {
      underline: `
        border-0 border-b border-lumon-cyan-dim
        focus:border-lumon-cyan
      `,
      box: `
        border border-lumon-cyan-dim bg-lumon-void/50
        focus:border-lumon-cyan
      `,
    };

    const errorStyles = error
      ? 'border-lumon-danger focus:border-lumon-danger'
      : '';

    return (
      <div className={`${fullWidth ? 'w-full' : ''}`}>
        {label && (
          <label className="block font-terminal text-terminal-xs uppercase tracking-wide-tech text-lumon-text-dim mb-1">
            {label}
          </label>
        )}
        <div className="relative">
          <input
            ref={ref}
            className={`
              ${baseStyles}
              ${variantStyles[variant]}
              ${errorStyles}
              ${fullWidth ? 'w-full' : ''}
              ${className}
            `}
            style={{ borderRadius: 0 }}
            onFocus={(e) => {
              setIsFocused(true);
              props.onFocus?.(e);
            }}
            onBlur={(e) => {
              setIsFocused(false);
              props.onBlur?.(e);
            }}
            {...props}
          />
          {showCursor && isFocused && (
            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-lumon-cyan animate-cursor-blink">
              █
            </span>
          )}
        </div>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            className="font-terminal text-terminal-xs text-lumon-danger mt-1"
          >
            ERROR: {error}
          </motion.p>
        )}
        {hint && !error && (
          <p className="font-terminal text-terminal-xs text-lumon-text-muted mt-1">
            {hint}
          </p>
        )}
      </div>
    );
  }
);

TerminalInput.displayName = 'TerminalInput';

export default TerminalInput;
