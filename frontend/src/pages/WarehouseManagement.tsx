import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import {
  Archive,
  Building2,
  MapPin,
  Pencil,
  Plus,
  RefreshCw,
  RotateCcw,
  Warehouse as WarehouseIcon,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useConfirm, useToast } from '../app/providers/contexts';
import {
  clearWarehouseError,
  createWarehouse,
  deactivateWarehouse,
  fetchWarehouses,
  reactivateWarehouse,
  updateWarehouse,
} from '../features/warehouses/warehouseSlice';
import type { WarehouseInput } from '../features/warehouses/warehouseSlice';
import { fetchInventory } from '../features/inventory/inventorySlice';

import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { StatCard } from '../components/ui/StatCard';
import { Field, SearchInput, SegmentedControl } from '../components/ui/Form';
import { Alert, EmptyState, Meter, Skeleton } from '../components/ui/Feedback';
import { Modal } from '../components/ui/Overlay';
import { ActiveBadge } from '../components/ui/StatusBadges';
import type { Warehouse } from '../types';

type Filter = 'ALL' | 'ACTIVE' | 'INACTIVE';

const emptyForm: WarehouseInput = {
  code: '',
  name: '',
  city: '',
};

function WarehouseManagement() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const confirm = useConfirm();

  const { items, loading, saving, error } = useAppSelector(
    (state) => state.warehouses,
  );
  const inventory = useAppSelector((state) => state.inventory.items);

  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('ALL');
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<WarehouseInput>(emptyForm);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    dispatch(fetchWarehouses());
    dispatch(fetchInventory());
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

  const stockByWarehouse = useMemo(() => {
    const map = new Map<
      string,
      { onHand: number; skus: number; low: number; safety: number }
    >();

    for (const item of inventory) {
      const entry = map.get(item.warehouseId) ?? {
        onHand: 0,
        skus: 0,
        low: 0,
        safety: 0,
      };
      entry.onHand += item.onHandQuantity;
      entry.safety += item.safetyStock;
      entry.skus += 1;
      if (item.safetyStock > 0 && item.onHandQuantity <= item.safetyStock) {
        entry.low += 1;
      }
      map.set(item.warehouseId, entry);
    }

    return map;
  }, [inventory]);

  const networkUnits = [...stockByWarehouse.values()].reduce(
    (sum, entry) => sum + entry.onHand,
    0,
  );
  const maxUnits = Math.max(
    1,
    ...[...stockByWarehouse.values()].map((entry) => entry.onHand),
  );

  const activeCount = items.filter((item) => item.isActive).length;
  const inactiveCount = items.length - activeCount;

  function openCreateForm() {
    dispatch(clearWarehouseError());
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setShowForm(true);
  }

  function openEditForm(warehouse: Warehouse) {
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

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
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
        await dispatch(updateWarehouse({ id: editingId, data: payload })).unwrap();
        toast({ title: 'Warehouse updated', description: payload.code });
      } else {
        await dispatch(createWarehouse(payload)).unwrap();
        toast({ title: 'Warehouse created', description: `${payload.code} · ${payload.city}` });
      }

      closeForm();
    } catch {
      // The Redux slice stores the API error.
    }
  }

  async function handleDeactivate(warehouse: Warehouse) {
    const confirmed = await confirm({
      title: `Deactivate ${warehouse.name}?`,
      description:
        'The allocation engine stops using its stock, and it cannot receive new receipts or adjustments. You can reactivate it later.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    });

    if (!confirmed) return;

    const result = await dispatch(deactivateWarehouse(warehouse.id));
    if (deactivateWarehouse.fulfilled.match(result)) {
      toast({ title: `${warehouse.code} deactivated` });
    }
  }

  async function handleReactivate(warehouse: Warehouse) {
    const result = await dispatch(reactivateWarehouse(warehouse.id));
    if (reactivateWarehouse.fulfilled.match(result)) {
      toast({ title: `${warehouse.code} reactivated` });
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Catalog"
        eyebrowIcon={<WarehouseIcon />}
        title="Warehouses"
        description="Fulfillment locations in your network, with the stock each one holds."
        actions={
          <>
            <Button
              variant="ghost"
              icon={<RefreshCw />}
              loading={loading}
              onClick={() => {
                dispatch(fetchWarehouses());
                dispatch(fetchInventory());
              }}
            >
              Refresh
            </Button>
            <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
              New warehouse
            </Button>
          </>
        }
      />

      <div className="stat-grid">
        <StatCard index={0} label="Locations" value={items.length} icon={<Building2 />} tone="accent" />
        <StatCard
          index={1}
          label="Active"
          value={activeCount}
          icon={<WarehouseIcon />}
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
        <StatCard
          index={3}
          label="Network on-hand"
          value={networkUnits.toLocaleString()}
          icon={<MapPin />}
          tone="info"
          hint="Units across all locations"
        />
      </div>

      {error && !showForm && (
        <Alert
          tone="danger"
          title="Something went wrong"
          action={
            <Button size="sm" onClick={() => dispatch(fetchWarehouses())}>
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
            placeholder="Search code, name or city..."
          />
          <SegmentedControl
            label="Filter warehouses"
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
          <div className="warehouse-grid">
            {Array.from({ length: 3 }, (_, index) => (
              <div className="warehouse-card" key={index}>
                <Skeleton width="40%" height={16} />
                <Skeleton width="65%" />
                <Skeleton height={6} />
              </div>
            ))}
          </div>
        ) : filteredWarehouses.length === 0 ? (
          <EmptyState
            icon={<WarehouseIcon />}
            title={items.length === 0 ? 'No warehouses yet' : 'No warehouses match'}
            description={
              items.length === 0
                ? 'Create your first fulfillment location.'
                : 'Try a different search or filter.'
            }
            action={
              items.length === 0 ? (
                <Button variant="primary" icon={<Plus />} onClick={openCreateForm}>
                  New warehouse
                </Button>
              ) : undefined
            }
          />
        ) : (
          <div className="warehouse-grid">
            {filteredWarehouses.map((warehouse) => {
              const stock = stockByWarehouse.get(warehouse.id);

              return (
                <article
                  key={warehouse.id}
                  className={`warehouse-card${warehouse.isActive ? '' : ' is-inactive'}`}
                >
                  <div className="warehouse-card-head">
                    <span className="warehouse-icon">
                      <WarehouseIcon />
                    </span>
                    <div className="warehouse-card-title">
                      <strong className="cell-code">{warehouse.code}</strong>
                      <span>{warehouse.name}</span>
                    </div>
                    <ActiveBadge active={warehouse.isActive} />
                  </div>

                  <span className="icon-inline text-muted">
                    <MapPin /> {warehouse.city}
                  </span>

                  <div className="warehouse-stats">
                    <div>
                      <span>On hand</span>
                      <strong className="tabular">
                        {(stock?.onHand ?? 0).toLocaleString()}
                      </strong>
                    </div>
                    <div>
                      <span>SKUs</span>
                      <strong className="tabular">{stock?.skus ?? 0}</strong>
                    </div>
                    <div>
                      <span>Low stock</span>
                      <strong
                        className={`tabular${(stock?.low ?? 0) > 0 ? ' text-warning' : ''}`}
                      >
                        {stock?.low ?? 0}
                      </strong>
                    </div>
                  </div>

                  <Meter
                    value={stock?.onHand ?? 0}
                    max={maxUnits}
                    tone={warehouse.isActive ? 'accent' : 'warning'}
                    label={`${warehouse.code} share of the largest location`}
                  />

                  <div className="warehouse-card-actions">
                    {warehouse.isActive ? (
                      <>
                        <Button
                          variant="ghost"
                          size="sm"
                          icon={<Pencil />}
                          onClick={() => openEditForm(warehouse)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="danger-ghost"
                          size="sm"
                          icon={<Archive />}
                          disabled={saving}
                          onClick={() => handleDeactivate(warehouse)}
                        >
                          Deactivate
                        </Button>
                      </>
                    ) : (
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<RotateCcw />}
                        disabled={saving}
                        onClick={() => handleReactivate(warehouse)}
                      >
                        Reactivate
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={showForm}
        onClose={closeForm}
        title={editingId ? 'Edit warehouse' : 'New warehouse'}
        description="Codes are unique and appear throughout orders, receipts and the allocation plan."
        footer={
          <>
            <Button onClick={closeForm}>Cancel</Button>
            <Button variant="primary" type="submit" form="warehouse-form" loading={saving}>
              {editingId ? 'Save changes' : 'Create warehouse'}
            </Button>
          </>
        }
      >
        <form id="warehouse-form" className="form-grid" onSubmit={handleSubmit}>
          {(formError || error) && (
            <Alert tone="danger" className="span-2">
              {formError || error}
            </Alert>
          )}

          <Field label="Warehouse code" required>
            <input
              className="input"
              name="code"
              value={form.code}
              onChange={handleChange}
              placeholder="e.g. WH-HYD-001"
              maxLength={30}
              required
            />
          </Field>

          <Field label="City" required>
            <input
              className="input"
              name="city"
              value={form.city}
              onChange={handleChange}
              placeholder="e.g. Hyderabad"
              maxLength={100}
              required
            />
          </Field>

          <Field label="Warehouse name" required className="span-2">
            <input
              className="input"
              name="name"
              value={form.name}
              onChange={handleChange}
              placeholder="e.g. Hyderabad Distribution Center"
              maxLength={120}
              required
            />
          </Field>
        </form>
      </Modal>
    </div>
  );
}

export default WarehouseManagement;
