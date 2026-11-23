import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Bot,
  Copy,
  FileText,
  Mail,
  RotateCcw,
  ScrollText,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';

import { useAppDispatch, useAppSelector } from '../app/hooks';
import { useToast } from '../app/providers/contexts';
import {
  clearAiErrors,
  clearCustomerCommunication,
  generateCustomerCommunication,
  generateExceptionSummary,
} from '../features/ai/aiSlice';
import { AiText } from '../features/ai/AiText';
import { splitDraft } from '../features/ai/aiFormat';
import {
  fetchAllocationPlan,
  fetchOrders,
} from '../features/orders/orderSlice';

import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { PageHeader } from '../components/ui/PageHeader';
import { Alert, Meter, Skeleton } from '../components/ui/Feedback';
import {
  OrderStatusBadge,
  PriorityBadge,
} from '../components/ui/StatusBadges';
import { getOrderHealth, RISK_META } from '../utils/orderHealth';
import { formatDate, formatDateTime } from '../utils/format';

/** Seconds since `startedAt`, ticking once a second while `active`. */
function useElapsedSeconds(active: boolean, startedAt: number) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);

  return active ? Math.max(0, Math.floor((now - startedAt) / 1000)) : 0;
}

function Thinking({ message, seconds }: { message: string; seconds: number }) {
  return (
    <div className="ai-thinking" role="status">
      <div className="ai-thinking-head">
        <span className="ai-orb" aria-hidden="true" />
        <span>{message}</span>
        <span className="ai-elapsed tabular">{seconds}s</span>
      </div>
      <div className="ai-thinking-lines" aria-hidden="true">
        <Skeleton width="92%" />
        <Skeleton width="78%" />
        <Skeleton width="85%" />
        <Skeleton width="60%" />
      </div>
    </div>
  );
}

