import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';

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

type Filter = 'ALL' | 'LOW' | 'OUT_OF_STOCK';

const emptyForm: InventoryAdjustmentInput = {
  skuId: '',
  warehouseId: '',
  quantityChange: 0,
  reason: '',
};

function InventoryManagement() {
  const dispatch = useAppDispatch();

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
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    dispatch(fetchInventory());
    dispatch(fetchAdjustmentHistory({}));
    dispatch(fetchSkus());
    dispatch(fetchWarehouses());

    dispatch(clearInventoryError());
    dispatch(clearHistoryError());
  }, [dispatch]);

  const activeSkus = useMemo(
    () => skus.filter((sku) => sku.isActive),
    [skus],
  );

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive),
    [warehouses],
  );

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

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'LOW' &&
          item.onHandQuantity > 0 &&
          item.onHandQuantity <= item.safetyStock) ||
        (filter === 'OUT_OF_STOCK' && item.onHandQuantity === 0);

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const totalOnHand = items.reduce(
    (sum, item) => sum + item.onHandQuantity,
    0,
  );

  const totalReserved = items.reduce(
    (sum, item) => sum + item.reservedQuantity,
    0,
  );

  const lowStockCount = items.filter(
    (item) =>
      item.onHandQuantity > 0 &&
      item.onHandQuantity <= item.safetyStock,
  ).length;

  const outOfStockCount = items.filter(
    (item) => item.onHandQuantity === 0,
  ).length;

  function openForm() {
    dispatch(clearInventoryError());

    setForm({
      ...emptyForm,
      skuId: activeSkus[0]?.id ?? '',
      warehouseId: activeWarehouses[0]?.id ?? '',
    });

    setFormError('');
    setSuccessMessage('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setForm(emptyForm);
    setFormError('');
    dispatch(clearInventoryError());
  }

  function handleChange(
    event: ChangeEvent<
      HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement
    >,
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
    setSuccessMessage('');

    const payload = {
      ...form,
      reason: form.reason.trim(),
    };

    if (!payload.skuId || !payload.warehouseId) {
      setFormError('Select both a SKU and a warehouse.');
      return;
    }

    if (
      !Number.isInteger(payload.quantityChange) ||
      payload.quantityChange === 0
    ) {
      setFormError('Quantity change must be a non-zero whole number.');
      return;
    }

    if (payload.reason.length < 3 || payload.reason.length > 500) {
      setFormError('Reason must be between 3 and 500 characters.');
      return;
    }

    try {
      await dispatch(createInventoryAdjustment(payload)).unwrap();

      setSuccessMessage('Inventory adjusted and audit record created.');
      setForm(emptyForm);
      setShowForm(false);

      await Promise.all([
        dispatch(fetchInventory()),
        dispatch(fetchAdjustmentHistory({})),
      ]);
    } catch {
      // The Redux slice stores the API error.
    }
  }

  function applyHistoryFilters() {
    dispatch(
      fetchAdjustmentHistory({
        skuId: selectedSku || undefined,
        warehouseId: selectedWarehouse || undefined,
      }),
    );
  }

  function clearHistoryFilters() {
    setSelectedSku('');
    setSelectedWarehouse('');
    dispatch(fetchAdjustmentHistory({}));
  }

  return (
    <main className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">STOCK CONTROL</p>
          <h1>Inventory Management</h1>
          <p className="page-subtitle">
            Monitor stock balances and maintain an auditable adjustment
            history.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openForm}
          disabled={activeSkus.length === 0 || activeWarehouses.length === 0}
        >
          + Adjust Inventory
        </button>
      </header>

      <section className="sku-stat-grid inventory-stat-grid">
        <article className="stat-card">
          <span>Total On-hand Units</span>
          <strong>{totalOnHand.toLocaleString()}</strong>
        </article>

        <article className="stat-card">
          <span>Reserved Units</span>
          <strong>{totalReserved.toLocaleString()}</strong>
        </article>

        <article className="stat-card">
          <span>Low-stock Records</span>
          <strong>{lowStockCount}</strong>
        </article>

        <article className="stat-card">
          <span>Out-of-stock Records</span>
          <strong>{outOfStockCount}</strong>
        </article>
      </section>

      {successMessage && (
        <p className="success-banner">{successMessage}</p>
      )}

      {showForm && (
        <section className="sku-form-panel">
          <div className="section-heading">
            <div>
              <h2>Manual Stock Adjustment</h2>
              <p>
                Every adjustment is recorded in the inventory audit history.
              </p>
            </div>

            <button className="text-button" onClick={closeForm}>
              Cancel
            </button>
          </div>

          <form
            className="sku-form inventory-adjustment-form"
            onSubmit={handleSubmit}
          >
            <label>
              SKU *
              <select
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
            </label>

            <label>
              Warehouse *
              <select
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
            </label>

            <label>
              Quantity Change *
              <input
                type="number"
                name="quantityChange"
                value={form.quantityChange}
                onChange={handleChange}
                placeholder="Positive to add, negative to deduct"
                step="1"
                required
              />

              <span className="field-hint">
                Use a positive number to add stock and a negative number to
                deduct stock.
              </span>
            </label>

            <label className="full-width">
              Adjustment Reason *
              <textarea
                name="reason"
                value={form.reason}
                onChange={handleChange}
                placeholder="e.g. Correction after physical stock count"
                minLength={3}
                maxLength={500}
                required
              />

              <span className="field-hint">
                {form.reason.length}/500 characters. Minimum 3 characters.
              </span>
            </label>

            {(formError || error) && (
              <p className="form-error">{formError || error}</p>
            )}

            <div className="form-actions full-width">
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
              >
                Cancel
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={saving}
              >
                {saving ? 'Applying...' : 'Apply Adjustment'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="sku-table-panel">
        <div className="section-heading">
          <div>
            <h2>Inventory Balances</h2>
            <p>{filteredInventory.length} stock records</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => dispatch(fetchInventory())}
            disabled={loading}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>

        <div className="sku-toolbar">
          <input
            className="sku-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search SKU or warehouse..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
          >
            <option value="ALL">All Stock</option>
            <option value="LOW">Low Stock</option>
            <option value="OUT_OF_STOCK">Out of Stock</option>
          </select>
        </div>

        {error && !showForm && (
          <div className="error-state">
            <p>{error}</p>

            <button
              className="secondary-button"
              onClick={() => dispatch(fetchInventory())}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading inventory...</div>
        ) : filteredInventory.length === 0 ? (
          <div className="empty-state">
            {search || filter !== 'ALL'
              ? 'No inventory records match your search or filter.'
              : 'No inventory records found.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="sku-table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th>On Hand</th>
                  <th>Reserved</th>
                  <th>Safety Stock</th>
                  <th>Available*</th>
                  <th>Stock Status</th>
                </tr>
              </thead>

              <tbody>
                {filteredInventory.map((item) => {
                  const available = Math.max(
                    0,
                    item.onHandQuantity - item.reservedQuantity,
                  );

                  const low =
                    item.onHandQuantity > 0 &&
                    item.onHandQuantity <= item.safetyStock;

                  return (
                    <tr key={`${item.skuId}-${item.warehouseId}`}>
                      <td>
                        <strong className="sku-code">
                          {item.sku.skuCode}
                        </strong>

                        <span className="inventory-secondary">
                          {item.sku.name}
                        </span>
                      </td>

                      <td>
                        <strong>{item.warehouse.code}</strong>

                        <span className="inventory-secondary">
                          {item.warehouse.name}, {item.warehouse.city}
                        </span>
                      </td>

                      <td>{item.onHandQuantity.toLocaleString()}</td>
                      <td>{item.reservedQuantity.toLocaleString()}</td>
                      <td>{item.safetyStock.toLocaleString()}</td>
                      <td>{available.toLocaleString()}</td>

                      <td>
                        <span
                          className={`sku-status ${
                            item.onHandQuantity === 0
                              ? 'inactive'
                              : low
                                ? 'warning'
                                : 'active'
                          }`}
                        >
                          {item.onHandQuantity === 0
                            ? 'Out of stock'
                            : low
                              ? 'Low stock'
                              : 'Healthy'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="inventory-footnote">
          *Available here means on-hand minus reserved. It is not the full
          time-phased ATP calculation.
        </p>
      </section>

      <section className="sku-table-panel">
        <div className="section-heading">
          <div>
            <h2>Adjustment Audit History</h2>
            <p>Recorded stock changes and their reasons.</p>
          </div>
        </div>

        <div className="sku-toolbar history-filters">
          <select
            value={selectedSku}
            onChange={(event) => setSelectedSku(event.target.value)}
          >
            <option value="">All SKUs</option>

            {skus.map((sku) => (
              <option key={sku.id} value={sku.id}>
                {sku.skuCode}
              </option>
            ))}
          </select>

          <select
            value={selectedWarehouse}
            onChange={(event) => setSelectedWarehouse(event.target.value)}
          >
            <option value="">All Warehouses</option>

            {warehouses.map((warehouse) => (
              <option key={warehouse.id} value={warehouse.id}>
                {warehouse.code}
              </option>
            ))}
          </select>

          <button
            className="secondary-button"
            onClick={applyHistoryFilters}
            disabled={historyLoading}
          >
            Apply Filters
          </button>

          <button
            className="text-button"
            onClick={clearHistoryFilters}
          >
            Clear
          </button>
        </div>

        {historyError && (
          <div className="error-state">
            <p>{historyError}</p>

            <button
              className="secondary-button"
              onClick={applyHistoryFilters}
            >
              Retry
            </button>
          </div>
        )}

        {historyLoading ? (
          <div className="empty-state">
            Loading adjustment history...
          </div>
        ) : adjustments.length === 0 ? (
          <div className="empty-state">
            No adjustment records found.
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="sku-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th>Quantity Change</th>
                  <th>Reason</th>
                </tr>
              </thead>

              <tbody>
                {adjustments.map((adjustment) => (
                  <tr key={adjustment.id}>
                    <td>
                      {new Date(adjustment.createdAt).toLocaleString()}
                    </td>

                    <td>
                      <strong>{adjustment.sku.skuCode}</strong>

                      <span className="inventory-secondary">
                        {adjustment.sku.name}
                      </span>
                    </td>

                    <td>{adjustment.warehouse.code}</td>

                    <td>
                      <strong
                        className={
                          adjustment.quantityChange > 0
                            ? 'quantity-positive'
                            : 'quantity-negative'
                        }
                      >
                        {adjustment.quantityChange > 0 ? '+' : ''}
                        {adjustment.quantityChange}
                      </strong>
                    </td>

                    <td>{adjustment.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </main>
  );
}

export default InventoryManagement;
