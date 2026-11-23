import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  History,
  MapPin,
  PackageX,
  RefreshCw,
  ShieldAlert,
  SlidersHorizontal,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useToast } from '../app/providers/contexts';
import {
  clearHistoryError,
  clearInventoryError,
  createInventoryAdjustment,
  fetchAdjustmentHistory,
  fetchInventory,
} from '../features/inventory/inventorySlice';
import type { InventoryAdjustmentInput } from '../features/inventory/inventorySlice';
import { fetchSkus } from '../features/skus/skuSlice';
import { fetchWarehouses } from '../features/warehouses/warehouseSlice';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card, CardHeader } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Field, SearchInput, SegmentedControl } from '../components/ui/Form';
import {
  Alert,
  EmptyState,
  Meter,
  TableSkeleton,
} from '../components/ui/Feedback';
import { Modal } from '../components/ui/Overlay';
import { formatDateTime } from '../utils/format';
import type { Inventory } from '../types';

type Filter = 'ALL' | 'HEALTHY' | 'LOW' | 'OUT_OF_STOCK';
type StockState = Exclude<Filter, 'ALL'>;

const emptyForm: InventoryAdjustmentInput = {
  skuId: '',
  warehouseId: '',
  quantityChange: 0,
  reason: '',
};

function stockState(item: Inventory): StockState {
  if (item.onHandQuantity === 0) return 'OUT_OF_STOCK';
  if (item.onHandQuantity <= item.safetyStock) return 'LOW';
  return 'HEALTHY';
}

const STOCK_META: Record<
  StockState,
  { label: string; tone: 'success' | 'warning' | 'danger' }
> = {
  HEALTHY: { label: 'Healthy', tone: 'success' },
  LOW: { label: 'Low stock', tone: 'warning' },
  OUT_OF_STOCK: { label: 'Out of stock', tone: 'danger' },
};

