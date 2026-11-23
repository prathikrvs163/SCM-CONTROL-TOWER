import type { ReactNode } from 'react';
import { Search, X } from 'lucide-react';
import { cx } from './cx';

interface FieldProps {
  label: ReactNode;
  required?: boolean;
  hint?: ReactNode;
  className?: string;
  children: ReactNode;
}

/**
 * A labelled form control. The label wraps the control, so tests and
 * assistive tech can find it by label text.
 */
export function Field({
  label,
  required = false,
  hint,
  className,
  children,
}: FieldProps) {
  return (
    <label className={cx('field', className)}>
      <span className="field-label">
        {label}
        {required && ' *'}
      </span>
      {children}
      {hint && <span className="field-hint">{hint}</span>}
    </label>
  );
}

interface SearchInputProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
}

export function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  label,
}: SearchInputProps) {
  return (
    <div className="search-input">
      <Search aria-hidden="true" />
      <input
        className="input"
        type="search"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-label={label ?? placeholder}
      />
      {value && (
        <button
          type="button"
          className="search-clear"
          onClick={() => onChange('')}
          aria-label="Clear search"
        >
          <X />
        </button>
      )}
    </div>
  );
}

export interface SegmentOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

interface SegmentedControlProps<T extends string> {
  value: T;
  options: SegmentOption<T>[];
  onChange: (value: T) => void;
  label: string;
}

export function SegmentedControl<T extends string>({
  value,
  options,
  onChange,
  label,
}: SegmentedControlProps<T>) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="segmented-option"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
        >
          {option.label}
          {option.count !== undefined && (
            <span className="segmented-count">{option.count}</span>
          )}
        </button>
      ))}
    </div>
  );
}
