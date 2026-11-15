import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  clearWarehouseError,
  createWarehouse,
  deactivateWarehouse,
  fetchWarehouses,
  reactivateWarehouse,
  updateWarehouse,
} from '../features/warehouses/warehouseSlice';
import type { WarehouseInput } from '../features/warehouses/warehouseSlice';

type Filter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const emptyForm: WarehouseInput = {
  code: '',
  name: '',
  city: '',
};

function WarehouseManagement() {
  const dispatch = useAppDispatch();
  const { items, loading, saving, error } = useAppSelector(
    (state) => state.warehouses,
  );

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseInput>(emptyForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchWarehouses());
  }, [dispatch]);

  const filteredWarehouses = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((warehouse) => {
      const matchesSearch =
        !term ||
        warehouse.code.toLowerCase().includes(term) ||
        warehouse.name.toLowerCase().includes(term) ||
        warehouse.city.toLowerCase().includes(term);

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'ACTIVE' && warehouse.isActive) ||
        (filter === 'INACTIVE' && !warehouse.isActive);

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.length - activeCount;

  function openCreateForm() {
    dispatch(clearWarehouseError());
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(warehouseId: string) {
    const warehouse = items.find((item) => item.id === warehouseId);
    if (!warehouse) return;

    dispatch(clearWarehouseError());
    setEditingId(warehouse.id);
    setForm({
      code: warehouse.code,
      name: warehouse.name,
      city: warehouse.city,
    });
    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    dispatch(clearWarehouseError());
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement>,
  ) {
    const { name, value } = event.target;
    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const payload = {
      code: form.code.trim(),
      name: form.name.trim(),
      city: form.city.trim(),
    };

    if (payload.code.length < 2 || payload.code.length > 30) {
      setFormError('Warehouse code must be between 2 and 30 characters.');
      return;
    }

    if (payload.name.length < 2 || payload.name.length > 120) {
      setFormError('Warehouse name must be between 2 and 120 characters.');
      return;
    }

    if (payload.city.length < 2 || payload.city.length > 100) {
      setFormError('City must be between 2 and 100 characters.');
      return;
    }

    try {
      if (editingId) {
        await dispatch(
          updateWarehouse({ id: editingId, data: payload }),
        ).unwrap();
      } else {
        await dispatch(createWarehouse(payload)).unwrap();
      }

      closeForm();
    } catch {
      // The Redux slice stores the API error.
    }
  }

  async function handleDeactivate(id: string, name: string) {
    if (!window.confirm(`Deactivate warehouse "${name}"?`)) return;

    await dispatch(deactivateWarehouse(id));
  }

  async function handleReactivate(id: string) {
    await dispatch(reactivateWarehouse(id));
  }

  return (
    <main className="page-container">
      <header className="page-header">
        <div>
          <p className="eyebrow">NETWORK CONFIGURATION</p>
          <h1>Warehouse Management</h1>
          <p className="page-subtitle">
            Manage fulfillment locations across your supply chain network.
          </p>
        </div>

        <button className="primary-button" onClick={openCreateForm}>
          + Add Warehouse
        </button>
      </header>

      <section className="sku-stat-grid">
        <article className="stat-card">
          <span>Total Warehouses</span>
          <strong>{items.length}</strong>
        </article>
        <article className="stat-card">
          <span>Active</span>
          <strong>{activeCount}</strong>
        </article>
        <article className="stat-card">
          <span>Inactive</span>
          <strong>{inactiveCount}</strong>
        </article>
      </section>

      {showForm && (
        <section className="sku-form-panel">
          <div className="section-heading">
            <div>
              <h2>{editingId ? 'Edit Warehouse' : 'Create Warehouse'}</h2>
              <p>Enter the warehouse details below.</p>
            </div>
            <button className="text-button" onClick={closeForm}>
              Cancel
            </button>
          </div>

          <form className="sku-form" onSubmit={handleSubmit}>
            <label>
              Warehouse Code *
              <input
                name="code"
                value={form.code}
                onChange={handleChange}
                placeholder="e.g. WH-HYD-001"
                maxLength={30}
                required
              />
            </label>

            <label>
              Warehouse Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                placeholder="e.g. Hyderabad Distribution Center"
                maxLength={120}
                required
              />
            </label>

            <label>
              City *
              <input
                name="city"
                value={form.city}
                onChange={handleChange}
                placeholder="e.g. Hyderabad"
                maxLength={100}
                required
              />
            </label>

            {(formError || error) && (
              <p className="form-error">{formError || error}</p>
            )}

            <div className="form-actions">
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
                  : editingId
                    ? 'Save Changes'
                    : 'Create Warehouse'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="sku-table-panel">
        <div className="section-heading">
          <div>
            <h2>Warehouse Directory</h2>
            <p>{filteredWarehouses.length} locations found</p>
          </div>
        </div>

        <div className="sku-toolbar">
          <input
            className="sku-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search code, name or city..."
          />

          <select
            value={filter}
            onChange={(event) => setFilter(event.target.value as Filter)}
          >
            <option value="ALL">All Warehouses</option>
            <option value="ACTIVE">Active Only</option>
            <option value="INACTIVE">Inactive Only</option>
          </select>
        </div>

        {error && !showForm && (
          <div className="error-state">
            <p>{error}</p>
            <button
              className="secondary-button"
              onClick={() => dispatch(fetchWarehouses())}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <div className="empty-state">Loading warehouses...</div>
        ) : filteredWarehouses.length === 0 ? (
          <div className="empty-state">
            {search || filter !== 'ALL'
              ? 'No warehouses match your search or filter.'
              : 'No warehouses found. Create your first warehouse.'}
          </div>
        ) : (
          <div className="table-wrapper">
            <table className="sku-table">
              <thead>
                <tr>
                  <th>Warehouse Code</th>
                  <th>Warehouse Name</th>
                  <th>City</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredWarehouses.map((warehouse) => (
                  <tr key={warehouse.id}>
                    <td className="sku-code">{warehouse.code}</td>
                    <td>{warehouse.name}</td>
                    <td>{warehouse.city}</td>
                    <td>
                      <span
                        className={
                          warehouse.isActive
                            ? 'sku-status active'
                            : 'sku-status inactive'
                        }
                      >
                        {warehouse.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td>
                      <div className="sku-actions">
                        {warehouse.isActive ? (
                          <>
                            <button
                              className="text-button"
                              onClick={() => openEditForm(warehouse.id)}
                            >
                              Edit
                            </button>
                            <button
                              className="text-button danger-text"
                              disabled={saving}
                              onClick={() =>
                                handleDeactivate(
                                  warehouse.id,
                                  warehouse.name,
                                )
                              }
                            >
                              Deactivate
                            </button>
                          </>
                        ) : (
                          <button
                            className="text-button success-text"
                            disabled={saving}
                            onClick={() => handleReactivate(warehouse.id)}
                          >
                            Reactivate
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
    </main>
  );
}

export default WarehouseManagement;
