import { useEffect, useMemo, useState } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchAuditLogs } from '../features/audit/auditSlice';
import AuditChanges from '../features/audit/AuditChanges';
import {
  ENTITY_LABELS,
  formatAuditAction,
} from '../features/audit/auditFormat';
import type { AuditEntityType } from '../types';

type EntityFilter = 'ALL' | AuditEntityType;

function AuditLog() {
  const dispatch = useAppDispatch();
  const { items, loading, error } = useAppSelector((state) => state.audit);

  const [entityFilter, setEntityFilter] = useState<EntityFilter>('ALL');
  const [plannerOnly, setPlannerOnly] = useState(false);
  const [search, setSearch] = useState('');

  useEffect(() => {
    dispatch(
      fetchAuditLogs(
        entityFilter === 'ALL' ? undefined : { entityType: entityFilter },
      ),
    );
  }, [dispatch, entityFilter]);

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((entry) => {
      // Planner actions are the entries that carry a reason.
      if (plannerOnly && !entry.reason) return false;

      if (!term) return true;

      return [
        entry.entityRef,
        entry.action,
        formatAuditAction(entry.action),
        entry.reason,
        entry.actor,
      ].some((value) => value?.toLowerCase().includes(term));
    });
  }, [items, plannerOnly, search]);

  return (
    <div className="page-container audit-page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">TRACEABILITY</p>
          <h1>Audit Log</h1>
          <p>
            Every receipt change, order change, planner action and AI
            generation, newest first.
          </p>
        </div>

        <button
          className="secondary-button"
          disabled={loading}
          onClick={() =>
            dispatch(
              fetchAuditLogs(
                entityFilter === 'ALL'
                  ? undefined
                  : { entityType: entityFilter },
              ),
            )
          }
        >
          Refresh
        </button>
      </div>

      {error && <div className="form-error">{error}</div>}

      <section className="sku-table-panel">
        <div className="sku-toolbar order-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search reference, action or reason..."
            aria-label="Search audit log"
          />

          <select
            value={entityFilter}
            onChange={(event) =>
              setEntityFilter(event.target.value as EntityFilter)
            }
            aria-label="Filter by entity"
          >
            <option value="ALL">All entities</option>
            <option value="ORDER">Orders</option>
            <option value="INBOUND_RECEIPT">Receipts</option>
            <option value="AI_INTERACTION">AI interactions</option>
          </select>

          <label className="audit-toggle">
            <input
              type="checkbox"
              checked={plannerOnly}
              onChange={(event) => setPlannerOnly(event.target.checked)}
            />
            Planner actions only
          </label>
        </div>

        {loading && items.length === 0 ? (
          <div className="empty-state">Loading audit log...</div>
        ) : filteredEntries.length === 0 ? (
          <div className="empty-state">No audit entries match.</div>
        ) : (
          <div className="table-responsive">
            <table className="sku-table audit-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Reason</th>
                  <th>Changes</th>
                  <th>Actor</th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => (
                  <tr key={entry.id}>
                    <td>{new Date(entry.createdAt).toLocaleString()}</td>
                    <td>
                      <strong>{entry.entityRef ?? entry.entityId}</strong>
                      <span className="table-subtext">
                        {ENTITY_LABELS[entry.entityType]}
                      </span>
                    </td>
                    <td>{formatAuditAction(entry.action)}</td>
                    <td>{entry.reason ?? '—'}</td>
                    <td>
                      <AuditChanges entry={entry} />
                    </td>
                    <td>{entry.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <p className="muted-text">
          Showing the latest {items.length} entries. Entries cannot be edited
          or deleted from the app.
        </p>
      </section>
    </div>
  );
}

export default AuditLog;
