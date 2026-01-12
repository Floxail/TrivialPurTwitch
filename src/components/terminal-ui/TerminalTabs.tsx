import React from 'react';
import { motion } from 'framer-motion';

interface Tab {
  key: string;
  label: string;
  icon?: React.ReactNode;
  badge?: string | number;
}

interface TerminalTabsProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (key: string) => void;
  children: React.ReactNode;
}

export const TerminalTabs: React.FC<TerminalTabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  children,
}) => {
  return (
    <div className="w-full">
      {/* Tab Headers */}
      <div className="flex border-b border-lumon-cyan-dim/30">
        {tabs.map((tab) => {
          const isActive = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              onClick={() => onTabChange(tab.key)}
              className={`
                relative px-4 py-3
                font-terminal text-terminal-sm uppercase tracking-wide-tech
                transition-all duration-150 ease-terminal
                border-b-2 -mb-px
                flex items-center gap-2
                ${
                  isActive
                    ? 'text-lumon-cyan border-lumon-cyan'
                    : 'text-lumon-text-dim border-transparent hover:text-lumon-cyan hover:border-lumon-cyan/30'
                }
              `}
              style={{
                textShadow: isActive ? '0 0 10px rgba(0, 240, 255, 0.3)' : undefined,
              }}
            >
              {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
              {tab.badge !== undefined && (
                <span
                  className={`
                    ml-1 px-1.5 py-0.5
                    text-terminal-xs
                    ${isActive ? 'bg-lumon-cyan/20 text-lumon-cyan' : 'bg-lumon-text-muted/20 text-lumon-text-muted'}
                  `}
                >
                  {tab.badge}
                </span>
              )}
              {isActive && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute bottom-0 left-0 right-0 h-0.5 bg-lumon-cyan"
                  style={{ boxShadow: '0 0 10px rgba(0, 240, 255, 0.5)' }}
                />
              )}
            </button>
          );
        })}
        {/* Filler */}
        <div className="flex-1" />
      </div>

      {/* Tab Content */}
      <div className="pt-4">{children}</div>
    </div>
  );
};

interface TerminalTabPanelProps {
  tabKey: string;
  activeTab: string;
  children: React.ReactNode;
}

export const TerminalTabPanel: React.FC<TerminalTabPanelProps> = ({
  tabKey,
  activeTab,
  children,
}) => {
  if (tabKey !== activeTab) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.div>
  );
};

export default TerminalTabs;