function AIAssistant() {
  const dispatch = useAppDispatch();
  const toast = useToast();
  const [searchParams] = useSearchParams();

  const {
    exceptionSummary,
    customerCommunication,
    summaryLoading,
    communicationLoading,
    summaryError,
    communicationError,
  } = useAppSelector((state) => state.ai);

  const {
    items: orders,
    loading: ordersLoading,
    allocationPlan,
  } = useAppSelector((state) => state.orders);

  // Pre-select an order when arriving from the exceptions queue.
  const [selectedOrderId, setSelectedOrderId] = useState(
    () => searchParams.get('order') ?? '',
  );
  const [summaryStartedAt, setSummaryStartedAt] = useState(0);
  const [draftStartedAt, setDraftStartedAt] = useState(0);

  const summarySeconds = useElapsedSeconds(summaryLoading, summaryStartedAt);
  const draftSeconds = useElapsedSeconds(communicationLoading, draftStartedAt);

  useEffect(() => {
    if (orders.length === 0) {
      dispatch(fetchOrders());
    }
  }, [dispatch, orders.length]);

  useEffect(() => {
    dispatch(fetchAllocationPlan());
  }, [dispatch]);

  const selectableOrders = useMemo(
    () => orders.filter((order) => order.status !== 'CANCELED'),
    [orders],
  );

  const selectedOrder = orders.find((order) => order.id === selectedOrderId);
  const selectedPlan = Array.isArray(allocationPlan?.orders)
    ? allocationPlan.orders.find((order) => order.orderId === selectedOrderId)
    : undefined;
  const selectedHealth = getOrderHealth(selectedPlan);

  // Changing the selected order clears the previous draft (see onChange).
  const draft = customerCommunication;
  const draftParts = draft ? splitDraft(draft.draft) : null;

  const handleGenerateSummary = () => {
    const start = Date.now();
    setSummaryStartedAt(start);
    dispatch(clearAiErrors());
    dispatch(generateExceptionSummary());
  };

  const handleGenerateCommunication = () => {
    if (!selectedOrderId) return;

    const start = Date.now();
    setDraftStartedAt(start);
    dispatch(clearAiErrors());
    dispatch(generateCustomerCommunication(selectedOrderId));
  };

  async function copyText(text: string, label: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: `${label} copied to clipboard` });
    } catch {
      toast({
        title: 'Could not copy',
        description: 'Select the text and copy it manually.',
        tone: 'error',
      });
    }
  }

  return (
    <div className="page">
      <PageHeader
        eyebrow="Intelligence"
        eyebrowIcon={<Sparkles />}
        title="AI Assistant"
        description="Operational summaries and customer updates, written by Gemini from live plan data."
        actions={
          <Badge tone="accent" icon={<Bot />}>
            Gemini · advisory only
          </Badge>
        }
      />

      <Alert
        tone="accent"
        icon={<ShieldCheck />}
        action={
          <Link to="/audit?entityType=AI_INTERACTION" className="alert-link">
            <ScrollText /> AI audit trail
          </Link>
        }
      >
        AI-generated content may require verification. Review all outputs
        before using them. AI actions do not automatically modify orders or
        send customer messages. Every generation is recorded in the audit log.
      </Alert>

      <div className="ai-grid">
        {/* Exception summary */}
        <Card className="ai-panel">
          <div className="ai-panel-head">
            <span className="ai-panel-icon">
              <FileText />
            </span>
            <div>
              <h2>Exception Summary</h2>
              <p>
                Generate an operational summary of current supply chain
                exceptions, with recommended planner actions.
              </p>
            </div>
          </div>

          <div className="ai-panel-body">
            <div className="ai-controls">
              <Button
                variant="primary"
                icon={<Sparkles />}
                onClick={handleGenerateSummary}
                disabled={summaryLoading}
              >
                {summaryLoading
                  ? 'Generating summary...'
                  : exceptionSummary
                    ? 'Regenerate Summary'
                    : 'Generate Summary'}
              </Button>
            </div>

            {summaryError && <Alert tone="danger">{summaryError}</Alert>}

            {summaryLoading && (
              <Thinking
                message="Analyzing current supply chain exceptions... This can take up to two minutes when Gemini is busy."
                seconds={summarySeconds}
              />
            )}

            {exceptionSummary && !summaryLoading && (
              <div className="ai-result">
                <div className="ai-result-meta">
                  <Badge tone="neutral">
                    {exceptionSummary.exceptionCount} exceptions analyzed
                  </Badge>
                  <span>Generated {formatDateTime(exceptionSummary.generatedAt)}</span>
                </div>
                <AiText text={exceptionSummary.summary} />
                <div className="ai-result-actions">
                  <Button
                    size="sm"
                    icon={<Copy />}
                    onClick={() => copyText(exceptionSummary.summary, 'Summary')}
                  >
                    Copy summary
                  </Button>
                </div>
              </div>
            )}

            {!exceptionSummary && !summaryLoading && !summaryError && (
              <div className="ai-placeholder">
                <Sparkles aria-hidden="true" />
                <p>
                  The summary covers the overall situation, critical
                  exceptions, orders at risk, supply constraints and
                  recommended actions.
                </p>
              </div>
            )}
          </div>
        </Card>

        {/* Customer communication */}
        <Card className="ai-panel">
          <div className="ai-panel-head">
            <span className="ai-panel-icon">
              <Mail />
            </span>
            <div>
              <h2>Customer Communication</h2>
              <p>
                Generate a professional customer-facing order update. Dates
                are never invented.
              </p>
            </div>
          </div>

          <div className="ai-panel-body">
            <div className="field">
              <label className="field-label" htmlFor="ai-order">
                Select order
              </label>
              <select
                id="ai-order"
                className="select"
                value={selectedOrderId}
                onChange={(event) => {
                  setSelectedOrderId(event.target.value);
                  dispatch(clearCustomerCommunication());
                }}
                disabled={ordersLoading || communicationLoading}
              >
                <option value="">
                  {ordersLoading ? 'Loading orders...' : 'Select an order'}
                </option>
                {selectableOrders.map((order) => (
                  <option key={order.id} value={order.id}>
                    {order.orderNumber} — {order.customerName} ({order.status})
                  </option>
                ))}
              </select>
            </div>

            {selectedOrder && (
              <div className="ai-order-context">
                <div className="ai-order-context-row">
                  <strong>{selectedOrder.orderNumber}</strong>
                  <OrderStatusBadge status={selectedOrder.status} />
                  <PriorityBadge priority={selectedOrder.priority} />
                  {selectedHealth && (
                    <Badge tone={RISK_META[selectedHealth.risk].tone} dot>
                      {RISK_META[selectedHealth.risk].label}
                    </Badge>
                  )}
                </div>
                <div className="ai-order-context-facts">
                  <span>
                    {selectedOrder.lines.length} line
                    {selectedOrder.lines.length === 1 ? '' : 's'}
                  </span>
                  <span>Requested {formatDate(selectedOrder.requestedShipDate)}</span>
                  {selectedHealth && (
                    <span>
                      Promise{' '}
                      {selectedHealth.promisedShipDate
                        ? formatDate(selectedHealth.promisedShipDate)
                        : 'not yet available'}
                    </span>
                  )}
                </div>
                {selectedHealth && (
                  <div className="coverage-cell">
                    <Meter
                      value={selectedHealth.allocated}
                      max={selectedHealth.requested}
                      tone={selectedHealth.backordered > 0 ? 'danger' : 'success'}
                      label="Order coverage"
                    />
                    <span className="tabular text-muted">
                      {selectedHealth.allocated}/{selectedHealth.requested} covered
                    </span>
                  </div>
                )}
              </div>
            )}

            <div className="ai-controls">
              <Button
                variant="primary"
                icon={<Sparkles />}
                onClick={handleGenerateCommunication}
                disabled={!selectedOrderId || communicationLoading}
              >
                {communicationLoading ? 'Generating draft...' : 'Generate Customer Draft'}
              </Button>
              {draft && !communicationLoading && (
                <Button
                  variant="ghost"
                  icon={<RotateCcw />}
                  onClick={() => dispatch(clearCustomerCommunication())}
                >
                  Clear
                </Button>
              )}
            </div>

            {communicationError && <Alert tone="danger">{communicationError}</Alert>}

            {communicationLoading && (
              <Thinking message="Preparing customer communication..." seconds={draftSeconds} />
            )}

            {draft && draftParts && !communicationLoading && (
              <div className="email-preview">
                <div className="email-preview-head">
                  <div>
                    <span className="text-muted">To</span>
                    <strong>{draft.customerName}</strong>
                  </div>
                  <div>
                    <span className="text-muted">Re</span>
                    <strong>{draft.orderNumber}</strong>
                  </div>
                  {draftParts.subject && (
                    <div>
                      <span className="text-muted">Subject</span>
                      <strong>{draftParts.subject}</strong>
                    </div>
                  )}
                </div>
                <div className="email-preview-body">{draftParts.body}</div>
                <div className="email-preview-foot">
                  <span className="text-muted">
                    Draft · generated {formatDateTime(draft.generatedAt)} · not sent
                  </span>
                  <Button
                    size="sm"
                    icon={<Copy />}
                    onClick={() => copyText(draft.draft, 'Customer draft')}
                  >
                    Copy customer draft
                  </Button>
                </div>
              </div>
            )}

            {!ordersLoading && orders.length === 0 && (
              <p className="text-muted">
                No orders available. Create an order before generating a
                customer communication.
              </p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

export default AIAssistant;
