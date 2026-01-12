import React, { SelectHTMLAttributes, forwardRef } from 'react';

interface TerminalSelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  fullWidth?: boolean;
  options: Array<{ value: string | number; label: string; disabled?: boolean }>;
  placeholder?: string;
}

export const TerminalSelect = forwardRef<HTMLSelectElement, TerminalSelectProps>(
  (
    {
      label,
      error,
      fullWidth = true,
      options,
      placeholder,
      className = '',
      ...props
    },
    ref
  ) => {
    const baseStyles = `
      font-terminal text-terminal-base text-lumon-text
      bg-lumon-void border border-lumon-cyan-dim
      px-3 py-2 cursor-pointer outline-none
      transition-all duration-150 ease-terminal
      focus:border-lumon-cyan focus:shadow-glow-cyan-sm
      appearance-none
    `;

    const arrowIcon = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'%3E%3Cpath fill='%2300F0FF' d='M2 4l4 4 4-4'/%3E%3C/svg%3E")`;

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
        <select
          ref={ref}
          className={`
            ${baseStyles}
            ${errorStyles}
            ${fullWidth ? 'w-full' : ''}
            ${className}
          `}
          style={{
            borderRadius: 0,
            backgroundImage: arrowIcon,
            backgroundRepeat: 'no-repeat',
            backgroundPosition: 'right 10px center',
            paddingRight: '30px',
          }}
          {...props}
        >
          {placeholder && (
            <option value="" disabled>
              {placeholder}
            </option>
          )}
          {options.map((opt) => (
            <option
              key={opt.value}
              value={opt.value}
              disabled={opt.disabled}
              className="bg-lumon-slate text-lumon-text"
            >
              {opt.label}
            </option>
          ))}
        </select>
        {error && (
          <p className="font-terminal text-terminal-xs text-lumon-danger mt-1">
            ERROR: {error}
          </p>
        )}
      </div>
    );
  }
);

TerminalSelect.displayName = 'TerminalSelect';

export default TerminalSelect;
