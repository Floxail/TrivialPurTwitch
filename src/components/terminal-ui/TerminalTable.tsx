import React from 'react';
import { motion } from 'framer-motion';

interface Column<T> {
  key: string;
  header: string;
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
  align?: 'left' | 'center' | 'right';
}

interface TerminalTableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  onRowClick?: (item: T) => void;
  selectedKeys?: Set<string>;
  onSelectionChange?: (keys: Set<string>) => void;
  selectable?: boolean;
  emptyMessage?: string;
  loading?: boolean;
  maxHeight?: string;
}

export function TerminalTable<T>({
  columns,
  data,
  keyExtractor,
  onRowClick,
  selectedKeys = new Set(),
  onSelectionChange,
  selectable = false,
  emptyMessage = 'NO DATA FOUND',
  loading = false,
  maxHeight = '500px',
}: TerminalTableProps<T>) {
  const handleSelectAll = () => {
    if (!onSelectionChange) return;
    if (selectedKeys.size === data.length) {
      onSelectionChange(new Set());
    } else {
      onSelectionChange(new Set(data.map(keyExtractor)));
    }
  };

  const handleSelectRow = (key: string) => {
    if (!onSelectionChange) return;
    const newSelection = new Set(selectedKeys);
    if (newSelection.has(key)) {
      newSelection.delete(key);
    } else {
      newSelection.add(key);
    }
    onSelectionChange(newSelection);
  };

  const alignClass = (align?: 'left' | 'center' | 'right') => {
    switch (align) {
      case 'center':
        return 'text-center';
      case 'right':
        return 'text-right';
      default:
        return 'text-left';
    }
  };

  return (
    <div
      className="border border-lumon-cyan-dim/30 bg-lumon-dark/50 overflow-hidden"
      style={{ maxHeight }}
    >
      {/* Table Header */}
      <div className="bg-lumon-void/80 border-b border-lumon-cyan-dim/50 sticky top-0 z-10">
        <div className="flex items-center">
          {selectable && (
            <div className="w-12 flex-shrink-0 px-3 py-3">
              <input
                type="checkbox"
                checked={data.length > 0 && selectedKeys.size === data.length}
                onChange={handleSelectAll}
                className="terminal-checkbox"
              />
            </div>
          )}
          {columns.map((col) => (
            <div
              key={col.key}
              className={`
                flex-1 px-3 py-3
                font-terminal text-terminal-xs uppercase tracking-wide-tech
                text-lumon-cyan
                ${alignClass(col.align)}
              `}
              style={{ width: col.width, flexBasis: col.width, flexGrow: col.width ? 0 : 1 }}
            >
              {col.header}
            </div>
          ))}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-y-auto terminal-scrollbar" style={{ maxHeight: `calc(${maxHeight} - 48px)` }}>
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="font-terminal text-terminal-base text-lumon-cyan animate-pulse">
              LOADING DATA...
            </div>
          </div>
        ) : data.length === 0 ? (
          <div className="flex items-center justify-center py-12">
            <div className="text-center">
              <div className="font-terminal text-terminal-base text-lumon-text-muted">
                {emptyMessage}
              </div>
              <div className="font-terminal text-terminal-xs text-lumon-text-muted/50 mt-1">
                [RECORDS: 0]
              </div>
            </div>
          </div>
        ) : (
          data.map((item, index) => {
            const key = keyExtractor(item);
            const isSelected = selectedKeys.has(key);

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: index * 0.02 }}
                className={`
                  flex items-center
                  border-b border-lumon-cyan-dim/10
                  transition-all duration-150 ease-terminal
                  ${onRowClick ? 'cursor-pointer' : ''}
                  ${isSelected ? 'bg-lumon-cyan/10 border-lumon-cyan-dim/30' : 'hover:bg-lumon-cyan/5'}
                `}
                onClick={() => onRowClick?.(item)}
              >
                {selectable && (
                  <div className="w-12 flex-shrink-0 px-3 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={(e) => {
                        e.stopPropagation();
                        handleSelectRow(key);
                      }}
                      className="terminal-checkbox"
                    />
                  </div>
                )}
                {columns.map((col) => (
                  <div
                    key={col.key}
                    className={`
                      flex-1 px-3 py-3
                      font-terminal text-terminal-base text-lumon-text
                      ${alignClass(col.align)}
                      truncate
                    `}
                    style={{ width: col.width, flexBasis: col.width, flexGrow: col.width ? 0 : 1 }}
                  >
                    {col.render
                      ? col.render(item, index)
                      : (item as any)[col.key]}
                  </div>
                ))}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Table Footer */}
      <div className="bg-lumon-void/80 border-t border-lumon-cyan-dim/30 px-3 py-2 flex items-center justify-between">
        <span className="font-terminal text-terminal-xs text-lumon-text-muted">
          RECORDS: {data.length}
        </span>
        {selectable && selectedKeys.size > 0 && (
          <span className="font-terminal text-terminal-xs text-lumon-cyan">
            SELECTED: {selectedKeys.size}
          </span>
        )}
      </div>
    </div>
  );
}

export default TerminalTable;
