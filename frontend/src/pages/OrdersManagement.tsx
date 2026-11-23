import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  CalendarCog,
  ChevronRight,
  ClipboardList,
  MapPin,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  ShieldAlert,
  ShoppingCart,
  Split,
  Trash2,
  Truck,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useConfirm, useToast } from '../app/providers/contexts';
import { fetchSkus } from '../features/skus/skuSlice';
import { fetchWarehouses } from '../features/warehouses/warehouseSlice';
import {
  clearOrderError,
  clearOrderTimeline,
  createOrder,
  fetchAllocationPlan,
  fetchOrderTimeline,
  fetchOrders,
  updateOrder,
  updateOrderStatus,
} from '../features/orders/orderSlice';
import { fetchOrderActivity } from '../features/audit/auditSlice';
import AuditChanges from '../features/audit/AuditChanges';
import { formatAuditAction } from '../features/audit/auditFormat';
import OrderPlannerPanel from '../features/planner/OrderPlannerPanel';
import type { OrderPlannerAction } from '../features/planner/OrderPlannerPanel';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import {
  Field,
  SearchInput,
  SegmentedControl,
} from '../components/ui/Form';
import {
  Alert,
  EmptyState,
  Meter,
  Skeleton,
  TableSkeleton,
} from '../components/ui/Feedback';
import { Drawer, Modal } from '../components/ui/Overlay';
import {
  OrderStatusBadge,
  PriorityBadge,
} from '../components/ui/StatusBadges';
import { humanize, PRIORITY_LABEL } from '../components/ui/status';
import { getOrderHealth, RISK_META } from '../utils/orderHealth';
import type { OrderHealth, OrderRisk } from '../utils/orderHealth';
import {
  daysBetween,
  formatDate,
  formatDateTime,
  pluralize,
} from '../utils/format';

import type {
  AllocationOrder,
  CreateOrderInput,
  Order,
  OrderLineInput,
  OrderStatus,
  Priority,
} from '../types';

type OrderLineForm = {
  skuId: string;
  quantity: string;
  preferredWarehouseId: string;
};

type OrderForm = {
  orderNumber: string;
  customerName: string;
  priority: Priority;
  requestedShipDate: string;
  lines: OrderLineForm[];
};

type StatusFilter = 'ALL' | OrderStatus;
type RiskFilter = 'ALL' | OrderRisk;
type SortKey =
  | 'newest'
  | 'oldest'
  | 'risk'
  | 'promised'
  | 'requested'
  | 'priority';

const emptyLine: OrderLineForm = {
  skuId: '',
  quantity: '1',
  preferredWarehouseId: '',
};

const emptyForm: OrderForm = {
  orderNumber: '',
  customerName: '',
  priority: 'MED',
  requestedShipDate: '',
  lines: [{ ...emptyLine }],
};

const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['FULFILLING', 'CANCELED'],
  FULFILLING: ['SHIPPED', 'CANCELED'],
  SHIPPED: [],
  CANCELED: [],
};

/** Orders the allocation engine plans for; promise and split actions apply. */
const PLANNED_STATUSES: OrderStatus[] = ['CONFIRMED', 'FULFILLING'];

/** Orders whose lines may still change fulfillment location. */
const REASSIGNABLE_STATUSES: OrderStatus[] = ['DRAFT', ...PLANNED_STATUSES];

const STATUS_FILTERS: StatusFilter[] = [
  'ALL',
  'DRAFT',
  'CONFIRMED',
  'FULFILLING',
  'SHIPPED',
  'CANCELED',
];

const PRIORITY_RANK: Record<Priority, number> = { HIGH: 0, MED: 1, LOW: 2 };

const SORT_LABELS: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  risk: 'Highest risk',
  promised: 'Earliest promise',
  requested: 'Earliest requested ship',
  priority: 'Priority',
};

const TRANSITION_LABEL: Partial<Record<OrderStatus, string>> = {
  CONFIRMED: 'Confirm order',
  FULFILLING: 'Start fulfilling',
  SHIPPED: 'Ship order',
  CANCELED: 'Cancel order',
};

function CoverageCell({ health }: { health: OrderHealth | null }) {
  if (!health) {
    return <span className="cell-muted">Not planned</span>;
  }

  return (
    <div className="coverage-cell">
      <Meter
        value={health.allocated}
        max={health.requested}
        tone={health.backordered > 0 ? 'danger' : health.fromInbound > 0 ? 'accent' : 'success'}
        label="Allocated quantity"
      />
      <span className="tabular">
        {health.allocated}/{health.requested}
      </span>
    </div>
  );
}

