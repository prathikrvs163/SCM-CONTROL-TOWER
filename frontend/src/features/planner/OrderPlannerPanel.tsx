import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { AllocationOrder, Order, Warehouse } from '../../types';
import {
  clearPlannerError,
  overridePromiseDate,
  reassignOrderLine,
  splitOrder,
} from './plannerSlice';

export type OrderPlannerAction =
  | { kind: 'reassign'; orderLineId: string }
  | { kind: 'override'; orderLineId: string }
  | { kind: 'split' };

interface OrderPlannerPanelProps {
  order: Order;
  planOrder: AllocationOrder | null;
  warehouses: Warehouse[];
  action: OrderPlannerAction;
  onClose: () => void;
  onCompleted: (message: string, updatedOrder: Order) => void;
}

const MIN_REASON_LENGTH = 3;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function formatDate(value: string | null | undefined): string {
  return value ? new Date(value).toLocaleDateString() : '—';
}

/**
 * Form for the order-level planner actions. Every action asks for a reason,
 * which is stored with the change in the audit log.
 */
function OrderPlannerPanel({
  order,
  planOrder,
  warehouses,
  action,
  onClose,
  onCompleted,
}: OrderPlannerPanelProps) {
  const dispatch = useAppDispatch();
  const { saving, error } = useAppSelector((state) => state.planner);

  const line =
    action.kind === 'split'
      ? null
      : (order.lines.find((item) => item.id === action.orderLineId) ?? null);
  const planLine =
    action.kind === 'split'
      ? null
      : (planOrder?.lines.find(
          (item) => item.orderLineId === action.orderLineId,
        ) ?? null);

  const [reason, setReason] = useState('');
  const [warehouseId, setWarehouseId] = useState('');
  const [promiseDate, setPromiseDate] = useState(
    line?.promisedShipDateOverride?.slice(0, 10) ?? '',
  );
  const [splitQuantities, setSplitQuantities] = useState<
    Record<string, string>
  >({});
  const [formError, setFormError] = useState('');

  const title =
    action.kind === 'reassign'
      ? 'Reassign fulfillment location'
      : action.kind === 'override'
        ? 'Override promised ship date'
        : 'Split shipment';

  function close() {
    dispatch(clearPlannerError());
    onClose();
  }

  async function run(submit: () => Promise<{ message: string; order: Order }>) {
    try {
      const result = await submit();
      dispatch(clearPlannerError());
      onCompleted(result.message, result.order);
    } catch {
      // The planner slice keeps the backend error message.
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    const trimmedReason = reason.trim();

    if (trimmedReason.length < MIN_REASON_LENGTH) {
      setFormError('Enter a reason of at least 3 characters.');
      return;
    }

    if (action.kind === 'reassign') {
      if (!warehouseId) {
        setFormError('Select a warehouse.');
        return;
      }

      const code = warehouses.find((item) => item.id === warehouseId)?.code;

      await run(async () => ({
        order: await dispatch(
          reassignOrderLine({
            orderLineId: action.orderLineId,
            warehouseId,
            reason: trimmedReason,
          }),
        ).unwrap(),
        message: `${line?.sku.skuCode ?? 'Line'} on ${order.orderNumber} now ships from ${code ?? 'the selected warehouse'} first.`,
      }));
      return;
    }

    if (action.kind === 'override') {
      if (!promiseDate) {
        setFormError('Choose a promise date, or use Clear override.');
        return;
      }

      await run(async () => ({
        order: await dispatch(
          overridePromiseDate({
            orderLineId: action.orderLineId,
            // Promise dates are whole UTC days, like the allocation plan.
            promisedShipDate: `${promiseDate}T00:00:00.000Z`,
            reason: trimmedReason,
          }),
        ).unwrap(),
        message: `Promise date for ${line?.sku.skuCode ?? 'the line'} overridden to ${promiseDate}.`,
      }));
      return;
    }

    const lines = order.lines
      .map((item) => ({
        orderLineId: item.id,
        quantity: Number(splitQuantities[item.id] || 0),
        max: item.quantity,
        skuCode: item.sku.skuCode,
      }))
      .filter((item) => item.quantity !== 0);

    if (lines.length === 0) {
      setFormError('Enter a quantity to move for at least one line.');
      return;
    }

    const invalid = lines.find(
      (item) =>
        !Number.isInteger(item.quantity) ||
        item.quantity < 1 ||
        item.quantity > item.max,
    );

    if (invalid) {
      setFormError(
        `${invalid.skuCode}: move a whole number between 1 and ${invalid.max}.`,
      );
      return;
    }

    await run(async () => {
      const result = await dispatch(
        splitOrder({
          orderId: order.id,
          lines: lines.map(({ orderLineId, quantity }) => ({
            orderLineId,
            quantity,
          })),
          reason: trimmedReason,
        }),
      ).unwrap();

      return {
        order: result.originalOrder,
        message: `${result.splitOrder.orderNumber} was created with the moved quantities.`,
      };
    });
  }

  async function handleClearOverride() {
    if (action.kind !== 'override') return;

    setFormError('');
    const trimmedReason = reason.trim();

    if (trimmedReason.length < MIN_REASON_LENGTH) {
      setFormError('Enter a reason of at least 3 characters.');
      return;
    }

    await run(async () => ({
      order: await dispatch(
        overridePromiseDate({
          orderLineId: action.orderLineId,
          promisedShipDate: null,
          reason: trimmedReason,
        }),
      ).unwrap(),
      message: `Promise override for ${line?.sku.skuCode ?? 'the line'} cleared; the computed promise applies again.`,
    }));
  }

  return (
    <section className="planner-panel" aria-label={title}>
      <div className="order-section-heading">
        <div>
          <p className="page-eyebrow">PLANNER ACTION</p>
          <h3>{title}</h3>
          <p>
            {order.orderNumber}
            {line ? ` · ${line.sku.skuCode} × ${line.quantity}` : ''}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={close}>
          Close
        </button>
      </div>

      <form className="sku-form planner-form" onSubmit={handleSubmit}>
        {action.kind === 'reassign' && (
          <>
            <p className="muted-text full-width">
              Current location:{' '}
              <strong>{line?.preferredWarehouse?.code ?? 'No preference'}</strong>.
              The plan draws from the new warehouse first and falls back to
              others only if it cannot cover the quantity.
            </p>
            <label>
              New warehouse *
              <select
                value={warehouseId}
                onChange={(event) => setWarehouseId(event.target.value)}
                required
              >
                <option value="">Select warehouse</option>
                {warehouses
                  .filter((item) => item.id !== line?.preferredWarehouseId)
                  .map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.code} — {item.name}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}

        {action.kind === 'override' && (
          <>
            <p className="muted-text full-width">
              Computed promise:{' '}
              <strong>
                {planLine
                  ? planLine.computedPromisedShipDate
                    ? formatDate(planLine.computedPromisedShipDate)
                    : 'None (backordered)'
                  : 'Plan unavailable'}
              </strong>
              {line?.promisedShipDateOverride && (
                <>
                  {' · '}Current override:{' '}
                  <strong>{formatDate(line.promisedShipDateOverride)}</strong>
                </>
              )}
            </p>
            <label>
              Promised ship date *
              <input
                type="date"
                min={todayUtc()}
                value={promiseDate}
                onChange={(event) => setPromiseDate(event.target.value)}
              />
            </label>
          </>
        )}

        {action.kind === 'split' && (
          <div className="full-width planner-split-lines">
            <p className="muted-text">
              Moved quantities go to a new order with the same customer,
              priority, status and queue position. At least one unit must stay
              on {order.orderNumber}.
            </p>
            {order.lines.map((item) => {
              const plan = planOrder?.lines.find(
                (candidate) => candidate.orderLineId === item.id,
              );

              return (
                <label key={item.id}>
                  {item.sku.skuCode} — {item.quantity} ordered
                  {plan ? `, ${plan.backorderedQuantity} backordered` : ''}
                  <input
                    type="number"
                    min="0"
                    max={item.quantity}
                    step="1"
                    placeholder="0"
                    value={splitQuantities[item.id] ?? ''}
                    onChange={(event) =>
                      setSplitQuantities((current) => ({
                        ...current,
                        [item.id]: event.target.value,
                      }))
                    }
                    aria-label={`Units of ${item.sku.skuCode} to move`}
                  />
                </label>
              );
            })}
          </div>
        )}

        <label className="full-width">
          Reason * (stored in the audit log)
          <textarea
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            required
          />
        </label>

        {(formError || error) && (
          <div className="form-error full-width">{formError || error}</div>
        )}

        <div className="order-form-actions full-width">
          {action.kind === 'override' && line?.promisedShipDateOverride && (
            <button
              className="secondary-button"
              type="button"
              disabled={saving}
              onClick={handleClearOverride}
            >
              Clear override
            </button>
          )}
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : title}
          </button>
        </div>
      </form>
    </section>
  );
}

export default OrderPlannerPanel;
