import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlarmClock,
  Ban,
  CalendarClock,
  CircleCheck,
  FastForward,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  Send,
  Ship,
  Truck,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useConfirm, useToast } from '../app/providers/contexts';
import {
  clearSupplyError,
  createReceipt,
  fetchReceipts,
  receiveReceipt,
  updateReceipt,
  updateReceiptStatus,
} from '../features/supply/supplySlice';
import type {
  CreateReceiptInput,
  UpdateReceiptInput,
} from '../features/supply/supplySlice';
import { fetchSkus } from '../features/skus/skuSlice';
import { fetchWarehouses } from '../features/warehouses/warehouseSlice';
import { fetchInventory } from '../features/inventory/inventorySlice';
import ExpediteReceiptPanel from '../features/planner/ExpediteReceiptPanel';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Field, SearchInput, SegmentedControl } from '../components/ui/Form';
import { Alert, EmptyState, TableSkeleton } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Overlay';
import { ReceiptStatusBadge } from '../components/ui/StatusBadges';
import { humanize } from '../components/ui/status';
import { daysFromToday, formatDate, formatDateTime, relativeDay } from '../utils/format';

import type { InboundReceipt, ReceiptStatus } from '../types';

type StatusFilter = 'ALL' | ReceiptStatus;

const STATUS_FILTERS: StatusFilter[] = [
  'ALL',
  'PLANNED',
  'IN_TRANSIT',
  'RECEIVED',
  'CANCELED',
];

const emptyForm: CreateReceiptInput = {
  receiptId: '',
  skuId: '',
  warehouseId: '',
  expectedArrivalTime: '',
  quantity: 1,
};

function toLocalDateTime(value: string): string {
  const date = new Date(value);
  const offset = date.getTimezoneOffset();
  return new Date(date.getTime() - offset * 60_000)
    .toISOString()
    .slice(0, 16);
}

function isOpen(receipt: InboundReceipt) {
  return receipt.status === 'PLANNED' || receipt.status === 'IN_TRANSIT';
}

