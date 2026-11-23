const DAY_MS = 24 * 60 * 60 * 1000;

export function formatNumber(value: number): string {
  return value.toLocaleString();
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatShortDate(value: string | Date): string {
  return new Date(value).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  return new Date(value).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatTime(value: string | Date): string {
  return new Date(value).toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function startOfDay(date: Date): number {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  ).getTime();
}

/** Whole calendar days from today to the given date (negative = past). */
export function daysFromToday(value: string | Date, now = new Date()): number {
  return Math.round((startOfDay(new Date(value)) - startOfDay(now)) / DAY_MS);
}

/** Whole calendar days from `from` to `to`. */
export function daysBetween(from: string | Date, to: string | Date): number {
  return Math.round(
    (startOfDay(new Date(to)) - startOfDay(new Date(from))) / DAY_MS,
  );
}

export function relativeDay(value: string | Date, now = new Date()): string {
  const days = daysFromToday(value, now);

  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days === -1) return 'Yesterday';
  if (days > 1) return `In ${days} days`;
  return `${Math.abs(days)} days ago`;
}

export function pluralize(count: number, singular: string, plural?: string) {
  return `${count.toLocaleString()} ${count === 1 ? singular : (plural ?? `${singular}s`)}`;
}
