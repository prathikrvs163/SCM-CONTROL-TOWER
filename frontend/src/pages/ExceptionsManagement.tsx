import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowUpRight,
  CircleCheck,
  Clock,
  Layers,
  List,
  PackageX,
  RefreshCw,
  Sparkles,
  TriangleAlert,
  Truck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  clearExceptionError,
  fetchExceptions,
} from '../features/exceptions/exceptionSlice';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { SearchInput, SegmentedControl } from '../components/ui/Form';
import {
  Alert,
  EmptyState,
  Skeleton,
  StackedBar,
} from '../components/ui/Feedback';
import { PriorityBadge, SeverityBadge } from '../components/ui/StatusBadges';
import { EXCEPTION_TYPE_LABEL } from '../components/ui/status';
import { daysBetween, formatDate, formatTime, pluralize } from '../utils/format';

import type { ExceptionType, Severity, SupplyException } from '../types';

type SeverityFilter = '' | Severity;
type TypeFilter = '' | ExceptionType;
type SortKey = 'severity' | 'promised' | 'quantity';
type ViewMode = 'list' | 'order';

const TYPE_ICON: Record<ExceptionType, LucideIcon> = {
  BACKORDER: PackageX,
  LATE_PROMISE: Clock,
  INBOUND_DEPENDENCY: Truck,
};

const TYPE_HELP: Record<ExceptionType, string> = {
  BACKORDER: 'Not enough on-hand or inbound supply for the full quantity.',
  LATE_PROMISE: 'Promised ship date is after the requested date.',
  INBOUND_DEPENDENCY: 'Covered, but waiting on an inbound receipt.',
};

const SEVERITY_RANK: Record<Severity, number> = { HIGH: 0, MEDIUM: 1, LOW: 2 };
const PRIORITY_RANK = { HIGH: 0, MED: 1, LOW: 2 } as const;

function exceptionKey(item: SupplyException, index: number) {
  return `${item.orderId}-${item.skuId}-${item.type}-${index}`;
}

function ExceptionRow({
  item,
  showOrder = true,
}: {
  item: SupplyException;
  showOrder?: boolean;
}) {
  const navigate = useNavigate();
  const Icon = TYPE_ICON[item.type];
  const lateDays =
    item.requestedShipDate && item.promisedShipDate
      ? daysBetween(item.requestedShipDate, item.promisedShipDate)
      : 0;

  return (
    <article className="exception-row" data-severity={item.severity}>
      <span className="exception-type-icon" data-type={item.type}>
        <Icon aria-hidden="true" />
      </span>

      <div className="exception-main">
        <div className="exception-heading">
          {showOrder && (
            <>
              <strong>{item.orderNumber}</strong>
              <span className="text-muted">{item.customerName}</span>
            </>
          )}
          <Badge tone="neutral" className="badge-outline" title={TYPE_HELP[item.type]}>
            {EXCEPTION_TYPE_LABEL[item.type]}
          </Badge>
          {showOrder && <PriorityBadge priority={item.priority} />}
        </div>
        <p className="exception-reason">{item.reason}</p>
        <div className="exception-facts">
          <span>
            <span className="text-muted">SKU</span>{' '}
            <span className="cell-code">{item.skuCode}</span>
          </span>
          <span>
            <span className="text-muted">Affected</span>{' '}
            <strong className="tabular">{item.affectedQuantity}</strong> units
          </span>
          <span>
            <span className="text-muted">Requested</span>{' '}
            {formatDate(item.requestedShipDate)}
          </span>
          <span>
            <span className="text-muted">Promised</span>{' '}
            {item.promisedShipDate ? (
              <>
                {formatDate(item.promisedShipDate)}
                {lateDays > 0 && (
                  <strong className="text-danger"> · {lateDays}d late</strong>
                )}
              </>
            ) : (
              <strong className="text-danger">no date</strong>
            )}
          </span>
        </div>
      </div>

      <div className="exception-side">
        <SeverityBadge severity={item.severity} />
        <div className="btn-group">
          <Button
            size="sm"
            variant="ghost"
            icon={<Sparkles />}
            onClick={() => navigate(`/ai?order=${item.orderId}`)}
            title="Draft a customer update with the AI assistant"
          >
            Draft update
          </Button>
          <Button
            size="sm"
            iconRight={<ArrowUpRight />}
            onClick={() => navigate(`/orders?order=${item.orderId}`)}
          >
            Open order
          </Button>
        </div>
      </div>
    </article>
  );
}

