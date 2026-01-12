import React, { TextareaHTMLAttributes, forwardRef } from 'react';

type TextareaVariant = 'underline' | 'box';

interface TerminalTextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  variant?: TextareaVariant;
  label?: string;
  error?: string;
  hint?: string;
  fullWidth?: boolean;
}

export const TerminalTextarea = forwardRef<HTMLTextAreaElement, TerminalTextareaProps>(
  (
    {
      variant = 'box',
      label,
      error,
      hint,
      fullWidth = true,
      className = '',
      rows = 3,
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      font-terminal text-terminal-base text-lumon-text
      bg-transparent px-2 py-2 outline-none
      transition-all duration-150 ease-terminal
      placeholder:text-lumon-text-muted
      resize-none
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
        <textarea
          ref={ref}
          rows={rows}
          className={`
            ${baseStyles}
            ${variantStyles[variant]}
            ${errorStyles}
            ${fullWidth ? 'w-full' : ''}
            terminal-scrollbar
            ${className}
          `}
          style={{ borderRadius: 0 }}
          {...props}
        />
        {error && (
          <p className="font-terminal text-terminal-xs text-lumon-danger mt-1">
            ERROR: {error}
          </p>
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

TerminalTextarea.displayName = 'TerminalTextarea';

export default TerminalTextarea;
