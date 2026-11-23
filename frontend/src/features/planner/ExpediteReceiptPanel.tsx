import { useState } from 'react';
import type { FormEvent } from 'react';
import { CalendarClock, Truck } from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import { Button } from '../../components/ui/Button';
import { Alert } from '../../components/ui/Feedback';
import { Field } from '../../components/ui/Form';
import type { InboundReceipt } from '../../types';
import { clearPlannerError, expediteReceipt } from './plannerSlice';

interface ExpediteReceiptPanelProps {
  receipt: InboundReceipt;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

/**
 * Bring a receipt's expected arrival forward, with a required reason.
 * Rendered inside a modal on the Supply page.
 */
function ExpediteReceiptPanel({
  receipt,
  onClose,
  onCompleted,
}: ExpediteReceiptPanelProps) {
  const dispatch = useAppDispatch();
  const { saving, error } = useAppSelector((state) => state.planner);

  const [arrival, setArrival] = useState('');
  const [reason, setReason] = useState('');
  const [formError, setFormError] = useState('');

  function close() {
    dispatch(clearPlannerError());
    onClose();
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError('');

    if (!arrival) {
      setFormError('Choose the new expected arrival.');
      return;
    }

    const newEta = new Date(arrival);

    if (newEta >= new Date(receipt.expectedArrivalTime)) {
      setFormError(
        'The expedited arrival must be earlier than the current one.',
      );
      return;
    }

    if (reason.trim().length < 3) {
      setFormError('Enter a reason of at least 3 characters.');
      return;
    }

    try {
      await dispatch(
        expediteReceipt({
          receiptId: receipt.id,
          expectedArrivalTime: newEta.toISOString(),
          reason: reason.trim(),
        }),
      ).unwrap();

      dispatch(clearPlannerError());
      onCompleted(
        `${receipt.receiptId} now expected ${newEta.toLocaleString()}.`,
      );
    } catch {
      // The planner slice keeps the backend error message.
    }
  }

  return (
    <form className="form-grid" onSubmit={handleSubmit} aria-label="Expedite receipt">
      <div className="span-2 expedite-summary">
        <div>
          <span className="icon-inline text-muted">
            <Truck /> Receipt
          </span>
          <strong>
            {receipt.sku.skuCode} × {receipt.quantity} into{' '}
            {receipt.warehouse.code}
          </strong>
        </div>
        <div>
          <span className="icon-inline text-muted">
            <CalendarClock /> Currently expected
          </span>
          <strong>
            {new Date(receipt.expectedArrivalTime).toLocaleString()}
          </strong>
        </div>
      </div>

      <Field label="New expected arrival" required className="span-2">
        <input
          className="input"
          type="datetime-local"
          value={arrival}
          onChange={(event) => setArrival(event.target.value)}
          required
        />
      </Field>

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
          placeholder="e.g. Supplier agreed to air freight"
        />
      </Field>

      {(formError || error) && (
        <Alert tone="danger" className="span-2">
          {formError || error}
        </Alert>
      )}

      <div className="form-actions span-2">
        <Button onClick={close}>Cancel</Button>
        <Button variant="primary" type="submit" loading={saving}>
          Expedite receipt
        </Button>
      </div>
    </form>
  );
}

export default ExpediteReceiptPanel;
