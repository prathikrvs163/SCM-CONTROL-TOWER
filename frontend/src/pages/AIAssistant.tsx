import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../app/hooks';
import {
  clearAiErrors,
  clearCustomerCommunication,
  generateCustomerCommunication,
  generateExceptionSummary,
} from '../features/ai/aiSlice';
import { fetchOrders } from '../features/orders/orderSlice';

function AIAssistant() {
  const dispatch = useAppDispatch();

  const {
    exceptionSummary,
    customerCommunication,
    summaryLoading,
    communicationLoading,
    summaryError,
    communicationError,
  } = useAppSelector((state) => state.ai);

  const { items: orders, loading: ordersLoading } = useAppSelector(
    (state) => state.orders,
  );

  const [selectedOrderId, setSelectedOrderId] = useState('');

  useEffect(() => {
    if (orders.length === 0) {
      dispatch(fetchOrders());
    }
  }, [dispatch, orders.length]);

  const handleGenerateSummary = () => {
    dispatch(clearAiErrors());
    dispatch(generateExceptionSummary());
  };

  const handleGenerateCommunication = () => {
    if (!selectedOrderId) return;

    dispatch(clearAiErrors());
    dispatch(generateCustomerCommunication(selectedOrderId));
  };

  const handleCopyDraft = async () => {
    if (!customerCommunication?.draft) return;

    try {
      await navigator.clipboard.writeText(
        customerCommunication.draft,
      );
      window.alert('Customer communication draft copied.');
    } catch {
      window.alert(
        'Unable to copy. Please select and copy the draft manually.',
      );
    }
  };

  const handleCopySummary = async () => {
    if (!exceptionSummary?.summary) return;

    try {
      await navigator.clipboard.writeText(
        exceptionSummary.summary,
      );
      window.alert('Exception summary copied.');
    } catch {
      window.alert(
        'Unable to copy. Please select and copy the summary manually.',
      );
    }
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1>AI Assistant</h1>
          <p>
            AI-powered operational insights and customer communication
            assistance.
          </p>
        </div>
      </div>

      <div className="ai-disclaimer">
        AI-generated content may require verification. Review all outputs
        before using them. AI actions do not automatically modify orders
        or send customer messages.
      </div>

      <div className="ai-feature-grid">
        {/* Exception Summary */}
        <section className="sku-form-panel ai-panel">
          <div className="ai-panel-heading">
            <div>
              <h2>Exception Summary</h2>
              <p>
                Generate an operational summary of current supply chain
                exceptions.
              </p>
            </div>

            <span className="ai-icon">AI</span>
          </div>

          <button
            className="primary-button"
            onClick={handleGenerateSummary}
            disabled={summaryLoading}
          >
            {summaryLoading
              ? 'Generating summary...'
              : 'Generate Summary'}
          </button>

          {summaryError && (
            <div className="form-error">{summaryError}</div>
          )}

          {summaryLoading && (
            <div className="empty-state">
              Analyzing current supply chain exceptions... This can take
              up to two minutes when Gemini is busy.
            </div>
          )}

          {exceptionSummary && (
            <div className="ai-result">
              <div className="ai-result-meta">
                <span>
                  Exceptions analyzed: {exceptionSummary.exceptionCount}
                </span>

                <span>
                  Generated:{' '}
                  {new Date(
                    exceptionSummary.generatedAt,
                  ).toLocaleString()}
                </span>
              </div>

              <div className="ai-output">
                {exceptionSummary.summary}
              </div>

              <button
                className="secondary-button"
                onClick={handleCopySummary}
              >
                Copy summary
              </button>
            </div>
          )}
        </section>

        {/* Customer Communication */}
        <section className="sku-form-panel ai-panel">
          <div className="ai-panel-heading">
            <div>
              <h2>Customer Communication</h2>
              <p>
                Generate a professional customer-facing order update.
              </p>
            </div>

            <span className="ai-icon">AI</span>
          </div>

          <label htmlFor="ai-order">Select order</label>

          <select
            id="ai-order"
            value={selectedOrderId}
            onChange={(event) => {
              setSelectedOrderId(event.target.value);
              dispatch(clearCustomerCommunication());
            }}
            disabled={ordersLoading || communicationLoading}
          >
            <option value="">
              {ordersLoading
                ? 'Loading orders...'
                : 'Select an order'}
            </option>

            {orders
              .filter((order) => order.status !== 'CANCELED')
              .map((order) => (
                <option key={order.id} value={order.id}>
                  {order.orderNumber} — {order.customerName} (
                  {order.status})
                </option>
              ))}
          </select>

          <button
            className="primary-button"
            onClick={handleGenerateCommunication}
            disabled={!selectedOrderId || communicationLoading}
          >
            {communicationLoading
              ? 'Generating draft...'
              : 'Generate Customer Draft'}
          </button>

          {communicationError && (
            <div className="form-error">
              {communicationError}
            </div>
          )}

          {communicationLoading && (
            <div className="empty-state">
              Preparing customer communication...
            </div>
          )}

          {customerCommunication && (
            <div className="ai-result">
              <div className="ai-result-meta">
                <strong>
                  {customerCommunication.orderNumber} — {' '}
                  {customerCommunication.customerName}
                </strong>

                <span>
                  Generated:{' '}
                  {new Date(
                    customerCommunication.generatedAt,
                  ).toLocaleString()}
                </span>
              </div>

              <div className="ai-output">
                {customerCommunication.draft}
              </div>

              <button
                className="secondary-button"
                onClick={handleCopyDraft}
              >
                Copy customer draft
              </button>
            </div>
          )}

          {!ordersLoading && orders.length === 0 && (
            <div className="muted-text">
              No orders available. Create an order before generating a
              customer communication.
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default AIAssistant;