function RiskBadge({ health }: { health: OrderHealth | null }) {
  if (!health) return <span className="cell-muted">—</span>;
  const meta = RISK_META[health.risk];
  return (
    <Badge tone={meta.tone} dot title={meta.description}>
      {meta.label}
    </Badge>
  );
}

function OrdersManagement() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const {
    items,
    timeline,
    allocationPlan,
    loading,
    saving,
    timelineLoading,
    planLoading,
    error,
  } = useAppSelector((state) => state.orders);

  const allSkus = useAppSelector((state) => state.skus.items);
  const allWarehouses = useAppSelector((state) => state.warehouses.items);
  const skus = useMemo(() => allSkus.filter((sku) => sku.isActive), [allSkus]);
  const warehouses = useMemo(
    () => allWarehouses.filter((warehouse) => warehouse.isActive),
    [allWarehouses],
  );

  const { orderActivity, orderActivityId, orderActivityLoading } =
    useAppSelector((state) => state.audit);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | Priority>('ALL');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('ALL');
  const [sortKey, setSortKey] = useState<SortKey>('newest');

  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [formError, setFormError] = useState('');

  const [plannerAction, setPlannerAction] =
    useState<OrderPlannerAction | null>(null);

  // The open order and the create dialog live in the URL, so they can be
  // linked to (from the dashboard, exceptions queue or command palette).
  const selectedOrderId = searchParams.get('order');
  const createRequested = searchParams.get('new') === '1';
  const formOpen = showForm || createRequested;

  useEffect(() => {
    dispatch(fetchOrders());
    dispatch(fetchAllocationPlan());
    dispatch(fetchSkus());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  useEffect(() => {
    if (!selectedOrderId) return;

    dispatch(clearOrderTimeline());
    dispatch(clearOrderError());
    dispatch(fetchOrderTimeline(selectedOrderId));
    dispatch(fetchAllocationPlan());
    dispatch(fetchOrderActivity(selectedOrderId));
  }, [dispatch, selectedOrderId]);

  const planByOrderId = useMemo(() => {
    const map = new Map<string, AllocationOrder>();
    for (const planOrder of allocationPlan?.orders ?? []) {
      map.set(planOrder.orderId, planOrder);
    }
    return map;
  }, [allocationPlan]);

  const healthByOrderId = useMemo(() => {
    const map = new Map<string, OrderHealth | null>();
    for (const order of items) {
      map.set(order.id, getOrderHealth(planByOrderId.get(order.id)));
    }
    return map;
  }, [items, planByOrderId]);

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: items.length,
      DRAFT: 0,
      CONFIRMED: 0,
      FULFILLING: 0,
      SHIPPED: 0,
      CANCELED: 0,
    };
    for (const order of items) counts[order.status] += 1;
    return counts;
  }, [items]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    const result = items.filter((order) => {
      const matchesSearch =
        !term ||
        order.orderNumber.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'ALL' || order.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'ALL' || order.priority === priorityFilter;

      const health = healthByOrderId.get(order.id);
      const matchesRisk =
        riskFilter === 'ALL' || (health && health.risk === riskFilter);

      return matchesSearch && matchesStatus && matchesPriority && matchesRisk;
    });

    const riskRank = (order: Order) => {
      const health = healthByOrderId.get(order.id);
      return health ? RISK_META[health.risk].rank : 9;
    };

    const dateValue = (value: string | null | undefined) =>
      value ? new Date(value).getTime() : Number.POSITIVE_INFINITY;

    return [...result].sort((a, b) => {
      switch (sortKey) {
        case 'oldest':
          return a.createdAt.localeCompare(b.createdAt);
        case 'risk':
          return (
            riskRank(a) - riskRank(b) ||
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority]
          );
        case 'promised':
          return (
            dateValue(healthByOrderId.get(a.id)?.promisedShipDate) -
            dateValue(healthByOrderId.get(b.id)?.promisedShipDate)
          );
        case 'requested':
          return (
            dateValue(a.requestedShipDate) - dateValue(b.requestedShipDate)
          );
        case 'priority':
          return (
            PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
            a.createdAt.localeCompare(b.createdAt)
          );
        default:
          return b.createdAt.localeCompare(a.createdAt);
      }
    });
  }, [
    items,
    search,
    statusFilter,
    priorityFilter,
    riskFilter,
    sortKey,
    healthByOrderId,
  ]);

  const selectedOrder = useMemo(
    () => items.find((order) => order.id === selectedOrderId) ?? null,
    [items, selectedOrderId],
  );

  const selectedAllocation = selectedOrder
    ? (planByOrderId.get(selectedOrder.id) ?? null)
    : null;
  const selectedHealth = selectedOrder
    ? (healthByOrderId.get(selectedOrder.id) ?? null)
    : null;

  const atRiskCount = [...healthByOrderId.values()].filter(
    (health) => health && (health.risk === 'SHORT' || health.risk === 'LATE'),
  ).length;

  const filtersActive =
    Boolean(search) ||
    statusFilter !== 'ALL' ||
    priorityFilter !== 'ALL' ||
    riskFilter !== 'ALL';

  function updateParams(update: (params: URLSearchParams) => void) {
    setSearchParams((current) => {
      const next = new URLSearchParams(current);
      update(next);
      return next;
    });
  }

  function openOrderDetails(order: Order) {
    setPlannerAction(null);
    updateParams((params) => params.set('order', order.id));
  }

  function closeOrderDetails() {
    setPlannerAction(null);
    updateParams((params) => params.delete('order'));
  }

  function openCreateForm() {
    setEditingOrder(null);
    setForm(emptyForm);
    setFormError('');
    dispatch(clearOrderError());
    setShowForm(true);
  }

  function openEditForm(order: Order) {
    if (order.status !== 'DRAFT') return;

    setEditingOrder(order);
    setForm({
      orderNumber: order.orderNumber,
      customerName: order.customerName,
      priority: order.priority,
      requestedShipDate: order.requestedShipDate
        ? order.requestedShipDate.slice(0, 10)
        : '',
      lines: order.lines.map((line) => ({
        skuId: line.skuId,
        quantity: String(line.quantity),
        preferredWarehouseId: line.preferredWarehouseId ?? '',
      })),
    });
    setFormError('');
    dispatch(clearOrderError());
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingOrder(null);
    setForm(emptyForm);
    setFormError('');
    if (createRequested) updateParams((params) => params.delete('new'));
  }

  function updateFormField<K extends keyof OrderForm>(
    field: K,
    value: OrderForm[K],
  ) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  function updateLine(
    index: number,
    field: keyof OrderLineForm,
    value: string,
  ) {
    setForm((current) => ({
      ...current,
      lines: current.lines.map((line, lineIndex) =>
        lineIndex === index ? { ...line, [field]: value } : line,
      ),
    }));
  }

  function addLine() {
    setForm((current) => ({
      ...current,
      lines: [...current.lines, { ...emptyLine }],
    }));
  }

  function removeLine(index: number) {
    setForm((current) => ({
      ...current,
      lines: current.lines.filter((_, lineIndex) => lineIndex !== index),
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    if (!editingOrder && form.orderNumber.trim().length < 3) {
      setFormError('Order number must contain at least 3 characters.');
      return;
    }

    if (form.customerName.trim().length < 2) {
      setFormError('Customer name must contain at least 2 characters.');
      return;
    }

    if (form.lines.length === 0) {
      setFormError('Add at least one order line.');
      return;
    }

    const lines: OrderLineInput[] = [];

    for (const [index, line] of form.lines.entries()) {
      const quantity = Number(line.quantity);

      if (!line.skuId) {
        setFormError(`Select a SKU for line ${index + 1}.`);
        return;
      }

      if (!Number.isInteger(quantity) || quantity < 1) {
        setFormError(
          `Line ${index + 1} must have a positive whole-number quantity.`,
        );
        return;
      }

      lines.push({
        skuId: line.skuId,
        quantity,
        ...(line.preferredWarehouseId
          ? { preferredWarehouseId: line.preferredWarehouseId }
          : {}),
      });
    }

    try {
      if (editingOrder) {
        await dispatch(
          updateOrder({
            id: editingOrder.id,
            data: {
              customerName: form.customerName.trim(),
              priority: form.priority,
              requestedShipDate: form.requestedShipDate || undefined,
              lines,
            },
          }),
        ).unwrap();

        toast({ title: 'Order updated', description: editingOrder.orderNumber });
      } else {
        const payload: CreateOrderInput = {
          orderNumber: form.orderNumber.trim(),
          customerName: form.customerName.trim(),
          priority: form.priority,
          requestedShipDate: form.requestedShipDate || undefined,
          lines,
        };

        await dispatch(createOrder(payload)).unwrap();
        toast({
          title: 'Order created',
          description: `${payload.orderNumber} was saved as a draft.`,
        });
      }

      closeForm();
      await dispatch(fetchOrders());
      await dispatch(fetchAllocationPlan());
    } catch {
      setFormError('The order could not be saved. Check the error above.');
    }
  }

  async function handlePlannerCompleted(message: string, updated: Order) {
    setPlannerAction(null);
    toast({ title: 'Planner action applied', description: message });

    await Promise.all([
      dispatch(fetchOrders()),
      dispatch(fetchAllocationPlan()),
      dispatch(fetchOrderTimeline(updated.id)),
      dispatch(fetchOrderActivity(updated.id)),
    ]);
  }

  async function handleStatusChange(order: Order, nextStatus: OrderStatus) {
    const confirmed = await confirm(
      nextStatus === 'SHIPPED'
        ? {
            title: `Ship ${order.orderNumber}?`,
            description:
              'This deducts the allocated on-hand stock and cannot be reversed.',
            confirmLabel: 'Ship order',
            tone: 'danger',
          }
        : nextStatus === 'CANCELED'
          ? {
              title: `Cancel ${order.orderNumber}?`,
              description:
                'The order leaves the allocation plan and its supply returns to ATP. This cannot be undone.',
              confirmLabel: 'Cancel order',
              tone: 'danger',
            }
          : {
              title: `Move ${order.orderNumber} to ${humanize(nextStatus).toLowerCase()}?`,
              description: `The order changes from ${humanize(order.status).toLowerCase()} to ${humanize(nextStatus).toLowerCase()}.`,
              confirmLabel: TRANSITION_LABEL[nextStatus] ?? 'Confirm',
            },
    );

    if (!confirmed) return;

    dispatch(clearOrderError());

    try {
      await dispatch(
        updateOrderStatus({
          id: order.id,
          status: nextStatus as 'CONFIRMED' | 'FULFILLING' | 'SHIPPED' | 'CANCELED',
        }),
      ).unwrap();

      toast({
        title: `${order.orderNumber} is now ${humanize(nextStatus).toLowerCase()}`,
      });

      await Promise.all([
        dispatch(fetchOrders()),
        dispatch(fetchOrderTimeline(order.id)),
        dispatch(fetchAllocationPlan()),
        dispatch(fetchOrderActivity(order.id)),
      ]);
    } catch {
      // The Redux slice keeps the backend error message for the panel.
    }
  }

  const splitFromNumber = selectedOrder?.splitFromOrderId
    ? items.find((order) => order.id === selectedOrder.splitFromOrderId)
        ?.orderNumber
    : null;

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        eyebrowIcon={<ShoppingCart />}
        title="Orders"
        description="Customer demand, its allocation plan and promise dates. Open an order to see its line-level plan and take planner actions."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw />}
              loading={loading || planLoading}
              onClick={() => {
                dispatch(fetchOrders());
                dispatch(fetchAllocationPlan());
              }}
            >
              Refresh
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
              New order
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard index={0} label="Total orders" value={items.length} icon={<ClipboardList />} />
        <StatCard
          index={1}
          label="Drafts"
          value={statusCounts.DRAFT}
          icon={<Pencil />}
          hint="Not yet in the allocation plan"
          onClick={() => setStatusFilter('DRAFT')}
          active={statusFilter === 'DRAFT'}
        />
        <StatCard
          index={2}
          label="In fulfillment"
          value={statusCounts.CONFIRMED + statusCounts.FULFILLING}
          icon={<Truck />}
          tone="accent"
          hint={`${statusCounts.CONFIRMED} confirmed · ${statusCounts.FULFILLING} fulfilling`}
        />
        <StatCard
          index={3}
          label="At risk"
          value={atRiskCount}
          icon={<ShieldAlert />}
          tone={atRiskCount > 0 ? 'danger' : 'success'}
          hint="Short or late against the plan"
          onClick={() => {
            setRiskFilter(riskFilter === 'SHORT' ? 'ALL' : 'SHORT');
            setSortKey('risk');
          }}
          active={riskFilter === 'SHORT'}
        />
        <StatCard
          index={4}
          label="Shipped"
          value={statusCounts.SHIPPED}
          icon={<PackageCheck />}
          tone="success"
        />
      </div>

      {error && !selectedOrder && !formOpen && (
        <Alert tone="danger" title="Something went wrong">
          {error}
        </Alert>
      )}

      <Card>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search order number or customer..."
          />
          <select
            className="select select-sm"
            style={{ width: 'auto' }}
            value={priorityFilter}
            onChange={(event) =>
              setPriorityFilter(event.target.value as 'ALL' | Priority)
            }
            aria-label="Filter by priority"
          >
            <option value="ALL">All priorities</option>
            <option value="HIGH">High priority</option>
            <option value="MED">Medium priority</option>
            <option value="LOW">Low priority</option>
          </select>
          <select
            className="select select-sm"
            style={{ width: 'auto' }}
            value={riskFilter}
            onChange={(event) => setRiskFilter(event.target.value as RiskFilter)}
            aria-label="Filter by risk"
          >
            <option value="ALL">Any risk</option>
            {(Object.keys(RISK_META) as OrderRisk[]).map((risk) => (
              <option key={risk} value={risk}>
                {RISK_META[risk].label}
              </option>
            ))}
          </select>
          <div className="toolbar-spacer" />
          <select
            className="select select-sm"
            style={{ width: 'auto' }}
            value={sortKey}
            onChange={(event) => setSortKey(event.target.value as SortKey)}
            aria-label="Sort orders"
          >
            {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
              <option key={key} value={key}>
                Sort: {SORT_LABELS[key]}
              </option>
            ))}
          </select>
        </div>
        <div className="toolbar">
          <SegmentedControl
            label="Filter by status"
            value={statusFilter}
            onChange={setStatusFilter}
            options={STATUS_FILTERS.map((status) => ({
              value: status,
              label: status === 'ALL' ? 'All' : humanize(status),
              count: statusCounts[status],
            }))}
          />
          <div className="toolbar-spacer" />
          {filtersActive && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearch('');
                setStatusFilter('ALL');
                setPriorityFilter('ALL');
                setRiskFilter('ALL');
              }}
            >
              Clear filters
            </Button>
          )}
        </div>

        {loading && items.length === 0 ? (
          <TableSkeleton rows={8} columns={7} />
        ) : filteredOrders.length === 0 ? (
          <EmptyState
            icon={<ShoppingCart />}
            title={items.length === 0 ? 'No orders yet' : 'No orders match'}
            description={
              items.length === 0
                ? 'Create the first customer order to start planning.'
                : 'Try a different search or clear the filters.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
                  New order
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Requested</th>
                  <th>Promised</th>
                  <th>Coverage</th>
                  <th>Risk</th>
                  <th className="actions-cell">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => {
                  const health = healthByOrderId.get(order.id) ?? null;
                  const lateBy =
                    health?.promisedShipDate && order.requestedShipDate
                      ? daysBetween(order.requestedShipDate, health.promisedShipDate)
                      : 0;

                  return (
                    <tr
                      key={order.id}
                      className={`is-clickable${order.id === selectedOrderId ? ' is-selected' : ''}`}
                      onClick={() => openOrderDetails(order)}
                    >
                      <td>
                        <span className="cell-primary">{order.orderNumber}</span>
                        <span className="cell-secondary">
                          {order.customerName} · {pluralize(order.lines.length, 'line')}
                        </span>
                      </td>
                      <td>
                        <PriorityBadge priority={order.priority} />
                      </td>
                      <td>
                        <OrderStatusBadge status={order.status} />
                      </td>
                      <td className="tabular">{formatDate(order.requestedShipDate)}</td>
                      <td className="tabular">
                        {health ? (
                          health.promisedShipDate ? (
                            <>
                              {formatDate(health.promisedShipDate)}
                              {lateBy > 0 && (
                                <span className="cell-secondary text-danger">
                                  {lateBy}d late
                                </span>
                              )}
                            </>
                          ) : (
                            <span className="text-danger">No promise</span>
                          )
                        ) : (
                          <span className="cell-muted">—</span>
                        )}
                      </td>
                      <td style={{ minWidth: 150 }}>
                        <CoverageCell health={health} />
                      </td>
                      <td>
                        <RiskBadge health={health} />
                      </td>
                      <td className="actions-cell">
                        {order.status === 'DRAFT' && (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<Pencil />}
                            aria-label={`Edit ${order.orderNumber}`}
                            onClick={(event) => {
                              event.stopPropagation();
                              openEditForm(order);
                            }}
                          />
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<ChevronRight />}
                          aria-label={`Open ${order.orderNumber}`}
                          onClick={(event) => {
                            event.stopPropagation();
                            openOrderDetails(order);
                          }}
                        />
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
            Showing {filteredOrders.length} of {items.length} orders
          </span>
          <span>Sorted by {SORT_LABELS[sortKey].toLowerCase()}</span>
        </div>
      </Card>

      {/* Order details */}
      <Drawer
        open={Boolean(selectedOrderId)}
        onClose={closeOrderDetails}
        label={selectedOrder ? `Order ${selectedOrder.orderNumber}` : 'Order details'}
        title={
          selectedOrder ? (
            <div className="drawer-title-row">
              <h2 className="drawer-title">{selectedOrder.orderNumber}</h2>
              <OrderStatusBadge status={selectedOrder.status} />
              <PriorityBadge priority={selectedOrder.priority} />
            </div>
          ) : (
            <h2 className="drawer-title">Order details</h2>
          )
        }
        subtitle={
          selectedOrder
            ? `${selectedOrder.customerName} · created ${formatDateTime(selectedOrder.createdAt)}`
            : undefined
        }
      >
        {!selectedOrder ? (
          loading ? (
            <div style={{ display: 'grid', gap: 12 }}>
              <Skeleton height={60} />
              <Skeleton height={160} />
            </div>
          ) : (
            <EmptyState
              title="Order not found"
              description="It may have been removed, or the link is out of date."
            />
          )
        ) : (
          <div className="order-detail">
            {error && (
              <Alert tone="danger" title="Action failed">
                {error}
              </Alert>
            )}

            <div className="order-actions-bar">
              {statusTransitions[selectedOrder.status].length === 0 ? (
                <span className="text-muted">
                  This order is {humanize(selectedOrder.status).toLowerCase()}.
                  No further status changes are possible.
                </span>
              ) : (
                statusTransitions[selectedOrder.status].map((nextStatus) => (
                  <Button
                    key={nextStatus}
                    variant={
                      nextStatus === 'CANCELED'
                        ? 'danger-ghost'
                        : nextStatus === 'SHIPPED'
                          ? 'primary'
                          : 'secondary'
                    }
                    size="sm"
                    icon={nextStatus === 'CANCELED' ? <Trash2 /> : <ArrowRight />}
                    disabled={saving}
                    onClick={() => handleStatusChange(selectedOrder, nextStatus)}
                  >
                    {TRANSITION_LABEL[nextStatus]}
                  </Button>
                ))
              )}

              {PLANNED_STATUSES.includes(selectedOrder.status) &&
                selectedOrder.lines.reduce((sum, line) => sum + line.quantity, 0) > 1 && (
                  <Button
                    size="sm"
                    icon={<Split />}
                    onClick={() => setPlannerAction({ kind: 'split' })}
                  >
                    Split shipment
                  </Button>
                )}

              {selectedOrder.status === 'DRAFT' && (
                <Button
                  size="sm"
                  icon={<Pencil />}
                  onClick={() => openEditForm(selectedOrder)}
                >
                  Edit draft
                </Button>
              )}
            </div>

            <dl className="definition-grid">
              <div className="definition-item">
                <dt>Requested ship</dt>
                <dd>{formatDate(selectedOrder.requestedShipDate)}</dd>
              </div>
              <div className="definition-item">
                <dt>Promised ship</dt>
                <dd>
                  {selectedHealth
                    ? selectedHealth.promisedShipDate
                      ? formatDate(selectedHealth.promisedShipDate)
                      : 'No promise yet'
                    : 'Not planned'}
                </dd>
              </div>
              <div className="definition-item">
                <dt>Coverage</dt>
                <dd>
                  {selectedHealth
                    ? `${selectedHealth.allocated} of ${selectedHealth.requested} units`
                    : '—'}
                </dd>
              </div>
              <div className="definition-item">
                <dt>Risk</dt>
                <dd>
                  <RiskBadge health={selectedHealth} />
                </dd>
              </div>
            </dl>

            {selectedOrder.splitFromOrderId && (
              <Alert tone="info">
                Split from <strong>{splitFromNumber ?? 'another order'}</strong>
                . It keeps the original order&apos;s place in the allocation
                queue.
              </Alert>
            )}

            {plannerAction && (
              <OrderPlannerPanel
                key={
                  plannerAction.kind === 'split'
                    ? 'split'
                    : `${plannerAction.kind}-${plannerAction.orderLineId}`
                }
                order={selectedOrder}
                planOrder={selectedAllocation}
                warehouses={warehouses}
                action={plannerAction}
                onClose={() => setPlannerAction(null)}
                onCompleted={handlePlannerCompleted}
              />
            )}

            <div className="section-title">
              <div>
                <h3>Lines and fulfillment plan</h3>
                <p>
                  {selectedAllocation
                    ? 'Live plan, recalculated from current supply.'
                    : 'Confirm the order to include it in the allocation plan.'}
                </p>
              </div>
            </div>

            <div className="plan-lines">
              {selectedOrder.lines.map((line) => {
                const planLine = selectedAllocation?.lines.find(
                  (item) => item.orderLineId === line.id,
                );

                return (
                  <div className="plan-line" key={line.id}>
                    <div className="plan-line-head">
                      <div>
                        <span className="cell-primary">
                          {line.sku.skuCode}{' '}
                          <span className="text-muted" style={{ fontWeight: 400 }}>
                            {line.sku.name}
                          </span>
                        </span>
                        <span className="cell-secondary icon-inline">
                          <MapPin />
                          Ships from{' '}
                          {line.preferredWarehouse?.code ?? 'any warehouse'}
                        </span>
                      </div>
                      <div className="btn-group">
                        {REASSIGNABLE_STATUSES.includes(selectedOrder.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<MapPin />}
                            onClick={() =>
                              setPlannerAction({
                                kind: 'reassign',
                                orderLineId: line.id,
                              })
                            }
                          >
                            Reassign
                          </Button>
                        )}
                        {PLANNED_STATUSES.includes(selectedOrder.status) && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={<CalendarCog />}
                            onClick={() =>
                              setPlannerAction({
                                kind: 'override',
                                orderLineId: line.id,
                              })
                            }
                          >
                            Override promise
                          </Button>
                        )}
                      </div>
                    </div>

                    {planLine ? (
                      <>
                        <div className="plan-line-stats">
                          <div>
                            <span>Requested</span>
                            <strong>{line.quantity}</strong>
                          </div>
                          <div>
                            <span>Allocated</span>
                            <strong>{planLine.allocatedQuantity}</strong>
                          </div>
                          <div>
                            <span>Backordered</span>
                            <strong
                              className={planLine.backorderedQuantity > 0 ? 'text-danger' : undefined}
                            >
                              {planLine.backorderedQuantity}
                            </strong>
                          </div>
                          <div>
                            <span>Promised</span>
                            <strong>
                              {formatDate(planLine.promisedShipDate)}
                              {planLine.isLate && (
                                <Badge tone="warning" className="inline-badge">
                                  Late
                                </Badge>
                              )}
                              {planLine.promiseOverridden && (
                                <Badge tone="accent" className="inline-badge">
                                  Override
                                </Badge>
                              )}
                            </strong>
                          </div>
                        </div>

                        <div className="plan-sources">
                          {planLine.allocations.length === 0 ? (
                            <span className="source-chip is-empty">
                              No supply allocated
                            </span>
                          ) : (
                            planLine.allocations.map((allocation, index) => (
                              <span
                                key={`${line.id}-${index}`}
                                className={`source-chip ${allocation.source === 'ON_HAND' ? 'is-onhand' : 'is-inbound'}`}
                              >
                                <strong>{allocation.quantity}</strong>
                                {allocation.warehouseCode} ·{' '}
                                {allocation.source === 'ON_HAND'
                                  ? 'on hand'
                                  : `inbound ${allocation.receiptId ?? ''}`}
                                {allocation.expectedArrivalTime &&
                                  ` · ETA ${formatDate(allocation.expectedArrivalTime)}`}
                              </span>
                            ))
                          )}
                          {planLine.backorderedQuantity > 0 && (
                            <span className="source-chip is-short">
                              <strong>{planLine.backorderedQuantity}</strong>
                              backordered
                            </span>
                          )}
                        </div>

                        <p className="plan-reason">
                          {planLine.promiseReason}
                          {planLine.promiseOverridden && (
                            <>
                              {' '}
                              Computed date:{' '}
                              {formatDate(planLine.computedPromisedShipDate)}.
                            </>
                          )}
                        </p>
                      </>
                    ) : (
                      <p className="plan-reason">
                        {line.quantity} units requested.{' '}
                        {planLoading ? 'Refreshing plan...' : 'Not in the current plan.'}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="detail-columns">
              <div>
                <div className="section-title">
                  <h3>Status timeline</h3>
                </div>
                {timelineLoading ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <Skeleton height={12} width="70%" />
                    <Skeleton height={12} width="55%" />
                  </div>
                ) : timeline?.id === selectedOrder.id &&
                  timeline.statusHistory.length > 0 ? (
                  <ol className="timeline">
                    {timeline.statusHistory.map((event) => (
                      <li key={event.id} className="timeline-item">
                        <span className="timeline-dot" />
                        <div>
                          <strong>
                            {event.fromStatus
                              ? `${humanize(event.fromStatus)} → ${humanize(event.toStatus)}`
                              : `Created as ${humanize(event.toStatus).toLowerCase()}`}
                          </strong>
                          <span>{formatDateTime(event.changedAt)}</span>
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted">No timeline events found.</p>
                )}
              </div>

              <div>
                <div className="section-title">
                  <h3>Activity and audit trail</h3>
                </div>
                {orderActivityLoading && orderActivityId === selectedOrder.id ? (
                  <div style={{ display: 'grid', gap: 10 }}>
                    <Skeleton height={12} width="80%" />
                    <Skeleton height={12} width="60%" />
                  </div>
                ) : orderActivityId === selectedOrder.id &&
                  orderActivity.length > 0 ? (
                  <ol className="timeline">
                    {orderActivity.map((entry) => (
                      <li key={entry.id} className="timeline-item">
                        <span className="timeline-dot is-accent" />
                        <div>
                          <strong>{formatAuditAction(entry.action)}</strong>
                          <span>
                            {formatDateTime(entry.createdAt)} · {entry.actor}
                          </span>
                          {entry.reason && (
                            <span className="timeline-reason">
                              “{entry.reason}”
                            </span>
                          )}
                          <AuditChanges entry={entry} />
                        </div>
                      </li>
                    ))}
                  </ol>
                ) : (
                  <p className="text-muted">
                    No audited activity yet. Changes made from now on are
                    recorded here.
                  </p>
                )}
              </div>
            </div>
          </div>
        )}
      </Drawer>

      {/* Create / edit */}
      <Modal
        open={formOpen}
        onClose={closeForm}
        size="lg"
        title={editingOrder ? `Edit ${editingOrder.orderNumber}` : 'New order'}
        description={
          editingOrder
            ? 'Only draft orders can be edited. Changes are recorded in the audit log.'
            : 'Orders start as drafts. Confirm them to include them in the allocation plan.'
        }
        footer={
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button
              variant="primary"
              type="submit"
              form="order-form"
              loading={saving}
            >
              {editingOrder ? 'Save changes' : 'Create order'}
            </Button>
          </>
        }
      >
        <form id="order-form" className="form-grid" onSubmit={handleSubmit}>
          {(formError || error) && (
            <Alert tone="danger" className="span-2">
              {formError || error}
            </Alert>
          )}

          {!editingOrder && (
            <Field label="Order number" required>
              <input
                className="input"
                value={form.orderNumber}
                onChange={(event) =>
                  updateFormField('orderNumber', event.target.value)
                }
                minLength={3}
                maxLength={100}
                required
                placeholder="e.g. SCM-ORD-001"
              />
            </Field>
          )}

          <Field label="Customer name" required>
            <input
              className="input"
              value={form.customerName}
              onChange={(event) =>
                updateFormField('customerName', event.target.value)
              }
              minLength={2}
              maxLength={150}
              required
              placeholder="Customer name"
            />
          </Field>

          <Field label="Priority">
            <select
              className="select"
              value={form.priority}
              onChange={(event) =>
                updateFormField('priority', event.target.value as Priority)
              }
            >
              {(['HIGH', 'MED', 'LOW'] as Priority[]).map((priority) => (
                <option key={priority} value={priority}>
                  {PRIORITY_LABEL[priority]}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Requested ship date">
            <input
              className="input"
              type="date"
              value={form.requestedShipDate}
              onChange={(event) =>
                updateFormField('requestedShipDate', event.target.value)
              }
            />
          </Field>

          <div className="span-2 line-editor">
            <div className="line-editor-head">
              <div>
                <h3>Order lines</h3>
                <p className="text-muted">
                  SKU, quantity and an optional preferred warehouse.
                </p>
              </div>
              <Button size="sm" icon={<Plus />} onClick={addLine}>
                Add line
              </Button>
            </div>

            {form.lines.map((line, index) => (
              <div className="line-editor-row" key={index}>
                <span className="line-index">{index + 1}</span>
                <Field label="SKU" required>
                  <select
                    className="select"
                    value={line.skuId}
                    onChange={(event) =>
                      updateLine(index, 'skuId', event.target.value)
                    }
                    required
                  >
                    <option value="">Select SKU</option>
                    {skus.map((sku) => (
                      <option value={sku.id} key={sku.id}>
                        {sku.skuCode} — {sku.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="Quantity" required>
                  <input
                    className="input"
                    type="number"
                    min="1"
                    step="1"
                    value={line.quantity}
                    onChange={(event) =>
                      updateLine(index, 'quantity', event.target.value)
                    }
                    required
                  />
                </Field>
                <Field label="Preferred warehouse">
                  <select
                    className="select"
                    value={line.preferredWarehouseId}
                    onChange={(event) =>
                      updateLine(index, 'preferredWarehouseId', event.target.value)
                    }
                  >
                    <option value="">No preference</option>
                    {warehouses.map((warehouse) => (
                      <option value={warehouse.id} key={warehouse.id}>
                        {warehouse.code} — {warehouse.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<Trash2 />}
                  disabled={form.lines.length === 1}
                  onClick={() => removeLine(index)}
                  aria-label={`Remove line ${index + 1}`}
                  className="line-remove"
                />
              </div>
            ))}
          </div>
        </form>
      </Modal>
    </div>
  );
}

export default OrdersManagement;
