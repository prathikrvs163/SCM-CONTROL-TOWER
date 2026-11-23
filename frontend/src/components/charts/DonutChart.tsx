import { useState } from 'react';
import { cx } from '../ui/cx';

export interface DonutSegment {
  key: string;
  label: string;
  value: number;
  color: string;
}

interface DonutChartProps {
  segments: DonutSegment[];
  centerLabel: string;
  size?: number;
  thickness?: number;
  /** Hide zero-value rows from the legend. */
  hideEmpty?: boolean;
}

/**
 * Donut with an interactive legend. Hovering or focusing a legend row (or a
 * slice) highlights it and shows its value in the center.
 */
export function DonutChart({
  segments,
  centerLabel,
  size = 148,
  thickness = 16,
  hideEmpty = false,
}: DonutChartProps) {
  const [activeKey, setActiveKey] = useState<string | null>(null);

  const total = segments.reduce((sum, segment) => sum + segment.value, 0);
  const radius = (size - thickness) / 2;
  const circumference = 2 * Math.PI * radius;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 2 : 0;

  // Each arc starts where the previous one ended.
  const arcs = segments
    .filter((segment) => segment.value > 0)
    .reduce<
      Array<DonutSegment & { dash: number; offset: number; end: number }>
    >((list, segment) => {
      const start = list.length > 0 ? list[list.length - 1].end : 0;
      const length = (segment.value / total) * circumference;
      return [
        ...list,
        {
          ...segment,
          dash: Math.max(length - gap, 0.001),
          offset: start,
          end: start + length,
        },
      ];
    }, []);

  const active = segments.find((segment) => segment.key === activeKey);
  const listed = hideEmpty
    ? segments.filter((segment) => segment.value > 0)
    : segments;

  return (
    <div className="donut-layout">
      <div className="donut" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label={segments
            .map((segment) => `${segment.label}: ${segment.value}`)
            .join(', ')}
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--chart-track)"
            strokeWidth={thickness}
          />
          <g transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            {arcs.map((arc) => (
              <circle
                key={arc.key}
                cx={size / 2}
                cy={size / 2}
                r={radius}
                fill="none"
                stroke={arc.color}
                strokeWidth={activeKey === arc.key ? thickness + 4 : thickness}
                strokeDasharray={`${arc.dash} ${circumference}`}
                strokeDashoffset={-arc.offset}
                opacity={activeKey && activeKey !== arc.key ? 0.35 : 1}
                onMouseEnter={() => setActiveKey(arc.key)}
                onMouseLeave={() => setActiveKey(null)}
              />
            ))}
          </g>
        </svg>
        <div className="donut-center">
          <span className="donut-center-value">
            {(active ? active.value : total).toLocaleString()}
          </span>
          <span className="donut-center-label">
            {active ? active.label : centerLabel}
          </span>
        </div>
      </div>

      <ul className="donut-list">
        {listed.map((segment) => (
          <li
            key={segment.key}
            className={cx(
              'donut-list-item',
              activeKey === segment.key && 'is-active',
            )}
            tabIndex={0}
            onMouseEnter={() => setActiveKey(segment.key)}
            onMouseLeave={() => setActiveKey(null)}
            onFocus={() => setActiveKey(segment.key)}
            onBlur={() => setActiveKey(null)}
          >
            <span
              className="chart-swatch"
              style={{ background: segment.color }}
            />
            <span className="donut-list-label">{segment.label}</span>
            <span className="donut-list-value">
              {segment.value.toLocaleString()}
            </span>
            <span className="donut-list-pct">
              {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
