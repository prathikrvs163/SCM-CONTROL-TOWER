import { useState } from 'react';
import type { CSSProperties } from 'react';

export interface ColumnDatum {
  key: string;
  label: string;
  value: number;
  /** Lines shown in the tooltip under the value. */
  details?: string[];
  color?: string;
}

interface ColumnChartProps {
  data: ColumnDatum[];
  valueLabel: string;
  height?: number;
}

/**
 * Vertical bars with a tooltip on hover or keyboard focus. Each bar is a
 * focusable button so the chart is usable without a mouse.
 */
export function ColumnChart({
  data,
  valueLabel,
  height = 150,
}: ColumnChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const max = Math.max(1, ...data.map((item) => item.value));

  return (
    <div className="column-chart">
      <div className="column-chart-plot" style={{ height }}>
        {[0.25, 0.5, 0.75].map((fraction) => (
          <span
            key={fraction}
            className="column-chart-gridline"
            style={{ bottom: `${fraction * 100}%` }}
          />
        ))}
        {data.map((item, index) => {
          const pct = (item.value / max) * 100;
          const style: CSSProperties = {
            height: item.value > 0 ? `${Math.max(pct, 3)}%` : '3px',
            animationDelay: `${index * 25}ms`,
            ...(item.color ? { background: item.color } : {}),
          };

          return (
            <button
              key={item.key}
              type="button"
              className="column-chart-col"
              aria-label={`${item.label}: ${item.value.toLocaleString()} ${valueLabel}`}
              onMouseEnter={() => setActiveKey(item.key)}
              onMouseLeave={() => setActiveKey(null)}
              onFocus={() => setActiveKey(item.key)}
              onBlur={() => setActiveKey(null)}
            >
              <span
                className={
                  item.value > 0
                    ? 'column-chart-bar'
                    : 'column-chart-bar is-empty'
                }
                style={style}
              />
              {activeKey === item.key && (
                <span className="chart-tooltip" role="tooltip">
                  <strong>{item.label}</strong>
                  <span>
                    {item.value.toLocaleString()} {valueLabel}
                  </span>
                  {item.details?.map((line) => (
                    <span key={line}>{line}</span>
                  ))}
                </span>
              )}
            </button>
          );
        })}
      </div>
      <div className="column-chart-labels" aria-hidden="true">
        {data.map((item) => (
          <span key={item.key}>{item.label}</span>
        ))}
      </div>
    </div>
  );
}
