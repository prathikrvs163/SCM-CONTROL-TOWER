import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ArrowRight,
  Boxes,
  CalendarClock,
  Gauge,
  LayoutDashboard,
  PackageX,
  RefreshCw,
  ShoppingCart,
  TriangleAlert,
  Truck,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { fetchDashboard } from '../features/dashboard/dashboardSlice';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { StatCard } from '../components/ui/StatCard';
import { PageHeader } from '../components/ui/PageHeader';
import { SegmentedControl } from '../components/ui/Form';
import {
  Alert,
  EmptyState,
  Meter,
  Skeleton,
} from '../components/ui/Feedback';
import {
  PriorityBadge,
  ReceiptStatusBadge,
  SeverityBadge,
} from '../components/ui/StatusBadges';
import {
  EXCEPTION_TYPE_LABEL,
  humanize,
  ORDER_STATUS_COLOR,
} from '../components/ui/status';
import { DonutChart } from '../components/charts/DonutChart';
import { BarList, ChartLegend } from '../components/charts/BarList';
import { ColumnChart } from '../components/charts/ColumnChart';
import type { ColumnDatum } from '../components/charts/ColumnChart';
import { getOrderHealth, RISK_META } from '../utils/orderHealth';
import type { OrderRisk } from '../utils/orderHealth';
import {
  daysFromToday,
  formatShortDate,
  formatTime,
  pluralize,
  relativeDay,
} from '../utils/format';
import type { OrderStatus } from '../types';

const ORDER_STATUSES: OrderStatus[] = [
  'DRAFT',
  'CONFIRMED',
  'FULFILLING',
  'SHIPPED',
  'CANCELED',
];

const RISK_COLOR: Record<OrderRisk, string> = {
  SHORT: 'var(--chart-4)',
  LATE: 'var(--chart-3)',
  INBOUND: 'var(--chart-5)',
  ON_TRACK: 'var(--chart-2)',
};

const COVERAGE_LEGEND = [
  { label: 'From on-hand', color: 'var(--chart-2)' },
  { label: 'From inbound', color: 'var(--chart-5)' },
  { label: 'Backordered', color: 'var(--chart-4)' },
];

const WAREHOUSE_LEGEND = [
  { label: 'Above safety stock', color: 'var(--chart-1)' },
  { label: 'Held as safety stock', color: 'var(--chart-6)' },
];

const WEEKS_AHEAD = 6;

