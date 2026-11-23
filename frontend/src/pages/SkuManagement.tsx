import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Archive,
  CircleCheck,
  Package,
  PackageCheck,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useConfirm, useToast } from '../app/providers/contexts';
import {
  clearSkuError,
  createSku,
  deactivateSku,
  fetchSkus,
  reactivateSku,
  updateSku,
} from '../features/skus/skuSlice';
import type { SkuInput } from '../features/skus/skuSlice';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Field, SearchInput, SegmentedControl } from '../components/ui/Form';
import { Alert, EmptyState, TableSkeleton } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Overlay';
import { ActiveBadge } from '../components/ui/StatusBadges';
import { formatDate } from '../utils/format';
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
  const toast = useToast();
  const confirm = useConfirm();

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
        await dispatch(updateSku({ id: editingSku.id, data: payload })).unwrap();
        toast({ title: 'SKU updated', description: payload.skuCode });
      } else {
        await dispatch(createSku(payload)).unwrap();
        toast({ title: 'SKU created', description: `${payload.skuCode} · ${payload.name}` });
      }

      closeForm();
    } catch {
      // The rejected thunk message is displayed from Redux state.
    }
  }

  async function handleDeactivate(sku: Sku) {
    const confirmed = await confirm({
      title: `Deactivate ${sku.skuCode}?`,
      description:
        'It stays in the database and in existing orders, but cannot be used for new orders, receipts or adjustments. You can reactivate it later.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });

    if (!confirmed) return;

    dispatch(clearSkuError());

    try {
      await dispatch(deactivateSku(sku.id)).unwrap();
      toast({ title: `${sku.skuCode} deactivated` });
    } catch {
      // The Redux error is displayed below.
    }
  }

  async function handleReactivate(sku: Sku) {
    dispatch(clearSkuError());

    try {
      await dispatch(reactivateSku(sku.id)).unwrap();
      toast({ title: `${sku.skuCode} reactivated` });
    } catch {
      // The Redux error is displayed below.
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog"
        eyebrowIcon={<Package />}
        title="SKUs"
        description="The product catalog. Deactivated SKUs are kept for history but cannot be used in new transactions."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => dispatch(fetchSkus())}
            >
              Refresh
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
              New SKU
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard index={0} label="Total SKUs" value={items.length} icon={<Package />} tone="accent" />
        <StatCard
          index={1}
          label="Active"
          value={activeCount}
          icon={<PackageCheck />}
          tone="success"
          onClick={() => setFilter(filter === 'ACTIVE' ? 'ALL' : 'ACTIVE')}
          active={filter === 'ACTIVE'}
        />
        <StatCard
          index={2}
          label="Inactive"
          value={inactiveCount}
          icon={<Archive />}
          onClick={() => setFilter(filter === 'INACTIVE' ? 'ALL' : 'INACTIVE')}
          active={filter === 'INACTIVE'}
        />
      </div>

      {error && !showForm && (
        <Alert
          tone="danger"
          title="Something went wrong"
          action={
            <Button size="sm" onClick={() => dispatch(fetchSkus())}>
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
            placeholder="Search by SKU code or name..."
          />
          <SegmentedControl
            label="Filter SKUs"
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'ALL', label: 'All', count: items.length },
              { value: 'ACTIVE', label: 'Active', count: activeCount },
              { value: 'INACTIVE', label: 'Inactive', count: inactiveCount },
            ]}
          />
        </div>

        {loading && items.length === 0 ? (
          <TableSkeleton rows={8} columns={5} />
        ) : filteredSkus.length === 0 ? (
          <EmptyState
            icon={<Package />}
            title={items.length === 0 ? 'No SKUs yet' : 'No SKUs match'}
            description={
              items.length === 0
                ? 'Create your first SKU to start building the catalog.'
                : 'Try a different search or filter.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
                  New SKU
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Description</th>
                  <th>Unit</th>
                  <th>Status</th>
                  <th>Updated</th>
                  <th className="actions-cell">
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredSkus.map((sku) => (
                  <tr key={sku.id} className={sku.isActive ? undefined : 'is-muted-row'}>
                    <td>
                      <span className="cell-primary cell-code">{sku.skuCode}</span>
                      <span className="cell-secondary">{sku.name}</span>
                    </td>
                    <td className="text-secondary cell-truncate" title={sku.description ?? undefined}>
                      {sku.description || <span className="cell-muted">—</span>}
                    </td>
                    <td>
                      <span className="unit-chip">{sku.unit}</span>
                    </td>
                    <td>
                      <ActiveBadge active={sku.isActive} />
                    </td>
                    <td className="cell-muted tabular">{formatDate(sku.updatedAt)}</td>
                    <td className="actions-cell">
                      <div className="row-actions">
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil />}
                          onClick={() => openEditForm(sku)}
                          disabled={saving}
                        >
                          Edit
                        </Button>
                        {sku.isActive ? (
                          <Button
                            variant="danger-ghost"
                            size="sm"
                            icon={<Archive />}
                            onClick={() => handleDeactivate(sku)}
                            disabled={saving}
                          >
                            Deactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            icon={<RotateCcw />}
                            onClick={() => handleReactivate(sku)}
                            disabled={saving}
                          >
                            Reactivate
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="table-footer">
          <span>
            Showing {filteredSkus.length} of {items.length} SKUs
          </span>
          <span className="icon-inline">
            <CircleCheck /> Soft delete keeps history intact
          </span>
        </div>
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingSku ? `Edit ${editingSku.skuCode}` : 'New SKU'}
        description={
          editingSku
            ? 'Update the product details.'
            : 'Add a product to the catalog.'
        }
        footer={
          <>
            <Button onClick={closeForm} disabled={saving}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" form="sku-form" loading={saving}>
              {editingSku ? 'Save changes' : 'Create SKU'}
            </Button>
          </>
        }
      >
        <form id="sku-form" className="form-grid" onSubmit={handleSubmit}>
          {(formError || error) && (
            <Alert tone="danger" className="span-2">
              {formError || error}
            </Alert>
          )}

          <Field label="SKU code" required>
            <input
              className="input"
              name="skuCode"
              value={form.skuCode}
              onChange={handleChange}
              minLength={2}
              maxLength={50}
              required
              placeholder="e.g. LAPTOP-001"
            />
          </Field>

          <Field label="Unit" hint="Unit of measure, for example EA or BOX.">
            <input
              className="input"
              name="unit"
              value={form.unit ?? ''}
              onChange={handleChange}
              maxLength={10}
              placeholder="EA"
            />
          </Field>

          <Field label="Name" required className="span-2">
            <input
              className="input"
              name="name"
              value={form.name}
              onChange={handleChange}
              minLength={2}
              maxLength={120}
              required
              placeholder="e.g. Business Laptop"
            />
          </Field>

          <Field
            label="Description"
            hint={`${form.description?.length ?? 0}/500`}
            className="span-2"
          >
            <textarea
              className="textarea"
              name="description"
              value={form.description ?? ''}
              onChange={handleChange}
              maxLength={500}
              rows={3}
              placeholder="Optional product description"
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

export default SkuManagement;
