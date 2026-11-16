import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';

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

import type { InboundReceipt, ReceiptStatus } from '../types';

type StatusFilter = 'ALL' | ReceiptStatus;

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

function formatDate(value: string): string {
  return new Date(value).toLocaleString();
}

function SupplyManagement() {
  const dispatch = useAppDispatch();

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
  const [successMessage, setSuccessMessage] = useState('');
  const [expeditingReceipt, setExpeditingReceipt] =
    useState<InboundReceipt | null>(null);

  useEffect(() => {
    dispatch(fetchReceipts());
    dispatch(fetchSkus());
    dispatch(fetchWarehouses());
    dispatch(clearSupplyError());
  }, [dispatch]);

  const activeSkus = useMemo(
    () => skus.filter((sku) => sku.isActive),
    [skus],
  );

  const activeWarehouses = useMemo(
    () => warehouses.filter((warehouse) => warehouse.isActive),
    [warehouses],
  );

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

  const plannedCount = items.filter(
    (receipt) => receipt.status === 'PLANNED',
  ).length;

  const inTransitCount = items.filter(
    (receipt) => receipt.status === 'IN_TRANSIT',
  ).length;

  const receivedCount = items.filter(
    (receipt) => receipt.status === 'RECEIVED',
  ).length;

  const outstandingUnits = items
    .filter(
      (receipt) =>
        receipt.status === 'PLANNED' ||
        receipt.status === 'IN_TRANSIT',
    )
    .reduce((sum, receipt) => sum + receipt.quantity, 0);

  function openCreateForm() {
    dispatch(clearSupplyError());
    setEditingReceipt(null);
    setForm({
      ...emptyForm,
      skuId: activeSkus[0]?.id ?? '',
      warehouseId: activeWarehouses[0]?.id ?? '',
    });
    setFormError('');
    setSuccessMessage('');
    setExpeditingReceipt(null);
    setShowForm(true);
  }

  function openEditForm(receipt: InboundReceipt) {
    dispatch(clearSupplyError());
    setEditingReceipt(receipt);
    setForm({
      receiptId: receipt.receiptId,
      skuId: receipt.skuId,
      warehouseId: receipt.warehouseId,
      expectedArrivalTime: toLocalDateTime(
        receipt.expectedArrivalTime,
      ),
      quantity: receipt.quantity,
    });
    setFormError('');
    setSuccessMessage('');
    setExpeditingReceipt(null);
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingReceipt(null);
    setForm(emptyForm);
    setFormError('');
    dispatch(clearSupplyError());
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
    setSuccessMessage('');

    if (!form.skuId || !form.warehouseId) {
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

    const expectedArrivalTime = new Date(
      form.expectedArrivalTime,
    ).toISOString();

    try {
      if (editingReceipt) {
        const payload: UpdateReceiptInput = {
          quantity: form.quantity,
          expectedArrivalTime,
        };

        await dispatch(
          updateReceipt({
            id: editingReceipt.id,
            data: payload,
          }),
        ).unwrap();

        setSuccessMessage('Inbound receipt updated successfully.');
      } else {
        if (form.receiptId.trim().length < 3) {
          setFormError('Receipt ID must contain at least 3 characters.');
          return;
        }

        const payload: CreateReceiptInput = {
          receiptId: form.receiptId.trim(),
          skuId: form.skuId,
          warehouseId: form.warehouseId,
          expectedArrivalTime,
          quantity: form.quantity,
        };

        await dispatch(createReceipt(payload)).unwrap();
        setSuccessMessage('Inbound receipt created successfully.');
      }

      closeForm();
      setSuccessMessage(
        editingReceipt
          ? 'Inbound receipt updated successfully.'
          : 'Inbound receipt created successfully.',
      );
    } catch {
      // Redux stores the API error.
    }
  }

  async function handleStatusChange(
    receipt: InboundReceipt,
    status: 'IN_TRANSIT' | 'CANCELED',
  ) {
    const message =
      status === 'CANCELED'
        ? `Cancel receipt ${receipt.receiptId}? This cannot be undone.`
        : `Mark receipt ${receipt.receiptId} as in transit?`;

    if (!window.confirm(message)) return;

    setSuccessMessage('');

    try {
      await dispatch(
        updateReceiptStatus({ id: receipt.id, status }),
      ).unwrap();

      setSuccessMessage(
        status === 'CANCELED'
          ? `${receipt.receiptId} was canceled.`
          : `${receipt.receiptId} is now in transit.`,
      );
    } catch {
      // Redux stores the API error.
    }
  }

  async function handleReceive(receipt: InboundReceipt) {
    if (
      !window.confirm(
        `Receive ${receipt.quantity} units for ${receipt.receiptId}? Inventory will be increased.`,
      )
    ) {
      return;
    }

    setSuccessMessage('');

    try {
      await dispatch(receiveReceipt(receipt.id)).unwrap();

      await dispatch(fetchInventory()).unwrap();

      setSuccessMessage(
        `${receipt.receiptId} received. Inventory balances have been refreshed.`,
      );
    } catch {
      // Redux stores the API error.
    }
  }

  function statusClass(status: ReceiptStatus): string {
    return `receipt-status receipt-${status.toLowerCase()}`;
  }

  return (
    <main className="page-container supply-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">INBOUND OPERATIONS</p>
          <h1>Supply Management</h1>
          <p className="page-subtitle">
            Track inbound receipts, expected arrivals and stock receiving.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openCreateForm}
          disabled={
            activeSkus.length === 0 || activeWarehouses.length === 0
          }
        >
          + Create Receipt
        </button>
      </header>

      <section className="sku-stat-grid supply-stat-grid">
        <article className="stat-card">
          <span>Planned Receipts</span>
          <strong>{plannedCount}</strong>
        </article>

        <article className="stat-card">
          <span>In Transit</span>
          <strong>{inTransitCount}</strong>
        </article>

        <article className="stat-card">
          <span>Received</span>
          <strong>{receivedCount}</strong>
        </article>

        <article className="stat-card">
          <span>Outstanding Units</span>
          <strong>{outstandingUnits.toLocaleString()}</strong>
        </article>
      </section>

      {successMessage && (
        <p className="success-banner">{successMessage}</p>
      )}

      {expeditingReceipt && (
        <ExpediteReceiptPanel
          key={expeditingReceipt.id}
          receipt={expeditingReceipt}
          onClose={() => setExpeditingReceipt(null)}
          onCompleted={async (message) => {
            setExpeditingReceipt(null);
            setSuccessMessage(message);
            await dispatch(fetchReceipts());
          }}
        />
      )}

      {showForm && (
        <section className="sku-form-panel">
          <div className="section-heading">
            <div>
              <h2>
                {editingReceipt ? 'Edit Inbound Receipt' : 'Create Inbound Receipt'}
              </h2>
              <p>
                {editingReceipt
                  ? 'Update the expected arrival time or quantity.'
                  : 'Register a new expected supply delivery.'}
              </p>
            </div>

            <button className="text-button" onClick={closeForm}>
              Cancel
            </button>
          </div>

          <form className="sku-form" onSubmit={handleSubmit}>
            {!editingReceipt && (
              <label>
                Receipt ID *
                <input
                  name="receiptId"
                  value={form.receiptId}
                  onChange={handleChange}
                  placeholder="e.g. PO-RECEIPT-004"
                  minLength={3}
                  maxLength={100}
                  required
                />
              </label>
            )}

            <label>
              SKU *
              <select
                name="skuId"
                value={form.skuId}
                onChange={handleChange}
                disabled={Boolean(editingReceipt)}
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
                disabled={Boolean(editingReceipt)}
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
              Quantity *
              <input
                type="number"
                name="quantity"
                value={form.quantity}
                onChange={handleChange}
                min="1"
                step="1"
                required
              />
            </label>

            <label>
              Expected Arrival *
              <input
                type="datetime-local"
                name="expectedArrivalTime"
                value={form.expectedArrivalTime}
                onChange={handleChange}
                required
              />
            </label>

            {(formError || (error && showForm)) && (
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
                {saving
                  ? 'Saving...'
                  : editingReceipt
                    ? 'Save Changes'
                    : 'Create Receipt'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="sku-table-panel">
        <div className="section-heading">
          <div>
            <h2>Inbound Receipts</h2>
            <p>{filteredReceipts.length} receipts</p>
          </div>

          <button
            className="secondary-button"
            onClick={() => dispatch(fetchReceipts())}
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
            placeholder="Search receipt, SKU or warehouse..."
          />

          <select
            value={statusFilter}
            onChange={(event) =>
              setStatusFilter(event.target.value as StatusFilter)
            }
          >
            <option value="ALL">All Statuses</option>
            <option value="PLANNED">Planned</option>
            <option value="IN_TRANSIT">In Transit</option>
            <option value="RECEIVED">Received</option>
            <option value="CANCELED">Canceled</option>
          </select>
        </div>

        {error && !showForm && (
          <div className="error-state">
            <p>{error}</p>
            <button
              className="secondary-button"
              onClick={() => dispatch(fetchReceipts())}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading inbound receipts...</div>
        ) : filteredReceipts.length === 0 ? (
          <div className="empty-state">
            {search || statusFilter !== 'ALL'
              ? 'No receipts match your search or filter.'
              : 'No inbound receipts found.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="sku-table supply-table">
              <thead>
                <tr>
                  <th>Receipt</th>
                  <th>SKU</th>
                  <th>Warehouse</th>
                  <th>Quantity</th>
                  <th>Expected Arrival</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredReceipts.map((receipt) => (
                  <tr key={receipt.id}>
                    <td>
                      <strong className="sku-code">
                        {receipt.receiptId}
                      </strong>
                      <span className="inventory-secondary">
                        Created {new Date(receipt.createdAt).toLocaleDateString()}
                      </span>
                    </td>

                    <td>
                      <strong>{receipt.sku.skuCode}</strong>
                      <span className="inventory-secondary">
                        {receipt.sku.name}
                      </span>
                    </td>

                    <td>
                      <strong>{receipt.warehouse.code}</strong>
                      <span className="inventory-secondary">
                        {receipt.warehouse.name}
                      </span>
                    </td>

                    <td>{receipt.quantity.toLocaleString()}</td>

                    <td>{formatDate(receipt.expectedArrivalTime)}</td>

                    <td>
                      <span className={statusClass(receipt.status)}>
                        {receipt.status.replace('_', ' ')}
                      </span>
                      {receipt.receivedAt && (
                        <span className="inventory-secondary">
                          Received {formatDate(receipt.receivedAt)}
                        </span>
                      )}
                    </td>

                    <td>
                      <div className="supply-actions">
                        {(receipt.status === 'PLANNED' ||
                          receipt.status === 'IN_TRANSIT') && (
                          <>
                            {receipt.status === 'PLANNED' && (
                              <button
                                className="table-action"
                                disabled={saving}
                                onClick={() => openEditForm(receipt)}
                              >
                                Edit
                              </button>
                            )}

                            {receipt.status === 'PLANNED' && (
                              <button
                                className="table-action"
                                disabled={saving}
                                onClick={() =>
                                  handleStatusChange(receipt, 'IN_TRANSIT')
                                }
                              >
                                Dispatch
                              </button>
                            )}

                            <button
                              className="table-action"
                              disabled={saving}
                              onClick={() => {
                                setShowForm(false);
                                setSuccessMessage('');
                                setExpeditingReceipt(receipt);
                              }}
                            >
                              Expedite
                            </button>

                            <button
                              className="table-action supply-receive-action"
                              disabled={saving}
                              onClick={() => handleReceive(receipt)}
                            >
                              Receive
                            </button>

                            <button
                              className="table-action supply-cancel-action"
                              disabled={saving}
                              onClick={() =>
                                handleStatusChange(receipt, 'CANCELED')
                              }
                            >
                              Cancel
                            </button>
                          </>
                        )}

                        {receipt.status === 'RECEIVED' && (
                          <span className="muted-text">Completed</span>
                        )}

                        {receipt.status === 'CANCELED' && (
                          <span className="muted-text">Canceled</span>
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
    </main>
  );
}

export default SupplyManagement;
