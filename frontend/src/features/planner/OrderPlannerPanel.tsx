import { useState } from 'react';
import type { FormEvent } from 'react';

import { CalendarCog, MapPin, Split, X } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field } from '../../components/ui/Form';
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

  const Icon =
    action.kind === 'reassign' ? MapPin : action.kind === 'override' ? CalendarCog : Split;

  return (
    <section className="planner-panel" aria-label={title}>
      <div className="planner-panel-head">
        <span className="planner-panel-icon">
          <Icon />
        </span>
        <div className="planner-panel-title">
          <span className="planner-panel-eyebrow">Planner action</span>
          <h3>{title}</h3>
          <p>
            {order.orderNumber}
            {line ? ` · ${line.sku.skuCode} × ${line.quantity}` : ''}
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={<X />}
          onClick={close}
          aria-label="Close planner action"
        />
      </div>

      <form className="form-grid" onSubmit={handleSubmit}>
        {action.kind === 'reassign' && (
          <>
            <p className="planner-note span-2">
              Current location:{' '}
              <strong>{line?.preferredWarehouse?.code ?? 'No preference'}</strong>.
              The plan draws from the new warehouse first and falls back to
              others only if it cannot cover the quantity.
            </p>
            <Field label="New warehouse" required>
              <select
                className="select"
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
            </Field>
          </>
        )}

        {action.kind === 'override' && (
          <>
            <p className="planner-note span-2">
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
            <Field label="Promised ship date" required>
              <input
                className="input"
                type="date"
                min={todayUtc()}
                value={promiseDate}
                onChange={(event) => setPromiseDate(event.target.value)}
              />
            </Field>
          </>
        )}

        {action.kind === 'split' && (
          <div className="span-2 planner-split">
            <p className="planner-note">
              Moved quantities go to a new order with the same customer,
              priority, status and queue position. At least one unit must stay
              on {order.orderNumber}.
            </p>
            {order.lines.map((item) => {
              const plan = planOrder?.lines.find(
                (candidate) => candidate.orderLineId === item.id,
              );

              return (
                <div className="planner-split-row" key={item.id}>
                  <div>
                    <span className="cell-primary">{item.sku.skuCode}</span>
                    <span className="cell-secondary">
                      {item.quantity} ordered
                      {plan ? ` · ${plan.backorderedQuantity} backordered` : ''}
                    </span>
                  </div>
                  <input
                    className="input"
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
                </div>
              );
            })}
          </div>
        )}

        <Field
          label="Reason"
          required
          hint="Stored with the change in the audit log."
          className="span-2"
        >
          <textarea
            className="textarea"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            maxLength={500}
            rows={2}
            required
            placeholder="Why is this change needed?"
          />
        </Field>

        {(formError || error) && (
          <Alert tone="danger" className="span-2">
            {formError || error}
          </Alert>
        )}

        <div className="form-actions span-2">
          {action.kind === 'override' && line?.promisedShipDateOverride && (
            <Button disabled={saving} onClick={handleClearOverride}>
              Clear override
            </Button>
          )}
          <Button variant="primary" type="submit" loading={saving}>
            {title}
          </Button>
        </div>
      </form>
    </section>
  );
}

export default OrderPlannerPanel;