function SupplyManagement() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const confirm = useConfirm();
  const [searchParams, setSearchParams] = useSearchParams();

  const { items, loading, saving, error } = useAppSelector(
    (state) => state.supply,
  );
  const skus = useAppSelector((state) => state.skus.items);
  const warehouses = useAppSelector((state) => state.warehouses.items);

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingReceipt, setEditingReceipt] =
    useState<InboundReceipt | null>(null);
  const [form, setForm] = useState<CreateReceiptInput>(emptyForm);
  const [formError, setFormError] = useState('');
  const [expeditingReceipt, setExpeditingReceipt] =
    useState<InboundReceipt | null>(null);

  // `?new=1` (from the command palette) opens the create dialog.
  const createRequested = searchParams.get('new') === '1';
  const formOpen = showForm || createRequested;

  useEffect(() => {
    dispatch(fetchReceipts());
    dispatch(fetchSkus());
    dispatch(fetchWarehouses());
    dispatch(clearSupplyError());
  }, [dispatch]);

  const activeSkus = useMemo(() => skus.filter((sku) => sku.isActive), [skus]);
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive),
    [warehouses],
  );

  const statusCounts = useMemo(() => {
    const counts: Record<StatusFilter, number> = {
      ALL: items.length,
      PLANNED: 0,
      IN_TRANSIT: 0,
      RECEIVED: 0,
      CANCELED: 0,
    };
    for (const receipt of items) counts[receipt.status] += 1;
    return counts;
  }, [items]);

  const filteredReceipts = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((receipt) => {
      const matchesSearch =
        !term ||
        receipt.receiptId.toLowerCase().includes(term) ||
        receipt.sku.skuCode.toLowerCase().includes(term) ||
        receipt.sku.name.toLowerCase().includes(term) ||
        receipt.warehouse.code.toLowerCase().includes(term) ||
        receipt.warehouse.name.toLowerCase().includes(term);

      const matchesStatus =
        statusFilter === 'ALL' || receipt.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [items, search, statusFilter]);

  const openReceipts = items.filter(isOpen);
  const overdueCount = openReceipts.filter(
    (receipt) => daysFromToday(receipt.expectedArrivalTime) < 0,
  ).length;
  const outstandingUnits = openReceipts.reduce(
    (sum, receipt) => sum + receipt.quantity,
    0,
  );

  function openCreateForm() {
    dispatch(clearSupplyError());
    setEditingReceipt(null);
    setForm({
      ...emptyForm,
      skuId: activeSkus[0]?.id ?? '',
      warehouseId: activeWarehouses[0]?.id ?? '',
    });
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(receipt: InboundReceipt) {
    dispatch(clearSupplyError());
    setEditingReceipt(receipt);
    setForm({
      receiptId: receipt.receiptId,
      skuId: receipt.skuId,
      warehouseId: receipt.warehouseId,
      expectedArrivalTime: toLocalDateTime(receipt.expectedArrivalTime),
      quantity: receipt.quantity,
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingReceipt(null);
    setForm(emptyForm);
    setFormError('');
    dispatch(clearSupplyError());
    if (createRequested) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete('new');
        return next;
      });
    }
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === 'quantity' ? Number(value) : value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    // A create opened from the command palette has no defaults yet.
    const skuId = form.skuId || (editingReceipt ? '' : activeSkus[0]?.id) || '';
    const warehouseId =
      form.warehouseId || (editingReceipt ? '' : activeWarehouses[0]?.id) || '';

    if (!skuId || !warehouseId) {
      setFormError('Select both a SKU and a warehouse.');
      return;
    }

    if (!Number.isInteger(form.quantity) || form.quantity < 1) {
      setFormError('Quantity must be a positive whole number.');
      return;
    }

    if (!form.expectedArrivalTime) {
      setFormError('Select an expected arrival date and time.');
      return;
    }

    const expectedArrivalTime = new Date(form.expectedArrivalTime).toISOString();

    try {
      if (editingReceipt) {
        const payload: UpdateReceiptInput = {
          quantity: form.quantity,
          expectedArrivalTime,
        };

        await dispatch(
          updateReceipt({ id: editingReceipt.id, data: payload }),
        ).unwrap();

        toast({
          title: 'Receipt updated',
          description: `${editingReceipt.receiptId} saved. The allocation plan uses the new values immediately.`,
        });
      } else {
        if (form.receiptId.trim().length < 3) {
          setFormError('Receipt ID must contain at least 3 characters.');
          return;
        }

        const payload: CreateReceiptInput = {
          receiptId: form.receiptId.trim(),
          skuId,
          warehouseId,
          expectedArrivalTime,
          quantity: form.quantity,
        };

        await dispatch(createReceipt(payload)).unwrap();
        toast({
          title: 'Receipt created',
          description: `${payload.receiptId} is now planned supply.`,
        });
      }

      closeForm();
    } catch {
      // Redux stores the API error.
    }
  }

  async function handleStatusChange(
    receipt: InboundReceipt,
    status: 'IN_TRANSIT' | 'CANCELED',
  ) {
    const confirmed = await confirm(
      status === 'CANCELED'
        ? {
            title: `Cancel ${receipt.receiptId}?`,
            description:
              'It drops out of planned supply. Orders relying on it are re-planned and may become backordered. This cannot be undone.',
            confirmLabel: 'Cancel receipt',
            tone: 'danger',
          }
        : {
            title: `Mark ${receipt.receiptId} as in transit?`,
            description: `${receipt.quantity} units of ${receipt.sku.skuCode} are on the way to ${receipt.warehouse.code}.`,
            confirmLabel: 'Mark in transit',
          },
    );

    if (!confirmed) return;

    try {
      await dispatch(updateReceiptStatus({ id: receipt.id, status })).unwrap();

      toast({
        title:
          status === 'CANCELED'
            ? `${receipt.receiptId} canceled`
            : `${receipt.receiptId} is in transit`,
      });
    } catch {
      toast({ title: 'Status not changed', tone: 'error' });
    }
  }

  async function handleReceive(receipt: InboundReceipt) {
    const confirmed = await confirm({
      title: `Receive ${receipt.receiptId}?`,
      description: `${receipt.quantity} units of ${receipt.sku.skuCode} are added to on-hand at ${receipt.warehouse.code}. Receiving is idempotent: repeating it never adds stock twice.`,
      confirmLabel: 'Receive stock',
    });

    if (!confirmed) return;

    try {
      await dispatch(receiveReceipt(receipt.id)).unwrap();
      await dispatch(fetchInventory()).unwrap();

      toast({
        title: `${receipt.receiptId} received`,
        description: 'Inventory balances have been refreshed.',
      });
    } catch {
      toast({ title: 'Receipt not received', tone: 'error' });
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        eyebrowIcon={<Truck />}
        title="Supply"
        description="Inbound receipts and expected arrivals. Changes flow straight into allocation and promise dates."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => dispatch(fetchReceipts())}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<Plus />}
              onClick={openCreateForm}
              disabled={activeSkus.length === 0 || activeWarehouses.length === 0}
            >
              New receipt
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          index={0}
          label="Planned"
          value={statusCounts.PLANNED}
          icon={<CalendarClock />}
          onClick={() =>
            setStatusFilter(statusFilter === 'PLANNED' ? 'ALL' : 'PLANNED')
          }
          active={statusFilter === 'PLANNED'}
        />
        <StatCard
          index={1}
          label="In transit"
          value={statusCounts.IN_TRANSIT}
          icon={<Ship />}
          tone="info"
          onClick={() =>
            setStatusFilter(statusFilter === 'IN_TRANSIT' ? 'ALL' : 'IN_TRANSIT')
          }
          active={statusFilter === 'IN_TRANSIT'}
        />
        <StatCard
          index={2}
          label="Overdue"
          value={overdueCount}
          icon={<AlarmClock />}
          tone={overdueCount > 0 ? 'danger' : 'success'}
          hint="Open receipts past their expected arrival"
        />
        <StatCard
          index={3}
          label="Outstanding units"
          value={outstandingUnits.toLocaleString()}
          icon={<Truck />}
          tone="accent"
          hint={`Across ${openReceipts.length} open receipts`}
        />
        <StatCard
          index={4}
          label="Received"
          value={statusCounts.RECEIVED}
          icon={<PackageCheck />}
          tone="success"
        />
      </div>

      {error && !formOpen && (
        <Alert
          tone="danger"
          title="Something went wrong"
          action={
            <Button size="sm" onClick={() => dispatch(fetchReceipts())}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Card>
        <div className="toolbar">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search receipt, SKU or warehouse..."
          />
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
        </div>

        {loading && items.length === 0 ? (
          <TableSkeleton rows={6} columns={7} />
        ) : filteredReceipts.length === 0 ? (
          <EmptyState
            icon={<Truck />}
            title={items.length === 0 ? 'No inbound receipts' : 'No receipts match'}
            description={
              items.length === 0
                ? 'Register expected deliveries so the plan can promise against them.'
                : 'Try a different search or status.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
                  New receipt
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th className="num">Quantity</th>
                  <th>Expected arrival</th>
                  <th>Status</th>
                  <th className="actions-cell">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.map((receipt) => {
                  const days = daysFromToday(receipt.expectedArrivalTime);
                  const overdue = isOpen(receipt) && days < 0;

                  return (
                    <tr key={receipt.id}>
                      <td>
                        <span className="cell-primary cell-code">
                          {receipt.receiptId}
                        </span>
                        <span className="cell-secondary">
                          Created {formatDate(receipt.createdAt)}
                        </span>
                      </td>
                      <td>
                        <span className="cell-primary">{receipt.sku.skuCode}</span>
                        <span className="cell-secondary">{receipt.sku.name}</span>
                      </td>
                      <td>
                        <span className="cell-primary">{receipt.warehouse.code}</span>
                        <span className="cell-secondary" title={receipt.warehouse.name}>
                          {receipt.warehouse.city}
                        </span>
                      </td>
                      <td className="num">{receipt.quantity.toLocaleString()}</td>
                      <td>
                        <span className="cell-primary tabular">
                          {formatDateTime(receipt.expectedArrivalTime)}
                        </span>
                        {isOpen(receipt) ? (
                          <span
                            className={`cell-secondary${overdue ? ' text-danger' : ''}`}
                          >
                            {overdue
                              ? `Overdue by ${Math.abs(days)} day${Math.abs(days) === 1 ? '' : 's'}`
                              : relativeDay(receipt.expectedArrivalTime)}
                          </span>
                        ) : receipt.receivedAt ? (
                          <span
                            className="cell-secondary"
                            title={formatDateTime(receipt.receivedAt)}
                          >
                            Received {formatDate(receipt.receivedAt)}
                          </span>
                        ) : null}
                      </td>
                      <td>
                        <ReceiptStatusBadge status={receipt.status} />
                      </td>
                      <td className="actions-cell">
                        {isOpen(receipt) ? (
                          <div className="row-actions">
                            {receipt.status === 'PLANNED' && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<Pencil />}
                                  disabled={saving}
                                  onClick={() => openEditForm(receipt)}
                                  aria-label={`Edit ${receipt.receiptId}`}
                                  title="Edit ETA or quantity"
                                />
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  icon={<Send />}
                                  disabled={saving}
                                  onClick={() => handleStatusChange(receipt, 'IN_TRANSIT')}
                                  aria-label={`Dispatch ${receipt.receiptId}`}
                                  title="Mark in transit"
                                />
                              </>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              icon={<FastForward />}
                              disabled={saving}
                              onClick={() => setExpeditingReceipt(receipt)}
                              aria-label={`Expedite ${receipt.receiptId}`}
                              title="Expedite: move arrival earlier"
                            />
                            <Button
                              variant="secondary"
                              size="sm"
                              icon={<CircleCheck />}
                              disabled={saving}
                              onClick={() => handleReceive(receipt)}
                            >
                              Receive
                            </Button>
                            <Button
                              variant="danger-ghost"
                              size="sm"
                              icon={<Ban />}
                              disabled={saving}
                              onClick={() => handleStatusChange(receipt, 'CANCELED')}
                              aria-label={`Cancel ${receipt.receiptId}`}
                              title="Cancel receipt"
                            />
                          </div>
                        ) : (
                          <span className="cell-muted">
                            {receipt.status === 'RECEIVED' ? 'Completed' : 'Canceled'}
                          </span>
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
            Showing {filteredReceipts.length} of {items.length} receipts
          </span>
          <span>Sorted by expected arrival</span>
        </div>
      </Card>

      <Modal
        open={formOpen}
        onClose={closeForm}
        title={editingReceipt ? `Edit ${editingReceipt.receiptId}` : 'New inbound receipt'}
        description={
          editingReceipt
            ? 'Update the expected arrival or quantity. The plan picks up the change immediately.'
            : 'Register an expected supply delivery.'
        }
        footer={
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" type="submit" form="receipt-form" loading={saving}>
              {editingReceipt ? 'Save changes' : 'Create receipt'}
            </Button>
          </>
        }
      >
        <form id="receipt-form" className="form-grid" onSubmit={handleSubmit}>
          {(formError || error) && (
            <Alert tone="danger" className="span-2">
              {formError || error}
            </Alert>
          )}

          {!editingReceipt && (
            <Field label="Receipt ID" required className="span-2">
              <input
                className="input"
                name="receiptId"
                value={form.receiptId}
                onChange={handleChange}
                placeholder="e.g. PO-RECEIPT-004"
                minLength={3}
                maxLength={100}
                required
              />
            </Field>
          )}

          <Field label="SKU" required>
            <select
              className="select"
              name="skuId"
              value={form.skuId || (editingReceipt ? '' : (activeSkus[0]?.id ?? ''))}
              onChange={handleChange}
              disabled={Boolean(editingReceipt)}
              required
            >
              <option value="">Select SKU</option>
              {(editingReceipt ? skus : activeSkus).map((sku) => (
                <option key={sku.id} value={sku.id}>
                  {sku.skuCode} — {sku.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Warehouse" required>
            <select
              className="select"
              name="warehouseId"
              value={
                form.warehouseId ||
                (editingReceipt ? '' : (activeWarehouses[0]?.id ?? ''))
              }
              onChange={handleChange}
              disabled={Boolean(editingReceipt)}
              required
            >
              <option value="">Select warehouse</option>
              {(editingReceipt ? warehouses : activeWarehouses).map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Quantity" required>
            <input
              className="input"
              type="number"
              name="quantity"
              value={form.quantity}
              onChange={handleChange}
              min="1"
              step="1"
              required
            />
          </Field>

          <Field label="Expected arrival" required>
            <input
              className="input"
              type="datetime-local"
              name="expectedArrivalTime"
              value={form.expectedArrivalTime}
              onChange={handleChange}
              required
            />
          </Field>
        </form>
      </Modal>

      <Modal
        open={Boolean(expeditingReceipt)}
        onClose={() => setExpeditingReceipt(null)}
        title={expeditingReceipt ? `Expedite ${expeditingReceipt.receiptId}` : 'Expedite'}
        description="Move the expected arrival earlier. Orders waiting on this receipt get an earlier promise."
      >
        {expeditingReceipt && (
          <ExpediteReceiptPanel
            key={expeditingReceipt.id}
            receipt={expeditingReceipt}
            onClose={() => setExpeditingReceipt(null)}
            onCompleted={async (message) => {
              setExpeditingReceipt(null);
              toast({ title: 'Receipt expedited', description: message });
              await dispatch(fetchReceipts());
            }}
          />
        )}
      </Modal>
    </div>
  );
}

export default SupplyManagement;
