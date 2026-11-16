import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { fetchSkus } from '../features/skus/skuSlice';
import { fetchWarehouses } from '../features/warehouses/warehouseSlice';

import { useAppDispatch, useAppSelector } from '../app/hooks';
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

import type {
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

/** Orders the allocation engine plans for; promise and split actions apply. */
const PLANNED_STATUSES: OrderStatus[] = ['CONFIRMED', 'FULFILLING'];

/** Orders whose lines may still change fulfillment location. */
const REASSIGNABLE_STATUSES: OrderStatus[] = ['DRAFT', ...PLANNED_STATUSES];

const statusTransitions: Record<OrderStatus, OrderStatus[]> = {
  DRAFT: ['CONFIRMED', 'CANCELED'],
  CONFIRMED: ['FULFILLING', 'CANCELED'],
  FULFILLING: ['SHIPPED', 'CANCELED'],
  SHIPPED: [],
  CANCELED: [],
};

function formatDate(value: string | null | undefined): string {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString();
}

function getStatusClass(status: string): string {
  return `order-status order-status-${status.toLowerCase()}`;
}

function OrdersManagement() {
  const dispatch = useAppDispatch();

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

  const skus = useAppSelector((state) =>
    state.skus.items.filter((sku) => sku.isActive),
  );

  const warehouses = useAppSelector((state) =>
    state.warehouses.items.filter((warehouse) => warehouse.isActive),
  );

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [priorityFilter, setPriorityFilter] = useState('ALL');

  const [showForm, setShowForm] = useState(false);
  const [editingOrder, setEditingOrder] = useState<Order | null>(null);
  const [form, setForm] = useState<OrderForm>(emptyForm);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [plannerAction, setPlannerAction] =
    useState<OrderPlannerAction | null>(null);

  const {
    orderActivity,
    orderActivityId,
    orderActivityLoading,
  } = useAppSelector((state) => state.audit);

  useEffect(() => {
    dispatch(fetchOrders());
    dispatch(fetchAllocationPlan());
    dispatch(fetchSkus());
    dispatch(fetchWarehouses());
  }, [dispatch]);

  const filteredOrders = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((order) => {
      const matchesSearch =
        !term ||
        order.orderNumber.toLowerCase().includes(term) ||
        order.customerName.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'ALL' || order.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'ALL' || order.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [items, search, statusFilter, priorityFilter]);

  const selectedAllocation = useMemo(
    () =>
      allocationPlan?.orders.find(
        (order) => order.orderId === selectedOrder?.id,
      ) ?? null,
    [allocationPlan, selectedOrder],
  );

  function openCreateForm() {
    setEditingOrder(null);
    setForm(emptyForm);
    setFormError('');
    setSuccessMessage('');
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
    setSuccessMessage('');
    dispatch(clearOrderError());
    setShowForm(true);
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
    setSuccessMessage('');

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

        setSuccessMessage('Order updated successfully.');
      } else {
        const payload: CreateOrderInput = {
          orderNumber: form.orderNumber.trim(),
          customerName: form.customerName.trim(),
          priority: form.priority,
          requestedShipDate: form.requestedShipDate || undefined,
          lines,
        };

        await dispatch(createOrder(payload)).unwrap();
        setSuccessMessage('Order created successfully.');
      }

      setShowForm(false);
      await dispatch(fetchOrders());
      await dispatch(fetchAllocationPlan());
    } catch {
      setFormError('The order could not be saved. Check the API error below.');
    }
  }

  async function openOrderDetails(order: Order) {
    setSelectedOrder(order);
    setPlannerAction(null);
    dispatch(clearOrderTimeline());
    dispatch(clearOrderError());

    await Promise.all([
      dispatch(fetchOrderTimeline(order.id)),
      dispatch(fetchAllocationPlan()),
      dispatch(fetchOrderActivity(order.id)),
    ]);
  }

  async function handlePlannerCompleted(message: string, updated: Order) {
    setPlannerAction(null);
    setSelectedOrder(updated);
    setSuccessMessage(message);

    await Promise.all([
      dispatch(fetchOrders()),
      dispatch(fetchAllocationPlan()),
      dispatch(fetchOrderTimeline(updated.id)),
      dispatch(fetchOrderActivity(updated.id)),
    ]);
  }

  async function handleStatusChange(
    order: Order,
    nextStatus: OrderStatus,
  ) {
    const message =
      nextStatus === 'SHIPPED'
        ? `Ship ${order.orderNumber}?\n\nThis action deducts allocated on-hand stock and cannot be reversed.`
        : `Change ${order.orderNumber} from ${order.status} to ${nextStatus}?`;

    if (!window.confirm(message)) return;

    setSuccessMessage('');
    dispatch(clearOrderError());

    try {
      const updated = await dispatch(
        updateOrderStatus({
          id: order.id,
          status: nextStatus as
            | 'CONFIRMED'
            | 'FULFILLING'
            | 'SHIPPED'
            | 'CANCELED',
        }),
      ).unwrap();

      setSelectedOrder(updated);
      setSuccessMessage(
        `${order.orderNumber} status changed to ${nextStatus}.`,
      );

      await Promise.all([
        dispatch(fetchOrders()),
        dispatch(fetchOrderTimeline(order.id)),
        dispatch(fetchAllocationPlan()),
        dispatch(fetchOrderActivity(order.id)),
      ]);
    } catch {
      // The Redux slice retains the backend error message.
    }
  }

  const totalOrders = items.length;
  const draftOrders = items.filter((order) => order.status === 'DRAFT').length;
  const activeOrders = items.filter(
    (order) => ['CONFIRMED', 'FULFILLING'].includes(order.status),
  ).length;
  const highPriorityOrders = items.filter(
    (order) => order.priority === 'HIGH' &&
      !['SHIPPED', 'CANCELED'].includes(order.status),
  ).length;

  return (
    <div className="page-container orders-page">
      <div className="page-header">
        <div>
          <p className="page-eyebrow">ORDER OPERATIONS</p>
          <h1>Orders Management</h1>
          <p>Manage customer orders, fulfillment allocation and order progress.</p>
        </div>

        <button className="primary-button" onClick={openCreateForm}>
          + Create Order
        </button>
      </div>

      <div className="order-stat-grid">
        <div className="order-stat-card">
          <span>Total orders</span>
          <strong>{totalOrders}</strong>
        </div>
        <div className="order-stat-card">
          <span>Draft orders</span>
          <strong>{draftOrders}</strong>
        </div>
        <div className="order-stat-card">
          <span>Active fulfillment</span>
          <strong>{activeOrders}</strong>
        </div>
        <div className="order-stat-card">
          <span>Open high priority</span>
          <strong>{highPriorityOrders}</strong>
        </div>
      </div>

      {successMessage && (
        <div className="order-success-message">{successMessage}</div>
      )}

      {error && <div className="form-error">{error}</div>}

      {showForm && (
        <section className="sku-form-panel order-form-panel">
          <div className="order-section-heading">
            <div>
              <h2>{editingOrder ? 'Edit Draft Order' : 'Create Order'}</h2>
              <p>
                {editingOrder
                  ? 'Only draft orders can be edited.'
                  : 'Create an order with one or more SKU lines.'}
              </p>
            </div>
            <button
              className="secondary-button"
              type="button"
              onClick={() => setShowForm(false)}
            >
              Close
            </button>
          </div>

          <form className="sku-form order-form" onSubmit={handleSubmit}>
            {!editingOrder && (
              <label>
                Order number *
                <input
                  value={form.orderNumber}
                  onChange={(event) =>
                    updateFormField('orderNumber', event.target.value)
                  }
                  minLength={3}
                  maxLength={100}
                  required
                  placeholder="e.g. SCM-ORD-001"
                />
              </label>
            )}

            <label>
              Customer name *
              <input
                value={form.customerName}
                onChange={(event) =>
                  updateFormField('customerName', event.target.value)
                }
                minLength={2}
                maxLength={150}
                required
                placeholder="Customer name"
              />
            </label>

            <label>
              Priority
              <select
                value={form.priority}
                onChange={(event) =>
                  updateFormField('priority', event.target.value as Priority)
                }
              >
                <option value="LOW">Low</option>
                <option value="MED">Medium</option>
                <option value="HIGH">High</option>
              </select>
            </label>

            <label>
              Requested ship date
              <input
                type="date"
                value={form.requestedShipDate}
                onChange={(event) =>
                  updateFormField('requestedShipDate', event.target.value)
                }
              />
            </label>

            <div className="order-lines-editor">
              <div className="order-section-heading">
                <div>
                  <h3>Order lines</h3>
                  <p>Choose a SKU, quantity and optional preferred warehouse.</p>
                </div>
                <button
                  className="secondary-button"
                  type="button"
                  onClick={addLine}
                >
                  + Add line
                </button>
              </div>

              {form.lines.map((line, index) => (
                <div className="order-line-editor" key={index}>
                  <label>
                    SKU *
                    <select
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
                  </label>

                  <label>
                    Quantity *
                    <input
                      type="number"
                      min="1"
                      step="1"
                      value={line.quantity}
                      onChange={(event) =>
                        updateLine(index, 'quantity', event.target.value)
                      }
                      required
                    />
                  </label>

                  <label>
                    Preferred warehouse
                    <select
                      value={line.preferredWarehouseId}
                      onChange={(event) =>
                        updateLine(
                          index,
                          'preferredWarehouseId',
                          event.target.value,
                        )
                      }
                    >
                      <option value="">No preference</option>
                      {warehouses.map((warehouse) => (
                        <option value={warehouse.id} key={warehouse.id}>
                          {warehouse.code} — {warehouse.name}
                        </option>
                      ))}
                    </select>
                  </label>

                  <button
                    className="text-danger-button"
                    type="button"
                    disabled={form.lines.length === 1}
                    onClick={() => removeLine(index)}
                    aria-label={`Remove line ${index + 1}`}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>

            {formError && <div className="form-error">{formError}</div>}

            <div className="order-form-actions">
              <button
                className="secondary-button"
                type="button"
                onClick={() => setShowForm(false)}
              >
                Cancel
              </button>
              <button className="primary-button" type="submit" disabled={saving}>
                {saving
                  ? 'Saving...'
                  : editingOrder
                    ? 'Save Changes'
                    : 'Create Order'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="sku-table-panel">
        <div className="order-section-heading">
          <div>
            <h2>Customer orders</h2>
            <p>{filteredOrders.length} orders shown</p>
          </div>
          <button
            className="secondary-button"
            onClick={() => {
              dispatch(fetchOrders());
              dispatch(fetchAllocationPlan());
            }}
          >
            Refresh
          </button>
        </div>

        <div className="sku-toolbar order-toolbar">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search order number or customer..."
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All statuses</option>
            <option value="DRAFT">Draft</option>
            <option value="CONFIRMED">Confirmed</option>
            <option value="FULFILLING">Fulfilling</option>
            <option value="SHIPPED">Shipped</option>
            <option value="CANCELED">Canceled</option>
          </select>

          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value)}
          >
            <option value="ALL">All priorities</option>
            <option value="HIGH">High</option>
            <option value="MED">Medium</option>
            <option value="LOW">Low</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading orders...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="empty-state">No orders match your filters.</div>
        ) : (
          <div className="table-responsive">
            <table className="sku-table order-table">
              <thead>
                <tr>
                  <th>Order</th>
                  <th>Customer</th>
                  <th>Priority</th>
                  <th>Requested ship</th>
                  <th>Lines</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      <strong>{order.orderNumber}</strong>
                    </td>
                    <td>{order.customerName}</td>
                    <td>
                      <span className={`priority-label priority-${order.priority.toLowerCase()}`}>
                        {order.priority}
                      </span>
                    </td>
                    <td>{formatDate(order.requestedShipDate)}</td>
                    <td>{order.lines.length}</td>
                    <td>
                      <span className={getStatusClass(order.status)}>
                        {order.status}
                      </span>
                    </td>
                    <td>
                      <div className="order-row-actions">
                        <button
                          className="table-action"
                          onClick={() => openOrderDetails(order)}
                        >
                          Details
                        </button>
                        {order.status === 'DRAFT' && (
                          <button
                            className="table-action"
                            onClick={() => openEditForm(order)}
                          >
                            Edit
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {selectedOrder && (
        <section className="sku-table-panel order-detail-panel">
          <div className="order-section-heading">
            <div>
              <p className="page-eyebrow">ORDER DETAILS</p>
              <h2>{selectedOrder.orderNumber}</h2>
              <p>
                {selectedOrder.customerName} · {selectedOrder.priority} priority
              </p>
            </div>
            <button
              className="secondary-button"
              onClick={() => {
                setSelectedOrder(null);
                setPlannerAction(null);
              }}
            >
              Close details
            </button>
          </div>

          <div className="order-detail-summary">
            <div>
              <span>Status</span>
              <strong>
                <span className={getStatusClass(selectedOrder.status)}>
                  {selectedOrder.status}
                </span>
              </strong>
            </div>
            <div>
              <span>Requested ship date</span>
              <strong>{formatDate(selectedOrder.requestedShipDate)}</strong>
            </div>
            <div>
              <span>Created</span>
              <strong>{formatDate(selectedOrder.createdAt)}</strong>
            </div>
            <div>
              <span>Order lines</span>
              <strong>{selectedOrder.lines.length}</strong>
            </div>
          </div>

          {selectedOrder.splitFromOrderId && (
            <p className="muted-text">
              Split from{' '}
              <strong>
                {items.find(
                  (order) => order.id === selectedOrder.splitFromOrderId,
                )?.orderNumber ?? 'another order'}
              </strong>
              .
            </p>
          )}

          <div className="order-status-actions">
            <strong>Available actions</strong>
            {statusTransitions[selectedOrder.status].length === 0 ? (
              <span className="muted-text">No further status transitions.</span>
            ) : (
              statusTransitions[selectedOrder.status].map((nextStatus) => (
                <button
                  key={nextStatus}
                  className={
                    nextStatus === 'CANCELED'
                      ? 'danger-button'
                      : 'secondary-button'
                  }
                  disabled={saving}
                  onClick={() => handleStatusChange(selectedOrder, nextStatus)}
                >
                  {nextStatus === 'SHIPPED'
                    ? 'Confirm Shipment'
                    : nextStatus === 'CANCELED'
                      ? 'Cancel Order'
                      : `Mark ${nextStatus}`}
                </button>
              ))
            )}

            {PLANNED_STATUSES.includes(selectedOrder.status) &&
              selectedOrder.lines.reduce(
                (sum, line) => sum + line.quantity,
                0,
              ) > 1 && (
                <button
                  className="secondary-button"
                  onClick={() => setPlannerAction({ kind: 'split' })}
                >
                  Split shipment
                </button>
              )}
          </div>

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

          <h3>Order lines and fulfillment plan</h3>
          <div className="table-responsive">
            <table className="sku-table order-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Requested</th>
                  <th>Allocated</th>
                  <th>Backordered</th>
                  <th>Promised ship</th>
                  <th>Promise reason</th>
                  <th>Planner actions</th>
                </tr>
              </thead>
              <tbody>
                {selectedOrder.lines.map((line) => {
                  const planLine = selectedAllocation?.lines.find(
                    (item) => item.orderLineId === line.id,
                  );

                  return (
                    <tr key={line.id}>
                      <td>
                        <strong>{line.sku.skuCode}</strong>
                        <span className="table-subtext">{line.sku.name}</span>
                        <span className="table-subtext">
                          Ships from:{' '}
                          {line.preferredWarehouse?.code ?? 'any warehouse'}
                        </span>
                      </td>
                      <td>{line.quantity}</td>
                      <td>{planLine?.allocatedQuantity ?? '—'}</td>
                      <td>{planLine?.backorderedQuantity ?? '—'}</td>
                      <td>
                        {formatDate(planLine?.promisedShipDate)}
                        {planLine?.isLate && (
                          <span className="order-late-label">Late</span>
                        )}
                        {planLine?.promiseOverridden && (
                          <>
                            <span className="order-override-label">
                              Override
                            </span>
                            <span className="table-subtext">
                              Computed:{' '}
                              {formatDate(planLine.computedPromisedShipDate)}
                            </span>
                          </>
                        )}
                      </td>
                      <td>{planLine?.promiseReason ?? 'Plan unavailable'}</td>
                      <td>
                        <div className="order-row-actions">
                          {REASSIGNABLE_STATUSES.includes(
                            selectedOrder.status,
                          ) && (
                            <button
                              className="table-action"
                              onClick={() =>
                                setPlannerAction({
                                  kind: 'reassign',
                                  orderLineId: line.id,
                                })
                              }
                            >
                              Reassign
                            </button>
                          )}
                          {PLANNED_STATUSES.includes(selectedOrder.status) && (
                            <button
                              className="table-action"
                              onClick={() =>
                                setPlannerAction({
                                  kind: 'override',
                                  orderLineId: line.id,
                                })
                              }
                            >
                              Override promise
                            </button>
                          )}
                          {!REASSIGNABLE_STATUSES.includes(
                            selectedOrder.status,
                          ) && <span className="muted-text">—</span>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <h3>Allocation sources</h3>
          {planLoading ? (
            <p className="muted-text">Refreshing allocation plan...</p>
          ) : selectedAllocation ? (
            <div className="order-allocation-list">
              {selectedAllocation.lines.map((line) => (
                <div className="order-allocation-item" key={line.orderLineId}>
                  <strong>{line.skuCode}</strong>
                  {line.allocations.length === 0 ? (
                    <span className="muted-text">No supply allocated.</span>
                  ) : (
                    line.allocations.map((allocation, index) => (
                      <span key={`${line.orderLineId}-${index}`}>
                        {allocation.warehouseCode}: {allocation.quantity} units
                        {' · '}
                        {allocation.source === 'ON_HAND'
                          ? 'On-hand stock'
                          : `Inbound ${allocation.receiptId ?? ''}`}
                        {allocation.expectedArrivalTime
                          ? ` · ETA ${formatDate(allocation.expectedArrivalTime)}`
                          : ''}
                      </span>
                    ))
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="muted-text">
              This order is not present in the current allocation plan.
            </p>
          )}

          <div className="order-timeline">
            <h3>Status timeline</h3>
            {timelineLoading ? (
              <p className="muted-text">Loading timeline...</p>
            ) : timeline?.id === selectedOrder.id &&
              timeline.statusHistory.length > 0 ? (
              <ol>
                {timeline.statusHistory.map((event) => (
                  <li key={event.id}>
                    <strong>
                      {event.fromStatus ?? 'ORDER CREATED'} → {event.toStatus}
                    </strong>
                    <span>{formatDateTime(event.changedAt)}</span>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted-text">No timeline events found.</p>
            )}
          </div>

          <div className="order-timeline">
            <h3>Activity and audit trail</h3>
            {orderActivityLoading && orderActivityId === selectedOrder.id ? (
              <p className="muted-text">Loading activity...</p>
            ) : orderActivityId === selectedOrder.id &&
              orderActivity.length > 0 ? (
              <ol className="order-activity">
                {orderActivity.map((entry) => (
                  <li key={entry.id}>
                    <strong>{formatAuditAction(entry.action)}</strong>
                    <span>
                      {new Date(entry.createdAt).toLocaleString()} ·{' '}
                      {entry.actor}
                    </span>
                    {entry.reason && (
                      <span className="order-activity-reason">
                        Reason: {entry.reason}
                      </span>
                    )}
                    <AuditChanges entry={entry} />
                  </li>
                ))}
              </ol>
            ) : (
              <p className="muted-text">
                No audited activity yet. Changes made from now on are recorded
                here.
              </p>
            )}
          </div>
        </section>
      )}
    </div>
  );
}

export default OrdersManagement;
