import type { ReactNode } from 'react';
import { StackedBar } from '../ui/Feedback';
import type { BarSegment } from '../ui/Feedback';

export interface BarListRow {
  key: string;
  label: string;
  sublabel?: string;
  segments: BarSegment[];
  /** Denominator for the bar width; defaults to the largest row total. */
  total?: number;
  value: ReactNode;
}

interface BarListProps {
  rows: BarListRow[];
  /** Scale every row to the largest total, so bar length is comparable. */
  relative?: boolean;
}

/** Labelled horizontal stacked bars, one row per item. */
export function BarList({ rows, relative = true }: BarListProps) {
  const maxTotal = Math.max(
    1,
    ...rows.map(
      (row) =>
        row.total ?? row.segments.reduce((sum, item) => sum + item.value, 0),
    ),
  );

  return (
    <ul className="bar-list">
      {rows.map((row) => {
        const rowTotal =
          row.total ?? row.segments.reduce((sum, item) => sum + item.value, 0);

        return (
          <li className="bar-list-row" key={row.key}>
            <div className="bar-list-label">
              <strong title={row.label}>{row.label}</strong>
              {row.sublabel && <span>{row.sublabel}</span>}
            </div>
            <div
              style={{
                width: relative
                  ? `${Math.max((rowTotal / maxTotal) * 100, 4)}%`
                  : '100%',
              }}
            >
              <StackedBar
                segments={row.segments}
                total={rowTotal}
                label={`${row.label}: ${row.segments
                  .map((item) => `${item.label} ${item.value}`)
                  .join(', ')}`}
              />
            </div>
            <span className="bar-list-value">{row.value}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function ChartLegend({
  items,
}: {
  items: { label: string; color: string }[];
}) {
  return (
    <ul className="chart-legend">
      {items.map((item) => (
        <li className="chart-legend-item" key={item.label}>
          <span className="chart-swatch" style={{ background: item.color }} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
