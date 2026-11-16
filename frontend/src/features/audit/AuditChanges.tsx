import type { AuditLogEntry } from '../../types';
import { describeAuditChanges } from './auditFormat';

/** Long text fields (AI output) are collapsed behind a toggle. */
const LONG_VALUE_LENGTH = 160;

function AuditChanges({ entry }: { entry: AuditLogEntry }) {
  const changes = describeAuditChanges(entry);

  if (changes.length === 0) {
    return <span className="muted-text">No field changes recorded.</span>;
  }

  return (
    <ul className="audit-changes">
      {changes.map((change) => {
        const value = change.after ?? change.before ?? '';

        if (value.length > LONG_VALUE_LENGTH) {
          return (
            <li key={change.field}>
              <details>
                <summary>{change.field}</summary>
                <pre className="audit-long-value">{value}</pre>
              </details>
            </li>
          );
        }

        return (
          <li key={change.field}>
            <span className="audit-field">{change.field}</span>
            {change.before !== null && change.after !== null ? (
              <>
                <span className="audit-before">{change.before}</span>
                {' → '}
                <span className="audit-after">{change.after}</span>
              </>
            ) : (
              <span className="audit-after">{value}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default AuditChanges;
