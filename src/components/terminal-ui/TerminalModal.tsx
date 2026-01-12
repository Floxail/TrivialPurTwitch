import React, { useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';

interface TerminalModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'full';
  showCloseButton?: boolean;
  closeOnBackdrop?: boolean;
  closeOnEscape?: boolean;
  footer?: React.ReactNode;
}

const sizeStyles: Record<string, string> = {
  sm: 'max-w-md',
  md: 'max-w-xl',
  lg: 'max-w-2xl',
  xl: 'max-w-4xl',
  full: 'max-w-[95vw] max-h-[95vh]',
};

export const TerminalModal: React.FC<TerminalModalProps> = ({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  showCloseButton = true,
  closeOnBackdrop = true,
  closeOnEscape = true,
  footer,
}) => {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape' && closeOnEscape) {
        onClose();
      }
    },
    [onClose, closeOnEscape]
  );

  useEffect(() => {
    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
      document.body.style.overflow = 'hidden';
    }
    return () => {
      document.removeEventListener('keydown', handleEscape);
      document.body.style.overflow = 'unset';
    };
  }, [isOpen, handleEscape]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-lumon-void/85 backdrop-blur-sm z-50"
            onClick={closeOnBackdrop ? onClose : undefined}
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className={`
              fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
              bg-lumon-slate border border-lumon-cyan-dim
              w-full ${sizeStyles[size]}
              max-h-[90vh] overflow-hidden
              z-50 flex flex-col
            `}
            style={{
              boxShadow: `
                0 0 30px rgba(0, 240, 255, 0.15),
                0 0 60px rgba(0, 240, 255, 0.08),
                inset 0 0 30px rgba(0, 240, 255, 0.02)
              `,
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-lumon-cyan-dim/50 flex-shrink-0">
              <div className="flex items-center gap-3">
                {/* Decorative corner */}
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-lumon-cyan/50" />
                  <div className="w-2 h-2 bg-lumon-cyan/30" />
                </div>
                <h2 className="font-display text-display-sm uppercase text-lumon-cyan tracking-wide-tech">
                  {title}
                </h2>
              </div>

              {showCloseButton && (
                <button
                  onClick={onClose}
                  className="
                    text-lumon-text-dim hover:text-lumon-cyan
                    transition-colors duration-150
                    p-1 hover:bg-lumon-cyan/10
                  "
                  aria-label="Close modal"
                >
                  <X size={18} />
                </button>
              )}
            </div>

            {/* System status bar */}
            <div className="px-6 py-1 bg-lumon-void/50 border-b border-lumon-cyan-dim/20 flex-shrink-0">
              <div className="flex items-center gap-4">
                <span className="font-terminal text-terminal-xs text-lumon-text-muted">
                  SYS.MODAL.ACTIVE
                </span>
                <span className="font-terminal text-terminal-xs text-lumon-cyan-dim">
                  0x{Math.random().toString(16).substr(2, 8).toUpperCase()}
                </span>
              </div>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-6 terminal-scrollbar">
              {children}
            </div>

            {/* Footer */}
            {footer && (
              <div className="px-6 py-4 border-t border-lumon-cyan-dim/50 bg-lumon-dark/50 flex-shrink-0">
                {footer}
              </div>
            )}

            {/* Decorative corners */}
            <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-lumon-cyan pointer-events-none" />
            <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-lumon-cyan pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-lumon-cyan pointer-events-none" />
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-lumon-cyan pointer-events-none" />
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default TerminalModal;
