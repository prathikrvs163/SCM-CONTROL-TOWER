import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';

import { useAppDispatch, useAppSelector } from '../app/hooks';

import {
  clearSkuError,
  createSku,
  deactivateSku,
  fetchSkus,
  reactivateSku,
  updateSku,
} from '../features/skus/skuSlice';

import type { SkuInput } from '../features/skus/skuSlice';
import type { Sku } from '../types';

type Filter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const emptyForm: SkuInput = {
  skuCode: '',
  name: '',
  description: '',
  unit: 'EA',
};

function SkuManagement() {
  const dispatch = useAppDispatch();

  const { items, loading, saving, error } = useAppSelector(
    (state) => state.skus,
  );

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingSku, setEditingSku] = useState<Sku | null>(null);
  const [form, setForm] = useState<SkuInput>(emptyForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchSkus());
  }, [dispatch]);

  const filteredSkus = useMemo(() => {
    const term = search.trim().toLowerCase();

    return items.filter((sku) => {
      const matchesSearch =
        sku.skuCode.toLowerCase().includes(term) ||
        sku.name.toLowerCase().includes(term);

      const matchesFilter =
        filter === 'ALL' ||
        (filter === 'ACTIVE' && sku.isActive) ||
        (filter === 'INACTIVE' && !sku.isActive);

      return matchesSearch && matchesFilter;
    });
  }, [items, search, filter]);

  const activeCount = items.filter((sku) => sku.isActive).length;
  const inactiveCount = items.length - activeCount;

  function openCreateForm() {
    dispatch(clearSkuError());
    setEditingSku(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(sku: Sku) {
    dispatch(clearSkuError());
    setEditingSku(sku);

    setForm({
      skuCode: sku.skuCode,
      name: sku.name,
      description: sku.description ?? '',
      unit: sku.unit,
    });

    setFormError('');
    setShowForm(true);
  }

  function closeForm() {
    setShowForm(false);
    setEditingSku(null);
    setForm(emptyForm);
    setFormError('');
  }

  function handleChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const payload: SkuInput = {
      skuCode: form.skuCode.trim(),
      name: form.name.trim(),
      description: form.description?.trim() ?? '',
      unit: form.unit?.trim() || 'EA',
    };

    if (payload.skuCode.length < 2 || payload.skuCode.length > 50) {
      setFormError('SKU code must contain 2–50 characters.');
      return;
    }

    if (payload.name.length < 2 || payload.name.length > 120) {
      setFormError('SKU name must contain 2–120 characters.');
      return;
    }

    if ((payload.description?.length ?? 0) > 500) {
      setFormError('Description cannot exceed 500 characters.');
      return;
    }

    if ((payload.unit?.length ?? 0) > 10) {
      setFormError('Unit cannot exceed 10 characters.');
      return;
    }

    try {
      if (editingSku) {
        await dispatch(
          updateSku({
            id: editingSku.id,
            data: payload,
          }),
        ).unwrap();
      } else {
        await dispatch(createSku(payload)).unwrap();
      }

      closeForm();
    } catch {
      // The rejected thunk message is displayed from Redux state.
    }
  }

  async function handleDeactivate(sku: Sku) {
    const confirmed = window.confirm(
      `Deactivate SKU ${sku.skuCode}? It will remain in the database.`,
    );

    if (!confirmed) return;

    dispatch(clearSkuError());

    try {
      await dispatch(deactivateSku(sku.id)).unwrap();
    } catch {
      // The Redux error is displayed below.
    }
  }

  async function handleReactivate(sku: Sku) {
    dispatch(clearSkuError());

    try {
      await dispatch(reactivateSku(sku.id)).unwrap();
    } catch {
      // The Redux error is displayed below.
    }
  }

  return (
    <main className="dashboard sku-page">
      <header className="page-header">
        <div>
          <p className="eyebrow">MASTER DATA MANAGEMENT</p>
          <h1>SKU Management</h1>
          <p className="subtitle">
            Create, maintain and manage your product catalog.
          </p>
        </div>

        <button
          className="primary-button"
          onClick={openCreateForm}
        >
          + Add SKU
        </button>
      </header>

      <section className="sku-stat-grid">
        <article className="metric-card">
          <p>Total SKUs</p>
          <h2>{items.length}</h2>
        </article>

        <article className="metric-card">
          <p>Active SKUs</p>
          <h2>{activeCount}</h2>
        </article>

        <article className="metric-card">
          <p>Inactive SKUs</p>
          <h2>{inactiveCount}</h2>
        </article>
      </section>

      {showForm && (
        <section className="panel sku-form-panel">
          <div className="panel-heading">
            <h2>{editingSku ? 'Edit SKU' : 'Create SKU'}</h2>

            <button
              className="text-button"
              onClick={closeForm}
            >
              Cancel
            </button>
          </div>

          <form onSubmit={handleSubmit} className="sku-form">
            <label>
              SKU Code *
              <input
                name="skuCode"
                value={form.skuCode}
                onChange={handleChange}
                minLength={2}
                maxLength={50}
                required
                placeholder="e.g. LAPTOP-001"
              />
            </label>

            <label>
              SKU Name *
              <input
                name="name"
                value={form.name}
                onChange={handleChange}
                minLength={2}
                maxLength={120}
                required
                placeholder="e.g. Business Laptop"
              />
            </label>

            <label>
              Unit
              <input
                name="unit"
                value={form.unit ?? ''}
                onChange={handleChange}
                maxLength={10}
                placeholder="EA"
              />
            </label>

            <label className="full-width">
              Description
              <textarea
                name="description"
                value={form.description ?? ''}
                onChange={handleChange}
                maxLength={500}
                rows={3}
                placeholder="Optional product description"
              />
            </label>

            {formError && (
              <p className="form-error full-width">
                {formError}
              </p>
            )}

            {error && (
              <p className="form-error full-width">
                {error}
              </p>
            )}

            <div className="form-actions full-width">
              <button
                type="button"
                className="secondary-button"
                onClick={closeForm}
                disabled={saving}
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
                  : editingSku
                    ? 'Save Changes'
                    : 'Create SKU'}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="panel sku-table-panel">
        <div className="panel-heading">
          <div>
            <h2>Product Catalog</h2>
            <span>{filteredSkus.length} records</span>
          </div>
        </div>

        <div className="sku-toolbar">
          <input
            className="sku-search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search by SKU code or name..."
          />

          <select
            value={filter}
            onChange={(event) =>
              setFilter(event.target.value as Filter)
            }
            aria-label="Filter SKUs"
          >
            <option value="ALL">All SKUs</option>
            <option value="ACTIVE">Active</option>
            <option value="INACTIVE">Inactive</option>
          </select>
        </div>

        {error && !showForm && (
          <div className="error-banner">
            {error}

            <button
              className="text-button"
              onClick={() => dispatch(fetchSkus())}
            >
              Retry
            </button>
          </div>
        )}

        {loading ? (
          <p className="empty-state">Loading SKUs...</p>
        ) : filteredSkus.length === 0 ? (
          <p className="empty-state">
            {items.length === 0
              ? 'No SKUs found. Create your first SKU.'
              : 'No SKUs match your search or filter.'}
          </p>
        ) : (
          <div className="table-scroll">
            <table className="sku-table">
              <thead>
                <tr>
                  <th>SKU Code</th>
                  <th>Name</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {filteredSkus.map((sku) => (
                  <tr key={sku.id}>
                    <td>
                      <strong>{sku.skuCode}</strong>
                    </td>

                    <td>{sku.name}</td>

                    <td className="sku-description">
                      {sku.description || '—'}
                    </td>

                    <td>{sku.unit}</td>

                    <td>
                      <span
                        className={`sku-status ${
                          sku.isActive ? 'active' : 'inactive'
                        }`}
                      >
                        {sku.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </td>

                    <td>
                      <div className="sku-actions">
                        <button
                          className="text-button"
                          onClick={() => openEditForm(sku)}
                          disabled={saving}
                        >
                          Edit
                        </button>

                        {sku.isActive ? (
                          <button
                            className="text-button danger-text"
                            onClick={() => handleDeactivate(sku)}
                            disabled={saving}
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            className="text-button success-text"
                            onClick={() => handleReactivate(sku)}
                            disabled={saving}
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

export default SkuManagement;