function InventoryManagement() {
  const dispatch = useAppDispatch();
  const toast = useToast();

  const {
    items,
    adjustments,
    loading,
    historyLoading,
    saving,
    error,
    historyError,
  } = useAppSelector((state) => state.inventory);

  const skus = useAppSelector((state) => state.skus.items);
  const warehouses = useAppSelector((state) => state.warehouses.items);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [selectedSku, setSelectedSku] = useState('');
  const [selectedWarehouse, setSelectedWarehouse] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<InventoryAdjustmentInput>(emptyForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchAdjustmentHistory({}));
    dispatch(fetchSkus());
    dispatch(fetchWarehouses());
    dispatch(clearInventoryError());
    dispatch(clearHistoryError());
  }, [dispatch]);

  const activeSkus = useMemo(() => skus.filter((sku) => sku.isActive), [skus]);
  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive),
    [warehouses],
  );

  const counts = useMemo(() => {
    const result: Record<Filter, number> = {
      ALL: items.length,
      HEALTHY: 0,
      LOW: 0,
      OUT_OF_STOCK: 0,
    };
    for (const item of items) result[stockState(item)] += 1;
    return result;
  }, [items]);

  const filteredInventory = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((item) => {
      const matchesSearch =
        !term ||
        item.sku.skuCode.toLowerCase().includes(term) ||
        item.sku.name.toLowerCase().includes(term) ||
        item.warehouse.code.toLowerCase().includes(term) ||
        item.warehouse.name.toLowerCase().includes(term) ||
        item.warehouse.city.toLowerCase().includes(term);

      const matchesFilter = filter === 'ALL' || stockState(item) === filter;

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const totalOnHand = items.reduce((sum, item) => sum + item.onHandQuantity, 0);
  const totalAboveSafety = items.reduce(
    (sum, item) => sum + Math.max(0, item.onHandQuantity - item.safetyStock),
    0,
  );

  const currentRecord = items.find(
    (item) =>
      item.skuId === form.skuId && item.warehouseId === form.warehouseId,
  );
  const currentBalance = currentRecord?.onHandQuantity ?? 0;
  const projectedBalance = currentBalance + (form.quantityChange || 0);

  function openForm(prefill?: Inventory) {
    dispatch(clearInventoryError());
    setForm({
      ...emptyForm,
      skuId: prefill?.skuId ?? activeSkus[0]?.id ?? '',
      warehouseId: prefill?.warehouseId ?? activeWarehouses[0]?.id ?? '',
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setFormError('');
    dispatch(clearInventoryError());
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>,
  ) {
    const { name, value } = event.target;

    setForm((current) => ({
      ...current,
      [name]: name === 'quantityChange' ? Number(value) : value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const payload = { ...form, reason: form.reason.trim() };

    if (!payload.skuId || !payload.warehouseId) {
      setFormError('Select both a SKU and a warehouse.');
      return;
    }

    if (!Number.isInteger(payload.quantityChange) || payload.quantityChange === 0) {
      setFormError('Quantity change must be a non-zero whole number.');
      return;
    }

    if (payload.reason.length < 3 || payload.reason.length > 500) {
      setFormError('Reason must be between 3 and 500 characters.');
      return;
    }

    try {
      await dispatch(createInventoryAdjustment(payload)).unwrap();

      const sku = skus.find((item) => item.id === payload.skuId);
      const warehouse = warehouses.find((item) => item.id === payload.warehouseId);
      toast({
        title: 'Inventory adjusted',
        description: `${sku?.skuCode ?? 'SKU'} at ${warehouse?.code ?? 'warehouse'}: ${payload.quantityChange > 0 ? '+' : ''}${payload.quantityChange} units. An audit record was created.`,
      });

      closeForm();

      await Promise.all([
        dispatch(fetchInventory()),
        dispatch(fetchAdjustmentHistory({})),
      ]);
    } catch {
      // The Redux slice stores the API error.
    }
  }

  function applyHistoryFilters(skuId = selectedSku, warehouseId = selectedWarehouse) {
    dispatch(
      fetchAdjustmentHistory({
        skuId: skuId || undefined,
        warehouseId: warehouseId || undefined,
      }),
    );
  }

  function clearHistoryFilters() {
    setSelectedSku('');
    setSelectedWarehouse('');
    dispatch(fetchAdjustmentHistory({}));
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Operations"
        eyebrowIcon={<Boxes />}
        title="Inventory"
        description="On-hand balances per SKU and warehouse. Safety stock is never promised to customers."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => dispatch(fetchInventory())}
            >
              Refresh
            </Button>
            <Button
              variant="primary"
              icon={<SlidersHorizontal />}
              onClick={() => openForm()}
              disabled={activeSkus.length === 0 || activeWarehouses.length === 0}
            >
              Adjust stock
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard
          index={0}
          label="On-hand units"
          value={totalOnHand.toLocaleString()}
          icon={<Boxes />}
          tone="accent"
          hint={`${items.length} SKU-locations tracked`}
        />
        <StatCard
          index={1}
          label="Promisable units"
          value={totalAboveSafety.toLocaleString()}
          icon={<MapPin />}
          tone="info"
          hint="On-hand above safety stock"
        />
        <StatCard
          index={2}
          label="Low stock"
          value={counts.LOW}
          icon={<ShieldAlert />}
          tone={counts.LOW > 0 ? 'warning' : 'success'}
          hint="At or below safety stock"
          onClick={() => setFilter(filter === 'LOW' ? 'ALL' : 'LOW')}
          active={filter === 'LOW'}
        />
        <StatCard
          index={3}
          label="Out of stock"
          value={counts.OUT_OF_STOCK}
          icon={<PackageX />}
          tone={counts.OUT_OF_STOCK > 0 ? 'danger' : 'success'}
          onClick={() =>
            setFilter(filter === 'OUT_OF_STOCK' ? 'ALL' : 'OUT_OF_STOCK')
          }
          active={filter === 'OUT_OF_STOCK'}
        />
      </div>

      {error && !showForm && (
        <Alert
          tone="danger"
          title="Could not load inventory"
          action={
            <Button size="sm" onClick={() => dispatch(fetchInventory())}>
              Retry
            </Button>
          }
        >
          {error}
        </Alert>
      )}

      <Card>
        <CardHeader
          title="Stock balances"
          description="The bar shows on-hand stock; the marker is the safety-stock level."
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search SKU or warehouse..."
          />
          <SegmentedControl
            label="Filter by stock level"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All', count: counts.ALL },
              { value: 'HEALTHY', label: 'Healthy', count: counts.HEALTHY },
              { value: 'LOW', label: 'Low', count: counts.LOW },
              { value: 'OUT_OF_STOCK', label: 'Out', count: counts.OUT_OF_STOCK },
            ]}
          />
        </div>

        {loading && items.length === 0 ? (
          <TableSkeleton rows={8} columns={6} />
        ) : filteredInventory.length === 0 ? (
          <EmptyState
            icon={<Boxes />}
            title={items.length === 0 ? 'No inventory records' : 'No records match'}
            description={
              items.length === 0
                ? 'Adjust stock to create the first balance.'
                : 'Try a different search or stock level.'
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th style={{ width: '22%' }}>Stock level</th>
                  <th className="num">On hand</th>
                  <th className="num">Safety stock</th>
                  <th className="num">Promisable</th>
                  <th>Status</th>
                  <th className="actions-cell">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredInventory.map((item) => {
                  const state = stockState(item);
                  const scale = Math.max(item.onHandQuantity, item.safetyStock * 2, 1);

                  return (
                    <tr key={`${item.skuId}-${item.warehouseId}`}>
                      <td>
                        <span className="cell-primary cell-code">{item.sku.skuCode}</span>
                        <span className="cell-secondary">{item.sku.name}</span>
                      </td>
                      <td>
                        <span className="cell-primary">{item.warehouse.code}</span>
                        <span className="cell-secondary">
                          {item.warehouse.name}, {item.warehouse.city}
                        </span>
                      </td>
                      <td>
                        <Meter
                          value={item.onHandQuantity}
                          max={scale}
                          marker={item.safetyStock > 0 ? item.safetyStock : undefined}
                          tone={
                            state === 'HEALTHY'
                              ? 'success'
                              : state === 'LOW'
                                ? 'warning'
                                : 'danger'
                          }
                          label={`${item.sku.skuCode} at ${item.warehouse.code} stock level`}
                        />
                      </td>
                      <td className="num">
                        <strong>{item.onHandQuantity.toLocaleString()}</strong>
                      </td>
                      <td className="num cell-muted">
                        {item.safetyStock.toLocaleString()}
                      </td>
                      <td className="num">
                        {Math.max(0, item.onHandQuantity - item.safetyStock).toLocaleString()}
                      </td>
                      <td>
                        <Badge tone={STOCK_META[state].tone} dot>
                          {STOCK_META[state].label}
                        </Badge>
                      </td>
                      <td className="actions-cell">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<SlidersHorizontal />}
                          onClick={() => openForm(item)}
                          disabled={!item.sku.isActive || !item.warehouse.isActive}
                        >
                          Adjust
                        </Button>
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
            Showing {filteredInventory.length} of {items.length} balances
          </span>
          <span>Promisable = on hand minus safety stock</span>
        </div>
      </Card>

      <Card>
        <CardHeader
          title="Adjustment history"
          description="Every stock movement with its reason: manual adjustments, receipts and shipments."
          icon={<History />}
        />
        <div className="toolbar" style={{ marginTop: 12 }}>
          <select
            className="select select-sm"
            style={{ width: 'auto' }}
            value={selectedSku}
            onChange={(event) => {
              setSelectedSku(event.target.value);
              applyHistoryFilters(event.target.value, selectedWarehouse);
            }}
            aria-label="Filter history by SKU"
          >
            <option value="">All SKUs</option>
            {skus.map((sku) => (
              <option key={sku.id} value={sku.id}>
                {sku.skuCode}
              </option>
            ))}
          </select>
          <select
            className="select select-sm"
            style={{ width: 'auto' }}
            value={selectedWarehouse}
            onChange={(event) => {
              setSelectedWarehouse(event.target.value);
              applyHistoryFilters(selectedSku, event.target.value);
            }}
            aria-label="Filter history by warehouse"
          >
            <option value="">All warehouses</option>
            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code}
              </option>
            ))}
          </select>
          {(selectedSku || selectedWarehouse) && (
            <Button variant="ghost" size="sm" onClick={clearHistoryFilters}>
              Clear
            </Button>
          )}
          <div className="toolbar-spacer" />
          <span className="toolbar-meta">{adjustments.length} records</span>
        </div>

        {historyError && (
          <div style={{ padding: '12px 16px 0' }}>
            <Alert
              tone="danger"
              action={
                <Button size="sm" onClick={() => applyHistoryFilters()}>
                  Retry
                </Button>
              }
            >
              {historyError}
            </Alert>
          </div>
        )}

        {historyLoading && adjustments.length === 0 ? (
          <TableSkeleton rows={5} columns={5} />
        ) : adjustments.length === 0 ? (
          <EmptyState
            compact
            icon={<History />}
            title="No adjustments recorded"
            description="Stock movements will appear here."
          />
        ) : (
          <div className="table-wrap" style={{ maxHeight: 440 }}>
            <table className="table">
              <thead>
                <tr>
                  <th>When</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th className="num">Change</th>
                  <th>Reason</th>
                </tr>
              </thead>
              <tbody>
                {adjustments.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td className="cell-muted tabular" style={{ whiteSpace: 'nowrap' }}>
                      {formatDateTime(adjustment.createdAt)}
                    </td>
                    <td>
                      <span className="cell-primary cell-code">{adjustment.sku.skuCode}</span>
                      <span className="cell-secondary">{adjustment.sku.name}</span>
                    </td>
                    <td>{adjustment.warehouse.code}</td>
                    <td className="num">
                      <span
                        className={`delta ${adjustment.quantityChange > 0 ? 'is-positive' : 'is-negative'}`}
                      >
                        {adjustment.quantityChange > 0 ? <ArrowUpRight /> : <ArrowDownRight />}
                        {adjustment.quantityChange > 0 ? '+' : ''}
                        {adjustment.quantityChange}
                      </span>
                    </td>
                    <td className="text-secondary">{adjustment.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        title="Adjust stock"
        description="Record a manual increase or decrease. Every adjustment is kept in the history with its reason."
        footer={
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" type="submit" form="adjust-form" loading={saving}>
              Apply adjustment
            </Button>
          </>
        }
      >
        <form id="adjust-form" className="form-grid" onSubmit={handleSubmit}>
          {(formError || error) && (
            <Alert tone="danger" className="span-2">
              {formError || error}
            </Alert>
          )}

          <Field label="SKU" required>
            <select
              className="select"
              name="skuId"
              value={form.skuId}
              onChange={handleChange}
              required
            >
              <option value="">Select SKU</option>
              {activeSkus.map((sku) => (
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
              value={form.warehouseId}
              onChange={handleChange}
              required
            >
              <option value="">Select warehouse</option>
              {activeWarehouses.map((warehouse) => (
                <option key={warehouse.id} value={warehouse.id}>
                  {warehouse.code} — {warehouse.name}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="Quantity change"
            required
            hint="Positive adds stock, negative deducts it."
          >
            <input
              className="input"
              type="number"
              name="quantityChange"
              value={form.quantityChange}
              onChange={handleChange}
              step="1"
              required
            />
          </Field>

          <div className="balance-preview" aria-live="polite">
            <span className="text-muted">Resulting balance</span>
            <div>
              <span className="tabular">{currentBalance.toLocaleString()}</span>
              <ArrowUpRight
                className={form.quantityChange < 0 ? 'is-down' : undefined}
                aria-hidden="true"
              />
              <strong
                className={projectedBalance < 0 ? 'text-danger tabular' : 'tabular'}
              >
                {projectedBalance.toLocaleString()}
              </strong>
            </div>
            {projectedBalance < 0 && (
              <span className="inline-error">On hand cannot go below zero.</span>
            )}
          </div>

          <Field
            label="Reason"
            required
            hint={`${form.reason.length}/500 characters, minimum 3.`}
            className="span-2"
          >
            <textarea
              className="textarea"
              name="reason"
              value={form.reason}
              onChange={handleChange}
              placeholder="e.g. Correction after physical stock count"
              minLength={3}
              maxLength={500}
              required
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

export default InventoryManagement;
