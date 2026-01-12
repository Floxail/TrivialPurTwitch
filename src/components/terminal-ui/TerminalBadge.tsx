import React from 'react';

type BadgeVariant = 'cyan' | 'amber' | 'danger' | 'success' | 'muted';

interface TerminalBadgeProps {
  variant?: BadgeVariant;
  children: React.ReactNode;
  className?: string;
  glow?: boolean;
}

const variantStyles: Record<BadgeVariant, string> = {
  cyan: 'border-lumon-cyan-dim text-lumon-cyan bg-lumon-cyan/10',
  amber: 'border-lumon-amber-dim text-lumon-amber bg-lumon-amber/10',
  danger: 'border-lumon-danger-dim text-lumon-danger bg-lumon-danger/10',
  success: 'border-lumon-success-dim text-lumon-success bg-lumon-success/10',
  muted: 'border-lumon-text-muted text-lumon-text-muted bg-lumon-text-muted/5',
};

const glowStyles: Record<BadgeVariant, string> = {
  cyan: 'shadow-glow-cyan-sm',
  amber: 'shadow-glow-amber-sm',
  danger: 'shadow-glow-danger',
  success: 'shadow-glow-success',
  muted: '',
};

export const TerminalBadge: React.FC<TerminalBadgeProps> = ({
  variant = 'cyan',
  children,
  className = '',
  glow = false,
}) => {
  return (
    <span
      className={`
        inline-flex items-center
        font-terminal text-terminal-xs uppercase tracking-wide-tech
        px-2 py-0.5 border
        ${variantStyles[variant]}
        ${glow ? glowStyles[variant] : ''}
        ${className}
      `}
      style={{ borderRadius: 0 }}
    >
      {children}
    </span>
  );
};

export default TerminalBadge;