function ExceptionsManagement() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();

  const { data, loading, error } = useAppSelector((state) => state.exceptions);

  const [severity, setSeverity] = useState<SeverityFilter>('');
  const [type, setType] = useState<TypeFilter>('');
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey>('severity');
  const [view, setView] = useState<ViewMode>('list');

  // Load the full queue once; filters apply client-side so the summary
  // counts always describe the whole queue.
  useEffect(() => {
    dispatch(fetchExceptions({}));
  }, [dispatch]);

  const exceptions = useMemo(() => data?.exceptions ?? [], [data?.exceptions]);

  const typeCounts = useMemo(() => {
    const counts: Record<ExceptionType, number> = {
      BACKORDER: 0,
      LATE_PROMISE: 0,
      INBOUND_DEPENDENCY: 0,
    };
    for (const item of exceptions) counts[item.type] += 1;
    return counts;
  }, [exceptions]);

  const severityCounts = useMemo(() => {
    const counts: Record<Severity, number> = { HIGH: 0, MEDIUM: 0, LOW: 0 };
    for (const item of exceptions) counts[item.severity] += 1;
    return counts;
  }, [exceptions]);

  const affectedOrders = new Set(exceptions.map((item) => item.orderId)).size;
  const backorderedUnits = exceptions
    .filter((item) => item.type === 'BACKORDER')
    .reduce((sum, item) => sum + item.affectedQuantity, 0);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    const result = exceptions.filter((item) => {
      const matchesSeverity = !severity || item.severity === severity;
      const matchesType = !type || item.type === type;
      const matchesSearch =
        !query ||
        [item.orderNumber, item.customerName, item.skuCode, item.reason].some(
          (value) => value.toLowerCase().includes(query),
        );
      return matchesSeverity && matchesType && matchesSearch;
    });

    const dateValue = (value: string | null) =>
      value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;

    return [...result].sort((a, b) => {
      if (sortKey === 'promised') {
        return dateValue(a.promisedShipDate) - dateValue(b.promisedShipDate);
      }
      if (sortKey === 'quantity') {
        return b.affectedQuantity - a.affectedQuantity;
      }
      return (
        SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] ||
        PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
        a.orderNumber.localeCompare(b.orderNumber)
      );
    });
  }, [exceptions, severity, type, search, sortKey]);

  const groups = useMemo(() => {
    const map = new Map<string, SupplyException[]>();
    for (const item of filtered) {
      const list = map.get(item.orderId) ?? [];
      list.push(item);
      map.set(item.orderId, list);
    }
    return [...map.values()];
  }, [filtered]);

  const filtersActive = Boolean(severity || type || search);

  function refresh() {
    dispatch(clearExceptionError());
    dispatch(fetchExceptions({}));
  }

  function toggleSeverity(value: Severity) {
    setSeverity((current) => (current === value ? '' : value));
  }

  const total = data?.totalExceptions ?? 0;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Overview"
        eyebrowIcon={<TriangleAlert />}
        title="Exceptions"
        description="The live risk queue, derived from the allocation plan on every refresh. Work it top to bottom."
        actions={
          <>
            {data?.generatedAt && (
              <span className="toolbar-meta">
                Evaluated {formatTime(data.generatedAt)}
              </span>
            )}
            <Button icon={<RefreshCw />} loading={loading} onClick={refresh}>
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Alert
          tone="danger"
          title="Could not load exceptions"
          action={
            <Button size="sm" onClick={refresh}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!data && loading ? (
        <div className="card card-body">
          <Skeleton width="40%" height={18} />
          <Skeleton height={8} style={{ marginTop: 16 }} />
        </div>
      ) : data ? (
        <div className={`queue-banner ${total === 0 ? 'is-clear' : severityCounts.HIGH > 0 ? 'is-critical' : 'is-warning'}`}>
          <div className="queue-banner-icon">
            {total === 0 ? <CircleCheck /> : <TriangleAlert />}
          </div>
          <div className="queue-banner-main">
            <strong>
              {total === 0
                ? 'All clear. No orders need attention.'
                : `${pluralize(total, 'exception')} across ${pluralize(affectedOrders, 'order')}`}
            </strong>
            <span>
              {total === 0
                ? 'Every planned line is covered and on time.'
                : `${severityCounts.HIGH} high severity · ${backorderedUnits.toLocaleString()} units backordered`}
            </span>
          </div>
          {total > 0 && (
            <div className="queue-banner-bar">
              <StackedBar
                label="Exceptions by severity"
                segments={[
                  { label: 'High', value: severityCounts.HIGH, color: 'var(--danger)' },
                  { label: 'Medium', value: severityCounts.MEDIUM, color: 'var(--warning)' },
                  { label: 'Low', value: severityCounts.LOW, color: 'var(--info)' },
                ]}
              />
            </div>
          )}
        </div>
      ) : null}

      <div className="stat-grid">
        <StatCard
          index={0}
          label="High severity"
          value={severityCounts.HIGH}
          icon={<TriangleAlert />}
          tone="danger"
          hint="High-priority orders short or late"
          onClick={() => toggleSeverity('HIGH')}
          active={severity === 'HIGH'}
        />
        <StatCard
          index={1}
          label="Medium severity"
          value={severityCounts.MEDIUM}
          icon={<Clock />}
          tone="warning"
          hint="Other orders short or late"
          onClick={() => toggleSeverity('MEDIUM')}
          active={severity === 'MEDIUM'}
        />
        <StatCard
          index={2}
          label="Low severity"
          value={severityCounts.LOW}
          icon={<Truck />}
          tone="info"
          hint="Covered by inbound supply"
          onClick={() => toggleSeverity('LOW')}
          active={severity === 'LOW'}
        />
        <StatCard
          index={3}
          label="Orders affected"
          value={affectedOrders}
          icon={<Layers />}
          tone="accent"
          hint="Open an order to act on it"
          onClick={() => navigate('/orders')}
        />
      </div>

      <Card>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search order, customer, SKU or reason..."
          />
          <SegmentedControl
            label="Filter by exception type"
            value={type}
            onChange={setType}
            options={[
              { value: '', label: 'All types', count: exceptions.length },
              { value: 'BACKORDER', label: 'Backorder', count: typeCounts.BACKORDER },
              { value: 'LATE_PROMISE', label: 'Late', count: typeCounts.LATE_PROMISE },
              {
                value: 'INBOUND_DEPENDENCY',
                label: 'Inbound',
                count: typeCounts.INBOUND_DEPENDENCY,
              },
            ]}
          />
          <div className="toolbar-spacer" />
          <select
            className="select select-sm"
            style={{ width: 'auto' }}
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            aria-label="Sort exceptions"
          >
            <option value="severity">Sort: Severity</option>
            <option value="promised">Sort: Earliest promise</option>
            <option value="quantity">Sort: Most units affected</option>
          </select>
          <SegmentedControl
            label="View"
            value={view}
            onChange={setView}
            options={[
              { value: 'list', label: 'List' },
              { value: 'order', label: 'By order' },
            ]}
          />
        </div>

        {!data && loading ? (
          <div style={{ padding: 16, display: 'grid', gap: 12 }}>
            {Array.from({ length: 4 }, (_, index) => (
              <Skeleton key={index} height={72} />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filtersActive ? <List /> : <CircleCheck />}
            title={filtersActive ? 'No exceptions match' : 'Nothing needs attention'}
            description={
              filtersActive
                ? 'Try a different filter or search.'
                : 'When an order becomes short, late or dependent on inbound supply, it appears here.'
            }
            action={
              filtersActive ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSeverity('');
                    setType('');
                    setSearch('');
                  }}
                >
                  Clear filters
                </Button>
              ) : undefined
            }
          />
        ) : view === 'list' ? (
          <div className="exception-list">
            {filtered.map((item, index) => (
              <ExceptionRow key={exceptionKey(item, index)} item={item} />
            ))}
          </div>
        ) : (
          <div className="exception-groups">
            {groups.map((group) => {
              const first = group[0];
              const worst = group.reduce((acc, item) =>
                SEVERITY_RANK[item.severity] < SEVERITY_RANK[acc.severity] ? item : acc,
              );

              return (
                <section className="exception-group" key={first.orderId}>
                  <header className="exception-group-head">
                    <div>
                      <strong>{first.orderNumber}</strong>
                      <span className="text-muted">{first.customerName}</span>
                      <PriorityBadge priority={first.priority} />
                    </div>
                    <div className="btn-group">
                      <span className="toolbar-meta">
                        {pluralize(group.length, 'issue')}
                      </span>
                      <SeverityBadge severity={worst.severity} />
                    </div>
                  </header>
                  {group.map((item, index) => (
                    <ExceptionRow
                      key={exceptionKey(item, index)}
                      item={item}
                      showOrder={false}
                    />
                  ))}
                </section>
              );
            })}
          </div>
        )}

        <div className="table-footer">
          <span>
            Showing {filtered.length} of {exceptions.length} exceptions
          </span>
          <span>Severity follows order priority; inbound dependencies are low.</span>
        </div>
      </Card>
    </div>
  );
}

export default ExceptionsManagement;
