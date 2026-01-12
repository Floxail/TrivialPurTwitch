import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';

type AlertVariant = 'info' | 'success' | 'warning' | 'danger';

interface TerminalAlertProps {
  variant?: AlertVariant;
  title?: string;
  children: React.ReactNode;
  dismissible?: boolean;
  onDismiss?: () => void;
  className?: string;
  show?: boolean;
}

const variantStyles: Record<AlertVariant, { border: string; bg: string; text: string; icon: React.ReactNode }> = {
  info: {
    border: 'border-lumon-cyan-dim',
    bg: 'bg-lumon-cyan/5',
    text: 'text-lumon-cyan',
    icon: <Info size={18} />,
  },
  success: {
    border: 'border-lumon-success-dim',
    bg: 'bg-lumon-success/5',
    text: 'text-lumon-success',
    icon: <CheckCircle size={18} />,
  },
  warning: {
    border: 'border-lumon-amber-dim',
    bg: 'bg-lumon-amber/5',
    text: 'text-lumon-amber',
    icon: <AlertTriangle size={18} />,
  },
  danger: {
    border: 'border-lumon-danger-dim',
    bg: 'bg-lumon-danger/5',
    text: 'text-lumon-danger',
    icon: <XCircle size={18} />,
  },
};

export const TerminalAlert: React.FC<TerminalAlertProps> = ({
  variant = 'info',
  title,
  children,
  dismissible = false,
  onDismiss,
  className = '',
  show = true,
}) => {
  const styles = variantStyles[variant];

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          transition={{ duration: 0.2 }}
          className={`
            ${styles.border} ${styles.bg}
            border p-3
            ${className}
          `}
          style={{ borderRadius: 0 }}
        >
          <div className="flex items-start gap-3">
            <span className={`${styles.text} flex-shrink-0 mt-0.5`}>
              {styles.icon}
            </span>
            <div className="flex-1 min-w-0">
              {title && (
                <div className={`font-terminal text-terminal-sm uppercase tracking-wide-tech ${styles.text} mb-1`}>
                  {title}
                </div>
              )}
              <div className="font-terminal text-terminal-base text-lumon-text">
                {children}
              </div>
            </div>
            {dismissible && onDismiss && (
              <button
                onClick={onDismiss}
                className={`
                  ${styles.text} opacity-70 hover:opacity-100
                  transition-opacity duration-150
                  p-0.5
                `}
              >
                <X size={16} />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default TerminalAlert;