function DashboardSkeleton() {
  return (
    <>
      <div className="stat-grid stat-grid-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div className="stat-card" key={index}>
            <Skeleton width="55%" />
            <Skeleton width="40%" height={26} />
            <Skeleton width="70%" height={10} />
          </div>
        ))}
      </div>
      <div className="grid-main-side">
        {[0, 1].map((index) => (
          <div className="card card-body" key={index}>
            <Skeleton width="35%" height={14} />
            <div style={{ display: 'grid', gap: 14, marginTop: 22 }}>
              {Array.from({ length: 5 }, (_, row) => (
                <Skeleton key={row} height={10} width={`${90 - row * 12}%`} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </>
  );
}

function Dashboard() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const [pipelineView, setPipelineView] = useState<'status' | 'risk'>('status');

  const {
    skus,
    warehouses,
    inventory,
    orders,
    receipts,
    allocation,
    exceptions,
    loading,
    error,
    lastUpdated,
  } = useAppSelector((state) => state.dashboard);

  useEffect(() => {
    dispatch(fetchDashboard());
  }, [dispatch]);

  const metrics = useMemo(() => {
    const openOrders = orders.filter((order) =>
      ['CONFIRMED', 'FULFILLING'].includes(order.status),
    );

    let requested = 0;
    let allocated = 0;
    let backordered = 0;
    let backorderedLines = 0;

    for (const order of allocation?.orders ?? []) {
      for (const line of order.lines) {
        requested += line.requestedQuantity;
        allocated += line.allocatedQuantity;
        backordered += line.backorderedQuantity;
        if (line.backorderedQuantity > 0) backorderedLines += 1;
      }
    }

    const openReceipts = receipts
      .filter((receipt) => ['PLANNED', 'IN_TRANSIT'].includes(receipt.status))
      .sort((a, b) =>
        a.expectedArrivalTime.localeCompare(b.expectedArrivalTime),
      );

    const lowStock = inventory.filter(
      (item) => item.safetyStock > 0 && item.onHandQuantity <= item.safetyStock,
    ).length;

    return {
      openOrders: openOrders.length,
      highPriorityOpen: openOrders.filter((order) => order.priority === 'HIGH')
        .length,
      drafts: orders.filter((order) => order.status === 'DRAFT').length,
      requested,
      allocated,
      fillRate: requested > 0 ? Math.round((allocated / requested) * 100) : 100,
      backordered,
      backorderedLines,
      onHand: inventory.reduce((sum, item) => sum + item.onHandQuantity, 0),
      lowStock,
      openReceipts,
      overdueReceipts: openReceipts.filter(
        (receipt) => daysFromToday(receipt.expectedArrivalTime) < 0,
      ).length,
      inboundUnits: openReceipts.reduce((sum, item) => sum + item.quantity, 0),
    };
  }, [orders, allocation, receipts, inventory]);

  const statusSegments = useMemo(
    () =>
      ORDER_STATUSES.map((status) => ({
        key: status,
        label: humanize(status),
        value: orders.filter((order) => order.status === status).length,
        color: ORDER_STATUS_COLOR[status],
      })),
    [orders],
  );

  const riskSegments = useMemo(() => {
    const counts: Record<OrderRisk, number> = {
      SHORT: 0,
      LATE: 0,
      INBOUND: 0,
      ON_TRACK: 0,
    };

    for (const planOrder of allocation?.orders ?? []) {
      const health = getOrderHealth(planOrder);
      if (health) counts[health.risk] += 1;
    }

    return (Object.keys(counts) as OrderRisk[]).map((risk) => ({
      key: risk,
      label: RISK_META[risk].label,
      value: counts[risk],
      color: RISK_COLOR[risk],
    }));
  }, [allocation]);

  const coverageRows = useMemo(() => {
    const bySku = new Map<
      string,
      {
        skuCode: string;
        skuName: string;
        requested: number;
        onHand: number;
        inbound: number;
        backordered: number;
      }
    >();

    for (const order of allocation?.orders ?? []) {
      for (const line of order.lines) {
        const row = bySku.get(line.skuId) ?? {
          skuCode: line.skuCode,
          skuName: line.skuName,
          requested: 0,
          onHand: 0,
          inbound: 0,
          backordered: 0,
        };

        row.requested += line.requestedQuantity;
        row.backordered += line.backorderedQuantity;
        for (const item of line.allocations) {
          if (item.source === 'ON_HAND') row.onHand += item.quantity;
          else row.inbound += item.quantity;
        }

        bySku.set(line.skuId, row);
      }
    }

    return [...bySku.entries()]
      .map(([skuId, row]) => ({ skuId, ...row }))
      .sort(
        (a, b) => b.backordered - a.backordered || b.requested - a.requested,
      )
      .slice(0, 7)
      .map((row) => ({
        key: row.skuId,
        label: row.skuCode,
        sublabel: row.skuName,
        segments: [
          { label: 'From on-hand', value: row.onHand, color: 'var(--chart-2)' },
          { label: 'From inbound', value: row.inbound, color: 'var(--chart-5)' },
          {
            label: 'Backordered',
            value: row.backordered,
            color: 'var(--chart-4)',
          },
        ],
        value: (
          <>
            <span className={row.backordered > 0 ? 'text-danger' : undefined}>
              {row.requested - row.backordered}
            </span>
            /{row.requested}
          </>
        ),
      }));
  }, [allocation]);

  const warehouseRows = useMemo(
    () =>
      warehouses
        .filter((warehouse) => warehouse.isActive)
        .map((warehouse) => {
          const rows = inventory.filter(
            (item) => item.warehouseId === warehouse.id,
          );
          const onHand = rows.reduce((sum, item) => sum + item.onHandQuantity, 0);
          const held = rows.reduce(
            (sum, item) => sum + Math.min(item.onHandQuantity, item.safetyStock),
            0,
          );
          const low = rows.filter(
            (item) =>
              item.safetyStock > 0 && item.onHandQuantity <= item.safetyStock,
          ).length;

          return {
            key: warehouse.id,
            label: warehouse.code,
            sublabel: `${rows.length} SKUs${low > 0 ? ` · ${low} low` : ''}`,
            segments: [
              {
                label: 'Above safety stock',
                value: onHand - held,
                color: 'var(--chart-1)',
              },
              {
                label: 'Held as safety stock',
                value: held,
                color: 'var(--chart-6)',
              },
            ],
            value: onHand.toLocaleString(),
          };
        })
        .sort((a, b) => a.label.localeCompare(b.label)),
    [warehouses, inventory],
  );

  const arrivalColumns = useMemo<ColumnDatum[]>(() => {
    const buckets: ColumnDatum[] = [
      { key: 'overdue', label: 'Overdue', value: 0, details: [], color: 'var(--chart-4)' },
    ];

    const today = new Date();
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - ((today.getDay() + 6) % 7));

    for (let week = 0; week < WEEKS_AHEAD; week += 1) {
      const start = new Date(weekStart);
      start.setDate(weekStart.getDate() + week * 7);
      buckets.push({
        key: `w${week}`,
        label: week === 0 ? 'This week' : formatShortDate(start),
        value: 0,
        details: [],
      });
    }

    for (const receipt of metrics.openReceipts) {
      const days = daysFromToday(receipt.expectedArrivalTime);
      let bucket: ColumnDatum | undefined;

      if (days < 0) {
        bucket = buckets[0];
      } else {
        const offset = Math.floor(
          daysFromToday(receipt.expectedArrivalTime, weekStart) / 7,
        );
        bucket = buckets[offset + 1];
      }

      if (bucket) {
        bucket.value += receipt.quantity;
        bucket.details?.push(
          `${receipt.receiptId} · ${receipt.sku.skuCode} × ${receipt.quantity}`,
        );
      }
    }

    return buckets;
  }, [metrics.openReceipts]);

  const loadedOnce = Boolean(lastUpdated);
  const topExceptions = exceptions?.exceptions.slice(0, 6) ?? [];
  const nextReceipt = metrics.openReceipts[0];

  return (
    <div className="page">
      <PageHeader
        eyebrow="Control tower"
        eyebrowIcon={<LayoutDashboard />}
        title="Operations overview"
        description="Live view of demand, supply and fulfillment risk across your network."
        actions={
          <>
            {lastUpdated && (
              <span className="toolbar-meta">
                Updated {formatTime(lastUpdated)}
              </span>
            )}
            <Button
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => dispatch(fetchDashboard())}
            >
              Refresh
            </Button>
          </>
        }
      />

      {error && (
        <Alert
          tone="danger"
          title="Could not load the dashboard"
          action={
            <Button size="sm" onClick={() => dispatch(fetchDashboard())}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      {!loadedOnce && loading ? (
        <DashboardSkeleton />
      ) : !loadedOnce ? null : (
        <>
          <div className="stat-grid stat-grid-6">
            <StatCard
              index={0}
              label="Open orders"
              value={metrics.openOrders}
              icon={<ShoppingCart />}
              tone="accent"
              hint={`${metrics.highPriorityOpen} high priority · ${pluralize(metrics.drafts, 'draft')}`}
              onClick={() => navigate('/orders')}
            />
            <StatCard
              index={1}
              label="Fill rate"
              value={metrics.fillRate}
              suffix="%"
              icon={<Gauge />}
              tone={metrics.fillRate >= 95 ? 'success' : metrics.fillRate >= 80 ? 'warning' : 'danger'}
              footer={
                <Meter
                  value={metrics.allocated}
                  max={metrics.requested}
                  tone={metrics.fillRate >= 95 ? 'success' : metrics.fillRate >= 80 ? 'warning' : 'danger'}
                  label="Fill rate"
                />
              }
              hint={`${metrics.allocated.toLocaleString()} of ${metrics.requested.toLocaleString()} units covered`}
            />
            <StatCard
              index={2}
              label="Backordered units"
              value={metrics.backordered.toLocaleString()}
              icon={<PackageX />}
              tone={metrics.backordered > 0 ? 'danger' : 'success'}
              hint={
                metrics.backorderedLines > 0
                  ? `Across ${metrics.backorderedLines} order lines`
                  : 'Every planned line is covered'
              }
            />
            <StatCard
              index={3}
              label="Open exceptions"
              value={exceptions?.totalExceptions ?? 0}
              icon={<TriangleAlert />}
              tone={(exceptions?.highCount ?? 0) > 0 ? 'danger' : 'warning'}
              hint={`${exceptions?.highCount ?? 0} high · ${exceptions?.mediumCount ?? 0} medium · ${exceptions?.lowCount ?? 0} low`}
              onClick={() => navigate('/exceptions')}
            />
            <StatCard
              index={4}
              label="On-hand units"
              value={metrics.onHand.toLocaleString()}
              icon={<Boxes />}
              tone="info"
              hint={
                metrics.lowStock > 0
                  ? `${metrics.lowStock} SKU-locations at or below safety stock`
                  : `${skus.filter((sku) => sku.isActive).length} active SKUs, all above safety stock`
              }
              onClick={() => navigate('/inventory')}
            />
            <StatCard
              index={5}
              label="Inbound units"
              value={metrics.inboundUnits.toLocaleString()}
              icon={<Truck />}
              tone={metrics.overdueReceipts > 0 ? 'warning' : 'neutral'}
              hint={
                metrics.overdueReceipts > 0
                  ? `${metrics.overdueReceipts} receipt${metrics.overdueReceipts === 1 ? '' : 's'} past expected arrival`
                  : nextReceipt
                    ? `Next: ${nextReceipt.receiptId}, ${relativeDay(nextReceipt.expectedArrivalTime).toLowerCase()}`
                    : 'No open receipts'
              }
              onClick={() => navigate('/supply')}
            />
          </div>

          <div className="grid-main-side">
            <Card>
              <CardHeader
                title="Allocation coverage by SKU"
                description="How planned demand is covered, for the SKUs with the most shortage or demand."
                actions={<ChartLegend items={COVERAGE_LEGEND} />}
              />
              <CardBody>
                {coverageRows.length === 0 ? (
                  <EmptyState
                    compact
                    title="No planned demand"
                    description="Confirm an order to see how supply covers it."
                  />
                ) : (
                  <BarList rows={coverageRows} />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Order pipeline"
                description={
                  pipelineView === 'status'
                    ? 'All orders by lifecycle status.'
                    : 'Planned orders by fulfillment risk.'
                }
                actions={
                  <SegmentedControl
                    label="Pipeline view"
                    value={pipelineView}
                    onChange={setPipelineView}
                    options={[
                      { value: 'status', label: 'Status' },
                      { value: 'risk', label: 'Risk' },
                    ]}
                  />
                }
              />
              <CardBody>
                <DonutChart
                  key={pipelineView}
                  segments={pipelineView === 'status' ? statusSegments : riskSegments}
                  centerLabel={pipelineView === 'status' ? 'orders' : 'planned'}
                />
              </CardBody>
            </Card>
          </div>

          <div className="grid-2">
            <Card>
              <CardHeader
                title="Inbound arrivals"
                description="Open receipt quantity by expected week of arrival."
                icon={<CalendarClock />}
              />
              <CardBody>
                {metrics.openReceipts.length === 0 ? (
                  <EmptyState
                    compact
                    title="No inbound supply"
                    description="Planned and in-transit receipts appear here."
                  />
                ) : (
                  <ColumnChart data={arrivalColumns} valueLabel="units" />
                )}
              </CardBody>
            </Card>

            <Card>
              <CardHeader
                title="Inventory by warehouse"
                description="On-hand units, split by how much is protected as safety stock."
                actions={<ChartLegend items={WAREHOUSE_LEGEND} />}
              />
              <CardBody>
                {warehouseRows.length === 0 ? (
                  <EmptyState compact title="No active warehouses" />
                ) : (
                  <BarList rows={warehouseRows} />
                )}
              </CardBody>
            </Card>
          </div>

          <div className="grid-2">
            <Card>
              <CardHeader
                title="Needs attention"
                description="Highest-severity exceptions from the live queue."
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    iconRight={<ArrowRight />}
                    onClick={() => navigate('/exceptions')}
                  >
                    View all
                  </Button>
                }
              />
              {topExceptions.length === 0 ? (
                <EmptyState
                  compact
                  title="All clear"
                  description="No orders currently need attention."
                />
              ) : (
                <ul className="feed-list">
                  {topExceptions.map((item, index) => (
                    <li key={`${item.orderId}-${item.skuId}-${item.type}-${index}`}>
                      <button
                        type="button"
                        className="feed-item"
                        onClick={() => navigate(`/orders?order=${item.orderId}`)}
                      >
                        <span
                          className="feed-severity"
                          data-severity={item.severity}
                        />
                        <span className="feed-main">
                          <span className="feed-title">
                            {item.orderNumber}
                            <span className="divider-dot" />
                            {EXCEPTION_TYPE_LABEL[item.type]}
                          </span>
                          <span className="feed-meta">
                            {item.customerName} · {item.skuCode} ·{' '}
                            {item.affectedQuantity} units
                          </span>
                        </span>
                        <SeverityBadge severity={item.severity} />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </Card>

            <Card>
              <CardHeader
                title="Upcoming receipts"
                description="Next open receipts by expected arrival."
                actions={
                  <Button
                    variant="ghost"
                    size="sm"
                    iconRight={<ArrowRight />}
                    onClick={() => navigate('/supply')}
                  >
                    Manage supply
                  </Button>
                }
              />
              {metrics.openReceipts.length === 0 ? (
                <EmptyState compact title="No open receipts" />
              ) : (
                <ul className="feed-list">
                  {metrics.openReceipts.slice(0, 6).map((receipt) => {
                    const days = daysFromToday(receipt.expectedArrivalTime);
                    return (
                      <li key={receipt.id}>
                        <div className="feed-item">
                          <span className="feed-date">
                            <strong>
                              {new Date(receipt.expectedArrivalTime).getDate()}
                            </strong>
                            <span>
                              {new Date(receipt.expectedArrivalTime).toLocaleDateString(undefined, { month: 'short' })}
                            </span>
                          </span>
                          <span className="feed-main">
                            <span className="feed-title">
                              {receipt.receiptId}
                            </span>
                            <span className="feed-meta">
                              {receipt.sku.skuCode} × {receipt.quantity} into{' '}
                              {receipt.warehouse.code} ·{' '}
                              <span className={days < 0 ? 'text-danger' : undefined}>
                                {relativeDay(receipt.expectedArrivalTime)}
                              </span>
                            </span>
                          </span>
                          <ReceiptStatusBadge status={receipt.status} />
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>

          {allocation && (
            <Card>
              <CardHeader
                title="Highest-priority open orders"
                description="Planned orders in allocation order, with their current risk."
              />
              <div className="table-wrap" style={{ marginTop: 12 }}>
                <table className="table">
                  <thead>
                    <tr>
                      <th>Order</th>
                      <th>Priority</th>
                      <th>Coverage</th>
                      <th>Risk</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allocation.orders.slice(0, 6).map((planOrder) => {
                      const health = getOrderHealth(planOrder);
                      if (!health) return null;
                      return (
                        <tr
                          key={planOrder.orderId}
                          className="is-clickable"
                          onClick={() =>
                            navigate(`/orders?order=${planOrder.orderId}`)
                          }
                        >
                          <td>
                            <span className="cell-primary">
                              {planOrder.orderNumber}
                            </span>
                            <span className="cell-secondary">
                              {planOrder.customerName}
                            </span>
                          </td>
                          <td>
                            <PriorityBadge priority={planOrder.priority} />
                          </td>
                          <td style={{ minWidth: 180 }}>
                            <div className="coverage-cell">
                              <Meter
                                value={health.allocated}
                                max={health.requested}
                                tone={health.backordered > 0 ? 'danger' : 'success'}
                                label="Coverage"
                              />
                              <span className="tabular">
                                {health.allocated}/{health.requested}
                              </span>
                            </div>
                          </td>
                          <td>
                            <Badge
                              tone={RISK_META[health.risk].tone}
                              dot
                              title={RISK_META[health.risk].description}
                            >
                              {RISK_META[health.risk].label}
                            </Badge>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          <p className="page-footnote">
            Allocation method: {allocation?.allocationMethod ?? 'unavailable'}.
            Plans are recalculated from live data on every refresh.
          </p>
        </>
      )}
    </div>
  );
}

export default Dashboard;
