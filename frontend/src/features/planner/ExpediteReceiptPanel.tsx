import { useState } from 'react';
import type { FormEvent } from 'react';

import { useAppDispatch, useAppSelector } from '../../app/hooks';
import type { InboundReceipt } from '../../types';
import { clearPlannerError, expediteReceipt } from './plannerSlice';

interface ExpediteReceiptPanelProps {
  receipt: InboundReceipt;
  onClose: () => void;
  onCompleted: (message: string) => void;
}

/** Bring a receipt's expected arrival forward, with a required reason. */
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
        `${receipt.receiptId} expedited to ${newEta.toLocaleString()}.`,
      );
    } catch {
      // The planner slice keeps the backend error message.
    }
  }

  return (
    <section
      className="sku-form-panel planner-panel"
      aria-label="Expedite receipt"
    >
      <div className="order-section-heading">
        <div>
          <p className="page-eyebrow">PLANNER ACTION</p>
          <h2>Expedite {receipt.receiptId}</h2>
          <p>
            {receipt.sku.skuCode} × {receipt.quantity} into{' '}
            {receipt.warehouse.code} · currently expected{' '}
            {new Date(receipt.expectedArrivalTime).toLocaleString()}
          </p>
        </div>
        <button className="secondary-button" type="button" onClick={close}>
          Close
        </button>
      </div>

      <form className="sku-form planner-form" onSubmit={handleSubmit}>
        <label>
          New expected arrival *
          <input
            type="datetime-local"
            value={arrival}
            onChange={(event) => setArrival(event.target.value)}
            required
          />
        </label>

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
          <button className="primary-button" type="submit" disabled={saving}>
            {saving ? 'Saving...' : 'Expedite receipt'}
          </button>
        </div>
      </form>
    </section>
  );
}

export default ExpediteReceiptPanel;
