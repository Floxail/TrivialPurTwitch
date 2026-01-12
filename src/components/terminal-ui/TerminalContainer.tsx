import React from 'react';

interface TerminalContainerProps {
  children: React.ReactNode;
  className?: string;
  scanlines?: boolean;
  vignette?: boolean;
  filmGrain?: boolean;
  scanLine?: boolean; // Moving scan line
  fullHeight?: boolean;
}

export const TerminalContainer: React.FC<TerminalContainerProps> = ({
  children,
  className = '',
  scanlines = true,
  vignette = true,
  filmGrain = false,
  scanLine = false,
  fullHeight = true,
}) => {
  const effectClasses = [
    scanlines && 'scanlines-subtle',
    vignette && 'vignette-subtle',
    filmGrain && 'film-grain',
    scanLine && 'scan-line',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <div
      className={`
        bg-lumon-void
        ${fullHeight ? 'min-h-screen' : ''}
        ${effectClasses}
        ${className}
      `}
    >
      {/* System Header Bar */}
      <div className="fixed top-0 left-0 right-0 h-6 bg-lumon-void/95 border-b border-lumon-cyan-dim/20 z-50 flex items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <span className="font-terminal text-terminal-xs text-lumon-cyan">
            LUMON.SYS
          </span>
          <span className="font-terminal text-terminal-xs text-lumon-text-muted">
            v2.0.4
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="font-terminal text-terminal-xs text-lumon-text-muted">
            TERMINAL.ACTIVE
          </span>
          <span className="font-terminal text-terminal-xs text-lumon-success animate-pulse">
            ●
          </span>
        </div>
      </div>

      {/* Main Content */}
      <div className={`relative ${fullHeight ? 'pt-6' : ''}`}>
        {children}
      </div>

      {/* Decorative corner artifacts */}
      <div className="fixed bottom-4 left-4 pointer-events-none">
        <div className="font-terminal text-terminal-xs text-lumon-text-muted/30">
          MDE.SESSION.{Math.random().toString(36).substr(2, 6).toUpperCase()}
        </div>
      </div>
      <div className="fixed bottom-4 right-4 pointer-events-none">
        <div className="font-terminal text-terminal-xs text-lumon-text-muted/30">
          0x{Date.now().toString(16).toUpperCase().slice(-8)}
        </div>
      </div>
    </div>
  );
};

// Simpler panel container without the full-screen treatment
interface TerminalPanelProps {
  children: React.ReactNode;
  className?: string;
  title?: string;
  subtitle?: string;
  glow?: boolean;
  actions?: React.ReactNode;
}

export const TerminalPanel: React.FC<TerminalPanelProps> = ({
  children,
  className = '',
  title,
  subtitle,
  glow = false,
  actions,
}) => {
  return (
    <div
      className={`
        bg-lumon-dark border border-lumon-cyan-dim/30
        ${glow ? 'shadow-glow-cyan-sm' : ''}
        ${className}
      `}
      style={{ borderRadius: 0 }}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between px-4 py-3 border-b border-lumon-cyan-dim/30 bg-lumon-void/50">
          <div>
            {title && (
              <h3 className="font-display text-display-sm uppercase text-lumon-cyan tracking-wide-tech">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="font-terminal text-terminal-xs text-lumon-text-muted mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
};

export default TerminalContainer;
