import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Bot,
  ClipboardList,
  Lock,
  RefreshCw,
  ScrollText,
  ShoppingCart,
  Truck,
  UserCog,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchAuditLogs } from '../features/audit/auditSlice';
import AuditChanges from '../features/audit/AuditChanges';
import {
  ENTITY_LABELS,
  formatAuditAction,
} from '../features/audit/auditFormat';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { SearchInput, SegmentedControl } from '../components/ui/Form';
import { Alert, EmptyState, TableSkeleton } from '../components/ui/Feedback';
import { formatDateTime, relativeDay } from '../utils/format';
import type { AuditEntityType, AuditLogEntry } from '../types';

type EntityFilter = 'ALL' | AuditEntityType;

const ENTITY_ICON: Record<AuditEntityType, LucideIcon> = {
  ORDER: ShoppingCart,
  INBOUND_RECEIPT: Truck,
  AI_INTERACTION: Bot,
};

const ENTITY_TONE = {
  ORDER: 'accent',
  INBOUND_RECEIPT: 'info',
  AI_INTERACTION: 'neutral',
} as const;

function isEntityFilter(value: string | null): value is AuditEntityType {
  return value === 'ORDER' || value === 'INBOUND_RECEIPT' || value === 'AI_INTERACTION';
}

/** Where an entry's subject can be opened in the app, if anywhere. */
function entryLink(entry: AuditLogEntry): string | null {
  if (entry.entityType === 'ORDER') return `/orders?order=${entry.entityId}`;
  if (entry.entityType === 'INBOUND_RECEIPT') return '/supply';
  if (entry.entityType === 'AI_INTERACTION' && entry.action === 'AI_CUSTOMER_DRAFT') {
    return `/orders?order=${entry.entityId}`;
  }
  return null;
}

function AuditLog() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { items, loading, error } = useAppSelector((state) => state.audit);

  const [entityFilter, setEntityFilter] = useState<EntityFilter>(() => {
    const fromUrl = searchParams.get('entityType');
    return isEntityFilter(fromUrl) ? fromUrl : 'ALL';
  });
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

  const plannerActions = items.filter((entry) => entry.reason).length;
  const aiInteractions = items.filter(
    (entry) => entry.entityType === 'AI_INTERACTION',
  ).length;
  const failedAi = items.filter(
    (entry) =>
      entry.entityType === 'AI_INTERACTION' &&
      (entry.after as { outcome?: string } | null)?.outcome === 'FAILED',
  ).length;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Intelligence"
        eyebrowIcon={<ScrollText />}
        title="Audit Log"
        description="Every receipt change, order change, planner action and AI generation, newest first. Entries cannot be edited or deleted."
        actions={
          <Button
            icon={<RefreshCw />}
            loading={loading}
            onClick={() =>
              dispatch(
                fetchAuditLogs(
                  entityFilter === 'ALL' ? undefined : { entityType: entityFilter },
                ),
              )
            }
          >
            Refresh
          </Button>
        }
      />

      <div className="stat-grid">
        <StatCard
          index={0}
          label="Entries loaded"
          value={items.length}
          icon={<ClipboardList />}
          tone="accent"
          hint="Latest 200 for the selected entity"
        />
        <StatCard
          index={1}
          label="Planner actions"
          value={plannerActions}
          icon={<UserCog />}
          tone="info"
          hint="Changes recorded with a reason"
          onClick={() => setPlannerOnly(!plannerOnly)}
          active={plannerOnly}
        />
        <StatCard
          index={2}
          label="AI interactions"
          value={aiInteractions}
          icon={<Bot />}
          tone={failedAi > 0 ? 'warning' : 'neutral'}
          hint={failedAi > 0 ? `${failedAi} failed` : 'Successful and failed generations'}
          onClick={() =>
            setEntityFilter(entityFilter === 'AI_INTERACTION' ? 'ALL' : 'AI_INTERACTION')
          }
          active={entityFilter === 'AI_INTERACTION'}
        />
        <StatCard
          index={3}
          label="Integrity"
          value="Append-only"
          icon={<Lock />}
          tone="success"
          hint="Written in the same transaction as each change"
        />
      </div>

      {error && <Alert tone="danger" title="Could not load the audit log">{error}</Alert>}

      <Card>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search reference, action or reason..."
            label="Search audit log"
          />
          <SegmentedControl
            label="Filter by entity"
            value={entityFilter}
            onChange={setEntityFilter}
            options={[
              { value: 'ALL', label: 'All' },
              { value: 'ORDER', label: 'Orders' },
              { value: 'INBOUND_RECEIPT', label: 'Receipts' },
              { value: 'AI_INTERACTION', label: 'AI' },
            ]}
          />
          <label className="checkbox">
            <input
              type="checkbox"
              checked={plannerOnly}
              onChange={(event) => setPlannerOnly(event.target.checked)}
            />
            Planner actions only
          </label>
        </div>

        {loading && items.length === 0 ? (
          <TableSkeleton rows={8} columns={5} />
        ) : filteredEntries.length === 0 ? (
          <EmptyState
            icon={<ScrollText />}
            title="No audit entries match"
            description="Changes appear here as soon as they are made."
          />
        ) : (
          <div className="table-wrap">
            <table className="table audit-table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>Entity</th>
                  <th>Action</th>
                  <th>Changes</th>
                  <th>Actor</th>
                  <th className="actions-cell">
                    <span className="sr-only">Open</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredEntries.map((entry) => {
                  const Icon = ENTITY_ICON[entry.entityType];
                  const link = entryLink(entry);

                  return (
                    <tr key={entry.id}>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span className="cell-primary tabular">
                          {formatDateTime(entry.createdAt)}
                        </span>
                        <span className="cell-secondary">
                          {relativeDay(entry.createdAt)}
                        </span>
                      </td>
                      <td>
                        <div className="audit-entity">
                          <span className="audit-entity-icon" data-entity={entry.entityType}>
                            <Icon aria-hidden="true" />
                          </span>
                          <div>
                            <span className="cell-primary">
                              {entry.entityRef ?? entry.entityId}
                            </span>
                            <span className="cell-secondary">
                              {ENTITY_LABELS[entry.entityType]}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td>
                        <Badge tone={ENTITY_TONE[entry.entityType]}>
                          {formatAuditAction(entry.action)}
                        </Badge>
                        {entry.reason && (
                          <span className="audit-reason">“{entry.reason}”</span>
                        )}
                      </td>
                      <td style={{ minWidth: 240 }}>
                        <AuditChanges entry={entry} />
                      </td>
                      <td className="cell-muted">{entry.actor}</td>
                      <td className="actions-cell">
                        {link && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<ArrowUpRight />}
                            onClick={() => navigate(link)}
                            aria-label={`Open ${entry.entityRef ?? 'record'}`}
                          />
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <span>
            Showing {filteredEntries.length} of {items.length} loaded entries
          </span>
          <span>Actor is “planner” until sign-in is added</span>
        </div>
      </Card>
    </div>
  );
}

export default AuditLog;
